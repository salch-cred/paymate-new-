"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Icon } from "@/components/icons"

const sections = [
  { id: "overview", label: "Use Cases" },
  { id: "discord", label: "Discord Bot" },
  { id: "telegram", label: "Telegram Bot" },
  { id: "growth", label: "Stage 2 Growth" },
  { id: "faq", label: "FAQ" },
]

const faqs = [
  {
    q: "What is PayMate?",
    a: "PayMate is on-chain invoicing and settlement software for independent workers. It creates payment requests, collects payment as a direct wallet-to-wallet USDC transfer via the x402 protocol, verifies that transfer on-chain, and records a portable ERC-8004 reputation credential for the freelancer.",
  },
  {
    q: "How does the Discord Bot work?",
    a: "Our Discord Bot allows server Administrators to type `/invoice` and generate an invoice draft using AI. The bot replies privately with an ephemeral message containing a link to finalize the invoice, keeping financial details secure.",
  },
  {
    q: "What network does PayMate run on?",
    a: "GOAT Network (Testnet3, chain ID 48816). Settlement uses a test USDC token, and the reputation registry is deployed on the same network.",
  },
]

export default function DocsPage(){
 const [query,setQuery]=useState("")
 const visible=useMemo(()=>sections.filter(s=>s.label.toLowerCase().includes(query.toLowerCase())),[query])
 return <main className="docs-shell">
  <header className="docs-header"><Link href="/" className="brand"><span className="brand-mark"><span/></span><b>PayMate</b></Link><span className="docs-slash">/</span><b>PAYMATE DOCUMENTATION</b><div className="docs-search"><Icon name="spark" size={15}/><input aria-label="Filter project documentation" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find use cases…"/><kbd>⌘ K</kbd></div><Link href="/dashboard" className="docs-launch">Open app <Icon name="arrow" size={16}/></Link></header>
  <aside className="docs-sidebar"><div className="docs-version"><i/>PayMate v1.0.0</div><nav><span>DOCUMENTATION</span>{visible.map(s=><a key={s.id} href={`#${s.id}`}>{s.label}</a>)}</nav><div className="docs-side-foot"><Link href="/">← Landing page</Link><Link href="/dashboard">Open workspace</Link></div></aside>
  <article className="docs-content project-docs">
   <div className="docs-breadcrumb">PAYMATE <span>/</span> PROJECT DETAILS</div>
   <section className="docs-hero project-docs-hero" id="overview"><div className="docs-kicker"><span>USE CASES & OVERVIEW</span><i>v1.0.0</i></div><h1>PayMate for AI Agents.</h1><p>PayMate is an intelligent, non-custodial invoicing platform designed for freelancers, DAOs, and AI agents. Create invoices seamlessly through natural language, and settle instantly on the GOAT Network.</p><div className="project-facts"><div><span>NETWORK</span><b>GOAT Testnet3</b></div><div><span>PROTOCOL</span><b>x402 Standards</b></div><div><span>IDENTITY</span><b>ERC-8004 Reputation</b></div></div></section>
   
   <section className="doc-section" id="discord"><div className="doc-index">01</div><div><span className="doc-label">DISCORD INTEGRATION</span><h2>The Discord Bot</h2><p>PayMate deeply integrates into your existing DAO or team Discord server to eliminate friction.</p><div className="doc-callout"><Icon name="shield"/><div><b>Enterprise Security</b><p>The bot is protected by strict timestamp validation to prevent replay attacks, and commands are locked so that only Server Administrators can execute them.</p></div></div><ul className="doc-steps" style={{marginTop: "20px"}}><li><b>Command: `/paymate`</b><p>Instantly launch the PayMate app or share your ClawUp referral link directly with clients inside your server.</p></li><li><b>Command: `/invoice`</b><p>Type `/invoice details: 500 USDC for marketing work` and the AI will draft your invoice instantly. The bot responds with a 100% private, ephemeral message so no one else in the server can see your financial details.</p></li><li><b>Webhooks</b><p>Whenever an invoice is paid on the GOAT network, the backend fires a webhook to announce the verified settlement in your server!</p></li></ul></div></section>

   <section className="doc-section" id="telegram"><div className="doc-index">02</div><div><span className="doc-label">TELEGRAM INTEGRATION</span><h2>The Telegram Bot</h2><p>Because PayMate is part of the OpenClaw ecosystem, we natively support Telegram-based AI agents.</p><p>Users can interact with our smart Telegram webhooks to query their invoices, view their on-chain ERC-8004 reputation, and receive real-time notifications about their OpenClaw growth metrics.</p></div></section>

   <section className="doc-section" id="growth"><div className="doc-index">03</div><div><span className="doc-label">HACKATHON</span><h2>Stage 2 Growth</h2><p>For the OpenClaw Summer Builder Bootcamp Stage 2 (The Growth Challenge), PayMate implemented the following core growth loops:</p><ol className="doc-steps"><li><b>Referral Tracking</b><p>The ClawUp referral link (<code>?ref=f3508f7af8</code>) is hardcoded into the Discord bot and Web Dashboard, ensuring every new user who clicks through credits our team.</p></li><li><b>Frictionless Onboarding</b><p>By keeping the invoice generation process inside Telegram and Discord, users don't have to navigate to a new website to begin their workflow.</p></li></ol></div></section>

   <section className="doc-section" id="faq"><div className="doc-index">04</div><div><span className="doc-label">FAQ</span><h2>Frequently asked questions</h2><div className="doc-faq">{faqs.map(f=><div key={f.q} className="doc-faq-item"><b>{f.q}</b><p>{f.a}</p></div>)}</div></div></section>
   <footer className="docs-footer"><div><span className="brand-mark small"><span/></span><b>PayMate project documentation</b></div><Link href="/dashboard">Open workspace <Icon name="arrow"/></Link></footer>
  </article>
  <aside className="docs-toc"><span>CONTENTS</span>{sections.map(s=><a key={s.id} href={`#${s.id}`}>{s.label}</a>)}<div className="toc-status"><i/><b>GOAT Testnet3</b><small>Live on chain</small></div></aside>
 </main>
}
