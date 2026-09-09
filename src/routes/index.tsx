import { createFileRoute, Link } from "@tanstack/react-router";
import { BOOKING } from "@/lib/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Framework Systems | Operator tools, not a bundle" },
      {
        name: "description",
        content:
          "Three separate tools. Cleaning walkthroughs. 3PL invoices. Phones, follow-up, and reviews for any service shop. Use the one that matches the work.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-single">
          <span className="eyebrow">Framework Systems · Tuscumbia, Alabama</span>
          <h1>We build the systems that run your business.</h1>
          <p className="lead">
            Not a bundle. Not an agency. Three separate tools for three different jobs. Cleaning
            companies use the walkthrough photos. Brands that ship use the invoice. Any shop that
            lives on the phone uses the platform. Buy the one that matches the work. Skip the rest.
          </p>
          <div className="cta-row">
            <a href={BOOKING} className="button button-primary">
              Book a walkthrough
            </a>
            <a href="#doors" className="button button-secondary">
              See the three doors
            </a>
          </div>
        </div>
      </section>

      <section className="section" id="doors">
        <div className="container">
          <div className="section-header">
            <span className="section-label">Pick the work</span>
            <h2 className="section-title">Nothing here requires you to buy the other two.</h2>
          </div>
          <div className="grid-3">
            <article className="card">
              <span className="card-tag">Cleaning companies</span>
              <h3 className="card-title">Walkthrough photos</h3>
              <p>
                Standing water that can cup hardwood. Product left on stone. A bathroom that never
                got restocked. The photos already show it. CrewFlag reads them before the client
                walks back in.
              </p>
              <p>
                <strong>Also:</strong> the weekly account that has started calling back, and the job
                you could not get into.
              </p>
              <Link to="/cleaning" className="button button-primary">
                Cleaning tools
              </Link>
            </article>
            <article className="card">
              <span className="card-tag">Brands that ship</span>
              <h3 className="card-title">The 3PL invoice</h3>
              <p>
                Most fulfillment bills get paid on the total. InvoiceFlag reads the lines: duplicate
                tracking, fees that were never on the contract, DIM and DAS on the same shipment,
                pick counts that do not match the backup.
              </p>
              <p>
                <strong>First audit is free.</strong> Then $19, or $49/mo. No store login.
              </p>
              <Link to="/shipping" className="button button-primary">
                Shipping tools
              </Link>
            </article>
            <article className="card">
              <span className="card-tag">Any service shop</span>
              <h3 className="card-title">Phones, follow-up, reviews</h3>
              <p>
                Missed-call text-back. An after-hours secretary. Invoice reminders. Google review
                requests. White-label: your name, your number, your Google listing. Not ours in the
                customer’s phone.
              </p>
              <p>
                <strong>Industry-agnostic.</strong> If the business lives on the phone, this is the
                door.
              </p>
              <Link to="/platform" className="button button-primary">
                The shop platform
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container compare-grid">
          <div className="panel">
            <span className="panel-label">What this is</span>
            <h2>Operator tools. One job each.</h2>
            <ul className="detail-list">
              <li>The photos, the invoice, or the phone. Not a new scheduling app.</li>
              <li>White-label on the shop platform. The customer never sees Framework.</li>
              <li>Built next to a real cleaning company in North Alabama. Veteran-owned.</li>
            </ul>
          </div>
          <div className="panel">
            <span className="panel-label">What this is not</span>
            <h2>Not a plumbing company. Not a bundle.</h2>
            <ul className="detail-list">
              <li>We do not ask a cleaning company to care about 3PL invoices.</li>
              <li>We do not ask a Shopify brand to buy a phone system.</li>
              <li>We do not replace Jobber, Housecall Pro, ShipBob, or your CRM.</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
