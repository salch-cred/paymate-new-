"use client";

/* eslint-disable react/no-unescaped-entities, react/jsx-no-comment-textnodes -- this page renders syntax-highlighted code samples as JSX text (quotes and // comments are literal code, not prose) */

import Link from "next/link";
import { 
  Book02Icon, 
  CodeCircleIcon, 
  Shield02Icon, 
  Bitcoin01Icon,
  CheckmarkBadge01Icon,
  Globe02Icon,
  Cpu01Icon,
  Link02Icon
} from "hugeicons-react";

export default function DocsPage() {
  return (
    <div className="site-shell" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      <div className="ambient ambient-one"></div>
      <div className="ambient ambient-two"></div>
      
      <div className="relative z-10 max-w-[1400px] mx-auto pt-16 lg:pt-32 pb-24 px-4 lg:px-8 flex flex-col lg:flex-row gap-12 items-start">
        
        {/* Sidebar Navigation */}
        <aside className="w-64 flex-shrink-0 sticky top-32 glass rounded-2xl p-6 hidden lg:flex flex-col gap-8">
          <div>
            <span className="text-[9px] uppercase tracking-widest font-extrabold text-gray-500 mb-4 block">Overview</span>
            <nav className="flex flex-col gap-2">
              <a href="#introduction" className="text-sm font-semibold text-gray-700 hover:text-black hover:bg-black/5 px-3 py-2 rounded-lg transition-colors flex items-center gap-2">
                <Book02Icon size={16} /> Introduction
              </a>
              <a href="#quickstart" className="text-sm font-semibold text-gray-700 hover:text-black hover:bg-black/5 px-3 py-2 rounded-lg transition-colors flex items-center gap-2">
                <CodeCircleIcon size={16} /> Quickstart
              </a>
            </nav>
          </div>

          <div>
            <span className="text-[9px] uppercase tracking-widest font-extrabold text-gray-500 mb-4 block">Core Features</span>
            <nav className="flex flex-col gap-2">
              <a href="#ai-drafting" className="text-sm font-semibold text-gray-700 hover:text-black hover:bg-black/5 px-3 py-2 rounded-lg transition-colors flex items-center gap-2">
                <Cpu01Icon size={16} /> AI Voice & Drafting
              </a>
              <a href="#cross-chain" className="text-sm font-semibold text-gray-700 hover:text-black hover:bg-black/5 px-3 py-2 rounded-lg transition-colors flex items-center gap-2">
                <Globe02Icon size={16} /> Cross-Chain (ClawUp)
              </a>
              <a href="#x402" className="text-sm font-semibold text-gray-700 hover:text-black hover:bg-black/5 px-3 py-2 rounded-lg transition-colors flex items-center gap-2">
                <Bitcoin01Icon size={16} /> x402 Protocol
              </a>
              <a href="#escrow" className="text-sm font-semibold text-gray-700 hover:text-black hover:bg-black/5 px-3 py-2 rounded-lg transition-colors flex items-center gap-2">
                <Link02Icon size={16} /> Autonomous Escrow
              </a>
              <a href="#reputation" className="text-sm font-semibold text-gray-700 hover:text-black hover:bg-black/5 px-3 py-2 rounded-lg transition-colors flex items-center gap-2">
                <CheckmarkBadge01Icon size={16} /> ERC-8004 Reputation
              </a>
              <a href="#zk" className="text-sm font-semibold text-gray-700 hover:text-black hover:bg-black/5 px-3 py-2 rounded-lg transition-colors flex items-center gap-2">
                <Shield02Icon size={16} /> ZK Shielded Privacy
              </a>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 w-full max-w-3xl glass-heavy rounded-3xl p-6 lg:p-16">
          <div className="mb-6 flex items-center gap-3 text-orange-500 font-bold text-xs uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_0_4px_rgba(255,91,46,0.15)] animate-pulse"></span>
            PayMate Documentation
          </div>
          <h1 id="introduction" className="font-[family-name:var(--font-display)] text-5xl lg:text-6xl font-bold tracking-tight mb-8">
            The Financial Engine for the <em className="font-[family-name:var(--font-editorial)] font-normal text-green-700">Agent Economy</em>.
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed mb-12">
            PayMate is a complete non-custodial invoicing, escrow, and reputation platform built natively on the <strong>GOAT Network</strong> and integrated with <strong>ClawUp</strong>. It provides cryptographic settlement, zero-knowledge privacy, state-channel streaming, and autonomous DevOps escrows designed for both humans and AI agents.
          </p>

          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-16 flex gap-4 shadow-sm">
            <div className="text-green-600 mt-1">
              <CheckmarkBadge01Icon size={24} />
            </div>
            <div>
              <h4 className="font-bold text-green-900 mb-1">GOAT Network Mainnet Ready</h4>
              <p className="text-sm text-green-800 leading-relaxed">
                All PayMate deployments settle in real USDC directly on the GOAT Network. PayMate utilizes BitVM2-secured transaction logic and mints portable on-chain credentials.
              </p>
            </div>
          </div>

          <hr className="border-black/5 my-16" />

          {/* Quickstart */}
          <h2 id="quickstart" className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight mb-4">Quickstart</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            Creating an invoice is simple via the UI or the headless API. All invoices instantly generate a unified payment link.
          </p>
          
          <div className="bg-[#171813] rounded-2xl overflow-hidden mb-16 shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
              <span className="ml-3 text-[10px] text-gray-400 font-mono">POST /api/invoices</span>
            </div>
            <pre className="p-6 text-sm font-mono text-gray-300 overflow-x-auto leading-loose">
<span className="text-purple-400">const</span> res = <span className="text-purple-400">await</span> <span className="text-blue-300">fetch</span>(<span className="text-green-300">"https://paymateagent.xyz/api/invoices"</span>, {'{'}
  <span className="text-orange-300">method</span>: <span className="text-green-300">"POST"</span>,
  <span className="text-orange-300">body</span>: <span className="text-yellow-200">JSON</span>.<span className="text-blue-300">stringify</span>({'{'}
    <span className="text-orange-300">freelancer</span>: <span className="text-green-300">"0xYourWallet"</span>,
    <span className="text-orange-300">client</span>: <span className="text-green-300">"0xClientWallet"</span>,
    <span className="text-orange-300">amountUsd</span>: <span className="text-yellow-300">2500</span>,
    <span className="text-orange-300">description</span>: <span className="text-green-300">"Built the AI Trading Bot"</span>
  {'}'})
{'}'});
<span className="text-purple-400">const</span> {'{'} payUrl {'}'} = <span className="text-purple-400">await</span> res.<span className="text-blue-300">json</span>();
            </pre>
          </div>

          {/* AI Drafting & Voice */}
          <h2 id="ai-drafting" className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight mb-4">AI Voice Agent & Drafting</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            PayMate features "Cat," a fully integrated AI Voice Assistant powered by Gemini 2.5 Flash. You can literally speak to create an invoice ("Cat, make a $500 invoice for logo design"). The AI automatically structures the deliverables, sets payment terms, and extracts the client address. Alternatively, use the natural language text drafter in the dashboard.
          </p>

          {/* Cross-chain ClawUp */}
          <h2 id="cross-chain" className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight mb-4">Cross-Chain Payments (Powered by ClawUp)</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            PayMate natively supports <strong>13+ blockchain networks</strong> using ClawUp infrastructure. A client can pay your USDC invoice using native tokens from Ethereum, Base, Arbitrum, Optimism, BSC, Polygon, Avalanche, zkSync, Linea, Scroll, Blast, Fantom, or Celo.
          </p>
          <p className="text-gray-600 leading-relaxed mb-16">
            The system queries live decentralized price oracles to calculate the exact native token equivalent required, verifies the transaction on the source chain, and settles the invoice instantly.
          </p>

          {/* x402 Streaming */}
          <h2 id="x402" className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight mb-4">x402 Protocol & Paywalls</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            PayMate implements the <strong>x402 M2M payment protocol</strong>. You can paywall any API endpoint or content. When an agent requests a protected resource, PayMate responds with an <code className="px-2 py-1 bg-black/5 rounded text-sm text-black">HTTP 402 Payment Required</code> header containing the exact USDC quote on GOAT Network. Once paid, the client passes a <code className="px-2 py-1 bg-black/5 rounded text-sm text-black">PAYMENT-SIGNATURE</code> to unlock the resource.
          </p>

          {/* Autonomous Escrow */}
          <h2 id="escrow" className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight mb-4">Autonomous Git Escrow & AI Arbitration</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            For trustless B2B work, PayMate offers smart-contract escrow tied directly to DevOps.
          </p>
          <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
            <li><strong>Git Webhooks:</strong> Attach a GitHub PR to an invoice. The client funds the escrow. The exact millisecond the PR is merged, the PayMate backend triggers the smart contract to release funds.</li>
            <li><strong>AI Arbitration:</strong> If a dispute arises, PayMate acts as an impartial AI Arbitrator (powered by Mistral/Gemini). It analyzes chat history and deliverables to enforce an on-chain verdict (Pay Freelancer, Refund Client, or Split 50/50).</li>
          </ul>

          {/* ERC-8004 Reputation */}
          <h2 id="reputation" className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight mb-4">ERC-8004 Portable Reputation</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            Every successful payment builds your on-chain reputation. PayMate mints <strong>ERC-8004 "Proof of Job"</strong> tokens directly to your wallet on the GOAT Network. This acts as an immutable, portable trust score that you can carry to any other platform in the agent economy.
          </p>

          {/* ZK Shielded */}
          <h2 id="zk" className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight mb-4">ZK Shielded Privacy</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            For enterprise privacy, agents can create shielded invoices. The invoice data (amount, title, description) is encrypted on the client side. PayMate only stores the cryptographic hash. When settled, it mints a "Shielded Job" reputation token on GOAT Network without leaking economic data.
          </p>
          
        </main>
      </div>

    </div>
  );
}
