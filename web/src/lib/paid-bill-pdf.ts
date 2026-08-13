// Shared "paid bill" PDF builder — works in both the browser (client download)
// and Node (server route). Uses only jsPDF's vector API, so it renders
// identically everywhere with no DOM/canvas dependency.

export type PaidBillInvoice = {
  id: string
  freelancer: string
  client: string
  title?: string
  description: string
  amountUsd: number
  status: string
  chain?: string
  dueDate?: string
  txHash?: string
  ipfsReceipt?: string | null
  createdAt?: number
  paidAt?: number | null
  isStream?: boolean
  streamRateUsd?: number | null
  streamedAmountUsd?: number
  splits?: { address: string; amountUsd: number }[]
  escrowTxHash?: string | null
}

const fmtDate = (ts?: number | null) =>
  ts ? new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"

const shortAddr = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)

export async function buildPaidBillPdf(invoice: PaidBillInvoice) {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const W = 210
  const M = 18
  const CW = W - M * 2
  const INK: [number, number, number] = [23, 24, 15]
  const MUTED: [number, number, number] = [138, 137, 129]
  const ORANGE: [number, number, number] = [255, 91, 46]
  const GREEN: [number, number, number] = [49, 116, 84]
  const LINE: [number, number, number] = [232, 230, 223]
  const BG: [number, number, number] = [250, 248, 244]
  const amount = invoice.amountUsd ?? 0
  let y = 18

  // --- Header ---
  doc.setFont("helvetica", "bold")
  doc.setFontSize(22)
  doc.setTextColor(...INK)
  doc.text("PayMate", M, y)
  doc.setTextColor(...ORANGE)
  doc.text(".", M + doc.getTextWidth("PayMate"), y)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(...MUTED)
  doc.text("PAID BILL", W - M, y, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.text(`Invoice ${invoice.id}`, W - M, y + 5, { align: "right" })

  // --- Status badge ---
  y += 12
  doc.setFillColor(...GREEN)
  doc.roundedRect(M, y, 30, 9, 2, 2, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text("PAID", M + 15, y + 6, { align: "center" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text("Verified on GOAT Network — non-custodial settlement", W - M, y + 6, { align: "right" })

  // --- Meta ---
  y += 20
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text("ISSUED", M, y)
  doc.text("DUE", M + CW / 2, y)
  doc.text("PAID", W - M, y, { align: "right" })
  doc.text("NETWORK", W - M, y + 10, { align: "right" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  doc.text(fmtDate(invoice.createdAt), M, y + 5)
  doc.text(fmtDate(invoice.dueDate ? new Date(invoice.dueDate).getTime() : undefined), M + CW / 2, y + 5)
  doc.text(fmtDate(invoice.paidAt), W - M, y + 5, { align: "right" })
  doc.text(invoice.chain || "GOAT Network", W - M, y + 15, { align: "right" })

  // --- Divider ---
  y += 24
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y)

  // --- Parties ---
  y += 10
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text("BILLED TO (CLIENT)", M, y)
  doc.text("PAYABLE TO (FREELANCER)", M + CW / 2, y)
  doc.setFont("courier", "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(...INK)
  const clientLines = doc.splitTextToSize(invoice.client, CW / 2 - 4)
  doc.text(clientLines, M, y + 5)
  const freelancerLines = doc.splitTextToSize(invoice.freelancer, CW / 2 - 4)
  doc.text(freelancerLines, M + CW / 2, y + 5)

  // --- Summary card ---
  y += Math.max(clientLines.length, freelancerLines.length) * 4.5 + 14
  const titleLines = doc.splitTextToSize(invoice.title || "Invoice", CW - 24)
  const descLines = doc.splitTextToSize(invoice.description || "", CW - 24)
  const splitsBlock = invoice.splits?.length ? 8 + invoice.splits.length * 5 : 0
  const cardH = 22 + titleLines.length * 6 + descLines.length * 4.5 + splitsBlock
  doc.setFillColor(...BG)
  doc.roundedRect(M, y, CW, cardH, 3, 3, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.setTextColor(...INK)
  doc.text(titleLines, M + 12, y + 9)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9.5)
  doc.setTextColor(...MUTED)
  doc.text(descLines, M + 12, y + 9 + titleLines.length * 6 + 4)
  let amountY = y + 9 + titleLines.length * 6 + 4 + descLines.length * 4.5 + 10
  if (invoice.splits && invoice.splits.length > 0) {
    doc.setFontSize(8.5)
    doc.setTextColor(...MUTED)
    doc.text("Smart-contract routing", M + 12, amountY)
    doc.setFont("courier", "normal")
    amountY += 5
    for (const s of invoice.splits) {
      doc.text(shortAddr(s.address), M + 12, amountY)
      doc.text(`$${s.amountUsd.toLocaleString()} USDC`, W - M - 12, amountY, { align: "right" })
      amountY += 5
    }
    doc.setFont("helvetica", "normal")
    amountY += 4
  }
  doc.setDrawColor(...LINE)
  doc.line(M + 12, amountY - 2, W - M - 12, amountY - 2)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  doc.text("TOTAL PAID", M + 12, amountY + 4)
  doc.setFontSize(16)
  doc.setTextColor(...ORANGE)
  doc.text(`$${amount.toLocaleString()} USDC`, W - M - 12, amountY + 5, { align: "right" })

  // --- Payment proof ---
  y = y + cardH + 16
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text("PAYMENT PROOF", M, y)
  y += 6
  if (invoice.txHash) {
    doc.setFont("courier", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...INK)
    doc.text(doc.splitTextToSize(invoice.txHash, CW), M, y)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...ORANGE)
    doc.text(`https://explorer.goat.network/tx/${invoice.txHash}`, M, y + 5)
    y += 12
  }
  if (invoice.escrowTxHash) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(...INK)
    doc.text("Escrow funding tx:", M, y)
    doc.setFont("courier", "normal")
    doc.setFontSize(8)
    doc.text(doc.splitTextToSize(invoice.escrowTxHash, CW - 40), M + 38, y)
    y += 7
  }
  if (invoice.isStream) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(...INK)
    doc.text(
      `Streaming settlement — ${(invoice.streamedAmountUsd ?? 0).toLocaleString()} USDC streamed at $${invoice.streamRateUsd ?? 0}/sec.`,
      M, y
    )
    y += 7
  }
  if (invoice.ipfsReceipt) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(`IPFS receipt: ${invoice.ipfsReceipt}`, M, y)
  }

  // --- Footer ---
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text("Generated by PayMate · paymateagent.xyz · Settled on GOAT Network", W / 2, 280, { align: "center" })

  return doc
}

export { fmtDate, shortAddr }
