import { NextResponse } from "next/server"
import { getPendingCrosschainPayouts, removePendingCrosschainPayout, markPaid, getInvoiceById } from "@/lib/db"
import { getCustodyAddress, settleCrossChainPayout } from "@/lib/chain"
import { getPublicClient } from "@/lib/chain"
import { getAddress, isAddress } from "viem"

export const maxDuration = 300 // 5 minutes max duration for Vercel
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const pending = await getPendingCrosschainPayouts()
    if (pending.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, message: "No pending payouts" })
    }

    const usdcToken = process.env.USDC_TOKEN
    if (!usdcToken || !isAddress(usdcToken)) {
      return NextResponse.json({ error: "USDC_TOKEN not configured" }, { status: 500 })
    }

    const publicClient = getPublicClient()
    const custody = getCustodyAddress()
    const balanceRaw = await publicClient.readContract({
      address: getAddress(usdcToken),
      abi: [{
        constant: true,
        inputs: [{ name: "_owner", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "balance", type: "uint256" }],
        type: "function",
      }],
      functionName: "balanceOf",
      args: [custody],
    }) as bigint

    let availableUsdc = Number(balanceRaw) / 1e6
    let processedCount = 0
    let results = []

    for (const payout of pending) {
      if (availableUsdc >= payout.amountUsd) {
        console.log(`[Payout] Processing invoice ${payout.invoiceId} for $${payout.amountUsd}`)
        try {
          const invoice = await getInvoiceById(payout.invoiceId)
          if (!invoice || invoice.status !== "bridging") {
            await removePendingCrosschainPayout(payout.invoiceId)
            results.push({ id: payout.invoiceId, status: "skipped_invalid" })
            continue
          }

          // SECURITY: Atomically lock and remove the pending payout BEFORE executing 
          // the blockchain transaction to absolutely prevent double-payout race conditions.
          const { claimPendingCrosschainPayout } = await import("@/lib/db")
          const claimed = await claimPendingCrosschainPayout(payout.invoiceId)
          if (!claimed) {
            console.log(`[Payout] Invoice ${payout.invoiceId} already claimed by another process. Skipping.`)
            results.push({ id: payout.invoiceId, status: "skipped_already_claimed" })
            continue
          }

          const txHash = await settleCrossChainPayout(invoice, payout.amountUsd)
          
          const receiptData = JSON.stringify({
            invoiceId: invoice.id,
            amountUsd: payout.amountUsd,
            freelancer: invoice.freelancer,
            client: invoice.client,
            txHash: txHash,
            timestamp: Date.now(),
            network: "goat"
          });
          const receiptHash = "local-" + Buffer.from(receiptData).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 44);

          await markPaid(invoice.id, txHash, receiptHash)
          
          availableUsdc -= payout.amountUsd
          processedCount++
          
          results.push({ id: payout.invoiceId, status: "success", txHash })
        } catch (err: any) {
          console.error(`[Payout] Failed for ${payout.invoiceId}:`, err)
          results.push({ id: payout.invoiceId, status: "error", error: err.message })
        }
      } else {
        results.push({ id: payout.invoiceId, status: "insufficient_liquidity", required: payout.amountUsd, available: availableUsdc })
        break
      }
    }

    return NextResponse.json({ ok: true, processed: processedCount, results })
  } catch (error: any) {
    console.error("[Payout] Cron failed:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
