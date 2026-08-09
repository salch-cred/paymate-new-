import { updateStreamAmount, getInvoice, markPaid } from "@/lib/db"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  const body = await request.json().catch(() => ({}))
  const { amountToAdd, signature, signatureMock } = body

  const invoice = await getInvoice(id)
  
  if (!invoice) return Response.json({ detail: "Invoice not found" }, { status: 404 })
  if (invoice.status !== "pending") return Response.json({ detail: "Invoice not pending" }, { status: 400 })
  if (!invoice.isStream) return Response.json({ detail: "Not a streaming invoice" }, { status: 400 })

  // In a real state channel, we would use viem's verifyTypedData to ensure 'signature' matches the current state.
  // For the presentation, we accept the mock signature string to increment the db.
  if (signatureMock !== "1-CLICK-ALLOWANCE-MOCK") {
    return Response.json({ detail: "Invalid stream signature" }, { status: 403 })
  }

  // Add the stream amount
  const addAmount = Number(amountToAdd)
  if (isNaN(addAmount) || addAmount <= 0) {
    return Response.json({ detail: "Invalid stream amount" }, { status: 400 })
  }

  const updatedInvoice = await updateStreamAmount(id, addAmount)
  
  if (!updatedInvoice) {
    return Response.json({ detail: "Failed to update stream" }, { status: 500 })
  }

  // If the stream hits the total invoice amount, we close it out!
  if (updatedInvoice.streamedAmountUsd >= updatedInvoice.amountUsd) {
     const closedInvoice = await markPaid(id, "STREAM_CLOSED_" + Math.random().toString(36).slice(2))
     return Response.json({ invoice: closedInvoice })
  }

  return Response.json({ invoice: updatedInvoice })
}
