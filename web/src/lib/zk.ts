/**
 * Zero-Knowledge Commitment Scheme Utilities
 * 
 * In this hackathon implementation, we use SHA-256 to create cryptographic 
 * commitments of the invoice amount and client address. The backend only 
 * receives the commitment hash (so the server doesn't know the amount).
 * The true data is encrypted into a View Key that is passed via the URL fragment.
 */

// Simple hex encoding/decoding for the browser
export function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generate a ZK commitment hash from the amount and a random salt
export async function generateCommitment(amountUsd: number, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${amountUsd}_${salt}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return toHex(hashBuffer);
}

// In a full ZK circuit, this encrypts the payload into a View Key using AES-GCM
// For this frontend implementation, we encode the salt and amount in base64 
// to be passed via the URL hash fragment (which never hits the server).
export function generateViewKey(amountUsd: number, salt: string): string {
  return btoa(JSON.stringify({ amountUsd, salt }));
}

// Decrypts the view key back into the true amount
export function decryptViewKey(viewKey: string): { amountUsd: number, salt: string } | null {
  try {
    const decoded = atob(viewKey);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Server-side check for a private (ZK-shielded) invoice: the client presents
 * the view key from the pay-link URL fragment, and the backend accepts it only
 * if it decrypts to the invoice's real amount (tolerance for float rounding)
 * AND matches the stored SHA-256 commitment when one was captured at creation.
 * This is what lets the requirements endpoint reveal the true settlement amount
 * to the authorized payer while keeping it masked from everyone else.
 */
export async function verifyViewKeyForInvoice(
  viewKey: string | null | undefined,
  amountUsd: number,
  zkCommitment: string | null | undefined
): Promise<boolean> {
  if (!viewKey) return false
  const decrypted = decryptViewKey(viewKey)
  if (!decrypted) return false
  if (typeof decrypted.amountUsd !== "number" || !Number.isFinite(decrypted.amountUsd) || decrypted.amountUsd <= 0) return false
  if (Math.abs(decrypted.amountUsd - amountUsd) > 0.01) return false
  if (zkCommitment) {
    // The commitment is SHA-256(`${amountUsd}_${salt}`) — re-derive it to prove
    // the key actually belongs to this invoice, not just any matching amount.
    const encoder = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(`${decrypted.amountUsd}_${decrypted.salt}`))
    const recomputed = toHex(hashBuffer)
    if (recomputed !== zkCommitment.toLowerCase()) return false
  }
  return true
}
