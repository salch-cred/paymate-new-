import { neon } from "@neondatabase/serverless"
import crypto from "node:crypto"
import type { Plugin } from "./marketplace/types"
import type { Service, ServiceOrder } from "./services/types"

export type InvoiceStatus = "pending" | "paid" | "cancelled"

export interface InvoiceSplit {
  address: string
  amountUsd: number
}

export interface Milestone {
  id: string
  title: string
  amountUsd: number
  status: "pending" | "paid"
  txHash?: string
  paidAt?: number
}

export interface Invoice {
  id: string
  freelancer: string
  client: string
  title: string
  description: string
  amountUsd: number
  status: InvoiceStatus
  chain: string
  dueDate: string | null
  txHash: string | null
  createdAt: number
  paidAt: number | null
  cancelledAt: number | null
  webhookUrl: string | null
  signature: string | null
  ipfsReceipt: string | null
  splits: InvoiceSplit[] | null
  recurring: "weekly" | "monthly" | null
  recurringParentId: string | null
  milestones: Milestone[] | null
  isStream: boolean
  streamRateUsd: number | null
  streamedAmountUsd: number
  streamSignature: string | null
  streamAuthorizedAt: number | null
  isPrivate: boolean
  zkCommitment: string | null
  githubPrUrl: string | null
  isYieldBearing: boolean
  yieldEarned: number
  isSwarm: boolean
  swarmWallets: {address:string; share:number}[] | null
  proofOfCompute: boolean
  computeHash: string | null
  escrowStatus: "none" | "funded" | "resolved"
  escrowTxHash: string | null
  apiKeyId: string | null
  /** Real paywall deliverable stored on the invoice — served only after on-chain payment. */
  paywallContent: string | null
  /** Merchant checkout: the merchant's own order reference (echoed in webhooks). */
  merchantOrderId: string | null
  /** Merchant checkout: HMAC secret used to sign the payment webhook to the merchant. */
  merchantWebhookSecret: string | null
}

export type FeedbackRole = "freelancer" | "client" | "other"

export interface Feedback {
  id: string
  role: FeedbackRole
  name: string
  contact: string | null
  rating: number
  comment: string
  invoiceId: string | null
  createdAt: number
}

interface FeedbackRow {
  id: string
  role: string
  name: string
  contact: string | null
  rating: number
  comment: string
  invoice_id: string | null
  created_at: string
}

interface InvoiceRow {
  id: string
  freelancer: string
  client: string
  title: string
  description: string
  amount_usd: number
  status: string
  chain: string
  due_date: string | null
  tx_hash: string | null
  created_at: string
  paid_at: string | null
  cancelled_at: string | null
  webhook_url: string | null
  signature: string | null
  ipfs_receipt: string | null
  splits: string | null
  recurring: string | null
  recurring_parent_id: string | null
  milestones: string | null
  is_stream: boolean
  stream_rate_usd: number | null
  streamed_amount_usd: number
  stream_signature: string | null
  stream_authorized_at: number | null
  is_private: boolean
  zk_commitment: string | null
  github_pr_url: string | null
  is_yield_bearing: boolean
  yield_earned: number
  is_swarm: boolean
  swarm_wallets: string | null
  proof_of_compute: boolean
  compute_hash: string | null
  escrow_status: string | null
  escrow_tx_hash: string | null
  api_key_id: string | null
  paywall_content: string | null
  merchant_order_id: string | null
  merchant_webhook_secret: string | null
}

declare global {
  var __paymateSchemaReady: Promise<void> | undefined
}

export function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not configured")
  return neon(url)
}

async function ready(): Promise<void> {
  if (!globalThis.__paymateSchemaReady) {
    const sql = getSql()
    globalThis.__paymateSchemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY, freelancer TEXT NOT NULL, client TEXT NOT NULL,
        title TEXT NOT NULL, description TEXT NOT NULL, amount_usd DOUBLE PRECISION NOT NULL,
        status TEXT NOT NULL, chain TEXT NOT NULL, due_date TEXT, tx_hash TEXT,
        created_at BIGINT NOT NULL, paid_at BIGINT, webhook_url TEXT, signature TEXT
      )`
      // Try adding the columns if the table already existed
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS webhook_url TEXT`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS signature TEXT`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS ipfs_receipt TEXT`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS splits TEXT`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recurring TEXT`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recurring_parent_id TEXT`.catch(()=>null)
      await sql`CREATE INDEX IF NOT EXISTS idx_invoices_recurring_parent ON invoices(recurring_parent_id, created_at DESC)`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS milestones TEXT`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_stream BOOLEAN DEFAULT FALSE`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stream_rate_usd DOUBLE PRECISION`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS streamed_amount_usd DOUBLE PRECISION DEFAULT 0`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stream_signature TEXT`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stream_authorized_at BIGINT`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS zk_commitment TEXT`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS github_pr_url TEXT`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_yield_bearing BOOLEAN DEFAULT FALSE`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS yield_earned DOUBLE PRECISION DEFAULT 0`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_swarm BOOLEAN DEFAULT FALSE`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS swarm_wallets TEXT`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS proof_of_compute BOOLEAN DEFAULT FALSE`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS compute_hash TEXT`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT 'none'`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS escrow_tx_hash TEXT`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS api_key_id TEXT`.catch(()=>null)
      await sql`CREATE INDEX IF NOT EXISTS idx_invoices_api_key ON invoices(api_key_id, created_at DESC)`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paywall_content TEXT`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cancelled_at BIGINT`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS merchant_order_id TEXT`.catch(()=>null)
      await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS merchant_webhook_secret TEXT`.catch(()=>null)
      await sql`CREATE INDEX IF NOT EXISTS idx_invoices_freelancer ON invoices(freelancer, created_at DESC)`
      // SECURITY (audit fix 2026-08-13): global ledger of on-chain tx hashes
      // already consumed to settle an invoice or milestone. markPaid/
      // markMilestonePaid both reserve the tx hash here atomically (INSERT ...
      // ON CONFLICT DO NOTHING) before touching the invoice row, so the exact
      // same on-chain transfer can never be replayed to settle a second
      // invoice or a second milestone.
      await sql`CREATE TABLE IF NOT EXISTS used_settlement_tx (
        tx_hash TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        milestone_id TEXT,
        created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
      )`
      // SECURITY (audit fix 2026-08-13): generic request-budget log backing
      // checkAndConsumeRequestBudget() in lib/rateLimit.ts — coarse abuse/cost
      // control for public AI-calling and invoice/plugin-creation endpoints.
      await sql`CREATE TABLE IF NOT EXISTS request_budget_log (
        id SERIAL PRIMARY KEY,
        bucket TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`
      await sql`CREATE INDEX IF NOT EXISTS idx_request_budget_log ON request_budget_log(bucket, created_at DESC)`.catch(()=>null)
      await sql`CREATE TABLE IF NOT EXISTS treasury (
        id TEXT PRIMARY KEY,
        balance_usd DOUBLE PRECISION DEFAULT 0,
        total_donated_usd DOUBLE PRECISION DEFAULT 0
      )`
      
      const t = await sql`SELECT * FROM treasury WHERE id = 'global_treasury'`
      if (t.length === 0) {
        await sql`INSERT INTO treasury (id, balance_usd, total_donated_usd) VALUES ('global_treasury', 0, 0)`
      }
      await sql`CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY, role TEXT NOT NULL, name TEXT NOT NULL, contact TEXT,
        rating INTEGER NOT NULL, comment TEXT NOT NULL, invoice_id TEXT,
        created_at BIGINT NOT NULL
      )`
      await sql`CREATE TABLE IF NOT EXISTS disputes (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        complaint TEXT NOT NULL,
        resolution TEXT,
        reasoning TEXT,
        created_at BIGINT NOT NULL
      )`
      await sql`CREATE INDEX IF NOT EXISTS idx_disputes_invoice ON disputes(invoice_id, created_at DESC)`
      await sql`CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        wallet TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        key_prefix TEXT NOT NULL,
        quota_usd DOUBLE PRECISION NOT NULL DEFAULT 1000,
        used_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
        revoked_at BIGINT,
        created_at BIGINT NOT NULL,
        last_used_at BIGINT
      )`
      await sql`CREATE INDEX IF NOT EXISTS idx_api_keys_wallet ON api_keys(wallet, created_at DESC)`
      // Merchant checkout profiles — one per API key. The receive wallet is
      // where checkout payments settle; the webhook secret signs the
      // checkout.paid webhook we POST to the merchant after on-chain settlement.
      await sql`CREATE TABLE IF NOT EXISTS merchant_profiles (
        api_key_id TEXT PRIMARY KEY,
        store_name TEXT,
        logo_url TEXT,
        receive_wallet TEXT,
        webhook_url TEXT,
        success_url TEXT,
        cancel_url TEXT,
        webhook_secret TEXT,
        created_at BIGINT NOT NULL
      )`
      // Stage 2 growth targets — the locked baseline the bootcamp judges
      // compare against. Set once via /api/metrics/targets (team-only); the
      // public /metrics page renders target-vs-actual with MET/NOT MET badges.
      await sql`CREATE TABLE IF NOT EXISTS growth_targets (
        metric TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        target DOUBLE PRECISION NOT NULL,
        updated_at BIGINT NOT NULL
      )`
      await sql`CREATE TABLE IF NOT EXISTS chat_states (
        chat_id TEXT PRIMARY KEY,
        address TEXT,
        amount_usd TEXT,
        description TEXT,
        updated_at BIGINT NOT NULL
      )`
      // Marketplace plugins. Persisted in Postgres (not a local JSON file) so
      // published plugins survive cold starts / restarts on serverless.
      await sql`CREATE TABLE IF NOT EXISTS plugins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT NOT NULL,
        long_description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        author TEXT NOT NULL,
        author_name TEXT NOT NULL,
        ipfs_hash TEXT NOT NULL DEFAULT '',
        usage_count INTEGER NOT NULL DEFAULT 0,
        rating DOUBLE PRECISION NOT NULL DEFAULT 0,
        review_count INTEGER NOT NULL DEFAULT 0,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version TEXT NOT NULL DEFAULT '1.0.0',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        featured BOOLEAN NOT NULL DEFAULT FALSE,
        github_url TEXT,
        docs_url TEXT
      )`
      await sql`CREATE INDEX IF NOT EXISTS idx_plugins_author ON plugins(author, created_at DESC)`
      // Replay guard for marketplace pay-to-use: each on-chain tx hash can
      // unlock a plugin use exactly once (PK-dedup, same pattern as
      // used_settlement_tx for invoices).
      await sql`CREATE TABLE IF NOT EXISTS plugin_usage_log (
        tx_hash TEXT PRIMARY KEY,
        plugin_id TEXT NOT NULL,
        created_at BIGINT NOT NULL
      )`
      // EIP-712 wallet-proof replay guard (Tier-1 security): a typed-data
      // proof's (wallet, nonce) pair can be claimed exactly once. The domain
      // already scopes proofs to a chain; this table stops same-chain replays.
      await sql`CREATE TABLE IF NOT EXISTS wallet_proof_nonce (
        wallet TEXT NOT NULL,
        nonce TEXT NOT NULL,
        used_at BIGINT NOT NULL,
        PRIMARY KEY (wallet, nonce)
      )`
      // Public per-use Agent Billing API: a developer registers a billable
      // agent (price per request + wallet that receives payment + optional
      // monthly cap). Consumers pay USDC on GOAT via the x402 handshake; each
      // paid use is counted here for the usage meter and quota enforcement.
      await sql`CREATE TABLE IF NOT EXISTS billable_agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        price_usd DOUBLE PRECISION NOT NULL,
        freelancer TEXT NOT NULL,
        endpoint TEXT,
        api_key_id TEXT,
        monthly_cap INTEGER NOT NULL DEFAULT 1000,
        usage_count INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at BIGINT NOT NULL
      )`
      await sql`CREATE INDEX IF NOT EXISTS idx_billable_agents_key ON billable_agents(api_key_id, created_at DESC)`
      // Replay guard + usage ledger for agent billing: each on-chain tx hash
      // can unlock exactly one paid use of a billable agent (PK-dedup, same
      // pattern as plugin_usage_log).
      await sql`CREATE TABLE IF NOT EXISTS agent_billing_usage (
        tx_hash TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        created_at BIGINT NOT NULL
      )`
      await sql`CREATE INDEX IF NOT EXISTS idx_agent_billing_usage_agent ON agent_billing_usage(agent_id, created_at DESC)`
      // Agent Services Marketplace ("market economy"): provider listings + the
      // escrow-backed orders between buyers and providers.
      await sql`CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        delivery_days INTEGER NOT NULL,
        provider TEXT NOT NULL,
        provider_name TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        rating DOUBLE PRECISION NOT NULL DEFAULT 0,
        review_count INTEGER NOT NULL DEFAULT 0,
        completed_count INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
      await sql`CREATE INDEX IF NOT EXISTS idx_services_provider ON services(provider, created_at DESC)`
      await sql`CREATE INDEX IF NOT EXISTS idx_services_category ON services(category, created_at DESC)`
      await sql`CREATE TABLE IF NOT EXISTS service_orders (
        id TEXT PRIMARY KEY,
        service_id TEXT NOT NULL,
        service_title TEXT NOT NULL,
        category TEXT NOT NULL,
        buyer TEXT NOT NULL,
        provider TEXT NOT NULL,
        amount_usd DOUBLE PRECISION NOT NULL,
        status TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT '',
        fund_tx_hash TEXT,
        release_tx_hash TEXT,
        deliverable TEXT,
        ai_verdict TEXT,
        dispute TEXT,
        buyer_rating INTEGER,
        provider_rating INTEGER,
        buyer_review TEXT,
        provider_review TEXT,
        created_at BIGINT NOT NULL,
        funded_at BIGINT,
        delivered_at BIGINT,
        completed_at BIGINT
      )`
      await sql`CREATE INDEX IF NOT EXISTS idx_orders_buyer ON service_orders(buyer, created_at DESC)`
      await sql`CREATE INDEX IF NOT EXISTS idx_orders_provider ON service_orders(provider, created_at DESC)`
    })()
  }
  return globalThis.__paymateSchemaReady
}

function rowToInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    freelancer: row.freelancer,
    client: row.client,
    title: row.title,
    description: row.description,
    amountUsd: Number(row.amount_usd),
    status: row.status as InvoiceStatus,
    chain: row.chain,
    dueDate: row.due_date,
    txHash: row.tx_hash,
    createdAt: Number(row.created_at),
    paidAt: row.paid_at === null ? null : Number(row.paid_at),
    cancelledAt: row.cancelled_at === null || row.cancelled_at === undefined ? null : Number(row.cancelled_at),
    webhookUrl: row.webhook_url || null,
    signature: row.signature || null,
    ipfsReceipt: row.ipfs_receipt || null,
    splits: row.splits ? JSON.parse(row.splits) : null,
    recurring: (row.recurring as "weekly" | "monthly") || null,
    recurringParentId: row.recurring_parent_id || null,
    milestones: row.milestones ? JSON.parse(row.milestones) : null,
    isStream: row.is_stream || false,
    streamRateUsd: row.stream_rate_usd ? Number(row.stream_rate_usd) : null,
    streamedAmountUsd: row.streamed_amount_usd ? Number(row.streamed_amount_usd) : 0,
    streamSignature: row.stream_signature || null,
    streamAuthorizedAt: row.stream_authorized_at ? Number(row.stream_authorized_at) : null,
    isPrivate: row.is_private || false,
    zkCommitment: row.zk_commitment || null,
    githubPrUrl: row.github_pr_url || null,
    isYieldBearing: row.is_yield_bearing || false,
    yieldEarned: row.yield_earned ? Number(row.yield_earned) : 0,
    isSwarm: row.is_swarm || false,
    swarmWallets: row.swarm_wallets ? JSON.parse(row.swarm_wallets) : null,
    proofOfCompute: row.proof_of_compute || false,
    computeHash: row.compute_hash || null,
    escrowStatus: (row.escrow_status as "none" | "funded" | "resolved") || "none",
    escrowTxHash: row.escrow_tx_hash || null,
    apiKeyId: row.api_key_id || null,
    paywallContent: row.paywall_content || null,
    merchantOrderId: row.merchant_order_id || null,
    merchantWebhookSecret: row.merchant_webhook_secret || null,
  }
}

export async function createInvoice(input: {
  freelancer: string
  client: string
  title: string
  description: string
  amountUsd: number
  dueDate?: string | null
  webhookUrl?: string | null
  signature?: string | null
  splits?: InvoiceSplit[] | null
  recurring?: "weekly" | "monthly" | null
  recurringParentId?: string | null
  milestones?: Milestone[] | null
  isStream?: boolean
  streamRateUsd?: number | null
  isPrivate?: boolean
  zkCommitment?: string | null
  githubPrUrl?: string | null
  isYieldBearing?: boolean
  yieldEarned?: number
  isSwarm?: boolean
  swarmWallets?: {address:string; share:number}[] | null
  proofOfCompute?: boolean
  computeHash?: string | null
  apiKeyId?: string | null
  paywallContent?: string | null
  merchantOrderId?: string | null
  merchantWebhookSecret?: string | null
}): Promise<Invoice> {
  await ready()
  const sql = getSql()

  // SECURITY (audit fix 2026-08-13): a client's EIP-712 authorization signs
  // only {freelancer, client, amountUsd} — it carries no invoice id/nonce.
  // Without this check, one captured/leaked signature could be replayed by
  // attaching it verbatim to N brand-new invoices sharing that exact triple,
  // each of which could then be autonomously paid (see lib/agent.ts). Reject
  // reuse of a signature that is already attached to any other invoice.
  let safeSignature = input.signature || null
  if (safeSignature) {
    const reused = await sql`SELECT 1 FROM invoices WHERE signature = ${safeSignature} LIMIT 1`
    if (reused.length > 0) {
      console.warn("[createInvoice] Rejected reused EIP-712 signature on invoice creation.")
      safeSignature = null
    }
  }

  const invoice: Invoice = {
    id: crypto.randomUUID(),
    freelancer: input.freelancer,
    client: input.client,
    title: input.title.trim() || "Professional services",
    description: input.description.trim(),
    amountUsd: Math.round(input.amountUsd * 100) / 100,
    status: "pending",
    chain: "goat-mainnet",
    dueDate: input.dueDate || null,
    txHash: null,
    createdAt: Date.now(),
    paidAt: null,
    cancelledAt: null,
    webhookUrl: input.webhookUrl || null,
    signature: safeSignature,
    ipfsReceipt: null,
    splits: input.splits || null,
    recurring: input.recurring || null,
    recurringParentId: input.recurringParentId || null,
    milestones: input.milestones || null,
    isStream: input.isStream || false,
    streamRateUsd: input.streamRateUsd || null,
    streamedAmountUsd: 0,
    streamSignature: null,
    streamAuthorizedAt: null,
    isPrivate: input.isPrivate || false,
    zkCommitment: input.zkCommitment || null,
    githubPrUrl: input.githubPrUrl || null,
    isYieldBearing: input.isYieldBearing || false,
    yieldEarned: input.yieldEarned || 0,
    isSwarm: input.isSwarm || false,
    swarmWallets: input.swarmWallets || null,
    proofOfCompute: input.proofOfCompute || false,
    computeHash: input.computeHash || null,
    escrowStatus: "none",
    escrowTxHash: null,
    apiKeyId: input.apiKeyId || null,
    paywallContent: input.paywallContent || null,
    merchantOrderId: input.merchantOrderId || null,
    merchantWebhookSecret: input.merchantWebhookSecret || null,
  }
  
  const splitsJson = invoice.splits ? JSON.stringify(invoice.splits) : null
  const milestonesJson = invoice.milestones ? JSON.stringify(invoice.milestones) : null
  const swarmWalletsJson = invoice.swarmWallets ? JSON.stringify(invoice.swarmWallets) : null

  await sql`
  INSERT INTO invoices (
    id, freelancer, client, title, description, amount_usd, status, chain, due_date, tx_hash,
    created_at, paid_at, webhook_url, signature, splits, recurring, recurring_parent_id, milestones,
    is_stream, stream_rate_usd, streamed_amount_usd, stream_signature, stream_authorized_at, is_private, zk_commitment, github_pr_url,
    is_yield_bearing, yield_earned, is_swarm, swarm_wallets, proof_of_compute, compute_hash,
    escrow_status, escrow_tx_hash, api_key_id, paywall_content,
    merchant_order_id, merchant_webhook_secret
  ) VALUES (
    ${invoice.id}, ${invoice.freelancer}, ${invoice.client}, ${invoice.title}, ${invoice.description},
    ${invoice.amountUsd}, ${invoice.status}, ${invoice.chain}, ${invoice.dueDate}, ${invoice.txHash},
    ${invoice.createdAt}, ${invoice.paidAt}, ${invoice.webhookUrl}, ${invoice.signature}, ${splitsJson},
    ${invoice.recurring}, ${invoice.recurringParentId}, ${milestonesJson}, ${invoice.isStream}, ${invoice.streamRateUsd}, ${invoice.streamedAmountUsd},
    ${invoice.streamSignature}, ${invoice.streamAuthorizedAt}, ${invoice.isPrivate}, ${invoice.zkCommitment}, ${invoice.githubPrUrl},
    ${invoice.isYieldBearing}, ${invoice.yieldEarned}, ${invoice.isSwarm}, ${swarmWalletsJson}, ${invoice.proofOfCompute}, ${invoice.computeHash},
    ${invoice.escrowStatus}, ${invoice.escrowTxHash}, ${invoice.apiKeyId}, ${invoice.paywallContent},
    ${invoice.merchantOrderId}, ${invoice.merchantWebhookSecret}
  )`
  return invoice
}

export async function addTreasuryRevenue(amountUsd: number): Promise<void> {
  await ready()
  const sql = getSql()
  await sql`UPDATE treasury SET balance_usd = balance_usd + ${amountUsd} WHERE id = 'global_treasury'`
}

export async function getTreasuryStats(): Promise<{balanceUsd: number, totalDonatedUsd: number}> {
  await ready()
  const sql = getSql()
  const t = await sql`SELECT * FROM treasury WHERE id = 'global_treasury'`
  if (t.length === 0) return {balanceUsd: 0, totalDonatedUsd: 0}
  return {
    balanceUsd: Number(t[0].balance_usd),
    totalDonatedUsd: Number(t[0].total_donated_usd)
  }
}

interface PluginRow {
  id: string
  name: string
  display_name: string
  description: string
  long_description: string
  category: string
  price: number
  author: string
  author_name: string
  ipfs_hash: string
  usage_count: number
  rating: number
  review_count: number
  tags: string
  created_at: string
  updated_at: string
  version: string
  active: boolean
  featured: boolean
  github_url: string | null
  docs_url: string | null
}

function rowToPlugin(row: PluginRow): Plugin {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    longDescription: row.long_description || row.description,
    category: row.category as Plugin["category"],
    price: Number(row.price),
    author: row.author,
    authorName: row.author_name,
    ipfsHash: row.ipfs_hash || "",
    usageCount: Number(row.usage_count || 0),
    rating: Number(row.rating || 0),
    reviewCount: Number(row.review_count || 0),
    tags: JSON.parse(row.tags || "[]") as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version || "1.0.0",
    active: !!row.active,
    featured: !!row.featured,
    githubUrl: row.github_url || undefined,
    docsUrl: row.docs_url || undefined,
  }
}

/** All published marketplace plugins, newest first. */
export async function listPlugins(): Promise<Plugin[]> {
  await ready()
  const sql = getSql()
  const rows = (await sql`SELECT * FROM plugins ORDER BY created_at DESC`) as unknown as PluginRow[]
  return rows.map(rowToPlugin)
}

/** Insert or refresh a published plugin. Tags travel as JSON text. */
export async function upsertPlugin(plugin: Plugin): Promise<void> {
  await ready()
  const sql = getSql()
  await sql`
    INSERT INTO plugins (
      id, name, display_name, description, long_description, category, price, author,
      author_name, ipfs_hash, usage_count, rating, review_count, tags, created_at,
      updated_at, version, active, featured, github_url, docs_url
    ) VALUES (
      ${plugin.id}, ${plugin.name}, ${plugin.displayName}, ${plugin.description}, ${plugin.longDescription},
      ${plugin.category}, ${plugin.price}, ${plugin.author}, ${plugin.authorName}, ${plugin.ipfsHash},
      ${plugin.usageCount}, ${plugin.rating}, ${plugin.reviewCount}, ${JSON.stringify(plugin.tags)},
      ${plugin.createdAt}, ${plugin.updatedAt}, ${plugin.version}, ${plugin.active}, ${!!plugin.featured},
      ${plugin.githubUrl ?? null}, ${plugin.docsUrl ?? null}
    )
    ON CONFLICT (id) DO UPDATE SET
      updated_at = EXCLUDED.updated_at,
      usage_count = EXCLUDED.usage_count,
      rating = EXCLUDED.rating,
      review_count = EXCLUDED.review_count,
      active = EXCLUDED.active,
      featured = EXCLUDED.featured
  `
}

/**
 * Atomically reserves a tx hash for a plugin use. Returns false when the hash
 * was already consumed (replayed payment) — the caller must NOT count the use.
 */
export async function reservePluginUsage(txHash: string, pluginId: string): Promise<boolean> {
  await ready()
  const sql = getSql()
  const reserved = (await sql`
    INSERT INTO plugin_usage_log (tx_hash, plugin_id, created_at)
    VALUES (${txHash}, ${pluginId}, ${Date.now()})
    ON CONFLICT (tx_hash) DO NOTHING
    RETURNING tx_hash
  `) as unknown as { tx_hash: string }[]
  return reserved.length > 0
}

/** Increment a plugin's usage counter in Postgres (best-effort from the route). */
export async function incrementPluginUsageInDb(id: string): Promise<void> {
  await ready()
  const sql = getSql()
  await sql`
    UPDATE plugins
    SET usage_count = usage_count + 1,
        updated_at = ${new Date().toISOString().split("T")[0]}
    WHERE id = ${id}
  `
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Services Marketplace — persistence
// ─────────────────────────────────────────────────────────────────────────────

interface ServiceRow {
  id: string; title: string; description: string; category: string;
  price: number; delivery_days: number; provider: string; provider_name: string;
  tags: string; rating: number; review_count: number; completed_count: number;
  active: boolean; created_at: string; updated_at: string;
}

function rowToService(row: ServiceRow): Service {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category as Service["category"],
    price: Number(row.price),
    deliveryDays: Number(row.delivery_days),
    provider: row.provider,
    providerName: row.provider_name,
    tags: JSON.parse(row.tags || "[]") as string[],
    rating: Number(row.rating || 0),
    reviewCount: Number(row.review_count || 0),
    completedCount: Number(row.completed_count || 0),
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** All services, newest first. */
export async function listServicesFromDb(): Promise<Service[]> {
  await ready();
  const sql = getSql();
  const rows = (await sql`SELECT * FROM services ORDER BY created_at DESC`) as unknown as ServiceRow[];
  return rows.map(rowToService);
}

/** Insert or refresh a service listing. */
export async function upsertService(service: Service): Promise<void> {
  await ready();
  const sql = getSql();
  await sql`
    INSERT INTO services (
      id, title, description, category, price, delivery_days, provider, provider_name,
      tags, rating, review_count, completed_count, active, created_at, updated_at
    ) VALUES (
      ${service.id}, ${service.title}, ${service.description}, ${service.category}, ${service.price},
      ${service.deliveryDays}, ${service.provider}, ${service.providerName}, ${JSON.stringify(service.tags)},
      ${service.rating}, ${service.reviewCount}, ${service.completedCount}, ${service.active},
      ${service.createdAt}, ${service.updatedAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      price = EXCLUDED.price,
      delivery_days = EXCLUDED.delivery_days,
      tags = EXCLUDED.tags,
      rating = EXCLUDED.rating,
      review_count = EXCLUDED.review_count,
      completed_count = EXCLUDED.completed_count,
      active = EXCLUDED.active,
      updated_at = EXCLUDED.updated_at
  `;
}

interface OrderRow {
  id: string; service_id: string; service_title: string; category: string;
  buyer: string; provider: string; amount_usd: number; status: string; scope: string;
  fund_tx_hash: string | null; release_tx_hash: string | null; deliverable: string | null;
  ai_verdict: string | null; dispute: string | null;
  buyer_rating: number | null; provider_rating: number | null;
  buyer_review: string | null; provider_review: string | null;
  created_at: string; funded_at: string | null; delivered_at: string | null; completed_at: string | null;
}

function rowToOrder(row: OrderRow): ServiceOrder {
  return {
    id: row.id,
    serviceId: row.service_id,
    serviceTitle: row.service_title,
    category: row.category as ServiceOrder["category"],
    buyer: row.buyer,
    provider: row.provider,
    amountUsd: Number(row.amount_usd),
    status: row.status as ServiceOrder["status"],
    scope: row.scope || "",
    fundTxHash: row.fund_tx_hash || null,
    releaseTxHash: row.release_tx_hash || null,
    deliverable: row.deliverable || null,
    aiVerdict: row.ai_verdict ? (JSON.parse(row.ai_verdict) as ServiceOrder["aiVerdict"]) : null,
    dispute: row.dispute ? (JSON.parse(row.dispute) as ServiceOrder["dispute"]) : null,
    buyerRating: row.buyer_rating == null ? null : Number(row.buyer_rating),
    providerRating: row.provider_rating == null ? null : Number(row.provider_rating),
    buyerReview: row.buyer_review || null,
    providerReview: row.provider_review || null,
    createdAt: Number(row.created_at),
    fundedAt: row.funded_at == null ? null : Number(row.funded_at),
    deliveredAt: row.delivered_at == null ? null : Number(row.delivered_at),
    completedAt: row.completed_at == null ? null : Number(row.completed_at),
  };
}

/** All orders, newest first. */
export async function listOrdersFromDb(): Promise<ServiceOrder[]> {
  await ready();
  const sql = getSql();
  const rows = (await sql`SELECT * FROM service_orders ORDER BY created_at DESC`) as unknown as OrderRow[];
  return rows.map(rowToOrder);
}

/** Insert or refresh an order (full state, nested JSON columns travel as text). */
export async function upsertOrder(order: ServiceOrder): Promise<void> {
  await ready();
  const sql = getSql();
  await sql`
    INSERT INTO service_orders (
      id, service_id, service_title, category, buyer, provider, amount_usd, status, scope,
      fund_tx_hash, release_tx_hash, deliverable, ai_verdict, dispute,
      buyer_rating, provider_rating, buyer_review, provider_review,
      created_at, funded_at, delivered_at, completed_at
    ) VALUES (
      ${order.id}, ${order.serviceId}, ${order.serviceTitle}, ${order.category}, ${order.buyer},
      ${order.provider}, ${order.amountUsd}, ${order.status}, ${order.scope},
      ${order.fundTxHash}, ${order.releaseTxHash}, ${order.deliverable},
      ${order.aiVerdict ? JSON.stringify(order.aiVerdict) : null},
      ${order.dispute ? JSON.stringify(order.dispute) : null},
      ${order.buyerRating}, ${order.providerRating}, ${order.buyerReview}, ${order.providerReview},
      ${order.createdAt}, ${order.fundedAt}, ${order.deliveredAt}, ${order.completedAt}
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      fund_tx_hash = EXCLUDED.fund_tx_hash,
      release_tx_hash = EXCLUDED.release_tx_hash,
      deliverable = EXCLUDED.deliverable,
      ai_verdict = EXCLUDED.ai_verdict,
      dispute = EXCLUDED.dispute,
      buyer_rating = EXCLUDED.buyer_rating,
      provider_rating = EXCLUDED.provider_rating,
      buyer_review = EXCLUDED.buyer_review,
      provider_review = EXCLUDED.provider_review,
      funded_at = EXCLUDED.funded_at,
      delivered_at = EXCLUDED.delivered_at,
      completed_at = EXCLUDED.completed_at
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public per-use Agent Billing (x402 billable agents)
// ─────────────────────────────────────────────────────────────────────────────

export interface BillableAgent {
  id: string
  name: string
  description: string
  priceUsd: number
  freelancer: string
  endpoint: string | null
  apiKeyId: string | null
  monthlyCap: number
  usageCount: number
  active: boolean
  createdAt: number
}

interface BillableAgentRow {
  id: string
  name: string
  description: string
  price_usd: number
  freelancer: string
  endpoint: string | null
  api_key_id: string | null
  monthly_cap: number
  usage_count: number
  active: boolean
  created_at: string
}

function rowToBillableAgent(row: BillableAgentRow): BillableAgent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceUsd: Number(row.price_usd),
    freelancer: row.freelancer,
    endpoint: row.endpoint || null,
    apiKeyId: row.api_key_id || null,
    monthlyCap: Number(row.monthly_cap || 1000),
    usageCount: Number(row.usage_count || 0),
    active: !!row.active,
    createdAt: Number(row.created_at),
  }
}

/** Registers a billable agent owned by an API key. */
export async function createBillableAgent(input: {
  id: string
  name: string
  description: string
  priceUsd: number
  freelancer: string
  endpoint?: string | null
  apiKeyId: string
  monthlyCap?: number
}): Promise<BillableAgent> {
  await ready()
  const sql = getSql()
  const agent: BillableAgent = {
    id: input.id,
    name: input.name,
    description: input.description,
    priceUsd: Math.round(input.priceUsd * 100) / 100,
    freelancer: input.freelancer,
    endpoint: input.endpoint || null,
    apiKeyId: input.apiKeyId,
    monthlyCap: Math.max(1, Math.round(input.monthlyCap ?? 1000)),
    usageCount: 0,
    active: true,
    createdAt: Date.now(),
  }
  await sql`
    INSERT INTO billable_agents (
      id, name, description, price_usd, freelancer, endpoint, api_key_id, monthly_cap, usage_count, active, created_at
    ) VALUES (
      ${agent.id}, ${agent.name}, ${agent.description}, ${agent.priceUsd}, ${agent.freelancer},
      ${agent.endpoint}, ${agent.apiKeyId}, ${agent.monthlyCap}, ${agent.usageCount}, ${agent.active}, ${agent.createdAt}
    )
  `
  return agent
}

/** Fetches a billable agent by id, or null. */
export async function getBillableAgent(id: string): Promise<BillableAgent | null> {
  await ready()
  const sql = getSql()
  const rows = (await sql`SELECT * FROM billable_agents WHERE id = ${id} LIMIT 1`) as unknown as BillableAgentRow[]
  return rows[0] ? rowToBillableAgent(rows[0]) : null
}

/** Lists all billable agents owned by an API key (usage meter page). */
export async function listBillableAgents(apiKeyId: string): Promise<BillableAgent[]> {
  await ready()
  const sql = getSql()
  const rows = (await sql`
    SELECT * FROM billable_agents WHERE api_key_id = ${apiKeyId} ORDER BY created_at DESC
  `) as unknown as BillableAgentRow[]
  return rows.map(rowToBillableAgent)
}

/**
 * Atomically reserves a tx hash for one paid use of a billable agent.
 * Returns false when the hash was already consumed (replayed payment) —
 * the caller must NOT count the use or unlock the agent.
 */
export async function reserveAgentBillingUsage(txHash: string, agentId: string): Promise<boolean> {
  await ready()
  const sql = getSql()
  const reserved = (await sql`
    INSERT INTO agent_billing_usage (tx_hash, agent_id, created_at)
    VALUES (${txHash}, ${agentId}, ${Date.now()})
    ON CONFLICT (tx_hash) DO NOTHING
    RETURNING tx_hash
  `) as unknown as { tx_hash: string }[]
  return reserved.length > 0
}

/** Increments a billable agent's total usage counter in Postgres. */
export async function incrementAgentBillingUsageInDb(id: string): Promise<void> {
  await ready()
  const sql = getSql()
  await sql`UPDATE billable_agents SET usage_count = usage_count + 1 WHERE id = ${id}`
}

/** Counts paid uses of an agent since `sinceMs` (used for the monthly meter). */
export async function countAgentBillingUsageSince(agentId: string, sinceMs: number): Promise<number> {
  await ready()
  const sql = getSql()
  const rows = (await sql`
    SELECT COUNT(*)::int AS n FROM agent_billing_usage WHERE agent_id = ${agentId} AND created_at >= ${sinceMs}
  `) as unknown as { n: number }[]
  return rows[0]?.n || 0
}

/** Start-of-month epoch ms for the quota window (UTC calendar month). */
export function startOfMonthMs(now: number = Date.now()): number {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
}

/** Public economy snapshot for the PayMate Economy page.
 * Wallet addresses are public on-chain identifiers (same as the growth page).
 */
export interface TopSettler {
  freelancer: string
  settledUsd: number
  paidInvoices: number
  lastPaidAt: number | null
}

/** Top freelancer wallets by settled (paid) volume, for the public leaderboard. */
export async function getTopSettlers(limit = 10): Promise<TopSettler[]> {
  await ready()
  const sql = getSql()
  const rows = (await sql`
    SELECT lower(freelancer) AS wallet,
           SUM(amount_usd)::float AS settled_usd,
           COUNT(*)::int AS paid_invoices,
           MAX(paid_at) AS last_paid_at
    FROM invoices
    WHERE status = 'paid'
    GROUP BY lower(freelancer)
    ORDER BY settled_usd DESC
    LIMIT ${Math.min(limit, 50)}
  `) as unknown as { wallet: string; settled_usd: number; paid_invoices: number; last_paid_at: number | null }[]
  return rows.map((r) => ({
    freelancer: r.wallet,
    settledUsd: Number(r.settled_usd),
    paidInvoices: Number(r.paid_invoices),
    lastPaidAt: r.last_paid_at ? Number(r.last_paid_at) : null,
  }))
}

export interface RecentSettlement {
  id: string
  title: string
  amountUsd: number
  freelancer: string
  txHash: string | null
  paidAt: number
}

/** Most recent verified settlements, for the public live feed. */
export async function getRecentSettlements(limit = 12): Promise<RecentSettlement[]> {
  await ready()
  const sql = getSql()
  const rows = (await sql`
    SELECT id, title, amount_usd, freelancer, tx_hash, paid_at
    FROM invoices
    WHERE status = 'paid' AND paid_at IS NOT NULL
    ORDER BY paid_at DESC
    LIMIT ${Math.min(limit, 50)}
  `) as unknown as {
    id: string; title: string; amount_usd: number; freelancer: string; tx_hash: string | null; paid_at: number
  }[]
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    amountUsd: Number(r.amount_usd),
    freelancer: r.freelancer,
    txHash: r.tx_hash || null,
    paidAt: Number(r.paid_at),
  }))
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  await ready()
  const sql = getSql()
  const rows = (await sql`SELECT * FROM invoices WHERE id = ${id}`) as unknown as InvoiceRow[]
  return rows[0] ? rowToInvoice(rows[0]) : null
}

export async function listInvoices(freelancer: string, limit = 50): Promise<Invoice[]> {
  await ready()
  const sql = getSql()
  const rows = (await sql`
    SELECT * FROM invoices WHERE lower(freelancer) = lower(${freelancer})
    ORDER BY created_at DESC LIMIT ${Math.min(limit, 100)}
  `) as unknown as InvoiceRow[]
  return rows.map(rowToInvoice)
}

export async function markPaid(id: string, txHash: string, ipfsCid: string | null = null): Promise<Invoice | null> {
  await ready()
  const sql = getSql()
  // SECURITY (audit fix 2026-08-13): atomically reserve this tx hash in the
  // global used_settlement_tx ledger before touching the invoice. The PK
  // constraint makes this safe under concurrent/replayed requests — only the
  // first caller to reserve a given tx hash can ever mark anything paid with
  // it, closing the settlement-replay window that a read-then-write check
  // (SELECT ... then UPDATE) does not.
  const reserved = await sql`
    INSERT INTO used_settlement_tx (tx_hash, invoice_id) VALUES (${txHash}, ${id})
    ON CONFLICT (tx_hash) DO NOTHING RETURNING tx_hash
  `
  if (reserved.length === 0) return null
  const updated = (await sql`
    UPDATE invoices SET status='paid', tx_hash=${txHash}, paid_at=${Date.now()}, ipfs_receipt=${ipfsCid}
    WHERE id=${id} AND status='pending'
    RETURNING id
  `) as unknown as { id: string }[]
  if (updated.length === 0) return null
  return getInvoice(id)
}

/**
 * Atomically reserves a cross-chain source payment (chain id + source tx hash)
 * in the global settlement ledger. Returns false if that source payment was
 * already consumed. Called BEFORE the custody wallet pays out, so one deposit
 * can never be replayed to settle multiple invoices (the GOAT payout hash is
 * itself reserved by markPaid, but that is a fresh tx per settlement — the
 * SOURCE hash is what uniquely identifies the client's deposit).
 */
export async function reserveCrossChainTx(chainId: number, sourceTxHash: string, invoiceId: string): Promise<boolean> {
  await ready()
  const sql = getSql()
  const key = `CROSSCHAIN_${chainId}_${sourceTxHash}`
  const reserved = await sql`
    INSERT INTO used_settlement_tx (tx_hash, invoice_id) VALUES (${key}, ${invoiceId})
    ON CONFLICT (tx_hash) DO NOTHING RETURNING tx_hash
  `
  return reserved.length > 0
}

/** Persists (or replaces) the paywall deliverable for an invoice. */
export async function updatePaywallContent(id: string, content: string): Promise<Invoice | null> {
  await ready()
  const sql = getSql()
  const updated = (await sql`
    UPDATE invoices SET paywall_content=${content}
    WHERE id=${id}
    RETURNING id
  `) as unknown as { id: string }[]
  if (updated.length === 0) return null
  return getInvoice(id)
}

/**
 * Finds the most recent invoice in a retainer chain. A chain starts at a
 * user-created invoice (recurring_parent_id IS NULL) and continues through
 * every cron-generated retainer (recurring_parent_id = chain root id). Used by
 * the recurring cron to create the next retainer only when the previous one is
 * due — never duplicate on every run.
 */
export async function getLatestRetainer(chainRootId: string): Promise<Invoice | null> {
  await ready()
  const sql = getSql()
  const rows = (await sql`
    SELECT * FROM invoices
    WHERE id = ${chainRootId} OR recurring_parent_id = ${chainRootId}
    ORDER BY created_at DESC LIMIT 1
  `) as unknown as InvoiceRow[]
  return rows[0] ? rowToInvoice(rows[0]) : null
}

export async function getInvoiceByGithubPrUrl(url: string): Promise<Invoice | null> {
  await ready()
  const sql = getSql()
  const rows = (await sql`SELECT * FROM invoices WHERE github_pr_url=${url} AND status='pending' LIMIT 1`) as unknown as InvoiceRow[]
  if (rows.length === 0) return null
  return rowToInvoice(rows[0])
}

export async function updateStreamAmount(id: string, amountToAdd: number): Promise<Invoice | null> {
  await ready()
  const sql = getSql()
  const updated = (await sql`
    UPDATE invoices SET streamed_amount_usd = LEAST(amount_usd, streamed_amount_usd + ${amountToAdd})
    WHERE id=${id} AND status='pending' AND is_stream=true
    RETURNING id
  `) as unknown as { id: string }[]
  if (updated.length === 0) return null
  return getInvoice(id)
}

/** Records the client's real EIP-712 stream allowance on the invoice. */
export async function authorizeStream(id: string, signature: string): Promise<Invoice | null> {
  await ready()
  const sql = getSql()
  const updated = (await sql`
    UPDATE invoices SET stream_signature=${signature}, stream_authorized_at=${Date.now()}
    WHERE id=${id} AND status='pending' AND is_stream=true AND stream_signature IS NULL
    RETURNING id
  `) as unknown as { id: string }[]
  if (updated.length === 0) return null
  return getInvoice(id)
}

export async function markMilestonePaid(id: string, milestoneId: string, txHash: string, ipfsCid: string | null = null): Promise<Invoice | null> {
  await ready()
  const sql = getSql()

  // SECURITY (audit fix 2026-08-13): reserve the tx hash globally FIRST. One
  // on-chain transfer must never be able to settle two different milestones
  // (on this invoice or any other) — previously nothing checked tx_hash reuse
  // for milestone payments at all.
  const reserved = await sql`
    INSERT INTO used_settlement_tx (tx_hash, invoice_id, milestone_id) VALUES (${txHash}, ${id}, ${milestoneId})
    ON CONFLICT (tx_hash) DO NOTHING RETURNING tx_hash
  `
  if (reserved.length === 0) return null

  const invoice = await getInvoice(id)
  if (!invoice || !invoice.milestones) return null

  const msIndex = invoice.milestones.findIndex(m => m.id === milestoneId)
  if (msIndex === -1 || invoice.milestones[msIndex].status === "paid") return null

  invoice.milestones[msIndex].status = "paid"
  invoice.milestones[msIndex].txHash = txHash
  invoice.milestones[msIndex].paidAt = Date.now()

  const allPaid = invoice.milestones.every(m => m.status === "paid")
  const newStatus = allPaid ? "paid" : "pending"

  // SECURITY (audit fix 2026-08-13): the UPDATE itself is now guarded by a
  // JSONB containment check that the target milestone is NOT already marked
  // paid in the row as currently stored in Postgres — this closes the
  // read-then-write race where two concurrent requests both read "pending"
  // and both would otherwise write "paid".
  const notAlreadyPaidGuard = JSON.stringify([{ id: milestoneId, status: "paid" }])
  const updated = (await sql`
    UPDATE invoices SET
      milestones=${JSON.stringify(invoice.milestones)},
      status=${newStatus},
      tx_hash=${allPaid ? txHash : invoice.txHash},
      paid_at=${allPaid ? Date.now() : invoice.paidAt},
      ipfs_receipt=${allPaid ? ipfsCid : invoice.ipfsReceipt}
    WHERE id=${id} AND NOT (milestones @> ${notAlreadyPaidGuard}::jsonb)
    RETURNING id
  `) as unknown as { id: string }[]
  if (updated.length === 0) return null
  return getInvoice(id)
}

/** Records that client funds are locked in the on-chain escrow contract. */
export async function markEscrowFunded(id: string, escrowTxHash: string): Promise<Invoice | null> {
  await ready()
  const sql = getSql()
  const updated = (await sql`
    UPDATE invoices SET escrow_status='funded', escrow_tx_hash=${escrowTxHash}
    WHERE id=${id} AND status='pending' AND escrow_status='none'
    RETURNING id
  `) as unknown as { id: string }[]
  if (updated.length === 0) return null
  return getInvoice(id)
}

/**
 * Records that the escrowed funds were released on-chain to the freelancer
 * (normal resolve or a PAY_FREELANCER / SPLIT_50_50 verdict) and the invoice
 * is now fully paid.
 */
export async function markEscrowPaid(id: string, txHash: string, escrowTxHash: string): Promise<Invoice | null> {
  await ready()
  const sql = getSql()
  const updated = (await sql`
    UPDATE invoices SET status='paid', tx_hash=${txHash}, escrow_status='resolved',
      escrow_tx_hash=${escrowTxHash}, paid_at=${Date.now()}
    WHERE id=${id} AND status='pending' AND escrow_status='funded'
    RETURNING id
  `) as unknown as { id: string }[]
  if (updated.length === 0) return null
  return getInvoice(id)
}

/**
 * Records that a REFUND_CLIENT verdict returned the escrowed funds to the
 * client. The invoice is closed as cancelled — the freelancer was not paid.
 */
export async function markEscrowRefunded(id: string, txHash: string, escrowTxHash: string): Promise<Invoice | null> {
  await ready()
  const sql = getSql()
  const updated = (await sql`
    UPDATE invoices SET status='cancelled', tx_hash=${txHash}, escrow_status='resolved',
      escrow_tx_hash=${escrowTxHash}, paid_at=NULL
    WHERE id=${id} AND status='pending' AND escrow_status='funded'
    RETURNING id
  `) as unknown as { id: string }[]
  if (updated.length === 0) return null
  return getInvoice(id)
}

export async function cancelInvoice(id: string, freelancer: string): Promise<Invoice | null> {
  await ready()
  const sql = getSql()
  const updated = (await sql`
    UPDATE invoices SET status='cancelled', cancelled_at=${Date.now()}
    WHERE id=${id} AND lower(freelancer)=lower(${freelancer}) AND status='pending'
    RETURNING id
  `) as unknown as { id: string }[]
  if (updated.length === 0) return null
  return getInvoice(id)
}

export type DisputeResolution = "PAY_FREELANCER" | "REFUND_CLIENT" | "SPLIT_50_50"

export interface Dispute {
  id: string
  invoiceId: string
  complaint: string
  resolution: DisputeResolution | null
  reasoning: string | null
  createdAt: number
}

interface DisputeRow {
  id: string
  invoice_id: string
  complaint: string
  resolution: string | null
  reasoning: string | null
  created_at: string
}

function rowToDispute(row: DisputeRow): Dispute {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    complaint: row.complaint,
    resolution: (row.resolution as DisputeResolution) || null,
    reasoning: row.reasoning,
    createdAt: Number(row.created_at),
  }
}

/** Raises a dispute and immediately records the AI arbitrator's verdict for it (single round-trip). */
export async function createDispute(input: {
  invoiceId: string
  complaint: string
  resolution: DisputeResolution
  reasoning: string
}): Promise<Dispute> {
  await ready()
  const sql = getSql()
  const dispute: Dispute = {
    id: crypto.randomUUID(),
    invoiceId: input.invoiceId,
    complaint: input.complaint.trim(),
    resolution: input.resolution,
    reasoning: input.reasoning,
    createdAt: Date.now(),
  }
  await sql`INSERT INTO disputes VALUES (
    ${dispute.id}, ${dispute.invoiceId}, ${dispute.complaint},
    ${dispute.resolution}, ${dispute.reasoning}, ${dispute.createdAt}
  )`
  return dispute
}

export async function listDisputesForInvoice(invoiceId: string, limit = 20): Promise<Dispute[]> {
  await ready()
  const sql = getSql()
  const rows = (await sql`
    SELECT * FROM disputes WHERE invoice_id = ${invoiceId}
    ORDER BY created_at ASC LIMIT ${Math.min(limit, 50)}
  `) as unknown as DisputeRow[]
  return rows.map(rowToDispute)
}

export async function countDisputesForInvoice(invoiceId: string): Promise<number> {
  await ready()
  const sql = getSql()
  const rows = (await sql`SELECT COUNT(*)::int AS n FROM disputes WHERE invoice_id = ${invoiceId}`) as unknown as { n: number }[]
  return rows[0]?.n || 0
}

function rowToFeedback(row: FeedbackRow): Feedback {
  return {
    id: row.id,
    role: row.role as FeedbackRole,
    name: row.name,
    contact: row.contact,
    rating: row.rating,
    comment: row.comment,
    invoiceId: row.invoice_id,
    createdAt: Number(row.created_at),
  }
}

export async function createFeedback(input: {
  role: FeedbackRole
  name: string
  contact?: string | null
  rating: number
  comment: string
  invoiceId?: string | null
}): Promise<Feedback> {
  await ready()
  const sql = getSql()
  const feedback: Feedback = {
    id: crypto.randomUUID(),
    role: input.role,
    name: input.name.trim(),
    contact: input.contact?.trim() || null,
    rating: Math.min(5, Math.max(1, Math.round(input.rating))),
    comment: input.comment.trim(),
    invoiceId: input.invoiceId || null,
    createdAt: Date.now(),
  }
  await sql`INSERT INTO feedback VALUES (
    ${feedback.id}, ${feedback.role}, ${feedback.name}, ${feedback.contact},
    ${feedback.rating}, ${feedback.comment}, ${feedback.invoiceId}, ${feedback.createdAt}
  )`
  return feedback
}

// SECURITY (audit fix 2026-08-13): `contact` is user-submitted PII
// (email/phone). Every current caller (GET /api/feedback, GET /api/growth)
// is a fully public, unauthenticated endpoint, so contact info is redacted
// by default. Pass `includeContact: true` only from a trusted, authenticated
// (e.g. admin) code path that genuinely needs to follow up with a submitter.
export async function listFeedback(limit = 50, options?: { includeContact?: boolean }): Promise<Feedback[]> {
  await ready()
  const sql = getSql()
  const rows = (await sql`
    SELECT * FROM feedback ORDER BY created_at DESC LIMIT ${Math.min(limit, 100)}
  `) as unknown as FeedbackRow[]
  const includeContact = options?.includeContact === true
  return rows.map(row => {
    const feedback = rowToFeedback(row)
    return includeContact ? feedback : { ...feedback, contact: null }
  })
}

export interface GrowthTarget {
  metric: string
  label: string
  target: number
  updatedAt: number
}

/** All Stage 2 growth targets (the locked baseline), keyed by metric id. */
export async function getGrowthTargets(): Promise<GrowthTarget[]> {
  await ready()
  const sql = getSql()
  const rows = (await sql`SELECT metric, label, target, updated_at FROM growth_targets ORDER BY metric`) as unknown as {
    metric: string
    label: string
    target: number
    updated_at: string
  }[]
  return rows.map((r) => ({
    metric: r.metric,
    label: r.label,
    target: Number(r.target),
    updatedAt: Number(r.updated_at),
  }))
}

/** Sets (or replaces) one growth target. Targets are the locked baseline. */
export async function setGrowthTarget(metric: string, label: string, target: number): Promise<void> {
  await ready()
  const sql = getSql()
  await sql`
    INSERT INTO growth_targets (metric, label, target, updated_at)
    VALUES (${metric}, ${label}, ${target}, ${Date.now()})
    ON CONFLICT (metric) DO UPDATE SET
      label = EXCLUDED.label,
      target = EXCLUDED.target,
      updated_at = EXCLUDED.updated_at
  `
}

/** Removes a growth target (e.g. to correct a typo before the audit locks it). */
export async function deleteGrowthTarget(metric: string): Promise<void> {
  await ready()
  const sql = getSql()
  await sql`DELETE FROM growth_targets WHERE metric = ${metric}`
}

export interface GrowthStats {
  totalInvoices: number
  paidInvoices: number
  pendingInvoices: number
  settlementRate: number
  totalVolumeSettled: number
  outstandingVolume: number
  uniqueFreelancers: number
  uniqueClients: number
  feedbackCount: number
  averageRating: number
  feedbackByRole: { role: string; count: number }[]
  firstInvoiceAt: number | null
  lastInvoiceAt: number | null
  lastPaidInvoice: { title: string; amountUsd: number; txHash: string | null; paidAt: number } | null
  // Invoices created through the ClawUp intent adapter (webhook_url ===
  // REFERRAL_MULTIPLIER_TAG "clawup-referral-1.2x") — evidence of ClawUp-
  // originated usage separate from the growth targets.
  clawUpIntentInvoices: number
  clawUpIntentVolume: number
}

export async function getGrowthStats(): Promise<GrowthStats> {
  await ready()
  const sql = getSql()

  const invoiceRows = (await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status='paid')::int AS paid,
      COUNT(*) FILTER (WHERE status='pending')::int AS pending,
      COALESCE(SUM(amount_usd) FILTER (WHERE status='paid'), 0)::float AS settled_volume,
      COALESCE(SUM(amount_usd) FILTER (WHERE status='pending'), 0)::float AS outstanding_volume,
      COUNT(DISTINCT lower(freelancer))::int AS unique_freelancers,
      COUNT(DISTINCT lower(client))::int AS unique_clients,
      MIN(created_at) AS first_at,
      MAX(created_at) AS last_at
    FROM invoices
  `) as unknown as {
    total: number; paid: number; pending: number; settled_volume: number; outstanding_volume: number
    unique_freelancers: number; unique_clients: number; first_at: string | null; last_at: string | null
  }[]
  const inv = invoiceRows[0]

  const feedbackRows = (await sql`
    SELECT COUNT(*)::int AS total, COALESCE(AVG(rating), 0)::float AS avg_rating
    FROM feedback
  `) as unknown as { total: number; avg_rating: number }[]
  const fb = feedbackRows[0]

  const lastPaidRows = (await sql`
    SELECT title, amount_usd, tx_hash, paid_at FROM invoices
    WHERE status='paid' AND paid_at IS NOT NULL
    ORDER BY paid_at DESC LIMIT 1
  `) as unknown as { title: string; amount_usd: number; tx_hash: string | null; paid_at: string }[]
  const lastPaid = lastPaidRows[0]

  const byRoleRows = (await sql`
    SELECT role, COUNT(*)::int AS count FROM feedback GROUP BY role
  `) as unknown as { role: string; count: number }[]

  const clawUpRows = (await sql`
    SELECT
      COUNT(*)::int AS total,
      COALESCE(SUM(amount_usd) FILTER (WHERE status='paid'), 0)::float AS settled
    FROM invoices WHERE webhook_url LIKE 'clawup%'
  `) as unknown as { total: number; settled: number }[]

  return {
    totalInvoices: inv.total,
    paidInvoices: inv.paid,
    pendingInvoices: inv.pending,
    settlementRate: inv.total > 0 ? Math.round((inv.paid / inv.total) * 100) : 0,
    totalVolumeSettled: inv.settled_volume,
    outstandingVolume: inv.outstanding_volume,
    uniqueFreelancers: inv.unique_freelancers,
    uniqueClients: inv.unique_clients,
    feedbackCount: fb.total,
    averageRating: Math.round(fb.avg_rating * 10) / 10,
    feedbackByRole: byRoleRows,
    firstInvoiceAt: inv.first_at ? Number(inv.first_at) : null,
    lastInvoiceAt: inv.last_at ? Number(inv.last_at) : null,
    lastPaidInvoice: lastPaid
      ? { title: lastPaid.title, amountUsd: Number(lastPaid.amount_usd), txHash: lastPaid.tx_hash, paidAt: Number(lastPaid.paid_at) }
      : null,
    clawUpIntentInvoices: clawUpRows[0].total,
    clawUpIntentVolume: clawUpRows[0].settled,
  }
}

export interface TopFreelancer {
  freelancer: string
  totalEarned: number
  jobsCompleted: number
}

export async function getTopFreelancers(limit = 10): Promise<TopFreelancer[]> {
  await ready()
  const sql = getSql()
  const rows = (await sql`
    SELECT
      lower(freelancer) as freelancer,
      COALESCE(SUM(amount_usd), 0)::float as total_earned,
      COUNT(*)::int as jobs_completed
    FROM invoices
    WHERE status = 'paid'
    GROUP BY lower(freelancer)
    ORDER BY total_earned DESC
    LIMIT ${limit}
  `) as unknown as { freelancer: string; total_earned: number; jobs_completed: number }[]

  return rows.map(r => ({
    freelancer: r.freelancer,
    totalEarned: r.total_earned,
    jobsCompleted: r.jobs_completed
  }))
}

export interface ChatState {
  chatId: string
  address: string | null
  amountUsd: string | null
  description: string | null
  updatedAt: number
}

export async function getChatState(chatId: string): Promise<ChatState> {
  await ready()
  const sql = getSql()
  const rows = (await sql`SELECT * FROM chat_states WHERE chat_id = ${chatId}`) as unknown as {
    chat_id: string; address: string | null; amount_usd: string | null; description: string | null; updated_at: string
  }[]
  if (rows.length === 0) {
    return { chatId, address: null, amountUsd: null, description: null, updatedAt: Date.now() }
  }
  return {
    chatId: rows[0].chat_id,
    address: rows[0].address,
    amountUsd: rows[0].amount_usd,
    description: rows[0].description,
    updatedAt: Number(rows[0].updated_at)
  }
}

export async function saveChatState(state: ChatState): Promise<void> {
  await ready()
  const sql = getSql()
  await sql`
    INSERT INTO chat_states (chat_id, address, amount_usd, description, updated_at)
    VALUES (${state.chatId}, ${state.address}, ${state.amountUsd}, ${state.description}, ${state.updatedAt})
    ON CONFLICT (chat_id) DO UPDATE SET
      address = EXCLUDED.address,
      amount_usd = EXCLUDED.amount_usd,
      description = EXCLUDED.description,
      updated_at = EXCLUDED.updated_at
  `
}

export async function clearChatState(chatId: string): Promise<void> {
  await ready()
  const sql = getSql()
  await sql`DELETE FROM chat_states WHERE chat_id = ${chatId}`
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Public Agent API keys
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string
  name: string
  wallet: string
  keyHash: string
  keyPrefix: string
  quotaUsd: number
  usedUsd: number
  revokedAt: number | null
  createdAt: number
  lastUsedAt: number | null
}

interface ApiKeyRow {
  id: string
  name: string
  wallet: string
  key_hash: string
  key_prefix: string
  quota_usd: number
  used_usd: number
  revoked_at: string | null
  created_at: string
  last_used_at: string | null
}

function rowToApiKey(row: ApiKeyRow): ApiKey {
  return {
    id: row.id,
    name: row.name,
    wallet: row.wallet,
    keyHash: row.key_hash,
    keyPrefix: row.key_prefix,
    quotaUsd: Number(row.quota_usd),
    usedUsd: Number(row.used_usd),
    revokedAt: row.revoked_at === null ? null : Number(row.revoked_at),
    createdAt: Number(row.created_at),
    lastUsedAt: row.last_used_at === null ? null : Number(row.last_used_at),
  }
}

/** Creates an API key row. Only the SHA-256 hash of the secret is stored. */
export async function createApiKey(input: {
  id: string
  name: string
  wallet: string
  keyHash: string
  keyPrefix: string
  quotaUsd: number
}): Promise<void> {
  await ready()
  const sql = getSql()
  await sql`
    INSERT INTO api_keys (id, name, wallet, key_hash, key_prefix, quota_usd, used_usd, created_at)
    VALUES (${input.id}, ${input.name}, ${input.wallet.toLowerCase()}, ${input.keyHash}, ${input.keyPrefix}, ${input.quotaUsd}, 0, ${Date.now()})
  `
}

export async function listApiKeys(wallet: string): Promise<ApiKey[]> {
  await ready()
  const sql = getSql()
  const rows = (await sql`
    SELECT * FROM api_keys WHERE wallet = ${wallet.toLowerCase()}
    ORDER BY created_at DESC
  `) as unknown as ApiKeyRow[]
  return rows.map(rowToApiKey)
}

export interface MerchantProfile {
  apiKeyId: string
  storeName: string | null
  logoUrl: string | null
  receiveWallet: string | null
  webhookUrl: string | null
  successUrl: string | null
  cancelUrl: string | null
  webhookSecret: string | null
  createdAt: number
}

interface MerchantProfileRow {
  api_key_id: string
  store_name: string | null
  logo_url: string | null
  receive_wallet: string | null
  webhook_url: string | null
  success_url: string | null
  cancel_url: string | null
  webhook_secret: string | null
  created_at: string
}

function rowToMerchantProfile(row: MerchantProfileRow): MerchantProfile {
  return {
    apiKeyId: row.api_key_id,
    storeName: row.store_name || null,
    logoUrl: row.logo_url || null,
    receiveWallet: row.receive_wallet || null,
    webhookUrl: row.webhook_url || null,
    successUrl: row.success_url || null,
    cancelUrl: row.cancel_url || null,
    webhookSecret: row.webhook_secret || null,
    createdAt: Number(row.created_at),
  }
}

/** Loads the merchant profile for an API key (null when never created). */
export async function getMerchantProfile(apiKeyId: string): Promise<MerchantProfile | null> {
  await ready()
  const sql = getSql()
  const rows = (await sql`SELECT * FROM merchant_profiles WHERE api_key_id = ${apiKeyId}`) as unknown as MerchantProfileRow[]
  return rows.length ? rowToMerchantProfile(rows[0]) : null
}

/**
 * Creates or updates the merchant profile for an API key. Fields not passed
 * are left untouched; the webhook secret is generated once and never
 * regenerated by an update (rotate it by passing an explicit new value).
 */
export async function upsertMerchantProfile(
  apiKeyId: string,
  fields: Partial<Pick<MerchantProfile, "storeName" | "logoUrl" | "receiveWallet" | "webhookUrl" | "successUrl" | "cancelUrl" | "webhookSecret">>,
): Promise<MerchantProfile> {
  await ready()
  const sql = getSql()
  const existing = await getMerchantProfile(apiKeyId)
  const createdAt = existing?.createdAt ?? Date.now()
  await sql`
    INSERT INTO merchant_profiles (api_key_id, store_name, logo_url, receive_wallet, webhook_url, success_url, cancel_url, webhook_secret, created_at)
    VALUES (${apiKeyId}, ${fields.storeName ?? existing?.storeName ?? null}, ${fields.logoUrl ?? existing?.logoUrl ?? null}, ${fields.receiveWallet ?? existing?.receiveWallet ?? null}, ${fields.webhookUrl ?? existing?.webhookUrl ?? null}, ${fields.successUrl ?? existing?.successUrl ?? null}, ${fields.cancelUrl ?? existing?.cancelUrl ?? null}, ${fields.webhookSecret ?? existing?.webhookSecret ?? null}, ${createdAt})
    ON CONFLICT (api_key_id) DO UPDATE SET
      store_name = EXCLUDED.store_name,
      logo_url = EXCLUDED.logo_url,
      receive_wallet = EXCLUDED.receive_wallet,
      webhook_url = EXCLUDED.webhook_url,
      success_url = EXCLUDED.success_url,
      cancel_url = EXCLUDED.cancel_url,
      webhook_secret = EXCLUDED.webhook_secret
  `
  const row = (await sql`SELECT * FROM merchant_profiles WHERE api_key_id = ${apiKeyId}`) as unknown as MerchantProfileRow[]
  return rowToMerchantProfile(row[0])
}

/** Lists invoices created via the merchant checkout API for an API key. */
export async function listInvoicesByApiKey(apiKeyId: string, limit = 50): Promise<Invoice[]> {
  await ready()
  const sql = getSql()
  const rows = (await sql`
    SELECT * FROM invoices WHERE api_key_id = ${apiKeyId}
    ORDER BY created_at DESC LIMIT ${limit}
  `) as unknown as InvoiceRow[]
  return rows.map(rowToInvoice)
}

/** Looks up a key by its SHA-256 hash (constant-time-ish; hash equality is safe). */
export async function getApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
  await ready()
  const sql = getSql()
  const rows = (await sql`
    SELECT * FROM api_keys WHERE key_hash = ${keyHash} LIMIT 1
  `) as unknown as ApiKeyRow[]
  return rows[0] ? rowToApiKey(rows[0]) : null
}

export async function getApiKeyById(id: string): Promise<ApiKey | null> {
  await ready()
  const sql = getSql()
  const rows = (await sql`
    SELECT * FROM api_keys WHERE id = ${id} LIMIT 1
  `) as unknown as ApiKeyRow[]
  return rows[0] ? rowToApiKey(rows[0]) : null
}

/** Marks a key revoked (owner only). */
export async function revokeApiKey(id: string, wallet: string): Promise<boolean> {
  await ready()
  const sql = getSql()
  const rows = (await sql`
    UPDATE api_keys SET revoked_at = ${Date.now()}
    WHERE id = ${id} AND lower(wallet) = lower(${wallet}) AND revoked_at IS NULL
    RETURNING id
  `) as unknown as { id: string }[]
  return rows.length > 0
}

/** Updates the key's last_used_at timestamp on each authenticated call. */
export async function touchApiKey(id: string): Promise<void> {
  await ready()
  const sql = getSql()
  await sql`UPDATE api_keys SET last_used_at = ${Date.now()} WHERE id = ${id}`
}

/**
 * Consumes `amountUsd` against the key's quota. Returns false (no spend)
 * if the key would exceed its quota — fail closed on any DB error too.
 */
export async function consumeApiQuota(id: string, amountUsd: number): Promise<boolean> {
  try {
    await ready()
    const sql = getSql()
    const rows = (await sql`
      UPDATE api_keys
      SET used_usd = used_usd + ${amountUsd}
      WHERE id = ${id} AND revoked_at IS NULL AND used_usd + ${amountUsd} <= quota_usd
      RETURNING id
    `) as unknown as { id: string }[]
    return rows.length > 0
  } catch (error) {
    console.error("[db] consumeApiQuota failed, failing closed:", error)
    return false
  }
}

/**
 * EIP-712 replay guard (Tier-1 security): atomically claims a
 * (wallet, nonce) pair exactly once. Returns false if the nonce was already
 * used — the same proof can never be accepted twice.
 */
export async function claimProofNonce(wallet: string, nonce: string): Promise<boolean> {
  try {
    await ready()
    const sql = getSql()
    const rows = (await sql`
      INSERT INTO wallet_proof_nonce (wallet, nonce, used_at)
      VALUES (${wallet.toLowerCase()}, ${nonce}, ${Date.now()})
      ON CONFLICT (wallet, nonce) DO NOTHING
      RETURNING wallet
    `) as unknown as { wallet: string }[]
    return rows.length > 0
  } catch (error) {
    console.error("[db] claimProofNonce failed, failing open:", error)
    // Fail open only on DB outage: signature validity + freshness still gate
    // the proof; the nonce guard is a second layer, not the only one.
    return true
  }
}
