"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/icons"
import { WalletConnectMenu } from "@/components/wallet-connect-menu"
import { useAccount, useEnsName } from "wagmi"
import { mainnet } from "wagmi/chains"
import { usePrivy } from "@privy-io/react-auth"

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount()
  const { logout } = usePrivy()
  const { data: ensName } = useEnsName({ address: address as `0x${string}`, chainId: mainnet.id })
  const pathname = usePathname()

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: "chart" as const },
    { label: "Assets", href: "/dashboard/assets", icon: "wallet" as const },
    { label: "Activity", href: "/dashboard/activity", icon: "chart" as const },
    { label: "Swap", href: "/dashboard/swap", icon: "network" as const },
    { label: "Stake", href: "/dashboard/stake", icon: "shield" as const },
    { label: "Marketplace", href: "/dashboard/marketplace", icon: "spark" as const },
    { label: "Bridge", href: "/dashboard/bridge", icon: "network" as const },
    { label: "Identity", href: "/dashboard/identity", icon: "users" as const },
    { label: "Chat", href: "/dashboard/chat", icon: "send" as const },
    { label: "Cat AI", href: "/dashboard/ai", icon: "spark" as const },
  ]

  return (
    <main className="app-shell">
      <div className="app-frame">
        <aside className="app-sidebar">
          <Link className="brand" href="/">
            <span className="brand-mark"><span/></span><b>PayMate</b>
          </Link>
          <nav className="side-nav">
            {navItems.map(item => (
              <Link 
                key={item.label} 
                href={item.href} 
                className={pathname === item.href ? "active" : ""}
              >
                <Icon name={item.icon}/><span>{item.label}</span>
              </Link>
            ))}
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
          {children}
        </section>
      </div>
    </main>
  )
}
