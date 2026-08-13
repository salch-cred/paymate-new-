"use client"

import { useState } from "react"
import { Icon } from "@/components/icons"
import { buildPaidBillPdf, fmtDate, shortAddr, type PaidBillInvoice } from "@/lib/paid-bill-pdf"

export { type PaidBillInvoice }

export function PaidBill({ invoice }: { invoice: PaidBillInvoice }) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const amount = invoice.amountUsd ?? 0
  const shortId = invoice.id.split("-")[0]

  async function downloadPdf() {
    setDownloading(true)
    setError(null)
    try {
      const doc = await buildPaidBillPdf(invoice)
      doc.save(`paymate-paid-bill-${shortId}.pdf`)
    } catch (e) {
      console.error("PDF generation failed:", e)
      setError("Could not generate the PDF — please try again.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ marginTop: "24px", borderTop: "1px solid var(--line)", paddingTop: "24px" }}>
      <div className="payment-label" style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
        <Icon name="receipt" size={12} /> PAID BILL — GENERATED LIVE
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "16px", overflow: "hidden" }}>
        {/* Bill header */}
        <div
          style={{
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            borderBottom: "1px solid var(--line)",
            background: "rgba(255,255,255,0.6)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "var(--ink)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon name="receipt" size={16} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {invoice.title || "Invoice"} — Paid
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>{invoice.id}</div>
            </div>
          </div>
          <span className="status-badge" style={{ background: "#e7f5ec", color: "#317454", flexShrink: 0 }}>
            <Icon name="check" size={10} /> PAID
          </span>
        </div>

        {/* Bill body */}
        <div style={{ padding: "20px" }}>
          {/* Dates */}
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "16px" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Issued</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{fmtDate(invoice.createdAt)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Due</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{fmtDate(invoice.dueDate ? new Date(invoice.dueDate).getTime() : undefined)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Paid</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2, color: "#317454" }}>{fmtDate(invoice.paidAt)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Network</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{invoice.chain || "GOAT Network"}</div>
            </div>
          </div>

          {/* Parties */}
          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", marginBottom: "16px", padding: "14px", background: "rgba(255,255,255,0.6)", borderRadius: "10px", border: "1px solid var(--line)" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>Billed to (Client)</div>
              <div style={{ fontFamily: "monospace", fontSize: 12, wordBreak: "break-all", color: "var(--ink)" }}>{invoice.client}</div>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 4 }}>Payable to (Freelancer)</div>
              <div style={{ fontFamily: "monospace", fontSize: 12, wordBreak: "break-all", color: "var(--ink)" }}>{invoice.freelancer}</div>
            </div>
          </div>

          {/* Summary */}
          <div style={{ padding: "14px 16px", background: "rgba(250,248,244,0.9)", borderRadius: "10px", border: "1px solid var(--line)", marginBottom: "16px" }}>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{invoice.title || "Invoice"}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, marginBottom: 12 }}>{invoice.description}</div>
            {invoice.splits && invoice.splits.length > 0 && (
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                {invoice.splits.map((s, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                    <span style={{ fontFamily: "monospace" }}>{shortAddr(s.address)}</span>
                    <span>${s.amountUsd.toLocaleString()} USDC</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--muted)" }}>Total Paid</span>
              <span style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: "-0.5px", color: "#ff5b2e" }}>
                ${amount.toLocaleString()} USDC
              </span>
            </div>
          </div>

          {/* Payment proof */}
          {invoice.txHash && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>Payment Proof</div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <code style={{ fontSize: 12, wordBreak: "break-all", color: "var(--ink)" }}>{invoice.txHash}</code>
                <a href={`https://explorer.goat.network/tx/${invoice.txHash}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: 12, fontWeight: 700, color: "inherit", textDecoration: "underline" }}>
                  View on GOAT <Icon name="arrow" size={12} />
                </a>
              </div>
              {invoice.escrowTxHash && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                  Escrow funding: <code>{invoice.escrowTxHash}</code>
                </div>
              )}
              {invoice.isStream && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                  Streaming settlement — {(invoice.streamedAmountUsd ?? 0).toLocaleString()} USDC streamed at ${invoice.streamRateUsd ?? 0}/sec.
                </div>
              )}
              {invoice.ipfsReceipt && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>IPFS receipt: <code>{invoice.ipfsReceipt}</code></div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <button className="button button-dark" onClick={downloadPdf} disabled={downloading} style={{ height: 44, padding: "0 20px" }}>
              {downloading ? (
                <>
                  <span className="draft-spinner" style={{ borderColor: "white", borderTopColor: "transparent", width: 14, height: 14, marginRight: 8 }} /> Generating…
                </>
              ) : (
                <>
                  <Icon name="check" size={16} style={{ marginRight: 8 }} /> Download PDF
                </>
              )}
            </button>
            {invoice.txHash && (
              <a href={`https://explorer.goat.network/tx/${invoice.txHash}`} target="_blank" rel="noreferrer" className="button button-outline" style={{ height: 44 }}>
                <Icon name="link" size={14} style={{ marginRight: 8 }} /> Verify on Explorer
              </a>
            )}
          </div>
          {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}
        </div>
      </div>
    </div>
  )
}
