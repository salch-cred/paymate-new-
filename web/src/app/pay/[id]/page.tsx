"use client"

import Link from "next/link"
import { use, useEffect, useState } from "react"
import { useAccount, useSwitchChain, useWalletClient } from "wagmi"
import { parseUnits } from "viem"
import { goatTestnet3 } from "@/lib/chain"
import { Icon } from "@/components/icons"
import { WalletConnectMenu } from "@/components/wallet-connect-menu"
import { FeedbackForm } from "@/components/feedback-form"

type Invoice={id:string;freelancer:string;client:string;title?:string;description:string;amountUsd:number;status:"pending"|"paid";chain:string;dueDate?:string;txHash?:string;splits?:{address:string;amountUsd:number}[]}

export default function PayPage({params}:{params:Promise<{id:string}>}){
  const {id}=use(params);const [invoice,setInvoice]=useState<Invoice|null>(null);const [status,setStatus]=useState<"idle"|"paying"|"paid"|"error">("idle");const [error,setError]=useState<string|null>(null);const [loading,setLoading]=useState(true);const {address,isConnected,chain}=useAccount();const {data:walletClient}=useWalletClient();const {switchChainAsync}=useSwitchChain()
  const [isCrossChain,setIsCrossChain]=useState(false);const [isFiat,setIsFiat]=useState(false);const [ccStage,setCcStage]=useState(0)
  useEffect(()=>{fetch(`/api/invoices/${id}`).then(r=>{if(!r.ok)throw new Error("Invoice not found");return r.json()}).then(setInvoice).catch(e=>setError(e.message||"Could not load invoice")).finally(()=>setLoading(false))},[id])
 async function handlePay(){if(!isConnected||!address||!walletClient)return;setStatus("paying");setIsFiat(false);setIsCrossChain(false);setError(null);try{if(chain?.id!==goatTestnet3.id)await switchChainAsync({chainId:goatTestnet3.id});const res=await fetch(`/api/pay/${id}/settle`,{method:"POST"});if(res.status!==402){if(res.ok){setStatus("paid");return}throw new Error(`Unexpected settlement status: ${res.status}`)}const requirements=await res.json();if(!requirements.accepts||requirements.accepts.length===0)throw new Error("No valid payment options returned.");const txHashes=[];for(const option of requirements.accepts){const hash=await walletClient.writeContract({address:(option.token||"0x228B00") as `0x${string}`,abi:[{inputs:[{name:"recipient",type:"address"},{name:"amount",type:"uint256"}],name:"transfer",outputs:[{name:"",type:"bool"}],stateMutability:"nonpayable",type:"function"}],functionName:"transfer",args:[option.payTo as `0x${string}`,parseUnits(option.price.replace("$",""),6)],account:address,chain:goatTestnet3});txHashes.push(hash);}const settle=await fetch(`/api/pay/${id}/settle`,{method:"POST",headers:{"Content-Type":"application/json","X-PAYMENT":txHashes.join(",")}});if(!settle.ok)throw new Error("Payment verification failed.");setStatus("paid");setInvoice(v=>v?{...v,status:"paid"}:v)}catch(e){setStatus("error");setError(e instanceof Error?e.message:"Payment failed")}}
 async function handleCrossChainPay(){if(!isConnected)return;setStatus("paying");setIsCrossChain(true);setIsFiat(false);setError(null);setCcStage(1);await new Promise(r=>setTimeout(r,2500));setCcStage(2);await new Promise(r=>setTimeout(r,2500));setCcStage(3);try{await fetch(`/api/pay/${id}/settle`,{method:"POST",headers:{"Content-Type":"application/json","X-PAYMENT":"mock_ccip_intent_tx"}});setStatus("paid");setInvoice(v=>v?{...v,status:"paid"}:v)}catch(e){setStatus("error");setError("Cross-chain simulation failed")}}
 async function handleFiatPay(){setStatus("paying");setIsFiat(true);setIsCrossChain(false);setError(null);setCcStage(1);await new Promise(r=>setTimeout(r,2500));setCcStage(2);await new Promise(r=>setTimeout(r,2500));setCcStage(3);try{await fetch(`/api/pay/${id}/settle`,{method:"POST",headers:{"Content-Type":"application/json","X-PAYMENT":"mock_fiat_onramp_tx"}});setStatus("paid");setInvoice(v=>v?{...v,status:"paid"}:v)}catch(e){setStatus("error");setError("Fiat processing failed")}}
 if(loading)return <main className="loading-page"><div className="loader"/></main>
 if(!invoice)return <main className="loading-page"><div style={{textAlign:"center"}}><h1 style={{fontFamily:"var(--font-display)"}}>Invoice unavailable</h1><p>{error}</p><Link className="button button-dark" href="/">Return home</Link></div></main>
 const paid=invoice.status==="paid"||status==="paid"
 const isAuthorized = isConnected && address && (address.toLowerCase() === invoice.client.toLowerCase() || address.toLowerCase() === invoice.freelancer.toLowerCase());

 return <main className="payment-shell"><header className="payment-nav"><Link className="brand" href="/"><span className="brand-mark"><span/></span><b>PayMate</b></Link><span style={{fontSize:9,color:"#8a8981",background:"rgba(255,255,255,0.6)",border:"1px solid var(--line)",padding:"6px 10px",borderRadius:"12px",letterSpacing:"0.05em",fontWeight:700,backdropFilter:"blur(10px)",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"6px"}}><Icon name="shield" size={10} /> SECURE ID · {invoice.id.split("-")[0]}</span></header><section className="payment-wrap">
  <aside className="payment-aside"><span className="section-kicker">CLIENT CHECKOUT</span><h1>A clean finish<br/>to good work.</h1><p>This payment settles directly to the freelancer&apos;s wallet and creates verifiable proof of completion.</p><div className="trust-list"><div><Icon name="lock"/>Non-custodial wallet payment</div><div><Icon name="shield"/>On-chain settlement verification</div><div><Icon name="network"/>Portable ERC-8004 reputation</div></div></aside>
  <div className="pay-body payment-card">
    {!isAuthorized ? (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'80px 20px',textAlign:'center'}}>
        <div style={{background:'var(--surface)',padding:'24px',borderRadius:'50%',marginBottom:'24px',boxShadow:'0 8px 30px rgba(0,0,0,0.05)'}}><Icon name="lock" size={32}/></div>
        <h2 style={{fontFamily:'var(--font-display)',fontSize:'28px',marginBottom:'12px'}}>Private Invoice</h2>
        <p style={{color:'var(--muted)',marginBottom:'32px',maxWidth:'320px',lineHeight:1.6}}>This invoice is cryptographically secured. Connect the authorized client or freelancer wallet to decrypt details.</p>
        <WalletConnectMenu triggerClassName="button button-primary" triggerLabel={<><Icon name="wallet" size={18}/>Connect Wallet</>} />
      </div>
    ) : (
      <>
        <div className="client-line">
          <h2>{invoice.title}</h2>
          <div className="status-badge" style={{ background: paid ? '#e7f5ec' : '#fff0ed', color: paid ? '#317454' : '#b94328' }}>
            {paid ? 'PAID' : 'PENDING'}
          </div>
        </div>

        <div className="job-summary">
          <div className="payment-label" style={{ marginBottom: '8px' }}>SCOPE OF WORK</div>
          <p>{invoice.description}</p>
        </div>

        <div className="amount-due">
          <span>TOTAL DUE</span>
          <strong>${invoice.amountUsd.toLocaleString()} <small>USDC</small></strong>
        </div>

        {invoice.splits && invoice.splits.length > 0 && (
          <div style={{marginBottom:'24px', padding:'12px', background:'rgba(255,255,255,0.5)', borderRadius:'8px', fontSize:'11px'}}>
            <div style={{fontWeight:800, marginBottom:'8px', color:'var(--ink)', display:'flex', alignItems:'center', gap:'4px'}}><Icon name="network" size={12}/> Smart Contract Settlement Routing:</div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px',color:'var(--muted)'}}>
              <span>Freelancer ({invoice.freelancer.slice(0,6)}...)</span>
              <span>${(invoice.amountUsd - invoice.splits.reduce((sum,s)=>sum+s.amountUsd,0)).toLocaleString()} USDC</span>
            </div>
            {invoice.splits.map((split, i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',marginBottom:'4px',color:'var(--muted)'}}>
                <span>Teammate ({split.address.slice(0,6)}...)</span>
                <span>${split.amountUsd.toLocaleString()} USDC</span>
              </div>
            ))}
          </div>
        )}

        <div style={{display:'flex', alignItems:'center', gap:'6px', marginBottom:'24px', fontSize:'11px', color:'var(--muted)', background:'rgba(255,255,255,0.4)', padding:'10px 14px', borderRadius:'8px', border:'1px solid var(--line)'}}>
          <Icon name="spark" size={14}/>
          <span><b>ERC-4337 Paymaster Active:</b> Transaction gas fees are fully sponsored by PayMate.</span>
        </div>

        <div className="pay-button-wrap">
          {!isConnected ? (
            <div style={{width:'100%'}}>
              <WalletConnectMenu triggerClassName="pay-action" triggerLabel={<><Icon name="wallet" size={18}/>Connect wallet to pay</>} />
            </div>
          ) : paid ? (
            <div className="paid-state">
              <Icon name="check" size={18}/>
              <b>Payment Verified</b>
              <a href={`https://testnet3.explorer.goat.network/tx/${invoice.txHash||'0xMockTx'}`} target="_blank" style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:'4px', color:'inherit'}}>View on GOAT <Icon name="arrow" size={14}/></a>
            </div>
          ) : status === "paying" ? (
            <div className="cc-simulation-box" style={{background:'rgba(255,255,255,0.4)',border:'1px solid var(--line)',borderRadius:'12px',padding:'16px',display:'flex',flexDirection:'column',gap:'12px'}}>
              {isCrossChain ? (
                <>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',fontWeight:600,color:ccStage>=1?'#111':'#888'}}><span className="draft-spinner" style={{opacity:ccStage===1?1:0}}/> 1. Initiating Intent on Base</div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',fontWeight:600,color:ccStage>=2?'#111':'#888'}}><span className="draft-spinner" style={{opacity:ccStage===2?1:0}}/> 2. Swapping & Bridging...</div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',fontWeight:600,color:ccStage>=3?'#111':'#888'}}><span className="draft-spinner" style={{opacity:ccStage===3?1:0}}/> 3. Settling on-chain...</div>
                </>
              ) : isFiat ? (
                <>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',fontWeight:600,color:ccStage>=1?'#111':'#888'}}><span className="draft-spinner" style={{opacity:ccStage===1?1:0}}/> 1. Processing Credit Card</div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',fontWeight:600,color:ccStage>=2?'#111':'#888'}}><span className="draft-spinner" style={{opacity:ccStage===2?1:0}}/> 2. Purchasing USDC...</div>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',fontWeight:600,color:ccStage>=3?'#111':'#888'}}><span className="draft-spinner" style={{opacity:ccStage===3?1:0}}/> 3. Settling Invoice...</div>
                </>
              ) : (
                <button className="pay-action" disabled>Settling on-chain…</button>
              )}
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <button className="pay-action" onClick={handlePay}>
                Pay ${invoice.amountUsd.toLocaleString()} USDC <Icon name="arrow" size={18}/>
              </button>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                <button className="button button-outline" style={{color:'var(--muted)'}} onClick={handleCrossChainPay}>
                  <Icon name="network" size={16}/> Any Crypto
                </button>
                <button className="button button-outline" style={{color:'var(--muted)'}} onClick={handleFiatPay}>
                  <Icon name="wallet" size={16}/> Credit Card
                </button>
              </div>
            </div>
          )}
        </div>
        {error && <div className="error-box" style={{marginTop: '16px'}}>{error}</div>}
        <p className="wallet-note" style={{marginTop: '24px'}}><Icon name="lock" size={12}/>Direct non-custodial transfer on GOAT Network</p>
      </>
    )}
  </div>
 </section></main>
}
