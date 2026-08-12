import Link from 'next/link';
import { getFeaturedPlugins, getPlatformStats, CATEGORY_META } from '@/lib/marketplace/store';
import { initStore } from '@/lib/marketplace/serverStore';
import PluginCard from '@/components/marketplace/PluginCard';
import { formatNumber, formatUSDC } from '@/lib/marketplace/utils';
import { Icon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function MarketplaceHomePage() {
  await initStore();
  const featured = getFeaturedPlugins();
  const stats = getPlatformStats();

  return (
    <>
      {/* Top bar header matching dashboard style */}
      <header className="app-topbar" style={{ marginBottom: 0, position: 'sticky', top: 0, zIndex: 30 }}>
        <div>
          <span className="workspace-label">PAYMATE MARKETPLACE</span>
          <h1 style={{ fontSize: 22, margin: 0, letterSpacing: '-0.03em' }}>Agent Plugin Hub</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>Publish skills, buy capabilities — pay autonomously via x402 on GOAT Network.</p>
        </div>
        <div className="topbar-actions">
          <Link href="/dashboard/marketplace/publish" className="button button-primary" style={{ height: 38, fontSize: 12, padding: '0 16px', gap: 7 }}>
            <Icon name="send" size={14} /> Publish Plugin
          </Link>
          <Link href="/dashboard/marketplace/plugins" className="topbar-icon" title="Browse all plugins">
            <Icon name="package" size={17} />
          </Link>
        </div>
      </header>

      <div className="app-content" style={{ padding: '24px 28px', background: '#f8f6f1', minHeight: '100%' }}>

        {/* Live stats bar */}
        <div className="metric-grid" style={{ marginBottom: 24 }}>
          <div className="metric-card">
            <span>Plugins</span>
            <b>{formatNumber(stats.totalPlugins)}+</b>
            <small>Published on-chain</small>
          </div>
          <div className="metric-card">
            <span>Total Uses</span>
            <b>{formatNumber(stats.totalInstalls)}+</b>
            <small>Agent calls completed</small>
          </div>
          <div className="metric-card">
            <span>Developers</span>
            <b>{formatNumber(stats.totalDevelopers)}+</b>
            <small>Earning royalties</small>
          </div>
          <div className="metric-card" style={{ gridColumn: 'auto' }}>
            <span>Volume Settled</span>
            <b>{formatUSDC(stats.totalVolume)}</b>
            <small>USDC via x402</small>
          </div>
        </div>

        {/* What is the Marketplace — explanation panel */}
        <section className="panel panel-pad" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #1d1e1a 0%, #2a2b25 100%)', borderRadius: 20, border: 'none', color: 'white', padding: 32 }}>
          <div className="marketplace-explainer-grid">
            <div>
              <div style={{ color: 'var(--lime)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em' }}>
                <Icon name="network" size={14} /> HOW IT WORKS
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: '-0.05em', margin: '0 0 12px', lineHeight: 1.05 }}>
                One marketplace.<br />Zero middlemen.
              </h2>
              <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6, margin: 0 }}>
                PayMate&apos;s Marketplace is the on-chain plugin hub built directly into your workspace. Developers publish TypeScript skills, AI agents discover and pay per call via x402 micropayments — no API keys, no subscriptions, no gatekeepers.
              </p>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: 24 }}>
              <div style={{ color: 'var(--orange)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em' }}>
                <Icon name="bolt" size={14} /> FOR DEVELOPERS
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '-0.04em', margin: '0 0 10px' }}>Earn 80% royalties</h3>
              <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6, margin: '0 0 16px' }}>
                Write a plugin once. Every time an AI agent calls it, 80% of the payment flows directly to your wallet by smart contract. Publish in under 10 minutes.
              </p>
              <Link href="/dashboard/marketplace/publish" style={{ fontSize: 12, color: 'var(--lime)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                Start publishing <Icon name="arrow" size={13} />
              </Link>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: 24 }}>
              <div style={{ color: '#c9fa78', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em' }}>
                <Icon name="shield" size={14} /> FOR AI AGENTS
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '-0.04em', margin: '0 0 10px' }}>Buy capabilities on-demand</h3>
              <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6, margin: '0 0 16px' }}>
                Your agent queries by capability, gets back plugins with ratings, ERC-8004 trust scores, and per-call prices. Pay only what you use, per call, in USDC on GOAT Network.
              </p>
              <Link href="/dashboard/marketplace/plugins" style={{ fontSize: 12, color: '#c9fa78', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                Browse plugins <Icon name="arrow" size={13} />
              </Link>
            </div>
          </div>
        </section>

        {/* How it works — 3 steps */}
        <section className="panel panel-pad" style={{ marginBottom: 24 }}>
          <div className="panel-heading">
            <div>
              <h2>Three steps. Fully autonomous.</h2>
              <p>From publishing a plugin to earning royalties — no human required at any step.</p>
            </div>
            <span className="icon-box"><Icon name="spark" /></span>
          </div>
          <div className="marketplace-steps-grid">
            {[
              { n: '01', icon: 'send' as const, title: 'Developer Publishes', text: 'Write TypeScript plugin → upload to IPFS → register with a price. ERC-8004 identity minted on GOAT chain.' },
              { n: '02', icon: 'network' as const, title: 'Agent Discovers', text: 'AI agent queries marketplace by capability. Gets back plugins with ratings, prices, and on-chain trust scores.' },
              { n: '03', icon: 'bolt' as const, title: 'Pay via x402 & Use', text: 'Agent pays micropayment via x402 — no approval needed. Plugin executes instantly, royalties auto-distribute.' },
            ].map(s => (
              <div key={s.n} style={{ padding: '20px', background: 'rgba(255,255,255,0.6)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.7)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--orange)' }}>{s.n}</span>
                  <div className="icon-box" style={{ width: 32, height: 32, borderRadius: 9 }}><Icon name={s.icon} size={15} /></div>
                </div>
                <b style={{ fontSize: 14, fontWeight: 700 }}>{s.title}</b>
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.55, margin: 0 }}>{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Categories */}
        {CATEGORY_META.filter(c => c.count > 0).length > 0 && (
          <section className="panel panel-pad" style={{ marginBottom: 24 }}>
            <div className="panel-heading">
              <div><h2>Browse by Category</h2><p>Filter plugins by what your agent needs.</p></div>
              <Link href="/dashboard/marketplace/plugins" style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                See all <Icon name="arrow" size={13} />
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginTop: 16 }}>
              {CATEGORY_META.filter(c => c.count > 0).map(cat => (
                <Link key={cat.id} href={`/dashboard/marketplace/plugins?category=${cat.id}`}
                  style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.6)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 12, transition: 'all .2s', textDecoration: 'none', color: 'inherit' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: 13, display: 'block' }}>{cat.label}</b>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{cat.description}</span>
                  </div>
                  <Icon name="arrow" size={14} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Featured plugins */}
        {featured.length > 0 && (
          <section className="panel panel-pad" style={{ marginBottom: 24 }}>
            <div className="panel-heading">
              <div><h2>Featured Plugins</h2><p>Battle-tested by autonomous agents.</p></div>
              <Link href="/dashboard/marketplace/plugins" style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                Browse all <Icon name="arrow" size={13} />
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginTop: 16 }}>
              {featured.map(plugin => <PluginCard key={plugin.id} plugin={plugin} />)}
            </div>
          </section>
        )}

        {/* Empty state — no plugins yet */}
        {featured.length === 0 && (
          <div className="activity-empty" style={{ marginBottom: 24 }}>
            <Icon name="package" size={28} />
            <div style={{ marginTop: 12, fontWeight: 700 }}>No plugins published yet.</div>
            <p style={{ maxWidth: 420, margin: '8px auto 20px', lineHeight: 1.5 }}>Be the first developer to publish a TypeScript plugin. Earn 80% royalties on every agent call, paid instantly by smart contract.</p>
            <Link href="/dashboard/marketplace/publish" className="button button-dark">Publish your first plugin <Icon name="arrow" size={14} /></Link>
          </div>
        )}

        {/* CTA strip */}
        <div style={{ padding: 28, background: 'linear-gradient(115deg, var(--orange), #f67543)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 10, letterSpacing: '0.14em', fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>READY WHEN YOUR AGENT IS</span>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '-0.04em', color: 'white', margin: '8px 0 0' }}>Publish a plugin. Earn on every use.</h3>
          </div>
          <Link href="/dashboard/marketplace/publish" className="button" style={{ background: '#171813', color: 'white', minWidth: 160, flexShrink: 0 }}>
            Start publishing <Icon name="arrow" size={15} />
          </Link>
        </div>

      </div>
    </>
  );
}
