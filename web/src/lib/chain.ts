import { createPublicClient, createWalletClient, http, getAddress, isAddress, decodeFunctionData, defineChain } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import type { Invoice } from "./db"

export const goatTestnet3 = defineChain({
  id: 48816,
  name: "GOAT Testnet3",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet3.goat.network"] } },
  blockExplorers: { default: { name: "GOAT Explorer", url: "https://explorer.testnet3.goat.network" } },
  testnet: true,
})

const RPC_URL = process.env.RPC_GOAT_TESTNET || goatTestnet3.rpcUrls.default.http[0]

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

const ERC20_TRANSFER_ABI = [
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

export class PaymentError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function getPublicClient() {
  return createPublicClient({ chain: goatTestnet3, transport: http(RPC_URL) })
}

export function getIssuerAccount() {
  const key = process.env.PRIVATE_KEY
  if (!key || key === "0x...") return null
  return privateKeyToAccount(key as `0x${string}`)
}

export async function mintReputation(freelancer: string, amountUsd: number, multiplier: number = 1.0) {
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
  const walletClient = createWalletClient({ account, chain: goatTestnet3, transport: http(RPC_URL) })
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
}

export function paymentRequirements(invoice: Invoice) {
  const usdcToken = process.env.USDC_TOKEN || "0x98bbd436cd9320e6f30444ddfc6390141f23899f" // Fallback to a dummy token for testing if not set
  if (!usdcToken || !isAddress(usdcToken)) {
    throw new PaymentError(503, "USDC_TOKEN is not configured on the API")
  }
  const decimals = Number(process.env.USDC_DECIMALS || "6")
  
  let accepts = []
  if (invoice.splits && invoice.splits.length > 0) {
    accepts = invoice.splits.map(split => ({
      scheme: "exact",
      network: "goat-testnet3",
      asset: getAddress(usdcToken),
      token: getAddress(usdcToken),
      payTo: getAddress(split.address),
      price: `$${split.amountUsd.toFixed(2)}`,
      maxAmountRequired: String(Math.round(split.amountUsd * 10 ** decimals)),
    }))
  } else {
    accepts = [{
      scheme: "exact",
      network: "goat-testnet3",
      asset: getAddress(usdcToken),
      token: getAddress(usdcToken),
      payTo: invoice.freelancer,
      price: `$${invoice.amountUsd.toFixed(2)}`,
      maxAmountRequired: String(Math.round(invoice.amountUsd * 10 ** decimals)),
    }]
  }

  return {
    x402Version: 1,
    error: "Payment required",
    accepts,
  }
}

export async function verifyTransfer(txHashes: string | string[], invoice: Invoice) {
  const publicClient = getPublicClient()
  const usdcToken = process.env.USDC_TOKEN || "0x98bbd436cd9320e6f30444ddfc6390141f23899f"
  const decimals = Number(process.env.USDC_DECIMALS || "6")
  
  const hashes = Array.isArray(txHashes) ? txHashes : txHashes.split(",").map(h => h.trim())
  
  // We need to match each expected split (or single payment) to a tx hash
  const expectedPayments = invoice.splits && invoice.splits.length > 0 
    ? invoice.splits.map(s => ({ recipient: getAddress(s.address), amount: BigInt(Math.round(s.amountUsd * 10 ** decimals)), matched: false }))
    : [{ recipient: getAddress(invoice.freelancer), amount: BigInt(Math.round(invoice.amountUsd * 10 ** decimals)), matched: false }]
    
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
