import { getInvoice, cancelInvoice } from "@/lib/db"
import { isAddress, getAddress } from "viem"
import { verifyFreshWalletProof } from "@/lib/walletProof"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await getInvoice(id)
  if (!invoice) return Response.json({ detail: "Invoice not found" }, { status: 404 })

  // SECURITY (audit fix 2026-08-13): "private" invoices are meant to hide the
  // amount from anyone without the ZK view-key URL fragment (see lib/zk.ts —
  // "the backend only receives the commitment hash"). The frontend already
  // never reads amountUsd for a private invoice (it only shows the masked
  // placeholder or the fragment-decrypted amount), so it's safe to redact it
  // here — this closes the gap where anyone could curl this endpoint directly
  // and read the real amount regardless of the "private" flag.
  if (invoice.isPrivate) {
    return Response.json({ ...invoice, amountUsd: null })
  }
  return Response.json(invoice)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body || body.status !== "cancelled" || !body.freelancer) {
    return Response.json({ detail: "Invalid request. Must provide { status: 'cancelled', freelancer: <address>, message, signature, ts }" }, { status: 400 })
  }

  if (!isAddress(body.freelancer)) {
    return Response.json({ detail: "Invalid freelancer address" }, { status: 422 })
  }

  // SECURITY (audit fix 2026-08-13): cancellation used to be authorized by
  // simply matching a freelancer address string — no proof of ownership.
  // Since freelancer addresses are public (visible on the invoice itself),
  // that let anyone cancel anyone else's pending invoices. Now require the
  // same wallet-signed, timestamp-bound proof used by /api/apikeys.
  const freelancer = getAddress(body.freelancer)
  const expectedMessage = `PayMate cancel invoice ${id} at ${body.ts}`
  const validProof = await verifyFreshWalletProof(
    { wallet: freelancer, message: body.message, signature: body.signature, ts: body.ts },
    expectedMessage
  )
  if (!validProof) {
    return Response.json(
      { detail: `Wallet ownership proof required. Sign exactly: "PayMate cancel invoice ${id} at <ts>" and provide { message, signature, ts }.` },
      { status: 401 }
    )
  }

  const invoice = await cancelInvoice(id, freelancer)
  if (!invoice) {
    return Response.json({ detail: "Invoice not found, not owned by you, or cannot be cancelled." }, { status: 404 })
  }
  return Response.json(invoice)
}
