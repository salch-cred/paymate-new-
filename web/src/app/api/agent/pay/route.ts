import { autonomousAgentPay } from "@/lib/agent"
import { getInvoice, markPaid } from "@/lib/db"
import { mintReputation } from "@/lib/chain"
import { checkAndConsumeIntentBudget } from "@/lib/rateLimit"

// SECURITY (audit follow-up, 2026-07-30): this endpoint triggers the exact
// same real, autonomous USDC payout as /api/clawup/intent (it calls the same
// autonomousAgentPay()), but — unlike clawup/intent — it previously required
// NO authentication at all and was NOT subject to the global rolling payout
// budget. It was unreachable in practice today only because nothing in this
// codebase currently writes a real EIP-712 signature onto an invoice via any
// public path, so autonomousAgentPay's signature check always failed closed.
// That is fragile defense-in-depth (one future bug elsewhere that lets a
// caller attach a signature would make this instantly exploitable to drain
// the agent treasury up to MAX_AUTO_PAY per call, with no rate limit).
// Locking it down the same way clawup/intent is locked down, regardless of
// current reachability.
export async function POST(request: Request) {
  try {
    const sharedSecret = process.env.AGENT_PAY_ADMIN_SECRET
    if (!sharedSecret) {
      console.error("[agent/pay] AGENT_PAY_ADMIN_SECRET is not configured. Refusing to run.")
      return Response.json({ detail: "Server misconfigured" }, { status: 500 })
    }
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${sharedSecret}`) {
      return Response.json({ detail: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || !body.invoiceId) {
      return Response.json({ detail: "Must provide invoiceId" }, { status: 400 })
    }

    const invoice = await getInvoice(body.invoiceId)
    if (!invoice) {
      return Response.json({ detail: "Invoice not found" }, { status: 404 })
    }

    if (invoice.status === "paid") {
      return Response.json({ detail: "Invoice already paid" }, { status: 400 })
    }

    // 1. Global payout budget check, independent of the per-invoice cap
    // already enforced inside autonomousAgentPay (same guard clawup/intent uses).
    const budgetOk = await checkAndConsumeIntentBudget(invoice.amountUsd)
    if (!budgetOk) {
      return Response.json({ detail: "Autonomous payout budget exceeded for this window. Manual review required." }, { status: 429 })
    }

    // 2. Trigger Autonomous Agent to Pay (Agent will verify EIP-712 Signature internally)
    const txHash = await autonomousAgentPay(invoice)

    // 2. Settlement Verification & Recording
    const updated = await markPaid(invoice.id, txHash)
    if (!updated) {
      return Response.json({ detail: "Failed to mark paid" }, { status: 500 })
    }

    // 3. Mint On-Chain Reputation via ERC-8004
    try {
      const multiplier = updated.webhookUrl === "clawup-referral-1.2x" ? 1.2 : 1.0;
      await mintReputation(updated.freelancer, updated.amountUsd, multiplier)
    } catch (e) {
      console.log("Reputation failed", e)
    }

    return Response.json({ ok: true, invoice: updated, agentTxHash: txHash })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ detail: message }, { status: 500 })
  }
}
