import { createWalletClient, http, getAddress } from "viem"
import { getPublicClient, goatTestnet3, PaymentError, getIssuerAccount } from "./chain"
import { verifyInvoiceSignature } from "./eip712"
import { analyzeInvoiceFraud } from "./sybilGuard"
import type { Invoice } from "./db"

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

export async function autonomousAgentPay(invoice: Invoice): Promise<string> {
  const account = getIssuerAccount()
  if (!account) {
    throw new Error("Agent identity (PRIVATE_KEY) not configured.")
  }

  // 1. EIP-712 Safety Proof Verification
  if (!invoice.signature) {
    throw new Error("SECURITY FAULT: Invoice is missing EIP-712 safety proof signature. Aborting payout.")
  }
  const isSignatureValid = await verifyInvoiceSignature(
    invoice.freelancer,
    invoice.client,
    invoice.amountUsd,
    invoice.signature as `0x${string}`,
    invoice.freelancer // We expect the freelancer to have signed it
  )

  if (!isSignatureValid) {
    throw new Error("SECURITY FAULT: Invalid EIP-712 signature. Possible tampering detected.")
  }

  // 2. Define our agent's risk policy / budget
  const MAX_AUTO_PAY = 5000 // USDC
  if (invoice.amountUsd > MAX_AUTO_PAY) {
    throw new Error(`Amount ${invoice.amountUsd} exceeds the agent's autonomous policy limit of ${MAX_AUTO_PAY}. Manual intervention required.`)
  }

  // 3. AI Sybil-Guard (Fraud & Wash-Trading Prevention)
  const sybilAnalysis = await analyzeInvoiceFraud(
    invoice.freelancer,
    invoice.client,
    invoice.title,
    invoice.description,
    invoice.amountUsd
  )

  if (sybilAnalysis.isFraud) {
    console.error(`[SYBIL-GUARD] Fraud detected! Probability: ${sybilAnalysis.probability}%. Reason: ${sybilAnalysis.reasoning}`)
    throw new Error(`SECURITY FAULT: AI Sybil-Guard blocked transaction. Reason: ${sybilAnalysis.reasoning}`)
  }

  const usdcToken = process.env.USDC_TOKEN
  if (!usdcToken) {
    throw new Error("USDC_TOKEN not configured.")
  }

  const publicClient = getPublicClient()
  const walletClient = createWalletClient({ account, chain: goatTestnet3, transport: http() })

  const decimals = Number(process.env.USDC_DECIMALS || "6")
  const amountToTransfer = BigInt(Math.round(invoice.amountUsd * 10 ** decimals))

  console.log(`[AGENT] Autonomous payment approved. Sending ${invoice.amountUsd} USDC to ${invoice.freelancer}...`)
  
  const hash = await walletClient.writeContract({
    address: getAddress(usdcToken),
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [getAddress(invoice.freelancer), amountToTransfer],
  })

  // Wait for the transaction to be mined
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status !== "success") {
    throw new Error("Agent transaction reverted on-chain.")
  }

  console.log(`[AGENT] Payment successful. Tx: ${hash}`)
  return hash
}
