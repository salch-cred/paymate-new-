import { getInvoice, createDispute, countDisputesForInvoice, type DisputeResolution } from "@/lib/db"
import { mistralJsonText, parseJsonResponse } from "@/lib/mistral"

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

    // NOTE: this endpoint records a binding *verdict* but does not itself move
    // funds — there is no deployed escrow contract wired up yet (see
    // contracts/src/YieldEscrow.sol). Once an escrow is live, `resolution`
    // here is exactly the input `resolveEscrow`/`resolveInFavorOf` would take.
    return Response.json({
      ok: true,
      disputeId: dispute.id,
      decision: { resolution, reasoning },
    })
  } catch (error) {
    console.error("Arbitration Error:", error)
    return Response.json({ detail: "Internal server error during arbitration." }, { status: 500 })
  }
}
