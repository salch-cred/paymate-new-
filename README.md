# PayMate - Web3 AI Invoicing for the GOAT Network

PayMate is an intelligent, non-custodial invoicing platform designed for freelancers, DAOs, and AI agents. It leverages the OpenClaw ecosystem, x402 payment standards, and the GOAT Network to provide seamless, trustless settlement.

## Features

- **AI Smart Drafting**: Describe your invoice in plain text (e.g., "500 USDC for marketing work") and the embedded AI structures a complete, professional invoice.
- **Discord Bot Integration**: Create invoices directly from Discord slash commands (`/paymate` and `/invoice`). The bot operates ephemerally and is restricted to Administrators for maximum security.
- **On-chain Settlement (x402)**: Invoices are settled directly on the GOAT Testnet3, proving payment cryptographically.
- **ERC-8004 Portable Reputation**: Every verified payment mints a soulbound reputation credential, giving freelancers an immutable on-chain track record of completed jobs and total earnings.
- **Real-time Webhooks**: Automated Discord Webhooks announce paid invoices to your community instantly.

## Architecture

- **Frontend Framework**: Next.js 14 (App Router)
- **Styling**: Pure Vanilla CSS for a hyper-premium, animated glassmorphism aesthetic.
- **Wallet & Authentication**: [Privy](https://privy.io/) for embedded, gasless Web3 onboarding.
- **Blockchain**: GOAT Network (Testnet3)
- **AI Infrastructure**: OpenClaw Toolkit

## Hackathon Stage 2: Growth Strategy

For Stage 2 of the OpenClaw Bootcamp, PayMate implemented several key growth features:

1. **Frictionless Onboarding**: By moving invoice generation into Discord, users no longer have to visit the web app to initiate work.
2. **Viral Ecosystem Loops**: Every Discord bot response and every web dashboard contains our unique **ClawUp Referral Link**, incentivizing clients to join the OpenClaw ecosystem after paying an invoice.
3. **Enterprise Security**: Implemented strict `x-signature-timestamp` validation to prevent replay attacks on the Discord integration, ensuring the product is production-ready for real-world DAOs.

## Running Locally

1. Clone the repository
2. Run `npm install`
3. Start the development server with `npm run dev`

---
*Built for the OpenClaw Summer Builder Bootcamp.*
