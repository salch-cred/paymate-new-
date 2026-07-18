"use client"

import Link from "next/link"
import { useState, type PointerEvent } from "react"
import { Icon } from "@/components/icons"

const features = [
  { icon: "spark" as const, n: "01", title: "Describe the work", text: "Write the scope in plain language. PayMate structures the job, price, and terms into a clean invoice." },
  { icon: "link" as const, n: "02", title: "Share one link", text: "Send a polished payment page that works with any injected Web3 wallet—no account setup required." },
  { icon: "shield" as const, n: "03", title: "Build portable trust", text: "Every verified settlement strengthens your ERC-8004 reputation on GOAT Network." },
]

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
          <div className="eyebrow"><span className="pulse-dot"/>Payments, built for independent work</div>
          <h1><span className="hero-line"><span>Get paid.</span></span><span className="hero-line"><span className="ink-swipe">Keep the proof.</span></span></h1>
          <p className="hero-lede">Create intelligent invoices, collect on-chain payments, and turn every finished job into reputation you actually own.</p>
          <div className="hero-actions">
            <Link href="/dashboard" className="button button-primary magnetic-cta">Create an invoice <Icon name="arrow"/><span className="button-glow"/></Link>
            <a href="#workflow" className="text-link"><span className="play"><Icon name="chevron" size={15}/></span> See how it works</a>
          </div><div className="hero-live-row"><span><i/>LIVE ON GOAT</span><span>USDC SETTLEMENT</span><span>ERC—8004 PROOF</span></div>
          <div className="micro-proof"><div className="avatar-stack"><i>AM</i><i>RJ</i><i>SK</i><i>+</i></div><span>Built for the next <b>100M</b> independent workers</span></div>
        </div>

        <div className="hero-visual" aria-label="PayMate invoice product preview" onPointerMove={movePreview} onPointerLeave={resetPreview}>
          <div className="clay-shape clay-a"/><div className="clay-shape clay-b"/>
          <div className="preview-window glass-heavy">
            <div className="preview-top"><div className="window-dots"><i/><i/><i/></div><span>paymate.work/invoice/PM-2948</span><Icon name="lock" size={15}/></div>
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
          <div className="chain-orbit"><i/><i/><i/><span>GOAT</span></div><div className="compose-chip glass"><Icon name="spark" size={15}/><span><b>Intelligent draft ready</b><small>Scope · amount · terms</small></span><i/></div>
        </div><a className="scroll-cue" href="#product"><span>SCROLL TO EXPLORE</span><i/></a>
      </section>

      <section className="proof-strip"><div className="proof-track"><span>POWERING TRUSTED WORK ON</span><b>GOAT</b><b>ERC—8004</b><b>x402</b><b>USDC</b><span>DIRECT SETTLEMENT</span><b>PORTABLE TRUST</b></div></section>

      <section className="kinetic-ticker" aria-label="Live settlement activity"><div><span><i/>INVOICE PM-2948 CREATED</span><b>→</b><span>2,480 USDC REQUESTED</span><b>→</b><span>TRANSFER 0x8F2A…E19C</span><b>→</b><span className="ticker-verified"><Icon name="check" size={13}/>SETTLEMENT VERIFIED</span><b>→</b><span>REPUTATION +34</span></div></section>

      <section className="signal-rail section-pad" aria-label="PayMate platform capabilities">
        <article><span>01</span><Icon name="invoice"/><div><b>Smart invoices</b><small>Clear terms, no guesswork</small></div></article>
        <article><span>02</span><Icon name="bolt"/><div><b>x402 settlement</b><small>Verified on GOAT</small></div></article>
        <article><span>03</span><Icon name="shield"/><div><b>Portable reputation</b><small>Proof that compounds</small></div></article>
        <article><span>04</span><Icon name="wallet"/><div><b>Direct to wallet</b><small>Never custodial</small></div></article>
      </section>

      <section className="story-section section-pad" id="product">
        <div className="section-kicker">THE OPERATING LAYER FOR INDEPENDENT WORK</div>
        <div className="story-head"><h2>From “done” to paid—<br/>without the admin spiral.</h2><p>PayMate connects the work, the money, and the reputation. One focused workflow instead of five disconnected tools.</p></div>
        <div className="bento-grid">
          <article className="bento bento-large warm"><div className="bento-copy"><span className="mini-index">01 / DRAFT</span><h3>Say what you did.<br/>We’ll handle the invoice.</h3><p>Describe the work naturally. PayMate turns it into a clear, client-ready payment request in seconds.</p></div><div className="prompt-card glass"><div className="prompt-top"><Icon name="spark"/><span>Invoice composer</span><kbd>⌘ ↵</kbd></div><p>“Brand strategy and launch system for Northstar, including two workshops and final asset handoff...”</p><div className="prompt-footer"><span>Scope detected · 3 line items</span><button><Icon name="arrow" size={16}/></button></div></div></article>
          <article className="bento dark-card"><div className="orbit"><div className="orbit-ring one"/><div className="orbit-ring two"/><div className="orbit-center"><Icon name="network" size={30}/></div><span className="orbit-node n1">01</span><span className="orbit-node n2">02</span><span className="orbit-node n3">03</span></div><div className="bento-copy"><span className="mini-index">02 / PROVE</span><h3>Reputation that compounds.</h3><p>Verified work becomes a portable credential—not a screenshot buried in a profile.</p></div></article>
          <article className="bento mint"><div className="bento-copy"><span className="mini-index">03 / SETTLE</span><h3>Fast money.<br/>Final settlement.</h3></div><div className="settle-stack"><div className="settle-row"><span className="coin">$</span><div><small>CLIENT SENT</small><b>2,480.00 USDC</b></div><Icon name="check"/></div><div className="settle-line"><i/><i/><i/></div><div className="settle-row muted"><Icon name="wallet"/><div><small>YOUR WALLET</small><b>Funds available</b></div><span className="live-dot"/></div></div></article>
        </div>
      </section>

      <section className="protocol-showcase section-pad">
        <div className="protocol-copy"><span className="section-kicker">VERIFIABLE BY DEFAULT</span><h2>Every payment leaves<br/><em>clean evidence.</em></h2><p>PayMate turns a client payment into a chain of facts: explicit terms, exact settlement, verified receipt, and portable reputation.</p><Link href="/docs" className="button button-outline">Read the protocol docs <Icon name="arrow"/></Link></div>
        <div className="protocol-console glass-heavy"><div className="console-bar"><span><i/><i/><i/></span><b>LIVE SETTLEMENT TRACE</b><small>GOAT · 12,841,092</small></div><div className="trace-row active"><span>01</span><Icon name="invoice"/><div><b>Invoice created</b><small>PM-2948 · 2,480.00 USDC</small></div><em>00:00.00</em></div><div className="trace-line"><i/></div><div className="trace-row"><span>02</span><Icon name="wallet"/><div><b>Transfer submitted</b><small>0x8f2a…e19c</small></div><em>00:04.28</em></div><div className="trace-line"><i/></div><div className="trace-row verified"><span>03</span><Icon name="shield"/><div><b>Settlement verified</b><small>Token · recipient · amount</small></div><em>FINAL</em></div><div className="console-proof"><span>PROOF</span><code>0x71E4 · 2480000000 · 0x8f2a</code><Icon name="check"/></div></div>
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
          <div className="footer-links"><div><span>PRODUCT</span><a href="#product">Smart invoices</a><a href="#workflow">Settlement flow</a><a href="#security">Portable trust</a></div><div><span>NETWORK</span><a href="https://www.goat.network" target="_blank" rel="noreferrer">GOAT Network</a><a href="#security">ERC-8004</a><a href="#security">x402 protocol</a></div><div><span>START</span><Link href="/dashboard">Open workspace</Link><Link href="/docs">Documentation</Link><a href="mailto:hello@paymate.work">Contact</a></div></div>
        </div>
        <div className="footer-orbit"><span>PAYMATE</span><div><i/> SETTLEMENT ONLINE</div></div>
        <div className="footer-bottom"><span>© 2026 PayMate · Work, settled.</span><div className="footer-badges"><span><Icon name="lock" size={12}/>Non-custodial</span><span><Icon name="network" size={12}/>GOAT Network</span><span><Icon name="shield" size={12}/>ERC-8004</span></div><div><a href="#">Privacy</a><a href="#">Terms</a><a href="#top">Back to top ↑</a></div></div>
      </footer>
    </main>
  )
}
