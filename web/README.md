# PayMate

Production-oriented invoicing and settlement for independent work.

## Live capabilities

- Intelligent natural-language invoice drafting with AI and a deterministic no-key fallback
- Mandatory review of generated title, scope, amount, due date, and client wallet before publishing
- Persistent invoice storage on Postgres (Neon), via Next.js API routes
- Shareable client payment links
- Direct USDC transfer on GOAT Testnet3
- Server-side transaction verification: token, recipient, amount, and receipt status
- Automatic invoice settlement and ERC-8004 reputation recording
- Live dashboard totals, outstanding balance, invoice activity, and copyable links
- Responsive, motion-aware landing and checkout experiences

## Start

1. Copy `.env.example` to `.env.local` and provide the deployed USDC and reputation contract addresses.
2. Install and run:
   ```bash
   npm install
   npm run dev
   ```
3. Visit `http://localhost:3000`.

The frontend and API are a single Next.js app — there's no separate backend process to start.

## Routes

- `/` — product landing page
- `/dashboard` — intelligent drafting, live invoices, analytics, and reputation workspace
- `/pay/[invoice-id]` — live wallet checkout
- `/docs` — searchable protocol, API, settlement, reputation, contract, and security documentation
- `/api/*` — invoice, settlement, and reputation routes (full list in `/docs`)

No demo mode, mocked settlement, or fake API fallback is included.
