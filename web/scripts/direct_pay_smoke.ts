/**
 * Direct-to-freelancer rail smoke tests — pure logic only, no network, no
 * funds. Covers: plan math (principal from USD, swap buffer), eligibility
 * gates, bridge calldata construction (decodes back to the freelancer), and
 * the fee-as-spread conversion split.
 *
 *   npx tsx scripts/direct_pay_smoke.ts
 */

import { decodeFunctionData, encodeFunctionData } from "viem"
import {
  amountLDToDogeB,
  principalDogeRawFromUsd,
  swapTargetDogeRaw,
  assertDirectPayEligible,
  BSC_DOGEB,
} from "../src/lib/directPay"
import { buildBridgeSendCalldata, GOAT_EID, type BridgeVariant } from "../src/lib/goatBridge"
import { computeConversionSplit } from "../src/lib/directConverter"
import type { Invoice } from "../src/lib/db"

const AMOUNT_LD_ABI = [
  {
    type: "function",
    name: "send",
    stateMutability: "payable",
    inputs: [
      {
        name: "_sendParam",
        type: "tuple",
        components: [
          { name: "dstEid", type: "uint32" },
          { name: "to", type: "bytes32" },
          { name: "amountLD", type: "uint256" },
          { name: "minAmountLD", type: "uint256" },
          { name: "extraOptions", type: "bytes" },
          { name: "composeMsg", type: "bytes" },
          { name: "oftCmd", type: "bytes" },
        ],
      },
      {
        name: "_fee",
        type: "tuple",
        components: [
          { name: "nativeFee", type: "uint256" },
          { name: "lzTokenFee", type: "uint256" },
        ],
      },
      { name: "_refundAddress", type: "address" },
    ],
    outputs: [],
  },
] as const

const STANDARD_ABI = [
  {
    type: "function",
    name: "send",
    stateMutability: "payable",
    inputs: [
      {
        name: "_sendParam",
        type: "tuple",
        components: [
          { name: "to", type: "bytes32" },
          { name: "dstEid", type: "uint32" },
          { name: "toAddress", type: "bytes" },
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "composeMsg", type: "bytes" },
          { name: "extraOptions", type: "bytes" },
          { name: "oftCmd", type: "bytes" },
        ],
      },
      {
        name: "_fee",
        type: "tuple",
        components: [
          { name: "nativeFee", type: "uint256" },
          { name: "lzTokenFee", type: "uint256" },
        ],
      },
      { name: "_refundAddress", type: "address" },
    ],
    outputs: [],
  },
] as const

let passed = 0
let failed = 0
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name} ${extra}`)
  }
}

function baseInvoice(over: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-test-1",
    freelancer: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    client: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    title: "Test",
    description: "test invoice",
    amountUsd: 100,
    status: "pending",
    chain: "goat",
    dueDate: null,
    txHash: null,
    createdAt: Date.now(),
    paidAt: null,
    cancelledAt: null,
    webhookUrl: null,
    signature: null,
    ipfsReceipt: null,
    splits: null,
    recurring: null,
    recurringParentId: null,
    milestones: null,
    isStream: false,
    streamRateUsd: null,
    streamedAmountUsd: 0,
    streamSignature: null,
    streamAuthorizedAt: null,
    isPrivate: false,
    zkCommitment: null,
    githubPrUrl: null,
    isYieldBearing: false,
    yieldEarned: 0,
    isSwarm: false,
    swarmWallets: null,
    proofOfCompute: false,
    computeHash: null,
    escrowStatus: "none",
    escrowTxHash: null,
    apiKeyId: null,
    paywallContent: null,
    merchantOrderId: null,
    merchantWebhookSecret: null,
    ...over,
  }
}

console.log("— plan math —")
{
  const p = principalDogeRawFromUsd(100, 0.25)
  check("$100 @ $0.25/DOGE → 400 DOGE (4e10 raw 8-dec)", p === BigInt(4_000_000_0000), p.toString())
  check("zero price → 0 (fail closed)", principalDogeRawFromUsd(100, 0) === BigInt(0))
  check("zero amount → 0", principalDogeRawFromUsd(0, 0.25) === BigInt(0))
  const t = swapTargetDogeRaw(BigInt(4_000_000_0000))
  check("swap target = principal × 1.03", t === BigInt(4_120_000_0000), t.toString())
  check("round trip 400 DOGE", amountLDToDogeB(BigInt(4_000_000_0000)) === 400)
}

console.log("— eligibility gates —")
{
  check("simple pending invoice is eligible", (() => { try { assertDirectPayEligible(baseInvoice()); return true } catch { return false } })())
  check("paid rejected", (() => { try { assertDirectPayEligible(baseInvoice({ status: "paid" })); return false } catch { return true } })())
  check("escrow rejected", (() => { try { assertDirectPayEligible(baseInvoice({ githubPrUrl: "https://github.com/x/y/pull/1" })); return false } catch { return true } })())
  check("stream rejected", (() => { try { assertDirectPayEligible(baseInvoice({ isStream: true })); return false } catch { return true } })())
  check("milestones rejected", (() => { try { assertDirectPayEligible(baseInvoice({ milestones: [{ id: "m1", title: "M", amountUsd: 10, status: "pending" }] })); return false } catch { return true } })())
  check("splits rejected", (() => { try { assertDirectPayEligible(baseInvoice({ splits: [{ address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", amountUsd: 10 }] })); return false } catch { return true } })())
  check("private rejected", (() => { try { assertDirectPayEligible(baseInvoice({ isPrivate: true })); return false } catch { return true } })())
}

console.log("— bridge calldata (both variants) —")
{
  const receiver = "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
  const amount = BigInt(4_000_000_0000)
  for (const variant of ["amountLD", "standard"] as BridgeVariant[]) {
    const data = buildBridgeSendCalldata("DOGEB", amount, receiver, variant)
    check(`${variant}: calldata is non-empty hex`, typeof data === "string" && data.startsWith("0x") && data.length > 10)
    const abi = variant === "amountLD" ? AMOUNT_LD_ABI : STANDARD_ABI
    const decoded = decodeFunctionData({ abi, data })
    check(`${variant}: decodes as send()`, decoded.functionName === "send")
    const sp = decoded.args[0] as unknown as { dstEid?: bigint; to: string; amountLD?: bigint; amount?: bigint; toAddress?: string }
    const to = sp.toAddress && sp.toAddress.length > 0 ? sp.toAddress : "0x" + sp.to.slice(26)
    check(`${variant}: receiver == freelancer`, to.toLowerCase() === receiver.toLowerCase(), to)
    const amt = sp.amountLD ?? sp.amount ?? BigInt(0)
    check(`${variant}: amount matches`, amt === amount, amt.toString())
    if (variant === "amountLD") check(`${variant}: dstEid == GOAT`, Number(sp.dstEid) === GOAT_EID, String(sp.dstEid))
  }
  // padAddress padding sanity: the padded `to` must be 32 bytes
  const padded = encodeFunctionData({
    abi: AMOUNT_LD_ABI,
    functionName: "send",
    args: [
      { dstEid: GOAT_EID, to: ("0x" + receiver.slice(2).padStart(64, "0")) as `0x${string}`, amountLD: amount, minAmountLD: amount, extraOptions: "0x", composeMsg: "0x", oftCmd: "0x" },
      { nativeFee: BigInt(0), lzTokenFee: BigInt(0) },
      receiver,
    ],
  })
  const reDecoded = decodeFunctionData({ abi: AMOUNT_LD_ABI, data: padded })
  const reTo = ("0x" + (reDecoded.args[0] as unknown as { to: string }).to.slice(26)).toLowerCase()
  check("manual padded send round-trips to the freelancer", reTo === receiver.toLowerCase())
}

console.log("— converter split —")
{
  const { feeDoge, principalDoge } = computeConversionSplit(BigInt(1_000_000_000_000_000_000), 0.005) // 1 DOGE, 0.5%
  check("0.5% of 1 DOGE = 0.005 DOGE fee", feeDoge === BigInt(5_000_000_000_000_000), feeDoge.toString())
  check("principal = 0.995 DOGE", principalDoge === BigInt(995_000_000_000_000_000), principalDoge.toString())
  const zero = computeConversionSplit(BigInt(1_000_000_000_000_000_000), 0)
  check("0% fee → all principal", zero.feeDoge === BigInt(0) && zero.principalDoge === BigInt(1_000_000_000_000_000_000))
  const clamped = computeConversionSplit(BigInt(1_000_000_000_000_000_000), 2)
  check("fee rate clamped to 50% max", clamped.feeDoge === BigInt(500_000_000_000_000_000))
}

console.log("— bridge asset config —")
{
  check("DOGEB adapter is a valid address", typeof BSC_DOGEB.adapter === "string" && BSC_DOGEB.adapter.startsWith("0x") && BSC_DOGEB.adapter.length === 42)
  check("DOGEB token is a valid address", typeof BSC_DOGEB.token === "string" && BSC_DOGEB.token.startsWith("0x") && BSC_DOGEB.token.length === 42)
  check("DOGEB decimals = 8", BSC_DOGEB.decimals === 8)
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
