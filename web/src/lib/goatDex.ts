/**
 * GOAT DEX swap — the last link of the self-refilling custody loop.
 *
 * Bridges land DOGEB (bridged from BSC) on the custody wallet on GOAT. This
 * module converts that DOGEB → USDC.e through the GOAT DEX (Oku's Uniswap v3
 * fork) so the custody wallet's GOAT USDC pool refills itself and can keep
 * paying freelancers — the client's own money literally becomes the payout.
 *
 * Contracts (recovered live from Oku's frontend + GOAT explorer, verified
 * on-chain today):
 *   - SwapRouter02  0xaa52bB8110fE38D0d2d2AF0B85C3A3eE622CA455
 *     (factory() == 0xcb2436774c3e191c85056d248ef4260ce5f27a9d == the pool's
 *      factory, confirmed via getPool(DOGEB, USDC.e, 3000) → 0x186F458E…)
 *   - Pool DOGEB/USDC.e (fee 3000)  0x186F458E878fFDc45795D61946eff7a97471D77D
 *   - DOGEB (18 dec) 0x1E0d0303a8c4aD428953f5ACB1477dB42bb838cf
 *   - USDC.e (6 dec) 0x3022b87ac063DE95b1570F46f5e470F8B53112D8
 *   - Native gas on GOAT is BTC.
 *
 * SECURITY / HONESTY GATE: like the bridge hop, every fund-moving function
 * fails closed unless GOAT_DEX_VERIFIED=true. The pool + router were verified
 * read-only on-chain, but a live swap is the one thing that can't be proven
 * without spending dust. Set the flag ONLY after scripts/goat_dex_probe.ts
 * --send succeeds with a tiny amount.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  getAddress,
  isAddress,
  type Address,
  type Hex,
} from "viem"
import { goat } from "viem/chains"
import { PaymentError, getIssuerAccount } from "./chain"

const GOAT_RPC = process.env.RPC_GOAT_MAINNET || "https://rpc.goat.network"

/** Recovered GOAT DEX contracts (see header). */
export const GOAT_DEX = {
  router: "0xaa52bB8110fE38D0d2d2AF0B85C3A3eE622CA455",
  factory: "0xcb2436774c3e191c85056d248ef4260ce5f27a9d",
  dogeB: "0x1E0d0303a8c4aD428953f5ACB1477dB42bb838cf",
  usdcE: "0x3022b87ac063DE95b1570F46f5e470F8B53112D8",
  pool: "0x186F458E878fFDc45795D61946eff7a97471D77D",
  fee: 3000,
} as const

/** Whole DOGE → raw DOGEB wei (18 decimals on GOAT, unlike BSC's 8). */
export function dogeBAmount(wholeDoge: number): bigint {
  return BigInt(Math.round(wholeDoge * 1e18))
}

// ---------------------------------------------------------------------------
// The verification gate (same fail-closed pattern as the bridge)
// ---------------------------------------------------------------------------

export function isGoatDexVerified(): boolean {
  return process.env.GOAT_DEX_VERIFIED === "true"
}

export function assertGoatDexVerified(): void {
  if (!isGoatDexVerified()) {
    throw new PaymentError(
      503,
      "GOAT_DEX_VERIFIED is not set — the recovered DEX interface has not passed a small real-money swap. Refusing to move funds. Run scripts/goat_dex_probe.ts --send with a tiny DOGEB amount first, then set GOAT_DEX_VERIFIED=true."
    )
  }
}

// ---------------------------------------------------------------------------
// Pure swap math (exported for smoke tests — no network, no funds)
// ---------------------------------------------------------------------------

/**
 * Uniswap v3 single-pool exact-input estimate: given the pool's current
 * sqrtPriceX96, liquidity, token decimals, and the input amount (raw), returns
 * the estimated output (raw) before fees. Simple and conservative — the router
 * enforces the real math on-chain; this only sizes amountOutMinimum.
 */
export function estimateV3Output(
  sqrtPriceX96: bigint,
  liquidity: bigint,
  token0Decimals: number,
  token1Decimals: number,
  amountInRaw: bigint,
  feeBps: number,
  zeroForOne: boolean
): bigint {
  void token0Decimals
  void token1Decimals
  if (amountInRaw <= BigInt(0) || liquidity <= BigInt(0)) return BigInt(0)

  // BigInt fixed-point math (all sqrt prices are X96, i.e. √P × 2^96). Float
  // arithmetic cannot represent the tiny √P delta of a single-tick swap.
  //   zeroForOne:  amount1 = L × (√P − √P') / 2^96        [token1 raw]
  //   !zeroForOne: amount0 = L × (1/√P' − 1/√P) × 2^96     [token0 raw]
  const TWO96 = BigInt(2) ** BigInt(96)
  // Uniswap v3 fee tiers use a 1,000,000 denominator: tier 3000 = 0.3%.
  const feeKeep = BigInt(1_000_000 - feeBps)
  const amountAfterFee = (amountInRaw * feeKeep) / BigInt(1_000_000)
  if (amountAfterFee <= BigInt(0)) return BigInt(0)

  if (zeroForOne) {
    // x = L/√P in raw token0 units; adding input raises x, lowering √P.
    const x = (liquidity * TWO96) / sqrtPriceX96
    const x2 = x + amountAfterFee
    const sqrtP2X96 = (liquidity * TWO96) / x2
    if (sqrtP2X96 >= sqrtPriceX96) return BigInt(0)
    return (liquidity * (sqrtPriceX96 - sqrtP2X96)) / TWO96
  }
  // Selling token1: y = L×√P/2^96; adding input raises √P.
  const y = (liquidity * sqrtPriceX96) / TWO96
  const y2 = y + amountAfterFee
  const sqrtP2X96 = (y2 * TWO96) / liquidity
  if (sqrtP2X96 <= sqrtPriceX96) return BigInt(0)
  // amount0 = L × (1/√P' − 1/√P) in raw token0 units.
  return (liquidity * TWO96) / sqrtPriceX96 - (liquidity * TWO96) / sqrtP2X96
}

/**
 * Conservative amountOutMinimum: the estimate scaled down by slippageBps so a
 * sandwich can never drain more than the configured tolerance.
 */
export function applySlippage(estimatedOutRaw: bigint, slippageBps: number): bigint {
  if (estimatedOutRaw <= BigInt(0)) return BigInt(0)
  const keep = Math.max(0, Math.min(10_000, 10_000 - slippageBps))
  return (estimatedOutRaw * BigInt(keep)) / BigInt(10_000)
}

/** Validates the recovered DEX config (pure sanity for the smoke tests). */
export function validateGoatDexConfig(): string[] {
  const problems: string[] = []
  for (const [key, addr] of Object.entries(GOAT_DEX)) {
    if (key !== "fee" && typeof addr === "string" && !isAddress(addr)) problems.push(`${key} is not a valid address`)
  }
  if (!(GOAT_DEX.fee > 0)) problems.push("fee must be > 0")
  return problems
}

// ---------------------------------------------------------------------------
// Live swap
// ---------------------------------------------------------------------------

const EXACT_INPUT_SINGLE_ABI = [
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const

const ERC20_APPROVE_ABI = [
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
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "transferFrom",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

/** Minimal pool view ABI for liquidity() + slot0() reads. */
const POOL_VIEW_ABI = [
  {
    type: "function",
    name: "liquidity",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint128" }],
  },
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" },
    ],
  },
] as const

function getGoatPublicClient() {
  return createPublicClient({ chain: goat, transport: http(GOAT_RPC) })
}

type CustodyAccount = NonNullable<ReturnType<typeof getIssuerAccount>>

/** Builds the exactInputSingle calldata (pure — exported for tests). */
export function buildExactInputSingleData(
  amountIn: bigint,
  amountOutMinimum: bigint,
  recipient: string,
  sqrtPriceLimitX96 = BigInt(0)
): Hex {
  return encodeFunctionData({
    abi: EXACT_INPUT_SINGLE_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: GOAT_DEX.dogeB as Address,
        tokenOut: GOAT_DEX.usdcE as Address,
        fee: GOAT_DEX.fee,
        recipient: recipient as Address,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96,
      },
    ],
  })
}

/** Read-only: any wallet's DOGEB balance on GOAT (raw units). */
export async function getDogeBBalanceOf(address: string): Promise<bigint> {
  const client = getGoatPublicClient()
  const balance = (await client.readContract({
    address: GOAT_DEX.dogeB as Address,
    abi: ERC20_APPROVE_ABI,
    functionName: "balanceOf",
    args: [getAddress(address) as Address],
  })) as bigint
  return balance
}

/** Read-only: the custody wallet's DOGEB balance on GOAT (raw units). */
export async function getGoatDogeBBalance(account?: CustodyAccount): Promise<bigint> {
  const holder = (account ?? getIssuerAccount() ?? { address: "0x0000000000000000000000000000000000000000" }) as unknown as { address: Address }
  return getDogeBBalanceOf(holder.address)
}

/**
 * Swaps DOGEB → USDC.e on the GOAT DEX from the custody wallet to an arbitrary
 * recipient. FUND-MOVING: throws unless GOAT_DEX_VERIFIED=true. Approves the
 * router, reads live pool state (liquidity + sqrtPriceX96), computes a
 * conservative amountOutMinimum from the configured slippage, and submits
 * exactInputSingle. Returns the GOAT tx hash.
 */
export async function swapDogeBToUsdcETo(
  amountInRaw: bigint,
  recipient: string,
  opts?: { slippageBps?: number; dryRun?: boolean }
): Promise<string> {
  assertGoatDexVerified()
  const account = getIssuerAccount()
  if (!account) throw new PaymentError(503, "PRIVATE_KEY is not configured — cannot swap on GOAT")
  if (amountInRaw <= BigInt(0)) throw new PaymentError(400, "swap amount must be > 0")

  const slippageBps = opts?.slippageBps ?? 200 // 2% default
  const client = getGoatPublicClient()
  const wallet = createWalletClient({ account, chain: goat, transport: http(GOAT_RPC) })
  const router = GOAT_DEX.router as Address

  // Balance guard: never try to swap more than the wallet actually holds.
  const held = await getGoatDogeBBalance(account)
  const amount = amountInRaw > held ? held : amountInRaw
  if (amount <= BigInt(0)) throw new PaymentError(400, "no DOGEB balance on GOAT to swap")

  // Live pool state for a conservative output estimate.
  const liquidity = (await client
    .readContract({ address: GOAT_DEX.pool as Address, abi: POOL_VIEW_ABI, functionName: "liquidity" })
    .catch(() => BigInt(0))) as bigint
  const slot = (await client
    .readContract({ address: GOAT_DEX.pool as Address, abi: POOL_VIEW_ABI, functionName: "slot0" })
    .catch(() => ({ sqrtPriceX96: BigInt(0), tick: 0, observationIndex: 0, observationCardinality: 0, observationCardinalityNext: 0, feeProtocol: 0, unlocked: false }))) as { sqrtPriceX96: bigint }
  const sqrtPriceX96 = slot.sqrtPriceX96
  const estimated = estimateV3Output(sqrtPriceX96, liquidity, 18, 6, amount, GOAT_DEX.fee, true)
  const minOut = applySlippage(estimated, slippageBps)

  // Approve the router to spend DOGEB.
  const existing = (await client.readContract({
    address: GOAT_DEX.dogeB as Address,
    abi: ERC20_APPROVE_ABI,
    functionName: "allowance",
    args: [account.address as Address, router],
  })) as bigint
  if (existing < amount) {
    const approveHash = await wallet.writeContract({
      address: GOAT_DEX.dogeB as Address,
      abi: ERC20_APPROVE_ABI,
      functionName: "approve",
      args: [router, amount],
    })
    await client.waitForTransactionReceipt({ hash: approveHash, timeout: 120_000 })
  }

  if (opts?.dryRun) return "dry-run"

  const data = buildExactInputSingleData(amount, minOut, recipient)
  const hash = await wallet.sendTransaction({ to: router, data, gas: BigInt(400_000) })
  await client.waitForTransactionReceipt({ hash, timeout: 120_000 })
  return hash
}

/**
 * Swaps DOGEB → USDC.e from the custody wallet to the custody wallet itself.
 * Kept for the self-refill loop (inventory conversion).
 */
export async function swapDogeBToUsdcE(
  amountInRaw: bigint,
  opts?: { slippageBps?: number; dryRun?: boolean }
): Promise<string> {
  const account = getIssuerAccount()
  if (!account) throw new PaymentError(503, "PRIVATE_KEY is not configured — cannot swap on GOAT")
  return swapDogeBToUsdcETo(amountInRaw, account.address as string, opts)
}

/**
 * Pulls `amount` DOGEB from `from` into the custody wallet (transferFrom,
 * requires the owner's approval — the fee-as-spread converter only calls this
 * after confirming allowance). FUND-MOVING: throws unless GOAT_DEX_VERIFIED.
 * Returns the GOAT tx hash.
 */
export async function pullDogeBFrom(
  from: string,
  amount: bigint,
  opts?: { dryRun?: boolean }
): Promise<string> {
  assertGoatDexVerified()
  const account = getIssuerAccount()
  if (!account) throw new PaymentError(503, "PRIVATE_KEY is not configured — cannot pull DOGEB on GOAT")
  if (amount <= BigInt(0)) throw new PaymentError(400, "pull amount must be > 0")

  const client = getGoatPublicClient()
  const wallet = createWalletClient({ account, chain: goat, transport: http(GOAT_RPC) })

  const existing = (await client.readContract({
    address: GOAT_DEX.dogeB as Address,
    abi: ERC20_APPROVE_ABI,
    functionName: "allowance",
    args: [getAddress(from) as Address, account.address as Address],
  })) as bigint
  if (existing < amount) {
    throw new PaymentError(400, `No DOGEB allowance from ${from} to the custody wallet (${existing} < ${amount}) — the freelancer must approve once before conversion.`)
  }

  if (opts?.dryRun) return "dry-run"

  const hash = await wallet.writeContract({
    address: GOAT_DEX.dogeB as Address,
    abi: ERC20_APPROVE_ABI,
    functionName: "transferFrom",
    args: [getAddress(from) as Address, account.address as Address, amount],
  })
  await client.waitForTransactionReceipt({ hash, timeout: 120_000 })
  return hash
}

/** Quick sanity for the smoke tests: router + pool + tokens must be sane. */
export function validateGoatDexAddresses(): string[] {
  return validateGoatDexConfig()
}
