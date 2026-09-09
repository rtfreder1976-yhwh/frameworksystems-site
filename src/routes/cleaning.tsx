import { createFileRoute, Link } from "@tanstack/react-router";
import { APP, BOOKING, EMAIL, STRIPE } from "@/lib/site";

export const Route = createFileRoute("/cleaning")({
  head: () => ({
    meta: [
      { title: "CrewFlag | Walkthrough photos for cleaning companies" },
      {
        name: "description",
        content:
          "CrewFlag reads post-job photos for standing water, leftover product, and unfinished rooms. Recurring quality and lockouts are separate tools. First job free.",
      },
    ],
  }),
  component: Cleaning,
});

export function Cleaning() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <span className="eyebrow">CrewFlag · for cleaning companies</span>
            <h1>Standing water. Leftover product. A room that never got done.</h1>
            <p className="lead">
              The walkthrough photos already show it. CrewFlag reads them before the client walks
              back in. Separate tools for the weekly account that has started calling back, and for
              the job you could not get into. Use one, two, or all three.
            </p>
            <div className="cta-row">
              <a href={APP.qc} className="button button-primary">
                Open the photo tool
              </a>
              <a href="#pricing" className="button button-secondary">
                See pricing
              </a>
            </div>
          </div>
          <aside className="hero-panel">
            <span className="panel-label">What the photos catch</span>
            <h2>The things that become callbacks.</h2>
            <ul className="metric-list">
              <li>
                <strong>Floors:</strong> standing water on hardwood, mop water left in grout, damp
                rugs.
              </li>
              <li>
                <strong>Surfaces:</strong> chemical left on stone or quartz, product bottles sitting
                out.
              </li>
              <li>
                <strong>Rooms:</strong> a bathroom that was not restocked, hair in the drain, trash
                still in the can.
              </li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="section" id="tools">
        <div className="container">
          <div className="section-header">
            <span className="section-label">Three tools. Not one package you have to swallow.</span>
            <h2 className="section-title">Buy the job that is actually hurting.</h2>
          </div>
          <div className="grid-3">
            <article className="card">
              <span className="card-tag">01 · Photos</span>
              <h3 className="card-title">Post-job walkthrough</h3>
              <p>
                Required shots against the checklist for that home: recurring clean, move-out,
                Airbnb turn, or inspection. Flags wet floors, leftover supplies, unfinished rooms.
              </p>
              <p>
                <strong>Skip it</strong> if the crew never takes walkthrough photos.
              </p>
              <a href={APP.qc} className="button button-secondary dark">
                Open photo QC
              </a>
            </article>
            <article className="card">
              <span className="card-tag">02 · Recurring accounts</span>
              <h3 className="card-title">Quality over six weeks</h3>
              <p>
                The same weekly that used to be easy. Notes, stars, or photo scores that have been
                sliding. You want that on your desk before they cancel, not in a one-star review.
              </p>
              <p>
                <strong>Skip it</strong> if every job is a one-time move-out.
              </p>
              <a href={APP.drift} className="button button-secondary dark">
                Open quality watch
              </a>
            </article>
            <article className="card">
              <span className="card-tag">03 · Lockouts</span>
              <h3 className="card-title">Could not get in</h3>
              <p>
                No key. Dog loose. Tenant not home. The playbook: text the customer, wait the
                window, reschedule, log a trip you can bill, tell the office.
              </p>
              <p>
                <strong>Skip it</strong> if the client is always home and the crew always gets in.
              </p>
              <a href={APP.access} className="button button-secondary dark">
                Open lockout playbook
              </a>
            </article>
          </div>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="container">
          <div className="section-header">
            <span className="section-label">Pricing</span>
            <h2 className="section-title">First job is free. Then buy the tool you will actually use.</h2>
          </div>
          <div className="package-grid">
            <article className="pricing-card featured">
              <span className="pricing-meta">First job</span>
              <h3 className="pricing-title">Free</h3>
              <p className="pricing-copy">
                Send last week’s walkthrough set, a handful of ratings, or the last lockout. We run
                one job type and send the texts back.
              </p>
              <p style={{ marginTop: 16 }}>
                <a href={`${EMAIL}?subject=CrewFlag`} className="button button-primary">
                  Email for the first job
                </a>
              </p>
            </article>
            <article className="pricing-card">
              <span className="pricing-meta">Photo walkthrough</span>
              <h3 className="pricing-title">$19 / $29</h3>
              <p className="pricing-copy">One job, then monthly if the crew shoots every time.</p>
              <p style={{ marginTop: 16 }}>
                <a href={STRIPE.qcOnce} className="button button-primary" target="_blank" rel="noreferrer">
                  Pay $19
                </a>
              </p>
              <p style={{ marginTop: 10 }}>
                <a href={STRIPE.qcMonthly} className="button button-secondary dark" target="_blank" rel="noreferrer">
                  $29/mo
                </a>
              </p>
            </article>
            <article className="pricing-card">
              <span className="pricing-meta">Quality watch</span>
              <h3 className="pricing-title">$19 / $29</h3>
              <p className="pricing-copy">One client file, then monthly for the weeklies.</p>
              <p style={{ marginTop: 16 }}>
                <a href={STRIPE.driftOnce} className="button button-primary" target="_blank" rel="noreferrer">
                  Pay $19
                </a>
              </p>
              <p style={{ marginTop: 10 }}>
                <a href={STRIPE.driftMonthly} className="button button-secondary dark" target="_blank" rel="noreferrer">
                  $29/mo
                </a>
              </p>
            </article>
            <article className="pricing-card">
              <span className="pricing-meta">Lockouts</span>
              <h3 className="pricing-title">$19 / $29</h3>
              <p className="pricing-copy">One lockout, then monthly if it keeps happening.</p>
              <p style={{ marginTop: 16 }}>
                <a href={STRIPE.accessOnce} className="button button-primary" target="_blank" rel="noreferrer">
                  Pay $19
                </a>
              </p>
              <p style={{ marginTop: 10 }}>
                <a href={STRIPE.accessMonthly} className="button button-secondary dark" target="_blank" rel="noreferrer">
                  $29/mo
                </a>
              </p>
            </article>
            <article className="pricing-card featured">
              <span className="pricing-meta">All three</span>
              <h3 className="pricing-title">$39 / $49</h3>
              <p className="pricing-copy">Only if you actually need all three. $39 once vs $57. $49/mo vs $87.</p>
              <p style={{ marginTop: 16 }}>
                <a href={STRIPE.packOnce} className="button button-primary" target="_blank" rel="noreferrer">
                  Pay $39
                </a>
              </p>
              <p style={{ marginTop: 10 }}>
                <a href={STRIPE.packMonthly} className="button button-secondary dark" target="_blank" rel="noreferrer">
                  $49/mo pack
                </a>
              </p>
            </article>
          </div>
          <div className="notice" style={{ marginTop: 24 }}>
            <p>
              Charges on the card: <strong>FRAMEWORK SYSTEMS</strong>. First job is email. Do not
              pay until you have seen it on your work.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container compare-grid">
          <div className="panel">
            <span className="panel-label">Fit</span>
            <h2>This is for a cleaning company that already has a schedule.</h2>
            <ul className="detail-list">
              <li>Residential, move-outs, Airbnb turns, property walks.</li>
              <li>You already use Jobber, Housecall Pro, ServiceTitan, a calendar, or text.</li>
              <li>You do not have to buy all three tools.</li>
            </ul>
          </div>
          <div className="panel">
            <span className="panel-label">Not a fit</span>
            <h2>This is not a new scheduling app.</h2>
            <ul className="detail-list">
              <li>We do not log into Jobber and run the company.</li>
              <li>We do not replace the calendar.</li>
              <li>If there are no photos, no ratings, and no lockout, there is nothing to run.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="cta-band">
            <span className="section-label">Primary next step</span>
            <h2 className="cta-title">Send last week’s walkthrough set.</h2>
            <p className="cta-copy">
              Email todd@frameworksystems.co. Subject: CrewFlag. Photos, a handful of ratings, or
              the last lockout. We run one job type and send the texts back.
            </p>
            <div className="cta-row">
              <a href={`${EMAIL}?subject=CrewFlag`} className="button button-primary">
                Email the first job
              </a>
              <Link to="/platform" className="button button-secondary">
                Need the phones instead?
              </Link>
            </div>
            <p className="cta-fine">
              CrewFlag does not connect to your schedule. Charges appear as FRAMEWORK SYSTEMS.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
