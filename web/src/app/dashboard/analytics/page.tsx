"use client"

import { useAccount } from "wagmi"
import { useQuery } from "@tanstack/react-query"
import { Icon } from "@/components/icons"
import { motion } from "framer-motion"

type Invoice = {
  id: string
  freelancer: string
  client: string
  title: string
  description: string
  amountUsd: number
  status: "pending" | "paid" | "cancelled"
  chain: string
  createdAt: string
  txHash?: string
  paidAt?: string
}

export default function AnalyticsPage() {
  const { address } = useAccount()
  
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices", address],
    queryFn: async () => {
      if (!address) return []
      const res = await fetch(`/api/invoices?freelancer=${address}`)
      if (!res.ok) throw new Error("Failed to fetch invoices")
      return res.json()
    },
    enabled: !!address,
  })

  if (isLoading) {
    return <div className="panel panel-pad">Loading analytics...</div>
  }

  // Derived stats
  const paidInvoices = invoices.filter(i => i.status === "paid")
  const pendingInvoices = invoices.filter(i => i.status === "pending")
  
  const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.amountUsd, 0)
  const pendingAmount = pendingInvoices.reduce((sum, i) => sum + i.amountUsd, 0)
  const settlementRate = invoices.length ? (paidInvoices.length / invoices.length) * 100 : 0

  // 6 months chart data
  const now = new Date()
  const months = Array.from({length: 6}, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return {
      label: d.toLocaleString('default', { month: 'short' }),
      month: d.getMonth(),
      year: d.getFullYear(),
      amount: 0
    }
  }).reverse()

  paidInvoices.forEach(inv => {
    if (!inv.paidAt) return
    const date = new Date(inv.paidAt)
    const m = months.find(m => m.month === date.getMonth() && m.year === date.getFullYear())
    if (m) m.amount += inv.amountUsd
  })

  const maxMonthAmount = Math.max(...months.map(m => m.amount), 1)

  // Top clients
  const clientTotals: Record<string, {amount: number, count: number}> = {}
  paidInvoices.forEach(inv => {
    if (!clientTotals[inv.client]) clientTotals[inv.client] = { amount: 0, count: 0 }
    clientTotals[inv.client].amount += inv.amountUsd
    clientTotals[inv.client].count += 1
  })
  
  const topClients = Object.entries(clientTotals)
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 5)

  // Payment trends (this week vs last week)
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  let thisWeekAmount = 0
  let lastWeekAmount = 0

  paidInvoices.forEach(inv => {
    if (!inv.paidAt) return
    const d = new Date(inv.paidAt)
    if (d >= oneWeekAgo) {
      thisWeekAmount += inv.amountUsd
    } else if (d >= twoWeeksAgo && d < oneWeekAgo) {
      lastWeekAmount += inv.amountUsd
    }
  })

  const trendChange = lastWeekAmount ? ((thisWeekAmount - lastWeekAmount) / lastWeekAmount) * 100 : (thisWeekAmount > 0 ? 100 : 0)

  return (
    <div className="panel panel-pad" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h2 className="panel-heading">Analytics Overview</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Real-time metrics for {address?.slice(0, 6) || "..."}...{address?.slice(-4) || "..."}</p>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span className="label"><Icon name="chart" size={14}/> Total Revenue</span>
          <div className="value">${totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
        </div>
        <div className="metric-card">
          <span className="label"><Icon name="wallet" size={14}/> Pending Amount</span>
          <div className="value">${pendingAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
        </div>
        <div className="metric-card">
          <span className="label"><Icon name="invoice" size={14}/> Total Invoices</span>
          <div className="value">{invoices.length}</div>
        </div>
        <div className="metric-card">
          <span className="label"><Icon name="check" size={14}/> Settlement Rate</span>
          <div className="value">{settlementRate.toFixed(1)}%</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {/* Monthly Earnings */}
        <div className="panel" style={{ padding: '24px' }}>
          <h3 className="panel-heading" style={{ marginBottom: '24px' }}>Monthly Earnings</h3>
          <div className="mini-chart" style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px', paddingBottom: '24px', borderBottom: '1px solid var(--line)', position: 'relative' }}>
            {months.map((m, i) => {
              const heightPct = (m.amount / maxMonthAmount) * 100
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct}%` }}
                    style={{ width: '100%', backgroundColor: 'var(--orange)', borderRadius: '4px 4px 0 0', minHeight: heightPct > 0 ? '4px' : '0' }}
                  />
                  <span style={{ position: 'absolute', bottom: '0', fontSize: '11px', color: 'var(--text-muted)', transform: 'translateY(20px)' }}>{m.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Payment Trends */}
        <div className="panel" style={{ padding: '24px' }}>
          <h3 className="panel-heading" style={{ marginBottom: '24px' }}>Payment Trends</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>This Week</div>
              <div style={{ fontSize: '24px', fontWeight: '500' }}>${thisWeekAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            </div>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Last Week</div>
              <div style={{ fontSize: '18px', color: 'var(--text-muted)' }}>${lastWeekAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '100px', backgroundColor: trendChange >= 0 ? 'rgba(0, 200, 83, 0.1)' : 'rgba(255, 91, 46, 0.1)', color: trendChange >= 0 ? '#00c853' : 'var(--orange)', width: 'fit-content', fontSize: '13px', fontWeight: '500' }}>
              <Icon name="arrow" size={12} style={{ transform: trendChange >= 0 ? 'rotate(-45deg)' : 'rotate(45deg)' }}/>
              {Math.abs(trendChange).toFixed(1)}% {trendChange >= 0 ? 'Increase' : 'Decrease'}
            </div>
          </div>
        </div>
      </div>

      {/* Top Clients */}
      <div className="panel" style={{ padding: '24px' }}>
        <h3 className="panel-heading" style={{ marginBottom: '16px' }}>Top Clients</h3>
        {topClients.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No payment data available yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', paddingBottom: '12px', borderBottom: '1px solid var(--line)', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <span>Client Address</span>
              <span style={{ textAlign: 'right' }}>Invoices</span>
              <span style={{ textAlign: 'right' }}>Total Paid</span>
            </div>
            {topClients.map(([client, data], i) => (
              <div key={client} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: '16px 0', borderBottom: i < topClients.length - 1 ? '1px solid var(--line)' : 'none', fontSize: '14px' }}>
                <span style={{ fontFamily: 'monospace' }}>{client.slice(0, 8)}...{client.slice(-6)}</span>
                <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{data.count}</span>
                <span style={{ textAlign: 'right', fontWeight: '500' }}>${data.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
