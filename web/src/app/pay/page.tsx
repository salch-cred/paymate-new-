import Link from "next/link"
import { Icon } from "@/components/icons"
import { PayInvoiceBox } from "@/components/pay-invoice-box"

/**
 * Public /pay — "type your invoice ID and pay".
 *
 * Clients who received an invoice ID (link, email, or chat) can land here and
 * pay without needing the full URL. Entering the ID validates it and routes
 * to the live checkout at /pay/<id>.
 */
export default function PayIndexPage() {
  return (
    <main className="payment-shell">
      <header className="payment-nav">
        <Link className="brand" href="/">
          <span className="brand-mark"><span /></span>
          <b>PayMate</b>
        </Link>
        <Link
          href="/"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--ink)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Icon name="arrow" size={14} style={{ transform: "rotate(180deg)" }} />
          Back to PayMate
        </Link>
      </header>

      <section className="payment-wrap">
        <aside className="payment-aside">
          <span className="section-kicker">CLIENT CHECKOUT</span>
          <h1>Have an invoice?<br />Pay it by ID.</h1>
          <p>Type the invoice number you received and go straight to the checkout. No account, no app — just your wallet.</p>
          <div className="trust-list">
            <div><Icon name="lock" />Non-custodial wallet payment</div>
            <div><Icon name="shield" />On-chain settlement verification</div>
            <div><Icon name="network" />Portable ERC-8004 reputation</div>
          </div>
        </aside>

        <div className="pay-body payment-card" style={{ padding: 32 }}>
          <PayInvoiceBox heading />
          <div style={{ marginTop: 28, borderTop: "1px solid var(--line)", paddingTop: 20 }}>
            <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
              Where do I find my invoice ID?
            </p>
            <ul style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.8, margin: "8px 0 0", paddingLeft: 18 }}>
              <li>The link you received looks like <code style={{ fontSize: 11 }}>paymateagent.xyz/pay/&lt;id&gt;</code> — the ID is the part after <code style={{ fontSize: 11 }}>/pay/</code>.</li>
              <li>It was also shared with you in the invoice email or chat message.</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}
