import { autonomousAgentPay } from "@/lib/agent"
import { getInvoice, markPaid } from "@/lib/db"
import { mintReputation } from "@/lib/chain"
import { isAddress } from "viem"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || !body.invoiceId) {
      return Response.json({ detail: "Must provide invoiceId" }, { status: 400 })
    }

    const invoice = await getInvoice(body.invoiceId)
    if (!invoice) {
      return Response.json({ detail: "Invoice not found" }, { status: 404 })
    }

    if (invoice.status === "paid") {
      return Response.json({ detail: "Invoice already paid" }, { status: 400 })
    }

    // 1. Trigger Autonomous Agent to Pay (Agent will verify EIP-712 Signature internally)
    const txHash = await autonomousAgentPay(invoice)

    // 2. Settlement Verification & Recording
    const updated = await markPaid(invoice.id, txHash)
    if (!updated) {
      return Response.json({ detail: "Failed to mark paid" }, { status: 500 })
    }

    // 3. Mint On-Chain Reputation via ERC-8004
    try {
      const multiplier = updated.webhookUrl === "clawup-referral-1.2x" ? 1.2 : 1.0;
      await mintReputation(updated.freelancer, updated.amountUsd, multiplier)
    } catch (e) {
      console.log("Reputation failed", e)
    }

    return Response.json({ ok: true, invoice: updated, agentTxHash: txHash })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ detail: message }, { status: 500 })
  }
}
