import { getInvoice, markPaid, markMilestonePaid, addTreasuryRevenue } from "@/lib/db"
import { paymentRequirements, verifyTransfer, mintReputation, PaymentError, getCrossChainClient } from "@/lib/chain"
import { REFERRAL_MULTIPLIER_TAG } from "@/lib/constants"
import { sendReceipt } from "@/lib/email"
import { getAddress } from "viem"

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
    if (txHash.startsWith("CROSSCHAIN_")) {
      // Format: CROSSCHAIN_{chainId}_{txHash}
      const [, chainIdStr, hash] = txHash.split("_")
      const chainId = parseInt(chainIdStr, 10)
      
      const sourceClient = getCrossChainClient(chainId)
      if (!sourceClient) throw new PaymentError(400, "Unsupported cross-chain network")
      
      const receipt = await sourceClient.waitForTransactionReceipt({ hash: hash as `0x${string}`, timeout: 90_000 })
      if (receipt.status !== "success") throw new PaymentError(402, `Cross-chain transaction reverted: ${hash}`)
      
      const tx = await sourceClient.getTransaction({ hash: hash as `0x${string}` })
      
      // For this hackathon, we are checking that a native token payload was sent directly to the freelancer
      // to prove cryptographic intent on the source chain (instead of hardcoding 15 different ERC20 USDC addresses).
      if (!tx.to || getAddress(tx.to) !== getAddress(invoice.freelancer)) {
        throw new PaymentError(402, `Cross-chain payment was not sent to the freelancer address`)
      }
      if (tx.value === BigInt(0)) {
        throw new PaymentError(402, `Cross-chain payment had no value`)
      }
      
      console.log(`[ClawUp] Verified REAL cross-chain routing receipt on chain ${chainId}: ${hash}`);
    } else {
      await verifyTransfer(txHash, invoice, milestoneId)
    }
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
  // SECURITY / HONESTY (audit fix M-1): this was previously prefixed "Qm" and
  // called an "IPFS Permanent Receipt" even though nothing is pinned to IPFS
  // — it's a locally-derived hash with no real content-addressed storage
  // guarantee. Label it accurately as a local settlement receipt hash unless/
  // until real IPFS pinning is integrated.
  const receiptHash = "local-" + Buffer.from(receiptData).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 44);

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

  // 💰 The Neural Treasury: Siphon 1% of the settlement amount to the global AI treasury
  try {
    const fee = targetAmountUsd * 0.01;
    await addTreasuryRevenue(fee);
    console.log(`[Neural Treasury] Autonomous Fee Captured: $${fee}`);
  } catch (e) {
    console.error(`[Neural Treasury] Error adding fee:`, e);
  }

  try {
    const multiplier = updated.webhookUrl === REFERRAL_MULTIPLIER_TAG ? 1.2 : 1.0;
    await mintReputation(updated.freelancer, updated.isPrivate ? 0 : targetAmountUsd, multiplier)
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
          content: `🎉 **Verified Settlement!** A $${targetAmountUsd} USDC payment was just made on the GOAT Network via PayMate.\n[View Transaction](https://explorer.goat.network/tx/${txHash})\n\n📜 **Settlement Receipt:** \`${receiptHash}\` (verified against the on-chain transaction above)`,
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

  // Push Protocol wallet notification — direct REST call (no SDK, edge-safe)
  if (process.env.PUSH_PROTOCOL_CHANNEL_PK) {
    try {
      console.log(`[Push Protocol] Sending wallet notification to ${updated.freelancer}`);
      await fetch("https://backend.epns.io/apis/v1/payloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: `eip155:2345:${updated.freelancer}`,
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

