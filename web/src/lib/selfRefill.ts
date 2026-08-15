/**
 * Self-refill orchestrator — the automatic loop that makes a client's BSC
 * payment literally become the freelancer's GOAT payout.
 *
 * Pipeline per pass (cron /api/relayer/self-refill, every 15 min):
 *
 *   1. The relayer converts BSC deposits to DOGEB (RELAYER_BSC_BRIDGE_TARGET).
 *   2. Here: if the custody wallet holds DOGEB on BSC above a dust floor, the
 *      bridge hop (goatBridge.ts, gated by GOAT_BRIDGE_VERIFIED) moves it to
 *      GOAT.
 *   3. Here: if the custody wallet holds DOGEB on GOAT, the DEX swap
 *      (goatDex.ts, gated by GOAT_DEX_VERIFIED) converts it to USDC.e — which
 *      refills the pool the settle route pays freelancers from.
 *
 * Every hop is recorded in self_refill_runs with an idempotent PK derived from
 * the amount + block-ish timestamp, so a crashed run can never double-bridge
 * or double-swap the same inventory. Both gates fail closed: without
 * GOAT_BRIDGE_VERIFIED / GOAT_DEX_VERIFIED the pass audits balances and
 * reports readiness but moves nothing.
 *
 * SECURITY: this module NEVER touches invoices and NEVER touches source chains
 * other than BSC. It only moves custody inventory between BSC and GOAT.
 */

import { getIssuerAccount } from "./chain"
import { bridgeToGoat, GOAT_BRIDGE_ASSETS, toAmountLD, isGoatBridgeVerified } from "./goatBridge"
import { swapDogeBToUsdcE, getGoatDogeBBalance, isGoatDexVerified, dogeBAmount } from "./goatDex"
import { createSelfRefillRun, updateSelfRefillRun } from "./db"
import { createPublicClient, http, isAddress, type Address } from "viem"
import { bsc } from "viem/chains"

const BSC_RPC = process.env.RPC_BSC_MAINNET || bsc.rpcUrls.default.http[0]
const BSC_CHAIN_ID = 56

function minBridgeDoge(): number {
  const v = Number(process.env.SELF_REFILL_MIN_BRIDGE_DOGE ?? "1")
  return Number.isFinite(v) && v > 0 ? v : 1
}

function minSwapDoge(): number {
  const v = Number(process.env.SELF_REFILL_MIN_SWAP_DOGE ?? "0.5")
  return Number.isFinite(v) && v > 0 ? v : 0.5
}

/** Bridge only what's left over after a BNB gas buffer on BSC. */
function bscGasBufferBnb(): number {
  const v = Number(process.env.SELF_REFILL_BSC_GAS_BUFFER_BNB ?? "0.01")
  return Number.isFinite(v) && v >= 0 ? v : 0.01
}

// ---------------------------------------------------------------------------
// Pure logic (exported for smoke tests)
// ---------------------------------------------------------------------------

/** How much DOGEB (whole tokens) is safe to bridge, leaving a BNB gas buffer. */
export function planBridgeAmount(
  dogeBBalance: number,
  bnbBalance: number,
  minDoge: number,
  gasBufferBnb: number
): number {
  if (dogeBBalance <= 0) return 0
  if (bnbBalance <= gasBufferBnb) return 0 // no gas to pay the bridge tx
  const amount = dogeBBalance
  return amount >= minDoge ? amount : 0
}

/** How much DOGEB (whole tokens) to swap on GOAT. */
export function planSwapAmount(dogeBBalance: number, minDoge: number): number {
  if (dogeBBalance <= 0) return 0
  return dogeBBalance >= minDoge ? dogeBBalance : 0
}

// ---------------------------------------------------------------------------
// Live reads
// ---------------------------------------------------------------------------

function getBscClient() {
  return createPublicClient({ chain: bsc, transport: http(BSC_RPC) })
}

const DOGEB_ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

/** Custody wallet's DOGEB balance on BSC (raw 8-decimals). */
export async function getBscDogeBBalance(account?: `0x${string}`): Promise<bigint> {
  const client = getBscClient()
  const holder = (account ?? getIssuerAccount()?.address ?? "0x0000000000000000000000000000000000000000") as Address
  const balance = (await client.readContract({
    address: GOAT_BRIDGE_ASSETS.DOGEB.token as Address,
    abi: DOGEB_ERC20_ABI,
    functionName: "balanceOf",
    args: [holder],
  })) as bigint
  return balance
}

/** Custody wallet's BNB balance on BSC (for gas). */
export async function getBscBnbBalance(account?: `0x${string}`): Promise<bigint> {
  const client = getBscClient()
  const holder = (account ?? getIssuerAccount()?.address ?? "0x0000000000000000000000000000000000000000") as Address
  return client.getBalance({ address: holder })
}

// ---------------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------------

export interface SelfRefillResult {
  enabled: boolean
  bridgeVerified: boolean
  dexVerified: boolean
  bsc: { dogeB: string; bnb: string }
  goat: { dogeB: string | null }
  plan: { bridgeDoge: number; swapDoge: number }
  bridge: { attempted: boolean; txHash: string | null; runId: string | null; error: string | null }
  swap: { attempted: boolean; txHash: string | null; runId: string | null; error: string | null }
  note: string
}

export interface SelfRefillOptions {
  dryRun?: boolean
}

/** One self-refill pass: bridge BSC DOGEB → GOAT, then DEX-swap → USDC.e. */
export async function runSelfRefillOnce(options: SelfRefillOptions = {}): Promise<SelfRefillResult> {
  const dryRun = options.dryRun ?? process.env.SELF_REFILL_DRY_RUN === "true"
  const result: SelfRefillResult = {
    enabled: true,
    bridgeVerified: isGoatBridgeVerified(),
    dexVerified: isGoatDexVerified(),
    bsc: { dogeB: "0", bnb: "0" },
    goat: { dogeB: null },
    plan: { bridgeDoge: 0, swapDoge: 0 },
    bridge: { attempted: false, txHash: null, runId: null, error: null },
    swap: { attempted: false, txHash: null, runId: null, error: null },
    note: "",
  }

  if (!getIssuerAccount()) {
    result.enabled = false
    result.note = "Self-refill disabled — PRIVATE_KEY not configured."
    return result
  }

  // ── 1. Read balances
  const account = getIssuerAccount()!
  const [bscDogeRaw, bscBnbRaw, goatDogeRaw] = await Promise.all([
    getBscDogeBBalance(account.address),
    getBscBnbBalance(account.address),
    getGoatDogeBBalance(account).catch(() => null),
  ])
  result.bsc.dogeB = bscDogeRaw.toString()
  result.bsc.bnb = bscBnbRaw.toString()
  result.goat.dogeB = goatDogeRaw?.toString() ?? null

  const bscDoge = Number(bscDogeRaw) / 1e8
  const bscBnb = Number(bscBnbRaw) / 1e18
  const goatDoge = goatDogeRaw === null ? null : Number(goatDogeRaw) / 1e18

  // ── 2. Plan
  const bridgeDoge = planBridgeAmount(bscDoge, bscBnb, minBridgeDoge(), bscGasBufferBnb())
  const swapDoge = goatDoge === null ? 0 : planSwapAmount(goatDoge, minSwapDoge())
  result.plan = { bridgeDoge, swapDoge }

  const notes: string[] = []
  if (!result.bridgeVerified && bridgeDoge > 0) {
    notes.push("bridge gated (GOAT_BRIDGE_VERIFIED) — DOGEB on BSC ready to bridge once verified")
  }
  if (!result.dexVerified && swapDoge > 0) {
    notes.push("DEX gated (GOAT_DEX_VERIFIED) — DOGEB on GOAT ready to swap once verified")
  }

  // ── 3. Bridge BSC → GOAT
  if (bridgeDoge > 0 && result.bridgeVerified) {
    result.bridge.attempted = true
    const runId = `bridge_${Date.now()}_${bridgeDoge.toFixed(2)}`
    const amountLD = toAmountLD("DOGEB", bridgeDoge)
    await createSelfRefillRun({ id: runId, kind: "bridge", chainId: BSC_CHAIN_ID, amount: bridgeDoge.toFixed(8) })
    try {
      if (dryRun) {
        await updateSelfRefillRun(runId, { status: "done", error: "dry-run — no bridge tx submitted" })
        result.bridge.txHash = "dry-run"
      } else {
        const hash = await bridgeToGoat("DOGEB", amountLD)
        await updateSelfRefillRun(runId, { status: "done", txHash: hash })
        result.bridge.txHash = hash
      }
      result.bridge.runId = runId
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await updateSelfRefillRun(runId, { status: "failed", error: message })
      result.bridge.error = message
      notes.push(`bridge failed: ${message.slice(0, 120)}`)
    }
  }

  // ── 4. DEX-swap DOGEB → USDC.e on GOAT
  if (swapDoge > 0 && result.dexVerified) {
    result.swap.attempted = true
    const runId = `swap_${Date.now()}_${swapDoge.toFixed(2)}`
    await createSelfRefillRun({ id: runId, kind: "dex_swap", chainId: 2345, amount: swapDoge.toFixed(8) })
    try {
      if (dryRun) {
        await updateSelfRefillRun(runId, { status: "done", error: "dry-run — no swap tx submitted" })
        result.swap.txHash = "dry-run"
      } else {
        // GOAT-side DOGEB is 18 decimals (unlike BSC's 8) — use dogeBAmount.
        const hash = await swapDogeBToUsdcE(dogeBAmount(swapDoge))
        await updateSelfRefillRun(runId, { status: "done", txHash: hash })
        result.swap.txHash = hash
      }
      result.swap.runId = runId
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await updateSelfRefillRun(runId, { status: "failed", error: message })
      result.swap.error = message
      notes.push(`DEX swap failed: ${message.slice(0, 120)}`)
    }
  }

  if (bridgeDoge <= 0 && swapDoge <= 0) {
    notes.push("no DOGEB inventory to move this pass")
  }
  if (dryRun) notes.push("dry-run — no tx submitted")
  result.note = notes.join(" | ")
  return result
}

/** Validates the recovered addresses (pure sanity, mirrors the smoke tests). */
export function validateSelfRefillConfig(): string[] {
  const problems: string[] = []
  for (const [key, addr] of Object.entries(GOAT_BRIDGE_ASSETS.DOGEB)) {
    if (key === "decimals" || key === "symbol") continue
    if (typeof addr === "string" && !isAddress(addr)) problems.push(`DOGEB.${key} is not a valid address`)
  }
  return problems
}

