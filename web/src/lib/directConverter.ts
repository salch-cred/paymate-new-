/**
 * Fee-as-spread converter — where the zero-custody rail earns PayMate's fee.
 *
 * On the direct rail the client bridges DOGEB STRAIGHT to the freelancer's
 * GOAT wallet (PayMate never holds the principal). The freelancer receives
 * DOGEB, not USDC — and converting it to USDC.e on the GOAT DEX is a service
 * PayMate provides: the freelancer approves the custody wallet once, and this
 * converter pulls their DOGEB, swaps the principal to USDC.e back to them,
 * and keeps the platform fee (PAYMATE_FEE_RATE) as DOGEB spread in custody.
 *
 *   pull (transferFrom) freelancer → custody:      balance DOGEB
 *   swap principal = balance − fee → USDC.e → freelancer (goatDex, gated)
 *   fee DOGEB stays in custody                     (swept by the relayer later)
 *
 * Every run is ledgered in direct_conversions (idempotent by id). The
 * converter NEVER fails the payment — if the freelancer hasn't opted in, or
 * the DEX gate isn't live, it skips with a reason and the funds simply stay
 * with the freelancer.
 */

import { getAddress } from "viem"
import { PaymentError } from "./chain"
import { isGoatDexVerified, getDogeBBalanceOf, pullDogeBFrom, swapDogeBToUsdcETo } from "./goatDex"
import { paymateFeeRate } from "./db"
import { createDirectConversion, updateDirectConversion } from "./db"

/** Minimum DOGEB balance before a conversion runs (avoids dust churn). */
export function minConvertDoge(): number {
  const v = Number(process.env.DIRECT_CONVERT_MIN_DOGE ?? "0.5")
  return Number.isFinite(v) && v > 0 ? v : 0.5
}

/**
 * Pure split: given the pulled balance (raw 18-dec) and the fee rate, returns
 * the fee DOGEB (kept in custody) and the principal DOGEB (swapped back to
 * the freelancer). feeRate is clamped to [0, 0.5] like paymateFeeRate.
 */
export function computeConversionSplit(balanceRaw: bigint, feeRate: number): { feeDoge: bigint; principalDoge: bigint } {
  const rate = Math.min(0.5, Math.max(0, feeRate))
  const feeDoge = (balanceRaw * BigInt(Math.round(rate * 1e6))) / BigInt(1e6)
  return { feeDoge, principalDoge: balanceRaw - feeDoge }
}

export interface ConvertFreelancerResult {
  freelancer: string
  status: "done" | "skipped" | "failed"
  balanceDogeRaw: string
  feeDogeRaw: string
  principalDogeRaw: string
  pullTxHash: string | null
  swapTxHash: string | null
  reason?: string
}

/**
 * One conversion pass for a freelancer. dryRun audits balances + plans only —
 * zero pulls, zero swaps, zero ledger writes. Throws nothing: every
 * non-fatal condition (no opt-in, balance too small, gates off) returns a
 * skipped result so a cron can sweep a list of freelancers in one pass.
 */
export async function convertFreelancerDoge(
  freelancer: string,
  opts?: { dryRun?: boolean }
): Promise<ConvertFreelancerResult> {
  const address = getAddress(freelancer)
  const dryRun = !!opts?.dryRun

  if (!isGoatDexVerified()) {
    return { freelancer: address, status: "skipped", balanceDogeRaw: "0", feeDogeRaw: "0", principalDogeRaw: "0", pullTxHash: null, swapTxHash: null, reason: "GOAT_DEX_VERIFIED is not set — conversions are gated until the small real-money DEX test passes." }
  }

  const balance = await getDogeBBalanceOf(address).catch(() => BigInt(0))
  const minRaw = BigInt(Math.round(minConvertDoge() * 1e18))
  if (balance < minRaw) {
    return { freelancer: address, status: "skipped", balanceDogeRaw: balance.toString(), feeDogeRaw: "0", principalDogeRaw: "0", pullTxHash: null, swapTxHash: null, reason: `Balance (${Number(balance) / 1e18} DOGE) is below the ${minConvertDoge()} DOGE minimum.` }
  }

  const feeRate = paymateFeeRate()
  const { feeDoge, principalDoge: principal } = computeConversionSplit(balance, feeRate)
  if (principal <= BigInt(0)) {
    return { freelancer: address, status: "skipped", balanceDogeRaw: balance.toString(), feeDogeRaw: feeDoge.toString(), principalDogeRaw: "0", pullTxHash: null, swapTxHash: null, reason: "Principal after fee is zero — nothing to convert." }
  }

  const conversionId = `conv-${address.slice(2, 10).toLowerCase()}-${Date.now()}`
  if (!dryRun) {
    await createDirectConversion({
      id: conversionId,
      freelancer: address,
      amountDoge: balance.toString(),
      feeDoge: feeDoge.toString(),
      principalDoge: principal.toString(),
      status: "pending",
    })
  }

  if (dryRun) {
    return {
      freelancer: address,
      status: "done",
      balanceDogeRaw: balance.toString(),
      feeDogeRaw: feeDoge.toString(),
      principalDogeRaw: principal.toString(),
      pullTxHash: "dry-run",
      swapTxHash: "dry-run",
      reason: "dry-run — would pull + swap principal to USDC.e, keeping the fee DOGEB in custody.",
    }
  }

  try {
    // Opt-in check happens inside pullDogeBFrom (throws when no allowance).
    const pullHash = await pullDogeBFrom(address, balance)
    const swapHash = await swapDogeBToUsdcETo(principal, address)
    await updateDirectConversion(conversionId, { status: "done", txHash: swapHash, error: null })
    return {
      freelancer: address,
      status: "done",
      balanceDogeRaw: balance.toString(),
      feeDogeRaw: feeDoge.toString(),
      principalDogeRaw: principal.toString(),
      pullTxHash: pullHash,
      swapTxHash: swapHash,
    }
  } catch (error) {
    const message = error instanceof PaymentError ? error.message : error instanceof Error ? error.message : String(error)
    await updateDirectConversion(conversionId, { status: "failed", error: message })
    return {
      freelancer: address,
      status: "failed",
      balanceDogeRaw: balance.toString(),
      feeDogeRaw: feeDoge.toString(),
      principalDogeRaw: principal.toString(),
      pullTxHash: null,
      swapTxHash: null,
      reason: message,
    }
  }
}
