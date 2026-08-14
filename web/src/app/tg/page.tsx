"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

// Minimal Telegram WebApp API surface we use.
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string
        initDataUnsafe?: { user?: { id: number; first_name?: string; last_name?: string; username?: string } }
        ready: () => void
        expand: () => void
        openLink: (url: string, options?: unknown) => void
        setHeaderColor?: (color: string) => void
        colorScheme?: "light" | "dark"
      }
    }
  }
}

interface Invoice {
  id: string
  freelancer: string
  client: string
  title?: string
  description: string
  amountUsd: number | null
  status: "pending" | "paid" | "cancelled"
  chain: string
  dueDate?: string
  txHash?: string
  createdAt?: number
  paidAt?: number | null
}

type TgState = "idle" | "paid" | "failed" | "error"

function TgApp() {
  const searchParams = useSearchParams()
  const invoiceId = searchParams.get("invoice") || ""
  const failedFlag = searchParams.get("status") === "failed"

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<TgState>(failedFlag ? "failed" : "idle")
  const [goatOpened, setGoatOpened] = useState(false)
  const [inTelegram, setInTelegram] = useState(false)
  const [tgUser, setTgUser] = useState<{ id: number; name: string } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function boot() {
    const webApp = window.Telegram?.WebApp
    if (!webApp) return
    webApp.ready?.()
    webApp.expand?.()
    webApp.setHeaderColor?.("#ffffff")
    setInTelegram(!!webApp.initData)
    if (webApp.initDataUnsafe?.user) {
      const u = webApp.initDataUnsafe.user
      setTgUser({ id: u.id, name: u.first_name || u.username || `user ${u.id}` })
    }
  }

  // Load the official Telegram WebApp script once.
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      // Already loaded — defer so setState never runs synchronously in the effect.
      queueMicrotask(boot)
      return
    }
    const existing = document.getElementById("tg-webapp-js") as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener("load", boot)
      return () => existing.removeEventListener("load", boot)
    }
    const script = document.createElement("script")
    script.id = "tg-webapp-js"
    script.src = "https://telegram.org/js/telegram-web-app.js"
    script.async = true
    script.onload = boot
    document.head.appendChild(script)
  }, [])

  // Load the invoice. `loading` is only flipped in async callbacks, and the
  // no-invoice case is handled by an early return in the render (not setState).
  useEffect(() => {
    if (!invoiceId) return
    let cancelled = false
    fetch(`/api/invoices/${invoiceId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Invoice not found")
        return r.json() as Promise<Invoice>
      })
      .then((inv) => {
        if (cancelled) return
        setInvoice(inv)
        if (inv.status === "paid") setState("paid")
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load invoice")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [invoiceId])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // Poll the invoice until paid (or give up).
  const startPolling = useCallback(() => {
    stopPolling()
    let ticks = 0
    pollRef.current = setInterval(async () => {
      ticks += 1
      if (ticks > 30) {
        stopPolling()
        return
      }
      try {
        const res = await fetch(`/api/invoices/${invoiceId}`)
        if (!res.ok) return
        const inv = (await res.json()) as Invoice
        if (inv.status === "paid") {
          stopPolling()
          setInvoice(inv)
          setState("paid")
        }
      } catch {
        // transient — keep polling
      }
    }, 3000)
  }, [invoiceId, stopPolling])

  useEffect(() => stopPolling, [stopPolling])

  // Real on-chain settlement — open the standard GOAT checkout in the system
  // browser (wallet connection works most reliably there, not in the iframe).
  function handlePayGoat() {
    if (!invoiceId) return
    const payUrl = `${window.location.origin}/pay/${invoiceId}`
    setError(null)
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openLink(payUrl)
    } else {
      window.open(payUrl, "_blank", "noopener")
    }
    setGoatOpened(true)
    startPolling() // flip to paid the moment the GOAT settlement lands
  }

  async function checkStatus() {
    if (!invoiceId) return
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`)
      if (!res.ok) return
      const inv = (await res.json()) as Invoice
      setInvoice(inv)
      if (inv.status === "paid") {
        stopPolling()
        setState("paid")
      }
    } catch {
      // keep current state
    }
  }

  const amount = invoice ? (invoice.amountUsd ?? 0) : 0
  const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--tg-theme-bg-color, #ffffff)",
        color: "var(--tg-theme-text-color, #111)",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: "var(--tg-theme-button-color, #111)",
            color: "var(--tg-theme-button-text-color, #fff)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 15,
          }}
        >
          P
        </span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.1 }}>PayMate</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Billing for the OpenClaw economy</div>
        </div>
        {tgUser && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              opacity: 0.7,
              background: "var(--tg-theme-secondary-bg-color, #f0f0f0)",
              padding: "4px 10px",
              borderRadius: 12,
              fontWeight: 600,
            }}
          >
            {tgUser.name}
          </span>
        )}
      </header>

      {!invoiceId ? (
        <section
          style={{
            background: "var(--tg-theme-secondary-bg-color, #f4f4f5)",
            borderRadius: 16,
            padding: 28,
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: 18, margin: 0 }}>No invoice linked</h2>
          <p style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>
            Open this Mini App from an invoice payment link (like the one your PayMate Telegram bot sends).
          </p>
        </section>
      ) : loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <span className="loader" />
        </div>
      ) : error && !invoice ? (
        <section
          style={{
            background: "var(--tg-theme-secondary-bg-color, #f4f4f5)",
            borderRadius: 16,
            padding: 28,
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Invoice unavailable</h2>
          <p style={{ fontSize: 13, opacity: 0.7, margin: "0 0 16px" }}>{error}</p>
          <Link
            href="/"
            style={{
              display: "inline-block",
              padding: "10px 18px",
              borderRadius: 12,
              background: "var(--tg-theme-button-color, #111)",
              color: "var(--tg-theme-button-text-color, #fff)",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Open PayMate web app
          </Link>
        </section>
      ) : !invoice ? (
        <section
          style={{
            background: "var(--tg-theme-secondary-bg-color, #f4f4f5)",
            borderRadius: 16,
            padding: 28,
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: 18, margin: 0 }}>Invoice unavailable</h2>
          <p style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>This invoice could not be loaded.</p>
        </section>
      ) : state === "paid" ? (
        <section
          style={{
            background: "var(--tg-theme-secondary-bg-color, #f4f4f5)",
            borderRadius: 16,
            padding: 28,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#2fb463",
              color: "#fff",
              fontSize: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
            }}
          >
            ✓
          </div>
          <h2 style={{ fontSize: 20, margin: "0 0 6px" }}>Payment verified</h2>
          <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
            {invoice.title} — <b>${amount.toLocaleString()} USDC</b> settled on GOAT Network.
          </p>
          <p style={{ fontSize: 11, opacity: 0.5, marginTop: 12 }}>
            {invoice.txHash ? (
              <a
                href={`https://explorer.goat.network/tx/${invoice.txHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "inherit" }}
              >
                {short(invoice.txHash)}
              </a>
            ) : (
              invoice.id.slice(0, 8)
            )}{" "}
            · {new Date().toLocaleTimeString()}
          </p>
          <Link
            href="/"
            style={{
              display: "inline-block",
              marginTop: 16,
              padding: "10px 18px",
              borderRadius: 12,
              background: "var(--tg-theme-button-color, #111)",
              color: "var(--tg-theme-button-text-color, #fff)",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Open dashboard
          </Link>
        </section>
      ) : (
        <section
          style={{
            background: "var(--tg-theme-secondary-bg-color, #f4f4f5)",
            borderRadius: 16,
            padding: 22,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <h2 style={{ fontSize: 17, margin: 0, lineHeight: 1.25 }}>{invoice.title || "Professional services"}</h2>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.04em",
                padding: "4px 10px",
                borderRadius: 10,
                background: state === "failed" ? "#ffe0dd" : "#fff0e3",
                color: state === "failed" ? "#c0392b" : "#8a5a00",
                whiteSpace: "nowrap",
              }}
            >
              {state === "failed" ? "PAYMENT FAILED" : invoice.status === "pending" ? "PENDING" : invoice.status.toUpperCase()}
            </span>
          </div>

          <p style={{ fontSize: 13, opacity: 0.75, margin: "10px 0 0", lineHeight: 1.5 }}>{invoice.description}</p>

          <div
            style={{
              marginTop: 16,
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              opacity: 0.65,
            }}
          >
            <span>Freelancer</span>
            <span style={{ fontFamily: "monospace" }}>{short(invoice.freelancer)}</span>
          </div>
          <div
            style={{
              marginTop: 6,
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              opacity: 0.65,
            }}
          >
            <span>Network</span>
            <span>{invoice.chain}</span>
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 18,
              borderRadius: 14,
              background: "var(--tg-theme-bg-color, #fff)",
              display: "flex",
              alignItems: "baseline",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.55, letterSpacing: "0.06em" }}>TOTAL DUE</span>
            <span style={{ fontSize: 28, fontWeight: 800, marginLeft: "auto", letterSpacing: "-0.5px" }}>
              ${amount.toLocaleString()}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, opacity: 0.6 }}>USDC</span>
          </div>

          {state === "failed" && (
            <p style={{ marginTop: 14, fontSize: 12, textAlign: "center", color: "#c0392b", lineHeight: 1.5 }}>
              The payment didn&apos;t go through (it may have expired or been declined). Try again below.
            </p>
          )}
          {error && (
            <p style={{ marginTop: 14, fontSize: 12, textAlign: "center", color: "#c0392b", lineHeight: 1.5 }}>{error}</p>
          )}

          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              type="button"
              onClick={handlePayGoat}
              style={{
                padding: "14px 0",
                borderRadius: 12,
                border: "none",
                fontWeight: 800,
                fontSize: 14,
                background: "var(--tg-theme-button-color, #111)",
                color: "var(--tg-theme-button-text-color, #fff)",
                cursor: "pointer",
              }}
            >
              ⛓️ Pay on GOAT Network
            </button>
            {goatOpened && (
              <button
                type="button"
                onClick={checkStatus}
                style={{
                  padding: "12px 0",
                  borderRadius: 12,
                  border: "1px solid var(--tg-theme-hint-color, #ccc)",
                  background: "transparent",
                  fontWeight: 700,
                  fontSize: 12,
                  color: "var(--tg-theme-text-color, #111)",
                  cursor: "pointer",
                }}
              >
                Check payment status
              </button>
            )}
          </div>

          <p
            style={{
              marginTop: 12,
              fontSize: 11,
              opacity: 0.6,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {goatOpened
              ? "GOAT checkout opened in your browser — connect your wallet and pay USDC on GOAT mainnet. This mints your ERC-8004 reputation."
              : "On-chain USDC on GOAT mainnet — the non-custodial settlement that mints ERC-8004 reputation."}
          </p>

          {!inTelegram && (
            <p
              style={{
                marginTop: 14,
                fontSize: 11,
                opacity: 0.6,
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              Tip: open this page inside Telegram for the native flow — tap the link in your PayMate bot chat.
            </p>
          )}
        </section>
      )}

      <footer style={{ marginTop: 24, textAlign: "center", fontSize: 10, opacity: 0.4 }}>
        PayMate · payments for humans &amp; agents · settled on GOAT
      </footer>
    </main>
  )
}

export default function TgPage() {
  return (
    <Suspense fallback={<main style={{ padding: 20 }}>Loading PayMate Mini App…</main>}>
      <TgApp />
    </Suspense>
  )
}
