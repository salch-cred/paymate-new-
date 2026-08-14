"use client"

import Link from "next/link"
import { use, useEffect, useState } from "react"
import { useAccount, useSwitchChain, useWalletClient } from "wagmi"
import { goatChain } from "@/lib/chain"
import { DOMAIN, STREAM_ALLOWANCE_TYPES } from "@/lib/eip712"
import { OPEN_CLIENT_ADDRESS } from "@/lib/constants"
import { Icon } from "@/components/icons"
import { WalletConnectMenu } from "@/components/wallet-connect-menu"
import { FeedbackForm } from "@/components/feedback-form"
import { PaidBill } from "@/components/paid-bill"
import { ClawUpModal } from "@/components/clawup-modal"
import { decryptViewKey } from "@/lib/zk"

type Invoice={id:string;freelancer:string;client:string;title?:string;description:string;amountUsd:number;status:"pending"|"paid"|"cancelled";chain:string;dueDate?:string;txHash?:string;createdAt?:number;paidAt?:number|null;ipfsReceipt?:string|null;splits?:{address:string;amountUsd:number}[];milestones?:{id:string;title:string;amountUsd:number;status:"pending"|"paid";txHash?:string;paidAt?:number}[];isStream?:boolean;streamRateUsd?:number|null;streamedAmountUsd?:number;streamSignature?:string|null;streamAuthorizedAt?:number|null;isPrivate?:boolean;zkCommitment?:string|null;githubPrUrl?:string|null;isYieldBearing?:boolean;yieldEarned?:number;isSwarm?:boolean;swarmWallets?:{address:string;share:number}[]|null;proofOfCompute?:boolean;computeHash?:string|null;escrowStatus?:"none"|"funded"|"resolved";escrowTxHash?:string|null}

export default function PayPage({params}:{params:Promise<{id:string}>}){
  const {id}=use(params);const [invoice,setInvoice]=useState<Invoice|null>(null);const [status,setStatus]=useState<"idle"|"paying"|"paid"|"error">("idle");const [activeMilestone,setActiveMilestone]=useState<string|null>(null);const [error,setError]=useState<string|null>(null);const [loading,setLoading]=useState(true);const {address,isConnected,chain}=useAccount();const {data:walletClient}=useWalletClient();const {switchChainAsync}=useSwitchChain()
  const [showDispute,setShowDispute]=useState(false);const [disputeMsg,setDisputeMsg]=useState("");const [disputeLog,setDisputeLog]=useState<{role:string,content:string}[]>([]);const [showClawUp,setShowClawUp]=useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  
  const [decryptedAmount, setDecryptedAmount] = useState<number | null>(null)
  const [viewKey, setViewKey] = useState<string>("")
  const [viewKeyInput, setViewKeyInput] = useState("")
  const [fiatRates, setFiatRates] = useState<Record<string, number> | null>(null)
  
  useEffect(()=>{
    fetch('/api/fiat-rates').then(r=>r.json()).then(d=>setFiatRates(d.rates)).catch(console.error);
    fetch(`/api/invoices/${id}`).then(r=>{if(!r.ok)throw new Error("Invoice not found");return r.json()}).then((inv) => {
      setInvoice(inv);
      // Decrypt the view key from the URL fragment once the invoice is known.
      if (inv.isPrivate) {
        const hash = window.location.hash.replace("#key=", "")
        if (hash) {
          const decrypted = decryptViewKey(hash);
          if (decrypted && decrypted.amountUsd > 0) {
            setDecryptedAmount(decrypted.amountUsd);
            setViewKey(hash);
          }
        }
      }
    }).catch(e=>setError(e.message||"Could not load invoice")).finally(()=>setLoading(false))
  },[id])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isStreaming && invoice && invoice.isStream && invoice.streamRateUsd && invoice.status === 'pending') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/pay/${id}/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amountToAdd: invoice.streamRateUsd,
              clientAddress: address
            })
          });
          if (res.ok) {
            const data = await res.json();
            setInvoice(data.invoice);
            if (data.streamComplete || data.invoice.status === 'paid') {
              setIsStreaming(false);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }, 1000); // 1 tick per second
    }
    return () => clearInterval(interval);
  }, [isStreaming, invoice, id, address]);


 async function submitDispute(){
   if(!disputeMsg.trim())return;
   if(!address||!walletClient){setDisputeLog([...disputeLog,{role:"ai",content:"Connect your wallet (as the client or freelancer on this invoice) to file a dispute."}]);return}
   const newLog = [...disputeLog, {role:"user",content:disputeMsg}];
   setDisputeLog(newLog);
   setDisputeMsg("");
   try{
     const transcript=newLog.map(l=>`${l.role==="user"?"Complainant":"Arbitrator"}: ${l.content}`).join("\n");
     const callerAddress=address.toLowerCase();
     const ts=Date.now();
     const message=`PayMate dispute invoice ${id} at ${ts}`;
     const signature=await walletClient.signMessage({message,account:address as `0x${string}`});
     const res=await fetch("/api/arbitrate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({invoiceId:id,complaint:transcript,callerAddress,message,signature,ts})});
     const data=await res.json();
     if(!res.ok) throw new Error(data.detail||"Arbitration failed");
     const enforcement = data.onChain?.executed
       ? `\nEnforced on-chain: ${data.onChain.resolutionTxHash}`
       : data.onChain?.note
         ? `\nOn-chain: ${data.onChain.note}`
         : "";
     setDisputeLog([...newLog, {role:"ai",content:`Decision: ${data.decision.resolution}\nReason: ${data.decision.reasoning}${enforcement}`}]);
     if (data.invoice) setInvoice(data.invoice);
   }catch(e){
     setDisputeLog([...newLog, {role:"ai",content:`Error: ${e instanceof Error?e.message:"Failed"}`}]);
   }
 }

 async function authorizeStream(){
   if(!walletClient||!address||!invoice)return;
   setStatus("paying");
   try{
     const streamCap=decryptedAmount!==null?decryptedAmount:(invoice.amountUsd??0);
     const signature=await walletClient.signTypedData({domain:DOMAIN,types:STREAM_ALLOWANCE_TYPES,primaryType:"StreamAllowance",message:{invoiceId:id,maxAmountUsd:BigInt(Math.round(streamCap))},account:address});
     const res=await fetch(`/api/pay/${id}/stream`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"authorize",signature,maxAmountUsd:streamCap})});
     if(!res.ok)throw new Error("Stream authorization failed");
     const data=await res.json();
     setInvoice(data.invoice);
     setIsStreaming(true);
     setStatus("idle");
   }catch(e){
     setStatus("error");
     setError(e instanceof Error?e.message:"Stream authorization failed");
   }
 }

 async function handlePay(milestoneId?: string){if(!isConnected||!address||!walletClient)return;setStatus("paying");if(milestoneId)setActiveMilestone(milestoneId);setError(null);try{if(chain?.id!==goatChain.id)await switchChainAsync({chainId:goatChain.id});const res=await fetch(`/api/pay/${id}/settle`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({milestoneId,viewKey:viewKey||undefined})});if(res.status!==402){if(res.ok){setStatus("paid");setActiveMilestone(null);setInvoice(v=>v?{...v,status:"paid"}:v);return}throw new Error(`Unexpected settlement status: ${res.status}`)}const requirements=await res.json();if(!requirements.accepts||requirements.accepts.length===0)throw new Error("No valid payment options returned.");const txHashes=[];for(const option of requirements.accepts){if(!option.token)throw new Error("Payment requirements missing the USDC token address");if(!option.maxAmountRequired)throw new Error("Payment requirements missing the exact settlement amount");const amount=BigInt(option.maxAmountRequired);const hash=await walletClient.writeContract({address:option.token as `0x${string}`,abi:[{inputs:[{name:"recipient",type:"address"},{name:"amount",type:"uint256"}],name:"transfer",outputs:[{name:"",type:"bool"}],stateMutability:"nonpayable",type:"function"}],functionName:"transfer",args:[option.payTo as `0x${string}`,amount],account:address,chain:goatChain});txHashes.push(hash);}const settle=await fetch(`/api/pay/${id}/settle`,{method:"POST",headers:{"Content-Type":"application/json","X-PAYMENT":txHashes.join(",")},body:JSON.stringify({milestoneId,viewKey:viewKey||undefined})});if(!settle.ok)throw new Error("Payment verification failed.");const updatedInvoice=await settle.json();setStatus("idle");setActiveMilestone(null);setInvoice(updatedInvoice.invoice)}catch(e){setStatus("error");setActiveMilestone(null);setError(e instanceof Error?e.message:"Payment failed")}}
 async function handleCrossChainSettle(txHash: string, chainId: number){setStatus("paying");setError(null);try{const settle=await fetch(`/api/pay/${id}/settle`,{method:"POST",headers:{"Content-Type":"application/json","X-PAYMENT":`CROSSCHAIN_${chainId}_${txHash}`},body:JSON.stringify({viewKey:viewKey||undefined})});const data=await settle.json();if(!settle.ok)throw new Error(data?.detail||"Cross-chain settlement failed");setShowClawUp(false);setStatus("paid");setActiveMilestone(null);setInvoice(data.invoice)}catch(e){setStatus("error");setActiveMilestone(null);setError(e instanceof Error?e.message:"Cross-chain settlement failed")}}
 if(loading)return <main className="loading-page"><div className="loader"/></main>
 if(!invoice)return <main className="loading-page"><div style={{textAlign:"center"}}><h1 style={{fontFamily:"var(--font-display)"}}>Invoice unavailable</h1><p>{error}</p><Link className="button button-dark" href="/">Return home</Link></div></main>
 const paid=invoice.status==="paid"||status==="paid"
 const isEscrowInvoice = !!invoice.githubPrUrl && !invoice.isStream && !invoice.milestones && !invoice.splits
 const isPlaceholderClient = invoice.client.toLowerCase() === OPEN_CLIENT_ADDRESS.toLowerCase() || invoice.client.toLowerCase() === "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc" // legacy bot-invoice sentinel (pre-rename)
 const isAuthorized = isConnected && address && (isPlaceholderClient || address.toLowerCase() === invoice.client.toLowerCase() || address.toLowerCase() === invoice.freelancer.toLowerCase());
 // SECURITY (audit fix 2026-08-13): GET /api/invoices/[id] now returns
 // amountUsd: null for private invoices (the real amount only exists
 // client-side via the ZK view-key fragment, decrypted into decryptedAmount).
 // Every numeric computation below must use this safe fallback instead of
 // touching invoice.amountUsd directly, or it would crash/misbehave for a
 // private invoice before the view key is known.
 const effectiveAmount = decryptedAmount !== null ? decryptedAmount : (invoice.amountUsd ?? 0)
 const streamComplete = invoice.isStream && (invoice.streamedAmountUsd || 0) >= effectiveAmount

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
          <div className="status-badge" style={{ background: paid ? '#e7f5ec' : invoice.escrowStatus === 'funded' ? '#f0ead9' : '#fff0ed', color: paid ? '#317454' : invoice.escrowStatus === 'funded' ? '#8a6d1a' : '#b94328' }}>
            {paid ? 'PAID' : invoice.escrowStatus === 'funded' ? 'IN ESCROW' : 'PENDING'}
          </div>
        </div>

        <div className="job-summary">
          <div className="payment-label" style={{ marginBottom: '8px' }}>SCOPE OF WORK</div>
          <p>{invoice.description}</p>
        </div>

        <div className="amount-due" style={{marginBottom: '24px'}}>
          <span>TOTAL DUE</span>
          <h1 style={{fontSize:'32px', fontFamily:'var(--font-display)', fontWeight:800, margin:0, letterSpacing:'-0.5px'}}>
            {invoice.isPrivate && decryptedAmount === null ? "█ █ █" : `$${(decryptedAmount !== null ? decryptedAmount : invoice.amountUsd).toLocaleString()}`} USDC
          </h1>
          {fiatRates && (invoice.isPrivate && decryptedAmount === null ? null : (
            <div style={{fontSize: '12px', color: 'var(--muted)', marginTop: '8px', fontWeight: 600}}>
              ≈ {new Intl.NumberFormat('en-US', {style: 'currency', currency: 'EUR', maximumFractionDigits: 0}).format((decryptedAmount !== null ? decryptedAmount : invoice.amountUsd) * fiatRates['EUR'])} · {new Intl.NumberFormat('en-US', {style: 'currency', currency: 'GBP', maximumFractionDigits: 0}).format((decryptedAmount !== null ? decryptedAmount : invoice.amountUsd) * fiatRates['GBP'])} · {new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 0}).format((decryptedAmount !== null ? decryptedAmount : invoice.amountUsd) * fiatRates['INR'])} · {new Intl.NumberFormat('ja-JP', {style: 'currency', currency: 'JPY', maximumFractionDigits: 0}).format((decryptedAmount !== null ? decryptedAmount : invoice.amountUsd) * fiatRates['JPY'])}
            </div>
          ))}
        </div>
        
        {!paid && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '24px 0', padding: '24px', background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--line)' }}>
            <div style={{ background: 'white', padding: '12px', borderRadius: '12px', border: '1px solid var(--line)', display: 'inline-block' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`} 
                alt="QR Code for payment link" 
                style={{ width: '140px', height: '140px', display: 'block' }} 
              />
            </div>
            <span style={{ marginTop: '12px', fontSize: '14px', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Scan to pay</span>
          </div>
        )}
        
        {invoice.githubPrUrl && !paid && (
          <div style={{marginBottom:'24px', padding:'16px', background: invoice.escrowStatus === 'funded' ? 'linear-gradient(to right, rgba(49, 130, 93, 0.1), rgba(49, 130, 93, 0.05))' : 'rgba(255,255,255,0.8)', borderRadius:'12px', border:'1px solid ' + (invoice.escrowStatus === 'funded' ? 'rgba(49, 130, 93, 0.3)' : 'var(--line)')}}>
            <div style={{fontWeight:800, marginBottom:'8px', display:'flex', alignItems:'center', gap:'6px', color: invoice.escrowStatus === 'funded' ? '#317454' : 'var(--ink)'}}>
              <Icon name="link" size={14}/> DevOps Escrow {invoice.escrowStatus === 'funded' && <span style={{background:'#e7f5ec', color:'#317454', fontSize:'10px', padding:'2px 8px', borderRadius:'8px', fontWeight:800}}>FUNDED</span>}
            </div>
            {invoice.escrowStatus === 'funded' ? (
              <>
                <p style={{fontSize:'12px', color:'var(--muted)', marginBottom:'12px', lineHeight:1.5}}>
                  <b style={{color:'#317454'}}>${effectiveAmount.toLocaleString()} USDC is locked in the on-chain escrow contract.</b> It is released to the freelancer the exact millisecond the Pull Request merges — or by the AI arbitrator if a dispute is raised.
                </p>
                {invoice.escrowTxHash && (
                  <a href={`https://explorer.goat.network/tx/${invoice.escrowTxHash}`} target="_blank" rel="noreferrer" style={{display:'inline-flex', alignItems:'center', gap:'8px', padding:'8px 12px', background:'var(--surface)', borderRadius:'6px', fontSize:'12px', fontWeight:600, color:'var(--ink)', textDecoration:'none', border:'1px solid var(--line)', marginBottom:'12px'}}>
                    <Icon name="link" size={14}/> View Escrow Funding on GOAT
                  </a>
                )}
              </>
            ) : (
              <p style={{fontSize:'12px', color:'var(--muted)', marginBottom:'12px', lineHeight:1.5}}>
                Paying this invoice locks your funds in an autonomous on-chain escrow. They are cryptographically released to the agent the exact millisecond the Pull Request is merged.
              </p>
            )}
            <a href={invoice.githubPrUrl} target="_blank" rel="noreferrer" style={{display:'flex', alignItems:'center', gap:'8px', padding:'8px 12px', background:'var(--surface)', borderRadius:'6px', fontSize:'12px', fontWeight:600, color:'var(--ink)', textDecoration:'none', border:'1px solid var(--line)'}}>
              <Icon name="link" size={14}/> View Linked Pull Request
            </a>
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
                    if (decrypted && decrypted.amountUsd > 0) {
                      setDecryptedAmount(decrypted.amountUsd);
                      setViewKey(viewKeyInput);
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
              <span>${(effectiveAmount - invoice.splits.reduce((sum,s)=>sum+s.amountUsd,0)).toLocaleString()} USDC</span>
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
            </div>
          ) : status === "paying" ? (
            <div className="settling-box" style={{background:'rgba(255,255,255,0.4)',border:'1px solid var(--line)',borderRadius:'12px',padding:'16px',display:'flex',flexDirection:'column',gap:'12px'}}>
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
                  ${invoice.streamedAmountUsd?.toFixed(2) || "0.00"} / ${effectiveAmount.toFixed(2)}
                </div>
                <div style={{width:'100%', height:'8px', background:'var(--line)', borderRadius:'4px', overflow:'hidden'}}>
                  <div style={{width: `${Math.min(100, ((invoice.streamedAmountUsd || 0) / (effectiveAmount || 1)) * 100)}%`, height:'100%', background:'var(--ink)', transition:'width 1s linear'}} />
                </div>
                {streamComplete && (
                  <p style={{fontSize:'12px', color:'#317454', fontWeight:700, margin:'12px 0 0'}}>
                    <Icon name="check" size={12}/> Stream complete — settle the streamed amount on-chain to finish.
                  </p>
                )}
              </div>
              
              {streamComplete ? (
                <button className="pay-action" onClick={()=>handlePay()}>
                  Settle ${(invoice.streamedAmountUsd || 0).toFixed(2)} USDC on-chain <Icon name="arrow" size={18}/>
                </button>
              ) : !isConnected ? (
                <WalletConnectMenu triggerClassName="pay-action" triggerLabel={<><Icon name="wallet" size={18}/>Connect wallet to stream</>} />
              ) : isStreaming ? (
                <button className="button button-outline" style={{width:'100%',justifyContent:'center',height:'48px'}} onClick={()=>setIsStreaming(false)}>
                  <Icon name="close" size={18}/> Stop Stream
                </button>
              ) : invoice.streamSignature ? (
                <button className="pay-action" onClick={() => setIsStreaming(true)}>
                  Resume Stream (${invoice.streamRateUsd}/sec)
                </button>
              ) : (
                <button className="pay-action" onClick={authorizeStream}>
                  Approve 1-Click Stream (${invoice.streamRateUsd}/sec)
                </button>
              )}
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              {isEscrowInvoice && invoice.escrowStatus === 'funded' ? (
                <button className="pay-action" disabled style={{opacity:0.75, cursor:'default'}}>
                  <Icon name="lock" size={16}/> Funds Locked — Released on PR Merge / Arbitration
                </button>
              ) : (
                <>
                  <button className="pay-action" onClick={()=>handlePay()} disabled={invoice.isPrivate && decryptedAmount === null}>
                    {isEscrowInvoice ? `Lock ${invoice.isPrivate && decryptedAmount === null ? "███" : (decryptedAmount !== null ? decryptedAmount : invoice.amountUsd).toLocaleString()} USDC in Escrow` : `Pay ${invoice.isPrivate && decryptedAmount === null ? "███" : (decryptedAmount !== null ? decryptedAmount : invoice.amountUsd).toLocaleString()} USDC`} <Icon name="arrow" size={18}/>
                  </button>
                  {!isEscrowInvoice && !invoice.isStream && !invoice.milestones && !invoice.splits && !invoice.isPrivate && (
  <button className="button button-outline" style={{ width: '100%', justifyContent: 'center', height: 42, fontSize: 12, marginTop: 10 }} onClick={()=>setShowClawUp(true)}>
    <Icon name="network" size={14} /> Pay with Any Network (ClawUp Routing)
  </button>
)}
<div style={{ marginTop: 6, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Icon name="network" size={13} />
                      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--muted)' }}>CLAWUP CROSS-CHAIN</span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.55, margin: '0 0 10px' }}>
                      Bridge to GOAT yourself, then pay from the button above — fully non-custodial, funds never pass through PayMate.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <a href="https://oku.trade/bridge/goat" target="_blank" rel="noreferrer" className="button button-outline" style={{ width: '100%', justifyContent: 'center', height: 42, fontSize: 12 }}>
                        <Icon name="network" size={14} /> ClawUp — Bridge USDC from any network
                      </a>
                      <a href="https://bridge.goat.network" target="_blank" rel="noreferrer" className="button button-outline" style={{ width: '100%', justifyContent: 'center', height: 42, fontSize: 12 }}>
                        <Icon name="network" size={14} /> ClawUp — Bridge BTC / BNB / DOGE
                      </a>
                      <a href="https://gas.zip" target="_blank" rel="noreferrer" className="button button-outline" style={{ width: '100%', justifyContent: 'center', height: 42, fontSize: 12 }}>
                        <Icon name="network" size={14} /> ClawUp — Bridge gas & tokens
                      </a>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {paid && (
          <PaidBill invoice={{
            id: invoice.id,
            freelancer: invoice.freelancer,
            client: invoice.client,
            title: invoice.title,
            description: invoice.description,
            amountUsd: effectiveAmount,
            status: invoice.status,
            chain: invoice.chain,
            dueDate: invoice.dueDate,
            txHash: invoice.txHash,
            ipfsReceipt: invoice.ipfsReceipt,
            createdAt: invoice.createdAt,
            paidAt: invoice.paidAt,
            isStream: invoice.isStream,
            streamRateUsd: invoice.streamRateUsd,
            streamedAmountUsd: invoice.streamedAmountUsd,
            splits: invoice.splits,
            escrowTxHash: invoice.escrowTxHash,
          }} />
        )}
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

        <p className="wallet-note" style={{marginTop: '24px'}}><Icon name="lock" size={12}/>{isEscrowInvoice ? 'Funds locked non-custodially in the on-chain escrow contract on GOAT Network' : 'Direct non-custodial transfer on GOAT Network'}</p>
      </>
    )}
  </div>

 </section><ClawUpModal isOpen={showClawUp} onClose={()=>setShowClawUp(false)} onSuccess={handleCrossChainSettle} amountUsd={effectiveAmount} /></main>
}
