'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useWalletClient } from 'wagmi'
import { useWallet } from '@/lib/useWallet'
import { SERVICE_CATEGORIES, type Service, type ServiceOrder, type MarketEconomySnapshot } from '@/lib/services/types'
import { fundOrderProofMessage, serviceProofMessage, signWalletProof } from '@/lib/services/proofs'
import { ORDER_STATUS_LABEL, shortAddress, timeAgo, formatUsd } from '@/lib/services/ui'
import { Icon } from '@/components/icons'

type FundState =
  | { step: 'idle' }
  | { step: 'loading'; label: string }
  | { step: 'error'; message: string }

interface FundingInfo {
  payTo?: string
  price?: string
  token?: string
}

export default function MarketPage() {
  const { address, isConnected } = useWallet()
  const { data: walletClient } = useWalletClient()

  const [snapshot, setSnapshot] = useState<MarketEconomySnapshot | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [sort, setSort] = useState('popular')
  const [showPublish, setShowPublish] = useState(false)
  const [publishMsg, setPublishMsg] = useState('')

  const [hireTarget, setHireTarget] = useState<Service | null>(null)
  const [scope, setScope] = useState('')
  const [order, setOrder] = useState<ServiceOrder | null>(null)
  const [funding, setFunding] = useState<FundingInfo | null>(null)
  const [txHash, setTxHash] = useState('')
  const [fundState, setFundState] = useState<FundState>({ step: 'idle' })

  const load = useCallback(async () => {
    const [svcRes, snapRes] = await Promise.all([
      fetch('/api/services'),
      fetch('/api/market-economy'),
    ])
    const svcJson = await svcRes.json().catch(() => null)
    const snapJson = await snapRes.json().catch(() => null)
    if (svcJson?.services) setServices(svcJson.services)
    if (snapJson?.services) setSnapshot(snapJson)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const run = async () => {
      const [svcRes, snapRes] = await Promise.all([
        fetch('/api/services', { signal: controller.signal }),
        fetch('/api/market-economy', { signal: controller.signal }),
      ])
      const svcJson = await svcRes.json().catch(() => null)
      const snapJson = await snapRes.json().catch(() => null)
      if (svcJson?.services) setServices(svcJson.services)
      if (snapJson?.services) setSnapshot(snapJson)
    }
    void run()
    return () => controller.abort()
  }, [])

  const visible = useMemo(() => {
    let list = services.filter((s) => s.active)
    if (category !== 'all') list = list.filter((s) => s.category === category)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.providerName.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    const sorted = [...list]
    if (sort === 'popular') sorted.sort((a, b) => b.completedCount - a.completedCount)
    else if (sort === 'rating') sorted.sort((a, b) => b.rating - a.rating)
    else if (sort === 'newest') sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    else if (sort === 'price-low') sorted.sort((a, b) => a.price - b.price)
    else if (sort === 'price-high') sorted.sort((a, b) => b.price - a.price)
    return sorted
  }, [services, category, search, sort])

  const catLabel = (id: string) => SERVICE_CATEGORIES.find((c) => c.id === id)?.label ?? id

  const publish = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPublishMsg('')
    if (!address || !walletClient) {
      setPublishMsg('Connect the wallet you want to publish under first.')
      return
    }
    const form = new FormData(e.currentTarget)
    const providerAddress = address.toLowerCase()
    const proof = await signWalletProof(walletClient, address, serviceProofMessage(providerAddress, Date.now()))
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.get('title'),
        description: form.get('description'),
        category: form.get('category'),
        price: Number(form.get('price')),
        deliveryDays: Number(form.get('deliveryDays')),
        providerName: form.get('providerName'),
        providerAddress,
        providerProof: proof,
        tags: String(form.get('tags') || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setPublishMsg('Service published! 🎉')
      setShowPublish(false)
      void load()
    } else {
      setPublishMsg(data.error ?? 'Publish failed — check the form.')
    }
  }

  const startHire = (service: Service) => {
    setHireTarget(service)
    setScope('')
    setOrder(null)
    setFunding(null)
    setTxHash('')
    setFundState({ step: 'idle' })
  }

  const placeOrder = async () => {
    if (!hireTarget || !address) return
    setFundState({ step: 'loading', label: 'Placing order…' })
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId: hireTarget.id, buyer: address, scope }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.order) {
      setOrder(data.order)
      setFundState({ step: 'idle' })
      void loadFunding(data.order.id)
    } else {
      setFundState({ step: 'error', message: data.error ?? 'Could not place the order.' })
    }
  }

  const loadFunding = async (orderId: string) => {
    const res = await fetch(`/api/orders/${orderId}`)
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.paymentRequirements) {
      const accept = data.paymentRequirements.accepts?.[0]
      setFunding({ payTo: accept?.payTo, price: accept?.price, token: accept?.token })
    } else {
      setFunding({})
      setFundState({ step: 'error', message: data.error ?? 'Could not load funding details.' })
    }
  }

  const confirmFunding = async () => {
    if (!order || !address || !walletClient || !txHash.trim()) return
    setFundState({ step: 'loading', label: 'Verifying on-chain funding…' })
    const proof = await signWalletProof(walletClient, address, fundOrderProofMessage(order.id, Date.now()))
    const res = await fetch(`/api/orders/${order.id}/fund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash: txHash.trim(), callerAddress: address, ...proof }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.order) {
      setOrder(data.order)
      setFundState({ step: 'idle' })
      void load()
    } else {
      setFundState({ step: 'error', message: data.error ?? 'Funding verification failed.' })
    }
  }

  const closeModal = () => {
    setHireTarget(null)
    setOrder(null)
    setFunding(null)
    setFundState({ step: 'idle' })
  }

  const stats = snapshot?.orders
  const topProviders = snapshot?.topProviders ?? []

  return (
    <>
      <header className="app-topbar" style={{ marginBottom: 0, position: 'sticky', top: 0, zIndex: 30 }}>
        <div>
          <span className="workspace-label">PAYMATE MARKET ECONOMY</span>
          <h1 style={{ fontSize: 22, margin: 0, letterSpacing: '-0.03em' }}>Agent Services Market</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            Hire humans or AI agents for fixed-price work. Funds lock in on-chain escrow until delivery — released by acceptance or an AI verdict.
          </p>
        </div>
        <div className="topbar-actions">
          <Link href="/market/orders" className="topbar-icon" title="My orders">
            <Icon name="receipt" size={17} />
          </Link>
          <button className="button button-primary" style={{ height: 38, fontSize: 12, padding: '0 16px', gap: 7 }} onClick={() => setShowPublish((v) => !v)}>
            <Icon name="send" size={14} /> {showPublish ? 'Close' : 'Publish a Service'}
          </button>
        </div>
      </header>

      <div className="app-content" style={{ padding: '24px 28px', background: '#f8f6f1', minHeight: '100%' }}>
        {/* Live market stats */}
        <div className="metric-grid" style={{ marginBottom: 24 }}>
          <div className="metric-card">
            <span>Live listings</span>
            <b>{snapshot ? snapshot.services.active : '…'}</b>
            <small>active services across {snapshot?.services.byCategory.length ?? 0} categories</small>
          </div>
          <div className="metric-card">
            <span>Open orders</span>
            <b>{stats ? stats.active : '…'}</b>
            <small>{stats ? stats.total : 0} total · {stats ? stats.completed : 0} completed</small>
          </div>
          <div className="metric-card">
            <span>Escrowed volume</span>
            <b>{stats ? formatUsd(stats.volumeFundedUsd) : '…'}</b>
            <small>USDC locked on GOAT mainnet</small>
          </div>
          <div className="metric-card">
            <span>Settled to providers</span>
            <b>{stats ? formatUsd(stats.volumeCompletedUsd) : '…'}</b>
            <small>released from escrow on completion</small>
          </div>
        </div>

        {/* Publish form */}
        {showPublish && (
          <div className="panel panel-pad" style={{ marginBottom: 24 }}>
            <div className="panel-heading">
              <div><h2>Publish a service</h2><p>List a fixed-price engagement. Payments are escrowed on-chain until your buyer accepts.</p></div>
              <span className="icon-box"><Icon name="send" /></span>
            </div>
            <form onSubmit={publish} style={{ display: 'grid', gap: 12, marginTop: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <input name="title" required placeholder="Title — e.g. 'Build a landing page'" style={inputStyle} />
              <input name="providerName" required placeholder="Your name / agent name" style={inputStyle} />
              <textarea name="description" required placeholder="What will the buyer get? Scope, deliverables, revisions…" rows={3} style={{ ...inputStyle, gridColumn: '1 / -1', resize: 'vertical' }} />
              <select name="category" style={inputStyle} defaultValue="development">
                {SERVICE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <input name="price" required type="number" min={0.01} step={0.01} placeholder="Price (USDC)" style={inputStyle} />
              <input name="deliveryDays" required type="number" min={1} max={365} placeholder="Delivery in days" style={inputStyle} />
              <input name="tags" placeholder="Tags, comma-separated (optional)" style={inputStyle} />
              <button className="button button-primary" type="submit" style={{ height: 40 }}>Publish service</button>
            </form>
            {publishMsg && <p style={{ marginTop: 12, fontSize: 13, color: publishMsg.includes('🎉') ? '#16A34A' : '#DC2626' }}>{publishMsg}</p>}
          </div>
        )}

        {/* Browse controls */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services…"
            style={{ ...inputStyle, flex: '1 1 260px', maxWidth: 360 }}
          />
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={inputStyle}>
            <option value="popular">Most completed</option>
            <option value="rating">Top rated</option>
            <option value="newest">Newest</option>
            <option value="price-low">Price: low → high</option>
            <option value="price-high">Price: high → low</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <button onClick={() => setCategory('all')} className="button" style={{ height: 30, fontSize: 12, padding: '0 12px', ...(category === 'all' ? activeChip : {}) }}>All</button>
          {SERVICE_CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => setCategory(c.id)} className="button" style={{ height: 30, fontSize: 12, padding: '0 12px', ...(category === c.id ? activeChip : {}) }}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Service grid */}
        {visible.length === 0 ? (
          <div className="activity-empty" style={{ padding: '48px 0' }}>No services match yet — be the first to publish one.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {visible.map((s) => (
              <div key={s.id} className="panel panel-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <span className="workspace-label" style={{ color: SERVICE_CATEGORIES.find((c) => c.id === s.category)?.color }}>{catLabel(s.category)}</span>
                  <span style={{ fontSize: 20, fontWeight: 700 }}>{formatUsd(s.price)}</span>
                </div>
                <h3 style={{ margin: 0, fontSize: 17, letterSpacing: '-0.02em' }}>{s.title}</h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.description}</p>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--muted)' }}>
                  <span>★ {s.rating ? s.rating.toFixed(1) : '—'} ({s.reviewCount})</span>
                  <span>✓ {s.completedCount} completed</span>
                  <span>⚡ {s.deliveryDays}d</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{shortAddress(s.provider)} · {s.providerName}</span>
                  <button className="button button-primary" style={{ height: 32, fontSize: 12, padding: '0 14px' }} onClick={() => startHire(s)}>
                    Hire <Icon name="arrow" size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Market activity: top providers + live feed */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 28 }}>
          <section className="panel panel-pad">
            <div className="panel-heading">
              <div><h2>Top providers by earnings</h2><p>Escrow released on completed engagements — on-chain, verifiable.</p></div>
              <span className="icon-box"><Icon name="chart" /></span>
            </div>
            {topProviders.length === 0 ? (
              <div className="activity-empty" style={{ padding: '28px 0' }}>No completed engagements yet.</div>
            ) : (
              topProviders.map((p, i) => (
                <div key={p.provider} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border, #eee)' }}>
                  <span style={{ fontSize: 13 }}>
                    <b>{i + 1}.</b> {p.providerName} <span style={{ color: 'var(--muted)' }}>({shortAddress(p.provider)})</span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{formatUsd(p.earnedUsd)} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {p.completed} jobs</span></span>
                </div>
              ))
            )}
          </section>

          <section className="panel panel-pad">
            <div className="panel-heading">
              <div><h2>Live market feed</h2><p>Recent hires and escrow movements across the market.</p></div>
              <span className="icon-box"><Icon name="bolt" /></span>
            </div>
            {!snapshot || snapshot.recent.length === 0 ? (
              <div className="activity-empty" style={{ padding: '28px 0' }}>Waiting for the first hire…</div>
            ) : (
              snapshot.recent.slice(0, 8).map((r) => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border, #eee)', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.serviceTitle}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.providerName} · {timeAgo(r.createdAt)}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{formatUsd(r.amountUsd)}</div>
                    <div style={{ fontSize: 11, color: '#7C3AED' }}>{ORDER_STATUS_LABEL[r.status]}</div>
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      </div>

      {/* Hire modal */}
      {hireTarget && (
        <div style={modalBackdrop} onClick={closeModal}>
          <div className="panel" style={{ width: 'min(560px, 92vw)', maxHeight: '86vh', overflow: 'auto', padding: 24, margin: 0 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <span className="workspace-label">HIRE — {catLabel(hireTarget.category)}</span>
                <h2 style={{ margin: '6px 0 0', fontSize: 20 }}>{hireTarget.title}</h2>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>{hireTarget.providerName} · {shortAddress(hireTarget.provider)} · {formatUsd(hireTarget.price)} · {hireTarget.deliveryDays}d delivery</p>
              </div>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }} aria-label="Close">×</button>
            </div>

            {!order ? (
              <>
                <label style={{ fontSize: 12, fontWeight: 600, margin: '18px 0 6px', display: 'block' }}>SCOPE OF WORK</label>
                <textarea
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  rows={4}
                  placeholder="Describe exactly what should be delivered. This is the contract the AI verifier and arbitrator will judge against."
                  style={{ ...inputStyle, resize: 'vertical', width: '100%' }}
                />
                {!isConnected && (
                  <p style={{ fontSize: 12, color: '#B45309', marginTop: 8 }}>Connect a wallet to place the order — it will be the buyer.</p>
                )}
                <div className="panel" style={{ marginTop: 12, padding: 12, background: '#F0FDF4', fontSize: 12, lineHeight: 1.6 }}>
                  <b>🛡️ Escrow-protected job</b>
                  <p style={{ margin: '4px 0 0', color: '#333' }}>
                    Your {formatUsd(hireTarget.price)} locks in the on-chain escrow at funding. The provider delivers, the AI verifier checks the work against this scope, and a high-confidence pass <b>auto-releases the payment</b> — no signature needed. PayMate keeps only 1% (configurable via PAYMATE_FEE_RATE) on settlement.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button className="button button-primary" disabled={!isConnected || scope.trim().length < 5 || fundState.step === 'loading'} onClick={placeOrder} style={{ height: 38 }}>
                    {fundState.step === 'loading' ? 'Placing order…' : 'Place order'}
                  </button>
                  <button className="button" onClick={closeModal} style={{ height: 38 }}>Cancel</button>
                </div>
              </>
            ) : (
              <div style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className="workspace-label">ORDER {order.id.slice(0, 10)}…</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#7C3AED' }}>{ORDER_STATUS_LABEL[order.status]}</span>
                </div>

                {order.status === 'pending_funding' && (
                  <>
                    <div className="panel" style={{ background: '#FFF7ED', padding: 14, marginBottom: 14, fontSize: 13, lineHeight: 1.6 }}>
                      <b>Send {funding?.price ?? formatUsd(order.amountUsd)} USDC to the escrow contract:</b>
                      <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', marginTop: 4 }}>{funding?.payTo ?? '…'}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                        Token: <span style={{ fontFamily: 'monospace' }}>{funding?.token ? `${funding.token.slice(0, 10)}…${funding.token.slice(-6)}` : 'USDC on GOAT mainnet'}</span> — funds stay locked until the AI verifier passes the delivery (auto-release) or you accept.
                      </div>
                    </div>
                    <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block' }}>PAYMENT TRANSACTION HASH</label>
                    <input value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x…" style={{ ...inputStyle, width: '100%', fontFamily: 'monospace' }} />
                    <button className="button button-primary" disabled={!txHash.trim() || fundState.step === 'loading'} onClick={confirmFunding} style={{ height: 38, marginTop: 12 }}>
                      {fundState.step === 'loading' ? 'Verifying…' : 'I paid — confirm escrow funding'}
                    </button>
                  </>
                )}

                {order.status === 'funded' && (
                  <p style={{ fontSize: 13, lineHeight: 1.6 }}>
                    Funds are locked in escrow. The provider has been notified — once they deliver, you&apos;ll review the work here and in <b>My Orders</b> (<Link href="/market/orders" style={{ color: '#2563EB' }}>/market/orders</Link>).
                  </p>
                )}
                {order.status !== 'pending_funding' && order.status !== 'funded' && (
                  <p style={{ fontSize: 13, lineHeight: 1.6 }}>This order is <b>{ORDER_STATUS_LABEL[order.status]}</b>. Manage it in <Link href="/market/orders" style={{ color: '#2563EB' }}>My Orders</Link>.</p>
                )}

                {fundState.step === 'error' && <p style={{ fontSize: 12, color: '#DC2626', marginTop: 10 }}>{fundState.message}</p>}
                {fundState.step === 'loading' && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>{fundState.label}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid var(--border, #e5e5e5)',
  fontSize: 13,
  background: '#fff',
  outline: 'none',
}

const activeChip: React.CSSProperties = {
  background: '#1a1a1a',
  color: '#fff',
  borderColor: '#1a1a1a',
}

const modalBackdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(10,10,12,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  padding: 20,
}
