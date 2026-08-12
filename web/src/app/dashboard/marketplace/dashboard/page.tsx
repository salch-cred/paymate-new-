import { getAllPlugins } from '@/lib/marketplace/store';
import { initStore } from '@/lib/marketplace/serverStore';
import { formatUSDC, formatNumber, formatPrice } from '@/lib/marketplace/utils';
import { Icon } from '@/components/icons';

// Demo developer address (matches the ShipBot Labs seed plugin).
const DEV_ADDRESS = '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  await initStore();
  const myPlugins = getAllPlugins().filter((p) => p.author === DEV_ADDRESS);
  const totalInstalls = myPlugins.reduce((s, p) => s + p.usageCount, 0);
  const totalEarnings = myPlugins.reduce((s, p) => s + p.usageCount * p.price * 0.8, 0);
  const avgRating = myPlugins.length > 0 ? myPlugins.reduce((s, p) => s + p.rating, 0) / myPlugins.length : 0;

  const weeklyData = [0, 0, 0, 0, 0, 0, 0];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const maxVal = 100; // prevent division by zero

  const stats = [
    { label: 'Total earnings', value: formatUSDC(totalEarnings), icon: 'wallet' as const, bg: '#e7f5ec', color: '#317454' },
    { label: 'Total uses', value: formatNumber(totalInstalls), icon: 'chart' as const, bg: '#f2dfd3', color: '#e6532c' },
    { label: 'Published plugins', value: String(myPlugins.length), icon: 'package' as const, bg: '#e8edf7', color: '#4f46e5' },
    { label: 'Avg rating', value: avgRating.toFixed(1), icon: 'shield' as const, bg: '#f5f0dc', color: '#a16207' },
  ];

  return (
    <>
      <div className="mp-page-head">
        <span className="section-kicker"><span className="pulse-dot" />DEVELOPER PORTAL</span>
        <h1 className="mp-page-title">Developer dashboard</h1>
        <p className="mp-page-sub">Track your plugin performance, earnings, and usage.</p>
        <div style={{ marginTop: 22 }}>
          <span className="mp-dev-badge"><Icon name="user" size={15} /> Developer · {DEV_ADDRESS.slice(0, 8)}…</span>
        </div>
      </div>

      <div className="mp-content">
        <div className="mp-dash-stats">
          {stats.map((s) => (
            <div className="mp-dash-stat" key={s.label}>
              <div className="mp-dash-stat-icon" style={{ background: s.bg, color: s.color }}>
                <Icon name={s.icon} size={20} />
              </div>
              <div>
                <b>{s.value}</b>
                <span>{s.label}</span>
              </div>
              {s.trend && <span className="mp-dash-trend">↑ {s.trend}</span>}
            </div>
          ))}
        </div>

        <div className="mp-dash-cols">
          <div className="mp-panel" style={{ padding: '24px 26px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, letterSpacing: '-.03em', margin: '0 0 18px' }}>
              Earnings this week
            </h2>
            <div className="mp-chart">
              {weeklyData.map((val, i) => (
                <div key={i} className="mp-chart-bar">
                  <div className="mp-bar-wrap">
                    <div className="mp-bar" style={{ height: `${(val / maxVal) * 100}%` }} />
                  </div>
                  <span className="mp-bar-label">{days[i]}</span>
                  <span className="mp-bar-val">${val}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mp-panel" style={{ padding: '24px 26px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, letterSpacing: '-.03em', margin: '0 0 14px' }}>
              Your plugins
            </h2>
            {myPlugins.length === 0 ? (
              <div className="mp-empty-plugins">
                <p>No plugins yet. <a href="/dashboard/marketplace/publish">Publish your first plugin.</a></p>
              </div>
            ) : (
              myPlugins.map((p) => (
                <div key={p.id} className="mp-table-row">
                  <div>
                    <div className="mp-row-name">{p.displayName}</div>
                    <div className="mp-row-meta">{formatPrice(p.price)}/use · v{p.version}</div>
                  </div>
                  <div className="mp-row-stats">
                    <div className="mp-row-stat"><span>Uses</span><b>{formatNumber(p.usageCount)}</b></div>
                    <div className="mp-row-stat"><span>Earned</span><b>{formatUSDC(p.usageCount * p.price * 0.8)}</b></div>
                    <div className="mp-row-stat"><span>Rating</span><b>{p.rating.toFixed(1)}★</b></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mp-withdraw">
          <div>
            <div className="mp-withdraw-label">Pending withdrawal</div>
            <div className="mp-withdraw-amount">{formatUSDC(totalEarnings * 0.34)}</div>
          </div>
          <div className="mp-withdraw-right">
            <p>Earnings distribute automatically to your wallet via smart contract. Withdraw anytime.</p>
            <button className="mp-withdraw-btn" id="withdraw-btn">Withdraw to wallet</button>
          </div>
        </div>
      </div>
    </>
  );
}
