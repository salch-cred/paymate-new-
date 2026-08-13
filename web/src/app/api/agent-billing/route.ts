import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { isAddress, getAddress } from "viem"
import { authenticateApiKey } from "@/lib/apikey"
import { createBillableAgent, listBillableAgents } from "@/lib/db"
import { isSafeWebhookUrl } from "@/lib/webhookSafety"

/**
 * Public per-use Agent Billing API — registration.
 *
 *   POST /api/agent-billing
 *   Authorization: Bearer pm_...
 *   { name, description, priceUsd, freelancerWallet, endpoint?, monthlyCap? }
 *
 * Registers a "billable agent" so any OpenClaw / external team can monetize
 * their agent in one line:
 *
 *   1. This call returns an `agentId` + the x402 quote (`accepts[]`).
 *   2. When a client requests the agent's paid endpoint, the agent (or PayMate)
 *      responds with HTTP 402 + PAYMENT-REQUIRED quoting `priceUsd` USDC on GOAT.
 *   3. The client pays that exact USDC directly to `freelancerWallet`
 *      (non-custodial — funds never touch PayMate).
 *   4. The client retries with `PAYMENT-SIGNATURE` → PayMate verifies on-chain,
 *      counts the use, enforces the monthly cap, and returns the unlocked result
 *      (optionally fetching `endpoint` so the agent never handles payments at all).
 *
 * The `pm_...` API key must exist and be active; the key's owner owns the agent.
 */
export async function POST(request: Request) {
  const key = await authenticateApiKey(request)
  if (key instanceof NextResponse || key instanceof Response) return key

  try {
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ detail: "Invalid request body" }, { status: 422 })

    const { name, description, priceUsd, freelancerWallet, endpoint, monthlyCap } = body

    if (typeof name !== "string" || name.trim().length < 2 || name.length > 120) {
      return NextResponse.json({ detail: "name must be between 2 and 120 characters" }, { status: 422 })
    }
    if (typeof description !== "string" || description.length > 4000) {
      return NextResponse.json({ detail: "description must be at most 4000 characters" }, { status: 422 })
    }
    if (typeof freelancerWallet !== "string" || !isAddress(freelancerWallet)) {
      return NextResponse.json({ detail: "freelancerWallet must be a valid wallet address" }, { status: 422 })
    }
    const price = Number(priceUsd)
    if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) {
      return NextResponse.json({ detail: "priceUsd must be a positive number" }, { status: 422 })
    }
    if (endpoint !== undefined && endpoint !== null && typeof endpoint === "string" && !isSafeWebhookUrl(endpoint)) {
      return NextResponse.json(
        { detail: "endpoint must be a safe public https URL (no localhost/private IPs)" },
        { status: 422 }
      )
    }
    if (monthlyCap !== undefined && monthlyCap !== null) {
      const cap = Number(monthlyCap)
      if (!Number.isFinite(cap) || cap < 1 || cap > 1_000_000) {
        return NextResponse.json({ detail: "monthlyCap must be a positive integer" }, { status: 422 })
      }
    }

    const agent = await createBillableAgent({
      id: crypto.randomUUID(),
      name: name.trim(),
      description: (description?.trim?.() || "").slice(0, 4000),
      priceUsd: price,
      freelancer: getAddress(freelancerWallet),
      endpoint: typeof endpoint === "string" && endpoint ? endpoint : null,
      apiKeyId: key.id,
      monthlyCap: monthlyCap ? Number(monthlyCap) : 1000,
    })

    return NextResponse.json(
      {
        ok: true,
        agentId: agent.id,
        agent,
        price: `$${agent.priceUsd.toFixed(2)}`,
        useEndpoint: `/api/agent-billing/${agent.id}/use`,
        unlockInstructions:
          "Serve the useEndpoint to your clients. On request it returns HTTP 402 + PAYMENT-REQUIRED " +
          "quoting the USDC price on GOAT Network. After your client pays, they retry with " +
          "`PAYMENT-SIGNATURE: base64({\"txHash\":\"0x...\"})` and PayMate verifies the transfer on-chain, " +
          "counts the use, and returns the unlocked result.",
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("[agent-billing] Registration failed:", error)
    return NextResponse.json({ detail: "Failed to register billable agent" }, { status: 500 })
  }
}

/** GET /api/agent-billing — list the agents owned by the authenticated key. */
export async function GET(request: Request) {
  const key = await authenticateApiKey(request)
  if (key instanceof NextResponse || key instanceof Response) return key

  try {
    const agents = await listBillableAgents(key.id)
    return NextResponse.json({ agents })
  } catch (error) {
    console.error("[agent-billing] List failed:", error)
    return NextResponse.json({ detail: "Failed to list billable agents" }, { status: 500 })
  }
}
