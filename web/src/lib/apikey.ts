import { createHash, randomBytes } from "crypto"
import { getApiKeyByHash, touchApiKey, consumeApiQuota, getApiKeyById } from "./db"
import { verifyMessage } from "viem"

/**
 * Public Agent API keys.
 *
 * Every OpenClaw/agent team can mint their own `pm_...` key on the Developers
 * page (wallet-signed proof of ownership) and call the agent endpoints with
 * `Authorization: Bearer pm_...`. Only the SHA-256 hash is stored in Postgres —
 * the raw secret is shown exactly once at creation. Each key has a monthly USD
 * quota that consumption is checked against (fail closed).
 */

export const API_KEY_PREFIX = "pm_"

/** SHA-256 hash of the raw key. This is what we store and compare. */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex")
}

/** Generates a new random `pm_`-prefixed secret (32 bytes of CSPRNG entropy). */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = API_KEY_PREFIX + randomBytes(32).toString("hex")
  return { raw, hash: hashApiKey(raw), prefix: raw.slice(0, 10) + "…" }
}

export interface AuthenticatedKey {
  id: string
  name: string
  wallet: string
  quotaUsd: number
  usedUsd: number
}

/**
 * Authenticates `Authorization: Bearer pm_...` against the DB.
 * Returns the key record on success, or a `Response` to return directly.
 */
export async function authenticateApiKey(request: Request): Promise<AuthenticatedKey | Response> {
  const auth = request.headers.get("authorization")
  const rawKey = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : null
  if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX)) {
    return Response.json(
      { detail: "Missing or invalid API key. Create one at /developers." },
      { status: 401 }
    )
  }

  const key = await getApiKeyByHash(hashApiKey(rawKey))
  if (!key) {
    return Response.json({ detail: "Invalid API key." }, { status: 401 })
  }
  if (key.revokedAt) {
    return Response.json({ detail: "This API key has been revoked." }, { status: 401 })
  }

  await touchApiKey(key.id).catch(() => {})
  return {
    id: key.id,
    name: key.name,
    wallet: key.wallet,
    quotaUsd: key.quotaUsd,
    usedUsd: key.usedUsd,
  }
}

/** Reserves `amountUsd` against the key's quota. Throws when over quota. */
export async function assertApiQuota(id: string, amountUsd: number): Promise<void> {
  const ok = await consumeApiQuota(id, amountUsd)
  if (!ok) {
    throw new Error(
      "Monthly API key quota exceeded. Top up your quota or use a different key on the Developers page."
    )
  }
}

/** Returns the key's live usage (for quota checks on read paths). */
export async function getApiKeyUsage(id: string) {
  const key = await getApiKeyById(id)
  if (!key) return null
  return { id: key.id, name: key.name, quotaUsd: key.quotaUsd, usedUsd: key.usedUsd }
}

/**
 * Verifies that `signature` is a valid EIP-191 personal_sign from `wallet` for
 * the given message. Used to prove wallet ownership when creating/revoking keys
 * on the Developers page.
 */
export async function verifyWalletSignature(message: string, signature: string, wallet: string): Promise<boolean> {
  try {
    const recovered = await verifyMessage({
      address: wallet as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    })
    return recovered
  } catch {
    return false
  }
}
