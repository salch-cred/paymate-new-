"use client"

import { Icon } from '@/components/icons';

// Note: In a real app we'd fetch this from the store, but for the client component
// we can either pass it as props or fetch via API. We'll simulate it here to match the dashboard.
export function DeveloperDashboard() {
  const totalInstalls = 1420;
  const totalEarnings = 1136;
  const avgRating = 4.8;
  const myPlugins = [
    { id: '1', displayName: 'ShipBot Starter', price: 1.0, version: '1.0.0', usageCount: 820, rating: 4.9 },
    { id: '2', displayName: 'Defi Scraper', price: 0.5, version: '1.1.2', usageCount: 600, rating: 4.7 }
  ];

  const weeklyData = [12.4, 18.7, 15.2, 22.1, 19.8, 28.4, 31.2];
  const maxVal = Math.max(...weeklyData);

  return (
    <section className="panel panel-pad" style={{ marginTop: '16px' }} id="developer">
      <div className="panel-heading">
        <div>
          <h2>Developer Portal</h2>
          <p>Track your plugin performance, earnings, and usage.</p>
        </div>
        <span className="icon-box"><Icon name="package" /></span>
      </div>

      <div className="metric-grid" style={{ marginTop: '16px', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="metric-card">
          <span>Earnings</span>
          <b>${totalEarnings.toLocaleString()}</b>
          <small style={{color:'#31825d'}}>+23% this week</small>
        </div>
        <div className="metric-card">
          <span>Total uses</span>
          <b>{totalInstalls.toLocaleString()}</b>
          <small style={{color:'#31825d'}}>+18% this week</small>
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

      <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
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
            {myPlugins.map((p) => (
              <div className="invoice-row" key={p.id}>
                <div className="invoice-row-main">
                  <b>{p.displayName}</b>
                  <small>${p.price.toFixed(2)}/use · v{p.version}</small>
                </div>
                <strong>{p.usageCount} uses</strong>
                <span className="status-label paid">${(p.usageCount * p.price * 0.8).toFixed(2)} earned</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '24px', padding: '16px', background: 'var(--surface-sunken)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700 }}>Pending withdrawal</div>
          <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em' }}>${(totalEarnings * 0.34).toFixed(2)} USDC</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', maxWidth: '250px' }}>Earnings distribute automatically to your wallet via smart contract.</p>
          <button className="button button-dark" style={{ padding: '8px 16px' }}>Withdraw to wallet</button>
        </div>
      </div>
    </section>
  );
}
