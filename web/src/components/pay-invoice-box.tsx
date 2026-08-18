"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/icons"

/**
 * PayInvoiceBox — "type the invoice ID, pay" widget.
 *
 * A client who received an invoice ID (from a link, email, or message) can
 * type the number here. On a successful lookup the widget surfaces the
 * invoice ID and the full pay link — each with its own copy button — plus a
 * "Pay now" action that routes to the live checkout at /pay/<id>. A typo gets
 * a friendly error instead of a dead page.
 */
export function PayInvoiceBox({ heading = false }: { heading?: boolean }) {
  const [value, setValue] = useState("")
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [found, setFound] = useState<{ id: string } | null>(null)
  const [copied, setCopied] = useState<"id" | "link" | null>(null)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const id = value.trim()
    if (!id) return
    setChecking(true)
    setError(null)
    setFound(null)
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
      const invoice = await res.json()
      setFound({ id: invoice.id })
    } catch {
      setError("Network error — please try again.")
    } finally {
      setChecking(false)
    }
  }

  async function copy(kind: "id" | "link") {
    if (!found) return
    const text = kind === "id" ? found.id : `${window.location.origin}/pay/${found.id}`
    await navigator.clipboard.writeText(text)
    setCopied(kind)
    setTimeout(() => setCopied(null), 1500)
  }

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    background: "rgba(255,255,255,0.55)",
    border: "1px solid var(--line)",
    borderRadius: 8,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--muted)",
    flexShrink: 0,
  }
  const codeStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    wordBreak: "break-all",
    fontFamily: "monospace",
    color: "var(--ink)",
  }
  const copyBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "transparent",
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "5px 9px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
    color: "var(--ink)",
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
          onChange={(e) => {
            setValue(e.target.value)
            if (found) setFound(null)
          }}
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
          {checking ? "Checking…" : "Find invoice"}
          {!checking && <Icon name="arrow" size={16} />}
        </button>
      </form>

      {error ? (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#b94328", fontWeight: 600 }}>{error}</p>
      ) : found ? (
        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(49,130,93,0.08)",
            border: "1px solid rgba(49,130,93,0.3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Icon name="check" size={16} style={{ color: "#31825d", flexShrink: 0 }} />
            <b style={{ fontSize: 12 }}>Invoice found — copy the ID or the pay link</b>
          </div>

          <div style={{ ...rowStyle, marginBottom: 6 }}>
            <span style={labelStyle}>Invoice ID</span>
            <code style={codeStyle}>{found.id}</code>
            <button type="button" onClick={() => copy("id")} style={copyBtnStyle}>
              <Icon name={copied === "id" ? "check" : "copy"} size={13} />
              {copied === "id" ? "Copied" : "Copy"}
            </button>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Pay link</span>
            <code style={codeStyle}>{`${window.location.origin}/pay/${found.id}`}</code>
            <button type="button" onClick={() => copy("link")} style={copyBtnStyle}>
              <Icon name={copied === "link" ? "check" : "link"} size={13} />
              {copied === "link" ? "Copied" : "Copy"}
            </button>
          </div>

          <button
            type="button"
            className="button button-primary"
            onClick={() => router.push(`/pay/${encodeURIComponent(found.id)}`)}
            style={{ width: "100%", justifyContent: "center", marginTop: 10, height: 42 }}
          >
            Pay now <Icon name="arrow" size={15} />
          </button>
        </div>
      ) : (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted)" }}>
          No account needed — type the invoice ID and pay directly from your wallet.
        </p>
      )}
    </div>
  )
}
