import { createFileRoute, Link } from "@tanstack/react-router";
import { INVOICEFLAG_EMAIL, INVOICEFLAG_EMAIL_LABEL, STRIPE } from "@/lib/site";

export const Route = createFileRoute("/shipping")({
  head: () => ({
    meta: [
      { title: "InvoiceFlag | 3PL invoice auditor" },
      {
        name: "description",
        content:
          "Upload last month’s 3PL or parcel invoice. Get line-by-line flags and an email you can send billing. First audit free. No store login.",
      },
    ],
  }),
  component: Shipping,
});

export function Shipping() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <span className="eyebrow">InvoiceFlag · for brands that ship</span>
            <h1>Find the fees your 3PL didn’t expect you to check.</h1>
            <p className="lead">
              Upload last month’s invoice. Get a line-by-line audit and an email you can send as-is.
              First audit is free. No software to connect. This is not the cleaning tools and not
              the phone system.
            </p>
            <div className="cta-row">
              <a href={`${INVOICEFLAG_EMAIL}?subject=InvoiceFlag%20first%20audit`} className="button button-primary">
                Email for free audit
              </a>
              <a href="#pricing" className="button button-secondary">
                See pricing
              </a>
            </div>
          </div>
          <aside className="hero-panel">
            <span className="panel-label">The short version</span>
            <h2>Three steps. One file.</h2>
            <ul className="metric-list">
              <li>
                <strong>01 Upload:</strong> PDF, CSV, or spreadsheet. No Shopify. No 3PL login.
              </li>
              <li>
                <strong>02 Audit:</strong> duplicates, uncontracted fees, DIM/DAS, pick-count
                mismatches, portal charges.
              </li>
              <li>
                <strong>03 Send:</strong> copy the email. You decide what to ask billing.
              </li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-label">What it looks for</span>
            <h2 className="section-title">The lines that slip past a glance at the total.</h2>
          </div>
          <ul className="detail-list">
            <li>Duplicate tracking / accessorials.</li>
            <li>Fees that were never on the contract.</li>
            <li>DIM and DAS stacked on the same shipment.</li>
            <li>Peak / residential / extended-area surprises.</li>
            <li>Pick or order counts that don’t match the backup.</li>
          </ul>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="container">
          <div className="section-header">
            <span className="section-label">Pricing</span>
            <h2 className="section-title">The first one is free. After that, it costs less than one bad fee.</h2>
          </div>
          <div className="package-grid">
            <article className="pricing-card featured">
              <span className="pricing-meta">First audit</span>
              <h3 className="pricing-title">Free</h3>
              <p className="pricing-copy">Send one invoice. If nothing’s off, you owe nothing.</p>
              <p style={{ marginTop: 16 }}>
                <a href={`${INVOICEFLAG_EMAIL}?subject=InvoiceFlag%20first%20audit`} className="button button-primary">
                  Email for free audit
                </a>
              </p>
            </article>
            <article className="pricing-card">
              <span className="pricing-meta">Single audit</span>
              <h3 className="pricing-title">$19</h3>
              <p className="pricing-copy">One bill, one audit. Pay per invoice after the first.</p>
              <p style={{ marginTop: 16 }}>
                <a href={STRIPE.invoiceOnce} className="button button-primary" target="_blank" rel="noreferrer">
                  Pay $19 — single audit
                </a>
              </p>
            </article>
            <article className="pricing-card">
              <span className="pricing-meta">Monthly</span>
              <h3 className="pricing-title">$49</h3>
              <p className="pricing-copy">For operators with more than one bill a month.</p>
              <p style={{ marginTop: 16 }}>
                <a href={STRIPE.invoiceMonthly} className="button button-primary" target="_blank" rel="noreferrer">
                  Pay $49/mo
                </a>
              </p>
            </article>
          </div>
          <div className="notice" style={{ marginTop: 24 }}>
            <p>
              Charges on the card: <strong>FRAMEWORK SYSTEMS</strong>.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container compare-grid">
          <div className="panel">
            <span className="panel-label">Fit</span>
            <h2>This is for you if the bill already exists.</h2>
            <ul className="detail-list">
              <li>You pay a 3PL or parcel account every month.</li>
              <li>You have a PDF or CSV of the bill.</li>
              <li>You want questions to ask before you pay, not a lawsuit.</li>
            </ul>
          </div>
          <div className="panel">
            <span className="panel-label">Not a fit</span>
            <h2>We do not log into ShipBob or Shopify.</h2>
            <ul className="detail-list">
              <li>You want us inside your store or 3PL portal.</li>
              <li>You want us to negotiate with the 3PL for you.</li>
              <li>You don’t have a bill to upload.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="cta-band">
            <span className="section-label">Primary next step</span>
            <h2 className="cta-title">Send last month’s invoice.</h2>
            <p className="cta-copy">
              Email the PDF or CSV to {INVOICEFLAG_EMAIL_LABEL}. Subject: InvoiceFlag first audit. If
              nothing’s off, you owe nothing.
            </p>
            <div className="cta-row">
              <a href={`${INVOICEFLAG_EMAIL}?subject=InvoiceFlag%20first%20audit`} className="button button-primary">
                Email the invoice
              </a>
              <Link to="/" className="button button-secondary">
                Back to all tools
              </Link>
            </div>
            <p className="cta-fine">InvoiceFlag does not connect to your store or 3PL. The file stays the file.</p>
          </div>
        </div>
      </section>
    </>
  );
}
