import { NextResponse } from "next/server"
import { getAddress } from "viem"
import { createBotInvoice, tgMiniAppUrl } from "@/lib/chat-invoice"
import { paymentRequirements, PaymentError } from "@/lib/chain"
import { authenticateApiKey, assertApiQuota } from "@/lib/apikey"
import { OPEN_CLIENT_ADDRESS } from "@/lib/constants"

/**
 * Agent-facing Pay-to-Unlock API.
 *
 * Any OpenClaw / external agent can call this with a `pm_...` API key to mint
 * a paywalled invoice and receive the full x402 unlock recipe:
 *
 *   POST /api/agent/paywall   { title, description, amountUsd, freelancerWallet, content? }
 *   → { ok, invoiceId, pageUrl, payUrl, accepts, unlockInstructions }
 *
 * The agent then:
 *   1. Serves (or references) its content behind the `payUrl` / accepts quote,
 *      or points clients at `pageUrl` so PayMate serves the stored content.
 *   2. Its client pays the quoted USDC on GOAT Network.
 *   3. The client retries with `PAYMENT-SIGNATURE` to unlock (see docs).
 */
export async function POST(request: Request) {
  // Public API keys only — consistent with the other agent endpoints.
  const key = await authenticateApiKey(request)
  if (key instanceof NextResponse || key instanceof Response) return key

  try {
    const body = await request.json()
    const { title, description, amountUsd, freelancerWallet, clientWallet, content } = body

    if (!title || !description || !amountUsd || !freelancerWallet) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (!Number.isFinite(Number(amountUsd)) || Number(amountUsd) <= 0) {
      return NextResponse.json({ error: "amountUsd must be a positive number" }, { status: 422 })
    }
    if (content !== undefined && content !== null && (typeof content !== "string" || content.length > 50_000)) {
      return NextResponse.json({ error: "content must be a string of at most 50000 characters" }, { status: 422 })
    }

    // Reserve quota BEFORE creating the invoice (fail closed).
    try {
      await assertApiQuota(key.id, Number(amountUsd))
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Quota exceeded" }, { status: 429 })
    }

    const clientAddress = clientWallet
      ? getAddress(clientWallet)
      : OPEN_CLIENT_ADDRESS

    const { invoice, payUrl } = await createBotInvoice({
      source: "paywall-agent",
      freelancer: getAddress(freelancerWallet),
      client: clientAddress,
      title,
      description,
      amountUsd: Number(amountUsd),
      apiKeyId: key.id,
      // Persist the deliverable so /paywall/[id] serves it after payment —
      // stored in the same write as the invoice (no partial state).
      paywallContent: content || null,
    })

    // The x402 quote the agent serves behind its paywalled endpoint.
    const requirements = paymentRequirements(invoice)

    return NextResponse.json({
      ok: true,
      invoiceId: invoice.id,
      pageUrl: `https://paymateagent.xyz/paywall/${invoice.id}`,
      payUrl,
      // Telegram Mini App checkout (on-chain GOAT) for clients on Telegram.
      tgMiniAppUrl: tgMiniAppUrl(invoice.id),
      accepts: requirements.accepts,
      unlockInstructions:
        "Present the payUrl (or the accepts[] quote) to your client. After they pay USDC on " +
        "GOAT Network, retry your endpoint with the PAYMENT-SIGNATURE header " +
        '`PAYMENT-SIGNATURE: base64({"txHash":"0x..."})` to verify and unlock. ' +
        "If the client is on Telegram, point them at tgMiniAppUrl instead — it opens the " +
        "PayMate Mini App and they pay on-chain USDC on GOAT Network. " +
        "See https://paymateagent.xyz/docs#paywall for the full flow.",
    })
  } catch (error) {
    // Pass through configuration errors (e.g. USDC_TOKEN missing) instead of
    // masking them behind a generic 500 — same behavior as the paywall route.
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("Paywall Agent API Error:", error)
    return NextResponse.json({ error: "Failed to create paywalled invoice" }, { status: 500 })
  }
}
