import { createHmac, timingSafeEqual } from "crypto"

/**
 * Evidence-Chain Delivery Receipts.
 *
 * Every PayMate settlement can emit a signed Delivery Receipt that binds the
 * money movement to the deliverable — the "evidence chain" the GOAT ecosystem
 * asks for: identity (freelancer + client) ↔ quote (invoice + amount) ↔ value
 * movement (txHash) ↔ delivery state (deliverableHash).
 *
 * The receipt is an HMAC-SHA256 signature by the trusted PayMate issuer, NOT
 * a fabricated "IPFS CID". Anyone can re-verify it with `verifyDeliveryReceipt`.
 * The ultimate trust anchor remains the on-chain transaction (explorer link);
 * this receipt is the machine-readable proof that PayMate verified it.
 *
 * SECURITY (fail-closed): if no signing secret is configured, we REFUSE to
 * sign rather than fall back to a public constant (a forgeable HMAC is worse
 * than no signature). Callers receive `sig: null` and must label the receipt
 * as unsigned.
 */

export interface DeliveryReceiptPayload {
  version: 1
  kind: "delivery"
  invoiceId: string
  amountUsd: number
  freelancer: string
  client: string
  txHash: string
  /** sha256 of the delivered content — binds the payment to the exact artifact. */
  deliverableHash: string
  timestamp: number
  network: string
}

export interface DeliveryReceipt {
  payload: DeliveryReceiptPayload
  /** null when no signing secret is configured — never forged. */
  sig: string | null
}

function signingSecret(): string {
  const secret = process.env.RECEIPT_SIGNING_SECRET || process.env.AGENT_PAY_ADMIN_SECRET
  if (!secret) {
    throw new Error(
      "Receipt signing secret is not configured (RECEIPT_SIGNING_SECRET or AGENT_PAY_ADMIN_SECRET). " +
        "Refusing to sign a delivery receipt with a public fallback secret."
    )
  }
  return secret
}

/** Canonical, deterministic string the HMAC is computed over. */
function canonical(payload: DeliveryReceiptPayload): string {
  return JSON.stringify({
    version: payload.version,
    kind: payload.kind,
    invoiceId: payload.invoiceId,
    amountUsd: payload.amountUsd,
    freelancer: payload.freelancer,
    client: payload.client,
    txHash: payload.txHash,
    deliverableHash: payload.deliverableHash,
    timestamp: payload.timestamp,
    network: payload.network,
  })
}

/**
 * Signs a delivery receipt for a verified settlement.
 * Throws when no signing secret is configured — callers should catch and
 * return `sig: null` (an explicitly unsigned receipt).
 */
export function createDeliveryReceipt(
  input: Omit<DeliveryReceiptPayload, "version" | "kind">
): DeliveryReceipt {
  const payload: DeliveryReceiptPayload = { version: 1, kind: "delivery", ...input }
  const sig = createHmac("sha256", signingSecret()).update(canonical(payload)).digest("hex")
  return { payload, sig }
}

/** Re-verifies a delivery receipt (constant-time). Unsigned receipts fail. */
export function verifyDeliveryReceipt(receipt: DeliveryReceipt): boolean {
  if (!receipt.sig) return false
  try {
    const expected = createHmac("sha256", signingSecret())
      .update(canonical(receipt.payload))
      .digest("hex")
    const a = Buffer.from(expected)
    const b = Buffer.from(receipt.sig)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}
