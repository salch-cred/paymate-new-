# PayMate — The Billing Rail for the OpenClaw Economy

> **Non-custodial USDC invoicing and x402 pay-per-use agent billing, settled on GOAT Network — with portable ERC-8004 reputation for every payment.**

PayMate is the payment layer AI agents have been missing. Freelancers, DAOs, and autonomous agents create invoices and per-use payment links, clients settle in real USDC directly on GOAT mainnet, and every payment mints a portable on-chain reputation credential. No custody, no API-key gatekeeping, no "trust me bro" — just verifiable, instant settlement.

**Live:** [paymateagent.xyz](https://www.paymateagent.xyz) · **Docs:** [paymateagent.xyz/docs](https://www.paymateagent.xyz/docs) · **Developer portal:** [paymateagent.xyz/developers](https://www.paymateagent.xyz/developers)

---

## Why this exists

Agents can chat, code, and research — but they can't collect money. Invoices are PDFs, chasing is manual, and there is no rail for autonomous, per-use micropayments. Freelancers have no portable proof of completed work.

PayMate fixes both sides of the loop:
- **Agents monetize themselves** — one-line x402 paywall on any endpoint, settled per call in USDC with zero human in the loop.
- **Clients pay with proof** — instant, non-custodial settlement on-chain, with a cryptographically verifiable receipt and a reputation credential that follows the freelancer, not the platform.

## Feature map

**Core payments**
- Non-custodial USDC invoices settled on GOAT mainnet — client pays directly to the freelancer's wallet
- Live PDF receipts and real-time webhooks (Discord/Slack) on every payment
- AI smart drafting: describe the work in a sentence → structured, priced invoice
- GitHub PR pricing: paste a PR, PayMate reads the actual diff and prices the work from real commits

**Agent-native (the differentiator)**
- **x402 pay-per-use** — HTTP 402 challenge → USDC settlement → replay-guarded unlock, implemented across invoices, marketplace plugins, and the billing API
- **Agent Billing API** — `POST /api/agent-billing` lets any OpenClaw/ClawUp team monetize an agent in one line; per-call usage metering
- **OpenClaw skill** — `openclaw skill install https://paymateagent.xyz/openclaw-skill.json`, then call `generate_invoice` and hand the client a live settlement link (or the Telegram Mini App link when the client is on Telegram)
- Voice AI agent for hands-free invoicing; Telegram natural-language invoicing; Discord slash-command billing
- **Telegram Mini App** (`/tg`) — open any invoice inside Telegram and pay **on-chain USDC on GOAT Network** through the standard web checkout

**Cross-chain**
- ClawUp checkout: clients pay from **39 networks** (Ethereum, Base, Arbitrum, BNB, Polygon, Avalanche, GOAT, Robinhood…) — value is cryptographically verified on the source chain before settling on GOAT
- ClawUp platform intent adapter (`/api/clawup/intent`) for autonomous invoice creation and payment

**Trust & reputation**
- **ERC-8004 portable reputation** — every settlement mints a soulbound credential (completed jobs, total earnings) that travels with the agent across platforms
- **AI dispute arbitration** — Mistral-powered arbitrator reviews disputes against the original scope and renders binding resolutions (PAY_FREELANCER / REFUND_CLIENT / SPLIT_50_50)
- **GitHub escrow** — client locks USDC in the escrow contract; the moment the PR merges, funds release on-chain to the freelancer; AI verdicts actually move funds
- ZK-shielded invoices for private billing

**Marketplace & economy**
- Plugin marketplace (10 categories) with per-use pricing — plugin developers earn **80% royalties** per use
- Treasury + yield escrow; recurring/streaming billing; economy leaderboard and live growth dashboard

## Live on GOAT mainnet

Not a prototype — a product with real on-chain settlements:

- Real USDC settlements on GOAT mainnet with verifiable tx hashes (e.g. `CROSSCHAIN_1_0xf564…` on GOAT Explorer)
- 10 invoices created, 4 settled on-chain, 3 unique freelancers, 5 unique clients — tracked live, no fabricated numbers
- **Live dashboard:** [paymateagent.xyz/growth](https://www.paymateagent.xyz/growth) (reads `/api/growth` automatically)
- **Treasury:** [paymateagent.xyz/treasury](https://www.paymateagent.xyz/treasury)
- Settlement flow: invoice → one-click wallet connect → direct USDC transfer → on-chain verification → ERC-8004 reputation mint → PAID

## Architecture

| Layer | Choice |
|---|---|
| Frontend / API | Next.js 14 (App Router), API routes under `web/src/app/api` |
| Wallet & auth | Privy (embedded, gasless Web3 onboarding) |
| Settlement chain | GOAT Network (mainnet, chain 2345) — real USDC |
| Payment protocol | x402 (HTTP 402 → USDC → replay-guarded unlock) |
| Reputation | ERC-8004 credential minted on GOAT |
| Smart contracts | Hardhat — `Reputation`, `YieldEscrow`, `Treasury` (see `contracts/`) |
| AI | Mistral (dispute arbitration, drafting, sybil-guard); natural-language interfaces (Telegram, voice, Discord) |
| Styling | Vanilla CSS — hyper-premium animated glassmorphism |

## Repo layout

```
web/         Next.js app — dashboard, pay pages, docs, and all /api routes
contracts/   Hardhat — PayMateReputation, YieldEscrow, PayMateTreasury, TestUSDC
scripts/     simulation + demo tooling (real EIP-712 invoices and settlements)
```

## Run locally

```bash
cd web
npm install
npm run dev
```

Environment: copy `web/.env.example` and set the GOAT RPC, wallet, and USDC variables (see `STAGE2-GAME-PLAN.md` for the full production checklist). Deploy contracts with `cd contracts && npx hardhat run scripts/deploy.ts --network goat`.

---

*Built for the OpenClaw Summer Builder Bootcamp · settled on GOAT Network.*
