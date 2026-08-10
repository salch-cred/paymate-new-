import { getTreasuryStats } from "@/lib/db"

export async function GET() {
  const stats = await getTreasuryStats()
  return Response.json({ ...stats, totalBurnedUsd: 0 })
}
