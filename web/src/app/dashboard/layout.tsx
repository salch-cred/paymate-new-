import type { Metadata } from "next"
import { DashboardLayoutClient } from "./layout-client"

export const metadata: Metadata = {
  title: "PayMate | Dashboard",
  description:
    "Draft AI-powered invoices and view your ERC-8004 on-chain reputation score on GOAT Network.",
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>
}
