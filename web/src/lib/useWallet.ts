"use client"

import { useCallback, useEffect, useMemo } from "react"
import { useAccount, useConnect, useConfig, useDisconnect, useSwitchAccount } from "wagmi"
import { usePrivy, useWallets } from "@privy-io/react-auth"

/**
 * Shared wallet-connection hook.
 *
 * Why this exists: the app authenticates with Privy, but transaction signing
 * goes through wagmi. Privy restores its session from storage on page load,
 * while wagmi only reconnects when a `recentConnectorId` was persisted by a
 * previous successful connection. If the login modal never opened (e.g. the
 * Privy iframe was blocked by a CSP), the user is logged into Privy but wagmi
 * stays disconnected — so `useAccount().isConnected` is false and the whole
 * UI shows "Connect wallet" even though the user is signed in.
 *
 * Fix: treat Privy's `authenticated` state as the source of truth, and when
 * Privy has a wallet but wagmi isn't connected, force the Privy connector
 * into wagmi so signing (useWalletClient / writeContract) works.
 */
export function useWallet() {
  const { authenticated, ready, user, logout: privyLogout } = usePrivy()
  const { wallets } = useWallets()
  const wagmi = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchAccount } = useSwitchAccount()
  const config = useConfig()

  // The embedded Privy wallet address (restored with the session even before
  // wagmi reconnects). External linked wallets fall back to wagmi's address.
  const privyAddress = useMemo(() => {
    if (user?.wallet?.address) return user.wallet.address as `0x${string}`
    const wallet = user?.linkedAccounts?.find(
      a => a.type === "wallet" && "address" in a && (a as { address?: string }).address,
    ) as { address?: string } | undefined
    return (wallet?.address as `0x${string}`) ?? undefined
  }, [user])

  const isConnected = ready && authenticated ? true : wagmi.isConnected
  const address = isConnected ? (wagmi.address ?? privyAddress) : undefined

  // Force wagmi to reconnect the Privy wallet when Privy has a session but
  // wagmi never established the connector (the desktop bug).
  const syncWagmi = useCallback(async () => {
    if (!ready || !authenticated) return
    if (wagmi.isConnected) return
    if (wallets.length === 0) return

    const wallet = wallets[0]
    const connectorId =
      wallet.walletClientType === "privy" ? `${wallet.meta.id}.${wallet.address}` : wallet.meta.id
    const connector = config.connectors.find(c => c.id === connectorId)
    if (!connector) return

    try {
      await config.storage?.removeItem(`${connectorId}.disconnected`)
      await config.storage?.setItem("recentConnectorId", connectorId)
      if (config.state.connections.get(connector.uid)) {
        await switchAccount({ connector })
      } else {
        await connect({ connector })
      }
    } catch {
      // Non-fatal: the UI already treats Privy auth as connected, and the
      // next user action (sign request) will surface any real error.
    }
  }, [ready, authenticated, wagmi.isConnected, wallets, config, connect, switchAccount])

  useEffect(() => {
    void syncWagmi()
  }, [syncWagmi])

  /**
   * Full logout: disconnect every wagmi connection, clear wagmi persistence,
   * then clear the Privy session.
   *
   * Why this is needed: calling only Privy's logout() leaves wagmi connected
   * (wagmi keeps its own connector state + storage), so after "logging out"
   * the UI still shows the connected wallet and the Log out button — the
   * button appears broken. wagmi's disconnect() without a connector also only
   * disconnects the *current* connection, so iterate all connections.
   */
  const handleLogout = useCallback(async () => {
    const connections = [...config.state.connections.values()]
    for (const connection of connections) {
      try {
        disconnect({ connector: connection.connector })
      } catch {
        // Per-connector failures are non-fatal; keep clearing the rest.
      }
    }
    try {
      await config.storage?.removeItem("recentConnectorId")
    } catch {
      // Non-fatal: the disconnect above already persisted per-connector
      // "disconnected" flags that prevent auto-reconnect on reload.
    }
    try {
      await privyLogout()
    } catch {
      // Even if the Privy session call fails, wagmi is already cleared and
      // the UI falls back to the disconnected state.
    }
  }, [config, disconnect, privyLogout])

  return { isConnected, address, ready, authenticated, logout: handleLogout }
}
