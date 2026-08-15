/**
 * Smoke tests for the self-refill orchestrator's pure logic (no network, no
 * funds, no DB):
 *   - planBridgeAmount: DOGEB floor, BNB gas buffer, negative/edge inputs
 *   - planSwapAmount: DOGEB floor on GOAT
 *
 * Run: npx tsx scripts/self_refill_smoke.ts
 */
import { planBridgeAmount, planSwapAmount } from "../src/lib/selfRefill"

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

console.log("\n— planBridgeAmount —")
check("bridges all DOGEB when BNB gas is above buffer", planBridgeAmount(10, 0.05, 1, 0.01) === 10)
check("bridges nothing below the DOGEB floor", planBridgeAmount(0.5, 0.05, 1, 0.01) === 0)
check("bridges nothing without BNB gas", planBridgeAmount(10, 0.005, 1, 0.01) === 0)
check("zero DOGEB → 0", planBridgeAmount(0, 0.05, 1, 0.01) === 0)
check("negative BNB → 0", planBridgeAmount(10, -1, 1, 0.01) === 0)
check("exactly at floor bridges", planBridgeAmount(1, 0.05, 1, 0.01) === 1)
check("zero gas buffer allows bridge with any BNB", planBridgeAmount(5, 0.0001, 1, 0) === 5)

console.log("\n— planSwapAmount —")
check("swaps all GOAT DOGEB above floor", planSwapAmount(2, 0.5) === 2)
check("nothing below floor", planSwapAmount(0.1, 0.5) === 0)
check("zero → 0", planSwapAmount(0, 0.5) === 0)
check("exactly at floor swaps", planSwapAmount(0.5, 0.5) === 0.5)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
