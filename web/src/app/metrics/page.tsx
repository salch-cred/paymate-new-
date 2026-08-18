"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Icon } from "@/components/icons"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { TARGET_METRICS, formatMetric } from "@/lib/metrics"

interface MetricsData {
  stats: {
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
    clawUpIntentInvoices: number
    clawUpIntentVolume: number
  }
  targets: {
    metric: string
    label: string
    kind: "count" | "usd"
    target: number
    actual: number | null
    met: boolean
    updatedAt: number
  }[]
  topSettlers: {
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

export default function MetricsPage() {
  const [data, setData] = useState<MetricsData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Team-only target entry
  const [token, setToken] = useState("")
  const [metric, setMetric] = useState(TARGET_METRICS[0]?.id ?? "")
  const [target, setTarget] = useState("")
  const [saving, setSaving] = useState(false)
  const [adminMsg, setAdminMsg] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/metrics", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setData(json)
        else setError("Could not load live metrics.")
      })
      .catch(() => setError("Could not load live metrics."))
    return () => controller.abort()
  }, [])

  function refresh() {
    fetch("/api/metrics")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setData(json)
      })
      .catch(() => undefined)
  }

  async function saveTarget(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setAdminMsg(null)
    try {
      const res = await fetch("/api/metrics/targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ metric, target: Number(target) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.detail || "Failed to save target")
      setTarget("")
      setAdminMsg(`Saved — ${json.label} target is now ${json.target}.`)
      refresh()
    } catch (err) {
      setAdminMsg(`Error: ${err instanceof Error ? err.message : "unknown"}`)
    } finally {
      setSaving(false)
    }
  }

  async function removeTarget(t: { metric: string; label: string }) {
    setAdminMsg(null)
    try {
      const res = await fetch("/api/metrics/targets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ metric: t.metric }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.detail || "Failed to remove target")
      setAdminMsg(`Removed target for "${t.label}".`)
      refresh()
    } catch (err) {
      setAdminMsg(`Error: ${err instanceof Error ? err.message : "unknown"}`)
    }
  }

  const stats = data?.stats
  const targets = data?.targets ?? []
  const feed = data?.recentSettlements ?? []
  const topSettlers = data?.topSettlers ?? []

  return (
    <main className="landing-shell">
      <SiteHeader active="/metrics" />

      <section className="landing-hero" style={{ paddingTop: 64 }}>
        <div className="landing-section-head">
          <span className="landing-kicker light">STAGE 2 · GROWTH METRICS · LIVE</span>
          <h1 style={{ fontSize: "clamp(38px, 6vw, 72px)" }}>Measurable results.<br />On-chain proof.</h1>
          <p>Every figure below is a live read from the production database — targets vs. actuals, verified settlements on GOAT Network, and no fabricated numbers.</p>
        </div>
      </section>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 40px" }}>
        {error ? (
          <div className="activity-empty">{error}</div>
        ) : !stats ? (
          <div className="activity-empty">Loading live metrics…</div>
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
                <span>Seed user feedback</span>
                <b>{stats.feedbackCount}</b>
                <small>avg rating {stats.averageRating ? `${stats.averageRating.toFixed(1)}/5` : "—"}</small>
              </div>
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
                <span>ClawUp-originated invoices</span>
                <b>{stats.clawUpIntentInvoices}</b>
                <small>${stats.clawUpIntentVolume.toLocaleString()} settled via the ClawUp intent adapter</small>
              </div>
            </div>

            <section className="panel panel-pad" style={{ marginTop: 18 }}>
              <div className="panel-heading">
                <div><h2>Stage 2 growth targets — vs. actual</h2><p>The locked baseline vs. live results. The growth component is all-or-nothing: every target must be met.</p></div>
                <span className="icon-box"><Icon name="chart" /></span>
              </div>
              {targets.length === 0 ? (
                <div className="activity-empty">
                  No growth targets recorded yet. Set them below (team-only) so the report links to this page as evidence.
                </div>
              ) : (
                <div className="invoice-table">
                  {targets.map((t) => (
                    <div key={t.metric} className="invoice-row" style={{ gridTemplateColumns: "minmax(0,1fr) 110px 110px 110px" }}>
                      <div className="invoice-row-main">
                        <b>{t.label}</b>
                        <small>target {formatMetric(t.kind, t.target)}</small>
                      </div>
                      <strong>{t.actual !== null ? formatMetric(t.kind, t.actual) : "—"}</strong>
                      <span className={`status-label ${t.met ? "paid" : "pending"}`}>
                        {t.met ? "MET" : "NOT MET"}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeTarget(t)}
                        style={{ background: "none", border: "none", color: "var(--ink)", opacity: 0.6, cursor: "pointer", fontSize: 12 }}
                        aria-label={`Remove ${t.label} target`}
                      >
                        remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel panel-pad" style={{ marginTop: 18 }}>
              <div className="panel-heading">
                <div><h2>Team — set growth targets</h2><p>Enter the original Stage 2 baseline once (Bearer token from METRICS_ADMIN_TOKEN).</p></div>
                <span className="icon-box"><Icon name="users" /></span>
              </div>
              <form onSubmit={saveTarget} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                  Admin token
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="METRICS_ADMIN_TOKEN"
                    style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14 }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                  Metric
                  <select
                    value={metric}
                    onChange={(e) => setMetric(e.target.value)}
                    style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14 }}
                  >
                    {TARGET_METRICS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                  Target
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder="e.g. 50"
                    style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14 }}
                  />
                </label>
                <button type="submit" className="button button-primary" disabled={saving || !token || !target}>
                  {saving ? "Saving…" : "Save target"}
                </button>
              </form>
              {adminMsg && <p style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>{adminMsg}</p>}
            </section>

            <section className="panel panel-pad" style={{ marginTop: 18 }}>
              <div className="panel-heading">
                <div><h2>Top agents by settled volume</h2><p>Freelancers and AI agents with the most verified on-chain earnings.</p></div>
                <span className="icon-box"><Icon name="chart" /></span>
              </div>
              {topSettlers.length === 0 ? (
                <div className="activity-empty">The leaderboard fills as real settlements land on GOAT mainnet.</div>
              ) : (
                <div className="invoice-table">
                  {topSettlers.map((agent, i) => (
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

      <SiteFooter />
    </main>
  )
}
