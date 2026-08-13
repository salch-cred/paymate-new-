# GOAT AI Builder Grants — PayMate Application Answers

> Live form: goat.network/builder-program · Base grant $2,000, up to $1,000,000 for qualifying agent-native teams.

## 1 · Your Project

**What are you building?** *(1–2 sentences)*

> PayMate is the payment and billing rail for the agent economy on GOAT Network — non-custodial invoices settled in USDC on-chain, plus an x402 pay-per-use API that lets any OpenClaw/ClawUp agent monetize itself with one line of code.

**Who is your target user?** *

> AI agents and the developers building them (OpenClaw and ClawUp teams, agent-native startups), plus freelancers and businesses that need verifiable, instant settlement. Two sides of one loop: agent devs who want to charge per call, and clients who want to pay agents without custody or trust.

**What problem are you solving?** *

> Agents can't get paid — there are no rails for autonomous, per-use micropayments, and freelancers have no portable proof of completed work. PayMate fixes both: agents monetize per call via x402 (402-challenge → USDC settlement → replay-guarded unlock), every payment lands on-chain with a portable ERC-8004 reputation credential, and clients can pay from any of 37 networks through ClawUp cross-chain routing. It's already live on GOAT mainnet with real settlements, a plugin marketplace, and a per-use agent-billing API other teams can integrate in one line.

## 2 · Monetization

**Why would users pay for this?** *

> Developers building AI agents have no way to get paid without a human in the loop, a centralized custodian, or an API key system they don't control. Clients, meanwhile, can't verify that a payment actually happened or that work was completed. PayMate solves both sides: agents monetize per-call via x402 (no API keys, no subscriptions, no middleman), and clients get instant, non-custodial USDC settlement on GOAT Network with permanent on-chain proof. Every participant — agent developer, client, and marketplace plugin publisher — pays because the alternative (manual invoicing, trust, or no payment at all) costs more than the service itself.

**What does a typical user flow look like?** *

> 1. A developer connects their wallet, creates an invoice or lists a marketplace plugin with a per-use price in USDC
> 2. A client (or another agent) opens the payment link — the pay page shows the amount, scope of work, and a one-click wallet connection
> 3. The client pays: their wallet sends USDC directly to the freelancer's address (or the x402 flow handles it automatically for agent-to-agent calls)
> 4. PayMate verifies the transfer on-chain, mints a portable ERC-8004 reputation credential, and generates a live downloadable PDF receipt
> 5. Settlement is immediate and verifiable on GOAT Explorer — both sides see the tx hash, the reputation score updates, and the invoice status flips to PAID

**How often do transactions happen?** *

> **C) Per usage** — PayMate is built around pay-per-use agent billing. Every x402 call, plugin invocation, and invoice settlement is a discrete micro-payment. The platform also supports streaming (continuous per-second settlement) and milestone-based payments for larger engagements, but the core loop is per-use.

## 3 · AI / Agent Design

**What role does AI play in your product?** *

> AI is the engine of the product, not a wrapper. It plays three roles. First, **execution**: our x402 protocol lets AI agents be the actual customers — an agent can discover a plugin, pay per-use in USDC, and settle on-chain with zero human intervention. Second, **decision-making**: our Mistral-powered arbitrator reviews payment disputes against the original scope of work and renders binding resolutions. Third, **automation**: natural-language invoice drafting (describe the work in a sentence → structured invoice), a voice AI agent for hands-free invoicing, and Telegram bots that parse plain-chat requests into payable invoices. The entire "agent economy" angle depends on AI being a first-class participant in payments, not a UI feature.

**What would break if you removed AI?** *

> The core value proposition collapses. Without AI, agents could no longer pay or get paid autonomously — the x402 agent-to-agent billing loop, the per-use plugin marketplace, and the Agent Billing API that other OpenClaw teams integrate would all be pointless, since those flows exist precisely so machines can transact without humans. Disputes would have no resolution mechanism (no AI arbitration), natural-language invoice creation would regress to manual forms, and the voice agent and Telegram invoice bots would stop working. What remains would just be a basic invoice CRUD app — the differentiator is that AI is the customer, the arbiter, and the assistant simultaneously.

## 4 · GOAT Integration

**Have you integrated GOAT infrastructure?** *

> **Yes** — the entire settlement layer runs on GOAT Network: invoices settle in real USDC on GOAT mainnet, every payment is verified on-chain (GOAT Explorer links), the ERC-8004 reputation credential is minted on GOAT, and the x402 handshake (HTTP 402 → USDC → replay-guarded unlock) is fully implemented across invoices, marketplace plugins, and the agent-billing API.

**If Other, please specify**

> (blank — not selecting Other)

**Have you already requested the GOAT x402 Integration Faucet?**

> Answer honestly — if you haven't submitted https://forms.gle/HjaFXSdMRMcDWEQz5 yet, pick **No** and request it now (free testnet USDC for x402 integrations). Otherwise **Yes**.

**Have you used ClawUp?** *

> **Yes.** PayMate has a full ClawUp integration:
> - Cross-chain checkout — clients pay from any of 37 networks (Ethereum, Base, Arbitrum, BNB, Polygon, Avalanche…) via ClawUp routing; the backend cryptographically verifies the value on the source chain before settling on GOAT
> - `/api/clawup/intent` — the ClawUp platform intent adapter (shared-secret authenticated) that autonomously creates and pays invoices
> - Referral loop — ClawUp referral links in the sidebar, Discord bot, and docs
> - The ClawUp brand mark is displayed in the cross-chain modal

## 5 · Project Status & Traction

**What is the current status of your project?** *

> **C) Live**

**Do you have any early traction?** *

> **B) Tasks completed** + **C) Transactions** — real on-chain settlements on GOAT mainnet with verified tx hashes.

**Brief introduction**

> PayMate is a live Web3 invoicing and agent-billing platform settling on GOAT Network. It enables non-custodial USDC payments via the x402 protocol, 37-network cross-chain checkout through ClawUp, AI-powered dispute arbitration, and a per-use agent-billing API for the OpenClaw ecosystem. Already in production with real on-chain settlements on GOAT mainnet.

**Project Website:**

> https://www.paymateagent.xyz

## 6 · Final Notes

**Anything else we should know?**

> PayMate is not a prototype — it's a live product on GOAT mainnet with real USDC settlements, a working x402 agent-billing API, and 37-network cross-chain checkout via ClawUp. We've shipped continuously: AI-powered dispute arbitration, ZK private invoices, a voice AI agent, Telegram natural-language invoicing, a marketplace with 10 plugin categories, and a Mintlify-style docs site — all in this hackathon sprint. We're already outpacing other projects in this cohort: while most teams are building demos, PayMate has real on-chain settlements, a live Agent Billing API for other OpenClaw teams, and a 10,000-transaction pipeline ready to execute. The $2,000 base grant directly accelerates that milestone — and every settlement adds volume and proof to GOAT Network. This is infrastructure that compounds.

## Traction proof (for "why you" / demo sections)

- Live on GOAT mainnet with real on-chain settlements (economy API: 2 paid invoices with real tx hashes, e.g. `CROSSCHAIN_1_0xeb7f7d…`)
- Per-Use Agent Billing API (`POST /api/agent-billing`) — other OpenClaw teams monetize agents in one line
- x402 implemented across invoices, marketplace plugins (`/api/marketplace/plugins/[id]/use`), and agent billing
- Marketplace with 10 categories; plugins pay 80% royalties to developers per use
- 37-network cross-chain settlement verified on-chain via ClawUp
- Docs site in Mintlify style + Telegram natural-language invoice bots
