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
- **Merchant Checkout** (`/merchant`, `POST /api/merchant/checkout`) — any business accepts USDC on GOAT with one API call + a copy-paste button; signed `checkout.paid` webhooks (HMAC `X-PayMate-Signature`) tell your backend to fulfil the order
- **Pay by invoice ID** (`/pay`) — a client with just the invoice number can type it into the PayMate web app and pay, no link or account required

**Cross-chain**
- **ClawUp cross-chain, in-app** — "Pay with Any Network (ClawUp Routing)" on the checkout: the client picks any of 39 networks, signs ONE transaction on their own chain, and the native token lands in PayMate's custody wallet — which then settles the same value as **USDC on GOAT** to the freelancer. Client never leaves the page. (Operator setup: `PRIVATE_KEY` = the custody wallet, funded with GOAT USDC; `USDC_IS_REAL_MAINNET_TOKEN=true`.)
- **Background custody relayer** (`/api/relayer/run`, Vercel cron `*/10 * * * *`) — watches the custody wallet on all 39 source networks for deposits and **auto-swaps the received native token to USDC via 1inch** in the private wallet, so incoming client payments convert automatically instead of accumulating as raw ETH/BNB. Idempotent ledger, dry-run mode (`RELAYER_DRY_RUN=true`), dust + gas-reserve guards, retries capped at 5 then left for manual review. (Setup: `CRON_SECRET` for the cron auth + `ONEINCH_API_KEY` — required, since 1inch's public v5 endpoint is deprecated.)
- **Relayer Operator Agent** (`/api/relayer/agent`, Vercel cron `*/15 * * * *`) — the AI operator for the custody stack: audits the relayer ledger, checks GOAT USDC liquidity against pending invoice demand (runway + CRITICAL flag), asks Mistral which failed swaps to retry, and **retries only those, clamped by hard caps** (`RELAYER_AGENT_MAX_ACTION_USD`, default $500/pass) — then posts a summary to Discord. Caps are enforced in code, so the AI can prioritize but never exceed authority; without `MISTRAL_API_KEY` it falls back to deterministic oldest-first retries. Dry-run (`RELAYER_AGENT_DRY_RUN=true` or `?dryRun=true`) audits + reports without touching the ledger.
- **GOAT bridge hop** (`lib/goatBridge.ts`, `scripts/goat_bridge_probe.ts`) — the recovered BSC→GOAT rail: bridges **DOGEB/BTCB from BNB Chain to GOAT** through the LayerZero OFTAdapters the official bridge frontend uses (GOAT mainnet EID 30361, peer confirmed on-chain). Ships **fail-closed behind `GOAT_BRIDGE_VERIFIED`** — quote is read-only anytime; `send` refuses to run until a small real-money probe (`--send`) succeeds, because the exact adapter call context still needs a live test.
- **GOAT DEX swap** (`lib/goatDex.ts`, `scripts/goat_dex_probe.ts`) — converts bridged **DOGEB → USDC.e on GOAT** through Oku's SwapRouter02 (router `0xaa52bB81…`, pool `0x186F458E…` DOGEB/USDC.e fee 3000, ~$65K live depth — all verified on-chain). Sizes `amountOutMinimum` from live pool state + configured slippage, approves the router, submits `exactInputSingle`. **Fail-closed behind `GOAT_DEX_VERIFIED`** — the same small-real-test gate as the bridge.
- **Self-refill loop** (`/api/relayer/self-refill`, Vercel cron `*/15 * * * *`) — the automatic pipeline that makes **BSC client payments literally refill the GOAT payout pool**: the relayer converts BSC deposits to **DOGEB** (`RELAYER_BSC_BRIDGE_TARGET=true`), this cron bridges BSC DOGEB → GOAT (gated), then DEX-swaps it to **USDC.e** on GOAT (gated) — so freelancers get paid from the client's own money, not just pre-funded liquidity. Every hop is ledgered in `self_refill_runs` (idempotent, no double-bridge/double-swap); dry-run mode audits balances + plans without submitting anything. **Activation:** run `scripts/goat_bridge_probe.ts --send` (few cents) → set `GOAT_BRIDGE_VERIFIED=true`; run `scripts/goat_dex_probe.ts --send` (few cents) → set `GOAT_DEX_VERIFIED=true`.
- **Direct-to-freelancer rail — ZERO CUSTODY** (`/api/pay/[id]/direct-plan` + `/api/pay/[id]/direct-verify`) — the client signs **3 txs on BSC** (1inch swap BNB→DOGEB, approve the LayerZero adapter, bridge send) and the DOGEB lands **straight in the freelancer's GOAT wallet** — PayMate never holds the principal, no pool, no pre-funding. Verification is on-chain (tx to the recovered adapter, `sendParam.to` == the freelancer, amount == the **exact DOGEB locked in the plan ledger at plan time** — no price-drift underpayment vector, replay-guarded by the `direct_payments` ledger, AML-screened). **Fee as conversion spread:** `/api/relayer/direct-convert` pulls the freelancer's DOGEB (one-time opt-in allowance), swaps the principal to USDC.e back to them on the GOAT DEX, and keeps the `PAYMATE_FEE_RATE` spread in custody.
- **Pivot hop — all-chains self-refill** (`/api/relayer/pivot`, Vercel cron `*/15 * * * *`) — moves custody's **source-chain USDC inventory → BNB@BSC via LI.Fi** (one signable tx per chain, verified live at **~0.26% total cost** on ETH/Base/Polygon/OP/Arbitrum; `toAmountMin` slippage-protected, exact-amount approval, gas-funded by the deposit itself), then swaps **BNB → DOGEB on BSC** keeping the self-refill bridge gas reserve. The existing self-refill cron then bridges to GOAT and DEX-swaps to USDC.e — so **client deposits on any supported chain literally refill the GOAT payout pool**, with zero PayMate pre-funding beyond a one-time few-cent gas seed. Ledgered in `pivot_runs` (idempotent, crash-safe), capped by `PIVOT_MAX_ACTION_USD`, dry-run audits first.
- ClawUp self-bridge (non-custodial alternative): bridge USDC from 30+ networks, BTC/native assets, or gas yourself, then pay the invoice on GOAT — funds never pass through PayMate
- ClawUp platform intent adapter (`/api/clawup/intent`) for autonomous invoice creation and payment

**Trust & reputation**
- **ERC-8004 portable reputation** — every settlement mints a soulbound credential (completed jobs, total earnings) that travels with the agent across platforms
- **AI dispute arbitration** — Mistral-powered arbitrator reviews disputes against the original scope and renders binding resolutions (PAY_FREELANCER / REFUND_CLIENT / SPLIT_50_50)
- **GitHub escrow** — client locks USDC in the escrow contract; the moment the PR merges, funds release on-chain to the freelancer; AI verdicts actually move funds
- ZK-shielded invoices for private billing

**Marketplace & economy**
- Plugin marketplace (10 categories) with per-use pricing — plugin developers earn **80% royalties** per use
- **Agent Services Market** (`/market`) — hire humans or agents for fixed-price work: funds lock in the on-chain escrow until delivery, the AI verifier scores deliverables, and the buyer's acceptance (or an AI verdict on a dispute) releases payment on-chain. A high-confidence AI pass **auto-releases** escrow (no signature); **deadline auto-enforcement** (`/api/orders/expire`, `*/30` cron) finds funded orders past their `deliveryDays` with no deliverable, auto-opens the AI dispute, and executes the refund/split on-chain — nothing delivered + no AI key = fail-closed `REFUND_CLIENT`
- Treasury + yield escrow; recurring/streaming billing; economy leaderboard, live growth dashboard, market-economy snapshot (`/api/market-economy`), and a public **Stage 2 growth metrics page** (`/metrics`) with target-vs-actual MET/NOT MET tracking against the locked baseline

## Live on GOAT mainnet

Not a prototype — a product with real on-chain settlements:

- Real USDC settlements on GOAT mainnet with verifiable tx hashes (e.g. `CROSSCHAIN_1_0xf564…` on GOAT Explorer)
- 10 invoices created, 4 settled on-chain, 3 unique freelancers, 5 unique clients — tracked live, no fabricated numbers
- **Live dashboard:** [paymateagent.xyz/growth](https://www.paymateagent.xyz/growth) (reads `/api/growth` automatically)
- **Treasury:** [paymateagent.xyz/treasury](https://www.paymateagent.xyz/treasury) — every settlement path (direct pay, paywall, escrow release, marketplace orders, arbitration) captures a platform fee into the global treasury at `PAYMATE_FEE_RATE` (default **1%**; set e.g. `0.005` for 0.5%). Tracked in Postgres until the on-chain treasury is wired.
- **Deployed contracts (GOAT mainnet, chain 2345):** YieldEscrow `0xEbe3BE16d7fd69268BcADdB6DB25C60dFff302e0` · PayMateReputation `0x48B9B6BB1C4Eb4b6911D05dfd3E87F8be8a67603` · PayMateTreasury `0x59C4c64DF838f23b8dA77A95c18BC3520D71e25B` — wire as `ESCROW_CONTRACT` / `REPUTATION_CONTRACT` / `TREASURY_CONTRACT`; verify with `npx tsx web/scripts/verify_contracts.ts` (11 on-chain checks)
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
