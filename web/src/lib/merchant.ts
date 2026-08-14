import { createHmac, randomBytes, timingSafeEqual } from "crypto"

/**
 * Merchant Checkout — pure helpers (no DB).
 *
 * A merchant with a `pm_...` API key creates checkouts via POST
 * /api/merchant/checkout. Each checkout is an ordinary PayMate invoice whose
 * payment settles on GOAT Network; when it's paid, PayMate POSTs a signed
 * `checkout.paid` webhook to the merchant's webhook URL so their backend can
 * fulfil the order. Signatures use HMAC-SHA256 keyed with the merchant's
 * webhook secret (generated when their profile is created, visible in the
 * /merchant portal).
 */

export function generateWebhookSecret(): string {
  return randomBytes(24).toString("hex")
}

/** HMAC-SHA256(secret, rawBody) as lowercase hex — the X-PayMate-Signature. */
export function signMerchantWebhook(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf-8").digest("hex")
}

/** Constant-time verification of an incoming signature. Fails closed. */
export function verifyMerchantWebhook(secret: string, rawBody: string, signature: string | null | undefined): boolean {
  if (!signature) return false
  const a = Buffer.from(signature, "hex")
  const b = Buffer.from(signMerchantWebhook(secret, rawBody), "hex")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export interface MerchantWebhookPayload {
  event: "checkout.paid"
  checkoutId: string
  orderId: string | null
  amountUsd: number
  currency: "USDC"
  txHash: string
  paidAt: number
}

export function buildCheckoutWebhook(invoice: {
  id: string
  merchantOrderId?: string | null
  amountUsd: number
  txHash?: string | null
  paidAt?: number | null
}): MerchantWebhookPayload {
  return {
    event: "checkout.paid",
    checkoutId: invoice.id,
    orderId: invoice.merchantOrderId || null,
    amountUsd: invoice.amountUsd,
    currency: "USDC",
    txHash: invoice.txHash || "",
    paidAt: invoice.paidAt || Date.now(),
  }
}

/** Stripe-style timestamp + signature header pair. */
export function webhookHeaders(secret: string, payload: MerchantWebhookPayload): Record<string, string> {
  const rawBody = JSON.stringify(payload)
  return {
    "Content-Type": "application/json",
    "X-PayMate-Signature": signMerchantWebhook(secret, rawBody),
  }
}
