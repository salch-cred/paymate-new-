# Case Study — A settlement that actually happened on GOAT Network

*Case study · publish only with REAL numbers (no fabrication). Fill every `[BRACKET]` from a real completed settlement, then post as an X thread + LinkedIn/Medium article.*

---

## TL;DR

A real USDC payment moved from a client's wallet to a freelancer's wallet on GOAT Network — verified on-chain, receipt issued, reputation minted — through a link that took the client **under two minutes** with no account and no custody.

- **Invoice:** `[INVOICE TITLE]` — `$[AMOUNT]` USDC
- **Invoice ID:** `[INVOICE_ID]`
- **Client:** `[0xCLIENT]` · **Freelancer:** `[0xFREELANCER]`
- **Settlement tx:** [https://explorer.goat.network/tx/[TX_HASH]](https://explorer.goat.network/tx/[TX_HASH])
- **Settled:** `[DATE, e.g. Aug 18, 2026]`
- **Live evidence:** https://paymateagent.xyz/metrics

---

## The problem

`[CLIENT]` needed `[THE WORK — e.g. "a landing page" / "an AI agent that triages support emails"]` from `[FREELANCER — human or agent]`.

The old options:
- Wire transfer → days, fees, no receipt.
- Invoice by hand → PDF, bank details, trust, hope.
- Crypto → "send USDC to this address" and pray the work was real.

No proof, no escrow, no reputation. Both sides were taking a leap of faith.

## What they did instead

`[FREELANCER]` created a PayMate invoice — scope, amount, and terms in one link — and sent it in `[CHANNEL: a chat / an email / a Telegram message]`.

The client didn't need an account, an app, or even a wallet beforehand:

1. Opened the link (`https://paymateagent.xyz/pay/[INVOICE_ID]`)
2. Connected a wallet
3. Reviewed the scope and the exact amount
4. Approved the USDC transfer on GOAT Network

**Time from link open to settled: `[X] minutes.**`

## The verification (the part that matters)

Payment confirmation wasn't a dashboard button — it was a **transaction on the GOAT explorer**:

> [EXPLORER SCREENSHOT or the tx link]

PayMate verified the transfer on-chain, then:
- Marked the invoice **PAID**
- Emailed a receipt
- Accrued the 1% protocol fee to the on-chain treasury
- Minted an **ERC-8004 reputation credential** for `[FREELANCER]` — completed job + `$[AMOUNT]` of verified earnings, portable across platforms

## What the numbers say (fill from /metrics)

- Total invoices on PayMate: `[N]`
- Settled: `[N]` · Volume settled: `$[V]`
- Unique freelancers: `[N]` · Unique clients: `[N]`
- Settlement rate: `[N]%`

*(All live at https://paymateagent.xyz/metrics — screenshot for the report.)*

## Why this is a bigger deal than "someone paid"

1. **Non-custodial.** Funds moved client → freelancer directly. Neither PayMate nor any intermediary held the USDC at any point.
2. **Publicly verifiable.** Anyone can open the explorer link and confirm the transfer. No "trust us."
3. **Reputation becomes an asset.** The settlement minted a portable credential — the next client (or hiring agent) can see verified earnings instead of a claimed resume.
4. **It composes.** The same rail powers merchant checkout, x402 agent pay-per-use, escrow markets, and Telegram Mini App payments — one settlement standard, many products.

## For builders: the exact integration used

`[IF MERCHANT STYLE — else delete]` The merchant created the checkout with one API call:

```bash
curl -X POST https://paymateagent.xyz/api/merchant/checkout \
  -H "Authorization: Bearer pm_..." \
  -d '{"amountUsd": [AMOUNT], "orderId": "[ORDER_ID]"}'
```

and their backend fulfilled the order after verifying the HMAC-signed `checkout.paid` webhook carrying the real tx hash. Tutorial: `tutorial-merchant-checkout.md`.

## What we learned

- `[REAL LESSON — e.g. "clients with wallets already on other chains used the 39-chain ClawUp checkout" / "the QR code on the checkout page mattered for phone users" / "the AI arbitration flow got a test run and released the escrow in one message"]`
- `[REAL LESSON 2]`

---

*Keywords: GOAT Network, USDC settlement, crypto invoice, AI agent payments, ERC-8004, x402, on-chain escrow.*

*Publish note: replace every `[BRACKET]`, verify the explorer link opens, screenshot the /metrics page, then post. Link the tutorial in the replies.*
