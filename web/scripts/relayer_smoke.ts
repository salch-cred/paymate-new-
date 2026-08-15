/**
 * Smoke tests for the background relayer's pure logic (no network, no DB):
 *   - pickUsdcFromTokens: exact USDC preferred, USDC.e fallback, invalid skipped
 *   - computeSwapAmount: gas reserve math, edge cases, multiplier scaling
 *
 * Run: npx tsx scripts/relayer_smoke.ts
 */
import { pickUsdcFromTokens, computeSwapAmount } from "../src/lib/relayer"

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

// Lowercase — viem isAddress() validates EIP-55 checksums on mixed-case input,
// so fabricated checksums would fail the fixture. Lowercase bypasses that.
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
const USDC_E = "0xa7d7079b0fead91f3e65f86e8915cb59c1a391c7"
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"

// BigInt() calls (not `n` literals) — the repo targets ES2017.
const ETHER = BigInt("1000000000000000000") // 1 ETH in wei
const GAS = BigInt("210000") // typical swap gas
const GAS_PRICE = BigInt("30000000000") // 30 gwei

console.log("\n— pickUsdcFromTokens —")
check(
  "exact USDC preferred over USDT",
  pickUsdcFromTokens([
    { symbol: "USDT", address: USDT },
    { symbol: "USDC", address: USDC },
  ]) === USDC,
)
check(
  "USDC.e fallback when only bridged variant exists",
  pickUsdcFromTokens([
    { symbol: "USDT", address: USDT },
    { symbol: "USDC.e", address: USDC_E },
  ]) === USDC_E,
)
check(
  "exact USDC wins over USDC.e",
  pickUsdcFromTokens([
    { symbol: "USDC.e", address: USDC_E },
    { symbol: "USDC", address: USDC },
  ]) === USDC,
)
check(
  "case-insensitive symbol match",
  pickUsdcFromTokens([{ symbol: "usdc", address: USDC }]) === USDC,
)
check(
  "invalid address ignored → null",
  pickUsdcFromTokens([{ symbol: "USDC", address: "0x123" }]) === null,
)
check(
  "no USDC → null",
  pickUsdcFromTokens([{ symbol: "USDT", address: USDT }, { symbol: "WBTC", address: USDT }]) === null,
)
check("empty list → null", pickUsdcFromTokens([]) === null)
check("non-array → null", pickUsdcFromTokens(null as unknown as never[]) === null)

console.log("\n— computeSwapAmount —")
// reserve = 210_000 * 30e9 * 1.5 = 9.45e15 ; amount = 1e18 - 9.45e15 = 990.55e15
const amount = computeSwapAmount(ETHER, GAS, GAS_PRICE, 1.5)
check("1 ETH deposit minus 1.5x gas reserve", amount === BigInt("990550000000000000"), amount.toString())

check(
  "deposit fully consumed by reserve → 0",
  computeSwapAmount(BigInt("9000000000000000"), GAS, GAS_PRICE, 1.5) === BigInt(0),
)

check(
  "exactly-consumed deposit → 0",
  computeSwapAmount(BigInt("9450000000000000"), GAS, GAS_PRICE, 1.5) === BigInt(0),
)

check(
  "multiplier 1.0 reserves only gas×price",
  computeSwapAmount(ETHER, GAS, GAS_PRICE, 1) === BigInt("993700000000000000"),
)

check(
  "multiplier below 1 clamps to 1",
  computeSwapAmount(ETHER, GAS, GAS_PRICE, 0.5) === BigInt("993700000000000000"),
)

check(
  "zero gas estimate → swap everything",
  computeSwapAmount(BigInt(500), BigInt(0), GAS_PRICE, 1.5) === BigInt(500),
)

check("zero deposit → 0", computeSwapAmount(BigInt(0), GAS, GAS_PRICE, 1.5) === BigInt(0))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
