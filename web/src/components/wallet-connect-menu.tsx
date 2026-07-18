"use client"

import { useState, useRef, useEffect } from "react"
import { useConnect } from "wagmi"
import { Icon } from "@/components/icons"

const CONNECTOR_LABELS: Record<string, string> = {
  injected: "Browser wallet (MetaMask, Rabby, Brave…)",
  coinbaseWalletSDK: "Coinbase Wallet",
  walletConnect: "WalletConnect",
}

export function WalletConnectMenu({ triggerClassName, triggerLabel }: { triggerClassName: string; triggerLabel: React.ReactNode }) {
  const { connectors, connect } = useConnect()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  if (connectors.length === 1) {
    return (
      <button className={triggerClassName} onClick={() => connect({ connector: connectors[0] })}>
        {triggerLabel}
      </button>
    )
  }

  return (
    <div className="wallet-connect-menu" ref={rootRef}>
      <button className={triggerClassName} onClick={() => setOpen((v) => !v)}>
        {triggerLabel}
      </button>
      {open && (
        <div className="wallet-connect-dropdown glass">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => {
                connect({ connector })
                setOpen(false)
              }}
            >
              <Icon name="wallet" size={15} />
              <span>{CONNECTOR_LABELS[connector.id] || connector.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
