import { getInvoice, markPaid, markMilestonePaid, markEscrowFunded, addTreasuryRevenue, computePaymateFee, reserveCrossChainTx } from "@/lib/db"
import { paymentRequirements, verifyTransfer, verifyEscrowFunding, ensureEscrowRegistered, confirmEscrowFunded, isEscrowInvoice, mintReputation, PaymentError, getPublicClient, usdcAmount, verifyCrossChainPayment, settleCrossChainPayout } from "@/lib/chain"
import { PAYMENT_REQUIRED_HEADER } from "@/lib/paywall"
import { REFERRAL_MULTIPLIER_TAG } from "@/lib/constants"
import { buildCheckoutWebhook, signMerchantWebhook } from "@/lib/merchant"
import { sendReceipt } from "@/lib/email"
import { isSafeWebhookUrl } from "@/lib/webhookSafety"
import { screenWallets, simulatePaymentSafety } from "@/lib/security"
import { verifyViewKeyForInvoice } from "@/lib/zk"
import { getAddress, isAddress, type Address } from "viem"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await getInvoice(id)
  if (!invoice) return Response.json({ detail: "Invoice not found" }, { status: 404 })

  const body = await request.json().catch(() => null);
  const milestoneId = body?.milestoneId;

  // ZK Shielded invoices: the real amount is only revealed to a payer who
  // presents the view key from the pay-link URL fragment (#key=...). Verified
  // against the invoice's real amount + stored SHA-256 commitment before any
  // requirements are quoted or any payment is accepted.
  const privateRevealed = invoice.isPrivate
    ? await verifyViewKeyForInvoice(body?.viewKey, invoice.amountUsd, invoice.zkCommitment)
    : false;

  if (invoice.status === "paid") return Response.json({ ok: true, invoice, alreadySettled: true })
  
  if (milestoneId) {
    if (!invoice.milestones) return Response.json({ detail: "Invoice has no milestones" }, { status: 400 })
    const ms = invoice.milestones.find(m => m.id === milestoneId)
    if (!ms) return Response.json({ detail: "Milestone not found" }, { status: 404 })
    if (ms.status === "paid") return Response.json({ ok: true, invoice, alreadySettled: true })
  }

  let txHash = request.headers.get("X-PAYMENT")
  if (!txHash) {
    try {
      // x402 (audit fix 2026-08-13): the challenge MUST carry the
      // PAYMENT-REQUIRED header (base64 x402 payload) in addition to the JSON
      // body — x402-compliant machine clients read the header, not the body.
      // Without it, agent-to-agent settlement silently breaks even though the
      // JSON body looks correct.
      const requirements = paymentRequirements(invoice, milestoneId, privateRevealed)
      return new Response(JSON.stringify(requirements), {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          [PAYMENT_REQUIRED_HEADER]: Buffer.from(JSON.stringify(requirements)).toString("base64"),
        },
      })
    } catch (error) {
      if (error instanceof PaymentError) return Response.json({ detail: error.message }, { status: error.status })
      throw error
    }
  }

  // A private (ZK-shielded) invoice must not settle without the matching view
  // key — otherwise the masking could be bypassed by paying through a side
  // path and the payment requirements were never honestly quoted.
  if (invoice.isPrivate && !privateRevealed) {
    return Response.json(
      { detail: "This is a ZK-shielded invoice. The pay link must include the #key=<view key> fragment to settle." },
      { status: 402 }
    )
  }

  // ── ClawUp cross-chain: the client paid native tokens on a source network
  // into PayMate's custody wallet (receipt format CROSSCHAIN_{chainId}_{txHash}).
  // We verify the deposit on the SOURCE chain, then the custody wallet pays
  // the freelancer USDC on GOAT. txHash is reassigned to the GOAT payout hash
  // so receipts, notifications and explorer links point at the real settlement.
  let sourceChain: { chainId: number; sourceTxHash: string } | null = null
  if (txHash.startsWith("CROSSCHAIN_")) {
    if (isEscrowInvoice(invoice)) {
      return Response.json({ detail: "Escrow invoices cannot be settled cross-chain." }, { status: 402 })
    }
    if (invoice.isStream || (invoice.milestones && invoice.milestones.length > 0) || (invoice.splits && invoice.splits.length > 0)) {
      return Response.json({ detail: "Cross-chain payments are only available for simple single-amount invoices." }, { status: 402 })
    }
    try {
      const verified = await verifyCrossChainPayment(txHash, invoice)
      // SECURITY (replay guard): atomically reserve the SOURCE deposit before
      // paying out, so the same deposit can never settle a second invoice.
      const reserved = await reserveCrossChainTx(verified.chainId, verified.sourceTxHash, id)
      if (!reserved) {
        return Response.json({ detail: "This cross-chain payment has already been used to settle another invoice." }, { status: 402 })
      }
      sourceChain = { chainId: verified.chainId, sourceTxHash: verified.sourceTxHash }
      txHash = await settleCrossChainPayout(invoice, invoice.amountUsd)
    } catch (error) {
      if (error instanceof PaymentError) {
        console.error(`[CrossChain] settlement failed for ${id}:`, error.message)
        return Response.json({
          detail: error.status === 402
            ? `${error.message} Funds stay safe in PayMate's custody wallet.`
            : error.message,
        }, { status: error.status })
      }
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

  if (!sourceChain) {
    try {
      await verifyTransfer(txHash, invoice, milestoneId)
    } catch (error) {
      if (error instanceof PaymentError) return Response.json({ detail: error.message }, { status: error.status })
      throw error
    }
  }

  const targetAmountUsd = milestoneId && invoice.milestones ? invoice.milestones.find(m => m.id === milestoneId)?.amountUsd || 0 : invoice.amountUsd;

  // ── Tier-1 security: AML/sanctions screening + pre-flight payment simulation ──
  try {
    const screen = await screenWallets(invoice.client, invoice.freelancer)
    if (!screen.ok) {
      return Response.json({ detail: `Settlement refused by security screening: ${screen.reason}` }, { status: 403 })
    }
    if (!sourceChain && process.env.SECURITY_SIMULATE_PAYMENTS !== "false") {
      const usdcToken = process.env.USDC_TOKEN
      if (usdcToken && isAddress(usdcToken)) {
        const sim = await simulatePaymentSafety(getPublicClient(), {
          token: getAddress(usdcToken) as Address,
          to: getAddress(invoice.freelancer) as Address,
          amount: usdcAmount(targetAmountUsd),
        })
        if (sim && !sim.safe) {
          return Response.json({
            detail: sim.feeOnTransfer
              ? "Settlement refused: the payment token applies a transfer fee, so the freelancer would receive less than invoiced."
              : `Settlement refused by payment simulation: ${sim.revertReason || "unexpected revert"}`,
          }, { status: 402 })
        }
      }
    }  } catch (error) {
    // Never let a security-helper infra error block an already-verified payment.
    console.error("[Security] settlement checks failed (continuing):", error)
  }

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

  // 💰 The Neural Treasury: Siphon the configured fee (PAYMATE_FEE_RATE,
  // default 1%) of the settlement amount to the global AI treasury
  try {
    const fee = computePaymateFee(targetAmountUsd);
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
      // Merchant checkouts get a signed checkout.paid webhook (HMAC-SHA256
      // keyed with the merchant's webhook secret) so the merchant's backend
      // can verify it really came from PayMate before fulfilling the order.
      const isMerchant = Boolean(updated.merchantWebhookSecret)
      const payload = isMerchant
        ? buildCheckoutWebhook(updated)
        : {
            event: milestoneId ? "invoice.milestone.paid" : "invoice.paid",
            invoiceId: updated.id,
            milestoneId: milestoneId || null,
            amountUsd: targetAmountUsd,
            txHash,
          }
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (isMerchant && updated.merchantWebhookSecret) {
        headers["X-PayMate-Signature"] = signMerchantWebhook(updated.merchantWebhookSecret, JSON.stringify(payload))
      }
      await fetch(updated.webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
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

  return Response.json({
    ok: true,
    invoice: updated,
    txHash,
    ipfsCid: receiptHash,
    ...(sourceChain ? { sourceChainId: sourceChain.chainId, sourceTxHash: sourceChain.sourceTxHash } : {}),
  })
}

