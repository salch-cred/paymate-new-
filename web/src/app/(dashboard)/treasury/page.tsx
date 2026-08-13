"use client"

import { useEffect, useState } from "react"
import { Icon } from "@/components/icons"

export default function TreasuryPage() {
  const [stats, setStats] = useState({ balanceUsd: 0, totalDonatedUsd: 0, totalBurnedUsd: 0 })
  // Static, factual protocol status — no simulated activity.
  const logs = [
    "[FEE] 1% of every PayMate settlement accrues to this treasury on-chain.",
    "[DONATE] Autonomous donation routing activates via the on-chain AI_AGENT_ROLE once balance accrues.",
    "[BURN] Burn engine is pending on-chain activation — no amounts burned to date."
  ]

  useEffect(() => {
    // Live read from the production database — no simulated numbers.
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/treasury")
        if (!res.ok) throw new Error("Could not load treasury stats")
        const data = await res.json()
        setStats({ balanceUsd: data.balanceUsd, totalDonatedUsd: data.totalDonatedUsd, totalBurnedUsd: data.totalBurnedUsd ?? 0 })
      } catch (e) {
        console.error("Treasury stats failed to load:", e)
      }
    }
    fetchStats()
  }, [])

  return (
    <>
      <header className="app-topbar">
        <div>
          <span className="workspace-label">PROTOCOL · NEURAL TREASURY</span>
          <h1>PayMate Autonomous Treasury</h1>
          <p>1% of every network settlement accrues here for autonomous philanthropy and deflationary burns.</p>
        </div>
        <div className="topbar-actions">
          <span style={{background:'rgba(49, 130, 93, 0.1)', color:'#317454', padding:'6px 12px', borderRadius:'100px', fontSize:'12px', fontWeight:700, display:'flex', alignItems:'center', gap:'6px', border:'1px solid rgba(49, 130, 93, 0.2)'}}>
            <span style={{width:'8px', height:'8px', background:'#317454', borderRadius:'50%', display:'inline-block'}}></span>
            AI AGENT ACTIVE
          </span>
        </div>
      </header>

      <div className="dashboard-page-content">
      <div className="metric-grid">
        <div className="metric-card">
          <span>Current Balance (USDC)</span>
          <b>${stats.balanceUsd.toFixed(2)}</b>
          <small>From 1% protocol fees</small>
        </div>
        <div className="metric-card">
          <span>Total Philanthropy (USDC)</span>
          <b style={{color: '#d13465'}}>${stats.totalDonatedUsd.toFixed(2)}</b>
          <small>Autonomous donations</small>
        </div>
        <div className="metric-card">
          <span>Deflationary Burn (USDC)</span>
          <b style={{color: '#e67e22'}}>${stats.totalBurnedUsd.toFixed(2)}</b>
          <small>Burn engine pending</small>
        </div>
      </div>

      <section className="panel panel-pad" style={{marginTop: '16px'}}>
        <div className="panel-heading">
          <div><h2>Protocol Status</h2><p>Live autonomous agent logs</p></div>
          <span className="icon-box"><Icon name="spark"/></span>
        </div>
        <div style={{background:'#fafaf9', border:'1px solid var(--line)', borderRadius:'8px', padding:'16px', fontFamily:'monospace', fontSize:'12px', height:'250px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'8px'}}>
          {logs.map((log, i) => (
            <div key={i} style={{color: log.includes('donated') ? '#d13465' : log.includes('revenue') ? '#317454' : 'var(--muted)'}}>
              {log}
            </div>
          ))}
          <div style={{color:'var(--muted)', animation:'blink 1s infinite'}}>_</div>
        </div>
      </section>

      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </>
  )
}
