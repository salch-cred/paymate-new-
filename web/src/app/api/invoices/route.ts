import { isAddress, getAddress } from "viem"
import { createInvoice, listInvoices } from "@/lib/db"

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

  const { freelancer, client, title, description, amountUsd, dueDate } = body
  if (typeof freelancer !== "string" || !isAddress(freelancer) || typeof client !== "string" || !isAddress(client)) {
    return Response.json({ detail: "Invalid wallet address" }, { status: 422 })
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

  const invoice = await createInvoice({
    freelancer: getAddress(freelancer),
    client: getAddress(client),
    title,
    description,
    amountUsd: amount,
    dueDate: dueDate || null,
  })
  return Response.json({ invoice, payUrl: `/pay/${invoice.id}` }, { status: 201 })
}
