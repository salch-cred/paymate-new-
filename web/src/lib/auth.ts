import { createHmac, timingSafeEqual } from "crypto"

/**
 * Rejects requests that don't carry `Authorization: Bearer <secret>`.
 * Fails closed when the secret isn't configured.
 *
 * Returns a Response to return directly when the request is unauthorized,
 * or null when the request passes.
 */
export function requireBearerAuth(request: Request, secret: string | undefined): Response | null {
  if (!secret) {
    return Response.json({ detail: "Server misconfigured" }, { status: 500 })
  }
  const provided = request.headers.get("authorization") || ""
  const expected = `Bearer ${secret}`
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ detail: "Unauthorized" }, { status: 401 })
  }
  return null
}

/**
 * Constant-time HMAC-SHA256 request signature verification, shared by the
 * Slack (`v0=`) and GitHub (`sha256=`) webhook routes.
 *
 * `sigPrefix` is the prefix the provider prepends to the digest (e.g. "v0="
 * or "sha256="). `base` defaults to `rawBody`; Slack signs a
 * `v0:<timestamp>:<rawBody>` string instead. Pass `timestamp` + `maxAgeSec`
 * to reject replay attacks.
 */
export function verifyHmacSignature(opts: {
  rawBody: string
  signature: string | null
  secret: string
  sigPrefix: string
  base?: string
  timestamp?: string | null
  maxAgeSec?: number
}): boolean {
  const { rawBody, signature, secret, sigPrefix } = opts
  if (!signature || !secret) return false

  if (opts.maxAgeSec != null) {
    if (!opts.timestamp) return false
    const ts = Number(opts.timestamp)
    if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > opts.maxAgeSec) return false
  }

  const base = opts.base ?? rawBody
  const expected = sigPrefix + createHmac("sha256", secret).update(base).digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
