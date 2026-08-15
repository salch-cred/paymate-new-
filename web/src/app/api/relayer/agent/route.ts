import { requireBearerAuth } from "@/lib/auth"
import { runAgentPass } from "@/lib/relayerAgent"

export const dynamic = "force-dynamic"

/**
 * Relayer Operator Agent trigger — wired to a Vercel cron (vercel.json) and
 * safe to call from any external cron. Runs one pass: audit the relayer
 * ledger, check GOAT payout liquidity, retry the AI-selected failed swaps
 * within hard caps, and report via Discord.
 *
 *   GET /api/relayer/agent                      → run (honors RELAYER_AGENT_DRY_RUN)
 *   GET /api/relayer/agent?dryRun=true          → audit + plan + report, never retry
 *   POST /api/relayer/agent                     → same as GET
 *
 * Requires CRON_SECRET (same guard as /api/relayer/run and /api/cron/recurring).
 * Fail-closed: 401 without the bearer secret; `enabled: false` body when
 * PRIVATE_KEY isn't set or RELAYER_AGENT_ENABLED=false.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error("[relayer/agent] CRON_SECRET is not configured. Refusing to run.")
  }
  const unauthorized = requireBearerAuth(request, process.env.CRON_SECRET)
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const dryRun = url.searchParams.get("dryRun") === "true"
  try {
    const result = await runAgentPass({ dryRun })
    return Response.json(result)
  } catch (error) {
    console.error("[relayer/agent] run failed:", error)
    return Response.json(
      { detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export const POST = GET
