import type { GrowthStats } from "./db"

/**
 * Stage 2 growth-target metrics.
 *
 * The bootcamp judges compare our locked baseline targets (submitted at the
 * start of Stage 2) against final results. Each metric maps to a live value
 * read from the production database; the /metrics page renders
 * target-vs-actual with MET / NOT MET badges.
 */
export interface TargetMetricDef {
  id: string
  label: string
  kind: "count" | "usd"
  get: (stats: GrowthStats) => number
}

export const TARGET_METRICS: TargetMetricDef[] = [
  { id: "paid_invoices", label: "Paid invoices", kind: "count", get: (s) => s.paidInvoices },
  { id: "settled_volume_usd", label: "Volume settled (USDC)", kind: "usd", get: (s) => s.totalVolumeSettled },
  { id: "seed_users", label: "Seed users (feedback)", kind: "count", get: (s) => s.feedbackCount },
  { id: "unique_clients", label: "Unique clients", kind: "count", get: (s) => s.uniqueClients },
  { id: "unique_freelancers", label: "Unique freelancers", kind: "count", get: (s) => s.uniqueFreelancers },
]

export function formatMetric(kind: "count" | "usd", value: number): string {
  if (kind === "usd") {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return value.toLocaleString("en-US")
}

export interface TargetStatus {
  metric: string
  label: string
  kind: "count" | "usd"
  target: number
  actual: number | null
  met: boolean
  updatedAt: number
}

/**
 * Computes a target's actual value from live stats and whether it is met.
 * A target counts as met only when actual >= target (all-or-nothing, never
 * prorated — matching the bootcamp's growth evaluation rule).
 */
export function computeTargetStatus(
  stats: GrowthStats,
  target: { metric: string; label: string; target: number; updatedAt: number },
): TargetStatus {
  const def = TARGET_METRICS.find((m) => m.id === target.metric)
  const actual = def ? def.get(stats) : null
  return {
    metric: target.metric,
    label: target.label,
    kind: def?.kind ?? "count",
    target: target.target,
    actual,
    met: actual !== null && target.target > 0 && actual >= target.target,
    updatedAt: target.updatedAt,
  }
}
