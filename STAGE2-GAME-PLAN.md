# 🏆 PayMate — Stage 2 Win Playbook

**Current position:** #9 of 10 advancing teams. **Goal:** #1.
**Stage 2 is a GROWTH challenge** — judges weight adoption, real usage, distribution, and demo quality over raw features.

---

## The one-line narrative (use it everywhere)

> **PayMate is the billing rail for the OpenClaw economy — every agent, invoiced and paid on GOAT Network, with portable ERC-8004 reputation.**

No other top-10 team is a payments/billing product. Own that lane.

---

## ⏱ 60-minute checklist (do in order)

- [ ] **Deploy** the web app with the env vars below (see Demo Setup).
- [ ] **Verify the domain**: `https://paymateagent.xyz` loads, Privy login shows the PayMate logo, `https://paymateagent.xyz/openclaw-skill.json` resolves (non-www), `/growth` and `/treasury` load real data.
- [ ] **Run ONE real settlement** (Demo Setup below) and grab the `explorer.goat.network/tx/<hash>` link.
- [ ] **Watch the Landing "Settlement Ledger"** section light up with real numbers (it reads `/api/growth` automatically — no code needed).
- [ ] **Post the brag video** as an X thread (copy below) tagging @Goat_Network + @ClawUp + @MetisL2, with the real tx link in the thread.
- [ ] **Post the video + tx proof in the bootcamp Discord / community** channels.
- [ ] **Submit Stage 2** with: repo link, live URL, demo video, the real explorer tx link, and the /growth screenshot.

---

## 🔑 Demo Setup — the real settlement (only you can run this)

Everything below needs **your secrets and a wallet with real USDC** — I can't do this part. Get it right once and you have the strongest proof in the competition.

### Required env vars (on the production deploy)
```
DATABASE_URL=postgres://...              # Neon (already in use)
PRIVATE_KEY=0x...                        # agent wallet — must hold USDC on GOAT mainnet
USDC_TOKEN=0x...                         # real USDC contract on GOAT mainnet (chain 2345)
USDC_IS_REAL_MAINNET_TOKEN=true          # production-safety flag (chain.ts enforces it)
USDC_DECIMALS=6
AGENT_PAY_ADMIN_SECRET=<any-long-secret> # auth for /api/agent/pay
MISTRAL_API_KEY=...                      # sybil-guard + drafting
REPUTATION_CONTRACT=0x...                # optional — ERC-8004 mint (skip = no mint, no crash)
RESEND_API_KEY=...                       # optional — email receipts
RPC_GOAT_MAINNET=https://rpc.goat.network
```

### Option A — Autonomous agent flow (fastest)
```bash
cd web
API_BASE=https://paymateagent.xyz \
AGENT_PAY_ADMIN_SECRET=<same-secret> \
SIMULATE_FREELANCER_ADDRESS=0x<your-freelancer-wallet> \
npx tsx scripts/simulate_activity.ts
```
This signs a real EIP-712 invoice (chain 2345), creates it, and has the agent pay it. Output includes `TxHash:` → paste into `explorer.goat.network/tx/<hash>`.

### Option B — Manual client flow (most convincing for judges)
1. Create an invoice on the dashboard (or via the OpenClaw skill / Discord).
2. Open the pay link, connect a client wallet holding USDC, click **Pay**.
3. Watch "Payment Verified" + the GOAT explorer link appear.
4. Screenshot the verified state + the ledger section on the landing page.

### After settling
- The Landing **Settlement Ledger** + **/growth** page now show real volume — screenshot both for the submission deck.
- If you settled via the agent, the freelancer also got an **ERC-8004 reputation mint** — mention it in the thread.

---

## 🐦 Launch thread (X/Twitter) — copy-paste

1. **Hook**
> Your AI agent just shipped the work. Now it needs to get paid. 🧾
> We built the payment rail for the OpenClaw economy. Meet PayMate — on-chain invoicing & settlement for freelancers *and* autonomous agents. 🧵

2. **The problem**
> Agents can chat, code, and research — but they can't collect money. Invoices are PDFs, chasing is manual, and "trust me bro" isn't a settlement layer.

3. **The product**
> Describe the work in plain language → PayMate drafts the invoice → your client gets one link → USDC settles directly to the wallet on @Goat_Network. Non-custodial. Verified on-chain. Done.

4. **Proof-of-code**
> Freelancers: paste a GitHub PR. PayMate reads the actual diff, prices the work with AI, and generates the invoice from real commits. No hallucinations, no underestimating.

5. **Agent-native**
> Every settlement mints a portable ERC-8004 reputation credential — proof of work that follows the agent, not the platform. Swarm payouts, streaming payments, ZK-shielded invoices, and an AI arbitrator built in.

6. **OpenClaw skill**
> Any OpenClaw agent can install the billing rail in one line:
> `openclaw skill install https://paymateagent.xyz/openclaw-skill.json`
> — then call `generate_invoice` and return a live settlement link to its client.

7. **Proof + CTA**
> Live on GOAT mainnet. Here's a real settlement: `explorer.goat.network/tx/<PASTE_HASH>`
> 👉 https://paymateagent.xyz — Work, Settled. @Goat_Network @ClawUp @MetisL2

---

## 📣 Outreach (growth = the challenge)

- Post the **brag video** in the bootcamp Discord + the ClawUp/GOAT community channels.
- Tag the organizers on the thread: **@Goat_Network, @ClawUp, @MetisL2**, and OpenClaw.
- Add the **/growth screenshot** ("real usage, no fabricated numbers") to the submission.
- Offer the skill to other bootcamp teams — "every team needs to get paid" is the viral loop that wins.

---

## ⚠️ Known debt (optional, doesn't block the win)

- 39 pre-existing lint errors (docs rewrite, landing apostrophes, pay-page hooks) — cosmetic for judges who run `npm run lint`; `npm run build` passes.
- `/docs` page is a rewrite already in your working tree — proofread it before judging.
