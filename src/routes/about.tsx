import { createFileRoute, Link } from "@tanstack/react-router";
import { BOOKING, EMAIL } from "@/lib/site";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Framework Systems" },
      {
        name: "description",
        content:
          "Framework Systems builds operator tools from a real service business in Tuscumbia, Alabama. Veteran-owned. Faith-driven. Not an agency.",
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <span className="eyebrow">About Framework</span>
            <h1>Built next to a real shop. Not a slide deck.</h1>
            <p className="lead">
              Todd and Christen Frederickson started The Valley Clean Team in 2022. The systems that
              kept that company moving — phones, follow-up, photos, the boring parts — are what
              Framework sells. Other owners asked for the same thing. That is the whole origin.
            </p>
            <div className="cta-row">
              <a href={BOOKING} className="button button-primary">
                Book a walkthrough
              </a>
              <a href={EMAIL} className="button button-secondary">
                Email Todd
              </a>
            </div>
          </div>
          <aside className="hero-panel">
            <span className="panel-label">How we work</span>
            <h2>Veteran-owned. Faith-driven. Tuscumbia, Alabama.</h2>
            <p>
              We do not pretend a cleaning company, a Shopify brand, and a service shop are the
              same customer. Each tool has its own door.
            </p>
          </aside>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-label">The three doors</span>
            <h2 className="section-title">Keep them straight.</h2>
          </div>
          <div className="grid-3">
            <article className="card">
              <h3 className="card-title">The shop platform</h3>
              <p>Phones, secretary, invoice follow-up, reviews. White-label. Any trade that lives on the phone.</p>
              <Link to="/platform" className="button button-secondary dark">
                The shop
              </Link>
            </article>
            <article className="card">
              <h3 className="card-title">CrewFlag</h3>
              <p>Walkthrough photos, recurring quality, lockouts. For cleaning companies. Not a phone system.</p>
              <Link to="/cleaning" className="button button-secondary dark">
                Cleaning
              </Link>
            </article>
            <article className="card">
              <h3 className="card-title">InvoiceFlag</h3>
              <p>3PL and parcel invoices. For brands that ship. Not a cleaning tool.</p>
              <Link to="/shipping" className="button button-secondary dark">
                Shipping
              </Link>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
