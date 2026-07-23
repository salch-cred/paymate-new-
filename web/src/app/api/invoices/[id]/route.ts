import { getInvoice, cancelInvoice } from "@/lib/db"
import { isAddress, getAddress } from "viem"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await getInvoice(id)
  if (!invoice) return Response.json({ detail: "Invoice not found" }, { status: 404 })
  return Response.json(invoice)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => null)
  if (!body || body.status !== "cancelled" || !body.freelancer) {
    return Response.json({ detail: "Invalid request. Must provide { status: 'cancelled', freelancer: <address> }" }, { status: 400 })
  }
  
  if (!isAddress(body.freelancer)) {
    return Response.json({ detail: "Invalid freelancer address" }, { status: 422 })
  }

  const invoice = await cancelInvoice(id, getAddress(body.freelancer))
  if (!invoice) {
    return Response.json({ detail: "Invoice not found, not owned by you, or cannot be cancelled." }, { status: 404 })
  }
  return Response.json(invoice)
}
