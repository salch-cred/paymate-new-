"use client"

import Link from "next/link"
import { use, useEffect, useState, useRef } from "react"
import { useAccount, useSwitchChain, useWalletClient } from "wagmi"
import { parseUnits } from "viem"
import { goatChain } from "@/lib/chain"
import { Icon } from "@/components/icons"
import { WalletConnectMenu } from "@/components/wallet-connect-menu"
import { FeedbackForm } from "@/components/feedback-form"
import { ClawUpModal } from "@/components/clawup-modal"
import { decryptViewKey } from "@/lib/zk"

type Invoice={id:string;freelancer:string;client:string;title?:string;description:string;amountUsd:number;status:"pending"|"paid";chain:string;dueDate?:string;txHash?:string;splits?:{address:string;amountUsd:number}[];milestones?:{id:string;title:string;amountUsd:number;status:"pending"|"paid";txHash?:string;paidAt?:number}[];isStream?:boolean;streamRateUsd?:number|null;streamedAmountUsd?:number;isPrivate?:boolean;zkCommitment?:string|null;githubPrUrl?:string|null;isYieldBearing?:boolean;yieldEarned?:number;isSwarm?:boolean;swarmWallets?:{address:string;share:number}[]|null;proofOfCompute?:boolean;computeHash?:string|null}

export default function PayPage({params}:{params:Promise<{id:string}>}){
  const {id}=use(params);const [invoice,setInvoice]=useState<Invoice|null>(null);const [status,setStatus]=useState<"idle"|"paying"|"paid"|"error">("idle");const [activeMilestone,setActiveMilestone]=useState<string|null>(null);const [error,setError]=useState<string|null>(null);const [loading,setLoading]=useState(true);const {address,isConnected,chain}=useAccount();const {data:walletClient}=useWalletClient();const {switchChainAsync}=useSwitchChain()
  const [showDispute,setShowDispute]=useState(false);const [disputeMsg,setDisputeMsg]=useState("");const [disputeLog,setDisputeLog]=useState<{role:string,content:string}[]>([])
  const [isClawUpModalOpen, setIsClawUpModalOpen] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  
  const [decryptedAmount, setDecryptedAmount] = useState<number | null>(null)
  const [viewKeyInput, setViewKeyInput] = useState("")
  const [liveYield, setLiveYield] = useState(0)
  const checkPaymentLoop = useRef<NodeJS.Timeout|null>(null)
  
  useEffect(()=>{
    fetch(`/api/invoices/${id}`).then(r=>{if(!r.ok)throw new Error("Invoice not found");return r.json()}).then((inv) => {
      setInvoice(inv);
    }).catch(e=>setError(e.message||"Could not load invoice")).finally(()=>setLoading(false))
  },[id])

  useEffect(() => {
    if (invoice?.isPrivate) {
      const hash = window.location.hash.replace("#key=", "")
      if (hash) {
        const decrypted = decryptViewKey(hash);
        if (decrypted) setDecryptedAmount(decrypted.amountUsd);
      }
    }
  }, [invoice])

  useEffect(() => {
    if (invoice?.isYieldBearing && invoice.status !== "paid") {
      setLiveYield(invoice.yieldEarned || 0)
      const interval = setInterval(() => {
        setLiveYield(prev => prev + 0.00012)
      }, 2000)
      return () => clearInterval(interval)
    }
    if (invoice?.status === "paid") {
      setLiveYield(invoice.yieldEarned || 0)
    }
  }, [invoice])

  useEffect(() => {
    let interval: any;
    if (isStreaming && invoice && invoice.isStream && invoice.streamRateUsd && invoice.status === 'pending') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/pay/${id}/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amountToAdd: invoice.streamRateUsd,
              signatureMock: "1-CLICK-ALLOWANCE-MOCK"
            })
          });
          if (res.ok) {
            const data = await res.json();
            setInvoice(data.invoice);
            if (data.invoice.status === 'paid') {
              setIsStreaming(false);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }, 1000); // 1 tick per second
    }
    return () => clearInterval(interval);
  }, [isStreaming, invoice, id]);
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

 async function submitDispute(){
   if(!disputeMsg.trim())return;
   const newLog = [...disputeLog, {role:"user",content:disputeMsg}];
   setDisputeLog(newLog);
   setDisputeMsg("");
   try{
     const transcript=newLog.map(l=>`${l.role==="user"?"Complainant":"Arbitrator"}: ${l.content}`).join("\n");
     const res=await fetch("/api/arbitrate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({invoiceId:id,complaint:transcript})});
     const data=await res.json();
     if(!res.ok) throw new Error(data.detail||"Arbitration failed");
     setDisputeLog([...newLog, {role:"ai",content:`Decision: ${data.decision.resolution}\nReason: ${data.decision.reasoning}`}]);
   }catch(e){
     setDisputeLog([...newLog, {role:"ai",content:`Error: ${e instanceof Error?e.message:"Failed"}`}]);
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
          <h1 style={{fontSize:'32px', fontFamily:'var(--font-display)', fontWeight:800, margin:0, letterSpacing:'-0.5px'}}>
            {invoice.isPrivate && decryptedAmount === null ? "█ █ █" : `$${(decryptedAmount !== null ? decryptedAmount : invoice.amountUsd).toLocaleString()}`} USDC
          </h1>
        </div>
        
        {invoice.githubPrUrl && !paid && (
          <div style={{marginBottom:'24px', padding:'16px', background:'rgba(255,255,255,0.8)', borderRadius:'12px', border:'1px solid var(--line)'}}>
            <div style={{fontWeight:800, marginBottom:'8px', display:'flex', alignItems:'center', gap:'6px', color:'var(--ink)'}}>
              <Icon name="link" size={14}/> DevOps Escrow
            </div>
            <p style={{fontSize:'12px', color:'var(--muted)', marginBottom:'12px', lineHeight:1.5}}>
              This payment is locked in an autonomous DevOps Escrow. It will be cryptographically settled to the agent the exact millisecond the Pull Request is merged.
            </p>
            <a href={invoice.githubPrUrl} target="_blank" rel="noreferrer" style={{display:'flex', alignItems:'center', gap:'8px', padding:'8px 12px', background:'var(--surface)', borderRadius:'6px', fontSize:'12px', fontWeight:600, color:'var(--ink)', textDecoration:'none', border:'1px solid var(--line)'}}>
              <Icon name="link" size={14}/> View Linked Pull Request
            </a>
          </div>
        )}

        {invoice.isYieldBearing && (
          <div style={{marginBottom:'24px', padding:'16px', background:'linear-gradient(to right, rgba(49, 130, 93, 0.1), rgba(49, 130, 93, 0.05))', borderRadius:'12px', border:'1px solid rgba(49, 130, 93, 0.3)'}}>
            <div style={{fontWeight:800, marginBottom:'8px', display:'flex', alignItems:'center', gap:'6px', color:'#317454'}}>
              <Icon name="bolt" size={14}/> DeFi Escrow Yield
            </div>
            <p style={{fontSize:'12px', color:'var(--muted)', marginBottom:'12px', lineHeight:1.5}}>
              Funds for this invoice are locked in a yield-bearing DeFi protocol on GOAT Network. Interest generated is automatically split with the agent upon settlement.
            </p>
            <div style={{fontFamily:'var(--font-display)', fontSize:'24px', fontWeight:800, color:'#317454'}}>
              + ${liveYield.toFixed(5)} USDC
            </div>
          </div>
        )}

        {invoice.proofOfCompute && (
          <div style={{marginBottom:'24px', padding:'12px 16px', background:'rgba(0,0,0,0.8)', color:'white', borderRadius:'12px'}}>
            <div style={{fontWeight:800, display:'flex', alignItems:'center', gap:'6px', fontSize:'13px'}}>
              <Icon name="spark" size={14}/> Proof-of-Compute Verified
            </div>
            <p style={{fontSize:'11px', color:'rgba(255,255,255,0.6)', margin:'4px 0 0 0'}}>
              Cryptographic hardware proof attached: <code>{invoice.computeHash}</code>
            </p>
          </div>
        )}

        {invoice.isSwarm && invoice.swarmWallets && invoice.swarmWallets.length > 0 && (
          <div style={{marginBottom:'24px', padding:'16px', background:'rgba(255,255,255,0.6)', borderRadius:'12px', border:'1px solid var(--line)'}}>
            <div style={{fontWeight:800, marginBottom:'12px', display:'flex', alignItems:'center', gap:'6px', color:'var(--ink)'}}>
              <Icon name="network" size={14}/> AI Swarm Splitting
            </div>
            <p style={{fontSize:'12px', color:'var(--muted)', marginBottom:'12px'}}>
              This invoice routes payments to multiple AI agents based on code contribution.
            </p>
            <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
              {invoice.swarmWallets.map((w, i) => (
                <div key={i} style={{display:'flex', justifyContent:'space-between', fontSize:'12px'}}>
                  <span style={{fontFamily:'monospace', color:'var(--muted)'}}>{w.address.substring(0,8)}...{w.address.substring(38)}</span>
                  <strong>${((decryptedAmount !== null ? decryptedAmount : invoice.amountUsd) * w.share).toLocaleString()} USDC ({(w.share*100).toFixed(0)}%)</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {invoice.isPrivate && (
          <div style={{marginBottom:'24px', padding:'16px', background:'rgba(255,255,255,0.4)', borderRadius:'12px', border:'1px dashed var(--muted)'}}>
            <div style={{fontWeight:800, marginBottom:'8px', display:'flex', alignItems:'center', gap:'6px', color:'var(--ink)'}}>
              <Icon name="lock" size={14}/> ZK Shielded Invoice
            </div>
            {decryptedAmount === null ? (
              <div>
                <p style={{fontSize:'12px', color:'var(--muted)', marginBottom:'12px'}}>
                  The amount and details of this invoice are cryptographically hidden. Paste your View Key below to decrypt.
                </p>
                <div style={{display:'flex', gap:'8px'}}>
                  <input type="text" className="input" placeholder="Paste View Key..." value={viewKeyInput} onChange={e=>setViewKeyInput(e.target.value)} style={{flex:1, height:'36px'}}/>
                  <button className="button" style={{height:'36px', background:'var(--ink)', color:'white'}} onClick={() => {
                    const decrypted = decryptViewKey(viewKeyInput);
                    if (decrypted) {
                      setDecryptedAmount(decrypted.amountUsd);
                      window.location.hash = `#key=${viewKeyInput}`;
                    } else {
                      alert("Invalid View Key");
                    }
                  }}>Decrypt</button>
                </div>
              </div>
            ) : (
              <p style={{fontSize:'12px', color:'#317454', margin:0}}>
                <Icon name="check" size={12}/> Successfully decrypted using ZK Commitment on the client-side.
              </p>
            )}
          </div>
        )}

        {invoice.milestones && invoice.milestones.length > 0 && (
          <div style={{marginBottom:'24px', display:'flex', flexDirection:'column', gap:'12px'}}>
            <div className="payment-label">MILESTONE PAYMENTS</div>
            {invoice.milestones.map((ms) => (
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
          ) : invoice.isStream ? (
            <div style={{width:'100%'}}>
              <div style={{marginBottom:'16px', padding:'16px', background:'rgba(255,255,255,0.8)', borderRadius:'12px', border:'1px solid var(--line)'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px'}}>
                  <span style={{fontWeight:600}}>Streaming Status</span>
                  <span style={{color: isStreaming ? '#317454' : 'var(--muted)'}}>
                    {isStreaming ? "🔴 LIVE" : "PAUSED"}
                  </span>
                </div>
                <div style={{fontSize:'24px', fontWeight:800, fontFamily:'var(--font-display)', marginBottom:'8px'}}>
                  ${invoice.streamedAmountUsd?.toFixed(2) || "0.00"} / ${invoice.amountUsd.toFixed(2)}
                </div>
                <div style={{width:'100%', height:'8px', background:'var(--line)', borderRadius:'4px', overflow:'hidden'}}>
                  <div style={{width: `${Math.min(100, ((invoice.streamedAmountUsd || 0) / invoice.amountUsd) * 100)}%`, height:'100%', background:'var(--ink)', transition:'width 1s linear'}} />
                </div>
              </div>
              
              {!isConnected ? (
                <WalletConnectMenu triggerClassName="pay-action" triggerLabel={<><Icon name="wallet" size={18}/>Connect wallet to stream</>} />
              ) : isStreaming ? (
                <button className="button button-outline" style={{width:'100%',justifyContent:'center',height:'48px'}} onClick={()=>setIsStreaming(false)}>
                  <Icon name="close" size={18}/> Stop Stream
                </button>
              ) : (
                <button className="pay-action" onClick={()=>setIsStreaming(true)}>
                  Approve 1-Click Stream (${invoice.streamRateUsd}/sec)
                </button>
              )}
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <button className="pay-action" onClick={()=>handlePay()} disabled={(invoice.isPrivate && decryptedAmount === null) || !!invoice.githubPrUrl}>
                {invoice.githubPrUrl ? "Waiting for PR Merge..." : `Pay ${(decryptedAmount !== null ? decryptedAmount : invoice.amountUsd).toLocaleString()} USDC`} <Icon name="arrow" size={18}/>
              </button>
              <button className="button button-outline" style={{width:'100%',justifyContent:'center',height:'48px'}} onClick={()=>setIsClawUpModalOpen(true)} disabled={(invoice.isPrivate && decryptedAmount === null) || !!invoice.githubPrUrl}>
                Pay with Any Network (ClawUp Routing)
              </button>
            </div>
          )}
        </div>
        {error && <div className="error-box" style={{marginTop: '16px'}}>{error}</div>}

        {!paid && (
          <div style={{marginTop:'24px', borderTop:'1px solid var(--line)', paddingTop:'24px'}}>
            <button className="button" style={{background:'transparent', color:'var(--muted)', fontSize:'12px', padding:0, textDecoration:'underline'}} onClick={()=>setShowDispute(!showDispute)}>
              Dispute this invoice
            </button>
            {showDispute && (
              <div style={{marginTop:'16px', padding:'16px', background:'rgba(255,255,255,0.4)', borderRadius:'12px', border:'1px solid var(--line)'}}>
                <div style={{fontWeight:800, marginBottom:'12px', display:'flex', alignItems:'center', gap:'6px'}}><Icon name="spark" size={14}/> Mistral Escrow Arbitrator</div>
                <div style={{fontSize:'12px', color:'var(--muted)', marginBottom:'12px'}}>Our AI agent will review the agreed scope of work and your dispute, then render a binding decision on this payment.</div>
                
                <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'12px',maxHeight:'200px',overflowY:'auto'}}>
                  {disputeLog.map((log,i)=>(
                    <div key={i} style={{padding:'8px',borderRadius:'8px',background:log.role==="user"?'rgba(0,0,0,0.05)':'rgba(49, 130, 93, 0.1)',color:log.role==="user"?'var(--ink)':'#31825d',fontSize:'12px',fontWeight:log.role==="ai"?800:400,whiteSpace:'pre-wrap'}}>
                      {log.content}
                    </div>
                  ))}
                </div>

                <div style={{display:'flex',gap:'8px'}}>
                  <input style={{flex:1}} placeholder="Why are you disputing this?" value={disputeMsg} onChange={e=>setDisputeMsg(e.target.value)} />
                  <button className="button button-outline" onClick={submitDispute}>Send</button>
                </div>
              </div>
            )}
          </div>
        )}

        {paid && (
          <div style={{marginTop:'24px', borderTop:'1px solid var(--line)', paddingTop:'24px'}}>
            <FeedbackForm role="client" invoiceId={invoice.id} />
          </div>
        )}

        <p className="wallet-note" style={{marginTop: '24px'}}><Icon name="lock" size={12}/>Direct non-custodial transfer on GOAT Network</p>
      </>
    )}
  </div>
  <ClawUpModal 
    isOpen={isClawUpModalOpen} 
    onClose={() => setIsClawUpModalOpen(false)} 
    amountUsd={invoice.amountUsd}
    freelancerAddress={invoice.freelancer}
    onSuccess={async (txHash, chainId) => {
      setIsClawUpModalOpen(false);
      setStatus("paying");
      try {
        const settle = await fetch(`/api/pay/${id}/settle`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-PAYMENT": `CROSSCHAIN_${chainId}_${txHash}` },
          body: JSON.stringify({})
        });
        const updatedInvoice = await settle.json();
        setStatus("idle");
        setInvoice(updatedInvoice.invoice);
      } catch (e) {
        setStatus("error");
        setError("Cross-chain settlement failed.");
      }
    }}
  />
 </section></main>
}
