"use client"

import React, { useState } from 'react'
import { http, createConfig, WagmiProvider } from 'wagmi'
import { metisSepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export const config = createConfig({
  chains: [metisSepolia],
  connectors: [injected()],
  transports: {
    [metisSepolia.id]: http(),
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
