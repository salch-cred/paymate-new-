"use client"

import Link from "next/link"
import { useEffect, useState, type PointerEvent } from "react"
import { Icon } from "@/components/icons"

const features = [
  { icon: "spark" as const, n: "01", title: "Describe the work", text: "Write the scope in plain language. PayMate structures the job, price, and terms into a clean invoice." },
  { icon: "network" as const, n: "02", title: "Swarm Payouts", text: "One invoice pays multiple AI agents instantly. Route funds to your research, coding, and testing agents." },
  { icon: "shield" as const, n: "03", title: "Build portable trust", text: "Every verified settlement strengthens your ERC-8004 reputation on GOAT Network." },
]

interface GrowthStats {
  totalInvoices: number
  paidInvoices: number
  settlementRate: number
  totalVolumeSettled: number
  uniqueFreelancers: number
  lastInvoiceAt: number | null
  lastPaidInvoice: { title: string; amountUsd: number; txHash: string | null; paidAt: number } | null
}

// One shared fetch for the ticker, ledger, and trace — always a live read.
let growthPromise: Promise<GrowthStats | null> | null = null
function fetchGrowthStats(): Promise<GrowthStats | null> {
  if (!growthPromise) {
    growthPromise = fetch("/api/growth")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("growth unavailable"))))
      .then(d => (d?.stats ? (d.stats as GrowthStats) : null))
      .catch(() => null)
  }
  return growthPromise
}

function useGrowth(): { stats: GrowthStats | null } {
  const [stats, setStats] = useState<GrowthStats | null>(null)
  useEffect(() => {
    let live = true
    fetchGrowthStats().then(d => { if (live) setStats(d) })
    return () => { live = false }
  }, [])
  return { stats }
}

function KineticTicker() {
  const { stats } = useGrowth()
  const hasUsage = !!stats && stats.totalInvoices > 0
  return (
    <section className="kinetic-ticker" aria-label="Live settlement activity"><div>
      {hasUsage ? (
        <>
          <span><i/>{stats.totalInvoices} INVOICES CREATED</span><b>→</b>
          <span>{stats.paidInvoices} SETTLED</span><b>→</b>
          <span>${stats.totalVolumeSettled.toLocaleString()} VOLUME</span><b>→</b>
          <span className="ticker-verified"><Icon name="check" size={13}/>{stats.settlementRate}% SETTLEMENT RATE</span><b>→</b>
          <span>REPUTATION MINTED ON GOAT</span>
        </>
      ) : (
        <>
          <span><i/>AWAITING FIRST ON-CHAIN SETTLEMENT</span><b>→</b>
          <span>CREATE INVOICE</span><b>→</b>
          <span>SHARE PAYMENT LINK</span><b>→</b>
          <span>SETTLE IN USDC</span><b>→</b>
          <span className="ticker-verified"><Icon name="check" size={13}/>VERIFIED ON GOAT MAINNET</span>
        </>
      )}
    </div></section>
  )
}

function LiveTrace() {
  const { stats } = useGrowth()
  const last = stats?.lastPaidInvoice ?? null
  return (
    <div className="protocol-console glass-heavy">
      <div className="console-bar"><span><i/><i/><i/></span><b>LIVE SETTLEMENT TRACE</b><small>{last ? `GOAT · ${new Date(last.paidAt).toLocaleString()}` : "GOAT MAINNET · AWAITING FIRST SETTLEMENT"}</small></div>
      {last ? (
        <>
          <div className="trace-row active"><span>01</span><Icon name="invoice"/><div><b>Invoice created</b><small>{last.title} · ${last.amountUsd.toLocaleString()} USDC</small></div><em>VERIFIED</em></div>
          <div className="trace-line"><i/></div>
          <div className="trace-row"><span>02</span><Icon name="wallet"/><div><b>Transfer submitted</b><small>{last.txHash ? `${last.txHash.slice(0, 10)}…${last.txHash.slice(-4)}` : "on-chain"}</small></div><em>CONFIRMED</em></div>
          <div className="trace-line"><i/></div>
          <div className="trace-row verified"><span>03</span><Icon name="shield"/><div><b>Settlement verified</b><small>Token · recipient · amount</small></div><em>FINAL</em></div>
          {last.txHash && (
            <div className="console-proof"><span>PROOF</span><a href={`https://explorer.goat.network/tx/${last.txHash}`} target="_blank" rel="noreferrer" style={{ color: "#c9fa78", textDecoration: "none" }}><code>{last.txHash.slice(0, 18)}…</code></a><Icon name="check"/></div>
          )}
        </>
      ) : (
        <>
          <div className="trace-row active"><span>01</span><Icon name="invoice"/><div><b>Awaiting first invoice</b><small>Create one from the dashboard</small></div><em>—</em></div>
          <div className="trace-line"><i/></div>
          <div className="trace-row"><span>02</span><Icon name="wallet"/><div><b>Awaiting transfer</b><small>Client pays directly to wallet</small></div><em>—</em></div>
          <div className="trace-line"><i/></div>
          <div className="trace-row"><span>03</span><Icon name="shield"/><div><b>Verification ready</b><small>Server checks token · recipient · amount</small></div><em>READY</em></div>
        </>
      )}
    </div>
  )
}

function LiveLedger() {
  const { stats } = useGrowth()

  const hasUsage = !!stats && stats.totalInvoices > 0
  const lastPaid = stats?.lastInvoiceAt ? new Date(stats.lastInvoiceAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null

  const metric = (label: string, value: string, sub: string) => (
    <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "16px", padding: "20px 22px", boxShadow: "0 8px 30px rgba(0,0,0,0.04)" }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: "#8a8981" }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: "-0.03em", margin: "6px 0 2px", color: "var(--ink)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#8a8981" }}>{sub}</div>
    </div>
  )

  return (
    <section className="section-pad" id="ledger" style={{ background: "#f1efe9", padding: "70px 5%", borderBottom: "1px solid var(--line)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 28 }}>
          <div>
            <span className="section-kicker">LIVE FROM THE SETTLEMENT LEDGER</span>
            <h2 style={{ fontSize: "2.2rem", margin: "14px 0 6px" }}>Real numbers. Live ledger.</h2>
            <p style={{ color: "var(--muted)", margin: 0, maxWidth: 520, lineHeight: 1.5 }}>Every figure below is read live from the production database — nothing is simulated.</p>
          </div>
          <Link href="/growth" style={{ fontSize: 13, fontWeight: 800, color: "var(--orange, #ff5b2e)", display: "flex", alignItems: "center", gap: 6 }}>Open the full growth report <Icon name="arrow" size={14} /></Link>
        </div>

        {hasUsage ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {metric("VOLUME SETTLED", `$${(stats.totalVolumeSettled || 0).toLocaleString()}`, "USDC on GOAT mainnet")}
            {metric("SETTLEMENT RATE", `${stats.settlementRate}%`, `${stats.totalInvoices} invoices created`)}
            {metric("FREELANCERS PAID", `${stats.uniqueFreelancers}`, "unique wallets")}
            {metric("LAST SETTLEMENT", lastPaid || "—", "on the ledger")}
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px dashed var(--line)", borderRadius: "16px", padding: "36px", textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", marginBottom: 8 }}>The ledger fills in the moment the first invoice settles.</div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 18px", lineHeight: 1.5 }}>No simulated numbers — ever. Settle one real payment and it appears here instantly.</p>
            <Link href="/dashboard" className="button button-dark">Create the first invoice <Icon name="arrow" size={15} /></Link>
          </div>
        )}
      </div>
    </section>
  )
}

export default function Home() {
  const [menu, setMenu] = useState(false)
  function movePreview(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width - .5) * 18}px`)
    event.currentTarget.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height - .5) * 18}px`)
  }
  function resetPreview(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--mx", "0px")
    event.currentTarget.style.setProperty("--my", "0px")
  }
  function movePage(event: PointerEvent<HTMLElement>) {
    event.currentTarget.style.setProperty("--px", `${event.clientX}px`)
    event.currentTarget.style.setProperty("--py", `${event.clientY}px`)
  }
  return (
    <main className="site-shell" id="top" onPointerMove={movePage}>
      <div className="scroll-progress"/><div className="cursor-aurora"/>
      <div className="ambient ambient-one"/><div className="ambient ambient-two"/>
      <div className="top-note"><span className="pulse-dot"/>Payments now settling on GOAT Network <a href="#workflow">See the live flow <Icon name="arrow" size={14}/></a></div>
      <nav className="nav-wrap glass" aria-label="Main navigation">
        <Link href="/" className="brand" aria-label="PayMate home"><span className="brand-mark"><span/></span><b>PayMate</b><small>WORK, SETTLED.</small></Link>
        <div className={`nav-links ${menu ? "open" : ""}`}>
          <a href="#product"><span>01</span>Product</a><a href="#workflow"><span>02</span>Workflow</a><a href="#security"><span>03</span>Security</a><Link href="/docs"><span>04</span>Docs</Link>
          <Link href="/dashboard" className="mobile-cta">Open workspace <Icon name="arrow" size={17}/></Link>
        </div>
        <div className="nav-actions"><span className="network-live"><i/>GOAT LIVE</span><Link href="/dashboard" className="button button-dark nav-cta">Open workspace <Icon name="arrow" size={17}/></Link></div>
        <button className="menu-button" onClick={() => setMenu(!menu)} aria-label="Toggle menu"><Icon name={menu ? "close" : "menu"}/></button>
      </nav>

      <section className="hero section-pad">
        <div className="hero-grid"/><div className="hero-particle p-one"/><div className="hero-particle p-two"/><div className="hero-particle p-three"/>
        <div className="hero-copy">
          <div className="eyebrow"><span className="pulse-dot"/>The settlement layer for independent work</div>
          <h1><span className="hero-line"><span>Get paid.</span></span><span className="hero-line"><span className="ink-swipe">Keep the proof.</span></span></h1>
          <p className="hero-lede">Create deterministic invoices, collect on-chain payments, and build portable ERC-8004 reputation — for freelancers <em>and autonomous agents</em> — on the GOAT Network.</p>
          <div className="hero-actions">
            <Link href="/dashboard" className="button button-primary magnetic-cta">Create an invoice <Icon name="arrow"/><span className="button-glow"/></Link>
            <a href="#workflow" className="text-link"><span className="play"><Icon name="chevron" size={15}/></span> See how it works</a>
          </div><div className="hero-live-row"><span><i/>LIVE ON GOAT</span><span>USDC SETTLEMENT</span><span>ERC—8004 PROOF</span></div>
          <div className="micro-proof"><div className="avatar-stack"><i>AM</i><i>RJ</i><i>SK</i><i>+</i></div><span>Built for the next <b>100M</b> independent workers</span></div>
        </div>

        <div className="hero-visual" aria-label="PayMate invoice product preview" onPointerMove={movePreview} onPointerLeave={resetPreview}>
          <div className="clay-shape clay-a"/><div className="clay-shape clay-b"/>
          <div className="preview-window glass-heavy">
            <div className="preview-top"><div className="window-dots"><i/><i/><i/></div><span>paymateagent.xyz/invoice/…</span><Icon name="lock" size={15}/></div>
            <div className="preview-body">
              <aside className="mini-sidebar"><span className="brand-mark small"><span/></span><div className="side-line active"/><div className="side-line"/><div className="side-line short"/><div className="sidebar-user">MS</div></aside>
              <div className="invoice-preview">
                <div className="invoice-heading"><div><span className="label">INVOICE</span><h3>Brand system sprint</h3><p>From Salman Studio</p></div><div className="paid-stamp"><Icon name="check" size={15}/> Ready</div></div>
                <div className="invoice-amount"><span>Amount due</span><strong>$2,480.00</strong><em>USDC · GOAT Network</em></div>
                <div className="invoice-lines"><div><span>Discovery & strategy</span><b>$680</b></div><div><span>Visual identity system</span><b>$1,400</b></div><div><span>Launch toolkit</span><b>$400</b></div></div>
                <button className="pay-preview">Review & pay <Icon name="arrow" size={17}/></button>
              </div>
            </div>
          </div>
          <div className="float-card float-reputation glass"><Icon name="shield"/><div><span>Reputation</span><b>94 / 100</b></div><small>+8</small></div>
          <div className="float-card float-paid glass"><span className="success-orb"><Icon name="check" size={16}/></span><div><b>Payment verified</b><span>2,480 USDC received</span></div></div>
          <div className="chain-orbit"><i/><i/><i/><span>GOAT</span></div><div className="compose-chip glass"><Icon name="spark" size={15}/><span><b>Deterministic draft ready</b><small>Scope · amount · terms</small></span><i/></div>
        </div><a className="scroll-cue" href="#product"><span>SCROLL TO EXPLORE</span><i/></a>
      </section>

      <section className="proof-strip"><div className="proof-track"><span>POWERING TRUSTED WORK ON</span><b>GOAT</b><b>OPENCLAW</b><b>ERC—8004</b><b>x402</b><b>USDC</b><span>DIRECT SETTLEMENT</span><b>PORTABLE TRUST</b></div></section>

      <KineticTicker />

      <section className="signal-rail section-pad" aria-label="PayMate platform capabilities">
        <article><span>01</span><Icon name="invoice"/><div><b>Smart invoices</b><small>Clear terms, no guesswork</small></div></article>
        <article><span>02</span><Icon name="bolt"/><div><b>x402 settlement</b><small>Verified on GOAT</small></div></article>
        <article><span>03</span><Icon name="shield"/><div><b>Portable reputation</b><small>Proof that compounds</small></div></article>
        <article><span>04</span><Icon name="wallet"/><div><b>Direct to wallet</b><small>Never custodial</small></div></article>
      </section>

      <LiveLedger />

      <section className="story-section section-pad" id="product">
        <div className="section-kicker">THE DEFINITIVE SETTLEMENT LAYER</div>
        <div className="story-head"><h2>From “done” to paid—<br/>without the admin spiral.</h2><p>PayMate connects the work, the money, and the reputation. One focused workflow instead of five disconnected tools.</p></div>
        <div className="bento-grid">
          <article className="bento bento-large warm"><div className="bento-copy"><span className="mini-index">01 / DRAFT</span><h3>Say what you did.<br/>We’ll handle the invoice.</h3><p>Describe the work naturally. PayMate turns it into a clear, client-ready payment request in seconds.</p></div><div className="prompt-card glass"><div className="prompt-top"><Icon name="spark"/><span>Invoice composer</span><kbd>⌘ ↵</kbd></div><p>“Brand strategy and launch system for Northstar, including two workshops and final asset handoff...”</p><div className="prompt-footer"><span>Scope detected · 3 line items</span><button><Icon name="arrow" size={16}/></button></div></div></article>
          <article className="bento dark-card"><div className="orbit"><div className="orbit-ring one"/><div className="orbit-ring two"/><div className="orbit-center"><Icon name="network" size={30}/></div><span className="orbit-node n1">01</span><span className="orbit-node n2">02</span><span className="orbit-node n3">03</span></div><div className="bento-copy"><span className="mini-index">02 / PROVE</span><h3>Reputation that compounds.</h3><p>Verified work becomes a portable credential—not a screenshot buried in a profile.</p></div></article>
          <article className="bento mint"><div className="bento-copy"><span className="mini-index">03 / SETTLE</span><h3>Fast money.<br/>Final settlement.</h3></div><div className="settle-stack"><div className="settle-row"><span className="coin">$</span><div><small>CLIENT SENT</small><b>2,480.00 USDC</b></div><Icon name="check"/></div><div className="settle-line"><i/><i/><i/></div><div className="settle-row muted"><Icon name="wallet"/><div><small>YOUR WALLET</small><b>Funds available</b></div><span className="live-dot"/></div></div></article>
        </div>
      </section>

      <section className="machine-economy section-pad" style={{background: '#317454', color: 'white', padding: '100px 5%'}}>
        <div style={{maxWidth: '1200px', margin: '0 auto'}}>
          <span className="section-kicker" style={{color: '#a7f3d0'}}>THE MACHINE ECONOMY, FULLY REALIZED</span>
          <h2 style={{fontSize: '3rem', margin: '20px 0'}}>Zero human approvals.<br/><em>Infinite execution.</em></h2>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', marginTop: '60px'}}>
            <article style={{background: 'rgba(0,0,0,0.2)', padding: '30px', borderRadius: '16px'}}>
              <div style={{color: '#a7f3d0', marginBottom: '15px'}}><Icon name="shield" size={24}/></div>
              <h3 style={{fontSize: '1.5rem', marginBottom: '15px'}}>Proof-of-Code Settlement</h3>
              <p style={{color: '#e5e7eb', lineHeight: '1.6'}}>PayMate doesn&apos;t trust humans to verify work. We trust cryptographic execution. Merge the GitHub PR, execute the tests, and route the money automatically. Zero human approvals required.</p>
            </article>
            <article style={{background: 'rgba(0,0,0,0.2)', padding: '30px', borderRadius: '16px'}}>
              <div style={{color: '#a7f3d0', marginBottom: '15px'}}><Icon name="spark" size={24}/></div>
              <h3 style={{fontSize: '1.5rem', marginBottom: '15px'}}>Intent-Based Omni-Channel Payroll</h3>
              <p style={{color: '#e5e7eb', lineHeight: '1.6'}}>Invoicing shouldn&apos;t be a software tool you have to log into. Drop a prompt to our Telegram AI Agent, and PayMate parses your intent, drafts the smart invoice, and drops a Web3 payment link directly in your chat.</p>
            </article>
            <article style={{background: 'rgba(0,0,0,0.2)', padding: '30px', borderRadius: '16px'}}>
              <div style={{color: '#a7f3d0', marginBottom: '15px'}}><Icon name="network" size={24}/></div>
              <h3 style={{fontSize: '1.5rem', marginBottom: '15px'}}>The Supreme AI Court</h3>
              <p style={{color: '#e5e7eb', lineHeight: '1.6'}}>If a client and an AI worker disagree, we don&apos;t use human mediators. A panel of Mistral-powered AI Arbitrators analyzes the original scope, reviews the commits, and mathematically executes a binding on-chain verdict.</p>
            </article>
            <article style={{background: 'rgba(0,0,0,0.2)', padding: '30px', borderRadius: '16px'}}>
              <div style={{color: '#a7f3d0', marginBottom: '15px'}}><Icon name="spark" size={24}/></div>
              <h3 style={{fontSize: '1.5rem', marginBottom: '15px'}}>Autonomous Swarm Delegation</h3>
              <p style={{color: '#e5e7eb', lineHeight: '1.6'}}>PayMate doesn&apos;t just process human-to-machine payments. A Lead AI Agent can act as a CEO, autonomously spinning up sub-invoices to hire and pay other specialist agents to complete a massive project.</p>
            </article>
            <article style={{background: 'rgba(0,0,0,0.2)', padding: '30px', borderRadius: '16px'}}>
              <div style={{color: '#a7f3d0', marginBottom: '15px'}}><Icon name="shield" size={24}/></div>
              <h3 style={{fontSize: '1.5rem', marginBottom: '15px'}}>Zero-Knowledge Portfolios</h3>
              <p style={{color: '#e5e7eb', lineHeight: '1.6'}}>We are killing the resume. You don&apos;t have to trust that an agent knows Rust or Python. Their ERC-8004 credential contains cryptographic, Zero-Knowledge proof of every bug they&apos;ve ever fixed.</p>
            </article>
            <article style={{background: 'rgba(0,0,0,0.2)', padding: '30px', borderRadius: '16px'}}>
              <div style={{color: '#a7f3d0', marginBottom: '15px'}}><Icon name="bolt" size={24}/></div>
              <h3 style={{fontSize: '1.5rem', marginBottom: '15px'}}>Continuous Streaming Payments</h3>
              <p style={{color: '#e5e7eb', lineHeight: '1.6'}}>We are killing the bi-weekly paycheck. Using the x402 protocol, USDC streams directly into the AI agent’s or freelancer&apos;s wallet by the second as the compute or work is delivered. If the contract stops, the money stops flowing instantly.</p>
            </article>
          </div>
        </div>
      </section>



      <section className="agent-band section-pad" style={{background: '#f1efe9', padding: '90px 5%', borderTop: '1px solid var(--line)'}}>
        <div style={{maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '40px', alignItems: 'center'}}>
          <div>
            <span className="section-kicker">BUILT FOR THE OPENCLAW ECONOMY</span>
            <h2 style={{fontSize: '2.6rem', margin: '18px 0'}}>Every agent gets paid.<br/><em>Instant. Verified. Non-custodial.</em></h2>
            <p style={{color: 'var(--muted)', lineHeight: 1.6, maxWidth: '480px'}}>PayMate is a native OpenClaw Skill — the billing rail for the agent economy. Any OpenClaw agent installs the skill once and can invoice clients, collect USDC on GOAT, and mint portable ERC-8004 reputation.</p>
            <div style={{display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap'}}>
              <Link href="/docs" className="button button-dark">Integrate your agent <Icon name="arrow" size={16}/></Link>
              <Link href="/dashboard" className="button button-outline">Open the workspace</Link>
            </div>
          </div>
          <div className="glass-heavy" style={{borderRadius: '20px', padding: '24px', position: 'relative'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'}}>
              <span style={{fontWeight: 800, fontSize: '13px'}}>Install the PayMate skill</span>
              <span style={{marginLeft: 'auto', background: '#e7f5ec', color: '#317454', padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 800}}>OPENCLAW</span>
            </div>
            <pre style={{background: '#171813', color: '#c9fa78', padding: '18px', borderRadius: '12px', fontSize: '13px', lineHeight: 1.7, overflowX: 'auto', margin: 0}}><code>openclaw skill install
  https://paymateagent.xyz/openclaw-skill.json</code></pre>
            <p style={{fontSize: '12px', color: 'var(--muted)', marginTop: '14px', lineHeight: 1.5}}>Then your agent calls <b>generate_invoice</b> and returns a live settlement link to its client — no signup, no custody, no approval chain.</p>
          </div>
        </div>
      </section>

      <section className="protocol-showcase section-pad">
        <div className="protocol-copy"><span className="section-kicker">VERIFIABLE BY DEFAULT</span><h2>Every payment leaves<br/><em>clean evidence.</em></h2><p>PayMate turns a client payment into a chain of facts: explicit terms, exact settlement, verified receipt, and portable reputation.</p><Link href="/docs" className="button button-outline">Read the protocol docs <Icon name="arrow"/></Link></div>
        <LiveTrace />
      </section>

      <section className="workflow section-pad" id="workflow">
        <div className="workflow-intro"><span className="section-kicker">HOW IT MOVES</span><h2>One clean line<br/>from work to wallet.</h2><p>Every step is legible. Every state is verifiable. Nothing disappears into a black box.</p><Link href="/dashboard" className="button button-outline">Start your first invoice <Icon name="arrow"/></Link></div>
        <div className="steps">{features.map((f, i)=><article className="step" key={f.n}><div className="step-icon"><Icon name={f.icon}/></div><div><span>{f.n}</span><h3>{f.title}</h3><p>{f.text}</p></div>{i < features.length-1 && <div className="step-rail"/>}</article>)}</div>
      </section>

      <section className="security-band" id="security"><div><span className="section-kicker light">BUILT ON OPEN RAILS</span><h2>Trust the transaction.<br/>Own the relationship.</h2></div><div className="security-points"><p><Icon name="lock"/><span><b>Non-custodial by design</b>Payments move directly wallet to wallet. PayMate never holds your funds.</span></p><p><Icon name="shield"/><span><b>Verified settlement</b>On-chain proof removes ambiguity from every completed invoice.</span></p><p><Icon name="globe"/><span><b>Portable reputation</b>Your work history goes with you, across platforms and borders.</span></p></div></section>

      <section className="closing section-pad"><div className="closing-mark"><span className="brand-mark giant"><span/></span></div><div><span className="section-kicker">NO MORE CHASING</span><h2>Make the work.<br/>Send the link.<br/><em>Get paid.</em></h2><Link href="/dashboard" className="button button-primary">Open PayMate <Icon name="arrow"/></Link></div></section>
      <footer className="site-footer">
        <div className="footer-cta"><div><span>READY WHEN THE WORK IS</span><h3>One link between<br/>finished and paid.</h3></div><div className="footer-cta-actions"><Link href="/dashboard" className="button footer-primary">Create an invoice <Icon name="arrow"/></Link><Link href="/docs" className="footer-doc-link"><Icon name="invoice"/>Read project docs</Link></div><div className="footer-signal"><i/><span>GOAT NETWORK</span><b>SETTLEMENT LIVE</b></div></div>
        <div className="footer-main">
          <div className="footer-brand"><Link href="/" className="brand"><span className="brand-mark"><span/></span><b>PayMate</b></Link><h3>Good work deserves<br/><em>a clean finish.</em></h3><p>Invoice, settle, and own the proof—without giving up control of your money or reputation.</p></div>
          <div className="footer-links"><div><span>PRODUCT</span><a href="#product">Smart invoices</a><a href="#workflow">Settlement flow</a><a href="#security">Portable trust</a></div><div><span>NETWORK</span><a href="https://www.goat.network" target="_blank" rel="noreferrer">GOAT Network</a><a href="#security">ERC-8004</a><a href="#security">x402 protocol</a></div><div><span>START</span><Link href="/dashboard">Open workspace</Link><Link href="/docs">Documentation</Link><a href="mailto:hello@paymateagent.xyz">Contact</a><a href="mailto:hello@catwallet.io">Partner: CatWallet</a></div></div>
        </div>
        <div className="footer-orbit"><span>PAYMATE</span><div><i/> SETTLEMENT ONLINE</div></div>
        <div className="footer-bottom"><span>© 2026 PayMate · Work, settled.</span><div className="footer-badges"><span><Icon name="lock" size={12}/>Non-custodial</span><span><Icon name="network" size={12}/>GOAT Network</span><span><Icon name="shield" size={12}/>ERC-8004</span></div><div><a href="#">Privacy</a><a href="#">Terms</a><a href="#top">Back to top ↑</a></div></div>
      </footer>
    </main>
  )
}
