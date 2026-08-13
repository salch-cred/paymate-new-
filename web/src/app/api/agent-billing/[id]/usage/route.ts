import { NextResponse } from "next/server"
import { getBillableAgent, countAgentBillingUsageSince, startOfMonthMs } from "@/lib/db"
import { authenticateApiKey } from "@/lib/apikey"

/**
 * Public per-use Agent Billing — usage meter.
 *
 *   GET /api/agent-billing/[id]/usage
 *   Authorization: Bearer pm_...
 *
 * Returns the agent's total paid uses plus the current calendar-month count
 * against its monthly cap. Only the API key that registered the agent can
 * read it (owner-only).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = await authenticateApiKey(request)
  if (key instanceof NextResponse || key instanceof Response) return key

  try {
    const { id } = await params
    const agent = await getBillableAgent(id)
    if (!agent) return NextResponse.json({ detail: "Billable agent not found" }, { status: 404 })
    if (agent.apiKeyId !== key.id) {
      return NextResponse.json({ detail: "You do not own this billable agent" }, { status: 403 })
    }

    const monthStart = startOfMonthMs()
    const usedThisMonth = await countAgentBillingUsageSince(agent.id, monthStart)

    return NextResponse.json({
      agentId: agent.id,
      name: agent.name,
      priceUsd: agent.priceUsd,
      totalUses: agent.usageCount,
      usedThisMonth,
      monthlyCap: agent.monthlyCap,
      remainingThisMonth: Math.max(0, agent.monthlyCap - usedThisMonth),
      period: "utc-calendar-month",
      periodStartMs: monthStart,
    })
  } catch (error) {
    console.error("[agent-billing] Usage fetch failed:", error)
    return NextResponse.json({ detail: "Failed to fetch usage" }, { status: 500 })
  }
}
