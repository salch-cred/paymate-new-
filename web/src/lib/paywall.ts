import { paymentRequirements } from "./chain"
import type { Invoice } from "./db"

/**
 * Pay-to-Unlock Paywall (x402).
 *
 * The same challenge/verify flow the settlement route uses, exposed as a
 * reusable guard so ANY agent endpoint can be monetized:
 *
 *   1. Client requests the resource → server returns HTTP 402 with the
 *      `PAYMENT-REQUIRED` header (base64 x402 payload) + JSON body.
 *   2. Client pays USDC on GOAT Network to the advertised `payTo` address.
 *   3. Client retries with `PAYMENT-SIGNATURE: base64({"txHash": "0x..."})`.
 *   4. PayMate verifies the transfer on-chain and the server serves the
 *      content, attaching a signed Delivery Receipt (evidence chain).
 *
 * Header names follow the x402 open standard (case-insensitive on the wire).
 */

export const PAYMENT_REQUIRED_HEADER = "payment-required"
export const PAYMENT_SIGNATURE_HEADER = "payment-signature"
export const PAYMENT_RESPONSE_HEADER = "payment-response"

/**
 * Builds the HTTP 402 response for an invoice: JSON body (the x402 `accepts[]`
 * contract) + the `PAYMENT-REQUIRED` header. `extra` fields (e.g. `invoiceId`,
 * `payUrl`) are merged into the JSON body so clients can echo them back on the
 * paid retry. Fails closed on misconfiguration.
 */
export function paywallChallengeResponse(
  invoice: Invoice,
  extra: Record<string, unknown> = {}
): Response {
  const requirements = paymentRequirements(invoice)
  const body = {
    x402Version: requirements.x402Version,
    error: requirements.error,
    ...extra,
    accepts: requirements.accepts,
  }
  return new Response(JSON.stringify(body), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      [PAYMENT_REQUIRED_HEADER]: Buffer.from(JSON.stringify(requirements)).toString("base64"),
    },
  })
}

/**
 * Parses the payer's proof of payment out of a retried request.
 * Accepts the x402 `PAYMENT-SIGNATURE` header (base64 JSON `{txHash}` or a raw
 * 0x hash) and falls back to the legacy `X-PAYMENT` header used elsewhere in
 * PayMate. Returns null when no proof is present.
 */
export function extractTxHash(request: Request): string | null {
  const raw =
    request.headers.get(PAYMENT_SIGNATURE_HEADER) || request.headers.get("x-payment")
  if (!raw) return null
  const trimmed = raw.trim()
  if (/^0x[a-fA-F0-9]{64,}$/.test(trimmed)) return trimmed
  try {
    const decoded = JSON.parse(Buffer.from(trimmed, "base64").toString("utf8"))
    if (typeof decoded?.txHash === "string" && decoded.txHash) return decoded.txHash
  } catch {
    // not base64 JSON — fall through
  }
  return trimmed.length > 0 ? trimmed : null
}
