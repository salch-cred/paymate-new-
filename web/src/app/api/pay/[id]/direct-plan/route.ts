import { getInvoice, upsertDirectPlan } from "@/lib/db"
import { planBscDirectPayment } from "@/lib/directPay"
import { PaymentError } from "@/lib/chain"

export const dynamic = "force-dynamic"

/**
 * Direct-to-freelancer rail — plan step.
 *
 *   POST /api/pay/[id]/direct-plan   body: { payer: "0x…" }
 *
 * Returns the read-only plan the client's wallet signs (swap → approve →
 * bridge send straight to the freelancer on GOAT). Nothing moves here — it is
 * quotes + calldata only. The client executes the steps in their wallet, then
 * calls /api/pay/[id]/direct-verify with the bridge tx hash.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await getInvoice(id)
  if (!invoice) return Response.json({ detail: "Invoice not found" }, { status: 404 })

  const body = await request.json().catch(() => null)
  const payer = typeof body?.payer === "string" ? body.payer : ""

  try {
    const plan = await planBscDirectPayment(invoice, payer)
    // SECURITY: lock the exact expected DOGEB at plan time so verify can
    // require the full amount (no price-drift underpayment vector).
    await upsertDirectPlan(invoice.id, plan.principalDogeRaw, String(plan.dogeUsdPrice))
    return Response.json({ ok: true, plan })
  } catch (error) {
    if (error instanceof PaymentError) {
      return Response.json({ detail: error.message }, { status: error.status })
    }
    console.error(`[direct-plan] failed for ${id}:`, error)
    return Response.json({ detail: "Could not build the direct payment plan." }, { status: 500 })
  }
}
