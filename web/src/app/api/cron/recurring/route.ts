import { getSql, createInvoice, getLatestRetainer } from "@/lib/db"
import { requireBearerAuth } from "@/lib/auth"
import { NextResponse } from "next/server"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MONTH_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Recurring retainer engine.
 *
 * A retainer chain is rooted at a user-created invoice with `recurring` set
 * ("weekly" | "monthly"). Every cron run checks the most recent invoice in each
 * chain: if it was created more than one period ago (and was paid), a new
 * retainer invoice is generated. Chains never duplicate — a run that already
 * created today's retainer simply finds it as the latest and skips.
 */
export async function GET(request: Request) {
  // SECURITY: this endpoint mutates the database (creates new invoices) and
  // MUST be authenticated, otherwise anyone on the internet can spam-generate
  // duplicate recurring invoices. Require a CRON_SECRET at all times.
  if (!process.env.CRON_SECRET) {
    console.error("[cron/recurring] CRON_SECRET is not configured. Refusing to run.")
  }
  const unauthorized = requireBearerAuth(request, process.env.CRON_SECRET)
  if (unauthorized) return unauthorized

  try {
    const sql = getSql()

    // Root retainers: user-created invoices that opted into a schedule
    // (recurring IS NOT NULL, no parent — cron-generated copies carry the root id).
    const rows = await sql`
      SELECT DISTINCT ON (COALESCE(recurring_parent_id, id)) id, recurring_parent_id, recurring
      FROM invoices
      WHERE recurring IS NOT NULL AND status = 'paid'
      ORDER BY COALESCE(recurring_parent_id, id), created_at DESC
    ` as unknown as { id: string; recurring_parent_id: string | null; recurring: "weekly" | "monthly" }[]

    const now = Date.now()
    const generated: string[] = []

    for (const row of rows) {
      const chainRootId = row.recurring_parent_id || row.id
      const period = row.recurring === "monthly" ? MONTH_MS : WEEK_MS

      // The most recent invoice in this chain — if it was created within the
      // period (or is still pending), the next retainer is not due yet.
      const latest = await getLatestRetainer(chainRootId)
      if (!latest) continue
      if (latest.status !== "paid") continue
      if (now - latest.createdAt < period) continue

      // Due: create the next retainer, linked to the chain root so it can never
      // be re-created by a later run.
      const newInvoice = await createInvoice({
        freelancer: latest.freelancer,
        client: latest.client,
        title: `[Retainer] ${latest.title.replace(/^\[Retainer\]\s*/, "")}`,
        description: `Recurring retainer payment for: ${latest.description}`,
        amountUsd: latest.amountUsd,
        dueDate: new Date(now + period).toISOString(),
        webhookUrl: latest.webhookUrl,
        splits: latest.splits,
        recurring: latest.recurring,
        recurringParentId: chainRootId,
      })

      generated.push(newInvoice.id)
    }

    return NextResponse.json({ ok: true, generatedInvoices: generated.length, ids: generated })
  } catch (error) {
    console.error("Cron Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
