# PayMate

**Money, proof, momentum.** A full-stack Web3 invoicing app for independent
work — send a payment link, get paid in USDC, and build a portable,
on-chain reputation with every settled job.

[![Live](https://img.shields.io/badge/live-web--omega--six--74.vercel.app-black?style=flat-square)](https://paymates.vercel.app)
[![Network](https://img.shields.io/badge/network-GOAT%20Testnet3-6C4CFF?style=flat-square)](https://explorer.testnet3.goat.network)
[![Framework](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![License](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)](#license)

**Live app:** [paymates.vercel.app](https://paymates.vercel.app)
· **Docs:** [/docs](https://paymates.vercel.app/docs)
· **Built for:** [GOAT Network Summer Bootcamp 2026](https://github.com/GOATNetwork/GOAT-Hackathon-2026)

---

## Why PayMate

Independent contractors doing crypto-paid work today track invoices in DMs
and spreadsheets, with no proof of who actually delivers. PayMate fixes
both problems in one flow: draft an invoice, share a link, get paid
directly to your wallet, and have every verified settlement recorded
on-chain as a portable reputation credential — no custodian, no platform
lock-in, no fake demo data.

## Features (V2 — The "Top 1 Finish" Protocol)

- **The AI Arbitrator (Smart Dispute Resolution)** — Replaces human customer support with an impartial Gemini 1.5 Pro agent. If a client and freelancer dispute a gig, the AI evaluates the evidence against the original contract and renders a binding verdict, autonomously triggering the `YieldEscrow.sol` contract to release funds to the rightful winner.
- **AI Sybil-Guard (Fraud Prevention)** — an AI middleware layer that analyzes every invoice before payment. If it detects a Sybil attack or wash-trading attempt to farm ERC-8004 reputation, the transaction is autonomously blocked.
- **Multi-Agent Negotiation Protocol** — an autonomous AI Agent that can negotiate service prices on behalf of a client directly against a freelancer's counter-offer, settling autonomously.
- **Yield-Bearing Escrow Invoices (DeFi)** — via `YieldEscrow.sol`, Net-30 invoice deposits are routed into GOAT Network yield protocols. Once verified, generated interest is split 50/50 between client and freelancer!
- **Telegram Mini-App Integration** — instantly generate invoices from Telegram group chats using the `@paymatebot` webhook, maximizing real user traction (GEO).
- **Intelligent invoice drafting** — describe the work in plain language; PayMate structures a reviewable draft (AI-assisted, with a deterministic no-key fallback).
- **Direct, non-custodial USDC settlement** on GOAT Testnet3, using the
  [x402](https://github.com/GOATNetwork/x402) payment protocol
- **Server-side settlement verification** — checks transaction status,
  token address, recipient, and amount before an invoice is marked paid
- **On-chain reputation** — an [ERC-8004](https://github.com/GOATNetwork/agentkit)-style
  registry records completed jobs and cumulative earnings per wallet
- **Live workspace** — outstanding balance, settlement rate, invoice
  activity, and trust score in one dashboard
- **Zero fake state** — no demo mode, mocked settlement, or simulated
  reputation; every number on screen comes from a real API call or a
  real transaction

## Screenshots

| Landing | Dashboard |
|---|---|
| ![Landing](screenshots/01-landing.png) | ![Dashboard](screenshots/02-dashboard-command-center.png) |

| Checkout | Docs |
|---|---|
| ![Payment](screenshots/03-payment.png) | ![Docs](screenshots/04-docs.png) |

## Architecture

```mermaid
flowchart LR
    subgraph Client
        A[Next.js App Router UI]
    end
    subgraph Server["Next.js API routes (same deploy)"]
        B[/invoices, /pay, /reputation/]
    end
    subgraph Chain["GOAT Testnet3 (chain id 48816)"]
        C[USDC-style ERC-20]
        D[PayMateReputation.sol]
    end

    A -- wagmi / viem --> C
    A -- fetch --> B
    B -- x402 402 challenge --> A
    B -- verify tx --> C
    B -- recordJob --> D
    A -- read reputation --> D
```

There's no separate backend process. `web/` is a single Next.js 16
deployment: the App Router UI *and* the `/api/**` route handlers that draft
invoices, issue x402 payment requirements, verify on-chain settlement, and
read/write reputation.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16, React 19 |
| Chain access | wagmi 3 + viem 2 (client), viem (server) |
| Backend | Next.js Route Handlers (`web/src/app/api/**`) |
| Storage | Postgres (Neon), via `@neondatabase/serverless` |
| Contracts | Solidity 0.8.24, Hardhat 3 |
| Network | GOAT Testnet3 — chain id `48816`, RPC `rpc.testnet3.goat.network` |
| Payments | x402 protocol, direct ERC-20 transfer |
| Reputation | ERC-8004-style on-chain registry |
| Deployment | Vercel, Git-connected for auto-deploy on push |

## Quick start

```bash
cd web
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

Visit `http://localhost:3000`. The frontend and API share one dev server —
there's nothing else to start.

### Environment variables (`web/.env.local`)

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Optional — enables AI-structured drafting (a deterministic parser is used when blank) |
| `RPC_GOAT_TESTNET` | GOAT Testnet3 RPC endpoint |
| `USDC_TOKEN` | Settlement token address on GOAT Testnet3 |
| `REPUTATION_CONTRACT` | Deployed `PayMateReputation` address |
| `PRIVATE_KEY` | Reputation contract issuer key (must match the deployer — `recordJob` is `onlyIssuer`) |
| `DATABASE_URL` | Postgres connection string for invoice storage |

## Smart contract

`contracts/contracts/PayMateReputation.sol` — a minimal ERC-8004-style
registry. The issuer records a job only after verified payment; anyone can
read a freelancer's completed jobs, total settled value, and score.

```solidity
function recordJob(address freelancer, uint256 amountUsd) external onlyIssuer
function getReputation(address freelancer) external view returns (Rep memory)
```

```bash
cd contracts
npm install
cp .env.example .env   # set RPC_GOAT_TESTNET + PRIVATE_KEY
npx hardhat run scripts/deploy.ts --network goatTestnet3
```

### ERC-8004 agent identity registration

`contracts/scripts/register-erc8004.ts` registers PayMate's agent identity
against the GOAT ERC-8004 registry. It's a dry run by default and only
broadcasts a transaction when `CONFIRM_REGISTER=yes` is set:

```bash
REGISTRY_CONTRACT=0x... AGENT_NAME=paymate AGENT_URI=https://... \
  npm run register:erc8004
```

## Project layout

```
web/         Next.js app — UI, API routes, Postgres storage
contracts/   Hardhat project — PayMateReputation.sol, deploy + registration scripts
```

## Status — GOAT Network Summer Bootcamp 2026

- [x] Stage 1: landing page + product live, deployed to GOAT Testnet3
- [ ] GitHub repo public — currently private; needs to be flipped in
      repo Settings before submission (Stage 1 requires it public)
- [x] `PayMateReputation` deployed on GOAT Testnet3 —
      [`0xc2072cc0007cA8fcB84bdA09cFE20014559285BD`](https://explorer.testnet3.goat.network/address/0xc2072cc0007cA8fcB84bdA09cFE20014559285BD)
- [x] Test settlement token (`TestUSDC`) deployed on GOAT Testnet3 —
      [`0xeF9Ea814f011289E28f1c87FE8E0C0F68Aa82446`](https://explorer.testnet3.goat.network/address/0xeF9Ea814f011289E28f1c87FE8E0C0F68Aa82446)
      (no official Circle USDC exists on this testnet yet)
- [ ] ERC-8004 agent identity registration — script ready and dry-run
      verified (`npm run register:erc8004` in `contracts/`, targets the
      real GOAT mainnet registry at
      [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://explorer.goat.network/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432)),
      only blocked on the deployer wallet having GOAT mainnet gas
      (currently 0)
- [ ] x402 merchant registration — blocked: requires creating a merchant
      account on the Merchant Portal (email/password + wallet signature)
      and manual GOAT team approval via Telegram; not something automatable
- [x] Persistent invoice storage — migrated from SQLite-on-serverless-disk
      (which didn't persist between requests) to Postgres on Neon
- [x] GEO discoverability — `llms.txt`, JSON-LD schema, and a quotable
      FAQ on `/docs` so AI assistants can parse and cite PayMate accurately
- [x] Seed-user feedback capture — real form on the dashboard and
      post-payment checkout, backed by Postgres
- [x] Live growth metrics — [`/growth`](https://paymates.vercel.app/growth)
      reads real invoice/feedback data, no fabricated numbers
- [x] Stage 8: "Top 1 Finish" Protocol integration — Multi-Agent Negotiation, Telegram Bot webhook, and Yield-Bearing Escrow contract.

## License

MIT
