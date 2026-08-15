/**
 * Direct-to-freelancer pay rail (zero custody).
 *
 * The client's money goes STRAIGHT to the freelancer's GOAT wallet — PayMate
 * never holds the principal. The client signs three transactions on BSC:
 *
 *   1. swap     — 1inch: BNB → DOGEB (exact-input, sized +3% so 2% slippage
 *                 still clears the invoice; the change stays in their wallet)
 *   2. approve  — DOGEB → LZ adapter (only if allowance is insufficient)
 *   3. bridge   — LayerZero OFT send: DOGEB → the freelancer's address on GOAT
 *                 (the recovered GoatAdapter interface; `to` is ANY GOAT
 *                 address, which is the whole trick — no custody hop)
 *
 * PayMate's fee is NOT taken up front: it is earned as the conversion spread
 * when the freelancer's DOGEB is converted to USDC.e on GOAT (see
 * directConverter.ts). This keeps the rail zero-custody and zero pre-funding.
 *
 * SECURITY: plan is read-only (quotes only — nothing moves). verify checks the
 * bridge send ON-CHAIN (tx to the adapter, sendParam.to == freelancer, amount
 * ≥ the invoice in DOGEB, 5% price-drift tolerance) and is replay-guarded by
 * the direct_payments ledger (tx_hash PK). The invoice is only marked paid
 * after the on-chain proof passes.
 */

import { createPublicClient, http, getAddress, isAddress, decodeFunctionData, type Address, type Hex } from "viem"
import { bsc } from "viem/chains"
import { PaymentError } from "./chain"
import {
  GOAT_BRIDGE_ASSETS,
  buildBridgeSendCalldata,
  quoteBridgeToGoat,
  type BridgeVariant,
} from "./goatBridge"
import { paymateFeeRate } from "./db"
import { getDogeUsdPrice } from "./price"
import type { Invoice } from "./db"

const BSC_CHAIN_ID = 56
const BSC_RPC = process.env.RPC_BSC_MAINNET || bsc.rpcUrls.default.http[0]
const ONEINCH_V6_SWAP = "https://api.1inch.dev/swap/v6.0"
const FETCH_TIMEOUT_MS = 15_000
const SWAP_SLIPPAGE_BPS = 200 // 2% — the plan sizes +3% so the client clears the invoice even at max slippage

function oneInchApiKey(): string | undefined {
  return process.env.ONEINCH_API_KEY || undefined
}

function getBscPublicClient() {
  return createPublicClient({ chain: bsc, transport: http(BSC_RPC) })
}

export function getBscChainId(): number {
  return BSC_CHAIN_ID
}

/** Binance-Peg DOGEB on BSC (8 decimals) + the recovered LZ adapter. */
export const BSC_DOGEB = GOAT_BRIDGE_ASSETS.DOGEB

/** Whole DOGE → BSC DOGEB raw (8 decimals). */
export function dogeBToAmountLD(wholeDoge: number): bigint {
  return BigInt(Math.round(wholeDoge * 1e8))
}

/** BSC DOGEB raw (8-dec) → whole DOGE. */
export function amountLDToDogeB(amountLD: bigint): number {
  return Number(amountLD) / 1e8
}

/**
 * Invoices eligible for the direct rail: simple single-amount, non-escrow,
 * non-stream, no milestones/splits, not ZK-shielded, not already paid, and a
 * valid freelancer address (the GOAT-side receiver).
 */
export function assertDirectPayEligible(invoice: Invoice): void {
  if (invoice.status === "paid") throw new PaymentError(402, "Invoice is already paid.")
  if (invoice.githubPrUrl) throw new PaymentError(402, "Escrow invoices cannot be paid via the direct rail.")
  if (invoice.isStream) throw new PaymentError(402, "Streaming invoices cannot be paid via the direct rail.")
  if (invoice.milestones && invoice.milestones.length > 0) throw new PaymentError(402, "Milestone invoices cannot be paid via the direct rail.")
  if (invoice.splits && invoice.splits.length > 0) throw new PaymentError(402, "Split invoices cannot be paid via the direct rail.")
  if (invoice.isPrivate) throw new PaymentError(402, "ZK-shielded invoices cannot be paid via the direct rail.")
  if (!isAddress(invoice.freelancer)) throw new PaymentError(402, "Invoice has no valid freelancer wallet to receive the direct payment.")
  if (!(invoice.amountUsd > 0)) throw new PaymentError(402, "Invoice amount must be > 0.")
}

// ---------------------------------------------------------------------------
// Pure plan math (exported for the smoke tests — no network)
// ---------------------------------------------------------------------------

/** BSC DOGEB raw (8-dec) for an exact USD invoice value at a given DOGE price. */
export function principalDogeRawFromUsd(amountUsd: number, dogeUsdPrice: number): bigint {
  if (!(amountUsd > 0) || !(dogeUsdPrice > 0)) return BigInt(0)
  return BigInt(Math.floor((amountUsd / dogeUsdPrice) * 1e8))
}

/**
 * The swap target: +3% over the principal so that even at the 2% 1inch
 * slippage the client still receives ≥ the full invoice in DOGEB. The excess
 * (if any) stays in the client's wallet — the bridge sends exactly the
 * principal.
 */
export function swapTargetDogeRaw(principalDoge: bigint): bigint {
  return (principalDoge * BigInt(103)) / BigInt(100)
}

// ---------------------------------------------------------------------------
// The plan (read-only quotes)
// ---------------------------------------------------------------------------

export interface DirectPayPlan {
  invoiceId: string
  freelancer: string
  amountUsd: number
  dogeUsdPrice: number
  feeBps: number
  principalDogeRaw: string
  swapTargetDogeRaw: string
  steps: {
    swap: { to: string; data: Hex; value: string; gas: string; estDogeOutRaw: string; estBnbInUsd: number }
    approve: { token: string; spender: string; amount: string; needed: boolean }
    bridge: { to: string; data: Hex; value: string; amountLD: string; nativeFeeBnb: string; variant: BridgeVariant }
  }
}

/**
 * Builds the full client-signed plan for a direct payment. Read-only — every
 * step is a quote/calldata build; the client's wallet signs the actual txs.
 */
export async function planBscDirectPayment(
  invoice: Invoice,
  payer: string
): Promise<DirectPayPlan> {
  assertDirectPayEligible(invoice)
  if (!payer || !isAddress(payer)) throw new PaymentError(400, "A valid payer wallet address is required to plan the direct payment.")

  const key = oneInchApiKey()
  if (!key) {
    throw new PaymentError(503, "ONEINCH_API_KEY is not configured — cannot quote the BSC swap (1inch public v5 is deprecated).")
  }

  const dogeUsdPrice = await getDogeUsdPrice()
  if (!dogeUsdPrice || dogeUsdPrice <= 0) {
    throw new PaymentError(503, "Could not fetch the DOGE price — the direct rail fails closed rather than quoting against a stale price.")
  }

  const principal = principalDogeRawFromUsd(invoice.amountUsd, dogeUsdPrice)
  if (principal <= BigInt(0)) throw new PaymentError(400, "Invoice is too small to pay in DOGEB.")

  const target = swapTargetDogeRaw(principal)

  // ── 1. 1inch swap quote: BNB → DOGEB (exact-input) ──
  // Reference-quote a small BNB amount to derive the live DOGEB/BNB rate,
  // then re-quote the exact BNB amount needed for `target` + 5% buffer.
  const from = getAddress(payer)
  const dst = BSC_DOGEB.token
  const src = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" // native BNB
  const refAmount = BigInt("10000000000000000") // 0.01 BNB
  const ref = await quoteOneInchSwap(refAmount, src, dst, from)
  const refOut = ref.dstAmount ?? BigInt(0)
  if (refOut <= BigInt(0)) throw new PaymentError(502, "Could not price BNB→DOGEB — the swap quote returned no output.")

  // rate: DOGEB raw per 1 wei of BNB
  const rate = (refOut * BigInt(1e18)) / refAmount
  const bnbNeeded = (target * BigInt(1e18)) / rate
  const bnbWithBuffer = (bnbNeeded * BigInt(105)) / BigInt(100)

  const swap = await quoteOneInchSwap(bnbWithBuffer, src, dst, from)
  const swapOut = swap.dstAmount ?? BigInt(0)
  if (swapOut < target) {
    // Slippage ate too much — refuse to plan (fail closed) rather than send
    // the client into a payment that lands short of the invoice.
    throw new PaymentError(502, `Swap quote only yields ${amountLDToDogeB(swapOut).toFixed(2)} DOGE — below the ${amountLDToDogeB(target).toFixed(2)} needed. Try again or use the GOAT-native rail.`)
  }

  // ── 2. Adapter allowance (only when the payer hasn't approved yet) ──
  const client = getBscPublicClient()
  const adapter = BSC_DOGEB.adapter as Address
  const allowance = (await client.readContract({
    address: BSC_DOGEB.token as Address,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: "allowance",
    args: [from, adapter],
  })) as bigint

  // ── 3. Bridge: send exactly the principal to the freelancer on GOAT ──
  const freelancer = getAddress(invoice.freelancer)
  const quote = await quoteBridgeToGoat("DOGEB", principal, freelancer)
  const bridgeData = buildBridgeSendCalldata("DOGEB", principal, freelancer, quote.variant)

  const feeBps = Math.round(paymateFeeRate() * 10_000)

  return {
    invoiceId: invoice.id,
    freelancer,
    amountUsd: invoice.amountUsd,
    dogeUsdPrice,
    feeBps,
    principalDogeRaw: principal.toString(),
    swapTargetDogeRaw: target.toString(),
    steps: {
      swap: {
        to: swap.to,
        data: swap.data,
        value: swap.value.toString(),
        gas: swap.gas.toString(),
        estDogeOutRaw: (swapOut > principal ? principal : swapOut).toString(),
        estBnbInUsd: Number(swap.value) / 1e18 * (invoice.amountUsd / amountLDToDogeB(principal)),
      },
      approve: {
        token: BSC_DOGEB.token,
        spender: adapter,
        amount: principal.toString(),
        needed: allowance < principal,
      },
      bridge: {
        to: adapter,
        data: bridgeData,
        value: quote.nativeFee.toString(),
        amountLD: principal.toString(),
        nativeFeeBnb: (Number(quote.nativeFee) / 1e18).toFixed(6),
        variant: quote.variant,
      },
    },
  }
}

interface OneInchTx {
  to: string
  data: Hex
  value: bigint
  gas: bigint
  dstAmount: bigint | null
}

async function quoteOneInchSwap(
  amountWei: bigint,
  src: string,
  dst: string,
  from: string
): Promise<OneInchTx> {
  const key = oneInchApiKey()
  if (!key) throw new PaymentError(503, "ONEINCH_API_KEY is not configured — cannot quote a swap")
  const params = new URLSearchParams({
    src,
    dst,
    amount: amountWei.toString(),
    from,
    slippage: String(SWAP_SLIPPAGE_BPS),
    disableEstimate: "true",
    allowPartialFill: "false",
  })
  const res = await fetch(`${ONEINCH_V6_SWAP}/${BSC_CHAIN_ID}/swap?${params}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) throw new PaymentError(502, `1inch swap quote failed (${res.status})`)
  const data = (await res.json()) as {
    tx: { to?: string; data?: string; value?: string; gas?: string }
    dstAmount?: string
  }
  return {
    to: data.tx.to as string,
    data: data.tx.data as Hex,
    value: BigInt(data.tx.value || "0"),
    gas: BigInt(data.tx.gas || "0"),
    dstAmount: data.dstAmount ? BigInt(data.dstAmount) : null,
  }
}

// ---------------------------------------------------------------------------
// Verification (on-chain proof, replay-guarded upstream by direct_payments)
// ---------------------------------------------------------------------------

const ERC20_ALLOWANCE_ABI = [
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
] as const

export interface DirectBridgeProof {
  bridgeTxHash: string
  freelancer: string
  amountDogeRaw: bigint
  goatConfirmed: boolean
  variant: BridgeVariant
}

/**
 * Verifies a client-signed bridge send on BSC against the STORED plan: the tx
 * must have succeeded, been sent to the recovered adapter, its sendParam.to
 * must be the freelancer's GOAT address, and its amount must be ≥ the exact
 * expected DOGEB locked at plan time (no price tolerance — a payer can never
 * underpay by exploiting DOGE drift between plan and verify). Also polls the
 * freelancer's GOAT DOGEB balance as a best-effort delivery confirmation.
 */
export async function verifyBscDirectBridge(
  invoice: Invoice,
  bridgeTxHash: string,
  expectedDogeRaw: bigint,
  opts?: { goatConfirmPollMs?: number }
): Promise<DirectBridgeProof> {
  assertDirectPayEligible(invoice)
  if (!isAddress(bridgeTxHash) && !/^0x[a-fA-F0-9]{64}$/.test(bridgeTxHash)) {
    throw new PaymentError(400, "Invalid bridge transaction hash.")
  }
  const hash = bridgeTxHash as `0x${string}`
  const client = getBscPublicClient()
  const adapter = BSC_DOGEB.adapter as Address

  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90_000 })
  if (receipt.status !== "success") throw new PaymentError(402, `Bridge transaction reverted: ${bridgeTxHash}`)
  const tx = await client.getTransaction({ hash })
  if (!tx.to || getAddress(tx.to) !== adapter) {
    throw new PaymentError(402, "Bridge transaction was not sent to the LayerZero adapter.")
  }

  // Decode the send() calldata (both SendParam shapes the adapter may use).
  let sendParam: { to: string; amount: bigint } | null = null
  let variant: BridgeVariant | null = null
  for (const v of ["amountLD", "standard"] as const) {
    try {
      const decoded = decodeFunctionData({ abi: v === "amountLD" ? SEND_AMOUNT_LD_ABI : SEND_STANDARD_ABI, data: tx.input })
      if (decoded.functionName !== "send") continue
      const sp = decoded.args[0] as { to: string; amountLD?: bigint; amount?: bigint; toAddress?: string }
      const to = sp.toAddress && sp.toAddress.length > 0 ? sp.toAddress : "0x" + sp.to.slice(26)
      sendParam = { to, amount: sp.amountLD ?? sp.amount ?? BigInt(0) }
      variant = v
      break
    } catch {
      // try the other variant
    }
  }
  if (!sendParam || !variant) throw new PaymentError(402, "Bridge transaction is not a recognized LayerZero send.")

  const freelancer = getAddress(invoice.freelancer)
  if (getAddress(sendParam.to) !== freelancer) {
    throw new PaymentError(402, "Bridge send is not addressed to this invoice's freelancer.")
  }

  if (expectedDogeRaw <= BigInt(0)) {
    throw new PaymentError(402, "No direct-pay plan exists for this invoice — re-plan at /api/pay/[id]/direct-plan first.")
  }
  if (sendParam.amount < expectedDogeRaw) {
    throw new PaymentError(
      402,
      `Bridge amount is short: ${amountLDToDogeB(sendParam.amount).toFixed(4)} DOGE vs ${amountLDToDogeB(expectedDogeRaw).toFixed(4)} required by the plan.`
    )
  }

  // Best-effort delivery confirmation on GOAT (the LZ relay credits the OFT).
  let goatConfirmed = false
  const pollMs = opts?.goatConfirmPollMs ?? 60_000
  try {
    const { getDogeBBalanceOf } = await import("./goatDex")
    const started = Date.now()
    const goatSidePrincipal = expectedDogeRaw * BigInt(1e10) // 8-dec → 18-dec GOAT
    while (Date.now() - started < pollMs) {
      const bal = await getDogeBBalanceOf(freelancer)
      if (bal >= goatSidePrincipal) {
        goatConfirmed = true
        break
      }
      await new Promise((r) => setTimeout(r, 5_000))
    }
  } catch {
    goatConfirmed = false // never fatal — the BSC proof already stands
  }

  return { bridgeTxHash, freelancer, amountDogeRaw: sendParam.amount, goatConfirmed, variant }
}

// Minimal send() ABIs mirroring goatBridge's (decoding only).
const SEND_AMOUNT_LD_ABI = [
  {
    type: "function",
    name: "send",
    stateMutability: "payable",
    inputs: [
      {
        name: "_sendParam",
        type: "tuple",
        components: [
          { name: "dstEid", type: "uint32" },
          { name: "to", type: "bytes32" },
          { name: "amountLD", type: "uint256" },
          { name: "minAmountLD", type: "uint256" },
          { name: "extraOptions", type: "bytes" },
          { name: "composeMsg", type: "bytes" },
          { name: "oftCmd", type: "bytes" },
        ],
      },
      {
        name: "_fee",
        type: "tuple",
        components: [
          { name: "nativeFee", type: "uint256" },
          { name: "lzTokenFee", type: "uint256" },
        ],
      },
      { name: "_refundAddress", type: "address" },
    ],
    outputs: [],
  },
] as const

const SEND_STANDARD_ABI = [
  {
    type: "function",
    name: "send",
    stateMutability: "payable",
    inputs: [
      {
        name: "_sendParam",
        type: "tuple",
        components: [
          { name: "to", type: "bytes32" },
          { name: "dstEid", type: "uint32" },
          { name: "toAddress", type: "bytes" },
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "composeMsg", type: "bytes" },
          { name: "extraOptions", type: "bytes" },
          { name: "oftCmd", type: "bytes" },
        ],
      },
      {
        name: "_fee",
        type: "tuple",
        components: [
          { name: "nativeFee", type: "uint256" },
          { name: "lzTokenFee", type: "uint256" },
        ],
      },
      { name: "_refundAddress", type: "address" },
    ],
    outputs: [],
  },
] as const
