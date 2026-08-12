"use client"

import { Icon } from '@/components/icons';

// Note: In a real app we'd fetch this from the store, but for the client component
// we can either pass it as props or fetch via API. We'll simulate it here to match the dashboard.
export function DeveloperDashboard() {
  const totalInstalls = 0;
  const totalEarnings = 0;
  const avgRating = 0.0;
  const myPlugins: { id: string, displayName: string, price: number, version: string, usageCount: number, rating: number }[] = [];

  const weeklyData = [0, 0, 0, 0, 0, 0, 0];
  const maxVal = 100;

  return (
    <section className="panel panel-pad dev-portal-section" style={{ marginTop: '16px' }} id="developer">
      <style>{`
        .dev-portal-section .metric-grid { margin-top: 16px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
        .dev-portal-section .dev-cols { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 768px) {
          .dev-portal-section .dev-cols { grid-template-columns: 1fr; }
          .dev-portal-section .metric-grid { grid-template-columns: 1fr; }
        }
      `}</style>
      <div className="panel-heading">
        <div>
          <h2>Developer Portal</h2>
          <p>Track your plugin performance, earnings, and usage.</p>
        </div>
        <span className="icon-box"><Icon name="package" /></span>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Earnings</span>
          <b>${totalEarnings.toLocaleString()}</b>
        </div>
        <div className="metric-card">
          <span>Total uses</span>
          <b>{totalInstalls.toLocaleString()}</b>
        </div>
        <div className="metric-card">
          <span>Plugins</span>
          <b>{myPlugins.length}</b>
          <small>Published</small>
        </div>
        <div className="metric-card">
          <span>Rating</span>
          <b>{avgRating.toFixed(1)}</b>
          <small>Average</small>
        </div>
      </div>

      <div className="dev-cols">
        <div>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Earnings this week</h3>
          <div className="mini-chart" aria-label="Weekly earnings">
            {weeklyData.map((val, i) => (
              <div key={i} className="paid">
                <i style={{ height: `${(val / maxVal) * 100}%` }} />
                <span>${val.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Your plugins</h3>
          <div className="invoice-table">
            {myPlugins.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                No plugins published yet.
              </div>
            ) : (
              myPlugins.map((p) => (
                <div className="invoice-row" key={p.id}>
                  <div className="invoice-row-main">
                    <b>{p.displayName}</b>
                    <small>${p.price.toFixed(2)}/use · v{p.version}</small>
                  </div>
                  <strong>{p.usageCount} uses</strong>
                  <span className="status-label paid">${(p.usageCount * p.price * 0.8).toFixed(2)} earned</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '24px', padding: '16px', background: 'var(--surface-sunken)', borderRadius: '12px', display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700 }}>Pending withdrawal</div>
          <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em' }}>${(totalEarnings * 0.34).toFixed(2)} USDC</div>
        </div>
        <div style={{ textAlign: 'right', flex: '1 1 min-content' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', maxWidth: '250px', marginLeft: 'auto' }}>Earnings distribute automatically to your wallet via smart contract.</p>
          <button className="button button-dark" style={{ padding: '8px 16px' }}>Withdraw to wallet</button>
        </div>
      </div>
    </section>
  );
}
