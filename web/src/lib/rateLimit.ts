import { getSql } from "./db";

// SECURITY: added as part of the 2026-07-29 audit fix for finding C-1.
// The per-invoice MAX_AUTO_PAY cap in lib/agent.ts limits a single payout,
// but a caller could previously still drain the wallet by calling
// /api/clawup/intent repeatedly. This adds a global rolling-window budget
// that is independent of, and in addition to, the per-invoice cap.

const WINDOW_MS = 60 * 60 * 1000; // 1 hour rolling window
const MAX_WINDOW_USD = Number(process.env.AGENT_HOURLY_PAYOUT_CAP_USD || "10000");

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS agent_payout_log (
      id SERIAL PRIMARY KEY,
      amount_usd DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  schemaReady = true;
}

/**
 * Returns true (and records the spend) only if adding `amountUsd` keeps the
 * trailing-hour total autonomous payout volume under AGENT_HOURLY_PAYOUT_CAP_USD.
 * Fails closed: any DB error blocks the payout rather than allowing it.
 */
export async function checkAndConsumeIntentBudget(amountUsd: number): Promise<boolean> {
  try {
    await ensureSchema();
    const sql = getSql();
    const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();
    const rows = (await sql`
      SELECT COALESCE(SUM(amount_usd), 0) AS total
      FROM agent_payout_log
      WHERE created_at >= ${windowStart}
    `) as unknown as { total: number }[];

    const spentSoFar = Number(rows[0]?.total || 0);
    if (spentSoFar + amountUsd > MAX_WINDOW_USD) {
      return false;
    }

    await sql`INSERT INTO agent_payout_log (amount_usd) VALUES (${amountUsd})`;
    return true;
  } catch (error) {
    console.error("[rateLimit] Budget check failed, failing closed:", error);
    return false;
  }
}

// SECURITY (audit fix 2026-08-13): generic per-bucket request-count budget,
// backing coarse abuse/cost control on public endpoints that call paid
// third-party APIs (Mistral, GitHub) or write rows with no other limiter
// (invoice/plugin/feedback creation). This is intentionally global (not
// per-IP/per-wallet) since there is no reliable caller identity on these
// routes today — it bounds worst-case cost/spam exposure, not per-user abuse.
// Fails closed: any DB error blocks the request rather than allowing it.
let requestBudgetSchemaReady = false;

async function ensureRequestBudgetSchema() {
  if (requestBudgetSchemaReady) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS request_budget_log (
      id SERIAL PRIMARY KEY,
      bucket TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  requestBudgetSchemaReady = true;
}

export async function checkAndConsumeRequestBudget(
  bucket: string,
  maxPerWindow: number,
  windowMs: number = 60 * 60 * 1000
): Promise<boolean> {
  try {
    await ensureRequestBudgetSchema();
    const sql = getSql();
    const windowStart = new Date(Date.now() - windowMs).toISOString();
    const rows = (await sql`
      SELECT COUNT(*)::int AS n FROM request_budget_log
      WHERE bucket = ${bucket} AND created_at >= ${windowStart}
    `) as unknown as { n: number }[];
    const count = Number(rows[0]?.n || 0);
    if (count >= maxPerWindow) return false;
    await sql`INSERT INTO request_budget_log (bucket) VALUES (${bucket})`;
    return true;
  } catch (error) {
    console.error(`[rateLimit] Request budget check failed for bucket "${bucket}", failing closed:`, error);
    return false;
  }
}
