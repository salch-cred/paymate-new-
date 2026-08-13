"use client"

import { useEffect, useRef, useState } from "react"
import { useWalletClient } from "wagmi"
import { isAddress, getAddress } from "viem"
import { useWallet } from "@/lib/useWallet"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Icon } from "@/components/icons"
import { WalletConnectMenu } from "@/components/wallet-connect-menu"
import { FeedbackForm } from "@/components/feedback-form"
import { generateCommitment, generateViewKey } from "@/lib/zk"
import { motion } from "framer-motion"
import { DeveloperDashboard } from "@/components/developer-dashboard"

type Invoice={id:string;freelancer:string;client:string;title?:string;description:string;amountUsd:number;status:"pending"|"paid"|"cancelled";chain:string;createdAt:string;txHash?:string}

// SECURITY (audit fix 2026-08-13): cancellation now requires a wallet-signed,
// timestamp-bound proof — mirrors the pattern already used on /developers.
const CANCEL_MESSAGE = (invoiceId: string, ts: number) => `PayMate cancel invoice ${invoiceId} at ${ts}`
type Reputation={score:number;jobsCompleted:number;totalEarnedUsd:number}

// Minimal Web Speech API typings (not in the standard TS DOM lib) so we can
// avoid `any` casts on `window` when wiring up voice dictation below.
interface SpeechRecognitionResultEvent { results: { [index: number]: { [index: number]: { transcript: string } } } }
interface SpeechRecognitionInstance {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export default function DashboardPage(){
  const {address,isConnected}=useWallet();
  const {data:walletClient}=useWalletClient();
  // removed logout and ensName as they are handled in layout-client.tsx
 const queryClient=useQueryClient()
 const [client,setClient]=useState("");const [title,setTitle]=useState("");const [description,setDescription]=useState("");const [amount,setAmount]=useState("");const [dueDate,setDueDate]=useState("")
 const [splits,setSplits]=useState<{address:string,amountUsd:string}[]>([])
 const [milestones,setMilestones]=useState<{id:string,title:string,amountUsd:string}[]>([])
 const [privacyMode,setPrivacyMode]=useState(false)
 // ZK view keys are generated client-side (never sent to the server) and
 // persisted in localStorage so the creator can re-copy a private pay link
 // after a refresh. Keyed by invoice id.
 const [zkViewKeys,setZkViewKeys]=useState<Record<string,string>>(()=>{try{return JSON.parse(localStorage.getItem("pm_zk_viewkeys")||"{}")}catch{return{}}})
 useEffect(()=>{try{localStorage.setItem("pm_zk_viewkeys",JSON.stringify(zkViewKeys))}catch{}},[zkViewKeys])
 const [draftPrompt,setDraftPrompt]=useState(()=>typeof window!=="undefined"?new URLSearchParams(window.location.search).get("prompt")||"":"");const [draftMeta,setDraftMeta]=useState<{source:string;confidence:number;paymentTerms?:string}|null>(null)
 const [isListening, setIsListening] = useState(false);
 const [formError,setFormError]=useState<string|null>(null);const [copied,setCopied]=useState<string|null>(null)
 const [zkProof,setZkProof]=useState<{commitment:string;viewKey:string}|null>(null);const [zkLoading,setZkLoading]=useState(false)
 const mediaRecorderRef=useRef<MediaRecorder|null>(null);const audioChunksRef=useRef<BlobPart[]>([]);const [voiceHistory,setVoiceHistory]=useState<Array<{role:string, parts:{text:string}[]}>>([])
 const [search,setSearch]=useState("");const searchRef=useRef<HTMLInputElement>(null)
 useEffect(()=>{function onKey(e:KeyboardEvent){if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();searchRef.current?.focus()}}window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey)},[])

 async function startListening() {
   if (isListening && mediaRecorderRef.current) {
     mediaRecorderRef.current.stop();
     setIsListening(false);
     return;
   }
   try {
     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
     const mediaRecorder = new MediaRecorder(stream);
     mediaRecorderRef.current = mediaRecorder;
     audioChunksRef.current = [];

     mediaRecorder.ondataavailable = (event) => {
       if (event.data.size > 0) audioChunksRef.current.push(event.data);
     };

     mediaRecorder.onstop = async () => {
       const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
       stream.getTracks().forEach(track => track.stop());
       const formData = new FormData();
       formData.append("audio", audioBlob);
       formData.append("history", JSON.stringify(voiceHistory));
       try {
         const res = await fetch("/api/agent/voice", { method: "POST", body: formData });
         const data = await res.json();
         if (!res.ok) throw new Error(data.error || "Voice API failed");
         
         setVoiceHistory(prev => [...prev, { role: "user", parts: [{ text: "Audio sent" }] }, { role: "model", parts: [{ text: data.text }] }]);
         
         if (data.text) {
           const synth = window.speechSynthesis;
           const msg = new SpeechSynthesisUtterance(data.text);
           synth.speak(msg);
         }
         
         if (data.draft) {
           const draft = data.draft;
           if (draft.title) setTitle(draft.title);
           if (draft.description) setDescription(draft.description);
           if (draft.amountUsd) setAmount(String(draft.amountUsd));
           if (draft.dueDate) setDueDate(draft.dueDate);
           setDraftMeta({source: "ai-voice", confidence: 0.9, paymentTerms: draft.paymentTerms});
         }
       } catch (err: unknown) {
         setFormError(err instanceof Error ? err.message : String(err));
       }
     };

     mediaRecorder.start();
     setIsListening(true);
   } catch {
     setFormError("Microphone access denied or unavailable.");
   }
 }

 const draftMutation=useMutation({mutationFn:async(prompt:string)=>{const res=await fetch(`/api/invoices/draft`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});const data=await res.json();if(!res.ok)throw new Error(data.detail||"Draft generation failed");return data.draft},onSuccess:(draft)=>{setTitle(draft.title||"");setDescription(draft.description||draftPrompt);setAmount(draft.amountUsd?String(draft.amountUsd):"");setDueDate(draft.dueDate||"");setDraftMeta({source:draft.source||"ai",confidence:Number(draft.confidence||0),paymentTerms:draft.paymentTerms});setFormError(null)},onError:(e)=>setFormError(e instanceof Error?e.message:"Could not generate draft")})
 useEffect(() => {
    // draftPrompt is seeded synchronously from the URL in useState's lazy
    // initializer above (avoids a setState-in-effect render flash). This
    // effect only handles side effects: scrolling, cleaning the URL, and
    // kicking off the AI draft once the wallet is connected.
    if (draftPrompt && isConnected) {
      document.getElementById('new')?.scrollIntoView({ behavior: 'smooth' });
      window.history.replaceState({}, '', '/dashboard');
      draftMutation.mutate(draftPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

 const invoicesQuery=useQuery({queryKey:["invoices",address],enabled:isConnected&&!!address,queryFn:async()=>{const res=await fetch(`/api/invoices?freelancer=${address}`);if(!res.ok)throw new Error("Could not reach the PayMate API.");return (await res.json()).invoices as Invoice[]}})
 const reputationQuery=useQuery({queryKey:["reputation",address],enabled:isConnected&&!!address,queryFn:async()=>{const res=await fetch(`/api/reputation/${address}`);if(!res.ok)throw new Error("Could not reach the PayMate API.");return (await res.json()) as Reputation}})
 const invoices=invoicesQuery.data??[];const reputation=reputationQuery.data??null
 const error=formError??((invoicesQuery.isError||reputationQuery.isError)?"Could not reach the PayMate API.":null)
 const createInvoiceMutation=useMutation({mutationFn:async()=>{const splitsPayload=splits.length>0?splits.map(s=>({address:s.address,amountUsd:Number(s.amountUsd)})):undefined;const msPayload=milestones.length>0?milestones.map(m=>({id:m.id,title:m.title,amountUsd:Number(m.amountUsd),status:"pending"})):undefined;const calculatedAmount=milestones.length>0?milestones.reduce((s,m)=>s+Number(m.amountUsd),0):Number(amount);
 // ZK Privacy Mode: build the commitment + view key CLIENT-SIDE so the server
 // only ever sees the SHA-256 hash. The view key is kept in state and appended
 // to the pay link as #key=<viewKey> so the payer can decrypt the real amount.
 let zkViewKey: string | null = null
 let zkCommitment: string | null = null
 if (privacyMode) {
   const salt = crypto.randomUUID()
   zkCommitment = await generateCommitment(calculatedAmount, salt)
   zkViewKey = generateViewKey(calculatedAmount, salt)
 }
 const res=await fetch(`/api/invoices`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({freelancer:address,client,title,description,amountUsd:calculatedAmount,dueDate:dueDate||null,splits:splitsPayload,milestones:msPayload,isPrivate:privacyMode,zkCommitment})});const data=await res.json();if(!res.ok)throw new Error(data.detail||"Invoice creation failed");return {...data.invoice,payUrl:`${location.origin}${data.payUrl}`,zkViewKey} as Invoice&{zkViewKey:string|null}},onSuccess:(created)=>{queryClient.setQueryData<Invoice[]>(["invoices",address],(prev)=>[created,...(prev??[])]);if(created.zkViewKey){setZkViewKeys(prev=>({...prev,[created.id]:created.zkViewKey as string}))}setClient("");setTitle("");setDescription("");setAmount("");setDueDate("");setSplits([]);setMilestones([]);setFormError(null)},onError:(e)=>setFormError(e instanceof Error?e.message:"Could not create invoice")})
 const cancelInvoiceMutation=useMutation({mutationFn:async(id:string)=>{if(!address||!walletClient)throw new Error("Connect your wallet first.");const ts=Date.now();const message=CANCEL_MESSAGE(id,ts);const signature=await walletClient.signMessage({message,account:address as `0x${string}`});const res=await fetch(`/api/invoices/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"cancelled",freelancer:getAddress(address),message,signature,ts})});const data=await res.json();if(!res.ok)throw new Error(data.detail||"Cancel failed");return data},onSuccess:(updated)=>{queryClient.setQueryData<Invoice[]>(["invoices",address],(prev)=>(prev??[]).map(i=>i.id===updated.id?updated:i));},onError:(e)=>setFormError(e instanceof Error?e.message:"Could not cancel invoice")})
 function generateDraft(){if(draftPrompt.trim().length<12)return setFormError("Describe the work, price, and any deadline in a little more detail.");draftMutation.mutate(draftPrompt)}
 function createInvoice(e:React.FormEvent){e.preventDefault();if(!address)return setFormError("Connect your wallet first.");if(!isAddress(client))return setFormError("Enter a valid client wallet address.");if(!title.trim()||description.trim().length<5)return setFormError("Complete the title and work description.");const calcAmt=milestones.length>0?milestones.reduce((s,m)=>s+Number(m.amountUsd),0):Number(amount);if(calcAmt<=0)return setFormError("Invoice amount must be greater than zero.");if(splits.length>0){const splitTotal=splits.reduce((sum,s)=>sum+Number(s.amountUsd),0);if(Math.abs(splitTotal-calcAmt)>0.01)return setFormError(`Total of splits ($${splitTotal}) must equal total invoice amount ($${calcAmt}).`)}createInvoiceMutation.mutate()}
 async function copyInvoice(inv:Invoice){const viewKey=zkViewKeys[inv.id];const url=`${location.origin}/pay/${inv.id}`+(viewKey?`#key=${viewKey}`:"");await navigator.clipboard.writeText(url);setCopied(inv.id);setTimeout(()=>setCopied(null),1500)}
 const paid=invoices.filter(i=>i.status==="paid");const outstanding=invoices.filter(i=>i.status==="pending").reduce((s,i)=>s+i.amountUsd,0);const maxInvoice=Math.max(1,...invoices.slice(0,7).map(i=>i.amountUsd));const settlementRate=invoices.length?Math.round((paid.length/invoices.length)*100):0
 const q=search.trim().toLowerCase();const filteredInvoices=q?invoices.filter(inv=>[inv.title,inv.id,inv.client,inv.txHash].some(f=>f?.toLowerCase().includes(q))):invoices
  return (
    <>
      <header className="app-topbar" style={{ marginBottom: 0, position: 'sticky', top: 54, zIndex: 19 }}>
        <div>
          <span className="workspace-label">PAYMATE CONTROL CENTER</span>
          <h1>Money, proof, momentum.</h1>
          <p>Create invoices and track verified settlement from one workspace.</p>
        </div>
        <div className="topbar-actions">
          <a href="#new" className="button button-primary" style={{ height: 38, fontSize: 12, padding: '0 16px', gap: 7 }}>
            <Icon name="invoice" size={14} /> New invoice
          </a>
          <a href="#activity" className="topbar-icon" title="Invoice activity">
            <Icon name="chart" size={17} />
          </a>
        </div>
      </header>
      <div className="app-content">
      <div className="workspace-toolbar"><div className="toolbar-search"><Icon name="spark" size={15}/><input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search invoices, clients, or transaction hashes"/><kbd>⌘ K</kbd></div><div className="toolbar-status"><span><i/>API ONLINE</span><span><i/>GOAT LIVE</span></div><a href="#new" className="toolbar-create"><Icon name="invoice" size={15}/>New invoice</a></div><div className="dashboard-journey"><div className="journey-progress"/><span className="active"><i>1</i><b>Draft</b><small>Structure the work</small></span><em>→</em><span><i>2</i><b>Review</b><small>Approve every detail</small></span><em>→</em><span><i>3</i><b>Share</b><small>Send one link</small></span><em>→</em><span><i>4</i><b>Verify</b><small>Settle on GOAT</small></span></div>
  {!isConnected?<section className="panel connect-empty"><div><div className="empty-orb"><Icon name="wallet" size={34}/></div><h2>Connect once. Run the whole workflow.</h2><p>Your wallet is your identity, payment destination, and portable reputation profile.</p><WalletConnectMenu triggerClassName="button button-primary" triggerLabel={<>Connect Web3 wallet <Icon name="arrow"/></>}/></div></section>:<motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.5}}><div className="metric-grid"><div className="metric-card"><span>Outstanding</span><b>${outstanding.toLocaleString()}</b><small>{invoices.filter(i=>i.status==="pending").length} open invoices</small></div>                <div className="metric-card"><span>Verified & Collected</span><b>${paid.reduce((s,i)=>s+i.amountUsd,0).toLocaleString()}</b><small style={{color:'#31825d',display:'flex',alignItems:'center',gap:'4px'}}><Icon name="check" size={12}/> Settled on GOAT mainnet</small></div><div className="metric-card"><span>Trust score</span><b>{reputation?.score??0}</b><small>ERC-8004 reputation</small></div></div><section className="dashboard-insights panel"><div className="insight-copy"><span className="insight-label">SETTLEMENT PULSE</span><h2>{settlementRate}% <small>verified</small></h2><p>{paid.length} of {invoices.length} invoices have reached final settlement.</p><div className="insight-legend"><span><i className="paid"/>Paid</span><span><i/>Pending</span></div></div><div className="mini-chart" aria-label="Recent invoice values">{invoices.length?invoices.slice(0,7).reverse().map(inv=><div key={inv.id} className={inv.status}><i style={{height:`${Math.max(14,(inv.amountUsd/maxInvoice)*100)}%`}}/><span>${Math.round(inv.amountUsd)}</span></div>):[32,58,45,72,52,86,68].map((h,i)=><div key={i}><i style={{height:`${h}%`}}/><span>—</span></div>)}</div><div className="insight-action"><Icon name="bolt"/><div><b>Live verification</b><span>Every receipt checked on GOAT</span></div><a href="/docs">View protocol <Icon name="arrow" size={14}/></a></div></section><div className="dashboard-grid">
 <div><section className="panel panel-pad" id="new"><div className="panel-heading"><div><h2>Create a verified invoice</h2><p>Clear terms, direct payment, permanent proof.</p></div><span className="icon-box"><Icon name="spark"/></span></div><div className="smart-drafter"><div className="smart-drafter-head"><div><span><Icon name="spark" size={15}/>INTELLIGENT DRAFTING</span><p>Describe the work naturally or use the Voice AI Agent.</p></div>{draftMeta&&<small className="draft-confidence"><i/>{draftMeta.source==="ai-voice"?"Voice AI structured":draftMeta.source==="ai"?"AI structured":"Safe parser"} · {Math.round(draftMeta.confidence*100)}%</small>}</div><div className="smart-drafter-input" style={{position:'relative'}}><textarea value={draftPrompt} onChange={e=>setDraftPrompt(e.target.value)} placeholder="Example: Brand strategy and visual identity... Total agreed: $2,480 USDC..."/><div style={{position:'absolute',right:'14px',top:'14px',display:'flex',gap:'8px'}}><button type="button" onClick={startListening} style={{width:'auto',height:'32px',borderRadius:'16px',border:'none',background:isListening?'#ff5b2e':'rgba(23,24,19,0.05)',color:isListening?'white':'var(--ink)',display:'flex',alignItems:'center',gap:'8px',padding:'0 12px',cursor:'pointer',boxShadow:isListening?'0 0 0 4px rgba(255,91,46,0.2)':'none',transition:'0.2s',fontSize:'12px',fontWeight:700}}><Icon name="spark" size={14}/> {isListening ? "Listening... (Click to send)" : "Voice Agent"}</button></div><button type="button" onClick={generateDraft} disabled={draftMutation.isPending}>{draftMutation.isPending?<><span className="draft-spinner"/>Structuring…</>:<><Icon name="spark" size={16}/>Generate draft</>}</button></div>{draftMeta&&<div className="draft-review-note"><Icon name="shield" size={14}/><span>Draft filled below. Review the amount and terms before creating the payment link.</span>{draftMeta.paymentTerms&&<b>{draftMeta.paymentTerms}</b>}</div>}</div><form onSubmit={createInvoice}><div className="form-grid"><div className="field"><label>Client wallet</label><input value={client} onChange={e=>setClient(e.target.value)} placeholder="0x..."/></div><div className="field"><label>Project title</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Brand system sprint"/></div><div className="field"><label>Amount · USDC</label><input type="number" min="0.01" step="0.01" value={milestones.length>0?milestones.reduce((s,m)=>s+Number(m.amountUsd),0):amount} disabled={milestones.length>0} onChange={e=>setAmount(e.target.value)} placeholder="2480.00"/></div><div className="field"><label>Due date</label><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div><div className="field full"><label>Scope delivered</label><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the completed work, included deliverables, and agreed terms."/></div></div>
 <div className="field full" style={{marginTop:'12px', padding:'16px', background:'rgba(255,255,255,0.4)', borderRadius:'12px', border:'1px solid var(--line)'}}>
 <label style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
  <span>Milestone Payments (Optional)</span>
  <button type="button" onClick={()=>setMilestones([...milestones, {id:crypto.randomUUID(),title:"",amountUsd:""}])} style={{background:'transparent',border:'1px solid var(--line)',borderRadius:'8px',padding:'4px 8px',fontSize:'9px',fontWeight:800}}>+ Add Milestone</button>
 </label>
 {milestones.length > 0 && <div style={{display:'flex',flexDirection:'column',gap:'8px',marginTop:'12px'}}>
  {milestones.map((ms, i) => (
    <div key={i} style={{display:'flex',gap:'8px',alignItems:'center'}}>
      <input style={{flex:1}} value={ms.title} onChange={(e)=>{const n=[...milestones];n[i].title=e.target.value;setMilestones(n)}} placeholder="Phase 1: Design" />
      <input type="number" style={{width:'100px'}} value={ms.amountUsd} onChange={(e)=>{const n=[...milestones];n[i].amountUsd=e.target.value;setMilestones(n)}} placeholder="$ Amount" />
      <button type="button" onClick={()=>setMilestones(milestones.filter((_,j)=>j!==i))} style={{background:'transparent',border:0,color:'#ff5b2e'}}><Icon name="close" size={14}/></button>
    </div>
  ))}
 </div>}
 </div>
 <div className="field full" style={{marginTop:'12px', padding:'16px', background:'rgba(255,255,255,0.4)', borderRadius:'12px', border:'1px solid var(--line)'}}>
 <label style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
  <span>Team Settlement Splits (Optional)</span>
  <button type="button" onClick={()=>setSplits([...splits, {address:"",amountUsd:""}])} style={{background:'transparent',border:'1px solid var(--line)',borderRadius:'8px',padding:'4px 8px',fontSize:'9px',fontWeight:800}}>+ Add Teammate</button>
 </label>
 {splits.length > 0 && <div style={{display:'flex',flexDirection:'column',gap:'8px',marginTop:'12px'}}>
  {splits.map((split, i) => (
    <div key={i} style={{display:'flex',gap:'8px',alignItems:'center'}}>
      <input style={{flex:1}} value={split.address} onChange={(e)=>{const n=[...splits];n[i].address=e.target.value;setSplits(n)}} placeholder="Teammate Wallet (0x...)" />
      <input type="number" style={{width:'100px'}} value={split.amountUsd} onChange={(e)=>{const n=[...splits];n[i].amountUsd=e.target.value;setSplits(n)}} placeholder="$ Amount" />
      <button type="button" onClick={()=>setSplits(splits.filter((_,j)=>j!==i))} style={{background:'transparent',border:0,color:'#ff5b2e'}}><Icon name="close" size={14}/></button>
    </div>
  ))}
 </div>}
 </div>
 <div className="invoice-options-grid" style={{marginTop:'12px'}}>
   <label className="field" style={{flexDirection:'row',alignItems:'center',gap:'8px',padding:'12px',background:'rgba(255,255,255,0.4)',borderRadius:'8px',border:'1px solid var(--line)',cursor:'pointer'}}>
     <input type="checkbox" checked={privacyMode} onChange={e=>setPrivacyMode(e.target.checked)} style={{width:'auto'}}/>
     <div style={{display:'flex',flexDirection:'column'}}>
       <span style={{fontWeight:800,fontSize:'12px',display:'flex',alignItems:'center',gap:'4px'}}><Icon name="lock" size={12}/> ZK Privacy Mode</span>
       <span style={{fontSize:'10px',color:'var(--muted)'}}>Shield payment details on-chain</span>
     </div>
   </label>

 </div>
 {error&&<div className="error-box">{error}</div>}<div className="composer-footer"><span className="hint"><Icon name="shield" size={15}/>Payment goes directly to your wallet.</span><button className="button button-primary" disabled={createInvoiceMutation.isPending}>{createInvoiceMutation.isPending?"Creating…":"Create payment link"}<Icon name="arrow" size={17}/></button></div></form></section>
 <section className="panel activity-panel" id="activity"><div className="panel-heading"><div><h2>Invoice activity</h2><p>Live status from creation to verified settlement.</p></div><span className="activity-count">{filteredInvoices.length}</span></div>{invoices.length===0?<div className="activity-empty">Your first invoice will appear here.</div>:filteredInvoices.length===0?<div className="activity-empty">No invoices match &quot;{search}&quot;.</div>:<div className="invoice-table">{filteredInvoices.map(inv=><div className="invoice-row" key={inv.id}><span className={`status-dot ${inv.status}`}/><div className="invoice-row-main"><b>{inv.title}</b><small>{new Date(inv.createdAt).toLocaleDateString()} · {inv.id.slice(0,8)}</small></div><strong>${inv.amountUsd.toLocaleString()}</strong><span className={`status-label ${inv.status}`}>{inv.status}</span>{inv.status==="pending"&&<button onClick={()=>cancelInvoiceMutation.mutate(inv.id)} aria-label="Cancel invoice"><Icon name="close" size={16}/></button>}<button onClick={()=>copyInvoice(inv)} aria-label="Copy payment link"><Icon name={copied===inv.id?"check":"copy"} size={16}/></button></div>)}</div>}</section><DeveloperDashboard /></div>
 <aside className="stat-stack" id="reputation"><section className="panel score-panel"><div className="panel-heading"><div><h2>Portable trust</h2><p>ERC-8004 credential</p></div><Icon name="shield"/></div><div className="score-ring"><div><strong>{reputation?.score??0}</strong><small>TRUST SCORE</small></div></div><div className="stat-row"><div className="mini-stat"><span>Jobs verified</span><b>{reputation?.jobsCompleted??0}</b></div><div className="mini-stat"><span>Total settled</span><b>${((reputation?.totalEarnedUsd??0)/1000).toFixed(1)}k</b></div></div>
 <div style={{padding:'0 16px 16px'}}>
  <button type="button" className="button button-dark" style={{width:'100%',justifyContent:'center'}} disabled={zkLoading} onClick={async()=>{setZkLoading(true);try{const salt=crypto.randomUUID();const commitment=await generateCommitment(Math.max(0,(reputation?.totalEarnedUsd??0)),salt);const viewKey=generateViewKey(Math.max(0,(reputation?.totalEarnedUsd??0)),salt);setZkProof({commitment,viewKey})}catch{setFormError("Could not generate ZK commitment")}finally{setZkLoading(false)}}}>{zkLoading?<><span className="draft-spinner"/>Generating Proof…</>:<><Icon name="lock" size={14}/>Generate ZK-Proof</>}</button>
  {zkProof&&<div style={{marginTop:'12px',padding:'12px',background:'rgba(255,255,255,0.4)',borderRadius:'8px',fontSize:'11px',wordBreak:'break-all',fontFamily:'monospace'}}><b>ZK Commitment (SHA-256):</b><br/>{zkProof.commitment}<br/><br/><b>View Key:</b><br/>{zkProof.viewKey}<div style={{marginTop:'8px',color:'var(--muted)'}}>A real cryptographic commitment of your verified earnings. The server only ever sees the hash — the amount stays with you via the view key.</div></div>}
 </div>
 </section><section className="panel panel-pad feature-list"><h2>Built into every link</h2><p><Icon name="lock"/>Direct, non-custodial payment</p><p><Icon name="network"/>On-chain transaction verification</p><p><Icon name="shield"/>Automatic reputation recording</p></section><div id="feedback"><FeedbackForm role="freelancer"/></div>
 <div className="panel panel-pad" style={{marginTop:'16px'}}>
   <div className="panel-heading"><div><h2>Web3 Inbox</h2><p>Push Protocol</p></div><Icon name="spark"/></div>
   {paid.length > 0 ? (
     <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
       {paid.slice(0, 3).map((inv, i) => (
         <div key={i} style={{padding:'12px', background:'rgba(255,255,255,0.6)', borderRadius:'12px', border:'1px solid var(--line)', display:'flex', gap:'12px', alignItems:'flex-start'}}>
           <div style={{width:'32px', height:'32px', borderRadius:'8px', background:'#dd44b9', color:'white', display:'grid', placeItems:'center', flexShrink:0}}>
             <Icon name="bolt" size={16}/>
           </div>
           <div>
             <div style={{fontSize:'12px', fontWeight:700, marginBottom:'4px'}}>Payment Verified on GOAT</div>
             <div style={{fontSize:'11px', color:'var(--text-muted)', lineHeight:1.5}}>Invoice {inv.id.split('-')[0]} for ${inv.amountUsd.toLocaleString()} USDC was successfully settled. Reputation updated.</div>
           </div>
         </div>
       ))}
     </div>
   ) : (
     <div style={{fontSize:'12px', color:'var(--text-muted)'}}>No new notifications. When your invoices settle, Push Protocol will alert your wallet.</div>
   )}
 </div>
   </aside></div></motion.div>}</div></>
  )
}
