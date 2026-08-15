/**
 * Smoke tests for the GOAT DEX module's pure logic (no network, no funds):
 *   - estimateV3Output: direction, zero-input, zero-liquidity, monotonicity
 *   - applySlippage: 2% tolerance math, extremes
 *   - dogeBAmount: whole DOGE → 18-decimals raw
 *   - validateGoatDexConfig: recovered addresses are valid
 *
 * Run: npx tsx scripts/goat_dex_smoke.ts
 */
import {
  estimateV3Output,
  applySlippage,
  dogeBAmount,
  validateGoatDexConfig,
  GOAT_DEX,
} from "../src/lib/goatDex"

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

// BigInt() calls — the repo targets ES2017 (no `n` literals).
// Real DOGEB/USDC.e pool values (live on GOAT mainnet, probed on-chain):
//   pool 0x186F458E… slot0 sqrtPriceX96 + liquidity, DOGEB(18)/USDC.e(6),
//   fee tier 3000 (0.3%). Pool price ≈ $0.07 per DOGE.
const sqrtPriceX96 = BigInt("20955958044636001563069")
const LIQUIDITY = BigInt("104341102474796625")

const ONE_DOGE = BigInt("1000000000000000000") // 1 DOGEB raw (18 dec)
const FEE_BPS = 3000

console.log("\n— estimateV3Output —")
const out0to1 = estimateV3Output(sqrtPriceX96, LIQUIDITY, 18, 6, ONE_DOGE, FEE_BPS, true)
check("selling DOGEB yields USDC.e > 0", out0to1 > BigInt(0), out0to1.toString())
// Pool price ≈ 0.07 → 1 DOGEB ≈ 0.06975 USDC.e (after 0.3% fee).
check(
  "1 DOGEB → ~0.0697 USDC.e",
  Number(out0to1) / 1e6 >= 0.06 && Number(out0to1) / 1e6 <= 0.08,
  (Number(out0to1) / 1e6).toFixed(4),
)
check("zero input → 0", estimateV3Output(sqrtPriceX96, LIQUIDITY, 18, 6, BigInt(0), FEE_BPS, true) === BigInt(0))
check("zero liquidity → 0", estimateV3Output(sqrtPriceX96, BigInt(0), 18, 6, ONE_DOGE, FEE_BPS, true) === BigInt(0))
check(
  "more input → more output (monotonic)",
  estimateV3Output(sqrtPriceX96, LIQUIDITY, 18, 6, ONE_DOGE * BigInt(2), FEE_BPS, true) > out0to1,
)
// Fee applies: output with fee must be less than without (fee tier 0 → no fee).
const noFee = estimateV3Output(sqrtPriceX96, LIQUIDITY, 18, 6, ONE_DOGE, 0, true)
check("fee reduces output", out0to1 < noFee)
// Reverse direction sanity: selling USDC.e for DOGEB yields DOGEB > 0.
const out1to0 = estimateV3Output(sqrtPriceX96, LIQUIDITY, 18, 6, BigInt("70000000"), FEE_BPS, false)
check("selling USDC.e yields DOGEB > 0", out1to0 > BigInt(0), out1to0.toString())

console.log("\n— applySlippage —")
const est = BigInt("70000000") // 70 USDC.e raw (1e6)
check("2% slippage keeps 98%", applySlippage(est, 200) === BigInt("68600000"))
check("0 slippage keeps 100%", applySlippage(est, 0) === est)
check("10% slippage keeps 90%", applySlippage(est, 1000) === BigInt("63000000"))
check("zero estimate → 0", applySlippage(BigInt(0), 200) === BigInt(0))
check("oversized slippage clamps", applySlippage(est, 99999) === BigInt(0))

console.log("\n— dogeBAmount —")
check("1 DOGE → 1e18 raw", dogeBAmount(1) === BigInt("1000000000000000000"))
check("0.5 DOGE → 5e17 raw", dogeBAmount(0.5) === BigInt("500000000000000000"))

console.log("\n— validateGoatDexConfig —")
check("no config problems", validateGoatDexConfig().length === 0, validateGoatDexConfig())
check("router is checksummed-sane", /^0x[0-9a-fA-F]{40}$/.test(GOAT_DEX.router))
check("fee is 3000", GOAT_DEX.fee === 3000)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
