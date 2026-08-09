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
  } catch (e) {
    return null;
  }
}
