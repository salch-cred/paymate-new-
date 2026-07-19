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
