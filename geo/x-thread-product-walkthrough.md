# PayMate — X Thread (product walkthrough)

*Post as a single thread on X. Screenshot the thread after 24h for the GEO report. Add the two product screenshots (checkout page + /metrics page) where marked.*

---

**Post 1 (hook)**

> Most "crypto payments" stop at "send coins."
>
> PayMate starts there — and adds the boring, hard parts every real business needs: invoices, receipts, escrow, disputes, reputation. 🧵

**Post 2**

> PayMate = invoicing + settlement built on GOAT Network (the Bitcoin-secured L2).
>
> Create an invoice → share one link → client pays USDC directly from their wallet. No custody, no account maze, no "send to this address and pray."
>
> [SCREENSHOT: checkout page]

**Post 3**

> The flow is 3 steps:
> 1️⃣ Define the work (plain language → structured invoice)
> 2️⃣ Share one link
> 3️⃣ PayMate verifies the settlement on-chain → portable reputation minted
>
> Every step leaves a verifiable trail on explorer.goat.network.

**Post 4**

> Why GOAT Network?
>
> • Bitcoin-secured L2 → mainnet-grade security
> • Native USDC settlement
> • Built for AI-agent economic activity (x402, ERC-8004)
>
> Payments are the boring layer. GOAT made it the credible one.

**Post 5 (x402)**

> Agents need pay-per-use, not just invoices.
>
> PayMate implements x402: the HTTP 402 challenge with a PAYMENT-REQUIRED header → USDC settlement → replay-guarded unlock.
>
> Any OpenClaw/ClawUp agent can monetize a call in one line:
> `openclaw skill install https://paymateagent.xyz/openclaw-skill.json`

**Post 6 (reputation)**

> Every settlement mints an ERC-8004 soulbound credential — completed jobs, total earnings.
>
> Reputation that travels with the agent across platforms, not locked in one silo. That's the moat.

**Post 7 (39 chains)**

> Your client doesn't hold GOAT USDC? Fine.
>
> The ClawUp checkout accepts payment from 39 networks — Ethereum, Base, Arbitrum, BNB, Polygon, Avalanche, GOAT…
>
> Value is cryptographically verified on the source chain before settling on GOAT. 39 ways in, one trusted settlement.

**Post 8 (merchant API)**

> Merchants: accept USDC in one API call.
>
> ```bash
> curl -X POST https://paymateagent.xyz/api/merchant/checkout \
>   -H "Authorization: Bearer pm_..." \
>   -d '{"amountUsd": 49.99, "orderId": "order_123"}'
> ```
>
> → get a payUrl → embed a one-line button → receive an HMAC-signed `checkout.paid` webhook with the real explorer tx hash.
>
> Full tutorial in the replies. 🧵

**Post 9 (escrow + AI arbitration)**

> Freelancers vs. strangers: who holds the money?
>
> The PayMate market locks funds in an on-chain escrow. Delivery gets scored by an AI verifier. Disputes get a binding AI verdict (pay / refund / split) — and the verdict actually moves funds on-chain.

**Post 10 (Telegram)**

> Your client lives in Telegram?
>
> The PayMate Mini App pays any invoice inside Telegram with on-chain USDC on GOAT — deep-links to the standard checkout, polls until settlement lands. No new app to install.

**Post 11 (pay by ID)**

> Lost the link? Just type the invoice ID at paymateagent.xyz/pay and pay.
>
> The invoice number is the payment URL. That's it.

**Post 12 (metrics / honesty)**

> No fabricated numbers — live read from the production database:
>
> [SCREENSHOT: https://paymateagent.xyz/metrics]
>
> Targets vs. actuals, MET/NOT MET badges, settlement feed with explorer links. The receipts are public.

**Post 13 (proof)**

> Want proof it's real? Every settled payment has an explorer tx hash:
> https://explorer.goat.network/tx/<tx_hash>
>
> On-chain or it didn't happen.

**Post 14 (CTA)**

> If you're an OpenClaw/ClawUp builder:
> `openclaw skill install https://paymateagent.xyz/openclaw-skill.json`
> → call `generate_invoice` → hand the client a live settlement link.
>
> Ship first. Settle on GOAT. 🦞

**Post 15 (close)**

> PayMate — work, settled.
>
> Product: https://paymateagent.xyz
> Docs: https://paymateagent.xyz/docs
> Metrics: https://paymateagent.xyz/metrics
>
> Questions? Drop them below 👇
> Like & repost if you'd pay this way.

---

*Keywords to weave into replies: GOAT Network, USDC, AI agent payments, x402, ERC-8004, OpenClaw, ClawUp, on-chain invoicing, crypto escrow.*
