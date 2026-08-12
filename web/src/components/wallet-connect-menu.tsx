"use client"

import { usePrivy } from "@privy-io/react-auth"

export function WalletConnectMenu({ triggerClassName, triggerLabel }: { triggerClassName: string; triggerLabel: React.ReactNode }) {
  const { login, ready } = usePrivy()

  return (
    <button type="button" disabled={!ready} className={triggerClassName} onClick={() => login()}>
      {triggerLabel}
    </button>
  )
}
