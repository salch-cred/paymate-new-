import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Documentation",
  description: "Build, integrate, and settle verified PayMate invoices on Metis.",
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children
}
