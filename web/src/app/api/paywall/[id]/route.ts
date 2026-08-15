import { createHash } from "crypto"
import { getInvoice, markPaid, addTreasuryRevenue, computePaymateFee } from "@/lib/db"
import { verifyTransfer, mintReputation, PaymentError } from "@/lib/chain"
import { createDeliveryReceipt, type DeliveryReceipt } from "@/lib/receipt"
import { paywallChallengeResponse, extractTxHash, PAYMENT_RESPONSE_HEADER } from "@/lib/paywall"
import type { Invoice } from "@/lib/db"

/**
 * Pay-to-Unlock Paywall — the x402 guard for a real persisted paywall.
 *
 * `GET /api/paywall/[id]`
 *   → HTTP 402 + `PAYMENT-REQUIRED` header + x402 `accepts[]` body (the
 *     deliverable content is NEVER sent on this path).
 *
 * `GET /api/paywall/[id]` with `PAYMENT-SIGNATURE: base64({"txHash":"0x..."})`
 *   → verifies the transfer on-chain, marks the invoice paid (1% treasury fee,
 *     ERC-8004 reputation mint) and returns the stored deliverable content
 *     (invoices.paywall_content) + a signed Delivery Receipt (evidence chain).
 *
 * Already-paid invoices unlock without a new signature — the buyer keeps the
 * same content and receipt keyed to the original tx.
 */
function deliverableHash(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

function unlockedResponse(invoice: Invoice, txHash: string | null): Response {
  // Evidence-chain receipt: signed only when a secret is configured (fail
  // closed — an explicitly unsigned receipt is better than a forgeable one).
  let receipt: DeliveryReceipt | null = null
  if (txHash) {
    try {
      receipt = createDeliveryReceipt({
        invoiceId: invoice.id,
        amountUsd: invoice.amountUsd,
        freelancer: invoice.freelancer,
        client: invoice.client,
        txHash,
        deliverableHash: deliverableHash(invoice.paywallContent || invoice.description),
        timestamp: Date.now(),
        network: "goat",
      })
    } catch (e) {
      console.error(`[Paywall] Receipt signing skipped (no secret configured):`, e)
    }
  }
  return Response.json(
    {
      unlocked: true,
      invoiceId: invoice.id,
      txHash,
      explorerUrl: txHash ? `https://explorer.goat.network/tx/${txHash}` : null,
      receipt,
      deliverable: invoice.paywallContent || invoice.description,
      title: invoice.title,
      message: txHash
        ? "Payment verified on-chain. Content unlocked."
        : "Content unlocked (previously paid).",
    },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // x402: server confirms settlement in the response headers.
        [PAYMENT_RESPONSE_HEADER]: Buffer.from(
          JSON.stringify({ ok: true, network: "goat", txHash })
        ).toString("base64"),
      },
    }
  )
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const invoice = await getInvoice(id)
    if (!invoice) {
      return Response.json({ detail: "Paywall not found" }, { status: 404 })
    }

    // --- Unlock path: a paid client retries with a payment signature. ---
    const txHash = extractTxHash(request)
    if (txHash) {
      if (invoice.status === "paid") {
        return unlockedResponse(invoice, invoice.txHash || txHash)
      }
      // Real on-chain verification — identical to the settlement route.
      await verifyTransfer(txHash, invoice)
      const updated = await markPaid(invoice.id, txHash)
      if (!updated) {
        return Response.json(
          { detail: "This transaction has already been used, or the invoice is no longer pending." },
          { status: 402 }
        )
      }
      // 💰 Treasury + reputation: the paywall generates real economic activity.
      try {
        await addTreasuryRevenue(computePaymateFee(updated.amountUsd))
      } catch (e) {
        console.error(`[Paywall] Treasury fee failed:`, e)
      }
      try {
        await mintReputation(updated.freelancer, updated.amountUsd)
      } catch (e) {
        console.log(`[Paywall] Reputation mint failed:`, e)
      }
      return unlockedResponse(updated, txHash)
    }

    // --- Challenge path: 402 + PAYMENT-REQUIRED. Content stays locked. ---
    return paywallChallengeResponse(invoice, {
      invoiceId: invoice.id,
      payUrl: `https://paymateagent.xyz/pay/${invoice.id}`,
    })
  } catch (error) {
    if (error instanceof PaymentError) {
      return Response.json({ detail: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`[Paywall] Failed:`, error)
    return Response.json({ detail: message }, { status: 500 })
  }
}
