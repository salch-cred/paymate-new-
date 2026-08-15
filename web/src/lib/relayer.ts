/**
 * Background custody relayer ("swap in the private wallet").
 *
 * Watches the cross-chain custody wallet (PRIVATE_KEY account) on every
 * ClawUp source network for incoming native-token deposits, then auto-swaps
 * the received amount to USDC **on that same source chain** via 1inch, so the
 * custody inventory stays clean instead of accumulating raw ETH/BNB/etc.
 *
 * Detection is balance-delta based: one cheap `eth_getBalance` per chain per
 * run, compared against a stored per-chain snapshot. Every detected delta is
 * persisted in `relayer_swaps` (idempotent PK) BEFORE the swap, so a crashed
 * run can never double-swap: the swap amount always comes from the ledger row
 * and is capped at the current spendable balance, so a repeated attempt after
 * a successful conversion simply fails harmlessly.
 *
 * Settlement of invoices is intentionally NOT here — that stays in the
 * client-triggered settle route. This relayer only converts custody inventory.
 *
 * Safety: fail-closed without PRIVATE_KEY; dry-run mode (RELAYER_DRY_RUN=true
 * or `?dryRun=true`) detects + records but never signs; dust threshold
 * (RELAYER_MIN_SWAP_USD); gas reserve kept on-chain for the swap tx; retries
 * capped at MAX_SWAP_RETRIES then left for manual review in the ledger.
 */

import { isAddress, type Hex } from "viem"
import {
  getCustodyAddress,
  getCrossChainPublicClient,
  getCrossChainWalletClient,
  getCrossChainChainIds,
} from "./chain"
import { getNativeUsdPrice } from "./price"
import {
  createRelayerSwap,
  getPendingRelayerSwaps,
  getRelayerSnapshot,
  setRelayerSnapshot,
  updateRelayerSwap,
} from "./db"

const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

// NOTE: 1inch's public v5 endpoint is DEPRECATED — it now returns HTTP 301 to
// business.1inch.com. ONEINCH_API_KEY (v6) is REQUIRED for any swap.
const ONEINCH_V6_SWAP = "https://api.1inch.dev/swap/v6.0"
const ONEINCH_V6_TOKEN = "https://api.1inch.dev/token/v1.0"

const MAX_SWAP_RETRIES = 5
const FETCH_TIMEOUT_MS = 15_000
const DEFAULT_SLIPPAGE_BPS = 200 // 2% — the checkout already quotes a ~3% buffer

function oneInchApiKey(): string | undefined {
  return process.env.ONEINCH_API_KEY || undefined
}

function dryRunEnabled(): boolean {
  return process.env.RELAYER_DRY_RUN === "true"
}

function minSwapUsd(): number {
  const v = Number(process.env.RELAYER_MIN_SWAP_USD ?? "1")
  return Number.isFinite(v) && v > 0 ? v : 1
}

function gasReserveMultiplier(): number {
  const v = Number(process.env.RELAYER_GAS_RESERVE_MULTIPLIER ?? "1.5")
  return Number.isFinite(v) && v >= 1 ? v : 1.5
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for the smoke tests — no network, no DB)
// ---------------------------------------------------------------------------

/** Picks the best USDC (or USDC.e bridged variant) from a 1inch token list. */
export function pickUsdcFromTokens(
  tokens: { symbol?: string; address?: string }[]
): string | null {
  if (!Array.isArray(tokens)) return null
  const exact = tokens.find(
    (t) => (t.symbol || "").toUpperCase() === "USDC" && isAddress(t.address || "")
  )
  if (exact?.address) return exact.address
  const bridged = tokens.find(
    (t) => (t.symbol || "").toUpperCase() === "USDC.E" && isAddress(t.address || "")
  )
  return bridged?.address ?? null
}

/**
 * The amount (wei) to actually swap after reserving enough native gas for the
 * swap transaction itself. Returns 0n when the deposit is entirely consumed by
 * gas (nothing swappable without eating the balance needed to pay for the tx).
 */
export function computeSwapAmount(
  deltaWei: bigint,
  gasEstimate: bigint,
  gasPrice: bigint,
  multiplier: number
): bigint {
  const scale = BigInt(Math.round(Math.max(multiplier, 1) * 100))
  const reserve = (gasEstimate * gasPrice * scale) / BigInt(100)
  if (deltaWei <= reserve) return BigInt(0)
  return deltaWei - reserve
}

// ---------------------------------------------------------------------------
// 1inch client
// ---------------------------------------------------------------------------

interface OneInchSwapQuote {
  to: `0x${string}`
  data: Hex
  value: bigint
  gas: bigint
  gasPrice?: bigint
  dstAmount: bigint | null
}

async function fetchTokenList(
  chainId: number
): Promise<{ symbol?: string; address?: string }[]> {
  const key = oneInchApiKey()
  if (!key) {
    throw new Error(
      "ONEINCH_API_KEY is not configured — 1inch's public v5 endpoint is deprecated (HTTP 301). Set ONEINCH_API_KEY to enable swaps."
    )
  }
  const res = await fetch(`${ONEINCH_V6_TOKEN}/${chainId}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`1inch token list ${res.status}`)
  const data = (await res.json()) as Record<string, { symbol?: string }>
  return Object.entries(data).map(([address, t]) => ({ symbol: t.symbol, address }))
}

/** Binance-Peg DOGEB on BSC (the bridge-ready asset, from goatBridge.ts). */
const DOGEB_BSC = "0xbA2aE424d960c26247Dd6c32edC70B295c744C43"

/**
 * The swap target for a chain. Normally USDC on the source chain (inventory
 * stays clean). But when RELAYER_BSC_BRIDGE_TARGET=true, BSC deposits convert
 * to DOGEB instead — the bridge-ready asset the GOAT self-refill loop can
 * bridge to GOAT, so BSC client payments literally refill the GOAT pool.
 */
async function resolveSwapTarget(chainId: number): Promise<string | null> {
  const bridgeBsc = process.env.RELAYER_BSC_BRIDGE_TARGET === "true" && chainId === 56
  if (bridgeBsc) return DOGEB_BSC
  return resolveUsdcAddress(chainId)
}

export async function resolveUsdcAddress(chainId: number): Promise<string | null> {
  try {
    const tokens = await fetchTokenList(chainId)
    return pickUsdcFromTokens(tokens)
  } catch (error) {
    console.error(`[Relayer] could not resolve USDC on chain ${chainId}:`, error)
    return null
  }
}

export async function getSwapQuote(
  chainId: number,
  src: string,
  dst: string,
  amountWei: bigint,
  from: string
): Promise<OneInchSwapQuote> {
  const params = new URLSearchParams({
    src,
    dst,
    amount: amountWei.toString(),
    from,
    slippage: String(DEFAULT_SLIPPAGE_BPS),
    disableEstimate: "true",
    allowPartialFill: "false",
  })
  const key = oneInchApiKey()
  if (!key) {
    throw new Error("ONEINCH_API_KEY is not configured — cannot quote a swap")
  }
  const res = await fetch(`${ONEINCH_V6_SWAP}/${chainId}/swap?${params}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`1inch v6 quote ${res.status}`)
  const data = (await res.json()) as {
    tx: { to?: string; data?: string; value?: string; gas?: string; gasPrice?: string }
    dstAmount?: string
  }
  return {
    to: data.tx.to as `0x${string}`,
    data: data.tx.data as Hex,
    value: BigInt(data.tx.value || "0"),
    gas: BigInt(data.tx.gas || "0"),
    gasPrice: data.tx.gasPrice ? BigInt(data.tx.gasPrice) : undefined,
    dstAmount: data.dstAmount ? BigInt(data.dstAmount) : null,
  }
}

export async function executeSwap(chainId: number, quote: OneInchSwapQuote): Promise<string> {
  const wallet = getCrossChainWalletClient(chainId)
  const publicClient = getCrossChainPublicClient(chainId)
  const tx = {
    to: quote.to,
    data: quote.data,
    value: quote.value,
    gas: quote.gas > BigInt(0) ? quote.gas : undefined,
    gasPrice: quote.gasPrice,
  }
  const hash = await wallet.sendTransaction(tx as Parameters<typeof wallet.sendTransaction>[0])
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 })
  if (receipt.status !== "success") throw new Error(`swap reverted: ${hash}`)
  return hash
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export interface RelayerRunResult {
  enabled: boolean
  dryRun: boolean
  chainsChecked: number
  depositsDetected: number
  swapsQueued: number
  swapsCompleted: number
  swapsFailed: number
  swapsSkipped: number
  details: {
    chainId: number
    deltaWei: string
    usdValue: number | null
    status: string
    note?: string
  }[]
}

export interface RelayerOptions {
  dryRun?: boolean
  /**
   * Optional scoping: only process these pending swaps (format
   * `${chainId}:${swapId}`). When set, deposits are still detected and
   * snapshots updated, but only the listed swaps are retried/processed —
   * used by the operator agent so a retry pass touches exactly what the AI
   * selected, never the whole ledger.
   */
  swapIds?: string[]
}

/**
 * One relayer pass: (1) detect new deposits on every source chain via balance
 * deltas, (2) process pending ledger swaps (new + retryable) to USDC.
 * Never touches invoices — inventory conversion only.
 */
export async function runRelayerOnce(options: RelayerOptions = {}): Promise<RelayerRunResult> {
  const dryRun = options.dryRun ?? dryRunEnabled()
  const result: RelayerRunResult = {
    enabled: true,
    dryRun,
    chainsChecked: 0,
    depositsDetected: 0,
    swapsQueued: 0,
    swapsCompleted: 0,
    swapsFailed: 0,
    swapsSkipped: 0,
    details: [],
  }

  let custody: `0x${string}`
  try {
    custody = getCustodyAddress()
  } catch (error) {
    // Fail-closed: without the custody key there is nothing to watch/swap.
    console.error("[Relayer] disabled — PRIVATE_KEY not configured:", error)
    return { ...result, enabled: false }
  }

  const chainIds = getCrossChainChainIds()
  const now = Date.now()

  // ── 1. Detect deposits (parallel — each chain has its own RPC, no shared rate limit)
  const scanOne = async (chainId: number) => {
    try {
      const publicClient = getCrossChainPublicClient(chainId)
      const balance = await publicClient.getBalance({ address: custody })
      const snapshot = await getRelayerSnapshot(chainId)
      const previous = snapshot ? BigInt(snapshot.lastBalance) : balance
      await setRelayerSnapshot(chainId, balance.toString(), now)
      if (balance <= previous) return
      const delta = balance - previous
      if (delta <= BigInt(0)) return
      const price = await getNativeUsdPrice(chainId)
      const usdValue = price ? (Number(delta) / 1e18) * price : null
      const swapId = `${chainId}_${now}_${delta.toString().slice(-10)}`
      await createRelayerSwap(chainId, swapId, delta.toString(), usdValue, now)
      result.depositsDetected += 1
      result.swapsQueued += 1
      result.details.push({ chainId, deltaWei: delta.toString(), usdValue, status: "detected" })
    } catch (error) {
      console.error(`[Relayer] scan chain ${chainId} failed:`, error)
    } finally {
      result.chainsChecked += 1
    }
  }
  await Promise.all(chainIds.map(scanOne))

  // ── 2. Process pending swaps (new, retryable, or in-flight)
  const pending = await getPendingRelayerSwaps()
  const scope = options.swapIds ? new Set(options.swapIds) : null
  for (const swap of pending) {
    if (scope && !scope.has(`${swap.chainId}:${swap.swapId}`)) continue
    if (swap.retries >= MAX_SWAP_RETRIES) continue // left for manual review in the ledger

    // In-flight swap: confirm the already-submitted tx instead of re-swapping.
    if (swap.status === "swapping" && swap.swapTxHash) {
      const hash = swap.swapTxHash as `0x${string}`
      try {
        // Still known to the chain (pending or mined)? Then it was really sent —
        // wait for the receipt and finalize. Re-swapping here could otherwise
        // double-convert the same deposit if the first tx is only pending.
        const known = await getCrossChainPublicClient(swap.chainId).getTransaction({ hash })
        if (known) {
          const receipt = await getCrossChainPublicClient(swap.chainId).waitForTransactionReceipt({ hash, timeout: 90_000 })
          if (receipt.status === "success") {
            await updateRelayerSwap(swap.chainId, swap.swapId, { status: "swapped" })
            result.swapsCompleted += 1
          } else {
            await updateRelayerSwap(swap.chainId, swap.swapId, { status: "failed", error: "swap reverted on-chain" })
            result.swapsFailed += 1
          }
          continue
        }
      } catch {
        // Tx no longer known to the chain (dropped/replaced) — safe to re-submit.
      }
    }

    try {
      const usdcAddress = await resolveSwapTarget(swap.chainId)
      if (!usdcAddress) {
        await updateRelayerSwap(swap.chainId, swap.swapId, {
          status: "skipped",
          error: "No swap target via 1inch (check ONEINCH_API_KEY / chain support)",
        })
        result.swapsSkipped += 1
        result.details.push({ chainId: swap.chainId, deltaWei: swap.nativeAmount, usdValue: swap.usdValue, status: "skipped", note: "no 1inch target" })
        continue
      }

      const publicClient = getCrossChainPublicClient(swap.chainId)
      const gasPrice = await publicClient.getGasPrice()
      const desired = BigInt(swap.nativeAmount)

      // First quote (for the full row amount) tells us the gas the swap needs.
      const preQuote = await getSwapQuote(swap.chainId, NATIVE_TOKEN, usdcAddress, desired, custody)
      const multiplier = gasReserveMultiplier()
      const currentBalance = await publicClient.getBalance({ address: custody })
      let amount = computeSwapAmount(desired, preQuote.gas, gasPrice, multiplier)
      if (currentBalance < amount + (preQuote.gas * gasPrice * BigInt(Math.round(multiplier * 100))) / BigInt(100)) {
        const reserve = (preQuote.gas * gasPrice * BigInt(Math.round(multiplier * 100))) / BigInt(100)
        amount = currentBalance > reserve ? currentBalance - reserve : BigInt(0)
      }
      if (amount <= BigInt(0)) {
        await updateRelayerSwap(swap.chainId, swap.swapId, {
          status: "skipped",
          error: "Deposit fully consumed by gas reserve — nothing swappable",
        })
        result.swapsSkipped += 1
        continue
      }

      // Dust guard in USD terms.
      const price = await getNativeUsdPrice(swap.chainId)
      if (price && (Number(amount) / 1e18) * price < minSwapUsd()) {
        await updateRelayerSwap(swap.chainId, swap.swapId, {
          status: "skipped",
          error: `Below RELAYER_MIN_SWAP_USD (${minSwapUsd()})`,
        })
        result.swapsSkipped += 1
        continue
      }

      // Mark in-flight BEFORE submitting so a crash can't cause a re-swap loop.
      await updateRelayerSwap(swap.chainId, swap.swapId, {
        status: "swapping",
        usdcAddress,
        retries: swap.retries + 1,
      })

      if (dryRun) {
        await updateRelayerSwap(swap.chainId, swap.swapId, {
          status: "swapped",
          error: "dry-run — no swap submitted",
        })
        result.swapsCompleted += 1
        result.details.push({ chainId: swap.chainId, deltaWei: amount.toString(), usdValue: swap.usdValue, status: "dry-run" })
        continue
      }

      const finalQuote = await getSwapQuote(swap.chainId, NATIVE_TOKEN, usdcAddress, amount, custody)
      const hash = await executeSwap(swap.chainId, finalQuote)
      await updateRelayerSwap(swap.chainId, swap.swapId, {
        status: "swapped",
        swapTxHash: hash,
        usdcAmount: finalQuote.dstAmount?.toString() ?? null,
      })
      result.swapsCompleted += 1
      result.details.push({ chainId: swap.chainId, deltaWei: amount.toString(), usdValue: swap.usdValue, status: "swapped", note: hash })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await updateRelayerSwap(swap.chainId, swap.swapId, {
        status: "failed",
        error: message,
        retries: swap.retries + 1,
      })
      result.swapsFailed += 1
      result.details.push({ chainId: swap.chainId, deltaWei: swap.nativeAmount, usdValue: swap.usdValue, status: "failed", note: message })
    }
  }

  return result
}
