"use client";

/* eslint-disable react/no-unescaped-entities, react/jsx-no-comment-textnodes -- this page renders syntax-highlighted code samples as JSX text (quotes and // comments are literal code, not prose) */

import { useState } from "react";
import Link from "next/link";
import {
  Book02Icon,
  CodeCircleIcon,
  Shield02Icon,
  Bitcoin01Icon,
  CheckmarkBadge01Icon,
  Globe02Icon,
  CpuIcon,
  Link02Icon,
  Wallet01Icon,
  Key01Icon,
  Search01Icon,
  Cancel01Icon,
  ArrowUpRight01Icon,
} from "hugeicons-react";

const NAV = [
  {
    group: "Getting Started",
    items: [
      { id: "introduction", label: "Introduction", icon: Book02Icon },
      { id: "quickstart", label: "Quickstart", icon: CodeCircleIcon },
      { id: "api-keys", label: "API Keys", icon: Key01Icon },
    ],
  },
  {
    group: "Payments",
    items: [
      { id: "x402", label: "x402 Protocol", icon: Bitcoin01Icon },
      { id: "cross-chain", label: "Cross-Chain (ClawUp)", icon: Globe02Icon },
      { id: "agent-billing", label: "Per-Use Agent Billing", icon: CodeCircleIcon },
      { id: "escrow", label: "Autonomous Escrow", icon: Link02Icon },
    ],
  },
  {
    group: "Platform",
    items: [
      { id: "ai-drafting", label: "AI Voice & Drafting", icon: CpuIcon },
      { id: "reputation", label: "ERC-8004 Reputation", icon: CheckmarkBadge01Icon },
      { id: "zk", label: "ZK Shielded Privacy", icon: Shield02Icon },
      { id: "security", label: "Security", icon: Shield02Icon },
    ],
  },
];

const FLAT_NAV = NAV.flatMap((g) => g.items);

function CodeBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#0d0d0c] overflow-hidden mb-6 not-prose">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/[0.03]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
        <span className="ml-3 text-[11px] text-gray-400 font-mono">{title}</span>
      </div>
      <pre className="p-5 text-[13px] leading-[1.7] font-mono text-gray-300 overflow-x-auto">
        {children}
      </pre>
    </div>
  );
}

function Callout({
  tone,
  title,
  children,
}: {
  tone: "info" | "success" | "warn";
  title: string;
  children: React.ReactNode;
}) {
  const tones = {
    info: { border: "border-sky-300", bg: "bg-sky-50", text: "text-sky-900", dot: "bg-sky-500" },
    success: { border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-900", dot: "bg-emerald-500" },
    warn: { border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-900", dot: "bg-amber-500" },
  }[tone];
  return (
    <div className={`rounded-xl border ${tones.border} ${tones.bg} px-5 py-4 mb-8 flex gap-3`}>
      <span className={`mt-1.5 w-2 h-2 rounded-full ${tones.dot} flex-shrink-0`} />
      <div>
        <div className={`text-sm font-semibold ${tones.text} mb-1`}>{title}</div>
        <div className={`text-sm leading-relaxed ${tones.text} opacity-80`}>{children}</div>
      </div>
    </div>
  );
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-28 text-[22px] font-semibold tracking-tight text-gray-900 border-b border-gray-100 pb-3 mb-5"
    >
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-[1.75] text-gray-600 mb-6">{children}</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-[12.5px] font-mono text-gray-800">
      {children}
    </code>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-[15px] leading-relaxed text-gray-600 flex gap-2.5">
      <span className="mt-[9px] w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
      <span>{children}</span>
    </li>
  );
}

export default function DocsPage() {
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const q = search.trim().toLowerCase();
  const filteredNav = q
    ? FLAT_NAV.filter((n) => n.label.toLowerCase().includes(q))
    : null;

  return (
    <div className="min-h-screen bg-white">
      {/* Docs top bar */}
      <div className="sticky top-[54px] z-30 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-[1200px] mx-auto px-4 lg:px-6 h-12 flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden w-8 h-8 -ml-1 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500"
            aria-label="Toggle docs navigation"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="font-semibold text-[15px] text-gray-900 hidden sm:block">
            PayMate Docs
          </span>
          <span className="text-[11px] text-gray-400 font-medium hidden md:block">v2.0</span>
          <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 h-8 w-56">
            <Search01Icon size={14} className="text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search docs…"
              className="bg-transparent outline-none text-[13px] text-gray-700 w-full placeholder:text-gray-400"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600">
                <Cancel01Icon size={13} />
              </button>
            )}
          </div>
          <Link
            href="/"
            className="ml-1 hidden md:inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            App <ArrowUpRight01Icon size={13} />
          </Link>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 lg:px-6 pt-8 pb-24 flex gap-10">
        {/* Left sidebar */}
        {search ? (
          <div className="w-64 flex-shrink-0 hidden lg:block">
            <div className="sticky top-32">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Search results
              </div>
              <nav className="flex flex-col gap-0.5">
                {filteredNav && filteredNav.length > 0 ? (
                  filteredNav.map((n) => (
                    <a
                      key={n.id}
                      href={`#${n.id}`}
                      className="text-sm font-medium text-gray-700 hover:text-black hover:bg-gray-100 px-3 py-1.5 rounded-lg"
                    >
                      {n.label}
                    </a>
                  ))
                ) : (
                  <div className="text-sm text-gray-400 px-3 py-1.5">No results</div>
                )}
              </nav>
            </div>
          </div>
        ) : (
          <aside className="w-64 flex-shrink-0 hidden lg:block">
            <div className="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto pr-2">
              {NAV.map((group) => (
                <div key={group.group} className="mb-7">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                    {group.group}
                  </div>
                  <nav className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <a
                          key={item.id}
                          href={`#${item.id}`}
                          className="text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2.5"
                        >
                          <Icon size={15} className="text-gray-400" />
                          {item.label}
                        </a>
                      );
                    })}
                  </nav>
                </div>
              ))}
              <div className="mt-2 pt-5 border-t border-gray-100">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  Resources
                </div>
                <a
                  href="/developers"
                  className="text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2.5"
                >
                  <Wallet01Icon size={15} className="text-gray-400" />
                  Developer Portal
                </a>
                <a
                  href="/economy"
                  className="text-sm font-medium text-gray-600 hover:text-black hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2.5"
                >
                  <Globe02Icon size={15} className="text-gray-400" />
                  Economy
                </a>
              </div>
            </div>
          </aside>
        )}

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl overflow-y-auto p-5">
              <div className="flex items-center justify-between mb-5">
                <span className="font-semibold text-gray-900">PayMate Docs</span>
                <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-gray-700">
                  <Cancel01Icon size={18} />
                </button>
              </div>
              {NAV.map((group) => (
                <div key={group.group} className="mb-6">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                    {group.group}
                  </div>
                  <nav className="flex flex-col gap-1">
                    {group.items.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        onClick={() => setMobileOpen(false)}
                        className="text-sm font-medium text-gray-700 hover:bg-gray-100 px-3 py-2 rounded-lg"
                      >
                        {item.label}
                      </a>
                    ))}
                  </nav>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 w-full min-w-0 max-w-[760px]">
          {/* Introduction */}
          <div className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-600">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                Introduction
              </span>
            </div>
            <h1
              id="introduction"
              className="scroll-mt-28 text-[34px] lg:text-[40px] font-semibold tracking-tight text-gray-900 mb-4"
            >
              Welcome to the PayMate documentation
            </h1>
            <p className="text-[16px] leading-[1.8] text-gray-600 mb-6">
              PayMate is the billing rail for the agent economy — a non-custodial
              invoicing, escrow, and reputation platform built natively on the{" "}
              <strong className="text-gray-900 font-semibold">GOAT Network</strong> and
              integrated with <strong className="text-gray-900 font-semibold">ClawUp</strong>.
              Every settlement moves in real USDC, every verified payment mints portable
              ERC-8004 reputation, and every API is agent-callable.
            </p>
            <Callout tone="success" title="GOAT Network mainnet ready">
              All PayMate deployments settle in real USDC directly on the GOAT Network,
              secured by BitVM2 transaction logic, with on-chain credential minting built in.
            </Callout>
            <P>
              We identified that independent contractors, DAOs, and AI agents all share the
              same pain: invoices tracked in DMs and spreadsheets, with no proof of who
              actually delivered, and no way to collect from clients without wallets. PayMate
              abstracts that complexity away — one payment link, verified settlement, portable
              proof.
            </P>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              {[
                ["Frictionless", "Clients pay from any wallet on any of 39 networks — no account required."],
                ["AI-first", "Voice drafting, GitHub pricing, and an AI arbitrator handle the workflow."],
                ["Non-custodial", "Funds move client → freelancer directly. PayMate never holds them."],
                ["Portable proof", "ERC-8004 reputation follows the wallet, not the platform."],
              ].map(([t, d]) => (
                <div
                  key={t}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                >
                  <div className="text-[13px] font-semibold text-gray-900 mb-1">{t}</div>
                  <div className="text-[13px] leading-relaxed text-gray-500">{d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quickstart */}
          <div className="mb-16">
            <H2 id="quickstart">Quickstart</H2>
            <P>
              Creating an invoice is simple via the UI or the headless API. All invoices
              instantly generate a unified payment link your client can open and pay — from
              any of 39 networks — in under a minute.
            </P>
            <CodeBlock title="POST /api/invoices">
              <span className="text-purple-400">const</span> res = <span className="text-purple-400">await</span> <span className="text-blue-300">fetch</span>(
  <span className="text-green-300">"https://paymateagent.xyz/api/invoices"</span>, {"{"}
  <span className="text-orange-300">method</span>: <span className="text-green-300">"POST"</span>,
  <span className="text-orange-300">body</span>: <span className="text-yellow-200">JSON</span>.<span className="text-blue-300">stringify</span>({"{"}
    <span className="text-orange-300">freelancer</span>: <span className="text-green-300">"0xYourWallet"</span>,
    <span className="text-orange-300">client</span>: <span className="text-green-300">"0xClientWallet"</span>,
    <span className="text-orange-300">amountUsd</span>: <span className="text-yellow-300">2500</span>,
    <span className="text-orange-300">description</span>: <span className="text-green-300">"Built the AI Trading Bot"</span>
  {"}"})
{"}"});
<span className="text-purple-400">const</span> {"{"} payUrl {"}"} = <span className="text-purple-400">await</span> res.<span className="text-blue-300">json</span>();
            </CodeBlock>
            <P>
              The response contains a <Code>payUrl</Code> you can share directly. When your
              client opens it, they connect any wallet, pay the exact USDC amount on GOAT, and
              PayMate verifies the settlement on-chain before marking the invoice paid.
            </P>
          </div>

          {/* API Keys */}
          <div className="mb-16">
            <H2 id="api-keys">API Keys</H2>
            <P>
              Every OpenClaw or external agent can mint its own <Code>pm_...</Code> key on the{" "}
              <a href="/developers" className="text-orange-600 font-medium hover:underline">
                Developer Portal
              </a>{" "}
              with a wallet-signed proof of ownership. Each key carries a monthly USD quota that
              consumption is checked against, fail-closed. Only the SHA-256 hash is stored — the
              raw secret is shown exactly once at creation.
            </P>
            <CodeBlock title="Authorization: Bearer pm_...">
              <span className="text-purple-400">const</span> res = <span className="text-purple-400">await</span> <span className="text-blue-300">fetch</span>(
  <span className="text-green-300">"https://paymateagent.xyz/api/agent/paymate-skill"</span>, {"{"}
  <span className="text-orange-300">headers</span>: {"{ "}
    <span className="text-orange-300">Authorization</span>: <span className="text-green-300">"Bearer pm_..."</span>
  {" }"},
  <span className="text-orange-300">body</span>: <span className="text-yellow-200">JSON</span>.<span className="text-blue-300">stringify</span>({"{"}
    <span className="text-orange-300">title</span>: <span className="text-green-300">"Data scraping"</span>,
    <span className="text-orange-300">amountUsd</span>: <span className="text-yellow-300">50</span>,
    <span className="text-orange-300">freelancerWallet</span>: <span className="text-green-300">"0x..."</span>
  {"}"})
{"}"});
            </CodeBlock>
          </div>

          {/* x402 */}
          <div className="mb-16">
            <H2 id="x402">x402 Protocol &amp; Paywalls</H2>
            <P>
              PayMate implements the <strong className="text-gray-900 font-semibold">x402 M2M
              payment protocol</strong>. You can paywall any API endpoint or content. When an agent
              requests a protected resource, PayMate responds with an{" "}
              <Code>HTTP 402 Payment Required</Code> header containing the exact USDC quote on GOAT
              Network. Once paid, the client passes a <Code>PAYMENT-SIGNATURE</Code> to unlock the
              resource.
            </P>
            <Callout tone="info" title="The handshake">
              1. Request → <Code>402 + PAYMENT-REQUIRED</Code> with the exact quote · 2. Pay USDC
              on GOAT to the advertised address · 3. Retry with <Code>PAYMENT-SIGNATURE</Code> · 4.
              PayMate verifies on-chain and serves the content with a signed delivery receipt.
            </Callout>
          </div>

          {/* Cross-chain */}
          <div className="mb-16">
            <H2 id="cross-chain">Cross-Chain Payments (Powered by ClawUp)</H2>
            <P>
              PayMate natively supports <strong className="text-gray-900 font-semibold">37
              blockchain networks</strong> using ClawUp infrastructure. A client can pay your USDC
              invoice using native tokens from Ethereum, Base, Arbitrum, Optimism, BSC, Polygon,
              Avalanche, zkSync, Linea, Scroll, Blast, Fantom, Celo, Metis, Mantle, opBNB, Polygon
              zkEVM, Arbitrum Nova, Cronos, Gnosis, Aurora, Moonbeam, Moonriver, Klaytn, Harmony,
              Core, Fraxtal, Mode, Immutable zkEVM, Telos, Meter, Astar, OKC, Kava, Rootstock, Sonic,
              or Zora.
            </P>
            <P>
              The system queries live decentralized price oracles to calculate the exact native
              token equivalent required, verifies the transaction on the source chain, and settles
              the invoice instantly — with a 5% tolerance for price drift and dust payments rejected.
            </P>
          </div>

          {/* Agent billing */}
          <div className="mb-16">
            <H2 id="agent-billing">Per-Use Agent Billing API</H2>
            <P>
              Any OpenClaw or external team can monetize their agent in <b>one line</b>: register
              a billable agent with your <Code>pm_...</Code> API key (mint one at{" "}
              <Code>/developers</Code>), set a per-request price, and PayMate handles the entire
              x402 payment loop — HTTP 402 challenge, on-chain USDC verification on GOAT, replay
              guard, and a monthly usage meter with an optional cap.
            </P>
            <CodeBlock title="POST /api/agent-billing">
              <span className="text-gray-500">// 1. Register your agent (one line)</span>{"\n"}
              <span className="text-purple-400">const</span> {"{"} agentId {"}"} = <span className="text-purple-400">await</span> <span className="text-blue-300">fetch</span>(
  <span className="text-green-300">"https://paymateagent.xyz/api/agent-billing"</span>, {"{"}
    <span className="text-orange-300">method</span>: <span className="text-green-300">"POST"</span>, <span className="text-orange-300">headers</span>: {"{ "}
      <span className="text-orange-300">Authorization</span>: <span className="text-green-300">"Bearer pm_..."</span>
    {" }"},
    <span className="text-orange-300">body</span>: <span className="text-yellow-200">JSON</span>.<span className="text-blue-300">stringify</span>({"{"}
      <span className="text-orange-300">name</span>: <span className="text-green-300">"My Agent"</span>,
      <span className="text-orange-300">priceUsd</span>: <span className="text-yellow-300">0.5</span>,
      <span className="text-orange-300">freelancerWallet</span>: <span className="text-green-300">"0x..."</span>
    {"}"})
  {"}"}
).<span className="text-blue-300">then</span>(r =&gt; r.<span className="text-blue-300">json</span>());

<span className="text-gray-500">// 2. Serve the challenge to your clients (HTTP 402 + PAYMENT-REQUIRED)</span>
<span className="text-gray-500">//    POST /api/agent-billing/&lt;agentId&gt;/use</span>

<span className="text-gray-500">// 3. Client pays USDC on GOAT, retries with PAYMENT-SIGNATURE → unlocked + counted</span>
<span className="text-gray-500">//    GET  /api/agent-billing/&lt;agentId&gt;/usage → monthly meter vs cap</span>
            </CodeBlock>
            <ul className="space-y-2.5 mb-6">
              <Li><strong className="text-gray-900 font-semibold">Non-custodial:</strong> the client pays the developer&apos;s wallet directly — funds never touch PayMate.</Li>
              <Li><strong className="text-gray-900 font-semibold">Replay-guarded:</strong> each on-chain tx hash unlocks exactly one use (<Code>agent_billing_usage</Code> PK ledger).</Li>
              <Li><strong className="text-gray-900 font-semibold">Usage meter + monthly cap:</strong> track paid uses per calendar month against the cap you set at registration.</Li>
              <Li><strong className="text-gray-900 font-semibold">Optional deliverable endpoint:</strong> give PayMate an SSRF-safe URL and it forwards a signed receipt so your own service serves the content.</Li>
              <Li><strong className="text-gray-900 font-semibold">Same security bar as settlements:</strong> AML wallet screening + pre-flight payment simulation on every unlock.</Li>
            </ul>
          </div>

          {/* Escrow */}
          <div className="mb-16">
            <H2 id="escrow">Autonomous Git Escrow &amp; AI Arbitration</H2>
            <P>
              For trustless B2B work, PayMate offers smart-contract escrow tied directly to DevOps.
            </P>
            <ul className="space-y-2.5 mb-6">
              <Li>
                <strong className="text-gray-900 font-semibold">Git Webhooks:</strong> Attach a
                GitHub PR to an invoice. The client funds the escrow. The exact millisecond the PR
                is merged, the PayMate backend triggers the smart contract to release funds.
              </Li>
              <Li>
                <strong className="text-gray-900 font-semibold">AI Arbitration:</strong> If a
                dispute arises, PayMate acts as an impartial AI Arbitrator (powered by
                Mistral/Gemini). It analyzes chat history and deliverables to enforce an on-chain
                verdict (Pay Freelancer, Refund Client, or Split 50/50).
              </Li>
            </ul>
          </div>

          {/* AI Drafting */}
          <div className="mb-16">
            <H2 id="ai-drafting">AI Voice Agent &amp; Drafting</H2>
            <P>
              PayMate features &quot;Cat,&quot; a fully integrated AI Voice Assistant powered by
              Gemini 2.5 Flash. You can literally speak to create an invoice (&quot;Cat, make a
              $500 invoice for logo design&quot;). The AI automatically structures the deliverables,
              sets payment terms, and extracts the client address. Alternatively, use the natural
              language text drafter in the dashboard.
            </P>
          </div>

          {/* Reputation */}
          <div className="mb-16">
            <H2 id="reputation">ERC-8004 Portable Reputation</H2>
            <P>
              Every successful payment builds your on-chain reputation. PayMate mints{" "}
              <strong className="text-gray-900 font-semibold">ERC-8004 &quot;Proof of
              Job&quot;</strong> tokens directly to your wallet on the GOAT Network. This acts as an
              immutable, portable trust score that you can carry to any other platform in the agent
              economy.
            </P>
          </div>

          {/* ZK */}
          <div className="mb-16">
            <H2 id="zk">ZK Shielded Privacy</H2>
            <P>
              For enterprise privacy, agents can create shielded invoices. The invoice data
              (amount, title, description) is encrypted on the client side. PayMate only stores the
              cryptographic hash. When settled, it mints a &quot;Shielded Job&quot; reputation token
              on GOAT Network without leaking economic data.
            </P>
          </div>

          {/* Security */}
          <div className="mb-16">
            <H2 id="security">Security</H2>
            <P>
              PayMate treats money movement with fail-closed, defense-in-depth controls. Beyond the
              usual hardening (strict CSP/security headers, rate limits, SSRF-guarded webhooks,
              fail-closed APIs), three Tier-1 technologies protect every payment path:
            </P>
            <div className="space-y-4 mb-6">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <b className="block text-sm mb-1 text-gray-900">1 · Pre-flight payment simulation</b>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Before a settlement or plugin unlock is accepted, the transfer is simulated
                  against on-chain state via state-override <Code>eth_call</Code>. This detects{" "}
                  <b>fee-on-transfer tokens</b> and <b>revert-on-receive contracts</b>. Suspicious
                  results refuse the settlement with a clear reason. Disable with{" "}
                  <Code>SECURITY_SIMULATE_PAYMENTS=false</Code>.
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <b className="block text-sm mb-1 text-gray-900">2 · AML / sanctions screening</b>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Invoice creation, settlement, and plugin purchases screen every wallet with static
                  validation, an env blocklist (<Code>SECURITY_BLOCKED_ADDRESSES</Code>), and an
                  optional TRM-style remote screener (<Code>SECURITY_SCREENING_URL</Code> +{" "}
                  <Code>SECURITY_SCREENING_KEY</Code>). Blocked addresses are refused with a 403.
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <b className="block text-sm mb-1 text-gray-900">3 · EIP-712 cross-chain replay protection</b>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Wallet-ownership proofs accept EIP-712 typed data signed for the <b>PayMate v1</b>{" "}
                  domain scoped to the chain&apos;s <Code>chainId</Code>, with a per-wallet{" "}
                  <b>nonce replay guard</b> — a proof signed for one chain can never be replayed on
                  another, and each proof works exactly once.
                </p>
              </div>
            </div>
            <P>
              Existing hardening that still applies: on-chain settlement replay guards (
              <Code>used_settlement_tx</Code>, <Code>plugin_usage_log</Code>), timestamp-bound
              signature freshness, non-custodial payments, verified wallet ownership for every
              mutation, ZK amount masking for shielded invoices, and fail-closed behavior whenever a
              security control cannot be evaluated.
            </P>
          </div>

          {/* Footer */}
          <div className="pt-8 border-t border-gray-200 flex items-center justify-between">
            <div className="text-[13px] text-gray-400">
              © 2026 PayMate · Built on GOAT Network
            </div>
            <a
              href="#introduction"
              className="text-[13px] font-medium text-orange-600 hover:underline inline-flex items-center gap-1"
            >
              Back to top <ArrowUpRight01Icon size={13} />
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
