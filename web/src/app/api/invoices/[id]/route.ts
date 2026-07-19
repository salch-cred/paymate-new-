import { getInvoice } from "@/lib/db"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await getInvoice(id)
  if (!invoice) return Response.json({ detail: "Invoice not found" }, { status: 404 })
  return Response.json(invoice)
}
