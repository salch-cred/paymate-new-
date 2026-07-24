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

  const { freelancer, client, title, description, amountUsd, dueDate, webhookUrl, splits } = body
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
    webhookUrl: webhookUrl || null,
    splits: validatedSplits,
  })
  return Response.json({ invoice, payUrl: `/pay/${invoice.id}` }, { status: 201 })
}
