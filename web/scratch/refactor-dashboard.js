const fs = require('fs');
const path = require('path');

const pagePath = path.resolve('src/app/dashboard/page.tsx');
let pageContent = fs.readFileSync(pagePath, 'utf8');

// The layout client content
const layoutClientContent = `"use client"

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
  const { data: ensName } = useEnsName({ address: address as \`0x\${string}\`, chainId: mainnet.id })
  const pathname = usePathname()

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: "chart" as const },
    { label: "Assets", href: "/dashboard/assets", icon: "wallet" as const },
    { label: "Activity", href: "/dashboard/activity", icon: "chart" as const },
    { label: "Swap", href: "/dashboard/swap", icon: "network" as const },
    { label: "Stake", href: "/dashboard/stake", icon: "shield" as const },
    { label: "Skill Mint", href: "/dashboard/skillmint", icon: "spark" as const },
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
                  <span className="live-dot"/>{ensName || \`\${address?.slice(0,6)}…\${address?.slice(-4)}\`}
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
`;

fs.writeFileSync(path.resolve('src/app/dashboard/layout-client.tsx'), layoutClientContent);

// The layout server component
const layoutContent = `import type { Metadata } from "next"
import { DashboardLayoutClient } from "./layout-client"

export const metadata: Metadata = {
  title: "PayMate | Dashboard",
  description:
    "Draft AI-powered invoices and view your ERC-8004 on-chain reputation score on GOAT Network.",
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>
}
`;

fs.writeFileSync(path.resolve('src/app/dashboard/layout.tsx'), layoutContent);

// Replace start
const returnStartStr = 'return <main className="app-shell"><div className="app-frame"><aside className="app-sidebar"><Link className="brand" href="/"><span className="brand-mark"><span/></span><b>PayMate</b></Link><nav className="side-nav"><span className="nav-label">WORKSPACE</span><Link className="active" href="/dashboard"><Icon name="chart"/><span>Overview</span></Link><a href="#new"><Icon name="invoice"/><span>New invoice</span></a><a href="#activity"><Icon name="users"/><span>Activity</span></a><a href="#developer"><Icon name="package"/><span>Developer Portal</span></a><span className="nav-label">IDENTITY</span><a href="#reputation"><Icon name="shield"/><span>Reputation</span></a><a href="#feedback"><Icon name="send"/><span>Feedback</span></a></nav><div className="sidebar-foot"><div className="network-chip"><i/><span>GOAT Network · Live</span></div><a href="https://clawup.org/?ref=f3508f7af8" target="_blank" style={{display:'flex', alignItems:'center', gap:'6px', marginTop:'12px', fontSize:'12px', color:'var(--text-muted)', textDecoration:'none'}}><Icon name="spark" size={12}/>Powered by ClawUp</a></div></aside>\n <section className="app-main"><header className="app-topbar"><div><span className="workspace-label">PAYMATE CONTROL CENTER</span><h1>Money, proof, momentum.</h1><p>Create invoices and track verified settlement from one workspace.</p></div><div className="topbar-actions"><Link href="/docs" className="topbar-icon"><Icon name="invoice" size={17}/></Link>{isConnected?<button className="wallet-button" onClick={()=>logout()}><span className="live-dot"/>{ensName||`${address?.slice(0,6)}…${address?.slice(-4)}`}</button>:<WalletConnectMenu triggerClassName="wallet-button primary" triggerLabel={<><Icon name="wallet" size={17}/>Connect wallet</>}/>}</div></header>';
if (pageContent.includes(returnStartStr)) {
  pageContent = pageContent.replace(returnStartStr, 'return <>\n');
} else {
    console.error("Could not find the exact return string to replace.");
}

// Replace end
const returnEndStr = '</section></div></main>\n}';
if (pageContent.includes(returnEndStr)) {
  pageContent = pageContent.replace(returnEndStr, '</>\n}');
} else {
    pageContent = pageContent.replace(/<\/section><\/div><\/main>[\s\S]*$/, '</>\n}\n');
}

fs.writeFileSync(pagePath, pageContent);
console.log("Refactoring complete.");
