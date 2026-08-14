'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useWalletClient } from 'wagmi'
import { useWallet } from '@/lib/useWallet'
import type { ServiceOrder } from '@/lib/services/types'
import { acceptOrderProofMessage, disputeOrderProofMessage, fundOrderProofMessage, signWalletProof } from '@/lib/services/proofs'
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, shortAddress, timeAgo, formatUsd } from '@/lib/services/ui'
import { Icon } from '@/components/icons'

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid var(--border, #e5e5e5)',
  fontSize: 13,
  background: '#fff',
  outline: 'none',
  width: '100%',
}

export default function OrdersPage() {
  const { address, isConnected } = useWallet()
  const { data: walletClient } = useWalletClient()

  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Per-order transient state: funding tx, deliverable, dispute complaint, accept rating
  const [fundTx, setFundTx] = useState<Record<string, string>>({})
  const [fundingInfo, setFundingInfo] = useState<Record<string, { payTo?: string; price?: string }>>({})
  const [deliverable, setDeliverable] = useState<Record<string, string>>({})
  const [complaint, setComplaint] = useState<Record<string, string>>({})
  const [rating, setRating] = useState<Record<string, number>>({})
  const [review, setReview] = useState<Record<string, string>>({})
  const [openSection, setOpenSection] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!address) return
    setLoading(true)
    const res = await fetch(`/api/orders?wallet=${encodeURIComponent(address)}`)
    const data = await res.json().catch(() => null)
    setOrders(data?.orders ?? [])
    setLoading(false)
  }, [address])

  useEffect(() => {
    if (!address) return
    const controller = new AbortController()
    fetch(`/api/orders?wallet=${encodeURIComponent(address)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setOrders(data?.orders ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [address])

  const roleFor = (order: ServiceOrder) => (order.buyer === address?.toLowerCase() ? 'buyer' : 'provider')

  const doFund = async (order: ServiceOrder) => {
    if (!address || !walletClient) return
    setBusyId(order.id)
    setError('')
    const tx = (fundTx[order.id] || '').trim()
    if (!fundingInfo[order.id]?.payTo) {
      const res = await fetch(`/api/orders/${order.id}`)
      const data = await res.json().catch(() => ({}))
      if (data.paymentRequirements) {
        const accept = data.paymentRequirements.accepts?.[0]
        setFundingInfo((m) => ({ ...m, [order.id]: { payTo: accept?.payTo, price: accept?.price } }))
        setBusyId(null)
        return
      }
      setError(data.error ?? 'Could not load funding details.')
      setBusyId(null)
      return
    }
    const proof = await signWalletProof(walletClient, address, fundOrderProofMessage(order.id, Date.now()))
    const res = await fetch(`/api/orders/${order.id}/fund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash: tx, callerAddress: address, ...proof }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setBusyId(null)
      void load()
    } else {
      setError(data.error ?? 'Funding verification failed.')
      setBusyId(null)
    }
  }

  const doDeliver = async (order: ServiceOrder) => {
    if (!address || !walletClient) return
    setBusyId(order.id)
    setError('')
    const res = await fetch(`/api/orders/${order.id}/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliverable: deliverable[order.id] || '', callerAddress: address }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setBusyId(null)
      void load()
    } else {
      setError(data.error ?? 'Could not submit the deliverable.')
      setBusyId(null)
    }
  }

  const doAccept = async (order: ServiceOrder) => {
    if (!address || !walletClient) return
    setBusyId(order.id)
    setError('')
    const proof = await signWalletProof(walletClient, address, acceptOrderProofMessage(order.id, Date.now()))
    const res = await fetch(`/api/orders/${order.id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callerAddress: address,
        ...proof,
        rating: rating[order.id] ?? null,
        review: review[order.id] || null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setBusyId(null)
      void load()
    } else {
      setError(data.error ?? 'Could not accept the delivery.')
      setBusyId(null)
    }
  }

  const doDispute = async (order: ServiceOrder) => {
    if (!address || !walletClient) return
    setBusyId(order.id)
    setError('')
    const proof = await signWalletProof(walletClient, address, disputeOrderProofMessage(order.id, Date.now()))
    const res = await fetch(`/api/orders/${order.id}/dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ complaint: complaint[order.id] || '', callerAddress: address, ...proof }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setBusyId(null)
      void load()
    } else {
      setError(data.error ?? 'Could not file the dispute.')
      setBusyId(null)
    }
  }

  const toggle = (id: string, section: string) =>
    setOpenSection((m) => ({ ...m, [id]: m[id] === section ? '' : section }))

  if (!isConnected) {
    return (
      <div className="app-content" style={{ padding: '48px 28px', background: '#f8f6f1', minHeight: '100%' }}>
        <div className="panel panel-pad">
          <h2 style={{ margin: 0 }}>Connect your wallet</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Your orders are tied to your wallet — connect to see your buyer and provider engagements.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <header className="app-topbar" style={{ marginBottom: 0, position: 'sticky', top: 0, zIndex: 30 }}>
        <div>
          <span className="workspace-label">PAYMATE MARKET ECONOMY</span>
          <h1 style={{ fontSize: 22, margin: 0, letterSpacing: '-0.03em' }}>My orders</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            {shortAddress(address || '')} · buyer & provider engagements, escrow-backed.
          </p>
        </div>
        <div className="topbar-actions">
          <Link href="/market" className="topbar-icon" title="Browse services">
            <Icon name="spark" size={17} />
          </Link>
        </div>
      </header>

      <div className="app-content" style={{ padding: '24px 28px', background: '#f8f6f1', minHeight: '100%' }}>
        {error && <p style={{ fontSize: 13, color: '#DC2626', marginBottom: 14 }}>{error}</p>}
        {loading ? (
          <div className="activity-empty" style={{ padding: '48px 0' }}>Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="panel panel-pad">
            <h2 style={{ margin: 0 }}>No orders yet</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14 }}>
              Hire an agent or freelancer on the <Link href="/market" style={{ color: '#2563EB' }}>services market</Link> — funds escrow on-chain until delivery.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {orders.map((order) => {
              const role = roleFor(order)
              const verdict = order.aiVerdict
              return (
                <div key={order.id} className="panel panel-pad">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="workspace-label" style={{ color: role === 'buyer' ? '#2563EB' : '#16A34A' }}>
                          YOU ARE {role.toUpperCase()}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: ORDER_STATUS_TONE[order.status] }}>{ORDER_STATUS_LABEL[order.status]}</span>
                      </div>
                      <h3 style={{ margin: '6px 0 0', fontSize: 17 }}>{order.serviceTitle}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                        {order.id.slice(0, 10)}… · {formatUsd(order.amountUsd)} · {timeAgo(order.createdAt)}
                        {order.fundTxHash && <span> · escrowed <span style={{ fontFamily: 'monospace' }}>0x{order.fundTxHash.slice(2, 10)}…</span></span>}
                      </p>
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>{formatUsd(order.amountUsd)}</span>
                  </div>

                  <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                    <b style={{ color: '#111' }}>Scope:</b> {order.scope}
                  </p>

                  {/* AI verdict */}
                  {verdict && (
                    <div className="panel" style={{ marginTop: 12, padding: 12, background: verdict.verdict === 'complete' ? '#F0FDF4' : verdict.verdict === 'incomplete' ? '#FEF2F2' : '#FFFBEB', fontSize: 13 }}>
                      <b>AI delivery verification: {verdict.verdict.toUpperCase()}</b> <span style={{ color: 'var(--muted)' }}>({Math.round(verdict.confidence * 100)}% confidence)</span>
                      <p style={{ margin: '6px 0 0', color: '#333', lineHeight: 1.5 }}>{verdict.reasoning}</p>
                    </div>
                  )}

                  {/* Dispute outcome */}
                  {order.dispute && (
                    <div className="panel" style={{ marginTop: 12, padding: 12, background: '#F5F3FF', fontSize: 13 }}>
                      <b>AI arbitration: {order.dispute.resolution}</b>
                      <p style={{ margin: '6px 0 0', color: '#333', lineHeight: 1.5 }}>{order.dispute.reasoning}</p>
                      <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--muted)' }}>Complaint: {order.dispute.complaint}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {order.status === 'pending_funding' && role === 'buyer' && (
                      <button className="button button-primary" style={{ height: 34, fontSize: 12 }} onClick={() => toggle(order.id, 'fund')}>
                        {openSection[order.id] === 'fund' ? 'Close funding' : 'Fund order'}
                      </button>
                    )}
                    {order.status === 'funded' && role === 'provider' && (
                      <button className="button button-primary" style={{ height: 34, fontSize: 12 }} onClick={() => toggle(order.id, 'deliver')}>
                        {openSection[order.id] === 'deliver' ? 'Close' : 'Submit deliverable'}
                      </button>
                    )}
                    {order.status === 'delivered' && role === 'buyer' && (
                      <>
                        <button className="button button-primary" style={{ height: 34, fontSize: 12 }} onClick={() => toggle(order.id, 'accept')}>
                          {openSection[order.id] === 'accept' ? 'Close' : 'Review & accept'}
                        </button>
                        <button className="button" style={{ height: 34, fontSize: 12, borderColor: '#FCA5A5', color: '#DC2626' }} onClick={() => toggle(order.id, 'dispute')}>
                          {openSection[order.id] === 'dispute' ? 'Close' : 'Dispute'}
                        </button>
                      </>
                    )}
                  </div>

                  {/* Funding panel */}
                  {openSection[order.id] === 'fund' && (
                    <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                      {fundingInfo[order.id]?.payTo ? (
                        <>
                          <div className="panel" style={{ background: '#FFF7ED', padding: 12, fontSize: 13, lineHeight: 1.6 }}>
                            <b>Send {fundingInfo[order.id].price ?? formatUsd(order.amountUsd)} USDC to the escrow contract:</b>
                            <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', marginTop: 4 }}>{fundingInfo[order.id].payTo}</div>
                          </div>
                          <input value={fundTx[order.id] || ''} onChange={(e) => setFundTx((m) => ({ ...m, [order.id]: e.target.value }))} placeholder="0x… payment tx hash" style={inputStyle} />
                          <button className="button button-primary" disabled={busyId === order.id || !(fundTx[order.id] || '').trim()} onClick={() => doFund(order)} style={{ height: 36 }}>
                            {busyId === order.id ? 'Verifying…' : 'I paid — confirm escrow funding'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="button button-primary" disabled={busyId === order.id} onClick={() => doFund(order)} style={{ height: 36 }}>
                            {busyId === order.id ? 'Loading…' : 'Load funding details'}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Deliver panel */}
                  {openSection[order.id] === 'deliver' && (
                    <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                      <textarea
                        value={deliverable[order.id] || ''}
                        onChange={(e) => setDeliverable((m) => ({ ...m, [order.id]: e.target.value }))}
                        rows={4}
                        placeholder="Describe what was delivered, with links or proof. The AI verifier will check it against the scope."
                        style={{ ...inputStyle, resize: 'vertical' }}
                      />
                      <button className="button button-primary" disabled={busyId === order.id || (deliverable[order.id] || '').trim().length < 10} onClick={() => doDeliver(order)} style={{ height: 36 }}>
                        {busyId === order.id ? 'Submitting…' : 'Submit deliverable'}
                      </button>
                    </div>
                  )}

                  {/* Accept panel */}
                  {openSection[order.id] === 'accept' && (
                    <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                      <p style={{ fontSize: 13, margin: 0 }}>
                        Accepting releases the escrowed {formatUsd(order.amountUsd)} to the provider and mints their ERC-8004 reputation.
                      </p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} onClick={() => setRating((m) => ({ ...m, [order.id]: n }))} style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid var(--border, #e5e5e5)', background: rating[order.id] === n ? '#1a1a1a' : '#fff', color: rating[order.id] === n ? '#fff' : '#333', cursor: 'pointer' }}>{n}★</button>
                        ))}
                      </div>
                      <input value={review[order.id] || ''} onChange={(e) => setReview((m) => ({ ...m, [order.id]: e.target.value }))} placeholder="Review (optional)" style={inputStyle} />
                      <button className="button button-primary" disabled={busyId === order.id} onClick={() => doAccept(order)} style={{ height: 36 }}>
                        {busyId === order.id ? 'Releasing escrow…' : 'Accept work & release payment'}
                      </button>
                    </div>
                  )}

                  {/* Dispute panel */}
                  {openSection[order.id] === 'dispute' && (
                    <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                      <textarea
                        value={complaint[order.id] || ''}
                        onChange={(e) => setComplaint((m) => ({ ...m, [order.id]: e.target.value }))}
                        rows={3}
                        placeholder="Why should the escrow be held or refunded? The AI arbitrator will rule on-chain."
                        style={{ ...inputStyle, resize: 'vertical' }}
                      />
                      <button className="button" disabled={busyId === order.id || (complaint[order.id] || '').trim().length < 5} onClick={() => doDispute(order)} style={{ height: 36, borderColor: '#FCA5A5', color: '#DC2626' }}>
                        {busyId === order.id ? 'Arbitrating…' : 'File dispute (binding AI verdict)'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
