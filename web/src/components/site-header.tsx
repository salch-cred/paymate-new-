"use client"

import { useState } from "react"
import Link from "next/link"
import { Icon } from "@/components/icons"

const DEFAULT_LINKS = [
  { href: "/", label: "Product" },
  { href: "/dashboard/marketplace", label: "Marketplace" },
  { href: "/economy", label: "Economy" },
  { href: "/metrics", label: "Metrics" },
  { href: "/docs", label: "Docs" },
]

export function SiteHeader({
  active,
  links = DEFAULT_LINKS,
  showActions = true,
  payLink = false,
}: {
  active?: string
  links?: { href: string; label: string }[]
  showActions?: boolean
  payLink?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <header className="landing-header">
      <Link href="/" className="landing-brand" aria-label="PayMate home">
        <span className="brand-mark"><span /></span>
        <span><b>PayMate</b><small>WORK, SETTLED.</small></span>
      </Link>
      <nav className={open ? "landing-nav open" : "landing-nav"} aria-label="Main navigation">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={active === l.href ? "landing-nav-active" : ""}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <button
        className="landing-menu"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle navigation"
        aria-expanded={open}
      >
        <Icon name={open ? "close" : "menu"} size={21} />
      </button>
      {showActions && (
        <div className="landing-header-actions">
          <span className="landing-network"><i />GOAT MAINNET</span>
          {payLink && (
            <Link href="/pay" className="landing-pay-link">Pay an invoice</Link>
          )}
          <Link href="/dashboard" className="button button-dark">
            Open dashboard <Icon name="arrow" size={16} />
          </Link>
        </div>
      )}
    </header>
  )
}
