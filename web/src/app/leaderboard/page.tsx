import { getTopFreelancers } from "@/lib/db"
import Link from "next/link"
import { Icon } from "@/components/icons"

export const dynamic = "force-dynamic" // Always fetch fresh leaderboard data per-request;
// avoids failing `next build`/Vercel builds when DATABASE_URL isn't reachable at build time.

export default async function LeaderboardPage() {
  const topFreelancers = await getTopFreelancers(50)

  return (
    <main className="dashboard-layout">
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="brand-mark"></div>
          <b>PayMate</b>
        </div>
        <nav className="header-nav">
          <Link href="/">Home</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/leaderboard" className="active">Leaderboard</Link>
          <Link href="/growth">Growth</Link>
        </nav>
      </header>

      <section className="dashboard-content" style={{maxWidth: 800, margin: '0 auto'}}>
        <div className="dashboard-top" style={{textAlign: 'center', marginBottom: 40}}>
          <h1 style={{fontSize: 48, fontFamily: 'var(--font-display)', marginBottom: 16}}>Top Talent</h1>
          <p style={{fontSize: 18, color: 'var(--muted)', maxWidth: 500, margin: '0 auto'}}>
            The highest earning freelancers on the GOAT Network, ranked by total verified on-chain revenue.
          </p>
        </div>

        <div className="leaderboard-card" style={{background: 'var(--surface)', borderRadius: 24, padding: 32, boxShadow: '0 8px 30px rgba(0,0,0,0.05)', border: '1px solid var(--line)'}}>
          <div style={{display: 'grid', gridTemplateColumns: '60px 1fr 120px 150px', paddingBottom: 16, borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em'}}>
            <div>RANK</div>
            <div>FREELANCER (WALLET)</div>
            <div style={{textAlign: 'right'}}>JOBS COMPLETED</div>
            <div style={{textAlign: 'right'}}>TOTAL EARNED</div>
          </div>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16}}>
            {topFreelancers.length === 0 ? (
              <div style={{textAlign: 'center', padding: '40px 0', color: 'var(--muted)'}}>No payments settled yet.</div>
            ) : (
              topFreelancers.map((f, i) => (
                <div key={f.freelancer} style={{
                  display: 'grid', 
                  gridTemplateColumns: '60px 1fr 120px 150px', 
                  alignItems: 'center',
                  background: i === 0 ? 'linear-gradient(90deg, rgba(255,193,7,0.1) 0%, rgba(255,255,255,0) 100%)' : 'transparent',
                  padding: '12px 0',
                  borderRadius: 8,
                  border: i === 0 ? '1px solid rgba(255,193,7,0.3)' : '1px solid transparent',
                  paddingLeft: i === 0 ? 12 : 0
                }}>
                  <div style={{fontSize: 20, fontWeight: 800, color: i === 0 ? '#d4af37' : i === 1 ? '#C0C0C0' : i === 2 ? '#cd7f32' : 'var(--muted)'}}>
                    #{i + 1}
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontFamily: 'monospace'}}>
                    <div style={{width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, #${f.freelancer.slice(2,8)}, #${f.freelancer.slice(8,14)})`}} />
                    {f.freelancer.slice(0, 6)}...{f.freelancer.slice(-4)}
                    {i === 0 && <Icon name="spark" size={14} color="#d4af37" />}
                  </div>
                  <div style={{textAlign: 'right', fontWeight: 600}}>{f.jobsCompleted}</div>
                  <div style={{textAlign: 'right', fontWeight: 800, fontSize: 18, color: 'var(--ink)'}}>
                    ${f.totalEarned.toLocaleString()} <span style={{fontSize: 12, color: 'var(--muted)'}}>USDC</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
