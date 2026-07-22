import { getGrowthStats, listFeedback } from "@/lib/db"

export async function GET() {
  const [stats, feedback] = await Promise.all([getGrowthStats(), listFeedback(100)])
  return Response.json({ stats, feedback })
}
