import {
  isAddress,
  getAddress,
  keccak256,
  encodeAbiParameters,
  encodeFunctionData,
  decodeFunctionResult,
  verifyTypedData,
  toHex,
  type PublicClient,
  type Address,
} from "viem"

/**
 * Tier-1 security module (2026-08-13).
 *
 *  1. simulatePaymentSafety — pre-flight on-chain simulation of a payment via
 *     state-override eth_call. Catches revert-on-receive contracts (native
 *     payments) and fee-on-transfer / honeypot tokens (ERC-20 payments) before
 *     a settlement is accepted.
 *
 *  2. screenWallet / screenWallets — AML-style screening: static validation,
 *     an env-configured blocklist (SECURITY_BLOCKED_ADDRESSES), and an optional
 *     remote screening API (SECURITY_SCREENING_URL, TRM-style: POST {address}
 *     → { blocked | sanctioned | risky }) for sanctions/AML hits.
 *
 *  3. verifyFreshWalletProof712 — EIP-712 typed-data wallet proofs, scoped to
 *     a chain (the domain embeds chainId) with a nonce replay guard, so a
 *     signature made for one chain can never be replayed on another.
 */

// ── 1. Pre-flight payment simulation ─────────────────────────────────────────

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

const ERC20_BALANCE_OF_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

// Funded only by state override — never a real account.
const SIM_DUMMY = "0x000000000000000000000000000000000000dEaD" as Address

// Gate: SECURITY_SIMULATE_PAYMENTS=false disables simulation in emergencies.
const SIMULATION_ENABLED = process.env.SECURITY_SIMULATE_PAYMENTS !== "false"

export interface PaymentSimulation {
  safe: boolean
  feeOnTransfer: boolean
  revertReason?: string
  receivedWei?: bigint
}

/**
 * Storage slot of an address's ERC-20 balance for a `mapping(address =>
 * uint256)` at slot 0 (OpenZeppelin ERC20 / USDC FiatToken layout).
 * Slot = keccak256(abi.encodePacked(account, uint256(0))).
 */
function balanceSlot(account: Address): Address {
  return keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [account, BigInt(0)]))
}

export async function simulatePaymentSafety(
  client: PublicClient,
  opts: { token?: Address; to: Address; amount: bigint; blockNumber?: bigint }
): Promise<PaymentSimulation | null> {
  if (!SIMULATION_ENABLED) return null
  try {
    const { token, ...rest } = opts
    if (token) return await simulateErc20Transfer(client, { ...rest, token })
    return await simulateNativeTransfer(client, rest)
  } catch (error) {
    // Infra failure (RPC error etc.) → report nothing; callers decide how to
    // react. Never throw from a security helper that runs post-payment.
    console.error("[Security] payment simulation error:", error)
    return null
  }
}

async function simulateErc20Transfer(
  client: PublicClient,
  { token, to, amount, blockNumber }: { token: Address; to: Address; amount: bigint; blockNumber?: bigint }
): Promise<PaymentSimulation> {
  const override = [
    { address: token, stateDiff: [{ slot: balanceSlot(SIM_DUMMY), value: toHex(amount) }] },
    { address: to, stateDiff: [{ slot: balanceSlot(to), value: toHex(BigInt(0)) }] },
  ]
  try {
    await client.call({
      account: SIM_DUMMY,
      to: token,
      data: encodeFunctionData({ abi: ERC20_TRANSFER_ABI, functionName: "transfer", args: [to, amount] }),
      stateOverride: override,
      blockNumber,
    })
  } catch (error) {
    return { safe: false, feeOnTransfer: false, revertReason: extractRevertReason(error) }
  }

  // Transfer succeeded — measure what the recipient actually receives to
  // detect fee-on-transfer tokens (recipient gets less than `amount`).
  let received = BigInt(0)
  try {
    const balanceCall = await client.call({
      to: token,
      data: encodeFunctionData({ abi: ERC20_BALANCE_OF_ABI, functionName: "balanceOf", args: [to] }),
      stateOverride: override,
      blockNumber,
    })
    if (balanceCall.data) {
      received = decodeFunctionResult({ abi: ERC20_BALANCE_OF_ABI, functionName: "balanceOf", data: balanceCall.data }) as bigint
    }
  } catch {
    // Could not read the post-transfer balance — assume the full amount arrived.
    received = amount
  }

  return { safe: received >= amount, feeOnTransfer: received < amount, receivedWei: received }
}

async function simulateNativeTransfer(
  client: PublicClient,
  { to, amount, blockNumber }: { to: Address; amount: bigint; blockNumber?: bigint }
): Promise<PaymentSimulation> {
  try {
    await client.call({
      account: SIM_DUMMY,
      to,
      value: amount,
      stateOverride: [{ address: SIM_DUMMY, balance: amount }],
      blockNumber,
    })
    return { safe: true, feeOnTransfer: false, receivedWei: amount }
  } catch (error) {
    return { safe: false, feeOnTransfer: false, revertReason: extractRevertReason(error) }
  }
}

function extractRevertReason(error: unknown): string | undefined {
  const msg = error instanceof Error ? error.message : String(error)
  const m = msg.match(/reverted with reason string '([^']+)'|reason string '([^']+)'|execution reverted: ([^.\n]+)/)
  if (!m) return undefined
  return m[1] || m[2] || m[3]
}

// ── 2. AML / sanctions screening ─────────────────────────────────────────────

export interface WalletScreen {
  ok: boolean
  reason?: string
  source: "local" | "remote"
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

// Comma-separated env blocklist, e.g. SECURITY_BLOCKED_ADDRESSES=0x…,0x…
const BLOCKED_ADDRESSES = (process.env.SECURITY_BLOCKED_ADDRESSES || "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean)

export async function screenWallet(wallet: string): Promise<WalletScreen> {
  if (typeof wallet !== "string" || !ADDRESS_RE.test(wallet)) {
    return { ok: false, reason: "Invalid wallet address format", source: "local" }
  }
  const lower = wallet.toLowerCase()
  if (lower === "0x0000000000000000000000000000000000000000") {
    return { ok: false, reason: "Zero address is not allowed", source: "local" }
  }
  try {
    getAddress(wallet)
  } catch {
    return { ok: false, reason: "Invalid address checksum", source: "local" }
  }
  if (BLOCKED_ADDRESSES.includes(lower)) {
    return { ok: false, reason: "Address is on the security blocklist", source: "local" }
  }

  const remote = process.env.SECURITY_SCREENING_URL
  if (remote) {
    try {
      const res = await fetch(remote, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.SECURITY_SCREENING_KEY
            ? { authorization: `Bearer ${process.env.SECURITY_SCREENING_KEY}` }
            : {}),
        },
        body: JSON.stringify({ address: getAddress(wallet) }),
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const data = await res.json().catch(() => null)
        if (data && (data.blocked === true || data.sanctioned === true || data.risky === true)) {
          return {
            ok: false,
            reason: typeof data.reason === "string" ? data.reason : "Address flagged by security screening",
            source: "remote",
          }
        }
      }
    } catch {
      // Fail open: a screening-API outage must not lock every user out.
    }
  }
  return { ok: true, source: "local" }
}

export async function screenWallets(...wallets: string[]): Promise<WalletScreen> {
  for (const w of wallets) {
    const r = await screenWallet(w)
    if (!r.ok) return r
  }
  return { ok: true, source: "local" }
}

// ── 3. EIP-712 wallet proofs (cross-chain replay protection) ─────────────────

export const WALLET_PROOF_TYPES = {
  WalletProof: [
    { name: "action", type: "string" },
    { name: "wallet", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "expiresAt", type: "uint256" },
  ],
} as const

export interface WalletProof712 {
  action: string
  wallet: string
  nonce: string
  expiresAt: string
  signature: string
}

/**
 * The EIP-712 domain embeds chainId (and optionally a verifying contract), so
 * a proof signed for one chain can never be replayed on another — the core
 * cross-chain replay protection. Domain: PayMate v1 on <chainId>.
 */
export function buildWalletProofDomain(chainId: number) {
  const domain: { name: string; version: string; chainId: number; verifyingContract?: Address } = {
    name: "PayMate",
    version: "1",
    chainId,
  }
  const contract = process.env.PAYMATE_DOMAIN_CONTRACT
  if (contract && isAddress(contract)) domain.verifyingContract = getAddress(contract)
  return domain
}

export interface WalletProof712Result {
  ok: boolean
  reason?: string
}

/**
 * Verifies an EIP-712 typed-data wallet proof scoped to `chainId`, then claims
 * its nonce via `claimNonce` (a unique-constraint replay guard). Returns ok
 * only when the signature is valid, unexpired, and the nonce has never been
 * used — for this wallet, on this chain's domain.
 */
export async function verifyFreshWalletProof712(
  proof: WalletProof712 | null | undefined,
  chainId: number,
  claimNonce: (wallet: string, nonce: string) => Promise<boolean>
): Promise<WalletProof712Result> {
  if (
    !proof ||
    !proof.action ||
    !proof.signature ||
    typeof proof.wallet !== "string" ||
    !ADDRESS_RE.test(proof.wallet)
  ) {
    return { ok: false, reason: "Malformed EIP-712 proof" }
  }
  let nonce: bigint
  let expiresAt: bigint
  try {
    nonce = BigInt(proof.nonce)
    expiresAt = BigInt(proof.expiresAt)
  } catch {
    return { ok: false, reason: "Malformed EIP-712 proof (nonce/expiry)" }
  }
  if (nonce <= BigInt(0)) return { ok: false, reason: "Invalid nonce" }
  if (expiresAt < Date.now()) return { ok: false, reason: "EIP-712 proof expired" }

  let valid = false
  try {
    valid = await verifyTypedData({
      address: getAddress(proof.wallet) as Address,
      domain: buildWalletProofDomain(chainId),
      types: WALLET_PROOF_TYPES,
      primaryType: "WalletProof",
      message: {
        action: proof.action,
        wallet: getAddress(proof.wallet),
        nonce,
        expiresAt,
      },
      signature: proof.signature as `0x${string}`,
    })
  } catch {
    return { ok: false, reason: "Invalid EIP-712 signature" }
  }
  if (!valid) return { ok: false, reason: "Invalid EIP-712 signature" }

  const claimed = await claimNonce(proof.wallet, proof.nonce)
  if (!claimed) return { ok: false, reason: "This proof has already been used (nonce replay)" }
  return { ok: true }
}
