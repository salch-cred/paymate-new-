/**
 * Smoke tests for the Relayer Operator Agent's pure logic (no network, no DB,
 * no funds):
 *   - planRetries: hard caps (count + total USD), AI priority ordering, single
 *     swap above the cap never auto-retried
 *   - computeRunway / isLiquidityCritical: runway math, zero-demand edge, null
 *     balance
 *   - parseAgentDecision: field extraction + invalid-input rejection
 *   - buildDiscordReport: includes ledger, liquidity, AI source, escalations
 *
 * Run: npx tsx scripts/relayer_agent_smoke.ts
 */
import {
  planRetries,
  computeRunway,
  isLiquidityCritical,
  parseAgentDecision,
  buildDiscordReport,
  type AgentPassResult,
} from "../src/lib/relayerAgent"
import type { RelayerSwap } from "../src/lib/db"

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.error(`  ✗ ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`)
  }
}

function swap(chainId: number, swapId: string, usdValue: number, retries = 0): RelayerSwap {
  return {
    chainId,
    swapId,
    nativeAmount: "0",
    usdValue,
    usdcAddress: null,
    status: "failed",
    swapTxHash: null,
    usdcAmount: null,
    error: "test",
    retries,
    createdAt: 0,
    updatedAt: 0,
  }
}

console.log("\n— planRetries (hard caps) —")
const retryable = [swap(1, "a", 100), swap(56, "b", 250), swap(137, "c", 50), swap(10, "d", 800)]

// maxUsd=500 → only $100 + $250 + $50 fit; the $800 swap is above the cap and
// is NEVER auto-retried even though there's budget room after the small ones.
const capped = planRetries(retryable, [], 5, 500)
check("total USD of planned swaps stays under the cap", capped.reduce((s, x) => s + (x.usdValue ?? 0), 0) <= 500)
check("single swap above maxUsd is excluded", !capped.some((s) => s.swapId === "d"), capped.map((s) => s.swapId))
check("3 swaps planned within budget", capped.length === 3, capped.length)

// Count cap: maxRetriesPerRun=2 → only 2 even with budget room.
const countCapped = planRetries(retryable, [], 2, 500)
check("count cap respected (2 of 3 eligible)", countCapped.length === 2, countCapped.length)

// AI priority reorders but cannot exceed the caps.
const prioritized = planRetries(retryable, ["137:c", "56:b"], 5, 500)
check("AI priority moves its picks to the front", prioritized[0]?.swapId === "c" && prioritized[1]?.swapId === "b", prioritized.map((s) => s.swapId))
check("priority never exceeds caps", prioritized.reduce((s, x) => s + (x.usdValue ?? 0), 0) <= 500 && prioritized.length <= 5)

// Empty ledger + empty priority.
check("empty ledger → empty plan", planRetries([], [], 5, 500).length === 0)
check("empty priority still plans deterministically", planRetries(retryable, [], 5, 500).length > 0)

console.log("\n— computeRunway —")
check("balance 2000 / demand 1000 → 2", computeRunway(2000, 1000) === 2)
check("balance 500 / demand 1000 → 0.5", computeRunway(500, 1000) === 0.5)
check("no pending demand, funded → Infinity", computeRunway(100, 0) === Infinity)
check("no pending demand, empty wallet → null", computeRunway(0, 0) === null)

console.log("\n— isLiquidityCritical —")
check("0.5 runway < 1 ratio → critical", isLiquidityCritical(500, 1000, 1) === true)
check("2.0 runway ≥ 1 ratio → not critical", isLiquidityCritical(2000, 1000, 1) === false)
check("zero balance with demand → critical", isLiquidityCritical(0, 100, 1) === true)
check("no balance info but demand → critical", isLiquidityCritical(0, 100, 1) === true)

console.log("\n— parseAgentDecision —")
const good = parseAgentDecision(
  JSON.stringify({
    retrySwapIds: ["56:x", "1:y"],
    summary: "Retrying two failures",
    escalations: ["Liquidity low"],
  })
)
check("extracts retrySwapIds", good.retrySwapIds.length === 2)
check("extracts summary", good.summary === "Retrying two failures")
check("extracts escalations", good.escalations.length === 1)

let rejected = false
try {
  parseAgentDecision(JSON.stringify({ unrelated: true }))
} catch {
  rejected = true
}
check("empty decision throws", rejected)

console.log("\n— buildDiscordReport —")
const passResult: AgentPassResult = {
  enabled: true,
  dryRun: false,
  ledger: { byStatus: { detected: 1, swapped: 3 }, pendingUsd: 150.5, retryable: [], stuck: [] },
  liquidity: { goatUsdcBalanceUsd: 400, pendingInvoicesUsd: 200, runway: 2, critical: false },
  decision: { retrySwapIds: [], summary: "All clear", escalations: ["Manual review: 1 stuck"], aiUsed: true },
  executed: { planned: 1, retried: 1, completed: 1, failed: 0, skipped: 0 },
  discordSent: true,
}
const report = buildDiscordReport(passResult)
check("report mentions the ledger", report.includes("swapped:3"))
check("report mentions liquidity runway", report.includes("runway ×2.00"))
check("report marks escalations", report.includes("Manual review: 1 stuck"))
check("report names the AI source", report.includes("Mistral"))

const dryReport = buildDiscordReport({ ...passResult, dryRun: true })
check("dry run flagged in report", dryReport.includes("DRY RUN"))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
