import { getInvoiceByGithubPrUrl, markPaid, addTreasuryRevenue } from "@/lib/db"
import { createWalletClient, createPublicClient, http, getAddress, parseUnits, parseAbi } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { goatChain } from "@/lib/chain"

const RPC_URL = process.env.RPC_GOAT_MAINNET || goatChain.rpcUrls.default.http[0]
const usdcToken = process.env.USDC_TOKEN

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

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    
    // We only care about PRs that are closed AND merged
    if (payload.action === "closed" && payload.pull_request?.merged === true) {
      const prUrl = payload.pull_request.html_url
      console.log(`[GitHub Webhook] PR Merged: ${prUrl}`)

      // 1. Find an invoice linked to this exact PR
      const invoice = await getInvoiceByGithubPrUrl(prUrl)
      if (!invoice) {
        return Response.json({ status: "ignored", detail: "No pending invoice found for this PR" })
      }

      console.log(`[GitHub Webhook] Found linked invoice: ${invoice.id}. Executing autonomous payout!`)

      // 2. We use the DevOps Escrow wallet to pay the freelancer on GOAT network
      if (!usdcToken) throw new Error("USDC_TOKEN not configured")
      const adminKey = process.env.ADMIN_PRIVATE_KEY
      if (!adminKey) throw new Error("ADMIN_PRIVATE_KEY not configured for DevOps Escrow")
      
      const account = privateKeyToAccount(`0x${adminKey}`)
      const publicClient = createPublicClient({ chain: goatChain, transport: http(RPC_URL) })
      const walletClient = createWalletClient({ account, chain: goatChain, transport: http(RPC_URL) })

      // 3. Execute the transfer autonomously
      const decimals = Number(process.env.USDC_DECIMALS || "6")
      let txHash: `0x${string}` | "" = "";

      if (invoice.isSwarm && invoice.swarmWallets && invoice.swarmWallets.length > 0) {
        console.log(`[GitHub Webhook] Executing Swarm Payout to ${invoice.swarmWallets.length} agents...`)
        
        for (const agent of invoice.swarmWallets) {
          const splitAmountUsd = invoice.amountUsd * agent.share;
          const amountToPay = parseUnits(splitAmountUsd.toString(), decimals)
          
          txHash = await walletClient.writeContract({
            address: getAddress(usdcToken),
            abi: ERC20_TRANSFER_ABI,
            functionName: "transfer",
            args: [getAddress(agent.address), amountToPay]
          })
          
          if (txHash) {
            await publicClient.waitForTransactionReceipt({ hash: txHash })
          }
          console.log(`[GitHub Webhook] Swarm split payout successful to ${agent.address}: ${txHash}`)
        }
      } else {
        const amountToPay = parseUnits(invoice.amountUsd.toString(), decimals)
        
        txHash = await walletClient.writeContract({
          address: getAddress(usdcToken),
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [getAddress(invoice.freelancer), amountToPay]
        })

        // Wait for it to confirm
        if (txHash) {
          await publicClient.waitForTransactionReceipt({ hash: txHash })
        }
        console.log(`[GitHub Webhook] Autonomous payout successful: ${txHash}`)
      }

      // 💰 The Neural Treasury: Siphon 1% of the settlement amount
      try {
        const fee = invoice.amountUsd * 0.01;
        await addTreasuryRevenue(fee);
        console.log(`[Neural Treasury] Autonomous Webhook Fee Captured: $${fee}`);
      } catch (e) {
        console.error(`[Neural Treasury] Error adding fee:`, e);
      }

      // 4. Mark as paid
      const receiptHash = "auto-github-escrow-" + txHash.substring(0, 10)
      const updated = await markPaid(invoice.id, txHash, receiptHash)

      // Post to Discord
      if (process.env.DISCORD_WEBHOOK_URL && updated) {
        fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `🤖 **AUTONOMOUS PAYOUT EXECUTED**\nGitHub PR merged: ${prUrl}\nPayMate automatically settled a $${invoice.amountUsd} USDC invoice to the agent!\n[View TX on GOAT](https://explorer.goat.network/tx/${txHash})`,
          })
        }).catch(() => null)
      }

      return Response.json({ status: "success", txHash, invoiceId: invoice.id })
    }

    return Response.json({ status: "ignored" })
  } catch (error) {
    console.error("[GitHub Webhook Error]", error)
    return Response.json({ error: "Internal error" }, { status: 500 })
  }
}
