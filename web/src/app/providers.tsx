"use client"

import React, { useState } from 'react'
import { http, createConfig, WagmiProvider } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { goatTestnet3 } from '@/lib/chain'

export const config = createConfig({
  chains: [goatTestnet3],
  connectors: [injected()],
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
