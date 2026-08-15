import { requireBearerAuth } from "@/lib/auth"
import { convertFreelancerDoge } from "@/lib/directConverter"
import { listDirectPaidFreelancers } from "@/lib/db"
import { isAddress } from "viem"

export const dynamic = "force-dynamic"

/**
 * Fee-as-spread converter trigger — the zero-custody rail's fee engine.
 *
 *   POST /api/relayer/direct-convert                → convert every freelancer
 *                                                     who received a direct payment
 *   POST /api/relayer/direct-convert                → body: { freelancer: "0x…" }
 *   POST /api/relayer/direct-convert?dryRun=true    → audit balances + plan only
 *
 * Requires CRON_SECRET (same guard as the other relayer crons). For each
 * target: pull the freelancer's GOAT DOGEB (they opted in with a one-time
 * allowance), swap the principal to USDC.e back to them on the GOAT DEX, and
 * keep the PAYMATE_FEE_RATE spread DOGEB in the custody wallet. Skipped
 * conditions (no opt-in, balance below min, DEX gate off) are reported, never
 * fatal. Register as a cron after GOAT_DEX_VERIFIED is live.
 */
export async function POST(request: Request) {
  const unauthorized = requireBearerAuth(request, process.env.CRON_SECRET)
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const dryRun = url.searchParams.get("dryRun") === "true"
  const body = await request.json().catch(() => null)
  const freelancer = typeof body?.freelancer === "string" ? body.freelancer.trim() : ""

  try {
    if (freelancer) {
      if (!isAddress(freelancer)) return Response.json({ detail: "Invalid freelancer address." }, { status: 400 })
      const result = await convertFreelancerDoge(freelancer, { dryRun })
      return Response.json({ ok: true, dryRun, results: [result] })
    }

    const targets = await listDirectPaidFreelancers()
    const results = []
    for (const target of targets) {
      results.push(await convertFreelancerDoge(target, { dryRun }))
    }
    return Response.json({ ok: true, dryRun, targets: targets.length, results })
  } catch (error) {
    console.error("[relayer/direct-convert] run failed:", error)
    return Response.json({ detail: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

export const GET = POST
