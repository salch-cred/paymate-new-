"use client"

import { useAccount } from "wagmi"
import { useQuery } from "@tanstack/react-query"
import { Icon } from "@/components/icons"
import { WalletConnectMenu } from "@/components/wallet-connect-menu"

type Invoice = {
  id: string
  client: string
  title: string
  amountUsd: number
  status: "pending" | "paid" | "cancelled"
  createdAt: string
  paidAt?: string
}

export default function AnalyticsPage() {
  const { address, isConnected } = useAccount()
  const { data: invoices = [], isLoading, isError } = useQuery<Invoice[]>({
    queryKey: ["invoices", address],
    queryFn: async () => {
      if (!address) return []
      const response = await fetch(`/api/invoices?freelancer=${address}`)
      if (!response.ok) throw new Error("Failed to fetch invoices")
      const data = await response.json()
      return data.invoices ?? []
    },
    enabled: !!address,
  })

  const paid = invoices.filter(invoice => invoice.status === "paid")
  const pending = invoices.filter(invoice => invoice.status === "pending")
  const totalRevenue = paid.reduce((sum, invoice) => sum + invoice.amountUsd, 0)
  const pendingAmount = pending.reduce((sum, invoice) => sum + invoice.amountUsd, 0)
  const settlementRate = invoices.length ? Math.round((paid.length / invoices.length) * 100) : 0

  const now = new Date()
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
    return { label: date.toLocaleString("default", { month: "short" }), month: date.getMonth(), year: date.getFullYear(), amount: 0 }
  })
  paid.forEach(invoice => {
    if (!invoice.paidAt) return
    const date = new Date(invoice.paidAt)
    const month = months.find(item => item.month === date.getMonth() && item.year === date.getFullYear())
    if (month) month.amount += invoice.amountUsd
  })
  const maxMonth = Math.max(1, ...months.map(month => month.amount))

  const clientTotals = paid.reduce<Record<string, { amount: number; count: number }>>((totals, invoice) => {
    totals[invoice.client] ??= { amount: 0, count: 0 }
    totals[invoice.client].amount += invoice.amountUsd
    totals[invoice.client].count += 1
    return totals
  }, {})
  const topClients = Object.entries(clientTotals).sort((a, b) => b[1].amount - a[1].amount).slice(0, 5)

  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  const thisWeek = paid.filter(invoice => invoice.paidAt && new Date(invoice.paidAt) >= oneWeekAgo).reduce((sum, invoice) => sum + invoice.amountUsd, 0)
  const lastWeek = paid.filter(invoice => invoice.paidAt && new Date(invoice.paidAt) >= twoWeeksAgo && new Date(invoice.paidAt) < oneWeekAgo).reduce((sum, invoice) => sum + invoice.amountUsd, 0)
  const trend = lastWeek ? ((thisWeek - lastWeek) / lastWeek) * 100 : thisWeek > 0 ? 100 : 0

  return (
    <>
      <header className="app-topbar">
        <div>
          <span className="workspace-label">PERFORMANCE</span>
          <h1>Analytics</h1>
          <p>Revenue, settlement performance, and client concentration from your live invoices.</p>
        </div>
      </header>

      <div className="dashboard-page-content">
        {!isConnected ? (
          <section className="panel connect-empty" style={{ margin: 0 }}>
            <div>
              <div className="empty-orb"><Icon name="chart" size={30} /></div>
              <h2>Connect your wallet to view analytics</h2>
              <p>Your reporting is generated from invoices owned by the connected wallet.</p>
              <WalletConnectMenu triggerClassName="button button-primary" triggerLabel={<>Connect wallet <Icon name="arrow" /></>} />
            </div>
          </section>
        ) : isLoading ? (
          <div className="activity-empty">Loading analytics…</div>
        ) : isError ? (
          <div className="error-box">Analytics could not be loaded. Try again shortly.</div>
        ) : (
          <>
            <div className="metric-grid analytics-metrics">
              <div className="metric-card"><span>Total revenue</span><b>${totalRevenue.toLocaleString()}</b><small>{paid.length} settled invoices</small></div>
              <div className="metric-card"><span>Outstanding</span><b>${pendingAmount.toLocaleString()}</b><small>{pending.length} awaiting payment</small></div>
              <div className="metric-card"><span>Settlement rate</span><b>{settlementRate}%</b><small>{invoices.length} invoices total</small></div>
              <div className="metric-card"><span>This week</span><b>${thisWeek.toLocaleString()}</b><small className={trend >= 0 ? "trend-up" : "trend-down"}>{trend >= 0 ? "+" : ""}{trend.toFixed(1)}% vs last week</small></div>
            </div>

            <div className="analytics-grid">
              <section className="panel panel-pad analytics-chart-panel">
                <div className="panel-heading"><div><h2>Revenue by month</h2><p>Verified settlement over the last six months.</p></div><span className="icon-box"><Icon name="chart" size={17} /></span></div>
                <div className="analytics-chart">
                  {months.map(month => (
                    <div key={`${month.month}-${month.year}`}>
                      <span>${month.amount.toLocaleString()}</span>
                      <i style={{ height: `${Math.max(month.amount ? 8 : 2, (month.amount / maxMonth) * 100)}%` }} />
                      <small>{month.label}</small>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel panel-pad analytics-trend-panel">
                <div className="panel-heading"><div><h2>Weekly pace</h2><p>Current seven-day settlement.</p></div><span className="icon-box"><Icon name="bolt" size={17} /></span></div>
                <strong>${thisWeek.toLocaleString()}</strong>
                <span>This week</span>
                <div className="analytics-comparison"><span>Previous week</span><b>${lastWeek.toLocaleString()}</b></div>
                <div className={trend >= 0 ? "trend-badge positive" : "trend-badge negative"}><Icon name="arrow" size={13} />{Math.abs(trend).toFixed(1)}% {trend >= 0 ? "increase" : "decrease"}</div>
              </section>
            </div>

            <section className="panel panel-pad analytics-clients">
              <div className="panel-heading"><div><h2>Top clients</h2><p>Settled revenue by client wallet.</p></div><span className="activity-count">{topClients.length}</span></div>
              {topClients.length === 0 ? <div className="activity-empty">Client data appears after your first verified payment.</div> : (
                <div className="analytics-table">
                  <div className="analytics-table-head"><span>Client wallet</span><span>Invoices</span><span>Total paid</span></div>
                  {topClients.map(([client, data]) => (
                    <div key={client}><code>{client.slice(0, 8)}…{client.slice(-6)}</code><span>{data.count}</span><strong>${data.amount.toLocaleString()}</strong></div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  )
}
