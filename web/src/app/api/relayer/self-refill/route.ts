import { requireBearerAuth } from "@/lib/auth"
import { runSelfRefillOnce } from "@/lib/selfRefill"

export const dynamic = "force-dynamic"

/**
 * Self-refill loop trigger — wired to a Vercel cron (vercel.json). Runs one
 * pass of the automatic custody pipeline: bridge BSC DOGEB → GOAT (gated by
 * GOAT_BRIDGE_VERIFIED), then DEX-swap DOGEB → USDC.e on GOAT (gated by
 * GOAT_DEX_VERIFIED), so client BSC payments refill the GOAT payout pool.
 *
 *   GET /api/relayer/self-refill                   → run (honors SELF_REFILL_DRY_RUN)
 *   GET /api/relayer/self-refill?dryRun=true       → audit balances + plan only
 *   POST /api/relayer/self-refill                  → same as GET
 *
 * Requires CRON_SECRET (same guard as the other relayer crons). Fail-closed:
 * 401 without the bearer secret; `enabled: false` body when PRIVATE_KEY isn't
 * set; both fund-moving hops refuse to run until their verification flags are
 * set (balances are still audited and reported).
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error("[relayer/self-refill] CRON_SECRET is not configured. Refusing to run.")
  }
  const unauthorized = requireBearerAuth(request, process.env.CRON_SECRET)
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const dryRun = url.searchParams.get("dryRun") === "true"
  try {
    const result = await runSelfRefillOnce({ dryRun })
    return Response.json(result)
  } catch (error) {
    console.error("[relayer/self-refill] run failed:", error)
    return Response.json(
      { detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export const POST = GET
