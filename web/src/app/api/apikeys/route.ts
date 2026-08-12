import { randomUUID } from "crypto"
import { isAddress, getAddress } from "viem"
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/db"
import { generateApiKey, verifyWalletSignature } from "@/lib/apikey"

// SECURITY (audit fix 2026-08-13): this endpoint is fully self-service —
// anyone can mint a key for any wallet they can sign a message with, with no
// vetting. $100,000 of autonomous-payout quota per key (up to 5 keys/wallet)
// was wildly disproportionate to that trust level. $500/key is still enough
// for real testing/demo traffic; raise it manually (DB) for a vetted partner.
const MAX_QUOTA = 500

/** Freshness window for wallet-signed proofs (replay protection). */
const PROOF_TTL_MS = 5 * 60 * 1000

interface AuthedRequest {
  wallet: string
  body: Record<string, unknown>
}

/** The exact statement the wallet signs; the unix ms `ts` is bound in. */
function proofMessage(wallet: string, ts: number): string {
  return `PayMate API key management for ${getAddress(wallet)} at ${ts}`
}

/**
 * Validates a wallet-owned proof. The signed message is
 * `PayMate API key management for <wallet> at <ts>` — the timestamp is bound
 * into the signed statement so a captured signature cannot be replayed after
 * the 5-minute freshness window (and never for a different wallet).
 */
async function requireWalletProof(request: Request): Promise<AuthedRequest | Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || !body.wallet || !isAddress(body.wallet as string) || !body.message || !body.signature) {
    return Response.json({ detail: "Wallet ownership proof required: { wallet, message, signature, ts }" }, { status: 401 })
  }
  const ts = Number(body.ts)
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > PROOF_TTL_MS) {
    return Response.json({ detail: "Proof expired. Sign again and retry." }, { status: 401 })
  }
  const expected = proofMessage(body.wallet as string, ts)
  if (body.message !== expected) {
    return Response.json({ detail: "Invalid signed message. Must be exactly: " + expected }, { status: 401 })
  }
  const valid = await verifyWalletSignature(body.message as string, body.signature as string, body.wallet as string)
  if (!valid) {
    return Response.json({ detail: "Signature does not match the wallet address." }, { status: 401 })
  }
  return { wallet: getAddress(body.wallet as string), body }
}

/**
 * Validates the query-string variant of the proof (GET carries no body).
 * Same timestamp-bound statement, same freshness window.
 */
async function requireWalletProofFromQuery(request: Request): Promise<{ wallet: string } | Response> {
  const url = new URL(request.url)
  const wallet = url.searchParams.get("wallet")
  const message = url.searchParams.get("message")
  const signature = url.searchParams.get("signature")
  const ts = Number(url.searchParams.get("ts"))
  if (!wallet || !isAddress(wallet) || !message || !signature || !Number.isFinite(ts)) {
    return Response.json({ detail: "Wallet ownership proof required: ?wallet=&message=&signature=&ts=" }, { status: 401 })
  }
  if (Math.abs(Date.now() - ts) > PROOF_TTL_MS) {
    return Response.json({ detail: "Proof expired. Sign again and retry." }, { status: 401 })
  }
  if (message !== proofMessage(wallet, ts)) {
    return Response.json({ detail: "Invalid signed message." }, { status: 401 })
  }
  const valid = await verifyWalletSignature(message, signature, wallet)
  if (!valid) {
    return Response.json({ detail: "Signature does not match the wallet address." }, { status: 401 })
  }
  return { wallet: getAddress(wallet) }
}

/** List the caller's API keys (wallet-signed proof required). */
export async function GET(request: Request) {
  const auth = await requireWalletProofFromQuery(request)
  if (auth instanceof Response) return auth
  // Never expose the key hash — strip it before returning rows to the client.
  const keys = (await listApiKeys(auth.wallet)).map(k => ({
    id: k.id,
    name: k.name,
    wallet: k.wallet,
    keyPrefix: k.keyPrefix,
    quotaUsd: k.quotaUsd,
    usedUsd: k.usedUsd,
    revokedAt: k.revokedAt,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
  }))
  return Response.json({ keys })
}

/** Create a new API key for the caller's wallet. */
export async function POST(request: Request) {
  const auth = await requireWalletProof(request)
  if (auth instanceof Response) return auth

  const name = typeof auth.body.name === "string" ? auth.body.name.trim().slice(0, 60) : "My Agent"
  let quotaUsd = Number(auth.body.quotaUsd)
  if (!Number.isFinite(quotaUsd) || quotaUsd <= 0) quotaUsd = 100
  quotaUsd = Math.min(quotaUsd, MAX_QUOTA)

  const keyCount = (await listApiKeys(auth.wallet)).filter(k => !k.revokedAt).length
  if (keyCount >= 5) {
    return Response.json({ detail: "Maximum of 5 active API keys per wallet. Revoke one first." }, { status: 429 })
  }

  const generated = generateApiKey()
  const id = randomUUID()
  await createApiKey({
    id,
    name,
    wallet: auth.wallet,
    keyHash: generated.hash,
    keyPrefix: generated.prefix,
    quotaUsd,
  })

  // The raw secret is returned exactly once — it is unrecoverable afterwards.
  return Response.json({
    ok: true,
    key: {
      id,
      name,
      keyPrefix: generated.prefix,
      rawKey: generated.raw,
      quotaUsd,
      warning: "Store this key securely. It is shown only once and cannot be recovered.",
    },
  }, { status: 201 })
}

/** Revoke a key. */
export async function DELETE(request: Request) {
  const auth = await requireWalletProof(request)
  if (auth instanceof Response) return auth

  if (typeof auth.body.id !== "string" || !auth.body.id) {
    return Response.json({ detail: "Must provide key id" }, { status: 400 })
  }
  const ok = await revokeApiKey(auth.body.id, auth.wallet)
  if (!ok) {
    return Response.json({ detail: "Key not found, not yours, or already revoked." }, { status: 404 })
  }
  return Response.json({ ok: true })
}
