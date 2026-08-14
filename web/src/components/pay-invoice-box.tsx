"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"

/**
 * PayInvoiceBox — "type the invoice ID, pay" widget.
 *
 * A client who received an invoice ID (from a link, email, or message) can
 * type the number here and be taken straight to the checkout for that
 * invoice. The ID is validated against GET /api/invoices/[id] first so a
 * typo gets a friendly error instead of a dead page.
 */
export function PayInvoiceBox({ heading = false }: { heading?: boolean }) {
  const [value, setValue] = useState("")
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const id = value.trim()
    if (!id) return
    setChecking(true)
    setError(null)
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(id)}`)
      if (res.status === 404) {
        setError("No invoice found with that ID. Double-check the number and try again.")
        return
      }
      if (!res.ok) {
        setError("Could not look up that invoice right now — please try again.")
        return
      }
      router.push(`/pay/${encodeURIComponent(id)}`)
    } catch {
      setError("Network error — please try again.")
    } finally {
      setChecking(false)
    }
  }

  return (
    <div style={{ width: "100%" }}>
      {heading && (
        <div className="section-kicker" style={{ marginBottom: 10 }}>PAY AN INVOICE</div>
      )}
      <form
        onSubmit={submit}
        style={{
          display: "flex",
          gap: 10,
          width: "100%",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter invoice ID…"
          aria-label="Invoice ID"
          className="input"
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1,
            minWidth: 0,
            height: 48,
            padding: "0 16px",
            fontSize: 15,
            background: "rgba(255,255,255,0.85)",
            border: "1px solid var(--line)",
            borderRadius: 12,
            outline: "none",
          }}
        />
        <button
          type="submit"
          className="button button-primary"
          disabled={checking || !value.trim()}
          style={{ height: 48, whiteSpace: "nowrap" }}
        >
          {checking ? "Checking…" : "Pay invoice"}
          {!checking && <Icon name="arrow" size={16} />}
        </button>
      </form>
      {error ? (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#b94328", fontWeight: 600 }}>{error}</p>
      ) : (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)" }}>
          No account needed — type the invoice ID and pay directly from your wallet.
        </p>
      )}
    </div>
  )
}
