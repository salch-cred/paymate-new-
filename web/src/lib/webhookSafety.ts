/**
 * SECURITY (audit fix 2026-08-13): best-effort SSRF guard for user-supplied
 * webhook URLs (e.g. Invoice.webhookUrl), which the server fetches directly
 * (see /api/pay/[id]/settle). Without this, an attacker could point a
 * webhook at internal infrastructure (cloud metadata endpoints, internal
 * services, localhost) and have the PayMate server make requests on their
 * behalf the moment an invoice is paid.
 *
 * This is a hostname/IP-literal blocklist, not a full SSRF solution — it does
 * NOT resolve DNS, so a hostname that only resolves to a private IP at fetch
 * time will not be caught here. For a hackathon-stage app this materially
 * raises the bar (blocks the obvious payloads: raw IPs, localhost, link-local
 * / cloud-metadata addresses) without needing an egress proxy.
 */
export function isSafeWebhookUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false

  const hostname = parsed.hostname.toLowerCase()
  if (!hostname) return false
  if (hostname === "localhost" || hostname === "0.0.0.0" || hostname === "::1" || hostname === "[::1]") return false
  if (hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".localhost")) return false

  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const a = Number(ipv4[1])
    const b = Number(ipv4[2])
    if ([a, b, Number(ipv4[3]), Number(ipv4[4])].some((n) => n > 255)) return false
    if (a === 127) return false // loopback
    if (a === 10) return false // private (RFC1918)
    if (a === 0) return false // "this network"
    if (a === 169 && b === 254) return false // link-local, incl. cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return false // private (RFC1918)
    if (a === 192 && b === 168) return false // private (RFC1918)
    if (a === 100 && b >= 64 && b <= 127) return false // shared/CGNAT (RFC6598)
  }

  // Block obvious IPv6 loopback / link-local / unique-local literals.
  if (hostname.startsWith("fe80:") || hostname.startsWith("fc") || hostname.startsWith("fd")) return false

  return true
}
