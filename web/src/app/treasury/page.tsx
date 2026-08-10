"use client"

import { useEffect, useState } from "react"
import { Icon } from "@/components/icons"
import Link from "next/link"

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
    <main style={{background:'#0a0a0a', minHeight:'100vh', color:'white', fontFamily:'monospace', padding:'40px'}}>
      <header style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #333', paddingBottom:'20px', marginBottom:'40px'}}>
        <Link href="/" style={{color:'white', textDecoration:'none', fontWeight:800, fontSize:'24px', display:'flex', alignItems:'center', gap:'8px'}}>
          <Icon name="spark"/> PAYMATE NEURAL TREASURY
        </Link>
        <span style={{background:'rgba(49, 130, 93, 0.2)', color:'#317454', padding:'6px 12px', borderRadius:'100px', fontSize:'12px', fontWeight:700, display:'flex', alignItems:'center', gap:'6px'}}>
          <span style={{width:'8px', height:'8px', background:'#317454', borderRadius:'50%', display:'inline-block'}}></span>
          AI AGENT ACTIVE
        </span>
      </header>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'24px', marginBottom:'40px'}}>
        <div style={{background:'#111', border:'1px solid #333', padding:'24px', borderRadius:'12px'}}>
          <div style={{fontSize:'12px', color:'#888', marginBottom:'12px'}}>CURRENT BALANCE (USDC)</div>
          <div style={{fontSize:'48px', fontWeight:800, color:'#317454'}}>${stats.balanceUsd.toFixed(2)}</div>
          <p style={{fontSize:'12px', color:'#666', marginTop:'12px'}}>Accumulated from 1% autonomous protocol fees on PayMate network settlements.</p>
        </div>
        
        <div style={{background:'#111', border:'1px solid #333', padding:'24px', borderRadius:'12px'}}>
          <div style={{fontSize:'12px', color:'#888', marginBottom:'12px'}}>TOTAL PHILANTHROPY (USDC)</div>
          <div style={{fontSize:'48px', fontWeight:800, color:'#d13465'}}>${stats.totalDonatedUsd.toFixed(2)}</div>
          <p style={{fontSize:'12px', color:'#666', marginTop:'12px'}}>Autonomous donations to open-source developers via the on-chain AI_AGENT_ROLE.</p>
        </div>

        <div style={{background:'#111', border:'1px solid #333', padding:'24px', borderRadius:'12px'}}>
          <div style={{fontSize:'12px', color:'#888', marginBottom:'12px'}}>DEFLATIONARY BURN (USDC)</div>
          <div style={{fontSize:'48px', fontWeight:800, color:'#e67e22'}}>${stats.totalBurnedUsd.toFixed(2)}</div>
          <p style={{fontSize:'12px', color:'#666', marginTop:'12px'}}>Burn engine pending on-chain activation — no numbers are fabricated.</p>
        </div>
      </div>

      <div style={{background:'#000', border:'1px solid #333', borderRadius:'12px', padding:'24px', height:'400px', overflowY:'auto'}}>
        <div style={{fontSize:'12px', color:'#888', marginBottom:'16px'}}>PROTOCOL STATUS</div>
        <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
          {logs.map((log, i) => (
            <div key={i} style={{color: log.includes('donated') ? '#d13465' : log.includes('revenue') ? '#317454' : '#bbb', fontSize:'13px'}}>
              {log}
            </div>
          ))}
          <div style={{color:'#666', animation:'blink 1s infinite'}}>_</div>
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </main>
  )
}
