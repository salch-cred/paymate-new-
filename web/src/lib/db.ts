import { DatabaseSync } from "node:sqlite"
import path from "node:path"
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
  created_at: number
  paid_at: number | null
}

declare global {
  var __paymateDb: DatabaseSync | undefined
}

function getDb(): DatabaseSync {
  if (!globalThis.__paymateDb) {
    const dbPath = process.env.PAYMATE_DB_PATH || path.join(process.cwd(), "paymate.db")
    const db = new DatabaseSync(dbPath)
    db.exec(`CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY, freelancer TEXT NOT NULL, client TEXT NOT NULL,
      title TEXT NOT NULL, description TEXT NOT NULL, amount_usd REAL NOT NULL,
      status TEXT NOT NULL, chain TEXT NOT NULL, due_date TEXT, tx_hash TEXT,
      created_at INTEGER NOT NULL, paid_at INTEGER
    )`)
    db.exec("CREATE INDEX IF NOT EXISTS idx_invoices_freelancer ON invoices(freelancer, created_at DESC)")
    globalThis.__paymateDb = db
  }
  return globalThis.__paymateDb
}

function rowToInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    freelancer: row.freelancer,
    client: row.client,
    title: row.title,
    description: row.description,
    amountUsd: row.amount_usd,
    status: row.status as InvoiceStatus,
    chain: row.chain,
    dueDate: row.due_date,
    txHash: row.tx_hash,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  }
}

export function createInvoice(input: {
  freelancer: string
  client: string
  title: string
  description: string
  amountUsd: number
  dueDate?: string | null
}): Invoice {
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
  getDb()
    .prepare("INSERT INTO invoices VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(
      invoice.id,
      invoice.freelancer,
      invoice.client,
      invoice.title,
      invoice.description,
      invoice.amountUsd,
      invoice.status,
      invoice.chain,
      invoice.dueDate,
      invoice.txHash,
      invoice.createdAt,
      invoice.paidAt
    )
  return invoice
}

export function getInvoice(id: string): Invoice | null {
  const row = getDb().prepare("SELECT * FROM invoices WHERE id = ?").get(id) as unknown as InvoiceRow | undefined
  return row ? rowToInvoice(row) : null
}

export function listInvoices(freelancer: string, limit = 50): Invoice[] {
  const rows = getDb()
    .prepare("SELECT * FROM invoices WHERE lower(freelancer) = lower(?) ORDER BY created_at DESC LIMIT ?")
    .all(freelancer, Math.min(limit, 100)) as unknown as InvoiceRow[]
  return rows.map(rowToInvoice)
}

export function markPaid(id: string, txHash: string): Invoice | null {
  const db = getDb()
  const reusedElsewhere = db.prepare("SELECT 1 FROM invoices WHERE tx_hash = ? AND id != ?").get(txHash, id)
  if (reusedElsewhere) return null
  const result = db
    .prepare("UPDATE invoices SET status='paid', tx_hash=?, paid_at=? WHERE id=? AND status='pending'")
    .run(txHash, Date.now(), id)
  if (result.changes === 0) return null
  return getInvoice(id)
}
