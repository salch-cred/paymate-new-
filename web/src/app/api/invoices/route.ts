import { isAddress, getAddress } from "viem"
import { createInvoice, listInvoices } from "@/lib/db"
import { REFERRAL_MULTIPLIER_TAG } from "@/lib/constants"
import { isSafeWebhookUrl } from "@/lib/webhookSafety"
import { checkAndConsumeRequestBudget } from "@/lib/rateLimit"
import { screenWallets } from "@/lib/security"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const freelancer = searchParams.get("freelancer")
  const limitParam = searchParams.get("limit")
  const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 50)) : 50

  if (!freelancer || !isAddress(freelancer)) {
    return Response.json({ detail: "Invalid wallet address" }, { status: 422 })
  }
  return Response.json({ invoices: await listInvoices(freelancer, limit) })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ detail: "Invalid request body" }, { status: 422 })

  const { freelancer, client, title, description, amountUsd, dueDate, webhookUrl, splits, recurring, isPrivate, zkCommitment, signature } = body

  // SECURITY (audit fix H-4): the reputation-mint multiplier is granted
  // based on webhookUrl === REFERRAL_MULTIPLIER_TAG. This is a public API —
  // callers must never be able to self-grant that multiplier by simply
  // passing the magic string. Only PayMate's own authenticated /api/clawup/
  // intent route may set this value (server-side, not from request body).
  // SECURITY (audit fix 2026-08-13): this is also the only line of defense
  // against SSRF via a malicious webhookUrl on this public endpoint. Drop
  // (rather than hard-reject) anything that isn't a safe http(s) URL — this
  // field is best-effort and callers already omit it most of the time.
  const safeWebhookUrl = webhookUrl === REFERRAL_MULTIPLIER_TAG
    ? null
    : (typeof webhookUrl === "string" && isSafeWebhookUrl(webhookUrl) ? webhookUrl : null)

  // SECURITY (audit fix 2026-08-13): coarse abuse control — this endpoint has
  // no auth and writes a DB row per call. The cap is env-configurable so a
  // legitimate high-volume launch can raise it without redeploying code
  // (INVOICE_CREATE_RATE_LIMIT, per hour). Default 500/hr.
  const invoiceCreateCap = Number(process.env.INVOICE_CREATE_RATE_LIMIT || 500)
  if (!(await checkAndConsumeRequestBudget("invoice-create", invoiceCreateCap, 60 * 60 * 1000))) {
    return Response.json({ detail: "Too many invoices created recently. Please try again later." }, { status: 429 })
  }

  if (typeof freelancer !== "string" || !isAddress(freelancer) || typeof client !== "string" || !isAddress(client)) {
    return Response.json({ detail: "Invalid wallet address" }, { status: 422 })
  }
  // Tier-1 security: AML-style screening of both parties before an invoice
  // can be created (static validation, blocklist, optional remote screener).
  const screen = await screenWallets(freelancer, client)
  if (!screen.ok) {
    return Response.json({ detail: `Invoice refused by security screening: ${screen.reason}` }, { status: 403 })
  }
  if (typeof title !== "string" || title.length < 2 || title.length > 120) {
    return Response.json({ detail: "title must be between 2 and 120 characters" }, { status: 422 })
  }
  if (typeof description !== "string" || description.length < 5 || description.length > 4000) {
    return Response.json({ detail: "description must be between 5 and 4000 characters" }, { status: 422 })
  }
  const amount = Number(amountUsd)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
    return Response.json({ detail: "amountUsd must be a positive number" }, { status: 422 })
  }

  let validatedRecurring: "weekly" | "monthly" | null = null
  if (recurring !== undefined && recurring !== null) {
    if (recurring !== "weekly" && recurring !== "monthly") {
      return Response.json({ detail: "recurring must be 'weekly' or 'monthly'" }, { status: 422 })
    }
    validatedRecurring = recurring
  }

  let validatedSplits = null
  if (splits && Array.isArray(splits) && splits.length > 0) {
    let totalSplit = 0
    validatedSplits = []
    for (const split of splits) {
      if (!split.address || !isAddress(split.address)) {
        return Response.json({ detail: "Invalid split wallet address" }, { status: 422 })
      }
      const splitAmt = Number(split.amountUsd)
      if (!Number.isFinite(splitAmt) || splitAmt <= 0) {
        return Response.json({ detail: "Invalid split amount" }, { status: 422 })
      }
      totalSplit += splitAmt
      validatedSplits.push({ address: split.address, amountUsd: splitAmt })
    }
    // Check if total matches (allow small floating point rounding error)
    if (Math.abs(totalSplit - amount) > 0.01) {
      return Response.json({ detail: "Total of splits must equal the total invoice amount" }, { status: 422 })
    }
  }

  const invoice = await createInvoice({
    freelancer: getAddress(freelancer),
    client: getAddress(client),
    title,
    description,
    amountUsd: amount,
    dueDate: dueDate || null,
    webhookUrl: safeWebhookUrl || null,
    splits: validatedSplits,
    recurring: validatedRecurring,
    isPrivate: isPrivate === true,
    // ZK Shielded invoices: the client-side SHA-256 commitment ("${amountUsd}_${salt}")
    // is stored so the settle endpoint can prove a presented view key belongs to
    // this invoice. The amount itself stays hidden — only the hash is persisted.
    zkCommitment: typeof zkCommitment === "string" && /^[0-9a-f]{64}$/i.test(zkCommitment) ? zkCommitment.toLowerCase() : null,
    // The client's EIP-712 authorization is stored verbatim. The autonomous
    // pay path (lib/agent.ts) verifies it against the CLIENT (payer) before
    // moving funds — see the audit fix there. This is a public endpoint, so
    // the signature is inert until/unless an authorized payout is attempted.
    // Cap the length so a caller can't bloat the DB with an arbitrary string.
    signature: typeof signature === "string" && signature.length > 0 && signature.length <= 200 ? signature : null,
  })
  return Response.json({ invoice, payUrl: `/pay/${invoice.id}` }, { status: 201 })
}
