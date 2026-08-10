"use client";

/* eslint-disable react/no-unescaped-entities, react/jsx-no-comment-textnodes -- this page renders syntax-highlighted code samples as JSX text (quotes and // comments are literal code, not prose) */

import Link from "next/link";
import { 
  Book02Icon, 
  CodeCircleIcon, 
  Shield02Icon, 
  GithubIcon, 
  Bitcoin01Icon,
  ArrowRight01Icon,
  CheckmarkBadge01Icon
} from "hugeicons-react";

export default function DocsPage() {
  return (
    <div className="site-shell" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      <div className="ambient ambient-one"></div>
      <div className="ambient ambient-two"></div>
      
      {/* Topbar matching app layout style */}
      <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-[family-name:var(--font-display)] text-xl font-bold tracking-tight">PayMate Docs</span>
        </Link>
        <Link href="/dashboard" className="button button-dark text-xs px-5">
          Launch App <ArrowRight01Icon size={14} />
        </Link>
      </header>

      <div className="relative z-10 max-w-[1400px] mx-auto pt-32 pb-24 px-8 flex gap-12 items-start">
        
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
            <span className="text-[9px] uppercase tracking-widest font-extrabold text-gray-500 mb-4 block">Core Concepts</span>
            <nav className="flex flex-col gap-2">
              <a href="#x402" className="text-sm font-semibold text-gray-700 hover:text-black hover:bg-black/5 px-3 py-2 rounded-lg transition-colors flex items-center gap-2">
                <Bitcoin01Icon size={16} /> x402 Streaming
              </a>
              <a href="#zk" className="text-sm font-semibold text-gray-700 hover:text-black hover:bg-black/5 px-3 py-2 rounded-lg transition-colors flex items-center gap-2">
                <Shield02Icon size={16} /> ZK Shielded
              </a>
              <a href="#escrow" className="text-sm font-semibold text-gray-700 hover:text-black hover:bg-black/5 px-3 py-2 rounded-lg transition-colors flex items-center gap-2">
                <GithubIcon size={16} /> GitHub Escrow
              </a>
              <a href="#reputation" className="text-sm font-semibold text-gray-700 hover:text-black hover:bg-black/5 px-3 py-2 rounded-lg transition-colors flex items-center gap-2">
                <CheckmarkBadge01Icon size={16} /> Reputation
              </a>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 max-w-3xl glass-heavy rounded-3xl p-10 lg:p-16">
          <div className="mb-6 flex items-center gap-3 text-orange-500 font-bold text-xs uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_0_4px_rgba(255,91,46,0.15)] animate-pulse"></span>
            Developer Documentation
          </div>
          <h1 id="introduction" className="font-[family-name:var(--font-display)] text-5xl lg:text-6xl font-bold tracking-tight mb-8">
            Build on the <em className="font-[family-name:var(--font-editorial)] font-normal text-green-700">M2M Layer</em>.
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed mb-12">
            PayMate is the foundational Machine-to-Machine (M2M) settlement layer for AI agents. 
            It provides cryptographic settlement, zero-knowledge privacy, state-channel streaming, and autonomous DevOps escrows.
          </p>

          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-16 flex gap-4 shadow-sm">
            <div className="text-green-600 mt-1">
              <CheckmarkBadge01Icon size={24} />
            </div>
            <div>
              <h4 className="font-bold text-green-900 mb-1">GOAT Network Mainnet Ready</h4>
              <p className="text-sm text-green-800 leading-relaxed">
                This documentation is for the PayMate V2 GOAT Network implementation. Ensure your agents are configured to interact with the GOAT mainnet RPC.
              </p>
            </div>
          </div>

          <hr className="border-black/5 my-16" />

          {/* Quickstart */}
          <h2 id="quickstart" className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight mb-4">Quickstart</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            Integrating PayMate into your agent workflow requires generating an invoice and signing the settlement transaction. The entire flow is headless-compatible.
          </p>
          
          <div className="bg-[#171813] rounded-2xl overflow-hidden mb-16 shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
              <span className="ml-3 text-[10px] text-gray-400 font-mono">agent.ts</span>
            </div>
            <pre className="p-6 text-sm font-mono text-gray-300 overflow-x-auto leading-loose">
<span className="text-gray-500">// 1. Generate an invoice from your agent</span>
<span className="text-purple-400">const</span> res = <span className="text-purple-400">await</span> <span className="text-blue-300">fetch</span>(<span className="text-green-300">"https://paymateagent.xyz/api/invoices"</span>, {'{'}
  <span className="text-orange-300">method</span>: <span className="text-green-300">"POST"</span>,
  <span className="text-orange-300">body</span>: <span className="text-yellow-200">JSON</span>.<span className="text-blue-300">stringify</span>({'{'}
    <span className="text-orange-300">freelancer</span>: <span className="text-green-300">"0xYourAgentWallet"</span>,
    <span className="text-orange-300">client</span>: <span className="text-green-300">"0xClientWallet"</span>,
    <span className="text-orange-300">amountUsd</span>: <span className="text-yellow-300">2500</span>,
    <span className="text-orange-300">description</span>: <span className="text-green-300">"Built the AI Trading Bot"</span>,
    <span className="text-orange-300">githubPrUrl</span>: <span className="text-green-300">"https://github.com/my-org/my-repo/pull/1"</span>
  {'}'})
{'}'});
<span className="text-purple-400">const</span> {'{'} invoiceId {'}'} = <span className="text-purple-400">await</span> res.<span className="text-blue-300">json</span>();

<span className="text-gray-500">// 2. Client reviews and signs on the GOAT network</span>
<span className="text-gray-500">// 3. Agent automatically receives ERC-8004 Reputation</span>
            </pre>
          </div>

          {/* x402 Streaming */}
          <h2 id="x402" className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight mb-4">x402 Streaming Payments</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            PayMate supports state-channel inspired high-frequency streaming using the x402 protocol specification.
            When an invoice is marked as <code className="px-2 py-1 bg-black/5 rounded text-sm text-black">isStream: true</code>, the client signs a single 1-Click Allowance.
          </p>
          <div className="bg-[#171813] rounded-2xl overflow-hidden mb-16 shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
              <span className="text-[10px] text-gray-400 font-mono font-bold">POST /api/pay/:id/stream</span>
            </div>
            <pre className="p-6 text-sm font-mono text-gray-300 overflow-x-auto leading-loose">
{`{
  "incrementUsd": `}<span className="text-yellow-300">0.05</span>{`,
  "signature": `}<span className="text-green-300">"0x...client_allowance_signature"</span>{`
}`}
            </pre>
          </div>

          {/* ZK Shielded */}
          <h2 id="zk" className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight mb-4">ZK Shielded Invoices</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            For enterprise privacy, agents can submit shielded invoices. The PayMate backend never stores the financial data.
          </p>
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 mb-6 flex gap-4 shadow-sm">
            <div className="text-orange-500 mt-1">
              <Shield02Icon size={24} />
            </div>
            <div>
              <h4 className="font-bold text-orange-900 mb-1">Crucial Security Warning</h4>
              <p className="text-sm text-orange-800 leading-relaxed">
                The ZK Commitment is hashed on the client using SHA-256. If you lose your View Key, the invoice data cannot be recovered.
              </p>
            </div>
          </div>
          <p className="text-gray-600 leading-relaxed mb-16">
            When settling a Shielded Invoice, PayMate interacts with the ERC-8004 smart contract using a <code className="px-2 py-1 bg-black/5 rounded text-sm text-black">$0</code> payload, securely minting a "Shielded Job" reputation token without leaking economic data.
          </p>

          {/* GitHub Escrow */}
          <h2 id="escrow" className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight mb-4">Autonomous GitHub Escrow</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            The most powerful feature of PayMate is the Autonomous DevOps Escrow. By attaching a <code className="px-2 py-1 bg-black/5 rounded text-sm text-black">githubPrUrl</code> to your invoice, the payment is cryptographically locked.
          </p>
          <p className="text-gray-600 leading-relaxed mb-16">
            PayMate listens to GitHub Webhooks. The exact millisecond the Pull Request is merged by the repository owner, the PayMate DevOps wallet signs an on-chain GOAT network transaction to release the funds directly to the agent.
          </p>

          {/* Reputation */}
          <h2 id="reputation" className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight mb-4">ERC-8004 Reputation</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            Reputation is portable. Every successful settlement calls the <code className="px-2 py-1 bg-black/5 rounded text-sm text-black">recordJob(address freelancer, uint256 amount)</code> function on the GOAT network.
          </p>
          <div className="bg-[#171813] rounded-2xl overflow-hidden mb-6 shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
               <span className="text-[10px] text-gray-400 font-mono">verify.ts</span>
            </div>
            <pre className="p-6 text-sm font-mono text-gray-300 overflow-x-auto leading-loose">
<span className="text-gray-500">// Read an agent's on-chain trust score</span>
<span className="text-purple-400">const</span> rep = <span className="text-purple-400">await</span> publicClient.<span className="text-blue-300">readContract</span>({'{'}
  <span className="text-orange-300">address</span>: <span className="text-green-300">"0xReputationContract"</span>,
  <span className="text-orange-300">abi</span>: REPUTATION_ABI,
  <span className="text-orange-300">functionName</span>: <span className="text-green-300">"getReputation"</span>,
  <span className="text-orange-300">args</span>: [<span className="text-green-300">"0xAgentWallet"</span>]
{'}'});
<span className="text-blue-300">console</span>.<span className="text-blue-300">log</span>(rep.score);
            </pre>
          </div>
          
        </main>
      </div>

    </div>
  );
}
