/**
 * GOAT DEX swaps — converting inbound liquidity into USDC.e on GOAT.
 *
 * Bridges land DOGEB (bridged from BSC) on the custody wallet on GOAT. This
 * module converts that DOGEB → USDC.e through the GOAT DEX (Oku's Uniswap v3
 * fork) so the custody wallet's GOAT USDC pool refills itself and can keep
 * paying freelancers — the client's own money literally becomes the payout.
 *
 * Executor (recovered live, NOT the naive SwapRouter02):
 *   The GOAT DEX does NOT expose a plain `exactInputSingle` router. The real
 *   executor is a Universal Router-style contract:
 *
 *     0x738fD6d10bCc05c230388B4027CAd37f82fe2AF2
 *     function execute(bytes commands, bytes[] inputs, uint256 deadline) payable
 *
 *   Recovered by decoding a live swap tx (block 14595410: 0x00008 BTC →
 *   5.04 USDC.e) and proven by a real wrap+swap on 2026-08-15 (wallet now
 *   holds USDC.e). Commands:
 *     - 0x0b = WRAP_ETH   input: abi.encode(address recipient, uint256 min)
 *                          (recipient 0x…02 = the router placeholder)
 *     - 0x00 = V3_SWAP_EXACT_IN
 *                          input: abi.encode(address to, uint256 amountIn,
 *                          uint256 amountOutMin, bytes path, bool payerIsUser)
 *   Path layout: [tokenIn, uint24 fee, tokenOut] packed.
 *
 *   HOW ERC20 INPUT WORKS (proven with a real 0.05 USDC deposit + swap): this
 *   fork does NOT pull tokens from the user. payerIsUser=true reverts even
 *   with a full ERC20 allowance, and the constructor's permit2 slot is a stub
 *   contract (0xdd489c75…, fallback-only — decoded from the creation bytecode;
 *   the canonical Uniswap Permit2 0x000000000022… is NOT used). Real Oku
 *   swaps (commands 0a00/00 with payerIsUser=1) only work because a permit
 *   command stores the allowance inside the router first. For external callers
 *   the reliable pattern is: DEPOSIT the input token into the executor via a
 *   plain ERC20 transfer, then execute([V3_SWAP_EXACT_IN], payerIsUser=false)
 *   so the executor pays from its own balance (identical semantics to WRAP).
 *   Stranded deposits are recoverable with the SWEEP command (0x04).
 *
 * Contracts (verified on-chain):
 *   - Executor  0x738fD6d10bCc05c230388B4027CAd37f82fe2AF2
 *   - Factory   0xcb2436774c3e191c85056d248ef4260ce5f27a9d
 *   - Pool DOGEB/USDC.e (fee 3000)  0x186F458E878fFDc45795D61946eff7a97471D77D
 *   - DOGEB (18 dec) 0x1E0d0303a8c4aD428953f5ACB1477dB42bb838cf
 *   - USDC.e (6 dec) 0x3022b87ac063DE95b1570F46f5e470F8B53112D8
 *   - WGBTC (wrapped native BTC, 18 dec) 0xbc10000000000000000000000000000000000000
 *   - WGBTC/USDC.e pool (fee 500) — resolved live via factory.getPool
 *   - Native gas on GOAT is BTC.
 *
 * SECURITY / HONESTY GATE: like the bridge hop, every fund-moving function
 * fails closed unless GOAT_DEX_VERIFIED=true. The pool + executor were
 * verified read-only on-chain, and the executor interface was proven with a
 * small real-money swap (the round-trip in scripts/goat_dex_probe.ts). Set
 * the flag only after scripts/goat_dex_probe.ts --send succeeds.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  encodePacked,
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
  /** Universal Router-style executor — the ONLY contract with swap functions. */
  executor: "0x738fD6d10bCc05c230388B4027CAd37f82fe2AF2",
  factory: "0xcb2436774c3e191c85056d248ef4260ce5f27a9d",
  dogeB: "0x1E0d0303a8c4aD428953f5ACB1477dB42bb838cf",
  usdcE: "0x3022b87ac063DE95b1570F46f5e470F8B53112D8",
  wgbtc: "0xbc10000000000000000000000000000000000000",
  /** DOGEB/USDC.e pool (documented; swaps resolve the pool via the factory). */
  pool: "0x186F458E878fFDc45795D61946eff7a97471D77D",
  fee: 3000,
  /** WGBTC/USDC.e pool fee tier. */
  btcFee: 500,
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
    if (typeof addr === "string" && !isAddress(addr)) problems.push(`${key} is not a valid address`)
  }
  if (!(GOAT_DEX.fee > 0)) problems.push("fee must be > 0")
  if (!(GOAT_DEX.btcFee > 0)) problems.push("btcFee must be > 0")
  return problems
}

// ---------------------------------------------------------------------------
// Universal Router encoding (pure — exported for tests)
// ---------------------------------------------------------------------------

const EXECUTE_ABI = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
] as const

/** Universal Router command codes (verified against the live executor). */
const COMMAND_V3_SWAP_EXACT_IN = 0x00
const COMMAND_WRAP_ETH = 0x0b
/** The executor replaces this placeholder with its own address (wrap recipient). */
const ROUTER_PLACEHOLDER = "0x0000000000000000000000000000000000000002" as Address

function pad64(hex: string): string {
  return hex.padStart(64, "0")
}
function word(v: bigint | number): string {
  return pad64(BigInt(v).toString(16))
}
function addrWord(a: Address): string {
  return pad64(a.slice(2).toLowerCase())
}

/** WRAP_ETH input: abi.encode(address recipient, uint256 amountMin). */
export function encodeWrapInput(recipient: Address, amountMin: bigint): Hex {
  return ("0x" + addrWord(recipient) + word(amountMin)) as Hex
}

/**
 * V3_SWAP_EXACT_IN input: abi.encode(address to, uint256 amountIn,
 * uint256 amountOutMinimum, bytes path, bool payerIsUser). The 160 offset
 * matches the 5-word static section; payerIsUser=false means the executor
 * pays from what the WRAP command deposited (never from our wallet).
 */
export function encodeV3SwapInput(
  recipient: Address,
  amountIn: bigint,
  amountOutMinimum: bigint,
  path: Hex,
  payerIsUser: boolean
): Hex {
  const pathHex = path.slice(2)
  const pathLen = pathHex.length / 2
  const padded = pathHex + "0".repeat(64 - (pathHex.length % 64 || 64))
  return (
    "0x" +
    addrWord(recipient) +
    word(amountIn) +
    word(amountOutMinimum) +
    word(160) +
    word(payerIsUser ? 1 : 0) +
    word(pathLen) +
    padded
  ) as Hex
}

/** Uniswap v3 path: [tokenIn, uint24 fee, tokenOut] packed. */
export function buildV3Path(tokenIn: Address, fee: number, tokenOut: Address): Hex {
  return encodePacked(["address", "uint24", "address"], [tokenIn, fee, tokenOut])
}

/** Full execute calldata: commands + inputs + deadline (pure — exported for tests). */
export function buildExecuteData(
  commands: Hex,
  inputs: Hex[],
  deadline = BigInt(Math.floor(Date.now() / 1000) + 600)
): Hex {
  return encodeFunctionData({
    abi: EXECUTE_ABI,
    functionName: "execute",
    args: [commands, inputs, deadline],
  })
}

// ---------------------------------------------------------------------------
// Live swap
// ---------------------------------------------------------------------------

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
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
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

/** Minimal pool view ABI for token0() + liquidity() + slot0() reads. */
const POOL_VIEW_ABI = [
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
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

const FACTORY_ABI = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
] as const

function getGoatPublicClient() {
  return createPublicClient({ chain: goat, transport: http(GOAT_RPC) })
}

type CustodyAccount = NonNullable<ReturnType<typeof getIssuerAccount>>

async function readPoolState(pool: Address): Promise<{ liquidity: bigint; sqrtPriceX96: bigint; token0: Address }> {
  const client = getGoatPublicClient()
  const [token0, liquidity, slot] = await Promise.all([
    client.readContract({ address: pool, abi: POOL_VIEW_ABI, functionName: "token0" }) as Promise<Address>,
    client.readContract({ address: pool, abi: POOL_VIEW_ABI, functionName: "liquidity" }) as Promise<bigint>,
    client.readContract({ address: pool, abi: POOL_VIEW_ABI, functionName: "slot0" }) as Promise<
      readonly [bigint, number, number, number, number, number, boolean]
    >,
  ])
  return { liquidity, sqrtPriceX96: slot[0], token0: getAddress(token0) }
}

async function resolvePool(tokenIn: Address, tokenOut: Address, fee: number): Promise<Address> {
  const client = getGoatPublicClient()
  const pool = (await client.readContract({
    address: GOAT_DEX.factory as Address,
    abi: FACTORY_ABI,
    functionName: "getPool",
    args: [tokenIn, tokenOut, fee],
  })) as Address
  if (!pool || pool === "0x0000000000000000000000000000000000000000") {
    throw new PaymentError(503, `No pool for ${tokenIn}/${tokenOut} at fee ${fee} on the GOAT DEX factory.`)
  }
  return getAddress(pool)
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
 * Generic ERC20 exact-input swap through the Universal Router executor.
 * Because this fork can't pull from the user (no working Permit2 — see the
 * header), the token is first DEPOSITED into the executor with a plain ERC20
 * transfer, then execute([V3_SWAP_EXACT_IN], payerIsUser=false) swaps from the
 * executor's own balance and sends the output to the recipient. Sizes a
 * conservative amountOutMinimum from live pool state + slippage. If the swap
 * ever reverts, the deposit is recoverable via sweepExecutorBalanceTo().
 * FUND-MOVING: throws unless GOAT_DEX_VERIFIED=true. Returns the GOAT tx hash.
 */
export async function swapExactInTo(
  amountInRaw: bigint,
  tokenIn: Address,
  tokenOut: Address,
  fee: number,
  decimalsIn: number,
  decimalsOut: number,
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
  const executor = GOAT_DEX.executor as Address

  // Balance guard: never try to swap more than the wallet actually holds.
  const held = (await client.readContract({
    address: tokenIn,
    abi: ERC20_APPROVE_ABI,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint
  const amount = amountInRaw > held ? held : amountInRaw
  if (amount <= BigInt(0)) throw new PaymentError(400, `no ${tokenIn} balance on GOAT to swap`)

  // Live pool state for a conservative output estimate.
  const pool = await resolvePool(tokenIn, tokenOut, fee)
  const { liquidity, sqrtPriceX96, token0 } = await readPoolState(pool)
  const zeroForOne = token0.toLowerCase() === tokenIn.toLowerCase()
  const estDecimals0 = zeroForOne ? decimalsIn : decimalsOut
  const estDecimals1 = zeroForOne ? decimalsOut : decimalsIn
  const estimated = estimateV3Output(sqrtPriceX96, liquidity, estDecimals0, estDecimals1, amount, fee, zeroForOne)
  const minOut = applySlippage(estimated, slippageBps)

  // This fork's UniversalRouter does NOT support pulling ERC20s from the user:
  //   - payerIsUser=true reverts even with a full ERC20 allowance (proven), and
  //   - its Permit2 constructor slot points at a stub contract (0xdd489c75…,
  //     fallback-only — recovered from the executor's creation bytecode), so
  //     the permit commands (0x0a/0x02) can't be driven externally.
  // The ONLY proven pull-in mechanism (decoded from live Oku swaps + verified
  // with a real 0.05 USDC deposit + swap): DEPOSIT the input token into the
  // executor with a plain ERC20 transfer, then swap with payerIsUser=false
  // (the executor pays from its own balance — the same semantics as WRAP_ETH).
  // A deposit whose swap reverts is recoverable via the SWEEP command (0x04).
  if (opts?.dryRun) return "dry-run"

  const depositHash = await wallet.writeContract({
    address: tokenIn,
    abi: ERC20_APPROVE_ABI,
    functionName: "transfer",
    args: [executor, amount],
  })
  await client.waitForTransactionReceipt({ hash: depositHash, timeout: 120_000 })

  const path = buildV3Path(tokenIn, fee, tokenOut)
  const input = encodeV3SwapInput(getAddress(recipient) as Address, amount, minOut, path, false)
  const data = buildExecuteData("0x00" as Hex, [input])
  const hash = await wallet.sendTransaction({ to: executor, data, gas: BigInt(400_000) })
  await client.waitForTransactionReceipt({ hash, timeout: 120_000 })
  return hash
}

/**
 * Recovers tokens stranded in the executor (e.g. a deposit whose swap then
 * reverted) via the SWEEP command (0x04): SWEEP input is
 * abi.encode(address token, address recipient, uint256 amountMin). Sweeps the
 * executor's ENTIRE balance of `token` to `recipient`. FUND-MOVING: gated.
 * Returns the GOAT tx hash.
 */
export async function sweepExecutorBalanceTo(
  token: Address,
  recipient: string,
  opts?: { dryRun?: boolean }
): Promise<string> {
  assertGoatDexVerified()
  const account = getIssuerAccount()
  if (!account) throw new PaymentError(503, "PRIVATE_KEY is not configured — cannot sweep on GOAT")

  if (opts?.dryRun) return "dry-run"

  const wallet = createWalletClient({ account, chain: goat, transport: http(GOAT_RPC) })
  const sweepInput = ("0x" +
    addrWord(token) +
    addrWord(getAddress(recipient) as Address) +
    word(BigInt(0))) as Hex
  const data = buildExecuteData("0x04" as Hex, [sweepInput])
  const hash = await wallet.sendTransaction({ to: GOAT_DEX.executor as Address, data, gas: BigInt(300_000) })
  const client = getGoatPublicClient()
  await client.waitForTransactionReceipt({ hash, timeout: 120_000 })
  return hash
}

/**
 * Swaps DOGEB → USDC.e on the GOAT DEX from the custody wallet to an arbitrary
 * recipient. FUND-MOVING: throws unless GOAT_DEX_VERIFIED=true.
 */
export async function swapDogeBToUsdcETo(
  amountInRaw: bigint,
  recipient: string,
  opts?: { slippageBps?: number; dryRun?: boolean }
): Promise<string> {
  return swapExactInTo(amountInRaw, GOAT_DEX.dogeB as Address, GOAT_DEX.usdcE as Address, GOAT_DEX.fee, 18, 6, recipient, opts)
}

/**
 * Swaps USDC.e → DOGEB (the inverse leg — used by the probe's round trip and
 * available to the fee-as-spread converter). FUND-MOVING: gated like the rest.
 */
export async function swapUsdcEToDogeBTo(
  amountInRaw: bigint,
  recipient: string,
  opts?: { slippageBps?: number; dryRun?: boolean }
): Promise<string> {
  return swapExactInTo(amountInRaw, GOAT_DEX.usdcE as Address, GOAT_DEX.dogeB as Address, GOAT_DEX.fee, 6, 18, recipient, opts)
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
 * Swaps native BTC → USDC.e via WRAP_ETH + V3_SWAP_EXACT_IN in a single
 * execute() call (proven live: the wallet's current USDC.e was bought this
 * way). The executor wraps the msg.value, swaps WGBTC → USDC.e, and sweeps
 * the USDC.e to the recipient — the wallet never needs to hold WGBTC.
 * FUND-MOVING: throws unless GOAT_DEX_VERIFIED=true. Returns the GOAT tx hash.
 */
export async function swapNativeBtcToUsdcETo(
  amountBtcRaw: bigint,
  recipient: string,
  opts?: { slippageBps?: number; dryRun?: boolean }
): Promise<string> {
  assertGoatDexVerified()
  const account = getIssuerAccount()
  if (!account) throw new PaymentError(503, "PRIVATE_KEY is not configured — cannot swap on GOAT")
  if (amountBtcRaw <= BigInt(0)) throw new PaymentError(400, "swap amount must be > 0")

  const slippageBps = opts?.slippageBps ?? 200
  const client = getGoatPublicClient()
  const wallet = createWalletClient({ account, chain: goat, transport: http(GOAT_RPC) })
  const executor = GOAT_DEX.executor as Address

  // Balance guard against the native BTC balance.
  const held = await client.getBalance({ address: account.address })
  const amount = amountBtcRaw > held ? held : amountBtcRaw
  if (amount <= BigInt(0)) throw new PaymentError(400, "no native BTC balance on GOAT to swap")

  // Live WGBTC/USDC.e pool state for a conservative output estimate.
  const pool = await resolvePool(GOAT_DEX.wgbtc as Address, GOAT_DEX.usdcE as Address, GOAT_DEX.btcFee)
  const { liquidity, sqrtPriceX96, token0 } = await readPoolState(pool)
  const zeroForOne = token0.toLowerCase() === GOAT_DEX.wgbtc.toLowerCase()
  const estimated = estimateV3Output(sqrtPriceX96, liquidity, 18, 6, amount, GOAT_DEX.btcFee, zeroForOne)
  const minOut = applySlippage(estimated, slippageBps)

  if (opts?.dryRun) return "dry-run"

  const path = buildV3Path(GOAT_DEX.wgbtc as Address, GOAT_DEX.btcFee, GOAT_DEX.usdcE as Address)
  const inputWrap = encodeWrapInput(ROUTER_PLACEHOLDER, amount)
  const inputSwap = encodeV3SwapInput(getAddress(recipient) as Address, amount, minOut, path, false)
  const data = buildExecuteData("0x0b00" as Hex, [inputWrap, inputSwap])
  const hash = await wallet.sendTransaction({ to: executor, data, value: amount, gas: BigInt(400_000) })
  await client.waitForTransactionReceipt({ hash, timeout: 120_000 })
  return hash
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

/** Quick sanity for the smoke tests: executor + pool + tokens must be sane. */
export function validateGoatDexAddresses(): string[] {
  return validateGoatDexConfig()
}
