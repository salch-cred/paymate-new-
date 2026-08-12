"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/icons"
import { NotificationCenter } from "@/components/notification-center"
import { WalletConnectMenu } from "@/components/wallet-connect-menu"
import { useAccount, useEnsName } from "wagmi"
import { mainnet } from "wagmi/chains"
import { usePrivy } from "@privy-io/react-auth"

const NAV = [
  {
    label: "WORKSPACE",
    items: [
      { href: "/dashboard", icon: "chart" as const, label: "Dashboard" },
      { href: "/dashboard/analytics", icon: "chart" as const, label: "Analytics" },
      { href: "/developers", icon: "network" as const, label: "Developers" },
    ],
  },
  {
    label: "MARKETPLACE",
    items: [
      { href: "/dashboard/marketplace", icon: "spark" as const, label: "Plugin Hub" },
      { href: "/dashboard/marketplace/plugins", icon: "package" as const, label: "Browse Plugins" },
      { href: "/dashboard/marketplace/publish", icon: "send" as const, label: "Publish Plugin" },
    ],
  },
  {
    label: "PROTOCOL",
    items: [
      { href: "/treasury", icon: "receipt" as const, label: "Treasury" },
      { href: "/growth", icon: "bolt" as const, label: "Growth" },
      { href: "/docs", icon: "invoice" as const, label: "Docs" },
    ],
  },
]

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname.startsWith(href)
}

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount()
  const { logout } = usePrivy()
  const { data: ensName } = useEnsName({ address: address as `0x${string}`, chainId: mainnet.id })
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  return (
    <main className="app-shell">
      <div className="app-frame">
        {/* Mobile overlay backdrop */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 9999 }}
          />
        )}

        <aside className={`app-sidebar ${mobileMenuOpen ? "open" : ""}`}>
          {/* Logo */}
          <div className="sidebar-mobile-header">
            <Link className="brand" href="/" style={{ flex: 1 }}>
              <img
                src="/logo-app-v2.png"
                alt="PayMate"
                className="brand-mark"
                style={{ background: "transparent", padding: 0 }}
              />
              <b>PayMate</b>
            </Link>
            <button className="mobile-menu-close" onClick={() => setMobileMenuOpen(false)}>
              <Icon name="close" size={18} />
            </button>
          </div>

          {/* Desktop logo (hidden on mobile, shown via CSS) */}
          <Link className="brand sidebar-desktop-brand" href="/">
            <img
              src="/logo-app-v2.png"
              alt="PayMate"
              className="brand-mark"
              style={{ background: "transparent", padding: 0 }}
            />
            <b>PayMate</b>
          </Link>

          {/* Navigation */}
          <nav className="side-nav">
            {NAV.map(group => (
              <div key={group.label}>
                <span className="nav-label">{group.label}</span>
                {group.items.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={isActive(pathname, item.href) ? "active" : ""}
                  >
                    <Icon name={item.icon} size={16} />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="sidebar-foot">
            <div className="network-chip">
              <i />
              <span>GOAT Network · Live</span>
            </div>
          </div>
        </aside>

        <section className="app-main">
          {/* Slim top bar — wallet + menu toggle only on mobile */}
          <div className="app-topbar-slim">
            <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(true)}>
              <Icon name="menu" size={20} />
            </button>
            <div style={{ flex: 1 }} />
            <div className="topbar-actions">
              <NotificationCenter />
              {isConnected ? (
                <button className="wallet-button" onClick={() => logout()}>
                  <span className="live-dot" />
                  {ensName || `${address?.slice(0, 6)}…${address?.slice(-4)}`}
                </button>
              ) : (
                <WalletConnectMenu
                  triggerClassName="wallet-button primary"
                  triggerLabel={<><Icon name="wallet" size={15} />Connect wallet</>}
                />
              )}
            </div>
          </div>

          {/* Page content fills the rest */}
          {children}
        </section>
      </div>
    </main>
  )
}
