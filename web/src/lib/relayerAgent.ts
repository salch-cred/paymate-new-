/**
 * Relayer Operator Agent — the AI operator for the background custody relayer.
 *
 * Cron-triggered (/api/relayer/agent, wired in vercel.json). Each pass:
 *
 *   1. AUDIT   — reads the relayer_swaps ledger (status counts, pending USD,
 *                retryable failures, stuck rows) + the GOAT-side payout
 *                liquidity (custody USDC balance vs pending invoice demand).
 *   2. DECIDE  — asks Mistral to pick which retryable swaps to retry and to
 *                flag anything critical (low liquidity, stuck rows). If the AI
 *                is unavailable, a deterministic fallback retries the oldest
 *                retryable failures.
 *   3. ACT     — retries ONLY the planned swaps, clamped by hard caps
 *                (RELAYER_AGENT_MAX_ACTION_USD + MAX_RETRIES_PER_RUN). Caps are
 *                enforced deterministically in code — the AI can only
 *                prioritize, never exceed authority. Dry-run = audit + plan +
 *                report only, zero ledger mutation, zero signing.
 *   4. REPORT  — posts a summary to DISCORD_WEBHOOK_URL (same pattern as the
 *                settle route).
 *
 * Security model: the agent never touches invoices and never moves funds
 * itself — it re-invokes the existing relayer engine scoped to specific swap
 * ids, so every money-moving path keeps the relayer's own guards (idempotent
 * ledger, in-flight confirmation, dust/gas-reserve). Without PRIVATE_KEY it
 * fails closed with `enabled: false`.
 */

import { isAddress, type Hex } from "viem"
import { getPublicClient, getCustodyAddress } from "./chain"
import { runRelayerOnce, type RelayerRunResult } from "./relayer"
import { getRelayerSwapStats, getPendingInvoiceTotalUsd, type RelayerSwap } from "./db"
import { isGoatBridgeVerified } from "./goatBridge"
import { mistralJsonText, parseJsonResponse } from "./mistral"

// ---------------------------------------------------------------------------
// Configuration (all env-overridable, all fail-closed friendly)
// ---------------------------------------------------------------------------

function agentEnabled(): boolean {
  return process.env.RELAYER_AGENT_ENABLED !== "false"
}

function agentDryRun(): boolean {
  return process.env.RELAYER_AGENT_DRY_RUN === "true"
}

function maxActionUsd(): number {
  const v = Number(process.env.RELAYER_AGENT_MAX_ACTION_USD ?? "500")
  return Number.isFinite(v) && v > 0 ? v : 500
}

function maxRetriesPerRun(): number {
  const v = Number(process.env.RELAYER_AGENT_MAX_RETRIES_PER_RUN ?? "5")
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 5
}

/** GOAT USDC balance below this multiple of pending demand → critical flag. */
function liquidityCriticalRatio(): number {
  const v = Number(process.env.RELAYER_AGENT_LIQUIDITY_RATIO ?? "1")
  return Number.isFinite(v) && v > 0 ? v : 1
}

function aiEnabled(): boolean {
  return !!process.env.MISTRAL_API_KEY
}

// ---------------------------------------------------------------------------
// Pure logic (exported for smoke tests — no network, no DB, no funds)
// ---------------------------------------------------------------------------

/**
 * Deterministically plans which retryable swaps to retry, oldest first, clamped
 * by hard caps: at most `maxCount` swaps whose total USD never exceeds
 * `maxUsd`. A single swap worth more than `maxUsd` is never retried (outside
 * the agent's authority — it stays for manual review). `aiPriority` (swap ids
 * the AI chose, format `${chainId}:${swapId}`) only reorders: AI picks move to
 * the front; the caps are still enforced by this function, not the model.
 */
export function planRetries(
  retryable: RelayerSwap[],
  aiPriority: string[],
  maxCount: number,
  maxUsd: number
): RelayerSwap[] {
  const byKey = new Map(retryable.map((s) => [`${s.chainId}:${s.swapId}`, s]))
  const ordered: RelayerSwap[] = []
  const used = new Set<string>()
  // AI picks first, in the AI's own order (dedup + skip unknown ids).
  for (const id of aiPriority) {
    const s = byKey.get(id)
    if (s && !used.has(id)) {
      ordered.push(s)
      used.add(id)
    }
  }
  // Then the rest, oldest-first (the ledger is already returned oldest-first).
  for (const s of retryable) {
    const id = `${s.chainId}:${s.swapId}`
    if (!used.has(id)) {
      ordered.push(s)
      used.add(id)
    }
  }
  const planned: RelayerSwap[] = []
  let totalUsd = 0
  for (const swap of ordered) {
    if (planned.length >= maxCount) break
    const usd = swap.usdValue ?? 0
    if (usd > maxUsd) continue // outside authority — leave for manual review
    if (totalUsd + usd > maxUsd) continue // cap the run's total exposure
    planned.push(swap)
    totalUsd += usd
  }
  return planned
}

/** Runway = GOAT USDC balance / pending invoice demand (1.0 = exact cover). */
export function computeRunway(goatUsdcBalanceUsd: number, pendingInvoicesUsd: number): number | null {
  if (pendingInvoicesUsd <= 0) return goatUsdcBalanceUsd > 0 ? Infinity : null
  if (goatUsdcBalanceUsd < 0) return null
  return goatUsdcBalanceUsd / pendingInvoicesUsd
}

/** True when the custody wallet can't cover pending invoices at the ratio. */
export function isLiquidityCritical(goatUsdcBalanceUsd: number, pendingInvoicesUsd: number, ratio: number): boolean {
  const runway = computeRunway(goatUsdcBalanceUsd, pendingInvoicesUsd)
  if (runway === null) return pendingInvoicesUsd > 0
  return runway < ratio
}

/** Parses the AI's JSON decision; throws on missing/invalid fields. */
export function parseAgentDecision(text: string): { retrySwapIds: string[]; summary: string; escalations: string[] } {
  const raw = parseJsonResponse<{
    retrySwapIds?: unknown
    summary?: unknown
    escalations?: unknown
  }>(text)
  const retrySwapIds = Array.isArray(raw.retrySwapIds)
    ? raw.retrySwapIds.filter((v): v is string => typeof v === "string").slice(0, 50)
    : []
  const summary = typeof raw.summary === "string" ? raw.summary.slice(0, 2000) : ""
  const escalations = Array.isArray(raw.escalations)
    ? raw.escalations.filter((v): v is string => typeof v === "string").slice(0, 20)
    : []
  if (retrySwapIds.length === 0 && summary === "" && escalations.length === 0) {
    throw new Error("AI decision contained no actionable fields")
  }
  return { retrySwapIds, summary, escalations }
}

// ---------------------------------------------------------------------------
// Live reads (audit + liquidity)
// ---------------------------------------------------------------------------

const BALANCE_OF_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

/** Custody wallet's USDC balance on GOAT (USD), or null when unreadable. */
export async function getGoatUsdcBalanceUsd(): Promise<number | null> {
  const usdcToken = process.env.USDC_TOKEN
  if (!usdcToken || !isAddress(usdcToken)) return null
  try {
    const client = getPublicClient()
    const custody = getCustodyAddress()
    const balance = (await client.readContract({
      address: usdcToken as Hex,
      abi: BALANCE_OF_ABI,
      functionName: "balanceOf",
      args: [custody],
    })) as bigint
    const decimals = Number(process.env.USDC_DECIMALS || "6")
    return Number(balance) / 10 ** decimals
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// AI decision (degrades to deterministic fallback)
// ---------------------------------------------------------------------------

export interface AgentContext {
  ledger: {
    byStatus: Record<string, number>
    pendingUsd: number
    retryable: { chainId: number; swapId: string; usdValue: number | null; retries: number; error: string | null }[]
    stuck: { chainId: number; swapId: string; usdValue: number | null; error: string | null }[]
  }
  liquidity: {
    goatUsdcBalanceUsd: number | null
    pendingInvoicesUsd: number
    runway: number | null
    critical: boolean
  }
  bridgeVerified: boolean
  caps: { maxActionUsd: number; maxRetriesPerRun: number }
}

function buildContext(): AgentContext {
  return {
    ledger: { byStatus: {}, pendingUsd: 0, retryable: [], stuck: [] },
    liquidity: { goatUsdcBalanceUsd: null, pendingInvoicesUsd: 0, runway: null, critical: false },
    bridgeVerified: false,
    caps: { maxActionUsd: maxActionUsd(), maxRetriesPerRun: maxRetriesPerRun() },
  }
}

export interface AgentDecision {
  retrySwapIds: string[]
  summary: string
  escalations: string[]
  aiUsed: boolean
}

async function aiDecide(ctx: AgentContext): Promise<AgentDecision> {
  const prompt = `You are the operator of PayMate's cross-chain custody relayer. Here is the current state:

LEDGER
${JSON.stringify(ctx.ledger, null, 2)}

GOAT LIQUIDITY
${JSON.stringify(ctx.liquidity, null, 2)}

BRIDGE VERIFIED: ${ctx.bridgeVerified}

HARD CAPS (never exceed these — they are enforced in code regardless):
maxActionUsd=${ctx.caps.maxActionUsd}, maxRetriesPerRun=${ctx.caps.maxRetriesPerRun}

Decide which retryable swaps (format "chainId:swapId") should be retried now, oldest failures first, prioritizing the most valuable that fit under the caps. NEVER retry a swap worth more than maxActionUsd. Flag critical issues (liquidity below demand, stuck rows) as escalations.

Return JSON ONLY, no markdown:
{
  "retrySwapIds": ["56:...", ...],
  "summary": "one or two plain sentences for a Discord ops channel",
  "escalations": ["...", ...]
}`

  const text = await mistralJsonText({
    messages: [
      {
        role: "system",
        content:
          "You are a cautious crypto operations agent. You propose retries; code enforces caps. Return valid JSON only.",
      },
      { role: "user", content: prompt },
    ],
    model: "mistral-small-latest",
    temperature: 0.1,
  })
  const parsed = parseAgentDecision(text ?? "")
  return { ...parsed, aiUsed: true }
}

function fallbackDecide(ctx: AgentContext): AgentDecision {
  const escalations: string[] = []
  if (ctx.liquidity.critical) {
    escalations.push(
      `GOAT USDC liquidity below demand: $${(ctx.liquidity.goatUsdcBalanceUsd ?? 0).toFixed(2)} balance vs $${ctx.liquidity.pendingInvoicesUsd.toFixed(2)} pending invoices — fund the custody wallet's GOAT USDC.`
    )
  }
  if (ctx.ledger.stuck.length > 0) {
    escalations.push(`${ctx.ledger.stuck.length} swap(s) stuck (retries exhausted or in-flight) — manual review needed.`)
  }
  const summary = `Auto-audit: ${ctx.ledger.retryable.length} retryable failure(s), $${ctx.ledger.pendingUsd.toFixed(2)} pending conversion.`
  // Deterministic: oldest retryable first — planRetries reorders by priority anyway.
  return { retrySwapIds: ctx.ledger.retryable.map((s) => `${s.chainId}:${s.swapId}`), summary, escalations, aiUsed: false }
}

// ---------------------------------------------------------------------------
// Discord report
// ---------------------------------------------------------------------------

export function buildDiscordReport(pass: AgentPassResult): string {
  const lines = [
    `🤖 **Relayer Operator Agent — ${pass.dryRun ? "DRY RUN" : "pass"}**`,
    "",
    `**Ledger:** ${formatStatus(pass.ledger.byStatus)} · pending conversion **$${pass.ledger.pendingUsd.toFixed(2)}**`,
  ]
  const liq = pass.liquidity
  lines.push(
    `**GOAT liquidity:** ${liq.goatUsdcBalanceUsd === null ? "n/a" : "$" + liq.goatUsdcBalanceUsd.toFixed(2)} balance vs **$${liq.pendingInvoicesUsd.toFixed(2)}** demand` +
      (liq.runway === null ? "" : ` (runway ×${formatRunway(liq.runway)})`) +
      (liq.critical ? " — ⚠️ **CRITICAL**" : "")
  )
  lines.push(`**AI:** ${pass.decision.aiUsed ? "Mistral" : "deterministic fallback"} · **Retried:** ${pass.executed.retried} (${pass.executed.completed} done, ${pass.executed.failed} failed)`)
  if (pass.decision.summary) lines.push("", `> ${pass.decision.summary}`)
  if (pass.decision.escalations.length > 0) {
    lines.push("", "**⚠️ Escalations**")
    for (const e of pass.decision.escalations.slice(0, 5)) lines.push(`- ${e}`)
  }
  return lines.join("\n")
}

function formatStatus(byStatus: Record<string, number>): string {
  const entries = Object.entries(byStatus)
  if (entries.length === 0) return "empty ledger"
  return entries.map(([k, v]) => `${k}:${v}`).join(" · ")
}

function formatRunway(runway: number): string {
  if (runway === Infinity) return "∞"
  return runway.toFixed(2)
}

async function sendDiscordReport(content: string): Promise<boolean> {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) return false
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 1900) }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------------

export interface AgentPassResult {
  enabled: boolean
  dryRun: boolean
  ledger: AgentContext["ledger"]
  liquidity: AgentContext["liquidity"]
  decision: AgentDecision
  executed: { planned: number; retried: number; completed: number; failed: number; skipped: number }
  discordSent: boolean
}

export interface AgentPassOptions {
  dryRun?: boolean
}

/** One operator-agent pass: audit → decide → act (scoped, capped) → report. */
export async function runAgentPass(options: AgentPassOptions = {}): Promise<AgentPassResult> {
  const dryRun = options.dryRun ?? agentDryRun()
  const ctx = buildContext()

  // Fail-closed: the agent's whole job is babysitting the custody wallet.
  try {
    getCustodyAddress()
  } catch {
    return {
      enabled: false,
      dryRun,
      ledger: ctx.ledger,
      liquidity: ctx.liquidity,
      decision: { retrySwapIds: [], summary: "Agent disabled — PRIVATE_KEY not configured.", escalations: [], aiUsed: false },
      executed: { planned: 0, retried: 0, completed: 0, failed: 0, skipped: 0 },
      discordSent: false,
    }
  }
  if (!agentEnabled()) {
    return {
      enabled: false,
      dryRun,
      ledger: ctx.ledger,
      liquidity: ctx.liquidity,
      decision: { retrySwapIds: [], summary: "Agent disabled — RELAYER_AGENT_ENABLED=false.", escalations: [], aiUsed: false },
      executed: { planned: 0, retried: 0, completed: 0, failed: 0, skipped: 0 },
      discordSent: false,
    }
  }

  // ── 1. Audit
  const stats = await getRelayerSwapStats()
  ctx.ledger = {
    byStatus: stats.byStatus,
    pendingUsd: stats.pendingUsd,
    retryable: stats.retryable.map((s) => ({ chainId: s.chainId, swapId: s.swapId, usdValue: s.usdValue, retries: s.retries, error: s.error })),
    stuck: stats.stuck.map((s) => ({ chainId: s.chainId, swapId: s.swapId, usdValue: s.usdValue, error: s.error })),
  }
  const [goatUsdcBalanceUsd, pendingInvoicesUsd, bridgeVerified] = await Promise.all([
    getGoatUsdcBalanceUsd(),
    getPendingInvoiceTotalUsd(),
    isGoatBridgeVerified(),
  ])
  ctx.liquidity = {
    goatUsdcBalanceUsd,
    pendingInvoicesUsd,
    runway: goatUsdcBalanceUsd === null ? null : computeRunway(goatUsdcBalanceUsd, pendingInvoicesUsd),
    critical: isLiquidityCritical(goatUsdcBalanceUsd ?? 0, pendingInvoicesUsd, liquidityCriticalRatio()),
  }
  ctx.bridgeVerified = bridgeVerified

  // ── 2. Decide (AI with deterministic fallback)
  let decision: AgentDecision
  if (aiEnabled()) {
    try {
      decision = await aiDecide(ctx)
    } catch (error) {
      console.error("[RelayerAgent] AI decision failed — using fallback:", error)
      decision = fallbackDecide(ctx)
    }
  } else {
    decision = fallbackDecide(ctx)
  }

  // ── 3. Act — deterministic cap enforcement, AI only prioritizes
  const planned = planRetries(stats.retryable, decision.retrySwapIds, maxRetriesPerRun(), maxActionUsd())
  const executed = { planned: planned.length, retried: 0, completed: 0, failed: 0, skipped: 0 }

  if (planned.length > 0 && !dryRun) {
    const swapIds = planned.map((s) => `${s.chainId}:${s.swapId}`)
    let relayerResult: RelayerRunResult
    try {
      relayerResult = await runRelayerOnce({ swapIds })
    } catch (error) {
      console.error("[RelayerAgent] scoped relayer run failed:", error)
      relayerResult = {
        enabled: true,
        dryRun: false,
        chainsChecked: 0,
        depositsDetected: 0,
        swapsQueued: 0,
        swapsCompleted: 0,
        swapsFailed: planned.length,
        swapsSkipped: 0,
        details: [],
      }
    }
    executed.retried = planned.length
    executed.completed = relayerResult.swapsCompleted
    executed.failed = relayerResult.swapsFailed
    executed.skipped = relayerResult.swapsSkipped
  }

  // ── 4. Report
  const pass: AgentPassResult = {
    enabled: true,
    dryRun,
    ledger: ctx.ledger,
    liquidity: ctx.liquidity,
    decision,
    executed,
    discordSent: false,
  }
  pass.discordSent = await sendDiscordReport(buildDiscordReport(pass))
  return pass
}
