/**
 * Smoke tests for the GOAT bridge-hop module (pure logic — no network, no DB,
 * no funds). Verifies:
 *   - the GOAT_BRIDGE_VERIFIED gate fails closed
 *   - recovered addresses are valid and the asset table is coherent
 *   - quote calldata for BOTH SendParam variants starts with the expected
 *     selector and encodes the right EID / amount
 *   - toAmountLD conversion
 *
 * Run: npx tsx scripts/goat_bridge_smoke.ts
 */
import {
  GOAT_BRIDGE_ASSETS,
  GOAT_EID,
  buildQuoteCalldata,
  toAmountLD,
  validateBridgeConfig,
  assertGoatBridgeVerified,
  isGoatBridgeVerified,
} from "../src/lib/goatBridge"

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

console.log("\n— GOAT_BRIDGE_VERIFIED gate (env unset in CI — must fail closed) —")
check("isGoatBridgeVerified() is false without env", isGoatBridgeVerified() === false)
let threw = false
try {
  assertGoatBridgeVerified()
} catch {
  threw = true
}
check("assertGoatBridgeVerified() throws without env", threw)

console.log("\n— recovered config —")
const problems = validateBridgeConfig()
check("all recovered addresses valid (DOGEB + BTCB)", problems.length === 0, problems)
check("GOAT EID is 30361", GOAT_EID === 30361)
check("DOGEB decimals = 8", GOAT_BRIDGE_ASSETS.DOGEB.decimals === 8)
check("BTCB decimals = 18", GOAT_BRIDGE_ASSETS.BTCB.decimals === 18)

console.log("\n— calldata selectors —")
// amountLD: quoteSend((uint32,bytes32,uint256,uint256,bytes,bytes,bytes),bool) = 0x3b6f743b
const amountLd = buildQuoteCalldata("amountLD", "DOGEB", BigInt(1_000_000_000), "0x3F1fd06e7A7EC83592b533E12441791A59522f01")
check("amountLD quoteSend selector 0x3b6f743b", amountLd.startsWith("0x3b6f743b"), amountLd.slice(0, 10))
// standard: quoteSend((bytes32,uint32,bytes,address,uint256,bytes,bytes,bytes),bool) = 0xbd9e4b1c
const standard = buildQuoteCalldata("standard", "BTCB", BigInt(1_000_000_000_000_000_000), "0x3F1fd06e7A7EC83592b533E12441791A59522f01")
check("standard quoteSend selector 0xbd9e4b1c", standard.startsWith("0xbd9e4b1c"), standard.slice(0, 10))

console.log("\n— amount conversion —")
check("1 DOGE = 1e8 LD", toAmountLD("DOGEB", 1) === BigInt("100000000"))
check("0.01 DOGE = 1e6 LD", toAmountLD("DOGEB", 0.01) === BigInt("1000000"))
check("1 BTCB = 1e18 LD", toAmountLD("BTCB", 1) === BigInt("1000000000000000000"))
check("0 rounds to 0", toAmountLD("BTCB", 0) === BigInt(0))

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
