# Accept USDC on GOAT Network in one line — PayMate Merchant Checkout

*Technical tutorial · ~5 min read · for builders, agents, and indie SaaS*

Most crypto payment integrations take weeks: custody setup, KYC, SDKs, settlement logic. This tutorial shows the other way — a checkout that settles **real USDC on GOAT Network** (the Bitcoin-secured L2) with **one API call**, a **copy-paste button**, and a **cryptographically signed webhook** that tells your backend the money is actually there.

By the end you'll have a live "Pay with PayMate" button on your site and a backend that can safely fulfil orders.

---

## How it works (60 seconds)

PayMate runs an invoice rail on GOAT Network. A checkout *is* an invoice with merchant context:

1. You create a checkout → PayMate returns a `payUrl`.
2. Your customer opens the link (or your embedded button) and pays **USDC directly on GOAT** from their own wallet — non-custodial, no account required.
3. PayMate **verifies the transaction on-chain**, and POSTs a signed `checkout.paid` webhook to your backend with the explorer tx hash.
4. Your backend verifies the HMAC signature and fulfils the order.

You never handle private keys. PayMate never holds the funds. The settlement is verifiable by anyone on `explorer.goat.network`.

---

## Prerequisites

- An API key: open **https://paymateagent.xyz/developers**, connect your wallet, mint a `pm_...` key. (Only the SHA-256 hash is stored — the raw key shows once. Keep it safe.)
- Optional: open the **Merchant portal** at **https://paymateagent.xyz/merchant** and paste the key to set your receive wallet, webhook URL, and success/cancel URLs.

---

## Step 1 — Create a checkout (one API call)

```bash
curl -X POST https://paymateagent.xyz/api/merchant/checkout \
  -H "Authorization: Bearer pm_..." \
  -H "Content-Type: application/json" \
  -d '{
    "amountUsd": 49.99,
    "orderId": "order_123",
    "title": "Pro plan",
    "webhookUrl": "https://shop.example.com/hooks/paymate"
  }'
```

Response:

```json
{
  "ok": true,
  "checkoutId": "c1a9…",
  "orderId": "order_123",
  "amountUsd": 49.99,
  "status": "pending",
  "payUrl": "https://paymateagent.xyz/pay/c1a9…",
  "webhookUrl": "https://shop.example.com/hooks/paymate",
  "message": "Checkout created. Redirect the customer to payUrl; we POST a signed checkout.paid webhook once the on-chain payment settles on GOAT."
}
```

That's it. The customer pays at `payUrl` — connect wallet → approve the USDC transfer on GOAT → PayMate verifies it on-chain.

> Optional fields: `title`, `description`, `orderId` (your order reference, echoed back in webhooks), `successUrl` / `cancelUrl` (redirect after payment), `receiveWallet` (override where USDC settles; defaults to your key's wallet).

---

## Step 2 — Point customers at the checkout

**Option A — redirect** (recommended for checkout pages / invoices):

```js
// After you create the order server-side, send the customer here:
window.location.href = checkout.payUrl
```

**Option B — copy-paste button** (one `<a>` + one `<script>`, no build step):

```html
<a href="https://paymateagent.xyz/pay/<checkoutId>"
   data-paymate-checkout
   data-amount="49.99"
   data-title="Pro plan">
  Pay with PayMate
</a>
<script src="https://paymateagent.xyz/paymate-checkout.js" defer></script>
```

The script turns that anchor into a styled gold button that opens the hosted checkout in a new tab. The button works on any static site, Shopify-like stores, or even an email.

---

## Step 3 — Handle the signed webhook (the important part)

When the on-chain payment settles, PayMate POSTs to your `webhookUrl`:

```json
{
  "event": "checkout.paid",
  "checkoutId": "c1a9…",
  "orderId": "order_123",
  "amountUsd": 49.99,
  "currency": "USDC",
  "txHash": "0x84c1…",
  "paidAt": 1755200000000
}
```

with the header **`X-PayMate-Signature: <hex HMAC-SHA256>`**, keyed with your **webhook secret** (generated when your merchant profile is created — visible in the `/merchant` portal under Store settings).

**Verify it before fulfilling anything.** Node.js:

```js
const crypto = require("crypto");

const SECRET = process.env.PAYMATE_WEBHOOK_SECRET; // from /merchant portal

function verifyPayMateWebhook(req, rawBody) {
  const signature = req.headers["x-paymate-signature"];
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(rawBody, "utf-8")
    .digest("hex");
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

Then:

```js
// Express example
app.post("/hooks/paymate", express.raw({ type: "*/*" }), (req, res) => {
  const rawBody = req.body.toString("utf-8");
  if (!verifyPayMateWebhook(req, rawBody)) return res.status(401).end();

  const event = JSON.parse(rawBody);
  if (event.event === "checkout.paid") {
    // 1. Mark orderId fulfilled in YOUR database (idempotent — replay-safe)
    // 2. Store event.txHash for your records / refunds
    // 3. Open https://explorer.goat.network/tx/<event.txHash> to verify publicly
  }
  res.status(200).end();
});
```

Because the webhook is HMAC-signed with a secret only you and PayMate know, a fake "payment webhook" from anywhere else fails verification. The payload also carries the real GOAT explorer tx hash — public proof, not a promise.

---

## Step 4 — Go live

- **What customers see:** a clean checkout page with the amount, scope, the GOAT Network badge, and a wallet connect → one USDC transfer → verified "Payment Verified" state with the explorer link.
- **What your backend gets:** the signed webhook above, plus an email receipt and the 1% protocol fee automatically accrued to the on-chain treasury.
- **What your customer gets:** ERC-8004 portable reputation minted from the settlement — payment history that travels across platforms.

---

## Beyond the button — the same rail powers more

- **Pay by invoice ID** — a client with just the invoice number can type it at `https://paymateagent.xyz/pay` and pay. No link needed.
- **39-chain checkout** — customers can pay from Ethereum, Base, Arbitrum, BNB, Polygon, Avalanche, GOAT, and more; the value is cryptographically verified on the source chain before settling on GOAT.
- **x402 pay-per-use** — agents charge per call via the HTTP 402 challenge (`PAYMENT-REQUIRED` header), settlement replay-guarded.
- **Escrow market** — fixed-price work with funds locked on-chain until delivery, AI arbitration on disputes.
- **Telegram Mini App** — invoice payment inside Telegram via the official Mini App.

## Links

- Try the live product: **https://paymateagent.xyz**
- API docs: **https://paymateagent.xyz/docs**
- Live growth metrics: **https://paymateagent.xyz/metrics**
- OpenClaw/ClawUp skill: `openclaw skill install https://paymateagent.xyz/openclaw-skill.json`

---

*Keywords: GOAT Network payments · USDC checkout · crypto payment API · AI agent payments · x402 · ERC-8004 · on-chain invoicing*
