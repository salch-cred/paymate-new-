/**
 * Smoke tests for the Stage 2 growth-target logic behind the public /metrics
 * page. Run with: npx tsx scripts/metrics_smoke.ts
 */
import { TARGET_METRICS, computeTargetStatus, formatMetric } from "../src/lib/metrics"
import type { GrowthStats } from "../src/lib/db"

let passed = 0
let failed = 0

function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`)
  }
}

const fakeStats: GrowthStats = {
  totalInvoices: 120,
  paidInvoices: 85,
  pendingInvoices: 35,
  settlementRate: 71,
  totalVolumeSettled: 6400.5,
  outstandingVolume: 1200,
  uniqueFreelancers: 14,
  uniqueClients: 9,
  feedbackCount: 12,
  averageRating: 4.4,
  feedbackByRole: [],
  firstInvoiceAt: 1,
  lastInvoiceAt: 2,
  lastPaidInvoice: null,
  clawUpIntentInvoices: 3,
  clawUpIntentVolume: 150.25,
}

// 1. Metric mapping reads the right live stat
check(
  "paid_invoices maps to paidInvoices",
  TARGET_METRICS.find((m) => m.id === "paid_invoices")!.get(fakeStats) === 85,
)
check(
  "settled_volume_usd maps to totalVolumeSettled",
  TARGET_METRICS.find((m) => m.id === "settled_volume_usd")!.get(fakeStats) === 6400.5,
)
check(
  "seed_users maps to feedbackCount",
  TARGET_METRICS.find((m) => m.id === "seed_users")!.get(fakeStats) === 12,
)

// 2. Met / Not Met (all-or-nothing)
const met = computeTargetStatus(fakeStats, { metric: "paid_invoices", label: "Paid invoices", target: 80, updatedAt: 1 })
check("paid_invoices 80 vs actual 85 → MET", met.met === true && met.actual === 85)

const notMet = computeTargetStatus(fakeStats, { metric: "paid_invoices", label: "Paid invoices", target: 100, updatedAt: 1 })
check("paid_invoices 100 vs actual 85 → NOT MET", notMet.met === false && notMet.actual === 85)

const exact = computeTargetStatus(fakeStats, { metric: "seed_users", label: "Seed users", target: 12, updatedAt: 1 })
check("seed_users 12 vs actual 12 (exact) → MET", exact.met === true)

const volumeMet = computeTargetStatus(fakeStats, { metric: "settled_volume_usd", label: "Volume", target: 5000, updatedAt: 1 })
check("volume 5000 vs actual 6400.5 → MET", volumeMet.met === true)

const unknown = computeTargetStatus(fakeStats, { metric: "nope", label: "X", target: 5, updatedAt: 1 })
check("unknown metric → actual null, NOT MET", unknown.actual === null && unknown.met === false)

// 3. Formatting
check("formatMetric usd", formatMetric("usd", 6400.5) === "$6,400.50")
check("formatMetric count", formatMetric("count", 12000) === "12,000")

// 4. Every metric definition has a unique id and a valid label
const ids = TARGET_METRICS.map((m) => m.id)
check("metric ids unique", new Set(ids).size === ids.length)
check("all metrics have labels", TARGET_METRICS.every((m) => m.label.length > 0))

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
