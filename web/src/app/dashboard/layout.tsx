import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "PayMate | Dashboard",
  description:
    "Draft AI-powered invoices and view your ERC-8004 on-chain reputation score on GOAT Testnet3.",
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
