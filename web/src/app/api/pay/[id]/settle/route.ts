import { getInvoice, markPaid, markMilestonePaid, markEscrowFunded, addTreasuryRevenue } from "@/lib/db"
import { paymentRequirements, verifyTransfer, verifyEscrowFunding, ensureEscrowRegistered, confirmEscrowFunded, isEscrowInvoice, mintReputation, PaymentError, getCrossChainClient } from "@/lib/chain"
import { getNativeUsdPrice } from "@/lib/price"
import { REFERRAL_MULTIPLIER_TAG } from "@/lib/constants"
import { sendReceipt } from "@/lib/email"
import { isSafeWebhookUrl } from "@/lib/webhookSafety"
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

  // Autonomous GitHub Escrow: the client's payment is locked into the on-chain
  // escrow contract, NOT sent directly to the freelancer. It is released by the
  // GitHub webhook the moment the PR merges, or by the AI arbitrator on a
  // dispute. So on the funding transaction we register + confirm the escrow and
  // hold the invoice in "funded" state — markPaid happens at release.
  if (isEscrowInvoice(invoice)) {
    try {
      const { payer } = await verifyEscrowFunding(txHash, invoice)
      await ensureEscrowRegistered(invoice.id, payer, invoice.freelancer)
      const confirmHash = await confirmEscrowFunded(invoice.id, invoice.amountUsd)
      const funded = await markEscrowFunded(invoice.id, txHash)
      if (!funded) {
        return Response.json({ detail: "This escrow invoice is no longer pending." }, { status: 402 })
      }
      return Response.json({
        ok: true,
        escrow: "funded",
        escrowTxHash: confirmHash,
        clientPaymentTxHash: txHash,
        invoice: funded,
        message: "Funds locked in escrow. Released to the freelancer when the PR merges or per AI arbitration.",
      })
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
      
      // The client must have sent the invoice's REAL value in the source chain's
      // native token to the freelancer. The expected amount is derived from the
      // live price of that chain's native token — dust payments (e.g. the old
      // fixed 0.0001) no longer settle anything.
      const settleAmount = milestoneId && invoice.milestones
        ? (invoice.milestones.find(m => m.id === milestoneId)?.amountUsd || 0)
        : (invoice.isStream && invoice.streamedAmountUsd > 0
            ? Math.min(invoice.streamedAmountUsd, invoice.amountUsd)
            : invoice.amountUsd)
      const nativePriceUsd = await getNativeUsdPrice(chainId)
      if (!nativePriceUsd) {
        throw new PaymentError(503, `Could not fetch the live price for chain ${chainId} — cross-chain settlement refused (fail closed).`)
      }
      // Compute in micro-units first (1e6 precision, safely within float range),
      // then scale to the 18-decimal smallest unit — avoids float->BigInt
      // precision loss on large amounts. A 5% tolerance absorbs price drift
      // between the client's quote and this verification; dust (e.g. the old
      // fixed 0.0001 ≈ $0.06) is still orders of magnitude below and rejected.
      const expectedNative = BigInt(Math.round((settleAmount / nativePriceUsd) * 1e6)) * BigInt(10) ** BigInt(12)
      const minAccepted = (expectedNative * BigInt(95)) / BigInt(100)
      if (tx.value < minAccepted) {
        throw new PaymentError(
          402,
          `Cross-chain payment is short: expected at least $${settleAmount.toFixed(2)} worth (${minAccepted} wei), got ${tx.value} wei.`
        )
      }
      if (!tx.to || getAddress(tx.to) !== getAddress(invoice.freelancer)) {
        throw new PaymentError(402, `Cross-chain payment was not sent to the freelancer address`)
      }
      
      console.log(`[ClawUp] Verified cross-chain settlement of $${settleAmount} (${tx.value} wei) on chain ${chainId}: ${hash}`);
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

  // SECURITY (audit fix 2026-08-13): defense-in-depth SSRF guard —
  // re-validate at fetch time regardless of how/when webhookUrl was set.
  if (updated.webhookUrl && isSafeWebhookUrl(updated.webhookUrl)) {
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

