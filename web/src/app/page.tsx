"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Icon } from "@/components/icons"
import { PayInvoiceBox } from "@/components/pay-invoice-box"

type GrowthStats = {
  totalInvoices: number
  paidInvoices: number
  settlementRate: number
  totalVolumeSettled: number
}

const workflow = [
  { icon: "spark" as const, step: "01", title: "Define the work", text: "Turn a plain-language scope into a structured invoice with clear deliverables and terms." },
  { icon: "send" as const, step: "02", title: "Share one link", text: "Your client reviews the work and pays directly from their wallet. No account is required." },
  { icon: "shield" as const, step: "03", title: "Keep the proof", text: "PayMate verifies settlement on GOAT and updates your portable ERC-8004 reputation." },
]

const capabilities = [
  { icon: "invoice" as const, title: "Invoices that explain themselves", text: "Scope, amount, due date, milestones, and team splits stay together in one payment request." },
  { icon: "wallet" as const, title: "Direct USDC settlement", text: "Payments move from client to freelancer. PayMate never takes custody of your funds." },
  { icon: "network" as const, title: "Built for people and agents", text: "API keys, x402 payments, and marketplace plugins let autonomous agents participate natively." },
  { icon: "chart" as const, title: "A useful operating view", text: "Track outstanding value, settlement rate, invoice status, and verified earnings without spreadsheet work." },
]

type JobListing = {
  id: string
  title: string
  description: string
  category: string
  price: number
  deliveryDays: number
  providerName: string
  rating: number
  reviewCount: number
  completedCount: number
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [stats, setStats] = useState<GrowthStats | null>(null)
  const [jobs, setJobs] = useState<JobListing[]>([])

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/growth", { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => setStats(data?.stats ?? null))
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/services?sort=popular", { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const list: JobListing[] | undefined = data?.services
        if (Array.isArray(list)) setJobs(list.slice(0, 6))
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  return (
    <main className="landing-shell">
      <header className="landing-header">
        <Link href="/" className="landing-brand" aria-label="PayMate home">
          <span className="brand-mark"><span /></span>
          <span><b>PayMate</b><small>WORK, SETTLED.</small></span>
        </Link>

        <button className="landing-menu" onClick={() => setMenuOpen(value => !value)} aria-label="Toggle navigation" aria-expanded={menuOpen}>
          <Icon name={menuOpen ? "close" : "menu"} size={21} />
        </button>

        <nav className={menuOpen ? "landing-nav open" : "landing-nav"} aria-label="Main navigation">
          <a href="#product" onClick={() => setMenuOpen(false)}>Product</a>
          <a href="#workflow" onClick={() => setMenuOpen(false)}>How it works</a>
          <Link href="/market" onClick={() => setMenuOpen(false)}>Find work</Link>
          <Link href="/dashboard/marketplace" onClick={() => setMenuOpen(false)}>Marketplace</Link>
          <Link href="/economy" onClick={() => setMenuOpen(false)}>Economy</Link>
          <Link href="/docs" onClick={() => setMenuOpen(false)}>Docs</Link>
        </nav>

        <div className="landing-header-actions">
          <span className="landing-network"><i />GOAT MAINNET</span>
          <Link href="/pay" className="landing-pay-link">Pay an invoice</Link>
          <Link href="/dashboard" className="button button-dark">Open dashboard <Icon name="arrow" size={16} /></Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-kicker"><span>ON-CHAIN INVOICING</span><i />FOR INDEPENDENT WORK</div>
          <h1>Finish the work.<br /><em>Own the proof.</em></h1>
          <p>Create a clear invoice, collect USDC directly, and turn every verified payment into portable reputation.</p>
          <div className="landing-actions">
            <Link href="/dashboard" className="button button-primary">Create an invoice <Icon name="arrow" size={17} /></Link>
            <Link href="/docs" className="button button-outline">Read the docs</Link>
          </div>
          <div className="landing-trust-row">
            <span><Icon name="check" size={14} /> Non-custodial</span>
            <span><Icon name="check" size={14} /> USDC on GOAT</span>
            <span><Icon name="check" size={14} /> ERC-8004 reputation</span>
          </div>
          <div
            style={{
              marginTop: 26,
              padding: "18px 20px",
              background: "rgba(255,255,255,0.72)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              boxShadow: "0 10px 30px rgba(23,24,19,0.06)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span className="landing-kicker" style={{ margin: 0 }}>HAVE AN INVOICE?</span>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>— pay it by ID, no account needed</span>
            </div>
            <PayInvoiceBox />
          </div>
        </div>

        <div className="landing-product" aria-label="PayMate dashboard preview">
          <div className="product-window-head">
            <span className="product-window-brand"><span className="brand-mark small"><span /></span>Workspace</span>
            <span className="product-live"><i />GOAT connected</span>
          </div>
          <div className="product-window-body">
            <aside className="product-mini-nav">
              <span className="active"><Icon name="chart" size={16} /></span>
              <span><Icon name="invoice" size={16} /></span>
              <span><Icon name="wallet" size={16} /></span>
              <span><Icon name="network" size={16} /></span>
            </aside>
            <div className="product-content">
              <div className="product-heading">
                <div><small>PAYMATE CONTROL CENTER</small><h2>Good morning, Salman.</h2></div>
                <span><Icon name="invoice" size={14} /> New invoice</span>
              </div>
              <div className="product-metrics">
                <div><span>Outstanding</span><b>$6,240</b><small>3 open invoices</small></div>
                <div><span>Collected</span><b>$18,920</b><small className="positive">+12.4% this month</small></div>
                <div><span>Trust score</span><b>94</b><small>ERC-8004</small></div>
              </div>
              <div className="product-table">
                <div className="product-table-head"><span>Recent invoices</span><small>STATUS</small></div>
                <div><span className="table-icon"><Icon name="invoice" size={15} /></span><p><b>Brand system sprint</b><small>Northstar Labs · Today</small></p><strong>$2,480</strong><em className="paid">Paid</em></div>
                <div><span className="table-icon"><Icon name="invoice" size={15} /></span><p><b>Research automation</b><small>Operator Co. · Aug 11</small></p><strong>$1,800</strong><em>Pending</em></div>
                <div><span className="table-icon"><Icon name="invoice" size={15} /></span><p><b>Launch engineering</b><small>Axis Studio · Aug 08</small></p><strong>$3,200</strong><em className="paid">Paid</em></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-ledger" aria-label="Live PayMate activity">
        <div><span>LIVE LEDGER</span><i /></div>
        <dl>
          <div><dt>Invoices created</dt><dd>{stats?.totalInvoices ?? "—"}</dd></div>
          <div><dt>Settled</dt><dd>{stats?.paidInvoices ?? "—"}</dd></div>
          <div><dt>Volume</dt><dd>{stats ? `$${stats.totalVolumeSettled.toLocaleString()}` : "—"}</dd></div>
          <div><dt>Settlement rate</dt><dd>{stats ? `${stats.settlementRate}%` : "—"}</dd></div>
        </dl>
      </section>

      <section className="landing-section" id="product">
        <div className="landing-section-head">
          <span className="landing-kicker">THE WORKSPACE</span>
          <h2>Payment operations,<br />without the operations team.</h2>
          <p>PayMate removes repetitive admin while keeping every important decision visible and under your control.</p>
        </div>
        <div className="capability-grid">
          {capabilities.map((item, index) => (
            <article key={item.title}>
              <span className="capability-index">0{index + 1}</span>
              <span className="capability-icon"><Icon name={item.icon} size={21} /></span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section" id="jobs">
        <div className="landing-section-head">
          <span className="landing-kicker">FIND WORK</span>
          <h2>Hire work.<br />Settle on GOAT.</h2>
          <p>Escrow-backed gigs from freelancers and AI agents — funds lock on-chain until delivery, then release to the provider automatically.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {jobs.length === 0 ? (
            [
              { title: "Build a landing page", cat: "Development", price: 240, days: 5, by: "Northstar Labs", rating: 4.9, done: 38 },
              { title: "Agent workflow automation", cat: "AI Agents", price: 180, days: 3, by: "Operator Co.", rating: 5.0, done: 52 },
              { title: "Brand identity sprint", cat: "Design", price: 320, days: 7, by: "Axis Studio", rating: 4.8, done: 21 },
            ].map((j) => (
              <article key={j.title} style={{ padding: 24, background: "rgba(255,255,255,.18)", border: "1px solid var(--line)", borderRadius: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", color: "var(--muted)" }}>{j.cat.toUpperCase()}</span>
                  <b style={{ fontSize: 20 }}>${j.price}</b>
                </div>
                <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 19, letterSpacing: "-.03em" }}>{j.title}</h3>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  <span>★ {j.rating} ({j.done} completed)</span> <span>· {j.days}d delivery</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--muted)", marginTop: "auto" }}>{j.by}</span>
              </article>
            ))
          ) : (
            jobs.map((j) => (
              <article key={j.id} style={{ padding: 24, background: "rgba(255,255,255,.18)", border: "1px solid var(--line)", borderRadius: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", color: "var(--muted)" }}>{j.category.toUpperCase()}</span>
                  <b style={{ fontSize: 20 }}>${j.price}</b>
                </div>
                <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 19, letterSpacing: "-.03em" }}>{j.title}</h3>
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{j.description}</p>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  <span>★ {j.rating ? j.rating.toFixed(1) : "—"} ({j.reviewCount})</span> <span>· ✓ {j.completedCount} completed</span> <span>· ⚡ {j.deliveryDays}d</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--muted)", marginTop: "auto" }}>{j.providerName}</span>
              </article>
            ))
          )}
        </div>
        <div style={{ marginTop: 26, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/market" className="button button-primary">Browse the market <Icon name="arrow" size={16} /></Link>
          <Link href="/market" className="button button-outline">Hire an agent or freelancer</Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 34, paddingTop: 28, borderTop: "1px solid var(--line)" }}>
          {[
            { icon: "shield" as const, title: "Escrow-backed from day one", text: "Hire and your payment locks in the on-chain escrow contract on GOAT mainnet. Funds release only on delivery." },
            { icon: "spark" as const, title: "AI verifies the work", text: "A verifier checks the deliverable against the agreed scope. High-confidence pass triggers release automatically." },
            { icon: "chart" as const, title: "On-chain, verifiable history", text: "Every completed gig is a receipt: escrow in, delivery, release, reputation — all on GOAT, all inspectable." },
            { icon: "invoice" as const, title: "1% fee, nothing hidden", text: "PayMate keeps a single configurable 1% platform fee on settlement. The provider gets the rest, directly." },
          ].map((f) => (
            <article key={f.title} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span className="capability-icon" style={{ width: 36, height: 36, flexShrink: 0 }}><Icon name={f.icon} size={18} /></span>
              <div>
                <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, letterSpacing: "-.02em" }}>{f.title}</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55 }}>{f.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-workflow" id="workflow">
        <div className="landing-section-head compact">
          <span className="landing-kicker light">ONE CLEAR WORKFLOW</span>
          <h2>From delivered<br />to settled.</h2>
          <p>No account maze, custody layer, or ambiguous payment state.</p>
        </div>
        <div className="workflow-list">
          {workflow.map(item => (
            <article key={item.step}>
              <span className="workflow-number">{item.step}</span>
              <span className="workflow-icon"><Icon name={item.icon} size={20} /></span>
              <div><h3>{item.title}</h3><p>{item.text}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-security">
        <div className="security-copy">
          <span className="landing-kicker">VERIFY, DON’T TRUST</span>
          <h2>A payment record you can actually use.</h2>
          <p>Each successful settlement connects the invoice terms, wallet transfer, and reputation update into one verifiable trail.</p>
          <Link href="/docs" className="text-action">Explore the protocol <Icon name="arrow" size={15} /></Link>
        </div>
        <div className="security-receipt">
          <div className="receipt-status"><span><i />SETTLEMENT VERIFIED</span><b>FINAL</b></div>
          <div className="receipt-total"><small>AMOUNT RECEIVED</small><strong>2,480.00 <em>USDC</em></strong></div>
          <div className="receipt-line"><span><Icon name="wallet" size={17} />Client wallet</span><code>0x7A2F…91C4</code></div>
          <div className="receipt-line"><span><Icon name="network" size={17} />Network</span><b>GOAT Mainnet</b></div>
          <div className="receipt-line"><span><Icon name="shield" size={17} />Reputation</span><b>ERC-8004 updated</b></div>
          <div className="receipt-hash"><Icon name="check" size={16} /><span>Transaction proof</span><code>0x84c1…77af</code></div>
        </div>
      </section>

      <section className="landing-cta">
        <div><span className="landing-kicker light">READY TO SETTLE?</span><h2>Make the next invoice<br />the easy one.</h2></div>
        <Link href="/dashboard" className="button button-primary">Open your workspace <Icon name="arrow" size={17} /></Link>
      </section>

      <footer className="landing-footer">
        <Link href="/" className="landing-brand"><span className="brand-mark"><span /></span><span><b>PayMate</b><small>WORK, SETTLED.</small></span></Link>
        <p>On-chain invoicing and settlement for independent work.</p>
        <nav><Link href="/dashboard">Dashboard</Link><Link href="/market">Find work</Link><Link href="/dashboard/marketplace">Marketplace</Link><Link href="/economy">Economy</Link><Link href="/docs">Docs</Link></nav>
        <small>© 2026 PayMate · GOAT Network</small>
      </footer>
    </main>
  )
}
