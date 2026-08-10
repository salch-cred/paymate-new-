import { createInvoice } from "@/lib/db";
import { autonomousAgentPay } from "@/lib/agent";
import { getAddress, isAddress } from "viem";
import { verifyInvoiceSignature } from "@/lib/eip712";
import { checkAndConsumeIntentBudget } from "@/lib/rateLimit";
import { requireBearerAuth } from "@/lib/auth";
import { REFERRAL_MULTIPLIER_TAG } from "@/lib/constants";

// SECURITY NOTE (fixed 2026-07-29 audit finding C-1 / C-2):
// This endpoint used to (a) accept requests with zero authentication, and
// (b) forge a valid "client" EIP-712 signature server-side using a hardcoded
// private key, then immediately auto-pay real USDC to an attacker-supplied
// address. Both of those are removed below:
//   - A shared secret is now required from the calling platform (ClawUp).
//   - The client must supply their OWN real EIP-712 signature over the
//     invoice; we verify it against `client`, never fabricate one.
//   - A global rolling-window payout budget caps total autonomous spend,
//     independent of the existing per-invoice MAX_AUTO_PAY in lib/agent.ts.

// Adapter for ClawUp Platform Intents
export async function POST(request: Request) {
  try {
    // 1. Require a shared secret from the calling platform. Never process
    // an unauthenticated request that can trigger a real fund transfer.
    if (!process.env.CLAWUP_SHARED_SECRET) {
      console.error("[clawup/intent] CLAWUP_SHARED_SECRET is not configured. Refusing to run.");
    }
    const unauthorized = requireBearerAuth(request, process.env.CLAWUP_SHARED_SECRET);
    if (unauthorized) return unauthorized;

    const body = await request.json().catch(() => null);
    if (!body || !body.intent) {
      return Response.json({ detail: "Must provide a ClawUp intent" }, { status: 400 });
    }

    // ClawUp Intent handling
    if (body.intent === "create_and_pay_invoice") {
      const { freelancer, client, amountUsd, signature } = body.payload;

      if (!isAddress(freelancer) || !isAddress(client)) {
         return Response.json({ detail: "Invalid addresses" }, { status: 400 });
      }
      if (!signature) {
        return Response.json({ detail: "Missing client EIP-712 signature. The client must sign the invoice themselves; PayMate never signs on a client's behalf." }, { status: 400 });
      }

      // 2. Verify the CLIENT (payer) actually authorized this specific
      // payment. This is the authorization check that was missing before —
      // previously the code checked the freelancer's (payee's) signature,
      // which the attacker could always self-satisfy.
      const isValid = await verifyInvoiceSignature(
        getAddress(freelancer),
        getAddress(client),
        Number(amountUsd),
        signature as `0x${string}`,
        getAddress(client) // expected signer is the PAYER, not the payee
      );
      if (!isValid) {
        return Response.json({ detail: "Invalid or missing client authorization signature" }, { status: 401 });
      }

      // 3. Global payout budget check (independent of the per-invoice cap
      // already enforced inside autonomousAgentPay).
      const budgetOk = await checkAndConsumeIntentBudget(Number(amountUsd));
      if (!budgetOk) {
        return Response.json({ detail: "Autonomous payout budget exceeded for this window. Manual review required." }, { status: 429 });
      }

      const referralCode = process.env.CLAWUP_REFERRAL_ID || REFERRAL_MULTIPLIER_TAG;
      const invoice = await createInvoice({
        freelancer: getAddress(freelancer),
        client: getAddress(client),
        title: "ClawUp Automated Gig",
        description: "Task autonomously assigned and executed by ClawUp Network",
        amountUsd: Number(amountUsd),
        webhookUrl: referralCode,
        signature
      });

      // 4. Trigger auto-pay (still subject to the per-invoice MAX_AUTO_PAY
      // and Sybil-Guard checks in lib/agent.ts)
      const txHash = await autonomousAgentPay(invoice);

      return Response.json({
        ok: true,
        message: "ClawUp intent executed",
        invoiceId: invoice.id,
        agentTxHash: txHash
      });
    }

    return Response.json({ detail: "Unsupported intent" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ detail: message }, { status: 500 });
  }
}
