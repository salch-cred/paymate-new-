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
          <a href="https://discord.com" target="_blank" rel="noreferrer">Discord <Icon name="arrow" size={12}/></a>
          <Link href="/dashboard" style={{color:'#317454'}}>Dashboard</Link>
        </div>
      </nav>

      {children}
    </div>
  )
}
