import { isAddress, getAddress } from "viem"
import { createInvoice } from "@/lib/db"
import { paymentRequirements, PaymentError } from "@/lib/chain"
import { OPEN_CLIENT_ADDRESS } from "@/lib/constants"

/**
 * Pay-to-Unlock Paywall — creation.
 *
 * `POST /api/paywall`  { title, content, amountUsd, freelancerWallet, clientWallet? }
 *   → creates a REAL paywalled invoice: the deliverable content is persisted
 *     in the database (invoices.paywall_content) and the invoice is ready for
 *     the x402 handshake at `GET /api/paywall/[id]`.
 *
 * The content is only ever served back after the USDC payment on GOAT Mainnet
 * has been verified on-chain. The response carries the shareable page URL,
 * the standard PayMate checkout URL, and the x402 accepts[] quote.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) return Response.json({ detail: "Invalid request body" }, { status: 422 })

    const { title, content, description, amountUsd, freelancerWallet, clientWallet } = body

    if (typeof title !== "string" || title.trim().length < 2 || title.length > 120) {
      return Response.json({ detail: "title must be between 2 and 120 characters" }, { status: 422 })
    }
    if (typeof content !== "string" || content.trim().length < 1 || content.length > 50_000) {
      return Response.json({ detail: "content must be between 1 and 50000 characters" }, { status: 422 })
    }
    if (typeof freelancerWallet !== "string" || !isAddress(freelancerWallet)) {
      return Response.json({ detail: "freelancerWallet must be a valid wallet address" }, { status: 422 })
    }
    if (clientWallet !== undefined && clientWallet !== null && typeof clientWallet === "string" && !isAddress(clientWallet)) {
      return Response.json({ detail: "clientWallet must be a valid wallet address" }, { status: 422 })
    }
    const amount = Number(amountUsd)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
      return Response.json({ detail: "amountUsd must be a positive number" }, { status: 422 })
    }

    const invoice = await createInvoice({
      freelancer: getAddress(freelancerWallet),
      client: clientWallet ? getAddress(clientWallet) : OPEN_CLIENT_ADDRESS,
      title: title.trim(),
      description: (description?.trim?.() || `Pay-to-unlock: ${title.trim()}`).slice(0, 4000),
      amountUsd: amount,
      webhookUrl: "paywall",
      paywallContent: content,
    })

    // Fail closed if the payment rail isn't configured (USDC_TOKEN missing).
    const requirements = paymentRequirements(invoice)

    return Response.json(
      {
        ok: true,
        invoiceId: invoice.id,
        pageUrl: `/paywall/${invoice.id}`,
        payUrl: `/pay/${invoice.id}`,
        accepts: requirements.accepts,
        unlockInstructions:
          "Share the pageUrl. Buyers request it, receive HTTP 402 + PAYMENT-REQUIRED, pay the quoted USDC on GOAT Network, then retry with the PAYMENT-SIGNATURE header to unlock.",
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof PaymentError) {
      return Response.json({ detail: error.message }, { status: error.status })
    }
    console.error("Paywall create failed:", error)
    return Response.json({ detail: "Failed to create paywalled invoice" }, { status: 500 })
  }
}
