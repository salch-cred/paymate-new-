import { NextRequest, NextResponse } from "next/server"
import { isAddress, getAddress, type Address } from "viem"
import { getBillableAgent, reserveAgentBillingUsage, incrementAgentBillingUsageInDb, countAgentBillingUsageSince, startOfMonthMs } from "@/lib/db"
import { verifyPluginPayment, PaymentError, usdcAmount, getPublicClient } from "@/lib/chain"
import { screenWallets, simulatePaymentSafety } from "@/lib/security"
import { extractTxHash, PAYMENT_REQUIRED_HEADER, PAYMENT_RESPONSE_HEADER } from "@/lib/paywall"
import { isSafeWebhookUrl } from "@/lib/webhookSafety"

/**
 * Public per-use Agent Billing — x402 challenge + paid unlock.
 *
 *   POST /api/agent-billing/[id]/use
 *     → HTTP 402 + PAYMENT-REQUIRED header + x402 `accepts[]` body quoting the
 *       agent's `priceUsd` USDC on GOAT Network, payable directly to the
 *       developer's wallet (non-custodial).
 *
 *   POST ... with PAYMENT-SIGNATURE: base64({"txHash":"0x..."})
 *     → verifies the transfer on-chain, replay-guards the tx hash, enforces the
 *       monthly usage cap, counts the use, and returns the unlocked result.
 *
 * Optional `endpoint` (validated SSRF-safe at registration): if set, PayMate
 * fetches it with a signed delivery receipt header so the developer's own
 * service can return the actual deliverable — the agent never touches payments.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const agent = await getBillableAgent(id)
    if (!agent) return NextResponse.json({ error: "Billable agent not found" }, { status: 404 })
    if (!agent.active) return NextResponse.json({ error: "Billable agent is not active" }, { status: 403 })

    // --- Paid retry: verify the transfer on-chain, then count the use. ---
    const txHash = extractTxHash(request)
    if (txHash) {
      // Replay guard FIRST: the same tx hash can never unlock a use twice.
      const reserved = await reserveAgentBillingUsage(txHash, agent.id)
      if (!reserved) {
        return NextResponse.json(
          { error: "This transaction has already been used to unlock this agent." },
          { status: 402 }
        )
      }

      // Monthly usage cap — the developer sets how many paid uses their agent
      // serves per calendar month. Fail closed on quota exhaustion.
      const monthStart = startOfMonthMs()
      const usedThisMonth = await countAgentBillingUsageSince(agent.id, monthStart)
      if (usedThisMonth >= agent.monthlyCap) {
        return NextResponse.json(
          { error: `This agent's monthly usage cap (${agent.monthlyCap}) has been reached.` },
          { status: 429 }
        )
      }

      // Real on-chain verification — same security bar as invoice settlement.
      const payer = await verifyPluginPayment(txHash, agent.freelancer, agent.priceUsd)

      // ── Tier-1 security: screen both parties + simulate the payment ──
      const screen = await screenWallets(payer, agent.freelancer)
      if (!screen.ok) {
        return NextResponse.json(
          { error: `Agent use refused by security screening: ${screen.reason}` },
          { status: 403 }
        )
      }
      const usdcTokenForSim = process.env.USDC_TOKEN
      if (usdcTokenForSim && isAddress(usdcTokenForSim)) {
        const sim = await simulatePaymentSafety(getPublicClient(), {
          token: getAddress(usdcTokenForSim) as Address,
          to: getAddress(agent.freelancer) as Address,
          amount: usdcAmount(agent.priceUsd),
        })
        if (sim && !sim.safe) {
          return NextResponse.json(
            {
              error: sim.feeOnTransfer
                ? "Agent use refused: the payment token applies a transfer fee, so the developer would receive less than the listed price."
                : `Agent use refused by payment simulation: ${sim.revertReason || "unexpected revert"}`,
            },
            { status: 402 }
          )
        }
      }

      // Count the use (Postgres).
      try {
        await incrementAgentBillingUsageInDb(agent.id)
      } catch (e) {
        console.error(`[agent-billing] Failed to persist usage count:`, e)
      }

      const receipt = {
        ok: true,
        network: "goat",
        agentId: agent.id,
        txHash,
        priceUsd: agent.priceUsd,
        payer,
        servedAt: Date.now(),
      }
      const receiptHeader = Buffer.from(JSON.stringify(receipt)).toString("base64")

      // Optional deliverable endpoint: relay the signed receipt so the
      // developer's own service returns the content. SSRF-guarded at
      // registration; fetch is best-effort (fail open on outage — payment is
      // already verified on-chain).
      let deliverable: unknown = null
      if (agent.endpoint && isSafeWebhookUrl(agent.endpoint)) {
        try {
          const res = await fetch(agent.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", [PAYMENT_RESPONSE_HEADER]: receiptHeader },
            body: JSON.stringify({ agentId: agent.id, txHash, payer }),
            signal: AbortSignal.timeout(10_000),
          })
          deliverable = await res.json().catch(() => null)
        } catch (e) {
          console.error(`[agent-billing] Deliverable fetch failed:`, e)
        }
      }

      return NextResponse.json(
        {
          ok: true,
          agentId: agent.id,
          agent: { name: agent.name, priceUsd: agent.priceUsd },
          txHash,
          payer,
          usedThisMonth: usedThisMonth + 1,
          monthlyCap: agent.monthlyCap,
          explorerUrl: `https://explorer.goat.network/tx/${txHash}`,
          deliverable,
          receipt: receiptHeader,
          message: "Payment verified on-chain. Agent unlocked.",
        },
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            [PAYMENT_RESPONSE_HEADER]: receiptHeader,
          },
        }
      )
    }

    // --- Challenge path: 402 + PAYMENT-REQUIRED. Nothing is unlocked. ---
    const usdcToken = process.env.USDC_TOKEN
    if (!usdcToken || !isAddress(usdcToken)) {
      return NextResponse.json(
        { error: "Server misconfigured: USDC_TOKEN is not set" },
        { status: 503 }
      )
    }
    const requirements = {
      x402Version: 1,
      error: "Payment required",
      accepts: [
        {
          scheme: "exact",
          network: "goat",
          asset: getAddress(usdcToken),
          token: getAddress(usdcToken),
          payTo: getAddress(agent.freelancer),
          price: `$${agent.priceUsd.toFixed(2)}`,
          maxAmountRequired: usdcAmount(agent.priceUsd).toString(),
        },
      ],
    }
    return new NextResponse(
      JSON.stringify({
        x402Version: requirements.x402Version,
        error: requirements.error,
        agentId: agent.id,
        accepts: requirements.accepts,
        unlockInstructions:
          "Pay the quoted USDC to the payTo address on GOAT Network, then retry with " +
          `PAYMENT-SIGNATURE: base64({"txHash":"0x..."}) to unlock.`,
      }),
      {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          [PAYMENT_REQUIRED_HEADER]: Buffer.from(JSON.stringify(requirements)).toString("base64"),
        },
      }
    )
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`[agent-billing] Agent use failed:`, error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
