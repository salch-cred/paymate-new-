/**
 * GOAT bridge hop — small real-money test harness.
 *
 * Default (READ-ONLY): quotes the LayerZero fee for bridging DOGEB/BTCB from
 * the custody wallet on BSC to GOAT. No funds move.
 *
 *   npx tsx scripts/goat_bridge_probe.ts DOGEB 0.01
 *   npx tsx scripts/goat_bridge_probe.ts BTCB 0.0001
 *
 * With --send (FUND-MOVING): actually bridges the amount. Requires
 * GOAT_BRIDGE_VERIFIED=true and the custody wallet (PRIVATE_KEY) funded with
 * the BSC asset + BNB for the fee. Run with a TINY amount first:
 *
 *   GOAT_BRIDGE_VERIFIED=true npx tsx scripts/goat_bridge_probe.ts DOGEB 0.01 --send
 *
 * Env: PRIVATE_KEY, RPC_BSC_MAINNET (optional), GOAT_BRIDGE_VERIFIED (for --send)
 */
import {
  GOAT_BRIDGE_ASSETS,
  quoteBridgeToGoat,
  bridgeToGoat,
  toAmountLD,
  type GoatBridgeAsset,
} from "../src/lib/goatBridge"
import { getIssuerAccount } from "../src/lib/chain"

async function main() {
  const [assetArg, amountArg, flag] = process.argv.slice(2)
  const asset = (assetArg || "DOGEB").toUpperCase() as GoatBridgeAsset
  const cfg = GOAT_BRIDGE_ASSETS[asset]
  if (!cfg) {
    console.error(`Unknown asset ${assetArg}. Use DOGEB or BTCB.`)
    process.exit(1)
  }
  const whole = Number(amountArg ?? "0.01")
  if (!Number.isFinite(whole) || whole <= 0) {
    console.error(`Bad amount: ${amountArg}. Use e.g. 0.01`)
    process.exit(1)
  }
  const amountLD = toAmountLD(asset, whole)
  const account = getIssuerAccount()
  const sender = account?.address ?? "0x0000000000000000000000000000000000000000"

  console.log(`Bridge probe: ${whole} ${cfg.symbol} (${amountLD} LD) via ${cfg.adapter}`)
  console.log(`sender: ${sender}`)
  if (!account) console.log("(PRIVATE_KEY not set — quoting from the zero address)")

  console.log("\n— quoting LayerZero fee (read-only) —")
  const quote = await quoteBridgeToGoat(asset, amountLD, account?.address as `0x${string}` | undefined)
  console.log(`✅ quote OK (${quote.variant} variant): nativeFee=${quote.nativeFee} (${Number(quote.nativeFee) / 1e18} BNB), lzTokenFee=${quote.lzTokenFee}`)

  if (flag !== "--send") {
    console.log("\nQuote only — no funds moved. Re-run with --send to actually bridge (requires GOAT_BRIDGE_VERIFIED=true).")
    return
  }

  if (!account) {
    console.error("\nPRIVATE_KEY is not configured — cannot send.")
    process.exit(1)
  }
  console.log("\n— bridging (FUND-MOVING) —")
  const hash = await bridgeToGoat(asset, amountLD)
  console.log(`✅ bridged ${whole} ${cfg.symbol} → GOAT`)
  console.log(`BSC tx: https://bscscan.com/tx/${hash}`)
}

main().catch((e) => {
  console.error("\n✗ probe failed:", e instanceof Error ? e.message : e)
  process.exit(1)
})
