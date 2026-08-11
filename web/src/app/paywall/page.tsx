"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { useAccount, useSwitchChain, useWalletClient } from "wagmi"
import { goatChain } from "@/lib/chain"
import { WalletConnectMenu } from "@/components/wallet-connect-menu"

type AcceptOption = {
  scheme: string
  network: string
  asset: string
  token: string
  payTo: string
  price: string
  maxAmountRequired: string
}

type Created = {
  invoiceId: string
  pageUrl: string
  payUrl: string
  accepts: AcceptOption[]
}

type Challenge = {
  invoiceId: string
  payUrl: string
  status: number
  x402Version: number
  accepts: AcceptOption[]
  paymentRequiredHeader: string
}

type Unlocked = {
  invoiceId: string
  txHash: string | null
  explorerUrl: string | null
  receipt: { payload: Record<string, unknown>; sig: string | null } | null
  deliverable: string
  title: string
}

const GOAT_GREEN = "#317454"

export default function PaywallPage() {
  const { address, isConnected, chain } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { switchChainAsync } = useSwitchChain()

  // ── Creator state ────────────────────────────────────────────────────────
  const [createTitle, setCreateTitle] = useState("")
  const [createPrice, setCreatePrice] = useState("2.5")
  const [createContent, setCreateContent] = useState("")
  const [createWallet, setCreateWallet] = useState("")
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<Created | null>(null)

  // ── Buyer / unlock state ─────────────────────────────────────────────────
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [unlocked, setUnlocked] = useState<Unlocked | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [loadId, setLoadId] = useState("")
  const [txInput, setTxInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<{ label: string; data: unknown }[]>([])

  const log = useCallback((label: string, data: unknown) => {
    setLogs(prev => [...prev.slice(-8), { label, data }])
  }, [])

  /** Creator: persist a real paywalled page (title + content + price + wallet). */
  const createPaywall = useCallback(async () => {
    setCreating(true)
    setError(null)
    setUnlocked(null)
    setChallenge(null)
    try {
      const res = await fetch("/api/paywall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createTitle,
          content: createContent,
          amountUsd: Number(createPrice),
          freelancerWallet: createWallet || address,
        }),
      })
      const body = await res.json().catch(() => null)
      log("POST /api/paywall", { status: res.status, body })
      if (!res.ok) {
        setError(body?.detail || body?.error || "Failed to create the paywall.")
        return
      }
      setCreated({
        invoiceId: body.invoiceId,
        pageUrl: body.pageUrl,
        payUrl: body.payUrl,
        accepts: body.accepts,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed")
    } finally {
      setCreating(false)
    }
  }, [createTitle, createContent, createPrice, createWallet, address, log])

  /** Load a paywall page by id → expect HTTP 402 + PAYMENT-REQUIRED (locked). */
  const loadPaywall = useCallback(
    async (invoiceId: string) => {
      setBusy(true)
      setError(null)
      setUnlocked(null)
      setTxHash(null)
      try {
        const res = await fetch(`/api/paywall/${invoiceId}`)
        const body = await res.json().catch(() => null)
        log("GET /api/paywall/" + invoiceId, { status: res.status, body, header: res.headers.get("payment-required") })
        if (res.status === 402 && body?.accepts) {
          setChallenge({
            invoiceId: body.invoiceId || invoiceId,
            payUrl: body.payUrl || "",
            status: 402,
            x402Version: body.x402Version ?? 1,
            accepts: body.accepts,
            paymentRequiredHeader: res.headers.get("payment-required") || "",
          })
          return
        }
        if (body?.unlocked) {
          // Already paid — content is served again for this buyer.
          setChallenge(null)
          setUnlocked(body)
          return
        }
        setError(body?.detail || "Unexpected response from the paywall endpoint.")
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed")
      } finally {
        setBusy(false)
      }
    },
    [log]
  )

  /** Unlock: retry with the x402 PAYMENT-SIGNATURE header. */
  const unlockWith = useCallback(
    async (hash: string) => {
      setBusy(true)
      setError(null)
      try {
        const sig = btoa(JSON.stringify({ txHash: hash }))
        const id = challenge?.invoiceId || created?.invoiceId || ""
        const res = await fetch(`/api/paywall/${id}`, {
          headers: { "payment-signature": sig },
        })
        const body = await res.json().catch(() => null)
        log("GET with PAYMENT-SIGNATURE", { status: res.status, body })
        if (!res.ok) {
          setError(body?.detail || "Verification failed.")
          return
        }
        setUnlocked(body)
      } finally {
        setBusy(false)
      }
    },
    [challenge, created, log]
  )

  /** Pay the x402 quote with the connected wallet on GOAT, then unlock. */
  const payAndUnlock = useCallback(async () => {
    if (!challenge || !isConnected || !address || !walletClient) return
    setBusy(true)
    setError(null)
    try {
      if (chain?.id !== goatChain.id) {
        await switchChainAsync({ chainId: goatChain.id })
      }
      const option = challenge.accepts[0]
      if (!option?.token || !option?.payTo) throw new Error("The 402 quote is missing payment details.")
      const amount = BigInt(option.maxAmountRequired)
      const hash = await walletClient.writeContract({
        address: option.token as `0x${string}`,
        abi: [
          {
            inputs: [
              { name: "recipient", type: "address" },
              { name: "amount", type: "uint256" },
            ],
            name: "transfer",
            outputs: [{ name: "", type: "bool" }],
            stateMutability: "nonpayable",
            type: "function",
          },
        ],
        functionName: "transfer",
        args: [option.payTo as `0x${string}`, amount],
        account: address,
        chain: goatChain,
      })
      setTxHash(hash)
      log("USDC transfer sent", { txHash: hash, payTo: option.payTo, amount: option.price })

      // Retry with the x402 PAYMENT-SIGNATURE header to unlock.
      await unlockWith(hash)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed")
    } finally {
      setBusy(false)
    }
  }, [challenge, isConnected, address, walletClient, chain, switchChainAsync, unlockWith, log])

  const curl = `# 1. Create a real paywalled page (content is persisted server-side)\ncurl -s -X POST https://paymateagent.xyz/api/paywall \\\\\n  -H "Content-Type: application/json" \\\\\n  -d '{"title":"Premium Report","content":"the deliverable...","amountUsd":2.5,"freelancerWallet":"0x..."}'\n# → 201 { invoiceId, pageUrl, payUrl, accepts[] }\n\n# 2. Any client requests the page without paying → HTTP 402 + PAYMENT-REQUIRED\ncurl -s https://paymateagent.xyz/api/paywall/<invoiceId>\n\n# 3. Client pays the quoted USDC on GOAT Network, then retries with proof:\ncurl -s https://paymateagent.xyz/api/paywall/<invoiceId> \\\\\n  -H "PAYMENT-SIGNATURE: $(echo -n '{"txHash":"0x<your_tx>"}' | base64)"`

  return (
    <main style={{ background: "#0a0a0a", minHeight: "100vh", color: "white", fontFamily: "monospace", padding: "32px 20px 80px" }}>
      <style>{`@keyframes pw-blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>

      {/* Header */}
      <header style={{ maxWidth: 1100, margin: "0 auto 48px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #222", paddingBottom: 20 }}>
        <Link href="/" style={{ color: "white", textDecoration: "none", fontWeight: 800, fontSize: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, background: "#ff5b2e", borderRadius: 3, display: "inline-block" }} />
          PAYMATE <span style={{ color: GOAT_GREEN }}>/ PAYWALL</span>
        </Link>
        <a href="https://docs.goat.network" target="_blank" rel="noreferrer" style={{ color: "#888", fontSize: 12, textDecoration: "none" }}>GOAT NETWORK · x402</a>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Hero */}
        <div style={{ marginBottom: 40 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(49,130,93,0.15)", color: GOAT_GREEN, padding: "6px 12px", borderRadius: 100, fontSize: 11, fontWeight: 700, marginBottom: 16 }}>
            <span style={{ width: 8, height: 8, background: GOAT_GREEN, borderRadius: "50%", animation: "pw-blink 1.2s infinite" }} />
            PAY-TO-UNLOCK · REAL PAYMENTS · GOAT MAINNET
          </span>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, margin: "0 0 12px", lineHeight: 1.1, letterSpacing: "-0.5px" }}>
            Monetize any endpoint with the <span style={{ color: GOAT_GREEN }}>x402</span> paywall.
          </h1>
          <p style={{ color: "#999", fontSize: 14, lineHeight: 1.7, maxWidth: 680, margin: 0 }}>
            Create a paywalled page below — your deliverable is stored with the invoice. Every buyer hits
            <code style={{ color: "#ff5b2e" }}> HTTP 402</code> + an x402 quote, pays real USDC on GOAT Network, and unlocks
            the content with a <b style={{ color: "#ddd" }}>signed delivery receipt</b>. No fake data, no test tokens — the same
            flow an agent uses via <code style={{ color: "#ff5b2e" }}>POST /api/agent/paywall</code>.
          </p>
        </div>

        {/* Creator */}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <span style={{ width: 10, height: 10, background: "#ff5b2e", borderRadius: "50%" }} />
            <b style={{ fontSize: 13 }}>CREATE A PAYWALLED PAGE</b>
            <span style={{ color: "#555", fontSize: 11 }}>— real invoice, persisted content</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", color: "#777", fontSize: 11, marginBottom: 6 }}>TITLE</label>
              <input
                value={createTitle}
                onChange={e => setCreateTitle(e.target.value)}
                placeholder="My premium report"
                style={{ width: "100%", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, padding: "10px 12px", color: "#ddd", fontSize: 12, fontFamily: "monospace" }}
              />
            </div>
            <div>
              <label style={{ display: "block", color: "#777", fontSize: 11, marginBottom: 6 }}>PRICE · USDC</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={createPrice}
                onChange={e => setCreatePrice(e.target.value)}
                placeholder="2.50"
                style={{ width: "100%", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, padding: "10px 12px", color: "#ddd", fontSize: 12, fontFamily: "monospace" }}
              />
            </div>
            <div>
              <label style={{ display: "block", color: "#777", fontSize: 11, marginBottom: 6 }}>FREELANCER WALLET (PAYEE)</label>
              <input
                value={createWallet || (isConnected ? address || "" : "")}
                onChange={e => setCreateWallet(e.target.value)}
                placeholder={isConnected ? address : "0x... (defaults to connected wallet)"}
                style={{ width: "100%", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, padding: "10px 12px", color: "#ddd", fontSize: 11, fontFamily: "monospace" }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", color: "#777", fontSize: 11, marginBottom: 6 }}>CONTENT TO UNLOCK</label>
            <textarea
              value={createContent}
              onChange={e => setCreateContent(e.target.value)}
              placeholder={"The deliverable itself — a report, a key, a doc. Stored with the invoice and served only after the on-chain payment is verified."}
              rows={4}
              style={{ width: "100%", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, padding: "12px", color: "#ddd", fontSize: 12, fontFamily: "monospace", resize: "vertical" }}
            />
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={createPaywall}
              disabled={creating || !createTitle.trim() || !createContent.trim() || !Number(createPrice)}
              style={{ background: "#ff5b2e", color: "#fff", border: "none", padding: "12px 20px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: creating || !createTitle.trim() || !createContent.trim() || !Number(createPrice) ? "not-allowed" : "pointer", opacity: creating || !createTitle.trim() || !createContent.trim() || !Number(createPrice) ? 0.5 : 1 }}
            >
              {creating ? "Creating invoice…" : "Create paywalled page"}
            </button>
            {created && (
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", color: GOAT_GREEN, fontSize: 12, fontWeight: 700 }}>
                <span>pageUrl: <a href={`https://paymateagent.xyz${created.pageUrl}`} target="_blank" rel="noreferrer" style={{ color: "#8ab4f8", textDecoration: "underline" }}>https://paymateagent.xyz{created.pageUrl}</a></span>
                <span>· payUrl: <a href={`https://paymateagent.xyz${created.payUrl}`} target="_blank" rel="noreferrer" style={{ color: "#8ab4f8", textDecoration: "underline" }}>https://paymateagent.xyz{created.payUrl}</a></span>
                <button onClick={() => loadPaywall(created.invoiceId)} style={{ background: "transparent", border: "1px solid " + GOAT_GREEN, color: GOAT_GREEN, padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                  Load & unlock it ↓
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Terminal */}
        <div style={{ background: "#000", border: "1px solid #222", borderRadius: 14, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 8, padding: "12px 16px", borderBottom: "1px solid #222", alignItems: "center" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5b2e" }} />
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#e6c254" }} />
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: GOAT_GREEN }} />
            <span style={{ marginLeft: 8, fontSize: 11, color: "#666" }}>paywall.sh — live x402 handshake</span>
          </div>
          <div style={{ padding: 16, fontSize: 12, lineHeight: 1.8 }}>
            {logs.length === 0 && <span style={{ color: "#555" }}>Create a paywall (or load one) to see the handshake.</span>}
            {logs.map((l, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ color: "#ff5b2e", fontWeight: 700 }}>$ {l.label}</div>
                <pre style={{ margin: "6px 0 0", color: "#9adfb0", whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "monospace", fontSize: 11 }}>
                  {JSON.stringify(l.data, null, 2).slice(0, 1400)}
                </pre>
              </div>
            ))}
          </div>
        </div>

        {/* Unlock card */}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ width: 10, height: 10, background: GOAT_GREEN, borderRadius: "50%" }} />
            <b style={{ fontSize: 13 }}>UNLOCK</b>
            {!challenge && !unlocked && (
              <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignItems: "center" }}>
                <input
                  value={loadId || (created ? created.invoiceId : "")}
                  onChange={e => setLoadId(e.target.value)}
                  placeholder="Paste a paywall invoice id…"
                  style={{ width: 260, background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, padding: "9px 12px", color: "#ddd", fontSize: 11, fontFamily: "monospace" }}
                />
                <button onClick={() => loadPaywall((loadId || created?.invoiceId || "").trim())} disabled={busy || !(loadId || created?.invoiceId)} style={{ background: "transparent", border: "1px solid " + GOAT_GREEN, color: GOAT_GREEN, padding: "9px 14px", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: busy || !(loadId || created?.invoiceId) ? "not-allowed" : "pointer", opacity: busy || !(loadId || created?.invoiceId) ? 0.5 : 1 }}>
                  Load
                </button>
              </div>
            )}
          </div>

          {unlocked ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span style={{ width: 10, height: 10, background: GOAT_GREEN, borderRadius: "50%", boxShadow: `0 0 0 4px rgba(49,130,93,0.25)` }} />
                <b style={{ color: GOAT_GREEN, fontSize: 14 }}>PAYMENT VERIFIED — CONTENT UNLOCKED</b>
              </div>
              <div style={{ color: "#999", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{unlocked.title || "Deliverable"}</div>
              <pre style={{ background: "#0d0d0d", border: "1px solid #1c1c1c", borderRadius: 10, padding: 16, whiteSpace: "pre-wrap", color: "#d6e8dc", fontSize: 12, lineHeight: 1.7, margin: "0 0 16px" }}>
{unlocked.deliverable}
              </pre>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
                {unlocked.explorerUrl ? (
                  <a href={unlocked.explorerUrl} target="_blank" rel="noreferrer" style={{ background: GOAT_GREEN, color: "#fff", textDecoration: "none", padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 800 }}>
                    VIEW TX ON GOAT EXPLORER →
                  </a>
                ) : (
                  <span style={{ color: "#666", fontSize: 12, padding: "10px 16px" }}>paid previously — tx recorded on the invoice</span>
                )}
                {challenge && (
                  <button onClick={() => { setUnlocked(null); setChallenge(null); setTxHash(null); loadPaywall(challenge.invoiceId) }} style={{ background: "transparent", border: "1px solid #333", color: "#ccc", padding: "10px 16px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                    ↻ New buyer
                  </button>
                )}
              </div>
              <div style={{ color: "#666", fontSize: 11, marginBottom: 8 }}>EVIDENCE-CHAIN DELIVERY RECEIPT (HMAC-SIGNED BY PAYMATE)</div>
              {unlocked.receipt ? (
                <pre style={{ background: "#0d0d0d", border: "1px solid #1c1c1c", borderRadius: 10, padding: 16, whiteSpace: "pre-wrap", wordBreak: "break-all", color: "#8ab4f8", fontSize: 11, lineHeight: 1.7, margin: 0 }}>
{JSON.stringify(unlocked.receipt, null, 2).slice(0, 1600)}
                </pre>
              ) : (
                <p style={{ color: "#888", fontSize: 12, margin: 0 }}>
                  No receipt on this response — the server had no signing secret configured, so it refused to sign (fail-closed).
                </p>
              )}
            </div>
          ) : challenge ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <b style={{ fontSize: 14 }}>Paywall <span style={{ color: GOAT_GREEN }}>#{challenge.invoiceId.slice(0, 8)}</span> — <span style={{ color: GOAT_GREEN }}>{challenge.accepts[0]?.price || "$0.00"}</span></b>
                <span style={{ color: "#ff5b2e", fontSize: 12, fontWeight: 800 }}>HTTP {challenge.status} PAYMENT REQUIRED</span>
              </div>
              <pre style={{ background: "#0d0d0d", border: "1px solid #1c1c1c", borderRadius: 10, padding: 16, whiteSpace: "pre-wrap", wordBreak: "break-all", color: "#9adfb0", fontSize: 11, lineHeight: 1.7, margin: "0 0 20px" }}>
{challenge.accepts[0] && `PAYMENT-REQUIRED: ${challenge.paymentRequiredHeader.slice(0, 400)}`}

{JSON.stringify({ x402Version: challenge.x402Version, accepts: challenge.accepts }, null, 2)}
              </pre>
              {!isConnected ? (
                <WalletConnectMenu triggerClassName="button button-primary" triggerLabel={<>Connect wallet to pay & unlock</>} />
              ) : (
                <button onClick={payAndUnlock} disabled={busy} style={{ background: "#ff5b2e", color: "#fff", border: "none", padding: "14px 24px", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Sending transfer & verifying on-chain…" : `Pay ${challenge.accepts[0]?.price || "$0.00"} USDC & Unlock`}
                </button>
              )}
              {txHash && (
                <div style={{ marginTop: 12, fontSize: 11, color: "#8ab4f8", wordBreak: "break-all" }}>
                  tx: {txHash}
                </div>
              )}
              {challenge.payUrl && (
                <a href={challenge.payUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 12, fontSize: 11, color: "#8ab4f8", textDecoration: "underline" }}>
                  or pay via the standard PayMate checkout →
                </a>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
                <input
                  value={txInput}
                  onChange={e => setTxInput(e.target.value)}
                  placeholder="Paid elsewhere? Paste your 0x tx hash…"
                  style={{ flex: 1, background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, padding: "10px 12px", color: "#ddd", fontSize: 11, fontFamily: "monospace" }}
                />
                <button
                  onClick={() => txInput.trim().length > 0 && unlockWith(txInput.trim())}
                  disabled={busy || txInput.trim().length === 0}
                  style={{ background: "transparent", border: "1px solid " + GOAT_GREEN, color: GOAT_GREEN, padding: "10px 16px", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: busy ? "wait" : "pointer", opacity: busy || txInput.trim().length === 0 ? 0.5 : 1 }}
                >
                  Verify & Unlock
                </button>
              </div>
            </div>
          ) : (
            <p style={{ color: "#777", fontSize: 12, margin: 0 }}>
              Create a paywall above, or paste an existing paywall invoice id to run the handshake.
            </p>
          )}
          {error && (
            <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(255,91,46,0.08)", border: "1px solid rgba(255,91,46,0.3)", borderRadius: 8, color: "#ff8a68", fontSize: 12 }}>
              {error}
            </div>
          )}
        </div>

        {/* Curl for agents */}
        <div style={{ marginTop: 40 }}>
          <div style={{ color: "#666", fontSize: 11, fontWeight: 800, marginBottom: 10, letterSpacing: "0.08em" }}>FOR AGENTS — THE SAME RAIL IN THREE CALLS</div>
          <pre style={{ background: "#000", border: "1px solid #222", borderRadius: 12, padding: 18, whiteSpace: "pre-wrap", color: "#9adfb0", fontSize: 11, lineHeight: 1.8, margin: 0 }}>
{curl}
          </pre>
        </div>
      </div>
    </main>
  )
}
