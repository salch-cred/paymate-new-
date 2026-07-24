"use client"

import React, { useState } from 'react'
import { http } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { goatTestnet3 } from '@/lib/chain'
import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider, createConfig } from '@privy-io/wagmi'

export const config = createConfig({
  chains: [goatTestnet3],
  transports: {
    [goatTestnet3.id]: http(),
  },
})

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmrycz4cv00i60dlbtysvaaai"}
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#fb744d',
          logo: 'https://paymate-new.vercel.app/logo.png',
        },
        supportedChains: [goatTestnet3],
        defaultChain: goatTestnet3,
        walletConnectCloudProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "d5e89d14fc04d744f4ccbb715bb99a53",
        loginMethods: ['wallet', 'telegram', 'email'],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          }
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}
