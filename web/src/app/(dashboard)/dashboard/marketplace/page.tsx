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

  const steps = [
    { n: '01', title: 'Developer Publishes', text: 'Write a TypeScript plugin, upload to IPFS, and register on SkillMint with a price. Earn 80% royalty on every use — automatically.', icon: 'send' as const },
    { n: '02', title: 'Agent Discovers', text: 'Your AI agent queries the marketplace for the capability it needs and gets back plugins with ratings, prices, and trust scores.', icon: 'network' as const },
    { n: '03', title: 'Pay via x402 & Use', text: 'The agent pays micropayments via x402 — no human approval needed. Plugin code returns instantly, royalties flow to the developer.', icon: 'bolt' as const },
  ];

  const values = [
    { cls: 'warm', icon: 'bolt' as const, title: 'x402 Native Payments', text: 'No API keys, no subscriptions. Agents pay per use via HTTP x402 micropayments on GOAT Network. Machine-speed, zero friction.' },
    { cls: 'mint', icon: 'shield' as const, title: 'ERC-8004 Identity', text: 'Every plugin and developer has on-chain identity. Reputation, ratings, and usage history are publicly verifiable on GOAT chain.' },
    { cls: 'indigo', icon: 'chart' as const, title: 'Automatic Royalties', text: 'Developers earn 80% of every payment, distributed instantly by smart contract. No manual invoicing. No payment delays.' },
  ];

  return (
    <>
      {/* Hero */}
      <section className="mp-hero">
        <div className="mp-hero-inner">
          <span className="section-kicker"><span className="pulse-dot" />THE ON-CHAIN PLUGIN MARKETPLACE</span>
          <h1 className="mp-hero-title">
            Mint new <em>abilities</em><br />for your AI agent
          </h1>
          <p className="mp-hero-lede">
            The plugin marketplace for AgentKit. Developers publish capabilities, agents discover
            and pay autonomously via x402 — no API keys, no subscriptions.
          </p>
          <div className="mp-hero-actions">
            <Link href="/dashboard/marketplace/plugins" className="button button-primary">
              Browse plugins <Icon name="arrow" size={15} />
            </Link>
            <Link href="/dashboard/marketplace/publish" className="button button-outline">
              Publish a plugin
            </Link>
          </div>
          <div className="mp-hero-live">
            <span><i />LIVE ON GOAT</span>
            <span>x402 PAYMENTS</span>
            <span>ERC—8004 IDENTITY</span>
            <span>USDC SETTLEMENT</span>
          </div>
          <div className="mp-hero-stats glass">
            <div className="mp-stat">
              <b>{formatNumber(stats.totalPlugins)}+</b>
              <span>Plugins</span>
            </div>
            <div className="mp-stat">
              <b>{formatNumber(stats.totalInstalls)}+</b>
              <span>Total uses</span>
            </div>
            <div className="mp-stat">
              <b>{formatNumber(stats.totalDevelopers)}+</b>
              <span>Developers</span>
            </div>
            <div className="mp-stat">
              <b>{formatUSDC(stats.totalVolume)}</b>
              <span>Volume</span>
            </div>
          </div>
        </div>
      </section>

      {/* Proof strip */}
      <div className="mp-proof">
        <span>POWERING AUTONOMOUS WORK ON</span>
        <b>GOAT</b><b>x402</b><b>ERC—8004</b><b>AGENTKIT</b><b>USDC</b>
        <span>MACHINE-PACED PAYMENTS</span>
      </div>

      {/* How it works */}
      <section className="mp-section">
        <div className="mp-section-inner">
          <div className="mp-section-head">
            <div>
              <span className="section-kicker">HOW SKILLMINT WORKS</span>
              <h2 className="mp-section-title">Three actors. Three flows.<br />Fully autonomous.</h2>
            </div>
          </div>
          <div className="mp-steps">
            {steps.map((s) => (
              <article className="mp-step" key={s.n}>
                <span className="mp-step-num">{s.n}</span>
                <div className="mp-step-icon"><Icon name={s.icon} size={22} /></div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mp-section" style={{ paddingTop: 0 }}>
        <div className="mp-section-inner">
          <div className="mp-section-head">
            <div>
              <span className="section-kicker">BROWSE BY CATEGORY</span>
              <h2 className="mp-section-title">Find the exact capability</h2>
            </div>
            <Link href="/dashboard/marketplace/plugins" className="mp-see-all">
              See all plugins <Icon name="arrow" size={14} />
            </Link>
          </div>
          <div className="mp-cats">
            {CATEGORY_META.filter((c) => c.count > 0).map((cat) => (
              <Link key={cat.id} href={`/marketplace/plugins?category=${cat.id}`} className="mp-cat">
                <span className="mp-cat-dot" style={{ background: cat.color }} />
                <span>
                  <h4>{cat.label}</h4>
                  <p>{cat.description}</p>
                </span>
                <Icon name="arrow" size={16} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured plugins */}
      <section className="mp-section" style={{ paddingTop: 0 }}>
        <div className="mp-section-inner">
          <div className="mp-section-head">
            <div>
              <span className="section-kicker">FEATURED PLUGINS</span>
              <h2 className="mp-section-title">Battle-tested by agents</h2>
            </div>
            <Link href="/dashboard/marketplace/plugins" className="mp-see-all">
              Browse all <Icon name="arrow" size={14} />
            </Link>
          </div>
          <div className="mp-grid">
            {featured.map((plugin) => <PluginCard key={plugin.id} plugin={plugin} />)}
          </div>
        </div>
      </section>

      {/* Value */}
      <section className="mp-section" style={{ paddingTop: 0 }}>
        <div className="mp-section-inner">
          <div className="mp-section-head">
            <div>
              <span className="section-kicker">WHY SKILLMINT</span>
              <h2 className="mp-section-title">Built on open rails</h2>
            </div>
          </div>
          <div className="mp-value-grid">
            {values.map((v) => (
              <article className={`mp-value ${v.cls}`} key={v.title}>
                <div className="mp-value-icon"><Icon name={v.icon} size={22} /></div>
                <h3>{v.title}</h3>
                <p>{v.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mp-section" style={{ paddingTop: 0 }}>
        <div className="mp-section-inner">
          <div className="mp-cta">
            <div>
              <span>READY WHEN YOUR AGENT IS</span>
              <h2>Publish a plugin.<br />Earn on every use.</h2>
              <p>Join {stats.totalDevelopers} developers already earning on SkillMint. Takes under 10 minutes to go live.</p>
            </div>
            <Link href="/dashboard/marketplace/publish" className="button button-dark">
              Start publishing <Icon name="arrow" size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
