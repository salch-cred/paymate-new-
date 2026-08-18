'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Icon } from '@/components/icons'

interface ProviderProfile {
  address: string
  name: string | null
  servicesCount: number
  completedJobs: number
  earnedUsd: number
  avgRating: number
  openProposals: number
  services: {
    id: string
    title: string
    categoryLabel: string
    price: number
    deliveryDays: number
    rating: number
    reviewCount: number
    completedCount: number
  }[]
  reviews: {
    orderId: string
    serviceTitle: string
    amountUsd: number
    rating: number | null
    review: string | null
    completedAt: number | null
  }[]
}

function shortAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function timeAgo(ts: number): string {
  const seconds = Math.max(1, Math.floor((Date.now() - ts) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function ProviderProfilePage() {
  const params = useParams<{ address: string }>()
  const address = params?.address ?? ''
  const [profile, setProfile] = useState<ProviderProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!address) return
    const controller = new AbortController()
    fetch(`/api/providers/${address}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.provider) setProfile(json.provider)
        else setError('Provider not found')
      })
      .catch(() => setError('Could not load provider'))
    return () => controller.abort()
  }, [address])

  return (
    <div className="app-content" style={{ padding: '28px', maxWidth: 980, margin: '0 auto', minHeight: '100%' }}>
      <Link href="/market" style={{ fontSize: 13, color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18 }}>
        <Icon name="arrow" size={13} style={{ transform: 'rotate(180deg)' }} /> Back to market
      </Link>

      {!profile && !error && <div className="activity-empty" style={{ padding: '48px 0' }}>Loading provider…</div>}
      {error && <div className="activity-empty" style={{ padding: '48px 0' }}>{error}</div>}

      {profile && (
        <>
          <div className="panel panel-pad" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ width: 56, height: 56, borderRadius: '50%', background: '#1a1a1a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>
                {(profile.name || '?')[0].toUpperCase()}
              </span>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ margin: 0, fontSize: 22, letterSpacing: '-0.03em' }}>{profile.name || 'Anonymous provider'}</h1>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)', fontFamily: 'monospace' }}>{shortAddress(profile.address)}</p>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div className="metric-card" style={{ minWidth: 110 }}>
                  <span>Completed</span><b>{profile.completedJobs}</b><small>jobs delivered</small>
                </div>
                <div className="metric-card" style={{ minWidth: 110 }}>
                  <span>Earned</span><b>${profile.earnedUsd.toLocaleString()}</b><small>escrow released</small>
                </div>
                <div className="metric-card" style={{ minWidth: 110 }}>
                  <span>Rating</span><b style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="star" size={13} /> {profile.avgRating.toFixed(1)}</b><small>verified reviews</small>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 16, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="package" size={13} /> {profile.servicesCount} active service{profile.servicesCount === 1 ? '' : 's'}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="briefcase" size={13} /> {profile.openProposals} open proposal{profile.openProposals === 1 ? '' : 's'}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="shield" size={13} /> Escrow-backed · AI-verified delivery · USDC on GOAT</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <section className="panel panel-pad">
              <div className="panel-heading">
                <div><h2>Services</h2><p>Fixed-price listings from this provider.</p></div>
                <span className="icon-box"><Icon name="invoice" /></span>
              </div>
              {profile.services.length === 0 ? (
                <div className="activity-empty" style={{ padding: '24px 0' }}>No active service listings.</div>
              ) : (
                profile.services.map((s) => (
                  <div key={s.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border, #eee)' }}>
                    <Link href={`/market?service=${s.id}`} style={{ fontWeight: 600, fontSize: 14, color: '#1a1a1a', textDecoration: 'none' }}>
                      {s.title}
                    </Link>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {s.categoryLabel} · ${s.price} · {s.deliveryDays}d · <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle' }}><Icon name="star" size={11} /> {s.rating.toFixed(1)}</span> ({s.reviewCount}) · <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle' }}><Icon name="check" size={11} /> {s.completedCount} completed</span>
                    </div>
                  </div>
                ))
              )}
            </section>

            <section className="panel panel-pad">
              <div className="panel-heading">
                <div><h2>Verified reviews</h2><p>Buyer feedback after escrow release.</p></div>
                <span className="icon-box"><Icon name="chart" /></span>
              </div>
              {profile.reviews.length === 0 ? (
                <div className="activity-empty" style={{ padding: '24px 0' }}>No reviews yet — they appear after completed engagements.</div>
              ) : (
                profile.reviews.map((r) => (
                  <div key={r.orderId} style={{ padding: '10px 0', borderBottom: '1px solid var(--border, #eee)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <b style={{ fontSize: 13 }}>{r.serviceTitle}</b>
                      <span style={{ color: 'var(--muted)' }}>{r.completedAt ? timeAgo(r.completedAt) : ''}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {r.rating ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle' }}><Icon name="star" size={11} /> {r.rating} / 5 · </span> : ''}{r.amountUsd.toLocaleString()}
                    </div>
                    {r.review && <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.5, color: '#444' }}>{r.review}</p>}
                  </div>
                ))
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
