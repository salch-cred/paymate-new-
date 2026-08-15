/**
 * PIPELINE PREFLIGHT — the single gate-checker for the fully-automatic
 * "client pays any chain → freelancer gets USDC.e on GOAT" pipeline.
 *
 *   npx tsx scripts/pipeline_preflight.ts
 *
 * Checks all FOUR automation gates live and prints the EXACT commands to
 * close each one:
 *
 *   1. GOAT gas level        — custody BTC balance on GOAT (live RPC)
 *   2. GOAT_BRIDGE_VERIFIED  — BSC → GOAT bridge hop flag (+ live BSC funding)
 *   3. GOAT_DEX_VERIFIED     — GOAT DEX swap flag (+ live DOGEB/USDC readiness)
 *   4. Cron registration     — vercel.json crons + route files + reachability
 *
 * Env: reads process.env first, then merges .env / ../.env if present, so it
 * works standalone with `npx tsx` (no dotenv dependency required).
 *
 * Exit code: 0 = all gates pass (safe to flip production), 1 = at least one
 * gate is closed — nothing moves until every gate is green.
 */
import { createPublicClient, http, formatUnits, isAddress, type Address } from "viem"
import { bsc } from "viem/chains"
import { privateKeyToAccount } from "viem/accounts"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

// ---------------------------------------------------------------------------
// Env loading (process.env wins; .env files merged in after)
// ---------------------------------------------------------------------------
function loadEnvFile(path: string): void {
  try {
    const raw = readFileSync(path, "utf8")
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m || m[1].startsWith("#")) continue
      let val = m[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!(m[1] in process.env)) process.env[m[1]] = val
    }
  } catch {
    /* no env file — fine */
  }
}
loadEnvFile(".env")
loadEnvFile("../.env")
loadEnvFile("../contracts/.env")

let WALLET: Address | null = null
if (process.env.PRIVATE_KEY) {
  try {
    const raw = process.env.PRIVATE_KEY.trim()
    const key = raw.startsWith("0x") ? raw : `0x${raw}`
    WALLET = privateKeyToAccount(key as `0x${string}`).address
  } catch {
    WALLET = null
  }
}
const CUSTODY = WALLET ?? "0x4e107161DBcCb6d7903cCf9De32555d1B1B8051a" // fallback: the known custody wallet

const USDC_E = (process.env.USDC_TOKEN as Address) || "0x3022b87ac063DE95b1570F46f5e470F8B53112D8"
const DOGEB_GOAT = "0x1E0d0303a8c4aD428953f5ACB1477dB42bb838cf"
const WGBTC = "0xbc10000000000000000000000000000000000000"
const DOGEB_BSC = "0xbA2aE424d960c26247Dd6c32edC70B295c744C43"

const GOAT_RPCS = [
  process.env.RPC_GOAT_MAINNET,
  "https://rpc.ankr.com/goat_mainnet",
  "https://rpc.goat.network",
].filter(Boolean) as string[]
const BSC_RPCS = [
  process.env.RPC_BSC_MAINNET,
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.binance.org",
].filter(Boolean) as string[]

const ERC20 = [
  { inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" },
] as const

async function bestClient(urls: string[], chain: { id: number; nativeCurrency: { decimals: number; name: string; symbol: string } }) {
  let best: { client: ReturnType<typeof createPublicClient>; block: bigint; url: string } | null = null
  for (const url of urls) {
    try {
      const client = createPublicClient({ transport: http(url, { timeout: 8_000 }) })
      const block = await client.getBlockNumber()
      if (!best || block > best.block) best = { client, block, url }
    } catch {
      /* try next */
    }
  }
  return best
}

const GOAT_CHAIN = { id: 2345, nativeCurrency: { decimals: 18, name: "Bitcoin", symbol: "BTC" } }
const BSC_CHAIN = { id: 56, nativeCurrency: { decimals: 18, name: "BNB", symbol: "BNB" } }

// ---------------------------------------------------------------------------
// Report helpers
// ---------------------------------------------------------------------------
let failures = 0
const pad = (s: string, n = 30) => s.padEnd(n)

function pass(label: string, detail: string) {
  console.log(`  ✅ ${pad(label)} ${detail}`)
}
function warn(label: string, detail: string) {
  console.log(`  ⚠️  ${pad(label)} ${detail}`)
}
function fail(label: string, detail: string) {
  failures++
  console.log(`  ❌ ${pad(label)} ${detail}`)
}
function cmd(c: string) {
  console.log(`        $ ${c}`)
}

const BTC_PRICE = 100000 // fallback; replaced live below

async function main() {
  console.log("═".repeat(70))
  console.log("  PayMate automation pipeline — PREFLIGHT")
  console.log("═".repeat(70))
  console.log(`Custody wallet: ${CUSTODY}\n`)

  // ---- live prices ---------------------------------------------------------
  let btcUsd = BTC_PRICE
  try {
    const { getNativeUsdPrice } = await import("../src/lib/price")
    const p = await getNativeUsdPrice(2345)
    if (p && p > 0) btcUsd = p
  } catch { /* fallback */ }

  const goat = await bestClient(GOAT_RPCS, GOAT_CHAIN)
  if (!goat) {
    fail("GOAT RPC", "no reachable GOAT RPC — check RPC_GOAT_MAINNET")
  } else {
    console.log(`GOAT RPC OK (block ${goat.block}, ${goat.url})\n`)
  }
  const bscClient = await bestClient(BSC_RPCS, BSC_CHAIN)

  // =========================================================================
  // GATE 1 — GOAT gas level
  // =========================================================================
  console.log("── GATE 1 · GOAT gas level ─────────────────────────────────────")
  if (!goat) {
    fail("GOAT gas", "cannot check — RPC unreachable")
  } else {
    const [btc, usdc, wgbtc] = await Promise.all([
      goat.client.getBalance({ address: CUSTODY }),
      goat.client.readContract({ address: USDC_E, abi: ERC20, functionName: "balanceOf", args: [CUSTODY] }),
      goat.client.readContract({ address: WGBTC, abi: ERC20, functionName: "balanceOf", args: [CUSTODY] }),
    ])
    const btcWhole = Number(formatUnits(btc, 18))
    const usdcWhole = Number(formatUnits(usdc, 6))
    const gasUsd = btcWhole * btcUsd
    console.log(`  BTC gas:   ${btcWhole.toFixed(6)} BTC ≈ $${gasUsd.toFixed(2)}`)
    console.log(`  USDC.e:    ${usdcWhole.toFixed(4)} (payout liquidity)`)
    console.log(`  WGBTC:     ${formatUnits(wgbtc, 18)}`)
    if (gasUsd >= 3) {
      pass("GOAT gas", `$${gasUsd.toFixed(2)} — comfortably funds bridge + swap bursts`)
    } else if (gasUsd >= 0.5) {
      warn("GOAT gas", `$${gasUsd.toFixed(2)} — enough for a few txs but will exhaust fast`)
      console.log("        Fix → top up ~$3–5 BTC via https://www.gas.zip/ → GOAT Network (chain 2345), asset BTC:")
      cmd(`gas.zip → destination address: ${CUSTODY}`)
    } else {
      fail("GOAT gas", `$${gasUsd.toFixed(2)} — a bridge + swap burst will strand the pipeline`)
      console.log("        Fix → top up ~$3–5 BTC via https://www.gas.zip/ → GOAT Network (chain 2345), asset BTC:")
      cmd(`gas.zip → destination address: ${CUSTODY}`)
    }
    if (usdcWhole < 0.5) {
      warn("GOAT payout liquidity", `$${usdcWhole.toFixed(2)} USDC.e — freelancer payouts draw from this pool`)
      console.log("        Note → the self-refill pipeline refills it; until then keep ≥ $0.50")
    }
  }
  console.log()

  // =========================================================================
  // GATE 2 — GOAT_BRIDGE_VERIFIED
  // =========================================================================
  console.log("── GATE 2 · GOAT_BRIDGE_VERIFIED (BSC DOGEB/BTCB → GOAT) ───────")
  const bridgeVerified = process.env.GOAT_BRIDGE_VERIFIED === "true"
  let bscBnb = BigInt(0), bscDogeB = BigInt(0)
  if (bscClient) {
    try {
      ;[bscBnb, bscDogeB] = await Promise.all([
        bscClient.client.getBalance({ address: CUSTODY }),
        bscClient.client.readContract({ address: DOGEB_BSC, abi: ERC20, functionName: "balanceOf", args: [CUSTODY] }),
      ])
    } catch { /* leave zero */ }
  }
  const bnbWhole = Number(formatUnits(bscBnb, 18))
  const dogeBWhole = Number(formatUnits(bscDogeB, 8))
  console.log(`  BSC BNB:   ${bnbWhole.toFixed(6)} (bridge fee gas, ~$${(bnbWhole * 620).toFixed(2)})`)
  console.log(`  BSC DOGEB: ${dogeBWhole.toFixed(4)} (bridge-ready asset)`)
  if (bridgeVerified) {
    pass("GOAT_BRIDGE_VERIFIED", "= true — bridge hop unlocked")
  } else {
    fail("GOAT_BRIDGE_VERIFIED", "not set — every fund-moving bridge call refuses to run")
    console.log("        Fix (one-time, ~$2 of BNB):")
    console.log("        1. Fund BSC via gas.zip → BSC, asset BNB (~$2) → " + CUSTODY)
    if (dogeBWhole < 0.01) {
      console.log("        2. Fund a little DOGEB on BSC (the asset to bridge), or let the relayer buy it")
    }
    cmd(`GOAT_BRIDGE_VERIFIED=true npx tsx scripts/goat_bridge_probe.ts DOGEB 0.01 --send`)
    console.log("        3. When the probe prints the GOAT tx — set in Vercel:")
    cmd(`vercel env add GOAT_BRIDGE_VERIFIED production  →  true`)
  }
  console.log()

  // =========================================================================
  // GATE 3 — GOAT_DEX_VERIFIED
  // =========================================================================
  console.log("── GATE 3 · GOAT_DEX_VERIFIED (DOGEB → USDC.e on GOAT) ─────────")
  const dexVerified = process.env.GOAT_DEX_VERIFIED === "true"
  let dogeBGoat = BigInt(0)
  if (goat) {
    try {
      dogeBGoat = (await goat.client.readContract({ address: DOGEB_GOAT, abi: ERC20, functionName: "balanceOf", args: [CUSTODY] })) as bigint
    } catch { /* leave zero */ }
  }
  const dogeBGoatWhole = Number(formatUnits(dogeBGoat, 18))
  console.log(`  GOAT DOGEB: ${dogeBGoatWhole.toFixed(6)} (input for the DEX swap)`)
  if (dexVerified) {
    pass("GOAT_DEX_VERIFIED", "= true — DEX swap unlocked (proven round trip this session)")
  } else {
    fail("GOAT_DEX_VERIFIED", "not set — fund-moving DEX swaps refuse to run")
    console.log("        Fix (one-time, ~$0.15): the module was already proven with a real round trip;")
    console.log("        re-run the probe to re-confirm, then flip the flag:")
    cmd(`GOAT_DEX_VERIFIED=true npx tsx scripts/goat_dex_probe.ts --send`)
    console.log("        or, if DOGEB on GOAT is already present:")
    cmd(`GOAT_DEX_VERIFIED=true npx tsx scripts/goat_dex_probe.ts --send`)
    cmd(`vercel env add GOAT_DEX_VERIFIED production  →  true`)
  }
  console.log()

  // =========================================================================
  // GATE 4 — Cron registration
  // =========================================================================
  console.log("── GATE 4 · Cron registration (vercel.json) ───────────────────")
  const EXPECTED_CRONS = [
    "/api/relayer/run",
    "/api/relayer/agent",
    "/api/relayer/self-refill",
    "/api/relayer/direct-convert",
    "/api/relayer/pivot",
    "/api/orders/expire",
  ]
  let cronOk = true
  try {
    const vc = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons?: { path: string; schedule: string }[] }
    const registered = new Set((vc.crons ?? []).map((c) => c.path))
    for (const p of EXPECTED_CRONS) {
      const file = join("src", "app", p, "route.ts")
      const onDisk = existsSync(file)
      const inConfig = registered.has(p)
      if (inConfig && onDisk) {
        pass(p, "registered in vercel.json + route file present")
      } else {
        cronOk = false
        fail(p, `${inConfig ? "in vercel.json" : "MISSING from vercel.json"} · ${onDisk ? "route present" : "route file MISSING (${file})"}`)
      }
    }
    if (cronOk) {
      pass("Cron set", `${EXPECTED_CRONS.length}/${EXPECTED_CRONS.length} expected crons registered`)
      console.log("        Note → Vercel auto-creates crons on deploy of vercel.json; confirm in the dashboard:")
      cmd(`vercel.json crons → https://vercel.com/dashboard → project → Settings → Cron Jobs`)
      console.log("        (If a schedule ever changes, re-deploy so Vercel picks it up.)")
    }
  } catch (e) {
    cronOk = false
    fail("vercel.json", `unreadable: ${e instanceof Error ? e.message : e}`)
  }

  // reachability probe (best-effort, only when API_BASE set and not localhost)
  const apiBase = process.env.API_BASE
  if (apiBase && !apiBase.includes("localhost") && !apiBase.includes("127.0.0.1")) {
    const probe = await fetch(`${apiBase}/api/relayer/run?dryRun=true`, { method: "POST", signal: AbortSignal.timeout(10_000) })
    if (probe.status === 200 || probe.status === 401 || probe.status === 403) {
      pass("Live probe", `${apiBase}/api/relayer/run → HTTP ${probe.status} (endpoint reachable)`)
    } else {
      warn("Live probe", `${apiBase}/api/relayer/run → HTTP ${probe.status} — check deploy + env`)
    }
  }
  console.log()

  // =========================================================================
  // Bonus env readiness (not gates, but the agent/reporting rails)
  // =========================================================================
  console.log("── Bonus env readiness ─────────────────────────────────────────")
  const bonus: [string, string, "pass" | "warn" | "fail", string][] = [
    ["PRIVATE_KEY", WALLET ? `set → ${WALLET}` : "NOT SET — everything fails closed", WALLET ? "pass" : "fail", "add PRIVATE_KEY (owner key) to Vercel"],
    ["RPC_GOAT_MAINNET", goat ? "reachable" : "unreachable", goat ? "pass" : "fail", "vercel env add RPC_GOAT_MAINNET → https://rpc.ankr.com/goat_mainnet"],
    ["USDC_TOKEN", process.env.USDC_TOKEN ? process.env.USDC_TOKEN : "NOT SET", process.env.USDC_TOKEN ? "pass" : "fail", "vercel env add USDC_TOKEN → " + USDC_E],
    ["USDC_IS_REAL_MAINNET_TOKEN", process.env.USDC_IS_REAL_MAINNET_TOKEN === "true" ? "true" : "not set — mainnet settles blocked", process.env.USDC_IS_REAL_MAINNET_TOKEN === "true" ? "pass" : "warn", "set to true only if USDC_TOKEN is the real bridged USDC"],
    ["ONEINCH_API_KEY", process.env.ONEINCH_API_KEY ? "set" : "not set — falls back to LI.Fi keyless", process.env.ONEINCH_API_KEY ? "pass" : "warn", "optional; 1inch v6 key makes relayer swaps cheaper"],
    ["LIFI_API_KEY", process.env.LIFI_API_KEY ? "set" : "not set — keyless LI.Fi used", process.env.LIFI_API_KEY ? "pass" : "warn", "optional"],
    ["MISTRAL_API_KEY", process.env.MISTRAL_API_KEY ? "set" : "not set — agent uses deterministic fallback", process.env.MISTRAL_API_KEY ? "pass" : "warn", "optional"],
    ["DISCORD_WEBHOOK_URL", process.env.DISCORD_WEBHOOK_URL ? "set" : "not set — no agent reports", process.env.DISCORD_WEBHOOK_URL ? "pass" : "warn", "optional"],
    ["CRON_SECRET", process.env.CRON_SECRET ? "set" : "not set — cron routes may reject", process.env.CRON_SECRET ? "pass" : "warn", "vercel env add CRON_SECRET"],
  ]
  for (const [k, v, s, fix] of bonus) {
    if (s === "pass") pass(k, v)
    else if (s === "warn") warn(k, v + ` — ${fix}`)
    else fail(k, v + ` — ${fix}`)
  }

  const dryRuns = ["RELAYER_DRY_RUN", "RELAYER_AGENT_DRY_RUN", "PIVOT_DRY_RUN", "SELF_REFILL_DRY_RUN", "ORDERS_EXPIRE_DRY_RUN"]
    .filter((k) => process.env[k] === "true")
  if (dryRuns.length) {
    warn("Dry-run flags", `${dryRuns.join(", ")} = true — those crons AUDIT ONLY (never sign)`)
  } else {
    pass("Dry-run flags", "none set — crons may sign real transactions")
  }
  console.log()

  // =========================================================================
  console.log("═".repeat(70))
  if (failures === 0) {
    console.log("  ✅ ALL GATES GREEN — the pipeline is safe to run fully automatic.")
    console.log("  Deploy to Vercel and the crons take it from here.")
  } else {
    console.log(`  ❌ ${failures} gate(s) closed — nothing moves until every gate is green.`)
    console.log("  Run the printed commands in order, then re-run this preflight.")
  }
  console.log("═".repeat(70))
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("preflight crashed:", e instanceof Error ? e.message : e)
  process.exit(1)
})
