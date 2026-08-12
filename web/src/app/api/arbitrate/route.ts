import { getInvoice, createDispute, countDisputesForInvoice, markEscrowPaid, markEscrowRefunded, addTreasuryRevenue, type DisputeResolution } from "@/lib/db"
import { resolveDisputeOnChain, isEscrowInvoice, mintReputation, PaymentError } from "@/lib/chain"
import { mistralJsonText, parseJsonResponse } from "@/lib/mistral"
import { verifyFreshWalletProof } from "@/lib/walletProof"

const RESOLUTION_TO_ENUM: Record<DisputeResolution, number> = {
  PAY_FREELANCER: 0,
  REFUND_CLIENT: 1,
  SPLIT_50_50: 2,
}

// PayMate AI Escrow Arbitrator.
//
// FIXED 2026-07-30: this endpoint previously trusted arbitrary free-text
// `originalContract` / `freelancerEvidence` / `clientComplaint` fields from
// the request body and never persisted anything. In practice nothing in the
// app ever sent those fields — the only caller (the "Dispute this invoice"
// panel on /pay/[id]) posted a completely different, hardcoded payload
// ({ repo, prUrl: ".../pull/42", ... }) and read the response back as
// `data.decision.resolution`, which never existed on this endpoint's old
// response shape (`data.arbitration.verdict`). The feature was 100% broken
// end-to-end — every real dispute attempt threw a client-side TypeError.
//
// Now: takes a real invoiceId + the actual dispute conversation text, pulls
// the real invoice scope/amount from Postgres, asks Mistral for a binding
// verdict, and persists every dispute + verdict to the `disputes` table so
// it's auditable later (e.g. from the dashboard). Capped at MAX_ROUNDS
// arbitration calls per invoice so this can't be used to run up an unbounded
// Mistral bill.
//
// FIXED 2026-08-11 (escrow wiring): a verdict is now ENFORCED on-chain. If the
// invoice's funds are locked in the YieldEscrow contract, the resolution moves
// the real USDC (PAY_FREELANCER / REFUND_CLIENT / SPLIT_50_50) and the invoice
// state is updated accordingly (paid or refunded).
const MAX_ROUNDS_PER_INVOICE = 8

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const invoiceId = body?.invoiceId
    const complaint = typeof body?.complaint === "string" ? body.complaint.trim() : ""

    if (!invoiceId || typeof invoiceId !== "string") {
      return Response.json({ detail: "Must provide invoiceId" }, { status: 400 })
    }
    if (complaint.length < 5 || complaint.length > 4000) {
      return Response.json({ detail: "complaint must be between 5 and 4000 characters" }, { status: 422 })
    }

    const invoice = await getInvoice(invoiceId)
    if (!invoice) {
      return Response.json({ detail: "Invoice not found" }, { status: 404 })
    }

    // SECURITY (audit fix 2026-08-13): this endpoint enforces a binding
    // verdict that can move real escrowed USDC on-chain. It previously had no
    // check that the caller was actually a party to the invoice — anyone who
    // knew the invoiceId could file a dispute. Require a wallet-signed,
    // timestamp-bound proof (same pattern as /api/apikeys) that the caller
    // controls either the client or freelancer address.
    const callerAddress = typeof body?.callerAddress === "string" ? body.callerAddress.toLowerCase() : ""
    const isParty = callerAddress === invoice.client.toLowerCase() || callerAddress === invoice.freelancer.toLowerCase()
    if (!isParty) {
      return Response.json({ detail: "callerAddress must be this invoice's client or freelancer." }, { status: 403 })
    }
    const expectedMessage = `PayMate dispute invoice ${invoiceId} at ${body?.ts}`
    const validProof = await verifyFreshWalletProof(
      { wallet: callerAddress, message: body?.message, signature: body?.signature, ts: body?.ts },
      expectedMessage
    )
    if (!validProof) {
      return Response.json(
        { detail: `Wallet ownership proof required. Sign exactly: "PayMate dispute invoice ${invoiceId} at <ts>" and provide { callerAddress, message, signature, ts }.` },
        { status: 401 }
      )
    }

    const priorRounds = await countDisputesForInvoice(invoiceId)
    if (priorRounds >= MAX_ROUNDS_PER_INVOICE) {
      return Response.json({ detail: "This invoice has reached the maximum number of arbitration rounds. Please contact support." }, { status: 429 })
    }

    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) {
      return Response.json({ detail: "Mistral API key not configured for arbitration." }, { status: 500 })
    }

    const systemPrompt = `You are the Supreme AI Arbitrator for the PayMate escrow protocol.
A dispute has been raised on an invoice. Act as an impartial judge and decide who should receive the payment.

Case Details:
Invoice title: "${invoice.title}"
Agreed scope of work: "${invoice.description}"
Invoice amount: $${invoice.amountUsd} USDC
Freelancer wallet: ${invoice.freelancer}
Client wallet: ${invoice.client}
Dispute conversation (client complaint / freelancer response, in order): "${complaint}"

Your task:
1. Analyze the agreed scope of work.
2. Evaluate the dispute conversation for evidence the work was or was not delivered as agreed.
3. Render a final, binding verdict.

Output ONLY a valid JSON object matching this schema:
{
  "resolution": "PAY_FREELANCER" | "REFUND_CLIENT" | "SPLIT_50_50",
  "reasoning": "Concise, specific explanation referencing the scope and the dispute conversation."
}`

    const text = await mistralJsonText({
      messages: [{ role: "user", content: systemPrompt }],
      model: "mistral-large-latest",
    })

    let parsed: { resolution?: string; reasoning?: string }
    try {
      parsed = parseJsonResponse(text)
    } catch {
      return Response.json({ detail: "Arbitrator failed to render a valid verdict." }, { status: 502 })
    }

    const validResolutions: DisputeResolution[] = ["PAY_FREELANCER", "REFUND_CLIENT", "SPLIT_50_50"]
    const resolution = validResolutions.includes(parsed.resolution as DisputeResolution)
      ? (parsed.resolution as DisputeResolution)
      : "SPLIT_50_50" // fail safe to the most neutral outcome if the model returns something unexpected
    const reasoning = typeof parsed.reasoning === "string" && parsed.reasoning.trim()
      ? parsed.reasoning.trim()
      : "The arbitrator did not provide detailed reasoning."

    const dispute = await createDispute({ invoiceId, complaint, resolution, reasoning })

    // Enforce the verdict on-chain: if this invoice's funds are locked in the
    // escrow contract, the AI arbitrator's decision ACTUALLY moves the USDC —
    // to the freelancer (PAY_FREELANCER), back to the client (REFUND_CLIENT),
    // or split 50/50. This is real money movement, not just a recorded verdict.
    let onChain: { executed: boolean; resolutionTxHash?: string; note?: string } = { executed: false }
    let updatedInvoice = null
    if (isEscrowInvoice(invoice) && invoice.escrowStatus === "funded") {
      try {
        const resolutionTxHash = await resolveDisputeOnChain(invoiceId, RESOLUTION_TO_ENUM[resolution])
        if (resolution === "REFUND_CLIENT") {
          updatedInvoice = await markEscrowRefunded(invoiceId, resolutionTxHash, invoice.escrowTxHash || resolutionTxHash)
        } else {
          // PAY_FREELANCER and SPLIT_50_50 both result in the freelancer
          // receiving a payout, so the invoice is settled as paid.
          updatedInvoice = await markEscrowPaid(invoiceId, resolutionTxHash, invoice.escrowTxHash || resolutionTxHash)
          // Same reward path as the direct settle route: the freelancer earns
          // their portable ERC-8004 reputation record.
          try {
            await mintReputation(invoice.freelancer, invoice.isPrivate ? 0 : invoice.amountUsd, 1.0)
          } catch (error) {
            console.log(`Reputation recording queued/failed: ${error}`)
          }
        }
        // Match the direct settle route's accounting: the treasury captures
        // 1% of the settled amount, so ledger stats stay consistent.
        try {
          await addTreasuryRevenue(invoice.amountUsd * 0.01)
        } catch (error) {
          console.error(`[Neural Treasury] Error adding fee after arbitration:`, error)
        }
        onChain = { executed: true, resolutionTxHash }
      } catch (error) {
        const detail = error instanceof PaymentError
          ? error.message
          : `Failed to move escrowed funds on-chain: ${error instanceof Error ? error.message : String(error)}`
        onChain = { executed: false, note: detail }
      }
    } else if (invoice.escrowStatus !== "funded") {
      onChain = {
        executed: false,
        note: "Invoice has no escrowed funds on-chain yet — verdict recorded, no funds moved.",
      }
    }

    return Response.json({
      ok: true,
      disputeId: dispute.id,
      decision: { resolution, reasoning },
      onChain,
      invoice: updatedInvoice,
    })
  } catch (error) {
    console.error("Arbitration Error:", error)
    return Response.json({ detail: "Internal server error during arbitration." }, { status: 500 })
  }
}
