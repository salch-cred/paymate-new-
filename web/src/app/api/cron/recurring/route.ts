import { getSql, createInvoice } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // In production, verify the cron secret
  // const authHeader = request.headers.get('authorization');
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new Response('Unauthorized', { status: 401 });
  // }

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

    for (const row of (rows as any)) {
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
