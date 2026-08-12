import { autonomousAgentPay } from "@/lib/agent"
import { getInvoice, markPaid } from "@/lib/db"
import { mintReputation } from "@/lib/chain"
import { checkAndConsumeIntentBudget } from "@/lib/rateLimit"
import { requireBearerAuth } from "@/lib/auth"
import { authenticateApiKey, assertApiQuota } from "@/lib/apikey"
import { REFERRAL_MULTIPLIER_TAG } from "@/lib/constants"

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
    // Auth: a public Agent API key (pm_...) OR the legacy shared admin secret.
    const key = await authenticateApiKey(request)
    let viaApiKey = true
    let apiKeyId: string | null = null
    if (key instanceof Response) {
      // Not an API key — fall back to the shared admin secret for server-side ops.
      viaApiKey = false
      if (!process.env.AGENT_PAY_ADMIN_SECRET) {
        console.error("[agent/pay] AGENT_PAY_ADMIN_SECRET is not configured. Refusing to run.")
      }
      const unauthorized = requireBearerAuth(request, process.env.AGENT_PAY_ADMIN_SECRET)
      if (unauthorized) return unauthorized
    } else {
      apiKeyId = key.id
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

    // SECURITY (audit fix 2026-08-13): self-service API keys are minted with
    // no vetting (see /api/apikeys). Cap a single autonomous payout triggered
    // via an API key well below the shared MAX_AUTO_PAY used by the trusted
    // admin-bearer-secret path, so a freshly self-issued key cannot alone
    // drain a large single payout even before the hourly budget kicks in.
    const API_KEY_MAX_SINGLE_PAYOUT_USD = 500
    if (viaApiKey && invoice.amountUsd > API_KEY_MAX_SINGLE_PAYOUT_USD) {
      return Response.json(
        { detail: `Payouts via a self-service API key are capped at $${API_KEY_MAX_SINGLE_PAYOUT_USD} per invoice. Use the admin-authenticated path for larger amounts.` },
        { status: 403 }
      )
    }

    // 1. Global payout budget check, independent of the per-invoice cap
    // already enforced inside autonomousAgentPay (same guard clawup/intent uses).
    const budgetOk = await checkAndConsumeIntentBudget(invoice.amountUsd)
    if (!budgetOk) {
      return Response.json({ detail: "Autonomous payout budget exceeded for this window. Manual review required." }, { status: 429 })
    }

    // 1b. When called with a public API key, charge the payout against the key's
    // monthly quota too (fail closed on over-quota).
    if (viaApiKey && apiKeyId) {
      try {
        await assertApiQuota(apiKeyId, invoice.amountUsd)
      } catch (error) {
        return Response.json({ detail: error instanceof Error ? error.message : "Quota exceeded" }, { status: 429 })
      }
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
      const multiplier = updated.webhookUrl === REFERRAL_MULTIPLIER_TAG ? 1.2 : 1.0;
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
