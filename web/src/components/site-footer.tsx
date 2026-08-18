import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="landing-footer">
      <Link href="/" className="landing-brand">
        <span className="brand-mark"><span /></span>
        <span><b>PayMate</b><small>WORK, SETTLED.</small></span>
      </Link>
      <p>On-chain invoicing and settlement for independent work.</p>
      <nav>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/market">Find work</Link>
        <Link href="/dashboard/marketplace">Marketplace</Link>
        <Link href="/economy">Economy</Link>
        <Link href="/docs">Docs</Link>
      </nav>
      <small>© 2026 PayMate · GOAT Network</small>
    </footer>
  )
}
