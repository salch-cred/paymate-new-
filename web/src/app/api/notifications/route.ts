import { NextRequest, NextResponse } from "next/server"
import { listInvoices } from "@/lib/db"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get("address")
  
  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 })
  }

  try {
    const invoices = await listInvoices(address, 20)
    const events = []
    
    for (const inv of invoices) {
      // Created event
      events.push({
        id: `${inv.id}-created`,
        icon: 'invoice',
        title: 'New invoice created',
        message: inv.title,
        timestamp: inv.createdAt,
        isRead: false
      })
      
      if (inv.status === 'paid' && inv.paidAt) {
        events.push({
          id: `${inv.id}-paid`,
          icon: 'check',
          title: 'Invoice paid!',
          message: inv.title,
          timestamp: inv.paidAt,
          isRead: false
        })
      }
      
      if (inv.status === 'cancelled') {
        // (audit fix 2026-08-13) use the real cancellation timestamp now
        // tracked on the invoice, instead of fabricating createdAt + 1000.
        events.push({
          id: `${inv.id}-cancelled`,
          icon: 'close',
          title: 'Invoice cancelled',
          message: inv.title,
          timestamp: inv.cancelledAt ?? inv.createdAt,
          isRead: false
        })
      }
    }
    
    events.sort((a, b) => b.timestamp - a.timestamp)
    const recent = events.slice(0, 10)
    
    return NextResponse.json(recent)
  } catch (error) {
    console.error("Notifications API error:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}
