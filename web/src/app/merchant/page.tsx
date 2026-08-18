"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

/**
 * Merchant Checkout portal. API-key driven: paste a `pm_...` key (mint one at
 * /developers) and this page lets you set your store profile, create a
 * checkout in one click, copy the embed snippet, and watch payments land.
 */

interface MerchantProfile {
  apiKeyId: string
  storeName: string | null
  logoUrl: string | null
  receiveWallet: string | null
  webhookUrl: string | null
  successUrl: string | null
  cancelUrl: string | null
  webhookSecret: string | null
  createdAt: number | null
}

interface CheckoutRow {
  checkoutId: string
  orderId: string | null
  title: string
  amountUsd: number
  status: string
  txHash: string | null
  createdAt: number
  paidAt: number | null
  payUrl: string
}

const STORAGE_KEY = "pm_merchant_key"

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(23,24,19,.1)",
  borderRadius: 16,
  padding: 24,
  marginBottom: 18,
}
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: ".05em",
  textTransform: "uppercase",
  color: "#686961",
  margin: "14px 0 6px",
}
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  border: "1px solid rgba(23,24,19,.18)",
  fontSize: 14,
  boxSizing: "border-box",
  background: "#fff",
}

function MerchantPortal() {
  const [apiKey, setApiKey] = useState("")
  const [profile, setProfile] = useState<MerchantProfile | null>(null)
  const [checkouts, setCheckouts] = useState<CheckoutRow[]>([])
  const [keyError, setKeyError] = useState("")
  const [form, setForm] = useState({ amount: "", title: "", orderId: "" })
  const [created, setCreated] = useState<CheckoutRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")

  // Loads profile + checkouts for a key. Plain function (the React Compiler
  // lint rejects manual useCallback memoization here).
  function load(key: string) {
    setBusy(true)
    setKeyError("")
    Promise.all([
      fetch("/api/merchant/profile", { headers: { authorization: `Bearer ${key}` } }),
      fetch("/api/merchant/checkouts?limit=25", { headers: { authorization: `Bearer ${key}` } }),
    ])
      .then(([p, c]) =>
        Promise.all([p.json() as Promise<{ profile?: MerchantProfile; detail?: string }>, c.json() as Promise<{ checkouts?: CheckoutRow[]; detail?: string }>]),
      )
      .then(([prof, list]) => {
        if (prof.profile) setProfile(prof.profile)
        else if (prof.detail) setKeyError(prof.detail)
        if (list.checkouts) setCheckouts(list.checkouts)
      })
      .catch(() => setKeyError("Could not reach the PayMate API."))
      .finally(() => setBusy(false))
  }

  // Restore the key from localStorage. Deferred with a microtask so no
  // setState runs synchronously inside the effect (lint requirement).
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) || ""
    if (!saved) return
    queueMicrotask(() => {
      setApiKey(saved)
      load(saved)
    })
  }, [])

  const connectKey = () => {
    const key = apiKey.trim()
    if (!key) return
    window.localStorage.setItem(STORAGE_KEY, key)
    load(key)
  }

  const saveProfile = () => {
    if (!apiKey.trim()) return
    setBusy(true)
    fetch("/api/merchant/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${apiKey.trim()}` },
      body: JSON.stringify({
        storeName: profile?.storeName || undefined,
        logoUrl: profile?.logoUrl || undefined,
        receiveWallet: profile?.receiveWallet || undefined,
        webhookUrl: profile?.webhookUrl || undefined,
        successUrl: profile?.successUrl || undefined,
        cancelUrl: profile?.cancelUrl || undefined,
      }),
    })
      .then((r) => r.json())
      .then((data: { profile?: MerchantProfile; detail?: string }) => {
        if (data.profile) {
          setProfile(data.profile)
          setNotice("Profile saved.")
        } else if (data.detail) {
          setKeyError(data.detail)
        }
      })
      .catch(() => setKeyError("Failed to save profile."))
      .finally(() => setBusy(false))
  }

  const createCheckout = () => {
    if (!apiKey.trim()) return
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setKeyError("Enter a positive amount in USDC.")
      return
    }
    setBusy(true)
    setKeyError("")
    fetch("/api/merchant/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${apiKey.trim()}` },
      body: JSON.stringify({
        amountUsd: amount,
        title: form.title.trim() || undefined,
        orderId: form.orderId.trim() || undefined,
      }),
    })
      .then((r) => r.json())
      .then((data: { checkoutId?: string; payUrl?: string; amountUsd?: number; status?: string; detail?: string }) => {
        if (data.payUrl) {
          const row: CheckoutRow = {
            checkoutId: data.checkoutId || "",
            orderId: form.orderId.trim() || null,
            title: form.title.trim() || "PayMate checkout",
            amountUsd: data.amountUsd || 0,
            status: data.status || "pending",
            txHash: null,
            createdAt: Date.now(),
            paidAt: null,
            payUrl: data.payUrl,
          }
          setCreated(row)
          setCheckouts((prev) => [row, ...prev])
          setForm({ amount: "", title: "", orderId: "" })
        } else if (data.detail) {
          setKeyError(data.detail)
        }
      })
      .catch(() => setKeyError("Failed to create checkout."))
      .finally(() => setBusy(false))
  }

  const snippet = created
    ? `<a href="${created.payUrl}" data-paymate-checkout data-amount="${created.amountUsd}" data-title="${created.title.replace(/"/g, "&quot;")}">Pay with PayMate</a>\n<script src="https://paymateagent.xyz/paymate-checkout.js" defer></script>`
    : ""

  const base = "https://paymateagent.xyz"

  return (
    <main className="landing-shell">
      <SiteHeader active="/dashboard/marketplace" />
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px 80px", color: "#171813" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
        <h1 style={{ fontSize: 34, letterSpacing: "-.04em", margin: 0 }}>Merchant Checkout</h1>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#FF5B2E" }}>ACCEPT USDC ON GOAT</span>
      </div>
      <p style={{ fontSize: 14, opacity: 0.65, margin: "0 0 28px", maxWidth: 620 }}>
        One API call creates a checkout; your customer pays on a hosted PayMate page (on-chain USDC on GOAT Network);
        we POST a signed <code>checkout.paid</code> webhook to your backend. No chargebacks, no card fees, no weeks of
        integration.
      </p>

      <section style={cardStyle}>
        <span className="section-kicker" style={{ color: "#FF5B2E" }}>
          <span className="pulse-dot" />1 · API key
        </span>
        <p style={{ fontSize: 13, opacity: 0.7, margin: "8px 0 0" }}>
          Paste your <code>pm_...</code> key. Don&apos;t have one?{" "}
          <Link href="/developers" style={{ color: "#FF5B2E", fontWeight: 700 }}>
            Mint a key
          </Link>{" "}
          (wallet-signed, free).
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <input
            style={{ ...inputStyle, fontFamily: "monospace" }}
            placeholder="pm_…"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button
            type="button"
            className="button button-primary"
            onClick={connectKey}
            disabled={busy}
            style={{ whiteSpace: "nowrap" }}
          >
            {busy ? "Loading…" : "Connect"}
          </button>
        </div>
        {keyError && <p style={{ fontSize: 12, color: "#c0392b", marginTop: 8 }}>{keyError}</p>}
        {notice && <p style={{ fontSize: 12, color: "#2f7d3a", marginTop: 8 }}>{notice}</p>}
      </section>

      {profile && (
        <>
          <section style={cardStyle}>
            <span className="section-kicker" style={{ color: "#FF5B2E" }}>
              <span className="pulse-dot" />2 · Store settings
            </span>
            <label style={labelStyle}>Store name</label>
            <input
              style={inputStyle}
              value={profile.storeName || ""}
              onChange={(e) => setProfile({ ...profile, storeName: e.target.value })}
            />
            <label style={labelStyle}>Receive wallet (where checkout payments settle)</label>
            <input
              style={{ ...inputStyle, fontFamily: "monospace" }}
              value={profile.receiveWallet || ""}
              onChange={(e) => setProfile({ ...profile, receiveWallet: e.target.value })}
            />
            <label style={labelStyle}>Webhook URL (POSTed on every paid checkout)</label>
            <input
              style={{ ...inputStyle, fontFamily: "monospace" }}
              placeholder="https://your-site.com/api/paymate-webhook"
              value={profile.webhookUrl || ""}
              onChange={(e) => setProfile({ ...profile, webhookUrl: e.target.value })}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Success URL (optional)</label>
                <input
                  style={inputStyle}
                  placeholder="https://your-site.com/thanks"
                  value={profile.successUrl || ""}
                  onChange={(e) => setProfile({ ...profile, successUrl: e.target.value })}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Cancel URL (optional)</label>
                <input
                  style={inputStyle}
                  placeholder="https://your-site.com/checkout"
                  value={profile.cancelUrl || ""}
                  onChange={(e) => setProfile({ ...profile, cancelUrl: e.target.value })}
                />
              </div>
            </div>
            <button type="button" className="button button-primary" onClick={saveProfile} disabled={busy} style={{ marginTop: 16 }}>
              Save settings
            </button>
            {profile.webhookSecret ? (
              <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "#faf8f4", border: "1px dashed rgba(23,24,19,.2)" }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", opacity: 0.6 }}>
                  Webhook signing secret
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}>
                  <code style={{ fontSize: 12, fontFamily: "monospace", wordBreak: "break-all", flex: 1 }}>{profile.webhookSecret}</code>
                  <button
                    type="button"
                    className="button"
                    style={{ border: "1px solid rgba(23,24,19,.2)", background: "#fff" }}
                    onClick={() => {
                      navigator.clipboard?.writeText(profile.webhookSecret || "")
                      setNotice("Webhook secret copied.")
                    }}
                  >
                    Copy
                  </button>
                </div>
                <p style={{ fontSize: 11, opacity: 0.55, margin: "8px 0 0" }}>
                  Verify webhooks with <code>HMAC-SHA256(secret, rawBody)</code> — header{" "}
                  <code>X-PayMate-Signature</code>.
                </p>
              </div>
            ) : (
              <p style={{ fontSize: 12, opacity: 0.6, marginTop: 12 }}>Save once to generate your webhook signing secret.</p>
            )}
          </section>

          <section style={cardStyle}>
            <span className="section-kicker" style={{ color: "#FF5B2E" }}>
              <span className="pulse-dot" />3 · Create a checkout
            </span>
            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <input
                style={{ ...inputStyle, maxWidth: 140 }}
                placeholder="Amount USDC"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
              <input
                style={{ ...inputStyle, maxWidth: 220 }}
                placeholder="Title (e.g. Pro plan)"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <input
                style={{ ...inputStyle, maxWidth: 200 }}
                placeholder="Your order id (optional)"
                value={form.orderId}
                onChange={(e) => setForm({ ...form, orderId: e.target.value })}
              />
              <button type="button" className="button button-primary" onClick={createCheckout} disabled={busy}>
                Create checkout
              </button>
            </div>

            {created && (
              <div style={{ marginTop: 18, padding: 16, borderRadius: 12, background: "#faf8f4", border: "1px solid rgba(23,24,19,.12)" }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>Checkout ready — ${created.amountUsd} USDC</div>
                <div style={{ fontSize: 12, opacity: 0.6, margin: "4px 0 12px" }}>
                  {created.checkoutId} ·{" "}
                  <a href={created.payUrl} target="_blank" rel="noreferrer" style={{ color: "#FF5B2E", fontWeight: 700 }}>
                    {created.payUrl}
                  </a>
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", opacity: 0.6 }}>
                  One-line button (paste into your site)
                </div>
                <pre
                  style={{
                    margin: "8px 0 14px",
                    padding: 12,
                    borderRadius: 10,
                    background: "#171813",
                    color: "#c9fa78",
                    fontSize: 12,
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {snippet}
                </pre>
                <button
                  type="button"
                  className="button"
                  style={{ border: "1px solid rgba(23,24,19,.2)", background: "#fff" }}
                  onClick={() => {
                    navigator.clipboard?.writeText(snippet)
                    setNotice("Snippet copied.")
                  }}
                >
                  Copy snippet
                </button>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", opacity: 0.6, marginTop: 18 }}>
                  Or redirect (zero JS)
                </div>
                <pre
                  style={{
                    margin: "8px 0 0",
                    padding: 12,
                    borderRadius: 10,
                    background: "#171813",
                    color: "#c9fa78",
                    fontSize: 12,
                    overflowX: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {`// server-side (Node)\nconst checkout = await fetch("${base}/api/merchant/checkout", {\n  method: "POST",\n  headers: { authorization: "Bearer pm_...", "content-type": "application/json" },\n  body: JSON.stringify({ amountUsd: ${created.amountUsd}, orderId: "ORD-42", webhookUrl: "https://your-site.com/api/paymate-webhook" })\n}).then(r => r.json())\n// → redirect the customer to checkout.payUrl`}
                </pre>
              </div>
            )}
          </section>

          <section style={cardStyle}>
            <span className="section-kicker" style={{ color: "#FF5B2E" }}>
              <span className="pulse-dot" />4 · Checkouts
            </span>
            {checkouts.length === 0 ? (
              <p style={{ fontSize: 13, opacity: 0.6, marginTop: 10 }}>No checkouts yet. Create one above.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10, fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", opacity: 0.55 }}>
                    <th style={{ padding: "6px 8px" }}>Order</th>
                    <th style={{ padding: "6px 8px" }}>Title</th>
                    <th style={{ padding: "6px 8px" }}>Amount</th>
                    <th style={{ padding: "6px 8px" }}>Status</th>
                    <th style={{ padding: "6px 8px" }}>Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {checkouts.map((c) => (
                    <tr key={c.checkoutId} style={{ borderTop: "1px solid rgba(23,24,19,.08)" }}>
                      <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 12 }}>{c.orderId || c.checkoutId.slice(0, 8)}</td>
                      <td style={{ padding: "10px 8px" }}>{c.title}</td>
                      <td style={{ padding: "10px 8px", fontWeight: 700 }}>${c.amountUsd.toLocaleString()}</td>
                      <td style={{ padding: "10px 8px" }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: "3px 9px",
                            borderRadius: 10,
                            background: c.status === "paid" ? "#d9f2e2" : "#fff0e3",
                            color: c.status === "paid" ? "#1e7a3c" : "#8a5a00",
                          }}
                        >
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "10px 8px", fontFamily: "monospace", fontSize: 11 }}>
                        {c.txHash ? (
                          <a href={`https://explorer.goat.network/tx/${c.txHash}`} target="_blank" rel="noreferrer" style={{ color: "#FF5B2E" }}>
                            {c.txHash.slice(0, 10)}…
                          </a>
                        ) : (
                          <a href={c.payUrl} target="_blank" rel="noreferrer" style={{ color: "#171813", opacity: 0.5 }}>
                            link
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
      </div>
      <SiteFooter />
    </main>
  )
}

export default function MerchantPage() {
  return <MerchantPortal />
}
