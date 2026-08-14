import { NextResponse } from "next/server"
import { getGrowthStats, getGrowthTargets, getRecentSettlements, getTopSettlers } from "@/lib/db"
import { computeTargetStatus } from "@/lib/metrics"

/**
 * GET /api/metrics — the public evidence endpoint for the bootcamp's Stage 2
 * Product Growth Metrics Report. Returns live stats straight from the
 * production database (no fabricated numbers), the locked growth targets with
 * MET / NOT MET status computed against actuals, the top settlers, and the
 * recent settlement feed (each with its GOAT explorer tx hash).
 */
export async function GET() {
  try {
    const [stats, targets, topSettlers, recentSettlements] = await Promise.all([
      getGrowthStats(),
      getGrowthTargets(),
      getTopSettlers(10),
      getRecentSettlements(12),
    ])

    const targetsWithStatus = targets.map((t) => computeTargetStatus(stats, t))

    return NextResponse.json({ stats, targets: targetsWithStatus, topSettlers, recentSettlements })
  } catch (error) {
    console.error("[api/metrics] failed:", error)
    return NextResponse.json({ detail: "Failed to load metrics" }, { status: 500 })
  }
}
