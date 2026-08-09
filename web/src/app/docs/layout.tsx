"use client"

import Link from "next/link"
import "./docs.css"
import { Icon } from "@/components/icons"
import { usePathname } from "next/navigation"

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="docs-shell">
      <nav className="docs-nav">
        <Link href="/" className="docs-brand" aria-label="PayMate home">
          <span className="brand-mark"><span/></span>
          <b>PayMate</b> <span style={{fontWeight:400, color:'var(--muted)', fontSize:'16px'}}>Docs</span>
        </Link>
        <div className="docs-nav-links">
          <Link href="/docs" className={pathname === "/docs" ? "active" : ""}>Documentation</Link>
          <a href="https://github.com/salman" target="_blank" rel="noreferrer">GitHub <Icon name="arrow" size={12}/></a>
          <a href="https://discord.com" target="_blank" rel="noreferrer">Discord <Icon name="arrow" size={12}/></a>
          <Link href="/dashboard" style={{color:'#317454'}}>Dashboard</Link>
        </div>
      </nav>

      <div className="docs-layout">
        <aside className="docs-sidebar">
          <div className="docs-sidebar-group">
            <h4>Getting Started</h4>
            <div className="docs-sidebar-links">
              <Link href="/docs" className={pathname === "/docs" ? "active" : ""}>Introduction</Link>
              <Link href="#quickstart">Quickstart</Link>
            </div>
          </div>
          <div className="docs-sidebar-group">
            <h4>Core Concepts</h4>
            <div className="docs-sidebar-links">
              <Link href="#x402">x402 Streaming Payments</Link>
              <Link href="#zk">ZK Shielded Invoices</Link>
              <Link href="#escrow">Autonomous GitHub Escrow</Link>
              <Link href="#reputation">ERC-8004 Reputation</Link>
            </div>
          </div>
          <div className="docs-sidebar-group">
            <h4>API Reference</h4>
            <div className="docs-sidebar-links">
              <Link href="#api-invoices">POST /api/invoices</Link>
              <Link href="#api-settle">POST /api/pay/:id/settle</Link>
              <Link href="#api-stream">POST /api/pay/:id/stream</Link>
            </div>
          </div>
        </aside>

        <main className="docs-content">
          {children}
        </main>
      </div>
    </div>
  )
}
