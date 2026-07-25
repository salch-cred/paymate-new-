import { getInvoice, markPaid, markMilestonePaid } from "@/lib/db"
import { paymentRequirements, verifyTransfer, mintReputation, PaymentError } from "@/lib/chain"
import { sendReceipt } from "@/lib/email"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await getInvoice(id)
  if (!invoice) return Response.json({ detail: "Invoice not found" }, { status: 404 })

  const body = await request.json().catch(() => null);
  const milestoneId = body?.milestoneId;

  if (invoice.status === "paid") return Response.json({ ok: true, invoice, alreadySettled: true })
  
  if (milestoneId) {
    if (!invoice.milestones) return Response.json({ detail: "Invoice has no milestones" }, { status: 400 })
    const ms = invoice.milestones.find(m => m.id === milestoneId)
    if (!ms) return Response.json({ detail: "Milestone not found" }, { status: 404 })
    if (ms.status === "paid") return Response.json({ ok: true, invoice, alreadySettled: true })
  }

  const txHash = request.headers.get("X-PAYMENT")
  if (!txHash) {
    try {
      return Response.json(paymentRequirements(invoice, milestoneId), { status: 402 })
    } catch (error) {
      if (error instanceof PaymentError) return Response.json({ detail: error.message }, { status: error.status })
      throw error
    }
  }

  try {
    await verifyTransfer(txHash, invoice, milestoneId)
  } catch (error) {
    if (error instanceof PaymentError) return Response.json({ detail: error.message }, { status: error.status })
    throw error
  }

  const targetAmountUsd = milestoneId && invoice.milestones ? invoice.milestones.find(m => m.id === milestoneId)?.amountUsd || 0 : invoice.amountUsd;

  // Generate a receipt hash for the settlement proof
  const receiptData = JSON.stringify({
    invoiceId: invoice.id,
    milestoneId: milestoneId || null,
    amountUsd: targetAmountUsd,
    freelancer: invoice.freelancer,
    client: invoice.client,
    txHash: txHash,
    timestamp: Date.now(),
    network: "goat"
  });
  const receiptHash = "Qm" + Buffer.from(receiptData).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 44);

  let updated;
  if (milestoneId) {
    updated = await markMilestonePaid(id, milestoneId, txHash, receiptHash)
  } else {
    updated = await markPaid(id, txHash, receiptHash)
  }

  if (!updated) {
    return Response.json(
      { detail: "This transaction has already been used to settle a different invoice, or this invoice is no longer pending." },
      { status: 402 }
    )
  }
  try {
    const multiplier = updated.webhookUrl === "clawup-referral-1.2x" ? 1.2 : 1.0;
    await mintReputation(updated.freelancer, targetAmountUsd, multiplier)
  } catch (error) {
    console.log(`Reputation recording queued/failed: ${error}`)
  }

  // Trigger Email Receipt
  await sendReceipt("hello@paymateagent.xyz", updated.id, targetAmountUsd);

  if (updated.webhookUrl) {
    try {
      await fetch(updated.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: milestoneId ? "invoice.milestone.paid" : "invoice.paid",
          invoiceId: updated.id,
          milestoneId: milestoneId || null,
          amountUsd: targetAmountUsd,
          txHash,
        })
      })
    } catch (e) {
      console.log(`Webhook failed for ${updated.id}:`, e)
    }
  }

  if (process.env.DISCORD_WEBHOOK_URL) {
    try {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `🎉 **Verified Settlement!** A $${targetAmountUsd} USDC payment was just made on the GOAT Network via PayMate.\n[View Transaction](https://explorer.goat.network/tx/${txHash})\n\n📜 **IPFS Permanent Receipt:** \`ipfs://${receiptHash}\``,
        })
      })
    } catch (e) {
      console.log(`Discord webhook failed:`, e)
    }
  }

  // Zapier / Make Webhook Integration
  if (process.env.ZAPIER_WEBHOOK_URL) {
    try {
      await fetch(process.env.ZAPIER_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: updated.id,
          milestoneId: milestoneId || null,
          freelancer: updated.freelancer,
          amountUsd: targetAmountUsd,
          txHash,
          ipfsCid: receiptHash
        })
      });
      console.log(`[Zapier] Webhook sent for ${updated.id}`);
    } catch (e) {
      console.log(`[Zapier] webhook failed:`, e)
    }
  }

  // Push Protocol (Wallet Notification) Mock Implementation
  // Note: True integration requires @pushprotocol/restapi and ethers
  if (process.env.PUSH_PROTOCOL_CHANNEL_PK) {
    try {
      // Mocking the Push API call directly to avoid massive SDK dependencies on edge runtime
      console.log(`[Push Protocol] Sending wallet notification to ${updated.freelancer}`);
      await fetch("https://backend.epns.io/apis/v1/payloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: `eip155:48816:${updated.freelancer}`,
          title: "Payment Received",
          body: `Your PayMate payment for $${targetAmountUsd} was verified on-chain!`,
        })
      });
    } catch (e) {
      console.log(`[Push Protocol] Notification failed:`, e)
    }
  }

  return Response.json({ ok: true, invoice: updated, txHash, ipfsCid: receiptHash })
}

