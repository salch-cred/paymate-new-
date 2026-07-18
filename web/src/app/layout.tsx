import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"
import Providers from "./providers"

const manrope = localFont({ src: "../../public/fonts/NotoSans-Variable.ttf", variable: "--font-manrope", display: "swap" })
const display = localFont({ src: "../../public/fonts/Trebuchet.ttf", variable: "--font-display", display: "swap" })
const editorial = localFont({ src: "../../public/fonts/Georgia.ttf", variable: "--font-editorial", display: "swap" })

export const metadata: Metadata = {
  title: { default: "PayMate — Get paid. Keep the proof.", template: "%s · PayMate" },
  description: "Create intelligent invoices, collect on-chain payments, and build portable ERC-8004 reputation.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${manrope.variable} ${display.variable} ${editorial.variable}`}><body><Providers>{children}</Providers></body></html>
}
