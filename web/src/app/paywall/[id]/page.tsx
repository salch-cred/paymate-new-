import { redirect } from "next/navigation"

/**
 * Shareable paywall link. `POST /api/paywall` and `POST /api/agent/paywall`
 * return `pageUrl: /paywall/<invoiceId>` — this page resolves that link to the
 * real PayMate checkout so buyers land on a working payment page (wallet pay +
 * on-chain verification). After paying, the buyer unlocks the deliverable via
 * `GET /api/paywall/<id>` with the PAYMENT-SIGNATURE header (see /docs#paywall).
 */
export default async function PaywallSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/pay/${id}`)
}
