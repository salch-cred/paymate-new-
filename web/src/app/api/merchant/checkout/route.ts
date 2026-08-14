import { NextResponse } from "next/server"
import { getAddress, isAddress } from "viem"
import { authenticateApiKey } from "@/lib/apikey"
import { createInvoice, getMerchantProfile, upsertMerchantProfile } from "@/lib/db"
import { generateWebhookSecret } from "@/lib/merchant"
import { isSafeWebhookUrl } from "@/lib/webhookSafety"
import { OPEN_CLIENT_ADDRESS } from "@/lib/constants"

/**
 * Merchant Checkout API.
 *
 *   POST /api/merchant/checkout   (Authorization: Bearer pm_...)
 *   { amountUsd, title?, description?, orderId?, webhookUrl?, successUrl?, cancelUrl?, receiveWallet? }
 *   → { ok, checkoutId, orderId, amountUsd, status, payUrl, successUrl, cancelUrl, webhookUrl }
 *
 * Each checkout is an ordinary PayMate invoice that settles on GOAT Network.
 * Unlike the agent endpoints, creating a checkout does NOT consume the key's
 * monthly quota — this is merchant revenue, not agent spend. When the payment
 * settles, PayMate POSTs a signed `checkout.paid` webhook to the merchant.
 */
export async function POST(request: Request) {
  const key = await authenticateApiKey(request)
  if (key instanceof NextResponse || key instanceof Response) return key

  try {
    const body = await request.json().catch(() => null)
    const { amountUsd, title, description, orderId, webhookUrl, successUrl, cancelUrl, receiveWallet } = body || {}

    if (!body || !Number.isFinite(Number(amountUsd)) || Number(amountUsd) <= 0) {
      return NextResponse.json({ detail: "amountUsd must be a positive number" }, { status: 422 })
    }
    if (Number(amountUsd) > 1_000_000) {
      return NextResponse.json({ detail: "amountUsd exceeds the 1,000,000 USDC single-checkout limit" }, { status: 422 })
    }
    if (webhookUrl && !isSafeWebhookUrl(String(webhookUrl))) {
      return NextResponse.json(
        { detail: "webhookUrl must be a public https/http URL (no localhost or private ranges)" },
        { status: 422 },
      )
    }

    // Lazily create the merchant profile on first checkout (webhook secret
    // generated once and reused so earlier webhooks stay verifiable).
    let profile = await getMerchantProfile(key.id)
    if (!profile) {
      profile = await upsertMerchantProfile(key.id, {
        storeName: key.name,
        receiveWallet: key.wallet,
        webhookSecret: generateWebhookSecret(),
      })
    }

    const settleWallet =
      receiveWallet && typeof receiveWallet === "string" && isAddress(receiveWallet)
        ? getAddress(receiveWallet)
        : profile.receiveWallet || key.wallet

    const invoice = await createInvoice({
      freelancer: settleWallet,
      client: OPEN_CLIENT_ADDRESS,
      title: (title && String(title).trim()) || (profile.storeName ? `${profile.storeName} purchase` : "PayMate checkout"),
      description:
        (description && String(description).trim()) ||
        "Checkout via the PayMate merchant API — settled on GOAT Network.",
      amountUsd: Number(amountUsd),
      webhookUrl: webhookUrl ? String(webhookUrl) : profile.webhookUrl,
      apiKeyId: key.id,
      merchantOrderId: orderId ? String(orderId).slice(0, 128) : null,
      merchantWebhookSecret: profile.webhookSecret,
    })

    const base = (process.env.API_BASE || "https://paymateagent.xyz").replace(/\/$/, "")
    return NextResponse.json({
      ok: true,
      checkoutId: invoice.id,
      orderId: invoice.merchantOrderId,
      amountUsd: invoice.amountUsd,
      status: invoice.status,
      payUrl: `${base}/pay/${invoice.id}`,
      successUrl: successUrl ? String(successUrl).slice(0, 500) : profile.successUrl,
      cancelUrl: cancelUrl ? String(cancelUrl).slice(0, 500) : profile.cancelUrl,
      webhookUrl: invoice.webhookUrl,
      message:
        "Checkout created. Redirect the customer to payUrl; we POST a signed checkout.paid webhook once the on-chain payment settles on GOAT.",
    })
  } catch (error) {
    console.error("Merchant checkout error:", error)
    return NextResponse.json({ detail: "Failed to create checkout" }, { status: 500 })
  }
}
