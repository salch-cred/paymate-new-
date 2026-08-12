"use client"

import { usePrivy } from "@privy-io/react-auth"

export function WalletConnectMenu({ triggerClassName, triggerLabel }: { triggerClassName: string; triggerLabel: React.ReactNode }) {
  const { login, ready } = usePrivy()

  return (
    <button 
      type="button" 
      className={triggerClassName} 
      onClick={() => {
        if (!ready) console.warn("Privy not fully ready yet, but attempting login anyway.");
        login();
      }}
    >
      {triggerLabel}
    </button>
  )
}
