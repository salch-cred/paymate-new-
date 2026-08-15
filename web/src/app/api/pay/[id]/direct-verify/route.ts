import { getInvoice, markPaid, addTreasuryRevenue, computePaymateFee, reserveDirectPayment, getDirectPlan } from "@/lib/db"
import { PaymentError, mintReputation } from "@/lib/chain"
import { screenWallets } from "@/lib/security"
import { verifyBscDirectBridge } from "@/lib/directPay"
import { isClawUpReferral } from "@/lib/constants"
import { buildCheckoutWebhook, signMerchantWebhook } from "@/lib/merchant"
import { sendReceipt } from "@/lib/email"
import { isSafeWebhookUrl } from "@/lib/webhookSafety"

export const dynamic = "force-dynamic"

/**
 * Direct-to-freelancer rail — verify step.
 *
 *   POST /api/pay/[id]/direct-verify   body: { bridgeTxHash: "0x…" }
 *
 * The client has signed the swap + approve + bridge-send on BSC and reports
 * the bridge tx hash. This route proves it ON-CHAIN (tx to the recovered
 * adapter, sendParam.to == the freelancer, amount ≥ the invoice in DOGEB with
 * a 5% price-drift tolerance), replay-guards it in direct_payments, then marks
 * the invoice paid and fires the same settlement notifications as the GOAT
 * rail (treasury fee, reputation, receipt, webhook, Discord, Push).
 *
 * The platform fee on this rail is NOT withheld from the payout — it is
 * earned as the conversion spread by /api/relayer/direct-convert when the
 * freelancer's DOGEB is turned into USDC.e. The treasury entry here is the
 * accounting trail; the on-chain spread capture happens at conversion time.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await getInvoice(id)
  if (!invoice) return Response.json({ detail: "Invoice not found" }, { status: 404 })
  if (invoice.status === "paid") return Response.json({ ok: true, invoice, alreadySettled: true })

  const body = await request.json().catch(() => null)
  const bridgeTxHash = typeof body?.bridgeTxHash === "string" ? body.bridgeTxHash.trim() : ""

  // SECURITY: the exact expected DOGEB is locked in the plan ledger at plan
  // time. Verify against it — a payer can never underpay by exploiting price
  // drift, and a plan older than 10 minutes expires (re-plan to re-quote).
  const plan = await getDirectPlan(id)
  if (!plan) {
    return Response.json({ detail: "No direct-pay plan exists for this invoice — call /api/pay/[id]/direct-plan first." }, { status: 402 })
  }
  if (Date.now() - plan.createdAt > 10 * 60_000) {
    return Response.json({ detail: "The payment plan has expired (10 min) — re-plan at /api/pay/[id]/direct-plan and sign the fresh transactions." }, { status: 402 })
  }

  let proof
  try {
    proof = await verifyBscDirectBridge(invoice, bridgeTxHash, BigInt(plan.expectedDoge))
  } catch (error) {
    if (error instanceof PaymentError) {
      return Response.json({ detail: error.message }, { status: error.status })
    }
    console.error(`[direct-verify] verification failed for ${id}:`, error)
    return Response.json({ detail: "Could not verify the bridge transaction." }, { status: 500 })
  }

  // Tier-1 security: AML/sanctions screening, same as the GOAT settle path.
  try {
    const screen = await screenWallets(invoice.client, invoice.freelancer)
    if (!screen.ok) {
      return Response.json({ detail: `Settlement refused by security screening: ${screen.reason}` }, { status: 403 })
    }
  } catch (error) {
    console.error("[Security] direct-verify screening failed (continuing):", error)
  }

  // Replay guard: the same bridge send can never settle two invoices.
  const reserved = await reserveDirectPayment(proof.bridgeTxHash, id, proof.freelancer, proof.amountDogeRaw.toString())
  if (!reserved) {
    return Response.json({ detail: "This bridge transaction has already been used to settle another invoice." }, { status: 402 })
  }

  const updated = await markPaid(id, proof.bridgeTxHash, null)
  if (!updated) return Response.json({ detail: "Invoice is no longer pending." }, { status: 402 })

  const targetAmountUsd = invoice.amountUsd

  // Treasury accounting (the real on-chain capture happens at conversion).
  try {
    const fee = computePaymateFee(targetAmountUsd)
    await addTreasuryRevenue(fee)
    console.log(`[Neural Treasury] Direct rail fee captured (ledger): $${fee}`)
  } catch (error) {
    console.error("[Neural Treasury] Error adding fee:", error)
  }

  try {
    const multiplier = isClawUpReferral(updated.webhookUrl) ? 1.2 : 1.0
    await mintReputation(updated.freelancer, targetAmountUsd, multiplier)
  } catch (error) {
    console.log(`Reputation recording queued/failed: ${error}`)
  }

  await sendReceipt("hello@paymateagent.xyz", updated.id, targetAmountUsd)

  if (updated.webhookUrl && isSafeWebhookUrl(updated.webhookUrl)) {
    try {
      const isMerchant = Boolean(updated.merchantWebhookSecret)
      const payload = isMerchant
        ? buildCheckoutWebhook(updated)
        : { event: "invoice.paid", invoiceId: updated.id, amountUsd: targetAmountUsd, txHash: proof.bridgeTxHash }
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (isMerchant && updated.merchantWebhookSecret) {
        headers["X-PayMate-Signature"] = signMerchantWebhook(updated.merchantWebhookSecret, JSON.stringify(payload))
      }
      await fetch(updated.webhookUrl, { method: "POST", headers, body: JSON.stringify(payload) })
    } catch (error) {
      console.log(`Webhook failed for ${updated.id}:`, error)
    }
  }

  if (process.env.DISCORD_WEBHOOK_URL) {
    try {
      await fetch(process.env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `🦴 **Direct-to-Freelancer Payment!** ${proof.amountDogeRaw > BigInt(0) ? `~${(Number(proof.amountDogeRaw) / 1e8).toFixed(2)} DOGE` : ""} bridged BSC → GOAT for a $${targetAmountUsd} invoice. Zero custody — funds landed straight in the freelancer's wallet.\\n[View bridge tx](https://bscscan.com/tx/${proof.bridgeTxHash})`,
        }),
      })
    } catch (error) {
      console.log(`Discord webhook failed:`, error)
    }
  }

  return Response.json({
    ok: true,
    invoice: updated,
    txHash: proof.bridgeTxHash,
    direct: {
      freelancer: proof.freelancer,
      amountDogeRaw: proof.amountDogeRaw.toString(),
      goatConfirmed: proof.goatConfirmed,
      variant: proof.variant,
    },
    message: proof.goatConfirmed
      ? "Payment verified — the freelancer has received the DOGEB on GOAT."
      : "Payment verified — the bridge send is confirmed on BSC; the DOGEB delivery to GOAT is in flight (LZ relay) and will land within a couple of minutes.",
  })
}
