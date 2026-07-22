import { neon } from "@neondatabase/serverless"
import crypto from "node:crypto"

export type InvoiceStatus = "pending" | "paid" | "cancelled"

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
}

declare global {
  var __paymateSchemaReady: Promise<void> | undefined
}

function getSql() {
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
        created_at BIGINT NOT NULL, paid_at BIGINT
      )`
      await sql`CREATE INDEX IF NOT EXISTS idx_invoices_freelancer ON invoices(freelancer, created_at DESC)`
      await sql`CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY, role TEXT NOT NULL, name TEXT NOT NULL, contact TEXT,
        rating INTEGER NOT NULL, comment TEXT NOT NULL, invoice_id TEXT,
        created_at BIGINT NOT NULL
      )`
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
  }
}

export async function createInvoice(input: {
  freelancer: string
  client: string
  title: string
  description: string
  amountUsd: number
  dueDate?: string | null
}): Promise<Invoice> {
  await ready()
  const sql = getSql()
  const invoice: Invoice = {
    id: crypto.randomUUID(),
    freelancer: input.freelancer,
    client: input.client,
    title: input.title.trim() || "Professional services",
    description: input.description.trim(),
    amountUsd: Math.round(input.amountUsd * 100) / 100,
    status: "pending",
    chain: "goat-testnet3",
    dueDate: input.dueDate || null,
    txHash: null,
    createdAt: Date.now(),
    paidAt: null,
  }
  await sql`INSERT INTO invoices VALUES (
    ${invoice.id}, ${invoice.freelancer}, ${invoice.client}, ${invoice.title}, ${invoice.description},
    ${invoice.amountUsd}, ${invoice.status}, ${invoice.chain}, ${invoice.dueDate}, ${invoice.txHash},
    ${invoice.createdAt}, ${invoice.paidAt}
  )`
  return invoice
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

export async function markPaid(id: string, txHash: string): Promise<Invoice | null> {
  await ready()
  const sql = getSql()
  const reusedElsewhere = await sql`SELECT 1 FROM invoices WHERE tx_hash = ${txHash} AND id != ${id}`
  if (reusedElsewhere.length > 0) return null
  const updated = (await sql`
    UPDATE invoices SET status='paid', tx_hash=${txHash}, paid_at=${Date.now()}
    WHERE id=${id} AND status='pending'
    RETURNING id
  `) as unknown as { id: string }[]
  if (updated.length === 0) return null
  return getInvoice(id)
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

export async function listFeedback(limit = 50): Promise<Feedback[]> {
  await ready()
  const sql = getSql()
  const rows = (await sql`
    SELECT * FROM feedback ORDER BY created_at DESC LIMIT ${Math.min(limit, 100)}
  `) as unknown as FeedbackRow[]
  return rows.map(rowToFeedback)
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

  const byRoleRows = (await sql`
    SELECT role, COUNT(*)::int AS count FROM feedback GROUP BY role
  `) as unknown as { role: string; count: number }[]

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
  }
}
