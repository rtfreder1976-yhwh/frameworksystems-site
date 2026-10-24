import { createFileRoute, Link } from "@tanstack/react-router";
import { PremiumFlagTool } from "@/components/premiumflag-tool";
import { EMAIL, EMAIL_LABEL, PREMIUMFLAG_PRICE, PREMIUMFLAG_STRIPE_URL } from "@/lib/site";

type PremiumSearch = { session_id?: string };

export const Route = createFileRoute("/premium")({
  validateSearch: (search: Record<string, unknown>): PremiumSearch => ({
    session_id:
      typeof search.session_id === "string" && search.session_id ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "PremiumFlag | The audit bill, line by line" },
      {
        name: "description",
        content:
          "PremiumFlag reads a contractor's workers comp or general liability audit bill against the payroll summary and the certificates. Each line comes back Pay or Flag. $249 a bill for the email. Not a subscription.",
      },
      // Unlisted until the Stripe link exists. The constant going live lifts this.
      ...(PREMIUMFLAG_STRIPE_URL ? [] : [{ name: "robots", content: "noindex, nofollow" }]),
    ],
  }),
  component: Premium,
});

function Premium() {
  const { session_id } = Route.useSearch();
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <span className="eyebrow">PremiumFlag · for contractors</span>
            <h1>The audit bill came. Some of those lines are not yours.</h1>
            <p className="lead">
              Your workers comp or general liability carrier audited the year and sent the bill.
              PremiumFlag reads it against the payroll summary and the certificates you already
              have. Each line comes back Pay or Flag. If every line says Pay, you owe the carrier
              and you owe us nothing. If a line is flagged, ${PREMIUMFLAG_PRICE} buys the email that
              asks for a revised audit. This is not InvoiceFlag and not CrewFlag, and it does not
              sell insurance.
            </p>
            <div className="cta-row">
              <a href="#review" className="button button-primary">
                Review a bill
              </a>
              <a href="#rules" className="button button-secondary">
                What gets flagged
              </a>
            </div>
          </div>
          <aside className="hero-panel">
            <span className="panel-label">The short version</span>
            <h2>Three files. One answer per line.</h2>
            <ul className="metric-list">
              <li>
                <strong>01 Upload:</strong> the audit bill, the payroll summary, the subcontractor
                certificates. No login. No payroll connection.
              </li>
              <li>
                <strong>02 Read:</strong> every line comes back Pay (it matches your records) or
                Flag (a document you uploaded contradicts it).
              </li>
              <li>
                <strong>03 Send:</strong> ${PREMIUMFLAG_PRICE} unlocks the plain-text email. You
                send it. Nothing goes to the carrier from us.
              </li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="section">
        <div className="container compare-grid">
          <div className="panel">
            <span className="panel-label">Not the upload</span>
            <h2>The first letter asks for records.</h2>
            <p>
              Payroll reports, certificates, tax forms, an audit appointment. There is nothing to
              compare yet. Answer it, then wait.
            </p>
          </div>
          <div className="panel">
            <span className="panel-label">The upload</span>
            <h2>The second letter is the bill.</h2>
            <p>
              The bill, or the auditor's worksheet with the audited figures on it. The math is done.
              That is what PremiumFlag reads.
            </p>
          </div>
        </div>
      </section>

      <section className="section" id="review" style={{ paddingTop: 0, scrollMarginTop: 110 }}>
        <div className="container">
          <PremiumFlagTool sessionId={session_id} />
        </div>
      </section>

      <section className="section section-dark" id="rules" style={{ scrollMarginTop: 110 }}>
        <div className="container">
          <div className="section-header">
            <span className="section-label">What gets flagged</span>
            <h2 className="section-title">Only a document you uploaded can flag a line.</h2>
          </div>
          <div className="compare-grid">
            <div className="panel">
              <span className="panel-label">Flag</span>
              <ul className="detail-list">
                <li>
                  A sub billed as payroll whose certificate in the upload shows workers comp in
                  force for those dates.
                </li>
                <li>
                  Overtime premium, the extra half, sitting inside the auditable payroll. The
                  straight-time part stays.
                </li>
                <li>
                  An owner or officer counted above the cap the document states, or counted at all
                  when the summary shows an exclusion.
                </li>
                <li>
                  A named person's payroll in a higher class code than the summary carries for them.
                </li>
                <li>
                  The full contract price used as payroll when the records split labor and
                  materials.
                </li>
                <li>
                  On a general liability audit, sub cost counted when a certificate covers that sub
                  for general liability at the required limits.
                </li>
              </ul>
            </div>
            <div className="panel">
              <span className="panel-label">Pay</span>
              <ul className="detail-list">
                <li>
                  A bill that is bigger than last year's estimate. Payroll grew, so the premium
                  grew. That is the true-up.
                </li>
                <li>
                  A sub with no certificate in the upload. Payment to an uninsured sub counts as
                  payroll on your policy.
                </li>
                <li>
                  People paid cash who are not on the summary. The tool cannot see them and will not
                  invent them.
                </li>
                <li>A line nothing in the upload contradicts.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="container">
          <div className="section-header">
            <span className="section-label">Pricing</span>
            <h2 className="section-title">${PREMIUMFLAG_PRICE} a bill. Not a subscription.</h2>
          </div>
          <div className="compare-grid">
            <article className="pricing-card featured">
              <span className="pricing-meta">Every line Pay</span>
              <h3 className="pricing-title">Free</h3>
              <p className="pricing-copy">
                You owe the carrier. You do not owe us. The result says so and stops.
              </p>
            </article>
            <article className="pricing-card">
              <span className="pricing-meta">One or more lines flagged</span>
              <h3 className="pricing-title">${PREMIUMFLAG_PRICE}</h3>
              <p className="pricing-copy">
                One email, for this bill. It lists the flagged lines, the figures, the reason, and
                the proof, and asks for a revised audit in writing. Usually once a year.
              </p>
            </article>
          </div>
          <div className="notice" style={{ marginTop: 24 }}>
            <p>
              Charges on the card: <strong>FRAMEWORK SYSTEMS</strong>. No login, no tokens, no plan.
              We don&apos;t keep the files: each is read once to produce the result.
            </p>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container compare-grid">
          <div className="panel">
            <span className="panel-label">Fit</span>
            <h2>The bill already arrived.</h2>
            <ul className="detail-list">
              <li>A contractor's workers comp or general liability audit bill or worksheet.</li>
              <li>
                A payroll summary by class code, as a CSV or a PDF with text. Not a register, not a
                scan.
              </li>
              <li>The certificates you collected from your subs.</li>
            </ul>
          </div>
          <div className="panel">
            <span className="panel-label">Not a fit</span>
            <h2>It does not sell insurance, and it is not your agent.</h2>
            <ul className="detail-list">
              <li>A one-person policy that was never audited.</li>
              <li>
                Health, life, auto, or any policy that is not a contractor's workers comp or GL.
              </li>
              <li>Cash labor with no summary row. No record, no line to flag.</li>
              <li>A promise the carrier will reduce the bill. You send the email; they answer.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta-band">
            <span className="section-label">Primary next step</span>
            <h2 className="cta-title">Have the bill? Review it.</h2>
            <p className="cta-copy">
              Three files, a minute or two of reading, one answer per line. Questions go to{" "}
              {EMAIL_LABEL}, subject PremiumFlag.
            </p>
            <div className="cta-row">
              <a href="#review" className="button button-primary">
                Review a bill
              </a>
              <a href={`${EMAIL}?subject=PremiumFlag`} className="button button-secondary">
                Email a question
              </a>
              <Link to="/" className="button button-secondary">
                Back to all tools
              </Link>
            </div>
            <p className="cta-fine">
              PremiumFlag does not talk to the carrier and does not sell a policy. Charges appear as
              FRAMEWORK SYSTEMS.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
