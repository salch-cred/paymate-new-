import { requireBearerAuth } from "@/lib/auth"
import { runPivotOnce } from "@/lib/pivot"

export const dynamic = "force-dynamic"

/**
 * Pivot hop trigger — wired to a Vercel cron (vercel.json).
 *
 *   GET /api/relayer/pivot                  → run (honors PIVOT_DRY_RUN)
 *   GET /api/relayer/pivot?dryRun=true      → audit inventory + quote plans only
 *   POST /api/relayer/pivot                 → same as GET
 *
 * Moves custody's source-chain USDC inventory → BNB@BSC (LI.Fi, one tx) →
 * DOGEB (1inch, keeping the self-refill bridge gas reserve). The existing
 * self-refill cron then bridges to GOAT and DEX-swaps to USDC.e, so client
 * deposits on ANY supported chain refill the GOAT payout pool automatically.
 *
 * Requires CRON_SECRET (same guard as the other relayer crons). Fail-closed:
 * 401 without the bearer secret; caps + idempotent ledger + slippage
 * protection are enforced inside runPivotOnce.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error("[relayer/pivot] CRON_SECRET is not configured. Refusing to run.")
  }
  const unauthorized = requireBearerAuth(request, process.env.CRON_SECRET)
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const dryRun = url.searchParams.get("dryRun") === "true"
  try {
    const result = await runPivotOnce({ dryRun })
    return Response.json(result)
  } catch (error) {
    console.error("[relayer/pivot] run failed:", error)
    return Response.json(
      { detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export const POST = GET
