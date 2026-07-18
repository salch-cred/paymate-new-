import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "PayMate | Pay Invoice",
  description:
    "Settle a PayMate invoice securely using x402 on GOAT Testnet3 with your Web3 wallet.",
}

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return children
}
