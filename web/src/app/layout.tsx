import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"
import "./(dashboard)/dashboard/marketplace/marketplace.css"
import "./redesign.css"
import Providers from "./providers"

const manrope = localFont({ src: "../../public/fonts/NotoSans-Variable.ttf", variable: "--font-manrope", display: "swap" })
const display = localFont({ src: "../../public/fonts/Trebuchet.ttf", variable: "--font-display", display: "swap" })
const editorial = localFont({ src: "../../public/fonts/Georgia.ttf", variable: "--font-editorial", display: "swap" })

export const metadata: Metadata = {
  title: { default: "PayMate — Get paid. Keep the proof.", template: "%s · PayMate" },
  description: "Create intelligent invoices, collect on-chain payments, and build portable ERC-8004 reputation.",
  icons: {
    icon: [
      { url: "/logo-app-v2.png", sizes: "32x32", type: "image/png" },
      { url: "/logo-app-v2.png", sizes: "16x16", type: "image/png" },
      { url: "/logo-app-v2.png", sizes: "any", type: "image/png" },
    ],
    apple: [{ url: "/logo-app-v2.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/logo-app-v2.png", type: "image/png" }],
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
}

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "PayMate",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "On-chain invoicing and settlement for independent workers. Create invoices, collect direct wallet-to-wallet USDC payments via the x402 protocol, and build a portable ERC-8004 reputation credential on GOAT Network.",
  url: "https://paymateagent.xyz",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  featureList: [
    "Intelligent natural-language invoice drafting",
    "Direct non-custodial USDC settlement via x402",
    "Server-side on-chain transaction verification",
    "Portable ERC-8004 reputation on GOAT Network",
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${display.variable} ${editorial.variable}`}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }} />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  )
}
