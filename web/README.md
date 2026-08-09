# PayMate Agent 🤖💳

**PayMate** is an intelligent, non-custodial invoicing platform and billing engine designed for the Agentic Web. Built for the OpenClaw Summer Builder Bootcamp 2026, PayMate transitions AI agents from simple prototypes into economic actors that generate real-world revenue.

Whether you are a human freelancer or an autonomous AI agent, PayMate allows you to generate cryptographic invoices using natural language or GitHub pull requests, and settle them instantly using the **GOAT Network**.

## 🌟 Key Ecosystem Integrations

PayMate is deeply integrated into the modern decentralized AI stack:

- **OpenClaw Integration:** PayMate operates as a native OpenClaw Skill. Any AI agent in the OpenClaw ecosystem can natively generate invoices and bill users.
- **GOAT Network Settlement:** All invoices are settled securely on the Bitcoin-backed GOAT Network Layer 2, providing machine-speed transaction finality.
- **x402 Protocol:** PayMate utilizes the x402 payment standard for machine-to-machine commerce, ensuring agents can cryptographically verify when they have been paid before releasing deliverables.
- **ERC-8004 Identity:** Successful payments on PayMate contribute to portable, on-chain reputation profiles using the ERC-8004 standard on Metis.
- **ClawUp Ecosystem:** Designed to support the growing network of agents deployed via ClawUp.

---

## 🚀 For Developers: The PayMate OpenClaw Skill

PayMate is not just a web application; it is the billing infrastructure for the entire OpenClaw ecosystem. You can integrate PayMate into your own AI agent in minutes.

### 1. Install the Skill
Add the PayMate billing manifest to your OpenClaw agent's configuration:
```bash
openclaw skill install https://www.paymateagent.xyz/openclaw-skill.json
```

### 2. Using the API directly (Machine-to-Machine)
If you are building a custom agent outside of the standard OpenClaw framework, you can hit our headless API endpoint directly.

**Endpoint:** `POST https://www.paymateagent.xyz/api/agent/paymate-skill`

**Payload:**
```json
{
  "title": "Data Scraping Task",
  "description": "Scraped 10,000 records from the target URL.",
  "amountUsd": 50.00,
  "freelancerWallet": "0xYourAgentWalletAddress"
}
```

**Response:**
```json
{
  "ok": true,
  "invoiceId": "inv-12345",
  "payUrl": "https://www.paymateagent.xyz/pay/inv-12345",
  "message": "Invoice generated successfully. Please present the payUrl to the client for settlement."
}
```
Your agent can then send the `payUrl` directly to the client via Telegram, Discord, or the CLI!

---

## 💻 For Freelancers: GitHub Auto-Invoicing

PayMate features a breakthrough "Proof-of-Code" engine. Instead of manually writing an invoice, you can simply paste a GitHub Pull Request URL into PayMate.

1. PayMate uses `Octokit` to securely fetch the actual `diff` from your Pull Request.
2. The exact lines of code added/deleted are fed into the Mistral AI.
3. The AI acts as a senior technical reviewer, analyzing the complexity of the code and automatically generating a professional invoice description and a fair market bounty price.

This eliminates AI hallucinations and ensures you are paid fairly for the exact work you committed.

---

## 🛠️ Tech Stack
- **Frontend:** Next.js 16 (React 19, Turbopack)
- **Styling:** TailwindCSS 4, Framer Motion, GSAP
- **Web3 / Auth:** Wagmi, Viem, Privy (Passkey & Wallet Auth)
- **AI / LLMs:** Mistral AI (Auto-Invoicing), Octokit (GitHub integration)
- **Database:** Neon Serverless Postgres

## 📈 Stage 2 Bootcamp Track
PayMate is participating in the Stage 2 Growth Challenge of the OpenClaw Summer Builder Bootcamp. If you are building an AI agent, we encourage you to use our OpenClaw Skill to monetize your project and help grow the Metis and GOAT Network ecosystems!
