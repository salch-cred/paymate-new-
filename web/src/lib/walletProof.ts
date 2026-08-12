import { verifyWalletSignature } from "./apikey"

const DEFAULT_TTL_MS = 5 * 60 * 1000

export interface WalletProofInput {
  wallet?: unknown
  message?: unknown
  signature?: unknown
  ts?: unknown
}

/**
 * SECURITY (audit fix 2026-08-13): shared helper for the "wallet-signed proof
 * of intent" pattern already used by /api/apikeys — the caller signs
 * `expectedMessage` (which must itself embed the timestamp) with their
 * wallet's private key, and the proof is only valid for `ttlMs` after
 * signing. This gives every mutation that claims to act "as wallet X" real
 * cryptographic proof of ownership instead of trusting a bare address string
 * in the request body (which is always public/guessable).
 *
 * Returns true only if the signature is valid, fresh, and matches both the
 * expected wallet and the exact expected message text.
 */
export async function verifyFreshWalletProof(
  input: WalletProofInput | null | undefined,
  expectedMessage: string,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<boolean> {
  if (!input || typeof input.wallet !== "string" || typeof input.message !== "string" || typeof input.signature !== "string") {
    return false
  }
  const ts = Number(input.ts)
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > ttlMs) return false
  if (input.message !== expectedMessage) return false
  return verifyWalletSignature(input.message, input.signature, input.wallet)
}
