"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Icon } from "@/components/icons"

interface GrowthStats {
  totalInvoices: number
  paidInvoices: number
  pendingInvoices: number
  settlementRate: number
  totalVolumeSettled: number
  outstandingVolume: number
  uniqueFreelancers: number
  uniqueClients: number
  feedbackCount: number
  averageRating: number
  feedbackByRole: { role: string; count: number }[]
  firstInvoiceAt: number | null
  lastInvoiceAt: number | null
}

interface Feedback {
  id: string
  role: string
  name: string
  rating: number
  comment: string
  createdAt: number
}

export default function GrowthPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["growth"],
    queryFn: async () => {
      const res = await fetch("/api/growth")
      if (!res.ok) throw new Error("Could not load growth data")
      return (await res.json()) as { stats: GrowthStats; feedback: Feedback[] }
    },
  })

  const stats = data?.stats
  const feedback = data?.feedback ?? []

  return (
    <main className="app-shell">
      <div className="app-frame" style={{ gridTemplateColumns: "1fr", maxWidth: 1100 }}>
        <section className="app-main">
          <header className="app-topbar">
            <div>
              <span className="workspace-label">STAGE 2 · GROWTH REPORT</span>
              <h1>Real usage, no fabricated numbers.</h1>
              <p>Every figure below is a live read from the production database — nothing is simulated.</p>
            </div>
            <div className="topbar-actions">
              <Link href="/dashboard" className="topbar-icon"><Icon name="chart" size={17} /></Link>
              <Link href="/docs" className="topbar-icon"><Icon name="invoice" size={17} /></Link>
            </div>
          </header>

          {isLoading || !stats ? (
            <div className="activity-empty">Loading live data…</div>
          ) : (
            <>
              <div className="metric-grid">
                <div className="metric-card"><span>Total invoices</span><b>{stats.totalInvoices}</b><small>{stats.uniqueFreelancers} freelancer{stats.uniqueFreelancers === 1 ? "" : "s"} · {stats.uniqueClients} client{stats.uniqueClients === 1 ? "" : "s"}</small></div>
                <div className="metric-card"><span>Settlement rate</span><b>{stats.settlementRate}%</b><small>{stats.paidInvoices} paid of {stats.totalInvoices}</small></div>
                <div className="metric-card"><span>Volume settled</span><b>${stats.totalVolumeSettled.toLocaleString()}</b><small>${stats.outstandingVolume.toLocaleString()} outstanding</small></div>
              </div>

              <section className="panel panel-pad" style={{ marginTop: 18 }}>
                <div className="panel-heading">
                  <div><h2>Seed user feedback</h2><p>Real responses collected from the dashboard and checkout page.</p></div>
                  <span className="icon-box"><Icon name="users" /></span>
                </div>
                <div className="metric-grid" style={{ marginBottom: 20 }}>
                  <div className="metric-card"><span>Responses</span><b>{stats.feedbackCount}</b><small>seed users so far</small></div>
                  <div className="metric-card"><span>Average rating</span><b>{stats.averageRating || "—"}</b><small>out of 5</small></div>
                  <div className="metric-card"><span>By role</span><b>{stats.feedbackByRole.map(r => `${r.role} ${r.count}`).join(" · ") || "—"}</b><small>freelancer / client / other</small></div>
                </div>
                {feedback.length === 0 ? (
                  <div className="activity-empty">No feedback yet — this fills in as real users try PayMate from the dashboard or after a checkout.</div>
                ) : (
                  <div className="invoice-table">
                    {feedback.map(f => (
                      <div key={f.id} className="invoice-row" style={{ gridTemplateColumns: "8px minmax(0,1fr) 60px" }}>
                        <span className="status-dot paid" />
                        <div className="invoice-row-main">
                          <b>{f.name} · {f.role}</b>
                          <small>{f.comment}</small>
                        </div>
                        <strong>{f.rating}/5</strong>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
