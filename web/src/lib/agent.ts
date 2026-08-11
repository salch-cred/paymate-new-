import { createWalletClient, http, getAddress } from "viem"
import { getPublicClient, goatChain, getIssuerAccount, assertProductionSafeToken, ERC20_TRANSFER_ABI, usdcAmount } from "./chain"
import { verifyInvoiceSignature } from "./eip712"
import { analyzeInvoiceFraud } from "./sybilGuard"
import type { Invoice } from "./db"

export async function autonomousAgentPay(invoice: Invoice): Promise<string> {
  assertProductionSafeToken()

  const account = getIssuerAccount()
  if (!account) {
    throw new Error("Agent identity (PRIVATE_KEY) not configured.")
  }

  // 1. EIP-712 Safety Proof Verification
  // SECURITY (audit fix, 2026-08-11): the signature must be from the CLIENT
  // (the payer) — the party authorizing the money movement — never the
  // freelancer (payee). A freelancer can always self-sign their own invoice,
  // so verifying against the payee would let anyone drain the agent wallet.
  // This mirrors the fixed /api/clawup/intent route (same signer model).
  if (!invoice.signature) {
    throw new Error("SECURITY FAULT: Invoice is missing EIP-712 safety proof signature. Aborting payout.")
  }
  const isSignatureValid = await verifyInvoiceSignature(
    invoice.freelancer,
    invoice.client,
    invoice.amountUsd,
    invoice.signature as `0x${string}`,
    invoice.client // expected signer is the PAYER (authorizes the spend)
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
  const walletClient = createWalletClient({ account, chain: goatChain, transport: http() })

  const amountToTransfer = usdcAmount(invoice.amountUsd)

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
