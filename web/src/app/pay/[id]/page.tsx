"use client"

import Link from "next/link"
import { use, useEffect, useState } from "react"
import { useAccount, useSwitchChain, useWalletClient } from "wagmi"
import { parseUnits } from "viem"
import { goatChain } from "@/lib/chain"
import { Icon } from "@/components/icons"
import { WalletConnectMenu } from "@/components/wallet-connect-menu"
import { FeedbackForm } from "@/components/feedback-form"

type Invoice={id:string;freelancer:string;client:string;title?:string;description:string;amountUsd:number;status:"pending"|"paid";chain:string;dueDate?:string;txHash?:string;splits?:{address:string;amountUsd:number}[];milestones?:{id:string;title:string;amountUsd:number;status:"pending"|"paid";txHash?:string;paidAt?:number}[]}

export default function PayPage({params}:{params:Promise<{id:string}>}){
  const {id}=use(params);const [invoice,setInvoice]=useState<Invoice|null>(null);const [status,setStatus]=useState<"idle"|"paying"|"paid"|"error">("idle");const [activeMilestone,setActiveMilestone]=useState<string|null>(null);const [error,setError]=useState<string|null>(null);const [loading,setLoading]=useState(true);const {address,isConnected,chain}=useAccount();const {data:walletClient}=useWalletClient();const {switchChainAsync}=useSwitchChain()
  useEffect(()=>{fetch(`/api/invoices/${id}`).then(r=>{if(!r.ok)throw new Error("Invoice not found");return r.json()}).then(setInvoice).catch(e=>setError(e.message||"Could not load invoice")).finally(()=>setLoading(false))},[id])
  async function downloadPDF() {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const element = document.querySelector('.payment-card') as HTMLElement;
      if (!element) return;
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width / 2, canvas.height / 2] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`Invoice_${invoice?.id.split('-')[0] || 'Receipt'}.pdf`);
    } catch (e) {
      console.error(e);
    }
  }

 async function handlePay(milestoneId?: string){if(!isConnected||!address||!walletClient)return;setStatus("paying");if(milestoneId)setActiveMilestone(milestoneId);setError(null);try{if(chain?.id!==goatChain.id)await switchChainAsync({chainId:goatChain.id});const res=await fetch(`/api/pay/${id}/settle`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({milestoneId})});if(res.status!==402){if(res.ok){setStatus("paid");setActiveMilestone(null);setInvoice(v=>v?{...v,status:"paid"}:v);return}throw new Error(`Unexpected settlement status: ${res.status}`)}const requirements=await res.json();if(!requirements.accepts||requirements.accepts.length===0)throw new Error("No valid payment options returned.");const txHashes=[];for(const option of requirements.accepts){const hash=await walletClient.writeContract({address:(option.token||"0x228B00") as `0x${string}`,abi:[{inputs:[{name:"recipient",type:"address"},{name:"amount",type:"uint256"}],name:"transfer",outputs:[{name:"",type:"bool"}],stateMutability:"nonpayable",type:"function"}],functionName:"transfer",args:[option.payTo as `0x${string}`,parseUnits(option.price.replace("$",""),6)],account:address,chain:goatChain});txHashes.push(hash);}const settle=await fetch(`/api/pay/${id}/settle`,{method:"POST",headers:{"Content-Type":"application/json","X-PAYMENT":txHashes.join(",")},body:JSON.stringify({milestoneId})});if(!settle.ok)throw new Error("Payment verification failed.");const updatedInvoice=await settle.json();setStatus("idle");setActiveMilestone(null);setInvoice(updatedInvoice.invoice)}catch(e){setStatus("error");setActiveMilestone(null);setError(e instanceof Error?e.message:"Payment failed")}}
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

        {invoice.milestones && invoice.milestones.length > 0 && (
          <div style={{marginBottom:'24px', display:'flex', flexDirection:'column', gap:'12px'}}>
            <div className="payment-label">MILESTONE PAYMENTS</div>
            {invoice.milestones.map((ms, i) => (
              <div key={ms.id} style={{padding:'16px', background:'rgba(255,255,255,0.6)', borderRadius:'12px', border:'1px solid var(--line)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <div style={{fontSize:'14px', fontWeight:700, color:'var(--ink)', marginBottom:'4px'}}>{ms.title}</div>
                  <div style={{fontSize:'12px', color:'var(--muted)'}}>${ms.amountUsd.toLocaleString()} USDC</div>
                </div>
                {ms.status === "paid" ? (
                  <div style={{display:'flex', alignItems:'center', gap:'4px', color:'#317454', fontSize:'12px', fontWeight:700}}><Icon name="check" size={14}/> PAID</div>
                ) : !isConnected ? (
                   <button className="button button-outline" disabled style={{opacity:0.5}}>Connect to Pay</button>
                ) : status === "paying" && activeMilestone === ms.id ? (
                   <button className="button button-primary" disabled><span className="draft-spinner" style={{borderColor:'white',borderTopColor:'transparent',width:'14px',height:'14px',marginRight:'6px'}}/> Settling</button>
                ) : (
                   <button className="button button-primary" disabled={status==="paying"} onClick={()=>handlePay(ms.id)}>Pay ${(ms.amountUsd).toLocaleString()}</button>
                )}
              </div>
            ))}
          </div>
        )}

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
          {invoice.milestones && invoice.milestones.length > 0 ? (
            !isConnected && <div style={{width:'100%'}}><WalletConnectMenu triggerClassName="pay-action" triggerLabel={<><Icon name="wallet" size={18}/>Connect wallet to pay</>} /></div>
          ) : !isConnected ? (
            <div style={{width:'100%'}}>
              <WalletConnectMenu triggerClassName="pay-action" triggerLabel={<><Icon name="wallet" size={18}/>Connect wallet to pay</>} />
            </div>
          ) : paid ? (
            <div className="paid-state">
              <Icon name="check" size={18}/>
              <b>Payment Verified</b>
              <a href={`https://explorer.goat.network/tx/${invoice.txHash||'0x0'}`} target="_blank" style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:'4px', color:'inherit'}}>View on GOAT <Icon name="arrow" size={14}/></a>
              <button onClick={downloadPDF} style={{marginLeft:'10px', background:'none', border:'none', color:'#8a8981', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px', fontSize:'12px', fontWeight:600}}><Icon name="arrow" size={14}/> Download PDF</button>
            </div>
          ) : status === "paying" ? (
            <div className="cc-simulation-box" style={{background:'rgba(255,255,255,0.4)',border:'1px solid var(--line)',borderRadius:'12px',padding:'16px',display:'flex',flexDirection:'column',gap:'12px'}}>
              <button className="pay-action" disabled>Settling on-chain…</button>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <button className="pay-action" onClick={()=>handlePay()}>
                Pay ${invoice.amountUsd.toLocaleString()} USDC <Icon name="arrow" size={18}/>
              </button>
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
