import { getInvoiceByGithubPrUrl, markPaid, markEscrowPaid, addTreasuryRevenue } from "@/lib/db"
import { createWalletClient, http, getAddress } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { goatChain, ERC20_TRANSFER_ABI, getPublicClient, usdcAmount, resolveEscrowOnChain, isEscrowInvoice, mintReputation, PaymentError } from "@/lib/chain"
import { verifyHmacSignature } from "@/lib/auth"

const RPC_URL = process.env.RPC_GOAT_MAINNET || goatChain.rpcUrls.default.http[0]
const usdcToken = process.env.USDC_TOKEN

export async function POST(request: Request) {
  try {
    // SECURITY: this endpoint RELEASES escrowed USDC on-chain and can pay from
    // the DevOps wallet. It MUST verify GitHub's HMAC signature, exactly like
    // the sibling /api/github/webhook route (audit fix H-2) — otherwise anyone
    // who knows a pending PR invoice's URL can forge a "PR merged" event and
    // drain the escrow / wallet.
    const secret = process.env.GITHUB_WEBHOOK_SECRET
    const rawBody = await request.text()
    if (!secret) {
      console.error("[webhooks/github] GITHUB_WEBHOOK_SECRET is not configured. Refusing request.")
      return Response.json({ error: "Server misconfigured" }, { status: 500 })
    }
    if (!verifyHmacSignature({ rawBody, secret, signature: request.headers.get("x-hub-signature-256"), sigPrefix: "sha256=" })) {
      return Response.json({ error: "Invalid signature" }, { status: 401 })
    }
    const payload = JSON.parse(rawBody)
    
    // We only care about PRs that are closed AND merged
    if (payload.action === "closed" && payload.pull_request?.merged === true) {
      const prUrl = payload.pull_request.html_url
      console.log(`[GitHub Webhook] PR Merged: ${prUrl}`)

      // 1. Find an invoice linked to this exact PR
      const invoice = await getInvoiceByGithubPrUrl(prUrl)
      if (!invoice) {
        return Response.json({ status: "ignored", detail: "No pending invoice found for this PR" })
      }

      // 2. Autonomous GitHub Escrow: if the client already funded the on-chain
      // escrow, release the locked USDC to the freelancer the moment the PR
      // merges. This is the real escrow flow — the client's money moves, not
      // PayMate's own wallet.
      if (isEscrowInvoice(invoice) && invoice.escrowStatus === "funded") {
        console.log(`[GitHub Webhook] Releasing escrowed funds for invoice ${invoice.id}`)
        let releaseHash: string
        try {
          releaseHash = await resolveEscrowOnChain(invoice.id)
        } catch (error) {
          if (error instanceof PaymentError) {
            console.error(`[GitHub Webhook] Escrow release failed: ${error.message}`)
            return Response.json({ status: "error", detail: error.message }, { status: 500 })
          }
          throw error
        }

        // 💰 The Neural Treasury: Siphon 1% of the settlement amount
        try {
          const fee = invoice.amountUsd * 0.01;
          await addTreasuryRevenue(fee);
          console.log(`[Neural Treasury] Escrow Release Fee Captured: $${fee}`);
        } catch (e) {
          console.error(`[Neural Treasury] Error adding fee:`, e);
        }

        const updated = await markEscrowPaid(invoice.id, releaseHash, invoice.escrowTxHash || releaseHash)

        // Same reward path as the direct settle route: the freelancer earns
        // their portable ERC-8004 reputation record for the completed job.
        if (updated) {
          try {
            await mintReputation(invoice.freelancer, invoice.isPrivate ? 0 : invoice.amountUsd, 1.0)
          } catch (error) {
            console.log(`Reputation recording queued/failed: ${error}`)
          }
        }

        // Post to Discord
        if (process.env.DISCORD_WEBHOOK_URL && updated) {
          fetch(process.env.DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: `🤖 **ESCROW RELEASED ON MERGE**\nGitHub PR merged: ${prUrl}\nPayMate released a locked $${invoice.amountUsd} USDC escrow to the freelancer!\n[View TX on GOAT](https://explorer.goat.network/tx/${releaseHash})`,
            })
          }).catch(() => null)
        }

        return Response.json({ status: "success", releaseTxHash: releaseHash, invoiceId: invoice.id, escrow: "resolved" })
      }

      // 3. Legacy fallback (non-escrow invoices, or escrow invoices that were
      // created before escrow was configured): the DevOps Escrow wallet pays
      // the freelancer directly.
      if (!usdcToken) throw new Error("USDC_TOKEN not configured")
      const adminKey = process.env.ADMIN_PRIVATE_KEY
      if (!adminKey) throw new Error("ADMIN_PRIVATE_KEY not configured for DevOps Escrow")
      
      const account = privateKeyToAccount(`0x${adminKey}`)
      const publicClient = getPublicClient()
      const walletClient = createWalletClient({ account, chain: goatChain, transport: http(RPC_URL) })

      // Execute the transfer autonomously
      let txHash: `0x${string}` | "" = "";

      if (invoice.isSwarm && invoice.swarmWallets && invoice.swarmWallets.length > 0) {
        console.log(`[GitHub Webhook] Executing Swarm Payout to ${invoice.swarmWallets.length} agents...`)
        
        for (const agent of invoice.swarmWallets) {
          const splitAmountUsd = invoice.amountUsd * agent.share;
          const amountToPay = usdcAmount(splitAmountUsd)
          
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
        const amountToPay = usdcAmount(invoice.amountUsd)
        
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
