"use client"

import React, { useState } from 'react'
import { http, createConfig, WagmiProvider } from 'wagmi'
import { injected, coinbaseWallet, walletConnect } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { goatTestnet3 } from '@/lib/chain'

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

export const config = createConfig({
  chains: [goatTestnet3],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'PayMate' }),
    ...(walletConnectProjectId ? [walletConnect({ projectId: walletConnectProjectId })] : []),
  ],
  transports: {
    [goatTestnet3.id]: http(),
  },
})

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
