import { getSql, createInvoice } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // SECURITY: this endpoint mutates the database (creates new invoices) and
  // MUST be authenticated, otherwise anyone on the internet can spam-generate
  // duplicate recurring invoices. Require a CRON_SECRET at all times.
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error("[cron/recurring] CRON_SECRET is not configured. Refusing to run.");
    return new Response('Server misconfigured: CRON_SECRET not set', { status: 500 });
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const sql = getSql();
    
    // Find all paid invoices that are recurring and were created more than X time ago.
    // For a hackathon demo, we will just select all recurring invoices 
    // and duplicate them to show the engine works.
    
    const rows = await sql`
      SELECT * FROM invoices 
      WHERE recurring IS NOT NULL AND status = 'paid'
      ORDER BY created_at DESC LIMIT 100
    `;

    const generated = [];

    interface RecurringInvoiceRow {
      freelancer: string
      client: string
      title: string
      description: string
      amount_usd: number | string
      webhook_url: string | null
      splits: string | null
      recurring: "weekly" | "monthly" | null
    }

    for (const row of (rows as RecurringInvoiceRow[])) {
      // Check if we already generated a recurring invoice for this one recently
      // To prevent infinite loops in demo, we'd normally check timestamp.
      // For this implementation, we just generate a new pending draft.
      
      const newInvoice = await createInvoice({
        freelancer: row.freelancer,
        client: row.client,
        title: `[Retainer] ${row.title}`,
        description: `Recurring retainer payment for: ${row.description}`,
        amountUsd: Number(row.amount_usd),
        webhookUrl: row.webhook_url,
        splits: row.splits ? JSON.parse(row.splits) : null,
        recurring: row.recurring
      });
      
      generated.push(newInvoice.id);
    }

    return NextResponse.json({ ok: true, generatedInvoices: generated.length, ids: generated });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
