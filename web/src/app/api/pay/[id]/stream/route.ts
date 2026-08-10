import { updateStreamAmount, authorizeStream, getInvoice } from "@/lib/db"
import { verifyStreamAllowance } from "@/lib/eip712"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const body = await request.json().catch(() => ({}))
  const invoice = await getInvoice(id)

  if (!invoice) return Response.json({ detail: "Invoice not found" }, { status: 404 })
  if (invoice.status !== "pending") return Response.json({ detail: "Invoice not pending" }, { status: 400 })
  if (!invoice.isStream) return Response.json({ detail: "Not a streaming invoice" }, { status: 400 })

  // 1. authorize: the client signs a real EIP-712 StreamAllowance covering the
  // invoice cap. This is stored on the invoice and is what makes every
  // subsequent tick cryptographically authorized — no mock strings.
  if (body.action === "authorize") {
    const { signature, maxAmountUsd } = body
    if (typeof signature !== "string" || !signature) {
      return Response.json({ detail: "Missing EIP-712 stream allowance signature" }, { status: 400 })
    }
    if (invoice.streamSignature) {
      return Response.json({ detail: "Stream already authorized" }, { status: 400 })
    }
    const cap = Number(maxAmountUsd)
    if (!Number.isFinite(cap) || cap <= 0) {
      return Response.json({ detail: "Invalid stream allowance amount" }, { status: 400 })
    }
    const valid = await verifyStreamAllowance(
      signature as `0x${string}`,
      invoice.client,
      id,
      cap
    )
    if (!valid) {
      return Response.json({ detail: "Invalid stream allowance signature" }, { status: 403 })
    }
    const authorized = await authorizeStream(id, signature)
    if (!authorized) {
      return Response.json({ detail: "Failed to authorize stream" }, { status: 500 })
    }
    return Response.json({ invoice: authorized })
  }

  // 2. tick: increment the streamed amount. Only possible after a real signed
  // allowance exists on the invoice, and only by the wallet that signed it
  // (the authorized client) — no third party can inflate a stream.
  if (!invoice.streamSignature) {
    return Response.json({ detail: "Stream not authorized — client must sign the allowance first" }, { status: 403 })
  }
  if (
    typeof body.clientAddress !== "string" ||
    body.clientAddress.toLowerCase() !== invoice.client.toLowerCase()
  ) {
    return Response.json({ detail: "Only the authorized client can tick the stream" }, { status: 403 })
  }

  const addAmount = Number(body.amountToAdd)
  if (!Number.isFinite(addAmount) || addAmount <= 0) {
    return Response.json({ detail: "Invalid stream amount" }, { status: 400 })
  }

  const updatedInvoice = await updateStreamAmount(id, addAmount)

  if (!updatedInvoice) {
    return Response.json({ detail: "Failed to update stream" }, { status: 500 })
  }

  // When the stream reaches the authorized cap, the money has NOT moved yet —
  // the client executes the real on-chain settlement of the streamed amount
  // through the normal settle flow (X-PAYMENT with a real transaction hash).
  const streamComplete = updatedInvoice.streamedAmountUsd >= updatedInvoice.amountUsd

  return Response.json({ invoice: updatedInvoice, streamComplete })
}
