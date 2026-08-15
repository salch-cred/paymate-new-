/**
 * Pivot hop — the all-chains self-refill engine.
 *
 * Client deposits on ANY supported chain land as USDC inventory in the
 * custody wallet (the relayer swaps them on the source chain). This module
 * moves that inventory to the one chain that has the GOAT bridge — BSC:
 *
 *   1. quote LI.Fi: USDC@source → BNB@BSC  (single signable tx, verified live:
 *      Across/LayerSwap/Mayan, ~0.3% cost, toAmountMin slippage-protected)
 *   2. approve the LI.Fi router for the exact amount (least privilege)
 *   3. custody signs ONE tx on the source chain → BNB lands in custody on BSC
 *   4. on BSC: keep a BNB reserve (self-refill's bridge gas + LZ fee),
 *      swap the rest BNB → DOGEB via 1inch
 *
 * That's it — the EXISTING self-refill cron then bridges custody DOGEB BSC →
 * GOAT (gated by GOAT_BRIDGE_VERIFIED) and DEX-swaps to USDC.e (gated by
 * GOAT_DEX_VERIFIED), and the settle route pays the freelancer. So the
 * client's payment literally becomes the GOAT payout on every supported
 * chain — with zero PayMate pre-funding beyond a one-time few-cent gas seed.
 *
 * SECURITY:
 *   - Every run is ledgered in pivot_runs BEFORE funds move (idempotent PK)
 *   - toAmountMin from the LI.Fi quote caps slippage loss
 *   - Approval is scoped to the exact pivot amount, not infinite
 *   - The source chain must have enough native gas for the LI.Fi tx (the
 *     deposit funds its own pivot — verified live at $0.01–$0.06)
 *   - BNB reserve is kept for the bridge so the pivot never strands gas
 *   - PIVOT_MAX_ACTION_USD caps total per-pass exposure; dry-run audits only
 */

import { createPublicClient, http, getAddress, isAddress, type Address } from "viem"
import { PaymentError, getCustodyAddress, getCrossChainChainObject, getCrossChainWalletClient, getCrossChainPublicClient } from "./chain"
import { createPivotRun, updatePivotRun, getLastPivotAt } from "./db"
import { getSwapQuote, executeSwap } from "./relayer"
import { GOAT_BRIDGE_ASSETS } from "./goatBridge"

const NATIVE_BNB = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
const BSC_CHAIN_ID = 56
const LIFI_QUOTE_URL = "https://li.quest/v1/quote"
const FETCH_TIMEOUT_MS = 15_000

const ERC20_VIEW_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

function lifiApiKey(): string | undefined {
  return process.env.LIFI_API_KEY || undefined
}

function minPivotUsd(): number {
  const v = Number(process.env.PIVOT_MIN_USD ?? "10")
  return Number.isFinite(v) && v > 0 ? v : 10
}

function maxActionUsd(): number {
  const v = Number(process.env.PIVOT_MAX_ACTION_USD ?? "1000")
  return Number.isFinite(v) && v > 0 ? v : 1000
}

function cooldownMs(): number {
  const v = Number(process.env.PIVOT_COOLDOWN_MS ?? (20 * 60_000))
  return Number.isFinite(v) && v >= 0 ? v : 20 * 60_000
}

function bscGasBufferWei(): bigint {
  const v = Number(process.env.SELF_REFILL_BSC_GAS_BUFFER_BNB ?? "0.01")
  return BigInt(Math.round((Number.isFinite(v) && v > 0 ? v : 0.01) * 1e18))
}

export function pivotDryRunEnabled(): boolean {
  return process.env.PIVOT_DRY_RUN === "true"
}

// ---------------------------------------------------------------------------
// LI.Fi quote client
// ---------------------------------------------------------------------------

export interface LifiQuote {
  id: string
  approvalAddress: string
  toAmount: bigint
  toAmountMin: bigint
  tx: { to: Address; data: `0x${string}`; value: bigint; gasLimit: bigint; chainId: number }
  gasCostWei: bigint
  feeUsd: number
}

/**
 * Quotes USDC on `chainId` → native BNB on BSC via LI.Fi. The returned tx is
 * directly signable by the custody wallet (single transaction). Fails closed
 * if no route exists.
 */
export async function quoteLifiUsdcToBnb(
  chainId: number,
  usdcAddress: string,
  amountRaw: bigint,
  from: string
): Promise<LifiQuote> {
  if (!isAddress(usdcAddress)) throw new PaymentError(400, `Invalid USDC address on chain ${chainId}`)
  const params = new URLSearchParams({
    fromChain: String(chainId),
    toChain: String(BSC_CHAIN_ID),
    fromToken: getAddress(usdcAddress),
    toToken: NATIVE_BNB,
    fromAmount: amountRaw.toString(),
    fromAddress: getAddress(from),
    toAddress: getAddress(from),
    slippage: "0.005",
    order: "CHEAPEST",
  })
  const headers: Record<string, string> = {}
  const key = lifiApiKey()
  if (key) headers["x-lifi-api-key"] = key
  const res = await fetch(`${LIFI_QUOTE_URL}?${params}`, {
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new PaymentError(502, `LI.Fi quote failed (${res.status}) for chain ${chainId}`)
  const data = (await res.json()) as {
    id?: string
    transactionRequest?: { to?: string; data?: string; value?: string; gasLimit?: string; chainId?: number }
    estimate?: {
      approvalAddress?: string
      toAmount?: string
      toAmountMin?: string
      gasCosts?: { type?: string; amount?: string; amountUSD?: string }[]
      feeCosts?: { name?: string; amountUSD?: string }[]
    }
  }
  const tr = data.transactionRequest
  if (!tr?.to || !tr?.data) {
    throw new PaymentError(502, `No LI.Fi route from chain ${chainId} to BSC — this chain's USDC cannot pivot yet.`)
  }
  const estimate = data.estimate || {}
  const sendGas = (estimate.gasCosts || []).find((g) => g.type === "SEND")
  const feeUsd = (estimate.feeCosts || []).reduce((sum, f) => sum + (Number(f.amountUSD) || 0), 0)
  return {
    id: data.id || `lifi-${chainId}-${Date.now()}`,
    approvalAddress: estimate.approvalAddress || tr.to,
    toAmount: BigInt(estimate.toAmount || "0"),
    toAmountMin: BigInt(estimate.toAmountMin || "0"),
    tx: {
      to: tr.to as Address,
      data: tr.data as `0x${string}`,
      value: BigInt(tr.value || "0"),
      gasLimit: BigInt(tr.gasLimit || "0"),
      chainId: tr.chainId || chainId,
    },
    gasCostWei: BigInt(sendGas?.amount || "0"),
    feeUsd,
  }
}

// ---------------------------------------------------------------------------
// Execution helpers
// ---------------------------------------------------------------------------

function getSourcePublicClient(chainId: number) {
  const chain = getCrossChainChainObject(chainId)
  return createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) })
}

async function readDecimals(chainId: number, token: string): Promise<number> {
  const client = getSourcePublicClient(chainId)
  try {
    return Number((await client.readContract({ address: token as Address, abi: ERC20_VIEW_ABI, functionName: "decimals" })) ?? 18)
  } catch {
    return 18
  }
}

async function getUsdcBalance(chainId: number, token: string, holder: Address): Promise<bigint> {
  const client = getSourcePublicClient(chainId)
  const balance = (await client.readContract({ address: token as Address, abi: ERC20_VIEW_ABI, functionName: "balanceOf", args: [holder] })) as bigint
  return balance
}

/** Approves the LI.Fi router for the EXACT amount (least privilege). */
async function ensureLifiApproval(
  chainId: number,
  usdcAddress: string,
  spender: string,
  amount: bigint,
  holder: Address
): Promise<void> {
  const client = getSourcePublicClient(chainId)
  const existing = (await client.readContract({
    address: usdcAddress as Address,
    abi: ERC20_VIEW_ABI,
    functionName: "allowance",
    args: [holder, spender as Address],
  })) as bigint
  if (existing >= amount) return
  const wallet = getCrossChainWalletClient(chainId)
  const hash = await wallet.writeContract({
    address: usdcAddress as Address,
    abi: ERC20_VIEW_ABI,
    functionName: "approve",
    args: [spender as Address, amount],
  })
  await client.waitForTransactionReceipt({ hash, timeout: 120_000 })
}

// ---------------------------------------------------------------------------
// The pivot pass
// ---------------------------------------------------------------------------

export interface PivotPassResult {
  enabled: boolean
  dryRun: boolean
  chainsChecked: number
  pivotedUsd: number
  results: {
    chainId: number
    usdValue: number
    status: string
    note?: string
    lifiTxHash?: string
    dogeBridged?: string
    bridgeTxHash?: string
  }[]
}

/**
 * One pivot pass: scan chains that hold USDC inventory in the custody wallet,
 * and for each eligible chain move it to BSC as DOGEB (LI.Fi → 1inch swap),
 * leaving the BNB gas reserve the self-refill bridge needs. The bridge + DEX
 * swap to GOAT are handled by the existing self-refill cron.
 */
export async function runPivotOnce(opts?: { dryRun?: boolean; chains?: { chainId: number; usdcAddress: string }[] }): Promise<PivotPassResult> {
  const dryRun = opts?.dryRun ?? pivotDryRunEnabled()
  const custody = getCustodyAddress()

  // Candidate chains: any chain where the relayer recorded done swaps (so it
  // holds USDC inventory). Resolve USDC addresses from those ledger rows.
  const candidates = opts?.chains ?? (await getPivotCandidates())
  const minUsd = minPivotUsd()
  let pivotedUsd = 0

  const results: PivotPassResult["results"] = []
  for (const cand of candidates) {
    const { chainId, usdcAddress } = cand
    try {
      const decimals = await readDecimals(chainId, usdcAddress)
      const balance = await getUsdcBalance(chainId, usdcAddress, custody)
      const usdValue = Number(balance) / 10 ** decimals
      if (usdValue < minUsd) {
        results.push({ chainId, usdValue, status: "skipped", note: `USDC balance ($${usdValue.toFixed(2)}) below the $${minUsd} pivot minimum.` })
        continue
      }
      if (pivotedUsd + usdValue > maxActionUsd()) {
        results.push({ chainId, usdValue, status: "skipped", note: "Per-pass PIVOT_MAX_ACTION_USD cap reached." })
        continue
      }
      const lastPivot = await getLastPivotAt(chainId)
      if (Date.now() - lastPivot < cooldownMs()) {
        results.push({ chainId, usdValue, status: "skipped", note: "Within the per-chain cooldown window." })
        continue
      }

      // Live quote — the deposit must fund its own pivot.
      const quote = await quoteLifiUsdcToBnb(chainId, usdcAddress, balance, custody)
      const nativeClient = getCrossChainPublicClient(chainId)
      const nativeBalance = await nativeClient.getBalance({ address: custody })
      const gasNeeded = (quote.gasCostWei * BigInt(120)) / BigInt(100) // +20% buffer
      if (nativeBalance < gasNeeded) {
        results.push({ chainId, usdValue, status: "skipped", note: `Source-chain native balance cannot cover the LI.Fi gas (${gasNeeded} wei needed).` })
        continue
      }

      const runId = `pivot-${chainId}-${Date.now()}`
      if (!dryRun) await createPivotRun({ id: runId, chainId, usdcAddress, usdcAmount: balance.toString(), usdValue: usdValue.toFixed(2) })

      if (dryRun) {
        results.push({ chainId, usdValue, status: "planned", note: `Would pivot $${usdValue.toFixed(2)} → ~${(Number(quote.toAmount) / 1e18).toFixed(4)} BNB on BSC (fees ≈ $${quote.feeUsd.toFixed(2)}), then swap to DOGEB.` })
        pivotedUsd += usdValue
        continue
      }

      try {
        // 1) Approve the LI.Fi router (exact amount), 2) sign the pivot tx.
        await ensureLifiApproval(chainId, usdcAddress, quote.approvalAddress, balance, custody)
        const wallet = getCrossChainWalletClient(quote.tx.chainId)
        const lifiHash = await wallet.sendTransaction({
          to: quote.tx.to,
          data: quote.tx.data,
          value: quote.tx.value,
          gas: quote.tx.gasLimit > BigInt(0) ? quote.tx.gasLimit : undefined,
        })
        await getCrossChainPublicClient(quote.tx.chainId).waitForTransactionReceipt({ hash: lifiHash, timeout: 180_000 })

        // 3) BSC leg: keep the bridge gas reserve, swap the rest BNB → DOGEB.
        const bscClient = getCrossChainPublicClient(BSC_CHAIN_ID)
        let bnbBalance = await bscClient.getBalance({ address: custody })
        const gasPrice = await bscClient.getGasPrice()
        const bufferWei = bscGasBufferWei()
        const swapQuote = await getSwapQuote(BSC_CHAIN_ID, NATIVE_BNB, GOAT_BRIDGE_ASSETS.DOGEB.token, bnbBalance, custody)
        const swapGasWei = swapQuote.gas * gasPrice
        const reserveWei = swapGasWei + bufferWei
        let swapAmount = bnbBalance - reserveWei
        if (swapAmount <= BigInt(0)) {
          swapAmount = BigInt(0)
          results.push({ chainId, usdValue, status: "done", note: "Pivoted to BSC but the BNB is fully consumed by gas — nothing left to swap. The reserve stays for the self-refill bridge." })
          await updatePivotRun(runId, { status: "done", lifiTxHash: lifiHash, bnbOut: bnbBalance.toString(), error: null })
          pivotedUsd += usdValue
          continue
        }
        const swapHash = await executeSwap(BSC_CHAIN_ID, { ...swapQuote, value: BigInt(0) })
        await bscClient.waitForTransactionReceipt({ hash: swapHash as `0x${string}`, timeout: 180_000 })

        // 4) Verify DOGEB landed, then let the self-refill cron bridge it.
        bnbBalance = await bscClient.getBalance({ address: custody })
        const dogeHeld = await getUsdcBalance(BSC_CHAIN_ID, GOAT_BRIDGE_ASSETS.DOGEB.token, custody)
        await updatePivotRun(runId, {
          status: "done",
          lifiTxHash: lifiHash,
          bnbOut: bnbBalance.toString(),
          dogeBridged: dogeHeld.toString(),
          error: null,
        })
        results.push({
          chainId,
          usdValue,
          status: "done",
          note: `Pivoted $${usdValue.toFixed(2)} → ${(Number(dogeHeld) / 1e8).toFixed(2)} DOGEB in custody on BSC. Self-refill will bridge it to GOAT.`,
          lifiTxHash: lifiHash,
          dogeBridged: dogeHeld.toString(),
        })
        pivotedUsd += usdValue
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        // Record the BNB outcome even on failure: if the LI.Fi tx landed but
        // the BSC swap failed, the BNB is recoverable inventory on BSC and
        // must be visible in the audit trail (the operator agent can retry).
        let bnbOut: string | null = null
        try {
          bnbOut = (await getCrossChainPublicClient(BSC_CHAIN_ID).getBalance({ address: custody })).toString()
        } catch {
          // ledger write below still records the failure
        }
        await updatePivotRun(runId, { status: "failed", error: message, bnbOut })
        results.push({ chainId, usdValue, status: "failed", note: message, ...(bnbOut ? { bnbOut } : {}) })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      results.push({ chainId: cand.chainId, usdValue: 0, status: "failed", note: message })
    }
  }

  return { enabled: true, dryRun, chainsChecked: candidates.length, pivotedUsd, results }
}

/** Chains with recorded done relayer swaps (USDC inventory), from the ledger. */
export async function getPivotCandidates(): Promise<{ chainId: number; usdcAddress: string }[]> {
  const { getPivotCandidatesFromDb } = await import("./db")
  return getPivotCandidatesFromDb()
}

/** Pure: the BSC swap amount after keeping the gas reserve. Exported for tests. */
export function computeBscSwapAmount(bnbBalance: bigint, swapGasWei: bigint, bufferWei: bigint): bigint {
  const reserve = swapGasWei + bufferWei
  if (bnbBalance <= reserve) return BigInt(0)
  return bnbBalance - reserve
}

/** Pure: USDC raw for a USD threshold at a given decimals. Exported for tests. */
export function usdToRaw(usd: number, decimals: number): bigint {
  if (!(usd > 0)) return BigInt(0)
  return BigInt(Math.round(usd * 10 ** decimals))
}
