import { createPublicClient, createWalletClient, http, getAddress, isAddress, decodeFunctionData, type Chain } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import type { Invoice } from "./db"
import { goat, base, optimism, arbitrum, polygon, bsc, avalanche, fantom, celo } from "viem/chains"

export const goatChain = goat

const RPC_URL = process.env.RPC_GOAT_MAINNET || goatChain.rpcUrls.default.http[0]

const REPUTATION_ABI = [
  {
    type: "function",
    name: "recordJob",
    stateMutability: "nonpayable",
    inputs: [
      { name: "freelancer", type: "address" },
      { name: "amountUsd", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getReputation",
    stateMutability: "view",
    inputs: [{ name: "freelancer", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "jobsCompleted", type: "uint256" },
          { name: "totalEarnedUsd", type: "uint256" },
          { name: "score", type: "uint256" },
        ],
      },
    ],
  },
] as const

export const ESCROW_ABI = [
  {
    type: "function",
    name: "registerInvoice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "string" },
      { name: "client", type: "address" },
      { name: "freelancer", type: "address" },
      { name: "maturesAt", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "confirmFunded",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "string" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "resolveEscrow",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "resolveDispute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "invoiceId", type: "string" },
      { name: "resolution", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getEscrow",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "string" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "client", type: "address" },
          { name: "freelancer", type: "address" },
          { name: "principalAmount", type: "uint256" },
          { name: "maturesAt", type: "uint256" },
          { name: "funded", type: "bool" },
          { name: "isResolved", type: "bool" },
        ],
      },
    ],
  },
] as const

export const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

/** Converts a USD amount to the token's smallest unit (USDC_DECIMALS, default 6). */
export function usdcAmount(amountUsd: number): bigint {
  const decimals = Number(process.env.USDC_DECIMALS || "6")
  return BigInt(Math.round(amountUsd * 10 ** decimals))
}

// Source chains accepted for CROSSCHAIN_ settlement receipts.
const CROSS_CHAIN_CLIENTS: Record<number, Chain> = {
  56: bsc,
  8453: base,
  10: optimism,
  42161: arbitrum,
  137: polygon,
  43114: avalanche,
  250: fantom,
  42220: celo,
}

/** Returns a public client for a supported cross-chain settlement, or null. */
export function getCrossChainClient(chainId: number) {
  const chain = CROSS_CHAIN_CLIENTS[chainId]
  if (!chain) return null
  return createPublicClient({ chain, transport: http() })
}

/**
 * Returns the deployed YieldEscrow address, or throws if not configured.
 * Fail-closed: escrow invoices refuse to settle without ESCROW_CONTRACT.
 */
export function getEscrowAddress(): `0x${string}` {
  const address = process.env.ESCROW_CONTRACT
  if (!address || !isAddress(address)) {
    throw new PaymentError(503, "ESCROW_CONTRACT is not configured on the API")
  }
  return getAddress(address)
}

/**
 * Which invoices route through the on-chain escrow. GitHub PR invoices are the
 * documented "Autonomous GitHub Escrow" flow; milestones/splits/streams keep
 * their direct settlement path to avoid partial-release complexity.
 */
export function isEscrowInvoice(invoice: Pick<Invoice, "githubPrUrl" | "isStream" | "milestones" | "splits">): boolean {
  return !!invoice.githubPrUrl && !invoice.isStream && !invoice.milestones && !invoice.splits
}

export class PaymentError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function getPublicClient() {
  return createPublicClient({ chain: goatChain, transport: http(RPC_URL) })
}

// SECURITY (audit fix C-4): the repo's TestUSDC.sol has a public, unrestricted
// `faucet()` mint function meant for testnet only. If USDC_TOKEN is ever
// pointed at that contract (or anything with an open mint function) while
// running on GOAT mainnet, the "USDC" settled has zero economic value and
// can be minted infinitely by anyone. Require an explicit operator
// confirmation before allowing real transfers on mainnet.
export function assertProductionSafeToken() {
  const isMainnet = goatChain.id === 2345
  const confirmed = process.env.USDC_IS_REAL_MAINNET_TOKEN === "true"
  if (isMainnet && !confirmed) {
    throw new PaymentError(
      500,
      "Refusing to settle on GOAT mainnet: set USDC_IS_REAL_MAINNET_TOKEN=true only after confirming USDC_TOKEN points at the real bridged/Circle USDC contract, not a test token with a public faucet."
    )
  }
}

export function getIssuerAccount() {
  const key = process.env.PRIVATE_KEY
  if (!key || key === "0x...") return null
  return privateKeyToAccount(key as `0x${string}`)
}

/**
 * Registers an invoice with the escrow contract (owner-only) if it isn't
 * registered yet, using the actual on-chain payer as the client so placeholder
 * clients resolve to the real wallet that funded the escrow. Idempotent.
 */
export async function ensureEscrowRegistered(invoiceId: string, payer: string, freelancer: string): Promise<void> {
  const escrowAddress = getEscrowAddress()
  const account = getIssuerAccount()
  if (!account) throw new PaymentError(503, "PRIVATE_KEY is not configured for escrow registration")

  const publicClient = getPublicClient()
  const existing = await publicClient.readContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "getEscrow",
    args: [invoiceId],
  })
  if (existing.client !== "0x0000000000000000000000000000000000000000") return // already registered

  const walletClient = createWalletClient({ account, chain: goatChain, transport: http(RPC_URL) })
  try {
    const hash = await walletClient.writeContract({
      address: escrowAddress,
      abi: ESCROW_ABI,
      functionName: "registerInvoice",
      // maturesAt = 0 → immediately releasable; release is gated by the backend
      // (webhook on PR merge, or an AI verdict) calling resolve*, not by a timer.
      args: [invoiceId, getAddress(payer), getAddress(freelancer), BigInt(0)],
    })
    await publicClient.waitForTransactionReceipt({ hash })
  } catch (error) {
    // Concurrent settle raced us: if another request registered it first, the
    // contract reverts with "Already registered" — that's fine, the escrow is
    // registered. Any other revert is a real failure.
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("Already registered")) return
    throw error
  }
}

/** Confirms (owner-only) that the client's funds are locked in escrow. */
export async function confirmEscrowFunded(invoiceId: string, amountUsd: number): Promise<string> {
  const escrowAddress = getEscrowAddress()
  const account = getIssuerAccount()
  if (!account) throw new PaymentError(503, "PRIVATE_KEY is not configured for escrow confirmation")

  const publicClient = getPublicClient()
  const walletClient = createWalletClient({ account, chain: goatChain, transport: http(RPC_URL) })
  const hash = await walletClient.writeContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "confirmFunded",
    args: [invoiceId, usdcAmount(amountUsd)],
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return hash
}

/** Releases escrowed funds to the freelancer (PR merged, normal completion). */
export async function resolveEscrowOnChain(invoiceId: string): Promise<string> {
  const escrowAddress = getEscrowAddress()
  const account = getIssuerAccount()
  if (!account) throw new PaymentError(503, "PRIVATE_KEY is not configured for escrow resolution")

  const publicClient = getPublicClient()
  const walletClient = createWalletClient({ account, chain: goatChain, transport: http(RPC_URL) })
  const hash = await walletClient.writeContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "resolveEscrow",
    args: [invoiceId],
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return hash
}

/**
 * Enforces the AI arbitrator's verdict on-chain. resolution matches
 * DisputeResolution: 0 = PAY_FREELANCER, 1 = REFUND_CLIENT, 2 = SPLIT_50_50.
 */
export async function resolveDisputeOnChain(invoiceId: string, resolution: number): Promise<string> {
  const escrowAddress = getEscrowAddress()
  const account = getIssuerAccount()
  if (!account) throw new PaymentError(503, "PRIVATE_KEY is not configured for dispute resolution")

  const publicClient = getPublicClient()
  const walletClient = createWalletClient({ account, chain: goatChain, transport: http(RPC_URL) })
  const hash = await walletClient.writeContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "resolveDispute",
    args: [invoiceId, resolution],
  })
  await publicClient.waitForTransactionReceipt({ hash })
  return hash
}

export async function mintReputation(freelancer: string, amountUsd: number, multiplier: number = 1.0) {
  // We allow 0 amount for ZK Shielded Jobs, so only return if negative
  if (Math.floor(amountUsd) < 0) return

  const contractAddress = process.env.REPUTATION_CONTRACT
  if (!contractAddress || contractAddress === "0x...") {
    console.log("REPUTATION_CONTRACT address not set or invalid in .env")
    return
  }
  const account = getIssuerAccount()
  if (!account) {
    console.log("PRIVATE_KEY not set or invalid in .env")
    return
  }
  const publicClient = getPublicClient()
  const walletClient = createWalletClient({ account, chain: goatChain, transport: http(RPC_URL) })
  const hash = await walletClient.writeContract({
    address: getAddress(contractAddress),
    abi: REPUTATION_ABI,
    functionName: "recordJob",
    args: [getAddress(freelancer), BigInt(Math.round(amountUsd * multiplier))],
  })
  await publicClient.waitForTransactionReceipt({ hash })
}

export async function getReputationData(freelancer: string) {
  const contractAddress = process.env.REPUTATION_CONTRACT
  if (!contractAddress || contractAddress === "0x...") {
    return { jobsCompleted: 0, totalEarnedUsd: 0, score: 0 }
  }
  try {
    const publicClient = getPublicClient()
    const rep = await publicClient.readContract({
      address: getAddress(contractAddress),
      abi: REPUTATION_ABI,
      functionName: "getReputation",
      args: [getAddress(freelancer)],
    })
    return {
      jobsCompleted: Number(rep.jobsCompleted),
      totalEarnedUsd: Number(rep.totalEarnedUsd),
      score: Number(rep.score),
    }
  } catch (error) {
    // Reputation is an optional display feature. If the contract isn't
    // deployed yet or the RPC read fails, return zeros instead of 500ing
    // the endpoint (this previously broke /api/reputation/[address] and the
    // SVG badge generator with an unhandled readContract throw).
    console.error(`[Reputation] read failed for ${freelancer}:`, error)
    return { jobsCompleted: 0, totalEarnedUsd: 0, score: 0 }
  }
}

export function paymentRequirements(invoice: Invoice, milestoneId?: string) {
  // SECURITY (2026-07-30, mainnet audit): this used to silently fall back to
  // a hardcoded dummy token address ("0x98bb...") if USDC_TOKEN wasn't set.
  // On mainnet that is a real-money hazard: a missing/misconfigured env var
  // would silently generate live payment requests against an arbitrary
  // address instead of failing loudly. Fail closed instead.
  const usdcToken = process.env.USDC_TOKEN
  if (!usdcToken || !isAddress(usdcToken)) {
    throw new PaymentError(503, "USDC_TOKEN is not configured on the API")
  }
  
  let accepts: unknown[] = []
  // GitHub PR invoices lock funds in the on-chain escrow contract instead of
  // paying the freelancer directly. The escrow is released by the webhook the
  // moment the PR merges, or by the AI arbitrator on a dispute.
  if (isEscrowInvoice(invoice)) {
    const escrowAddress = getEscrowAddress()
    accepts = [{
      scheme: "exact",
      network: "goat",
      asset: getAddress(usdcToken),
      token: getAddress(usdcToken),
      payTo: escrowAddress,
      price: `$${invoice.amountUsd.toFixed(2)}`,
      maxAmountRequired: usdcAmount(invoice.amountUsd).toString(),
    }]
  } else if (milestoneId && invoice.milestones) {
    const ms = invoice.milestones.find(m => m.id === milestoneId)
    if (!ms) throw new PaymentError(404, "Milestone not found")
    accepts = [{
      scheme: "exact",
      network: "goat",
      asset: getAddress(usdcToken),
      token: getAddress(usdcToken),
      payTo: invoice.freelancer,
      price: `$${ms.amountUsd.toFixed(2)}`,
      maxAmountRequired: usdcAmount(ms.amountUsd).toString(),
    }]
  } else if (invoice.splits && invoice.splits.length > 0) {
    accepts = invoice.splits.map(split => ({
      scheme: "exact",
      network: "goat",
      asset: getAddress(usdcToken),
      token: getAddress(usdcToken),
      payTo: getAddress(split.address),
      price: `$${split.amountUsd.toFixed(2)}`,
      maxAmountRequired: usdcAmount(split.amountUsd).toString(),
    }))
  } else {
    // For streaming invoices, the final on-chain settlement covers exactly the
    // amount that has actually streamed so far (capped at the invoice cap).
    const settleAmount = invoice.isStream && invoice.streamedAmountUsd > 0
      ? Math.min(invoice.streamedAmountUsd, invoice.amountUsd)
      : invoice.amountUsd
    accepts = [{
      scheme: "exact",
      network: "goat",
      asset: getAddress(usdcToken),
      token: getAddress(usdcToken),
      payTo: invoice.freelancer,
      price: invoice.isPrivate ? "$0.00" : `$${settleAmount.toFixed(2)}`,
      maxAmountRequired: invoice.isPrivate ? "0" : usdcAmount(settleAmount).toString(),
    }]
  }

  return {
    x402Version: 1,
    error: "Payment required",
    accepts,
  }
}

/**
 * Verifies that a client paid the exact invoice amount into the escrow
 * contract (not to the freelancer) and returns the real payer address, which
 * is used to register the escrow. Fails closed on any mismatch.
 */
export async function verifyEscrowFunding(txHash: string, invoice: Invoice): Promise<{ payer: string }> {
  const publicClient = getPublicClient()
  const usdcToken = process.env.USDC_TOKEN
  const escrowAddress = getEscrowAddress()
  if (!usdcToken || !isAddress(usdcToken)) {
    throw new PaymentError(503, "USDC_TOKEN is not configured on the API")
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}`, timeout: 90_000 })
  if (receipt.status !== "success") throw new PaymentError(402, `Transaction reverted: ${txHash}`)
  const tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` })
  if (!tx.to || getAddress(tx.to) !== getAddress(usdcToken)) {
    throw new PaymentError(402, `Escrow payment used the wrong token in tx ${txHash}`)
  }
  const { functionName, args } = decodeFunctionData({ abi: ERC20_TRANSFER_ABI, data: tx.input })
  if (functionName !== "transfer") {
    throw new PaymentError(402, `Transaction ${txHash} is not a transfer`)
  }
  const [recipient, amount] = args as [`0x${string}`, bigint]
  if (getAddress(recipient) !== escrowAddress) {
    throw new PaymentError(402, "Escrow payment must be sent to the escrow contract")
  }
  if (amount < usdcAmount(invoice.amountUsd)) {
    throw new PaymentError(402, `Escrow payment is short: expected at least ${invoice.amountUsd} USDC`)
  }
  if (!tx.from) throw new PaymentError(402, "Could not determine the payer of the escrow transaction")
  return { payer: getAddress(tx.from) }
}

export async function verifyTransfer(txHashes: string | string[], invoice: Invoice, milestoneId?: string) {
  const publicClient = getPublicClient()
  // SECURITY (2026-07-30, mainnet audit): same dummy-token fallback hazard
  // as paymentRequirements() above - fail closed instead of silently
  // verifying transfers against an arbitrary fallback address.
  const usdcToken = process.env.USDC_TOKEN
  if (!usdcToken || !isAddress(usdcToken)) {
    throw new PaymentError(503, "USDC_TOKEN is not configured on the API")
  }
  
  const hashes = Array.isArray(txHashes) ? txHashes : txHashes.split(",").map(h => h.trim())
  
  // We need to match each expected split (or single payment) to a tx hash
  let expectedPayments = []
  
  if (milestoneId && invoice.milestones) {
    const ms = invoice.milestones.find(m => m.id === milestoneId)
    if (!ms) throw new PaymentError(404, "Milestone not found")
    expectedPayments = [{ recipient: getAddress(invoice.freelancer), amount: usdcAmount(ms.amountUsd), matched: false }]
  } else if (invoice.splits && invoice.splits.length > 0) {
    expectedPayments = invoice.splits.map(s => ({ recipient: getAddress(s.address), amount: usdcAmount(s.amountUsd), matched: false }))
  } else {
    const settleAmount = invoice.isStream && invoice.streamedAmountUsd > 0
      ? Math.min(invoice.streamedAmountUsd, invoice.amountUsd)
      : invoice.amountUsd
    expectedPayments = [{ recipient: getAddress(invoice.freelancer), amount: usdcAmount(settleAmount), matched: false }]
  }
    
  if (hashes.length < expectedPayments.length) {
    throw new PaymentError(402, `Expected ${expectedPayments.length} transactions, but got ${hashes.length}`)
  }

  try {
    for (const hash of hashes) {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: hash as `0x${string}`,
        timeout: 90_000,
      })
      if (receipt.status !== "success") throw new PaymentError(402, `Transaction reverted: ${hash}`)
      const tx = await publicClient.getTransaction({ hash: hash as `0x${string}` })
      if (!tx.to || getAddress(tx.to) !== getAddress(usdcToken)) {
        throw new PaymentError(402, `Payment used the wrong token in tx ${hash}`)
      }
      const { functionName, args } = decodeFunctionData({ abi: ERC20_TRANSFER_ABI, data: tx.input })
      if (functionName !== "transfer") {
        throw new PaymentError(402, `Transaction ${hash} is not a transfer`)
      }
      const [recipient, amount] = args as [`0x${string}`, bigint]
      
      // Match this tx against expected payments
      const match = expectedPayments.find(p => !p.matched && p.recipient === getAddress(recipient) && amount >= p.amount)
      if (!match) {
        throw new PaymentError(402, `Transaction ${hash} does not match any pending invoice splits (recipient or amount mismatch)`)
      }
      match.matched = true
    }
    
    const unmatched = expectedPayments.filter(p => !p.matched)
    if (unmatched.length > 0) {
      throw new PaymentError(402, `Not all splits were paid. Missing payment for ${unmatched[0].recipient}`)
    }
    
    return true
  } catch (error) {
    if (error instanceof PaymentError) throw error
    throw new PaymentError(402, `Could not verify transaction: ${error instanceof Error ? error.message : String(error)}`)
  }
}
