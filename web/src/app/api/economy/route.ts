import { getGrowthStats, getTopSettlers, getRecentSettlements } from "@/lib/db"

/**
 * Public read-only snapshot of the PayMate economy, powering the /economy
 * page. Same data class as /api/growth (aggregates + public wallet addresses),
 * plus the leaderboard and the live settlement feed.
 */
export async function GET() {
  try {
    const [stats, topAgents, recentSettlements] = await Promise.all([
      getGrowthStats(),
      getTopSettlers(10),
      getRecentSettlements(12),
    ])
    return Response.json({ stats, topAgents, recentSettlements, generatedAt: Date.now() })
  } catch (error) {
    console.error("[api/economy] failed:", error)
    return Response.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
