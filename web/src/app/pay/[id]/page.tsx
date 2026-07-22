"use client"

import Link from "next/link"
import { use, useEffect, useState } from "react"
import { useAccount, useSwitchChain, useWalletClient } from "wagmi"
import { parseUnits } from "viem"
import { goatTestnet3 } from "@/lib/chain"
import { Icon } from "@/components/icons"
import { WalletConnectMenu } from "@/components/wallet-connect-menu"
import { FeedbackForm } from "@/components/feedback-form"

type Invoice={id:string;freelancer:string;client:string;title?:string;description:string;amountUsd:number;status:"pending"|"paid";chain:string}

export default function PayPage({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);const [invoice,setInvoice]=useState<Invoice|null>(null);const [status,setStatus]=useState<"idle"|"paying"|"paid"|"error">("idle");const [error,setError]=useState<string|null>(null);const [loading,setLoading]=useState(true);const {address,isConnected,chain}=useAccount();const {data:walletClient}=useWalletClient();const {switchChainAsync}=useSwitchChain()
 useEffect(()=>{fetch(`/api/invoices/${id}`).then(r=>{if(!r.ok)throw new Error("Invoice not found");return r.json()}).then(setInvoice).catch(e=>setError(e.message||"Could not load invoice")).finally(()=>setLoading(false))},[id])
 async function handlePay(){if(!isConnected||!address||!walletClient)return;setStatus("paying");setError(null);try{if(chain?.id!==goatTestnet3.id)await switchChainAsync({chainId:goatTestnet3.id});const res=await fetch(`/api/pay/${id}/settle`,{method:"POST"});if(res.status!==402){if(res.ok){setStatus("paid");return}throw new Error(`Unexpected settlement status: ${res.status}`)}const requirements=await res.json();const option=requirements.accepts?.[0];if(!option)throw new Error("No valid payment option returned.");const hash=await walletClient.writeContract({address:(option.token||"0x228B00") as `0x${string}`,abi:[{inputs:[{name:"recipient",type:"address"},{name:"amount",type:"uint256"}],name:"transfer",outputs:[{name:"",type:"bool"}],stateMutability:"nonpayable",type:"function"}],functionName:"transfer",args:[option.payTo as `0x${string}`,parseUnits(option.price.replace("$",""),6)],account:address,chain:goatTestnet3});const settle=await fetch(`/api/pay/${id}/settle`,{method:"POST",headers:{"Content-Type":"application/json","X-PAYMENT":hash}});if(!settle.ok)throw new Error("Payment verification failed.");setStatus("paid");setInvoice(v=>v?{...v,status:"paid"}:v)}catch(e){setStatus("error");setError(e instanceof Error?e.message:"Payment failed")}}
 if(loading)return <main className="loading-page"><div className="loader"/></main>
 if(!invoice)return <main className="loading-page"><div style={{textAlign:"center"}}><h1 style={{fontFamily:"var(--font-display)"}}>Invoice unavailable</h1><p>{error}</p><Link className="button button-dark" href="/">Return home</Link></div></main>
 const paid=invoice.status==="paid"||status==="paid"
 return <main className="payment-shell"><header className="payment-nav"><Link className="brand" href="/"><span className="brand-mark"><span/></span><b>PayMate</b></Link><span style={{fontSize:10,color:"#777"}}>SECURE PAYMENT · {invoice.id}</span></header><section className="payment-wrap">
  <aside className="payment-aside"><span className="section-kicker">CLIENT CHECKOUT</span><h1>A clean finish<br/>to good work.</h1><p>This payment settles directly to the freelancer&apos;s wallet and creates verifiable proof of completion.</p><div className="trust-list"><div><Icon name="lock"/>Non-custodial wallet payment</div><div><Icon name="shield"/>On-chain settlement verification</div><div><Icon name="network"/>Portable ERC-8004 reputation</div></div></aside>
  <div className="payment-card"><span className="payment-label">PAYMENT REQUEST</span><div className="client-line"><h2>{invoice.title||"Professional services"}</h2><span className="status-badge">{paid?"Settled":"Ready to pay"}</span></div><div className="job-summary">{invoice.description}</div><div className="amount-due"><span>Amount due</span><strong>${invoice.amountUsd.toLocaleString(undefined,{minimumFractionDigits:2})}</strong><small>USDC · GOAT Testnet3</small></div>{paid?<div className="paid-state"><Icon name="check"/>Payment verified. The invoice is settled.</div>:isConnected?<button className="pay-action" onClick={handlePay} disabled={status==="paying"}>{status==="paying"?"Confirming payment…":"Pay with connected wallet"}<Icon name={status==="paying"?"bolt":"arrow"} size={18}/></button>:<WalletConnectMenu triggerClassName="pay-action" triggerLabel={<>Connect wallet to pay<Icon name="arrow" size={18}/></>}/>}<div className="wallet-note"><Icon name="lock" size={13}/>{isConnected?`Connected: ${address?.slice(0,6)}…${address?.slice(-4)}`:"Your wallet will ask you to approve the transaction"}</div>{error&&<div className="error-box">{error}</div>}{paid&&<FeedbackForm role="client" invoiceId={invoice.id}/>}</div>
 </section></main>
}
