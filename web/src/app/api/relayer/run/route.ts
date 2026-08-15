import { requireBearerAuth } from "@/lib/auth"
import { runRelayerOnce } from "@/lib/relayer"

export const dynamic = "force-dynamic"

/**
 * Background relayer trigger — wired to a Vercel cron (vercel.json) and safe
 * to call from any external cron. Runs one pass: detect custody-wallet
 * deposits on every cross-chain source network, then auto-swap them to USDC
 * via 1inch. Requires CRON_SECRET (same guard as /api/cron/recurring).
 *
 *   GET /api/relayer/run                    → run (honors RELAYER_DRY_RUN)
 *   GET /api/relayer/run?dryRun=true        → detect + record, never sign
 *   POST /api/relayer/run                   → same as GET
 *
 * Returns a JSON summary of the pass. Fail-closed: 401 without the bearer
 * secret, and a clean `enabled: false` body when PRIVATE_KEY isn't set.
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error("[relayer] CRON_SECRET is not configured. Refusing to run.")
  }
  const unauthorized = requireBearerAuth(request, process.env.CRON_SECRET)
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const dryRun = url.searchParams.get("dryRun") === "true"
  try {
    const result = await runRelayerOnce({ dryRun })
    return Response.json(result)
  } catch (error) {
    console.error("[relayer] run failed:", error)
    return Response.json(
      { detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export const POST = GET
