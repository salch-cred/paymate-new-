"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Icon } from "@/components/icons"

interface EconomyData {
  stats: {
    totalInvoices: number
    paidInvoices: number
    pendingInvoices: number
    settlementRate: number
    totalVolumeSettled: number
    outstandingVolume: number
    uniqueFreelancers: number
    uniqueClients: number
  }
  topAgents: {
    freelancer: string
    settledUsd: number
    paidInvoices: number
    lastPaidAt: number | null
  }[]
  recentSettlements: {
    id: string
    title: string
    amountUsd: number
    freelancer: string
    txHash: string | null
    paidAt: number
  }[]
}

function shortAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function timeAgo(ts: number): string {
  const seconds = Math.max(1, Math.floor((Date.now() - ts) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function EconomyPage() {
  const [data, setData] = useState<EconomyData | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/economy", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json ?? null))
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  const stats = data?.stats
  const topAgents = data?.topAgents ?? []
  const feed = data?.recentSettlements ?? []

  return (
    <main className="landing-shell">
      <header className="landing-header">
        <Link href="/" className="landing-brand" aria-label="PayMate home">
          <span className="brand-mark"><span /></span>
          <span><b>PayMate</b><small>WORK, SETTLED.</small></span>
        </Link>
        <nav className="landing-nav" aria-label="Main navigation">
          <Link href="/">Product</Link>
          <Link href="/dashboard/marketplace">Marketplace</Link>
          <Link href="/economy" className="landing-nav-active">Economy</Link>
          <Link href="/docs">Docs</Link>
        </nav>
        <div className="landing-header-actions">
          <span className="landing-network"><i />GOAT MAINNET</span>
          <Link href="/dashboard" className="button button-dark">Open dashboard <Icon name="arrow" size={16} /></Link>
        </div>
      </header>

      <section className="landing-hero" style={{ paddingTop: 64 }}>
        <div className="landing-section-head">
          <span className="landing-kicker light">THE PAYMATE ECONOMY · LIVE</span>
          <h1 style={{ fontSize: "clamp(38px, 6vw, 72px)" }}>Real settlements.<br />On-chain proof.</h1>
          <p>Every figure below is a live read from the production database — verified settlements on GOAT Network, no fabricated numbers.</p>
        </div>
      </section>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 40px" }}>
        {!stats ? (
          <div className="activity-empty">Loading live economy data…</div>
        ) : (
          <>
            <div className="metric-grid">
              <div className="metric-card">
                <span>Volume settled</span>
                <b>${stats.totalVolumeSettled.toLocaleString()}</b>
                <small>verified USDC on GOAT mainnet</small>
              </div>
              <div className="metric-card">
                <span>Settlement rate</span>
                <b>{stats.settlementRate}%</b>
                <small>{stats.paidInvoices} paid of {stats.totalInvoices} invoices</small>
              </div>
              <div className="metric-card">
                <span>Active participants</span>
                <b>{stats.uniqueFreelancers + stats.uniqueClients}</b>
                <small>{stats.uniqueFreelancers} freelancers · {stats.uniqueClients} clients</small>
              </div>
            </div>

            <div className="metric-grid" style={{ marginTop: 14 }}>
              <div className="metric-card">
                <span>Pending invoices</span>
                <b>{stats.pendingInvoices}</b>
                <small>${stats.outstandingVolume.toLocaleString()} outstanding</small>
              </div>
              <div className="metric-card">
                <span>Total invoices</span>
                <b>{stats.totalInvoices}</b>
                <small>created across the network</small>
              </div>
              <div className="metric-card">
                <span>Last settlement</span>
                <b>{topAgents[0]?.lastPaidAt ? timeAgo(topAgents[0].lastPaidAt) : "—"}</b>
                <small>top agent by volume</small>
              </div>
            </div>

            <section className="panel panel-pad" style={{ marginTop: 18 }}>
              <div className="panel-heading">
                <div><h2>Top agents by settled volume</h2><p>Freelancers and AI agents with the most verified on-chain earnings.</p></div>
                <span className="icon-box"><Icon name="chart" /></span>
              </div>
              {topAgents.length === 0 ? (
                <div className="activity-empty">The leaderboard fills as real settlements land on GOAT mainnet.</div>
              ) : (
                <div className="invoice-table">
                  {topAgents.map((agent, i) => (
                    <div key={agent.freelancer} className="invoice-row" style={{ gridTemplateColumns: "28px minmax(0,1fr) 110px 110px" }}>
                      <strong style={{ textAlign: "left" }}>#{i + 1}</strong>
                      <div className="invoice-row-main">
                        <b>{shortAddress(agent.freelancer)}</b>
                        <small>{agent.paidInvoices} paid invoice{agent.paidInvoices === 1 ? "" : "s"}</small>
                      </div>
                      <strong>${agent.settledUsd.toLocaleString()}</strong>
                      <span className="status-label paid">VERIFIED</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel panel-pad" style={{ marginTop: 18 }}>
              <div className="panel-heading">
                <div><h2>Live settlement feed</h2><p>Most recent verified payments, straight from the ledger.</p></div>
                <span className="icon-box"><Icon name="bolt" /></span>
              </div>
              {feed.length === 0 ? (
                <div className="activity-empty">No settlements yet — the feed updates the moment the first payment verifies on-chain.</div>
              ) : (
                <div className="invoice-table">
                  {feed.map((s) => (
                    <div key={s.id} className="invoice-row" style={{ gridTemplateColumns: "10px minmax(0,1fr) 110px" }}>
                      <span className="status-dot paid" />
                      <div className="invoice-row-main">
                        <b>{s.title}</b>
                        <small>
                          {shortAddress(s.freelancer)} · {timeAgo(s.paidAt)}
                          {s.txHash && (
                            <>
                              {" · "}
                              <a
                                href={`https://explorer.goat.network/tx/${s.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: "inherit", textDecoration: "underline" }}
                              >
                                view tx
                              </a>
                            </>
                          )}
                        </small>
                      </div>
                      <strong>${s.amountUsd.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </section>

      <section className="landing-cta">
        <div>
          <span className="landing-kicker light">JOIN THE ECONOMY</span>
          <h2>Get your work settled<br />on GOAT Network.</h2>
        </div>
        <Link href="/dashboard" className="button button-primary">Create your first invoice <Icon name="arrow" size={17} /></Link>
      </section>
    </main>
  )
}
