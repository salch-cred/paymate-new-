import { getInvoice, markPaid } from "@/lib/db"
import { paymentRequirements, verifyTransfer, mintReputation, PaymentError } from "@/lib/chain"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await getInvoice(id)
  if (!invoice) return Response.json({ detail: "Invoice not found" }, { status: 404 })
  if (invoice.status === "paid") return Response.json({ ok: true, invoice, alreadySettled: true })

  const txHash = request.headers.get("X-PAYMENT")
  if (!txHash) {
    try {
      return Response.json(paymentRequirements(invoice), { status: 402 })
    } catch (error) {
      if (error instanceof PaymentError) return Response.json({ detail: error.message }, { status: error.status })
      throw error
    }
  }

  try {
    await verifyTransfer(txHash, invoice)
  } catch (error) {
    if (error instanceof PaymentError) return Response.json({ detail: error.message }, { status: error.status })
    throw error
  }

  const updated = await markPaid(id, txHash)
  if (!updated) {
    return Response.json(
      { detail: "This transaction has already been used to settle a different invoice, or this invoice is no longer pending." },
      { status: 402 }
    )
  }
  try {
    await mintReputation(updated.freelancer, updated.amountUsd)
  } catch (error) {
    console.log(`Reputation recording queued/failed: ${error}`)
  }
  return Response.json({ ok: true, invoice: updated, txHash })
}
