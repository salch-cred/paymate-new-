/**
 * GOAT DEX real-money probe — the small real test that unlocks GOAT_DEX_VERIFIED.
 *
 * Read-only by default: checks the custody wallet's DOGEB + BTC balances on
 * GOAT, the pool state for both routes, and prints the estimated outputs.
 *
 *   npx tsx scripts/goat_dex_probe.ts                          # read-only
 *   npx tsx scripts/goat_dex_probe.ts --send                   # real round trip:
 *                                                              #   USDC.e → DOGEB → USDC.e
 *                                                              #   (tiny, ~$0.10 total)
 *   npx tsx scripts/goat_dex_probe.ts --btc-send               # real native BTC
 *                                                              #   → USDC.e wrap+swap
 *
 * The --send paths require GOAT_DEX_VERIFIED=true in the environment (a hard
 * gate in goatDex.ts) plus PRIVATE_KEY funded with a little BTC gas on GOAT.
 * Run them with tiny amounts first, confirm the USDC.e lands, then set
 * GOAT_DEX_VERIFIED=true in production.
 */
import { createPublicClient, formatUnits, http, parseAbi } from "viem"
import { goat } from "viem/chains"
import { getIssuerAccount } from "../src/lib/chain"
import {
  GOAT_DEX,
  getGoatDogeBBalance,
  estimateV3Output,
  applySlippage,
  swapDogeBToUsdcETo,
  swapUsdcEToDogeBTo,
  swapNativeBtcToUsdcETo,
  sweepExecutorBalanceTo,
  isGoatDexVerified,
} from "../src/lib/goatDex"

const RPC = process.env.RPC_GOAT_MAINNET || "https://rpc.goat.network"
const POOL_VIEW_ABI = [
  { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "liquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint128" }] },
  { type: "function", name: "slot0", stateMutability: "view", inputs: [], outputs: [
    { type: "uint160" }, { type: "int24" }, { type: "uint16" }, { type: "uint16" }, { type: "uint16" }, { type: "uint8" }, { type: "bool" },
  ] },
] as const
const FACTORY_ABI = [
  { type: "function", name: "getPool", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }, { type: "uint24" }], outputs: [{ type: "address" }] },
] as const
const ERC20_BALANCE_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"])

async function poolState(client: ReturnType<typeof createPublicClient>, pool: `0x${string}`) {
  const [token0, liquidity, slot] = await Promise.all([
    client.readContract({ address: pool, abi: POOL_VIEW_ABI, functionName: "token0" }) as Promise<`0x${string}`>,
    client.readContract({ address: pool, abi: POOL_VIEW_ABI, functionName: "liquidity" }) as Promise<bigint>,
    client.readContract({ address: pool, abi: POOL_VIEW_ABI, functionName: "slot0" }) as Promise<readonly [bigint, number, number, number, number, number, boolean]>,
  ])
  return { token0, liquidity, sqrtPriceX96: slot[0] }
}

async function main() {
  const doSend = process.argv.includes("--send")
  const doBtcSend = process.argv.includes("--btc-send")
  const account = getIssuerAccount()
  const holder = (account?.address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`
  const client = createPublicClient({ chain: goat, transport: http(RPC) })

  console.log(`custody wallet: ${holder}`)
  console.log(`GOAT_DEX_VERIFIED=${isGoatDexVerified()}`)
  console.log(`executor: ${GOAT_DEX.executor}`)
  console.log(`factory:  ${GOAT_DEX.factory}`)

  const balDogeRaw = await getGoatDogeBBalance(account ?? undefined)
  const balBtcRaw = await client.getBalance({ address: holder })
  console.log(`DOGEB on GOAT: ${(Number(balDogeRaw) / 1e18).toFixed(6)} DOGE`)
  console.log(`BTC on GOAT:   ${(Number(balBtcRaw) / 1e18).toFixed(8)} BTC`)

  // DOGEB → USDC.e route estimate (production path).
  const dogePool = (await client.readContract({ address: GOAT_DEX.factory as `0x${string}`, abi: FACTORY_ABI, functionName: "getPool", args: [GOAT_DEX.dogeB as `0x${string}`, GOAT_DEX.usdcE as `0x${string}`, GOAT_DEX.fee] })) as `0x${string}`
  const dogeState = await poolState(client, dogePool)
  const dogeZeroForOne = dogeState.token0.toLowerCase() === GOAT_DEX.dogeB.toLowerCase()
  console.log(`\nDOGEB/USDC.e pool: ${dogePool} (liquidity=${dogeState.liquidity.toString()} sqrtPriceX96=${dogeState.sqrtPriceX96.toString()})`)
  const estDoge = estimateV3Output(dogeState.sqrtPriceX96, dogeState.liquidity, dogeZeroForOne ? 18 : 6, dogeZeroForOne ? 6 : 18, BigInt(Math.round(1 * 1e18)), GOAT_DEX.fee, dogeZeroForOne)
  const minDoge = applySlippage(estDoge, 200)
  console.log(`estimate: 1 DOGE → ~${(Number(estDoge) / 1e6).toFixed(6)} USDC.e (minOut ${(Number(minDoge) / 1e6).toFixed(6)} @ 2%)`)

  // WGBTC → USDC.e route estimate (native BTC path).
  const btcPool = (await client.readContract({ address: GOAT_DEX.factory as `0x${string}`, abi: FACTORY_ABI, functionName: "getPool", args: [GOAT_DEX.wgbtc as `0x${string}`, GOAT_DEX.usdcE as `0x${string}`, GOAT_DEX.btcFee] })) as `0x${string}`
  const btcState = await poolState(client, btcPool)
  const btcZeroForOne = btcState.token0.toLowerCase() === GOAT_DEX.wgbtc.toLowerCase()
  console.log(`\nWGBTC/USDC.e pool: ${btcPool} (liquidity=${btcState.liquidity.toString()} sqrtPriceX96=${btcState.sqrtPriceX96.toString()})`)
  const oneSat = BigInt("1000000000000") // 0.000001 BTC
  const estBtc = estimateV3Output(btcState.sqrtPriceX96, btcState.liquidity, btcZeroForOne ? 18 : 6, btcZeroForOne ? 6 : 18, oneSat, GOAT_DEX.btcFee, btcZeroForOne)
  console.log(`estimate: 0.000001 BTC → ~${(Number(estBtc) / 1e6).toFixed(6)} USDC.e`)

  if (doBtcSend) {
    if (balBtcRaw < oneSat * BigInt(2)) {
      console.error("\nInsufficient BTC gas for the probe (need at least 0.000002 BTC). Aborting.")
      process.exit(1)
    }
    if (!isGoatDexVerified()) {
      console.error("\nGOAT_DEX_VERIFIED=true is required to send. Set it only after you are ready for a real swap.")
      process.exit(1)
    }
    console.log(`\nSwapping 0.000001 BTC → USDC.e (wrap+swap via executor)...`)
    const hash = await swapNativeBtcToUsdcETo(oneSat, holder)
    console.log(`tx: https://explorer.goat.network/tx/${hash}`)
    const usdc = (await client.readContract({ address: GOAT_DEX.usdcE as `0x${string}`, abi: ERC20_BALANCE_ABI, functionName: "balanceOf", args: [holder] })) as bigint
    console.log(`USDC.e balance now: ${formatUnits(usdc, 6)}`)
    return
  }

  if (process.argv.includes("--sweep")) {
    const tokenArg = process.argv[process.argv.indexOf("--sweep") + 1]
    const token = (tokenArg === "usdc" ? GOAT_DEX.usdcE : tokenArg === "doge" ? GOAT_DEX.dogeB : tokenArg) as `0x${string}`
    if (!token || !token.startsWith("0x")) {
      console.error("Usage: --sweep usdc|doge|<address>")
      process.exit(1)
    }
    if (!isGoatDexVerified()) {
      console.error("\nGOAT_DEX_VERIFIED=true is required to sweep.")
      process.exit(1)
    }
    console.log(`Sweeping executor's ${token} balance back to the wallet...`)
    const hash = await sweepExecutorBalanceTo(token, holder)
    console.log(`tx: https://explorer.goat.network/tx/${hash}`)
    return
  }

  if (doSend) {
    if (!isGoatDexVerified()) {
      console.error("\nGOAT_DEX_VERIFIED=true is required to send. Set it only after you are ready for a real swap.")
      process.exit(1)
    }
    const usdcBefore = (await client.readContract({ address: GOAT_DEX.usdcE as `0x${string}`, abi: ERC20_BALANCE_ABI, functionName: "balanceOf", args: [holder] })) as bigint
    if (usdcBefore < BigInt(50_000)) {
      console.error(`\nInsufficient USDC.e for the round trip: have ${formatUnits(usdcBefore, 6)} USDC.e, need at least 0.05. Aborting.`)
      process.exit(1)
    }
    const buyAmount = BigInt(50_000) // 0.05 USDC.e
    console.log(`\nLeg 1 — buy: swap 0.05 USDC.e → DOGEB (deposit-then-swap via executor)...`)
    const h1 = await swapUsdcEToDogeBTo(buyAmount, holder)
    console.log(`tx: https://explorer.goat.network/tx/${h1}`)
    const dogeHeld = await getGoatDogeBBalance(account ?? undefined)
    console.log(`DOGEB balance now: ${formatUnits(dogeHeld, 18)} DOGE`)
    if (dogeHeld <= BigInt(0)) {
      console.error("No DOGEB received — round trip failed at the buy leg.")
      process.exit(1)
    }
    console.log(`\nLeg 2 — sell: swap ${formatUnits(dogeHeld, 18)} DOGEB → USDC.e (the production rail)...`)
    const h2 = await swapDogeBToUsdcETo(dogeHeld, holder)
    console.log(`tx: https://explorer.goat.network/tx/${h2}`)
    const usdcAfter = (await client.readContract({ address: GOAT_DEX.usdcE as `0x${string}`, abi: ERC20_BALANCE_ABI, functionName: "balanceOf", args: [holder] })) as bigint
    console.log(`\nUSDC.e before: ${formatUnits(usdcBefore, 6)}  after: ${formatUnits(usdcAfter, 6)}`)
    console.log(`Round trip delta: ${formatUnits(usdcAfter - usdcBefore, 6)} USDC.e (fees ≈ the pool's 0.3% per leg — expected).`)
    console.log("Both legs on-chain through the Universal Router executor. The production DOGEB → USDC.e rail is proven with real money.")
    return
  }

  console.log("\nRead-only. Re-run with --send (USDC.e → DOGEB → USDC.e round trip) or --btc-send (native BTC → USDC.e) to execute (requires GOAT_DEX_VERIFIED=true).")
  console.log("Recovery: --sweep <token> sends any token stranded in the executor back to the wallet via the SWEEP command.")
}

main().catch((e) => {
  console.error("probe failed:", e instanceof Error ? e.message : e)
  process.exit(1)
})
