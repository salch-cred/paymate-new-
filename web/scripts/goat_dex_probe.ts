/**
 * GOAT DEX real-money probe — the small real test that unlocks GOAT_DEX_VERIFIED.
 *
 * Read-only by default: checks the custody wallet's DOGEB balance on GOAT, the
 * pool state, and prints the estimated DOGEB → USDC.e output for an amount.
 *
 *   npx tsx scripts/goat_dex_probe.ts                  # read-only estimate
 *   npx tsx scripts/goat_dex_probe.ts 0.5 --send       # real swap (gated)
 *
 * The --send path requires GOAT_DEX_VERIFIED=true in the environment (a hard
 * gate in goatDex.ts) plus PRIVATE_KEY funded with DOGEB + a little BTC gas on
 * GOAT. Run it with a tiny amount first, confirm the USDC.e lands, then set
 * GOAT_DEX_VERIFIED=true in production.
 */
import { getIssuerAccount } from "../src/lib/chain"
import {
  GOAT_DEX,
  getGoatDogeBBalance,
  estimateV3Output,
  applySlippage,
  swapDogeBToUsdcE,
  isGoatDexVerified,
} from "../src/lib/goatDex"
import { createPublicClient, http } from "viem"
import { goat } from "viem/chains"

const RPC = process.env.RPC_GOAT_MAINNET || "https://rpc.goat.network"
const POOL_VIEW_ABI = [
  { type: "function", name: "liquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint128" }] },
  { type: "function", name: "slot0", stateMutability: "view", inputs: [], outputs: [
    { type: "uint160" }, { type: "int24" }, { type: "uint16" }, { type: "uint16" }, { type: "uint16" }, { type: "uint8" }, { type: "bool" },
  ] },
] as const

async function main() {
  const amountDoge = process.argv[2] ? Number(process.argv[2]) : 1
  const doSend = process.argv.includes("--send")
  const account = getIssuerAccount()
  const holder = account?.address ?? "0x0000000000000000000000000000000000000000"
  const client = createPublicClient({ chain: goat, transport: http(RPC) })

  console.log(`custody wallet: ${holder}`)
  console.log(`GOAT_DEX_VERIFIED=${isGoatDexVerified()}`)
  console.log(`router: ${GOAT_DEX.router}`)
  console.log(`pool:   ${GOAT_DEX.pool} (fee ${GOAT_DEX.fee})`)

  const balRaw = await getGoatDogeBBalance(account ?? undefined)
  const balDoge = Number(balRaw) / 1e18
  console.log(`DOGEB on GOAT: ${balDoge.toFixed(6)} DOGE`)

  const liquidity = (await client.readContract({ address: GOAT_DEX.pool as `0x${string}`, abi: POOL_VIEW_ABI, functionName: "liquidity" })) as bigint
  const slot = (await client.readContract({ address: GOAT_DEX.pool as `0x${string}`, abi: POOL_VIEW_ABI, functionName: "slot0" })) as readonly [bigint, number, number, number, number, number, boolean]
  console.log(`pool liquidity=${liquidity.toString()} sqrtPriceX96=${slot[0].toString()}`)

  const amountRaw = BigInt(Math.round(amountDoge * 1e18))
  const est = estimateV3Output(slot[0], liquidity, 18, 6, amountRaw, GOAT_DEX.fee, true)
  const minOut = applySlippage(est, 200)
  console.log(`\nestimate: ${amountDoge} DOGEB → ~${(Number(est) / 1e6).toFixed(4)} USDC.e (minOut ${(Number(minOut) / 1e6).toFixed(4)} @ 2% slippage)`)

  if (doSend) {
    if (Number(balRaw) < amountRaw) {
      console.error(`\nInsufficient DOGEB: have ${balDoge.toFixed(6)} DOGE, want ${amountDoge}. Aborting.`)
      process.exit(1)
    }
    if (!isGoatDexVerified()) {
      console.error("\nGOAT_DEX_VERIFIED=true is required to send. Set it only after you are ready for a real swap.")
      process.exit(1)
    }
    console.log(`\nSwapping ${amountDoge} DOGEB → USDC.e...`)
    const hash = await swapDogeBToUsdcE(amountRaw)
    console.log(`tx: https://explorer.goat.network/tx/${hash}`)
    console.log("Confirm the USDC.e landed on GOAT, then the gate is proven.")
  } else {
    console.log("\nRead-only. Re-run with --send to execute (requires GOAT_DEX_VERIFIED=true).")
  }
}

main().catch((e) => {
  console.error("probe failed:", e instanceof Error ? e.message : e)
  process.exit(1)
})
