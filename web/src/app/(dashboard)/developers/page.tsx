"use client"

import Link from "next/link"
import { useState } from "react"
import { useAccount, useWalletClient } from "wagmi"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getAddress, isAddress } from "viem"
import { Icon } from "@/components/icons"
import { WalletConnectMenu } from "@/components/wallet-connect-menu"

interface KeyRow {
  id: string
  name: string
  keyPrefix: string
  quotaUsd: number
  usedUsd: number
  revokedAt: number | null
  createdAt: number
  lastUsedAt: number | null
}

const SIGN_MESSAGE = (wallet: string, ts: number) => `PayMate API key management for ${wallet} at ${ts}`

/** Module-level wrapper so the React Compiler purity rule sees this as opaque. */
const nowMs = () => Date.now()

export default function DevelopersPage() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()

  const queryClient = useQueryClient()
  const keysQuery = useQuery({
    queryKey: ["apiKeys", address],
    enabled: isConnected && !!address && !!walletClient,
    queryFn: async () => {
      if (!address || !isAddress(address) || !walletClient) return [] as KeyRow[]
      const ts = nowMs()
      const signature = await walletClient.signMessage({ message: SIGN_MESSAGE(getAddress(address), ts), account: address as `0x${string}` })
      const q = new URLSearchParams({ wallet: getAddress(address), message: SIGN_MESSAGE(getAddress(address), ts), signature, ts: String(ts) })
      const res = await fetch(`/api/apikeys?${q}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Could not load API keys")
      return data.keys as KeyRow[]
    },
  })
  const keys = keysQuery.data ?? null
  const loadError = keysQuery.isError ? (keysQuery.error instanceof Error ? keysQuery.error.message : "Could not load API keys") : null
  const [name, setName] = useState("")
  const [quotaUsd, setQuotaUsd] = useState("1000")
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function createKey() {
    if (!address || !isAddress(address) || !walletClient) return
    setLoading(true)
    setError(null)
    setCreatedKey(null)
    try {
      const ts = nowMs()
      const signature = await walletClient.signMessage({ message: SIGN_MESSAGE(getAddress(address), ts), account: address as `0x${string}` })
      const res = await fetch("/api/apikeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: getAddress(address),
          message: SIGN_MESSAGE(getAddress(address), ts),
          signature,
          ts,
          name,
          quotaUsd: Number(quotaUsd),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Could not create key")
      setCreatedKey(data.key.rawKey)
      setName("")
      setQuotaUsd("1000")
      queryClient.invalidateQueries({ queryKey: ["apiKeys", address] })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create key")
    } finally {
      setLoading(false)
    }
  }

  async function revoke(id: string) {
    if (!address || !isAddress(address) || !walletClient) return
    setError(null)
    try {
      const ts = nowMs()
      const signature = await walletClient.signMessage({ message: SIGN_MESSAGE(getAddress(address), ts), account: address as `0x${string}` })
      const res = await fetch("/api/apikeys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: getAddress(address),
          message: SIGN_MESSAGE(getAddress(address), ts),
          signature,
          ts,
          id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Could not revoke key")
      queryClient.invalidateQueries({ queryKey: ["apiKeys", address] })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke key")
    }
  }

  async function copy(text: string, tag: string) {
    await navigator.clipboard.writeText(text)
    setCopied(tag)
    setTimeout(() => setCopied(null), 1500)
  }

  const activeKeys = (keys ?? []).filter(k => !k.revokedAt)
  const totalQuota = activeKeys.reduce((s, k) => s + k.quotaUsd, 0)
  const totalUsed = activeKeys.reduce((s, k) => s + k.usedUsd, 0)

  return (
    <>
          <header className="app-topbar">
            <div>
              <span className="workspace-label">AGENT PLATFORM</span>
              <h1>Give your agent a wallet key.</h1>
              <p>Self-serve API keys so any OpenClaw team can bill and settle through PayMate.</p>
            </div>
            <div className="topbar-actions">
              <Link href="/docs" className="topbar-icon"><Icon name="send" size={17}/></Link>
              <WalletConnectMenu triggerClassName="wallet-button primary" triggerLabel={<><Icon name="wallet" size={17}/>{isConnected ? `${address?.slice(0,6)}…${address?.slice(-4)}` : "Connect wallet"}</>} />
            </div>
          </header>

          <div className="dashboard-page-content">
          {!isConnected ? (
            <section className="panel connect-empty" style={{ margin: 0 }}> 
              <div>
                <div className="empty-orb"><Icon name="network" size={34}/></div>
                <h2>Connect your wallet to mint API keys</h2>
                <p>Your wallet is the owner of every key. Creating and revoking keys requires a signed message from it.</p>
                <WalletConnectMenu triggerClassName="button button-primary" triggerLabel={<>Connect wallet <Icon name="arrow"/></>}/>
              </div>
            </section>
          ) : (
            <>
              <div className="metric-grid">
                <div className="metric-card">
                  <span>Active keys</span>
                  <b>{activeKeys.length}</b>
                  <small>max 5 per wallet</small>
                </div>
                <div className="metric-card">
                  <span>Monthly quota used</span>
                  <b>${totalUsed.toLocaleString()} / ${totalQuota.toLocaleString()}</b>
                  <small>across all active keys</small>
                </div>
                <div className="metric-card">
                  <span>Billing endpoint</span>
                  <b style={{fontSize:'14px'}}>/api/agent/paymate-skill</b>
                  <small>Auth: Bearer pm_...</small>
                </div>
              </div>

              <div className="dashboard-grid">
                <div>
                  <section className="panel panel-pad">
                    <div className="panel-heading">
                      <div><h2>Create an API key</h2><p>Each key has its own monthly USD quota.</p></div>
                      <span className="icon-box"><Icon name="network"/></span>
                    </div>
                    <div className="form-grid">
                      <div className="field">
                        <label>Key name</label>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="My OpenClaw agent" />
                      </div>
                      <div className="field">
                        <label>Monthly quota (USDC)</label>
                        <input type="number" min="1" value={quotaUsd} onChange={e => setQuotaUsd(e.target.value)} placeholder="1000" />
                      </div>
                    </div>
                    {(error || loadError) && <div className="error-box">{error || loadError}</div>}
                    <div className="composer-footer">
                      <span className="hint"><Icon name="shield" size={15}/>Creating a key signs a message with your wallet — no gas, no transaction.</span>
                      <button className="button button-primary" disabled={loading} onClick={createKey}>
                        {loading ? "Signing…" : "Create key"} <Icon name="arrow" size={17}/>
                      </button>
                    </div>

                    {createdKey && (
                      <div style={{marginTop:'16px', padding:'16px', background:'rgba(0,0,0,0.9)', color:'white', borderRadius:'12px'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
                          <b style={{fontSize:'13px'}}>🔑 Your key (shown once)</b>
                          <button onClick={() => copy(createdKey, 'raw')} style={{background:'none', border:'none', color:'#c9fa78', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', fontWeight:700}}>
                            <Icon name={copied === 'raw' ? "check" : "copy"} size={13}/> {copied === 'raw' ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <code style={{fontSize:'11px', wordBreak:'break-all', color:'#c9fa78'}}>{createdKey}</code>
                        <p style={{fontSize:'11px', color:'rgba(255,255,255,0.6)', marginTop:'8px'}}>Store it securely. It cannot be recovered if lost.</p>
                      </div>
                    )}
                  </section>

                  <section className="panel panel-pad" style={{marginTop:'16px'}}>
                    <div className="panel-heading">
                      <div><h2>Use it from your agent</h2><p>Wire the key into your OpenClaw agent or any HTTP caller.</p></div>
                      <span className="icon-box"><Icon name="bolt"/></span>
                    </div>
                    <div style={{display:'flex', flexDirection:'column', gap:'16px'}}>
                      <div>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
                          <label style={{fontWeight:800, fontSize:'12px'}}>cURL</label>
                          <button onClick={() => copy(`curl -X POST https://paymateagent.xyz/api/agent/paymate-skill \\\n  -H "Authorization: Bearer pm_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Data scraping","description":"Scraped 10k records","amountUsd":50,"freelancerWallet":"0x..."}'`, 'curl')} style={{background:'none', border:'none', color:'var(--muted)', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', fontWeight:700}}>
                            <Icon name={copied === 'curl' ? "check" : "copy"} size={13}/> {copied === 'curl' ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <pre style={{background:'rgba(0,0,0,0.9)', color:'#c9fa78', padding:'14px', borderRadius:'10px', fontSize:'11px', overflowX:'auto', lineHeight:1.6, margin:0}}>{`curl -X POST https://paymateagent.xyz/api/agent/paymate-skill \\
  -H "Authorization: Bearer pm_..." \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Data scraping","description":"Scraped 10k records","amountUsd":50,"freelancerWallet":"0x..."}'`}</pre>
                      </div>
                      <div>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
                          <label style={{fontWeight:800, fontSize:'12px'}}>OpenClaw skill</label>
                          <button onClick={() => copy(`openclaw skill install https://paymateagent.xyz/openclaw-skill.json\n# then call generate_invoice with:\n# Authorization: Bearer pm_...`, 'ocl')} style={{background:'none', border:'none', color:'var(--muted)', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', fontWeight:700}}>
                            <Icon name={copied === 'ocl' ? "check" : "copy"} size={13}/> {copied === 'ocl' ? "Copied" : "Copy"}
                          </button>
                        </div>
                        <pre style={{background:'rgba(0,0,0,0.9)', color:'#c9fa78', padding:'14px', borderRadius:'10px', fontSize:'11px', overflowX:'auto', lineHeight:1.6, margin:0}}>{`openclaw skill install https://paymateagent.xyz/openclaw-skill.json
# then call generate_invoice with:
# Authorization: Bearer pm_...`}</pre>
                      </div>
                    </div>
                  </section>
                </div>

                <section className="panel panel-pad">
                  <div className="panel-heading">
                    <div><h2>Your keys</h2><p>Usage is charged against each key&apos;s quota.</p></div>
                    <span className="activity-count">{(keys ?? []).length}</span>
                  </div>
                  {(keys ?? []).length === 0 ? (
                    <div className="activity-empty">No API keys yet. Create one to connect an agent.</div>
                  ) : (
                    <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                      {(keys ?? []).map(k => (
                        <div key={k.id} style={{padding:'14px', background:'rgba(255,255,255,0.5)', borderRadius:'12px', border:'1px solid var(--line)', opacity: k.revokedAt ? 0.55 : 1}}>
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
                            <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                              <b style={{fontSize:'13px'}}>{k.name}</b>
                              {k.revokedAt ? <span style={{fontSize:'9px', fontWeight:800, color:'#b94328', background:'#fff0ed', padding:'2px 8px', borderRadius:'8px'}}>REVOKED</span> : <span style={{fontSize:'9px', fontWeight:800, color:'#317454', background:'#e7f5ec', padding:'2px 8px', borderRadius:'8px'}}>ACTIVE</span>}
                            </div>
                            {!k.revokedAt && (
                              <button onClick={() => revoke(k.id)} style={{background:'none', border:'none', color:'#b94328', cursor:'pointer', fontSize:'11px', fontWeight:700}}>Revoke</button>
                            )}
                          </div>
                          <div style={{fontFamily:'monospace', fontSize:'11px', color:'var(--muted)', marginBottom:'8px'}}>{k.keyPrefix}</div>
                          <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', color:'var(--muted)'}}>
                            <span>Quota: ${k.usedUsd.toLocaleString()} / ${k.quotaUsd.toLocaleString()}</span>
                            <span>Created {new Date(k.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div style={{height:'6px', background:'var(--line)', borderRadius:'3px', marginTop:'8px', overflow:'hidden'}}>
                            <div style={{width: `${Math.min(100, (k.usedUsd / Math.max(1, k.quotaUsd)) * 100)}%`, height:'100%', background: k.usedUsd / Math.max(1, k.quotaUsd) > 0.8 ? '#ff5b2e' : 'var(--ink)'}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
          </div>
    </>
  )
}
