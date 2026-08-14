import { NextResponse } from "next/server"
import { authenticateApiKey } from "@/lib/apikey"
import { listInvoicesByApiKey } from "@/lib/db"

/** GET /api/merchant/checkouts?limit=50 — the merchant's checkout history. */
export async function GET(request: Request) {
  const key = await authenticateApiKey(request)
  if (key instanceof NextResponse || key instanceof Response) return key

  try {
    const url = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1), 100)
    const invoices = await listInvoicesByApiKey(key.id, limit)
    const base = (process.env.API_BASE || "https://paymateagent.xyz").replace(/\/$/, "")
    return NextResponse.json({
      ok: true,
      checkouts: invoices.map((inv) => ({
        checkoutId: inv.id,
        orderId: inv.merchantOrderId,
        title: inv.title,
        amountUsd: inv.amountUsd,
        status: inv.status,
        txHash: inv.txHash,
        createdAt: inv.createdAt,
        paidAt: inv.paidAt,
        payUrl: `${base}/pay/${inv.id}`,
      })),
    })
  } catch (error) {
    console.error("Merchant checkouts error:", error)
    return NextResponse.json({ detail: "Failed to list checkouts" }, { status: 500 })
  }
}
