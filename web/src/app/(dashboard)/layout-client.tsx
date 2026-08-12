"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/icons"
import { NotificationCenter } from "@/components/notification-center"
import { WalletConnectMenu } from "@/components/wallet-connect-menu"
import { useAccount, useEnsName } from "wagmi"
import { mainnet } from "wagmi/chains"
import { usePrivy } from "@privy-io/react-auth"

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount()
  const { logout } = usePrivy()
  const { data: ensName } = useEnsName({ address: address as `0x${string}`, chainId: mainnet.id })
  const pathname = usePathname()

  return (
    <main className="app-shell">
      <div className="app-frame">
        <aside className="app-sidebar">
          <Link className="brand" href="/">
            <img src="/logo-app-v2.png" alt="PayMate Logo" className="brand-mark" style={{background: 'transparent', padding: 0}} /><b>PayMate</b>
          </Link>
          <nav className="side-nav">
            <span className="nav-label">WORKSPACE</span>
            <Link href="/dashboard" className={pathname === "/dashboard" ? "active" : ""}><Icon name="chart"/><span>Dashboard</span></Link>
            <Link href="/dashboard/analytics" className={pathname === "/dashboard/analytics" ? "active" : ""}><Icon name="chart"/><span>Analytics</span></Link>
            <Link href="/developers" className={pathname === "/developers" ? "active" : ""}><Icon name="network"/><span>Developers</span></Link>
            
            <span className="nav-label" style={{marginTop: '16px'}}>PROTOCOL</span>
            <Link href="/treasury" className={pathname === "/treasury" ? "active" : ""}><Icon name="receipt"/><span>Treasury</span></Link>
            <Link href="/dashboard/marketplace" className={pathname === "/dashboard/marketplace" ? "active" : ""}><Icon name="spark"/><span>Marketplace</span></Link>
            <Link href="/docs" className={pathname === "/docs" ? "active" : ""}><Icon name="send"/><span>Docs</span></Link>
          </nav>
          <div className="sidebar-foot">
            <div className="network-chip"><i/><span>GOAT Network · Live</span></div>
            <a href="https://clawup.org/?ref=f3508f7af8" target="_blank" rel="noreferrer" style={{display:'flex', alignItems:'center', gap:'6px', marginTop:'12px', fontSize:'12px', color:'var(--text-muted)', textDecoration:'none'}}>
              <Icon name="spark" size={12}/>Powered by ClawUp
            </a>
          </div>
        </aside>
        
        <section className="app-main">
          <header className="app-topbar">
            <div>
              <span className="workspace-label">PAYMATE CONTROL CENTER</span>
              <h1>Money, proof, momentum.</h1>
              <p>Create invoices and track verified settlement from one workspace.</p>
            </div>
            <div className="topbar-actions">
              <NotificationCenter />
              <Link href="/docs" className="topbar-icon"><Icon name="invoice" size={17}/></Link>
              {isConnected ? (
                <button className="wallet-button" onClick={() => logout()}>
                  <span className="live-dot"/>{ensName || `${address?.slice(0,6)}…${address?.slice(-4)}`}
                </button>
              ) : (
                <WalletConnectMenu triggerClassName="wallet-button primary" triggerLabel={<><Icon name="wallet" size={17}/>Connect wallet</>} />
              )}
            </div>
          </header>
          <div className="app-content">
            {children}
          </div>
        </section>
      </div>
    </main>
  )
}
