/**
 * Smoke tests for the Merchant Checkout API (no DB / no real keys needed).
 *
 * Covers:
 *   - webhook HMAC sign/verify (valid / wrong secret / tampered body / missing sig)
 *   - checkout.paid payload shape (orderId echo, currency, txHash)
 *   - webhookHeaders output
 *   - route-level auth fail-closed (401 without / with malformed key)
 *   - embeddable widget script present
 *
 * Run: npx tsx scripts/merchant_smoke.ts
 */

import * as fs from "fs"
import * as path from "path"
import {
  buildCheckoutWebhook,
  signMerchantWebhook,
  verifyMerchantWebhook,
  webhookHeaders,
} from "@/lib/merchant"

let pass = 0
let fail = 0
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name} ${extra}`)
  }
}

async function main() {
  console.log("\n— webhook HMAC —")
  const secret = "abc123secret"
  const payload = buildCheckoutWebhook({
    id: "checkout-1",
    merchantOrderId: "ORD-42",
    amountUsd: 12.5,
    txHash: "0xabc",
    paidAt: 1700000000000,
  })
  const body = JSON.stringify(payload)
  const sig = signMerchantWebhook(secret, body)
  check("signature is hex", /^[0-9a-f]{64}$/.test(sig), sig)
  check("valid signature passes", verifyMerchantWebhook(secret, body, sig))
  check("wrong secret fails", !verifyMerchantWebhook("wrong-secret", body, sig))
  check("tampered body fails", !verifyMerchantWebhook(secret, body + "x", sig))
  check("missing signature fails", !verifyMerchantWebhook(secret, body, null))
  check("empty signature fails", !verifyMerchantWebhook(secret, body, ""))

  console.log("\n— checkout.paid payload —")
  check("event is checkout.paid", payload.event === "checkout.paid")
  check("orderId echoed", payload.orderId === "ORD-42")
  check("currency is USDC", payload.currency === "USDC")
  check("amount + txHash carried", payload.amountUsd === 12.5 && payload.txHash === "0xabc")
  check("paidAt timestamp set", payload.paidAt === 1700000000000)
  const noOrder = buildCheckoutWebhook({ id: "c2", amountUsd: 1 })
  check("orderId null when absent", noOrder.orderId === null)

  console.log("\n— webhookHeaders —")
  const headers = webhookHeaders(secret, payload)
  check("X-PayMate-Signature header present", typeof headers["X-PayMate-Signature"] === "string")
  check("content-type json", headers["Content-Type"] === "application/json")

  console.log("\n— route auth (fail closed, no DB) —")
  const { POST: checkoutPost } = await import("@/app/api/merchant/checkout/route")
  const noKey = await checkoutPost(new Request("http://localhost/api/merchant/checkout", { method: "POST", body: JSON.stringify({ amountUsd: 5 }) }))
  check("POST /api/merchant/checkout without key → 401", noKey.status === 401, String(noKey.status))
  const badKey = await checkoutPost(
    new Request("http://localhost/api/merchant/checkout", {
      method: "POST",
      headers: { authorization: "Bearer not-a-pm-key" },
      body: JSON.stringify({ amountUsd: 5 }),
    }),
  )
  check("malformed key → 401", badKey.status === 401, String(badKey.status))

  const { GET: checkoutsGet } = await import("@/app/api/merchant/checkouts/route")
  const listNoKey = await checkoutsGet(new Request("http://localhost/api/merchant/checkouts"))
  check("GET /api/merchant/checkouts without key → 401", listNoKey.status === 401, String(listNoKey.status))

  const { GET: profileGet } = await import("@/app/api/merchant/profile/route")
  const profNoKey = await profileGet(new Request("http://localhost/api/merchant/profile"))
  check("GET /api/merchant/profile without key → 401", profNoKey.status === 401, String(profNoKey.status))

  console.log("\n— embeddable widget —")
  const widgetPath = path.join(process.cwd(), "public", "paymate-checkout.js")
  const widget = fs.existsSync(widgetPath) ? fs.readFileSync(widgetPath, "utf-8") : ""
  check("paymate-checkout.js exists", widget.length > 0)
  check("widget targets [data-paymate-checkout]", widget.includes("data-paymate-checkout"))
  check("widget styles the button", widget.includes("paymate-checkout-btn"))

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
