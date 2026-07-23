"use client"

import { usePrivy } from "@privy-io/react-auth"

export function WalletConnectMenu({ triggerClassName, triggerLabel }: { triggerClassName: string; triggerLabel: React.ReactNode }) {
  const { login } = usePrivy()

  return (
    <button className={triggerClassName} onClick={() => login()}>
      {triggerLabel}
    </button>
  )
}
