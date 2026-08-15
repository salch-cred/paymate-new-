/**
 * GOAT bridge hop — BSC (DOGEB / BTCB) → GOAT Network.
 *
 * Interface recovered from the live bridge frontend (bridge.goat.network
 * /_next/static/chunks bundle) and confirmed against the GOAT Network GitHub
 * org: the BSC adapters are LayerZero V2 OFTAdapters (GoatAdapter.sol, an
 * OFTAdapterUpgradeable) behind the LZ UniversalProxy, peered for GOAT mainnet
 * EID 30361 (peer = GOAT-side BTCB OFT 0xfe41e7e5…).
 *
 * Flow per bridge:
 *   1. quote  → 2. approve the adapter to spend the asset  → 3. send() with
 *   the quoted LayerZero fee (value = nativeFee, paid in BNB).
 *
 * SECURITY / HONESTY GATE: a live quoteSend against the deployed adapters
 * reverted in black-box testing for both the 7-field amountLD SendParam the
 * frontend builds and the standard 8-field OFT shape. The exact caller/options
 * context that makes the UI's call succeed is not yet pinned down. So this
 * module FAILS CLOSED: every function that moves funds throws unless
 * GOAT_BRIDGE_VERIFIED=true — set it ONLY after a small real-money bridge
 * test (scripts/goat_bridge_probe.ts) succeeds. Until then this module can
 * quote (read-only) but never spend a single wei.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  decodeAbiParameters,
  getAddress,
  isAddress,
  type Address,
  type Hex,
} from "viem"
import { bsc } from "viem/chains"
import { PaymentError, getIssuerAccount } from "./chain"

/** GOAT Network mainnet LayerZero V2 endpoint id (from the bridge frontend). */
export const GOAT_EID = 30361

const BSC_RPC = process.env.RPC_BSC_MAINNET || bsc.rpcUrls.default.http[0]

/**
 * Recovered bridge assets (BSC side). token = the Binance-Peg asset on BSC;
 * adapter = the LZ OFTAdapter (UniversalProxy) the frontend approves + calls.
 * Addresses come from the bridge frontend bundle + on-chain confirmation
 * (token(), endpoint(), peers(30361)).
 */
export const GOAT_BRIDGE_ASSETS = {
  DOGEB: {
    symbol: "DOGE",
    token: "0xbA2aE424d960c26247Dd6c32edC70B295c744C43",
    adapter: "0x0E9A492Bd9D4241028f794b9580847e5C3444776",
    decimals: 8,
  },
  BTCB: {
    symbol: "BTCB",
    token: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",
    adapter: "0x5b7b01bEBCdf408Dd14429A9b12465AB45204B13",
    decimals: 18,
  },
} as const

export type GoatBridgeAsset = keyof typeof GOAT_BRIDGE_ASSETS
export type BridgeVariant = "amountLD" | "standard"

// ---------------------------------------------------------------------------
// The verification gate
// ---------------------------------------------------------------------------

export function isGoatBridgeVerified(): boolean {
  return process.env.GOAT_BRIDGE_VERIFIED === "true"
}

/** Throws unless GOAT_BRIDGE_VERIFIED=true. Every fund-moving path calls this. */
export function assertGoatBridgeVerified(): void {
  if (!isGoatBridgeVerified()) {
    throw new PaymentError(
      503,
      "GOAT_BRIDGE_VERIFIED is not set — the recovered bridge interface has not passed a small real-money test. Refusing to bridge funds. Run scripts/goat_bridge_probe.ts --send with a tiny amount first, then set GOAT_BRIDGE_VERIFIED=true."
    )
  }
}

// ---------------------------------------------------------------------------
// ABIs (both SendParam variants the deployed adapters may implement)
// ---------------------------------------------------------------------------

/**
 * Variant A — "amountLD": what the live frontend builds
 *   SendParam = (uint32 dstEid, bytes32 to, uint256 amountLD, uint256
 *                minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd)
 *   quoteSend(SendParam, bool) → MessagingFee; send(SendParam, MessagingFee, address) payable
 */
const AMOUNT_LD_ABI = [
  {
    type: "function",
    name: "quoteSend",
    stateMutability: "view",
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
      { name: "_payInLzToken", type: "bool" },
    ],
    outputs: [
      {
        name: "msgFee",
        type: "tuple",
        components: [
          { name: "nativeFee", type: "uint256" },
          { name: "lzTokenFee", type: "uint256" },
        ],
      },
    ],
  },
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

/**
 * Variant B — standard LayerZero V2 OFT
 *   SendParam = (bytes32 to, uint32 dstEid, bytes toAddress, address token,
 *                uint256 amount, bytes composeMsg, bytes extraOptions, bytes oftCmd)
 */
const STANDARD_ABI = [
  {
    type: "function",
    name: "quoteSend",
    stateMutability: "view",
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
      { name: "_payInLzToken", type: "bool" },
    ],
    outputs: [
      {
        name: "msgFee",
        type: "tuple",
        components: [
          { name: "nativeFee", type: "uint256" },
          { name: "lzTokenFee", type: "uint256" },
        ],
      },
    ],
  },
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
] as const

// ---------------------------------------------------------------------------
// Pure helpers (exported for the smoke tests — no network, no funds)
// ---------------------------------------------------------------------------

function padAddress(addr: string): Hex {
  return ("0x" + getAddress(addr).slice(2).padStart(64, "0")) as Hex
}

/** Whole tokens → local-decimals amount. */
export function toAmountLD(asset: GoatBridgeAsset, whole: number): bigint {
  const decimals = GOAT_BRIDGE_ASSETS[asset].decimals
  return BigInt(Math.round(whole * 10 ** decimals))
}

/** Builds the quoteSend calldata for a variant (pure — no network). */
export function buildQuoteCalldata(
  variant: BridgeVariant,
  asset: GoatBridgeAsset,
  amountLD: bigint,
  receiver: string
): Hex {
  const cfg = GOAT_BRIDGE_ASSETS[asset]
  if (variant === "amountLD") {
    return encodeFunctionData({
      abi: AMOUNT_LD_ABI,
      functionName: "quoteSend",
      args: [
        {
          dstEid: GOAT_EID,
          to: padAddress(receiver),
          amountLD,
          minAmountLD: amountLD,
          extraOptions: "0x",
          composeMsg: "0x",
          oftCmd: "0x",
        },
        false,
      ],
    })
  }
  return encodeFunctionData({
    abi: STANDARD_ABI,
    functionName: "quoteSend",
    args: [
      {
        to: padAddress(receiver),
        dstEid: GOAT_EID,
        toAddress: getAddress(receiver) as Hex,
        token: cfg.token as Address,
        amount: amountLD,
        composeMsg: "0x",
        extraOptions: "0x",
        oftCmd: "0x",
      },
      false,
    ],
  })
}

// ---------------------------------------------------------------------------
// Live bridge calls (read-only quote; fund-moving send is gated)
// ---------------------------------------------------------------------------

export interface BridgeQuote {
  variant: BridgeVariant
  nativeFee: bigint
  lzTokenFee: bigint
}

function getBscPublicClient() {
  return createPublicClient({ chain: bsc, transport: http(BSC_RPC) })
}

type CustodyAccount = NonNullable<ReturnType<typeof getIssuerAccount>>

function getBscWalletClient(account: CustodyAccount) {
  return createWalletClient({ account, chain: bsc, transport: http(BSC_RPC) })
}

/** Both SendParam variants return (uint256 nativeFee, uint256 lzTokenFee). */
function decodeFee(data: Hex): { nativeFee: bigint; lzTokenFee: bigint } {
  const [nativeFee, lzTokenFee] = decodeAbiParameters([{ type: "uint256" }, { type: "uint256" }], data)
  return { nativeFee, lzTokenFee }
}

/**
 * Read-only: quotes the LayerZero fee for a BSC → GOAT bridge. Tries the
 * amountLD variant (what the live frontend builds) first, then the standard
 * OFT shape. Throws with both revert reasons when neither answers — never
 * sends funds. `from` defaults to the custody wallet when configured.
 */
export async function quoteBridgeToGoat(
  asset: GoatBridgeAsset,
  amountLD: bigint,
  from?: `0x${string}`
): Promise<BridgeQuote> {
  const cfg = GOAT_BRIDGE_ASSETS[asset]
  const client = getBscPublicClient()
  const sender = (from ?? getIssuerAccount()?.address ?? "0x0000000000000000000000000000000000000000") as Address
  const errors: string[] = []

  for (const variant of ["amountLD", "standard"] as const) {
    try {
      const data = buildQuoteCalldata(variant, asset, amountLD, sender)
      const result = await client.call({ account: sender, to: cfg.adapter as Address, data })
      if (!result.data || result.data === "0x") throw new Error("empty return")
      const fee = decodeFee(result.data)
      return { variant, nativeFee: fee.nativeFee, lzTokenFee: fee.lzTokenFee }
    } catch (error) {
      errors.push(`${variant}: ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`)
    }
  }
  throw new PaymentError(
    400,
    `Bridge quote failed for ${asset} on BSC: ${errors.join(" | ")} — set GOAT_BRIDGE_VERIFIED=true only after the probe shows a live quote succeeding.`
  )
}

async function ensureApproval(
  asset: GoatBridgeAsset,
  amountLD: bigint,
  account: CustodyAccount
): Promise<void> {
  const cfg = GOAT_BRIDGE_ASSETS[asset]
  const client = getBscPublicClient()
  const wallet = getBscWalletClient(account)
  const token = cfg.token as Address
  const existing = (await client.readContract({
    address: token,
    abi: ERC20_APPROVE_ABI,
    functionName: "allowance",
    args: [account.address as Address, cfg.adapter as Address],
  })) as bigint
  if (existing >= amountLD) return
  const hash = await wallet.writeContract({
    address: token,
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [cfg.adapter as Address, amountLD],
  })
  await client.waitForTransactionReceipt({ hash, timeout: 120_000 })
}

/**
 * Bridges `amountLD` of the asset from the custody wallet (PRIVATE_KEY) on BSC
 * to the custody wallet on GOAT. FUND-MOVING: throws unless
 * GOAT_BRIDGE_VERIFIED=true. Approves the adapter, then calls send() with the
 * quoted fee as msg.value (paid in BNB). Returns the BSC tx hash.
 */
export async function bridgeToGoat(
  asset: GoatBridgeAsset,
  amountLD: bigint,
  opts?: { dryRun?: boolean }
): Promise<string> {
  assertGoatBridgeVerified()
  const account = getIssuerAccount()
  if (!account) throw new PaymentError(503, "PRIVATE_KEY is not configured — cannot bridge from BSC")

  const cfg = GOAT_BRIDGE_ASSETS[asset]
  const client = getBscPublicClient()
  const wallet = getBscWalletClient(account)
  const receiver = account.address as Address

  const quote = await quoteBridgeToGoat(asset, amountLD, receiver)
  await ensureApproval(asset, amountLD, account)

  if (opts?.dryRun) return "dry-run"

  let data: Hex
  if (quote.variant === "amountLD") {
    data = encodeFunctionData({
      abi: AMOUNT_LD_ABI,
      functionName: "send",
      args: [
        {
          dstEid: GOAT_EID,
          to: padAddress(receiver),
          amountLD,
          minAmountLD: amountLD,
          extraOptions: "0x",
          composeMsg: "0x",
          oftCmd: "0x",
        },
        { nativeFee: quote.nativeFee, lzTokenFee: quote.lzTokenFee },
        receiver,
      ],
    })
  } else {
    data = encodeFunctionData({
      abi: STANDARD_ABI,
      functionName: "send",
      args: [
        {
          to: padAddress(receiver),
          dstEid: GOAT_EID,
          toAddress: receiver as Hex,
          token: cfg.token as Address,
          amount: amountLD,
          composeMsg: "0x",
          extraOptions: "0x",
          oftCmd: "0x",
        },
        { nativeFee: quote.nativeFee, lzTokenFee: quote.lzTokenFee },
        receiver,
      ],
    })
  }

  const hash = await wallet.sendTransaction({
    to: cfg.adapter as Address,
    data,
    value: quote.nativeFee,
  })
  await client.waitForTransactionReceipt({ hash, timeout: 120_000 })
  return hash
}

/** Quick sanity: every recovered address must be valid and checksummed-safe. */
export function validateBridgeConfig(): string[] {
  const problems: string[] = []
  for (const [key, cfg] of Object.entries(GOAT_BRIDGE_ASSETS)) {
    if (!isAddress(cfg.token)) problems.push(`${key}.token is not a valid address`)
    if (!isAddress(cfg.adapter)) problems.push(`${key}.adapter is not a valid address`)
    if (cfg.decimals <= 0) problems.push(`${key}.decimals must be > 0`)
  }
  return problems
}
