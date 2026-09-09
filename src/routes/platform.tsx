import { createFileRoute, Link } from "@tanstack/react-router";
import { BOOKING, EMAIL } from "@/lib/site";

export const Route = createFileRoute("/platform")({
  head: () => ({
    meta: [
      { title: "The shop platform | Missed calls, secretary, invoices, reviews" },
      {
        name: "description",
        content:
          "White-label operator platform: missed-call text-back, after-hours secretary, invoice follow-up, and Google review requests. Your name. Your number. Any service shop.",
      },
    ],
  }),
  component: Platform,
});

function Platform() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <span className="eyebrow">The shop platform · white-label</span>
            <h1>The crew is on a job. The phone still rings.</h1>
            <p className="lead">
              Missed-call text-back. An after-hours secretary. Invoice reminders. Google review
              requests. It runs under your name and your number. The customer never sees Framework.
              This is not the cleaning photo tool and not the 3PL auditor.
            </p>
            <div className="cta-row">
              <a href={BOOKING} className="button button-primary">
                Book a walkthrough
              </a>
              <a href={`${EMAIL}?subject=Shop%20platform`} className="button button-secondary">
                Email the shop
              </a>
            </div>
          </div>
          <aside className="hero-panel">
            <span className="panel-label">White-label</span>
            <h2>Your shop. Your number. Your Google listing.</h2>
            <p>
              Texts come from you. The review request points at your Business Profile. Unhappy
              customers go to you first, not a public one-star.
            </p>
          </aside>
        </div>
      </section>

      <section className="section" id="tools">
        <div className="container">
          <div className="section-header">
            <span className="section-label">What it actually does</span>
            <h2 className="section-title">Four jobs. Same platform. Any trade that lives on the phone.</h2>
          </div>
          <div className="grid-2">
            <article className="card">
              <span className="card-tag">Missed call</span>
              <h3 className="card-title">Text-back when nobody picks up</h3>
              <p>
                The call hits voicemail while someone is under a sink or in a client’s house. The
                caller gets a text in about a minute: we missed you, here’s how to tell us what you
                need. It lands in a real follow-up, not a notepad on the van.
              </p>
            </article>
            <article className="card">
              <span className="card-tag">After hours</span>
              <h3 className="card-title">Secretary on the line</h3>
              <p>
                Evenings and overflow. A voice answers, takes the reason for the call, and puts it
                on the calendar if there is a slot. It is not a phone tree and it is not a
                replacement for a licensed tech on a true emergency — it keeps the job from going to
                the next shop in the list.
              </p>
            </article>
            <article className="card">
              <span className="card-tag">Receivables</span>
              <h3 className="card-title">Invoice follow-up</h3>
              <p>
                The invoice went out. They have not paid. A short, polite sequence follows up so
                you do not have to remember who is 14 days out. This is reminders, not collections
                theater.
              </p>
            </article>
            <article className="card">
              <span className="card-tag">Reputation</span>
              <h3 className="card-title">Google review requests</h3>
              <p>
                After a completed job, one text. Happy customers go to your Google listing. Anyone
                who is not happy goes to you first. You already did the work. This is how it gets
                on the map.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container compare-grid">
          <div className="panel">
            <span className="panel-label">Fit</span>
            <h2>This is for a shop that already has demand.</h2>
            <ul className="detail-list">
              <li>Cleaning, HVAC, plumbing, electrical, roofing, clinics — if the phone is the front door.</li>
              <li>You lose jobs between the ring and the calendar, or reviews never get asked for.</li>
              <li>You want your name on the texts, not a vendor’s.</li>
            </ul>
          </div>
          <div className="panel">
            <span className="panel-label">Not a fit</span>
            <h2>This is not a marketing agency and not a new CRM to live in.</h2>
            <ul className="detail-list">
              <li>You want ads, branding, or a redesigned website. That is not this.</li>
              <li>You have no inbound calls and no invoices to follow.</li>
              <li>You want us to sit in the office and answer the phone ourselves.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <span className="section-label">How it goes in</span>
            <h2 className="section-title">Sandbox first. Live when it is boring.</h2>
          </div>
          <div className="grid-4">
            <article className="card">
              <span className="card-tag">01</span>
              <h3 className="card-title">Audit</h3>
              <p>How calls, invoices, and reviews work today. We pick the first leak, not all four at once.</p>
            </article>
            <article className="card">
              <span className="card-tag">02</span>
              <h3 className="card-title">Build</h3>
              <p>Your number, your scripts, your Google listing. Built off to the side, not in the live account on day one.</p>
            </article>
            <article className="card">
              <span className="card-tag">03</span>
              <h3 className="card-title">Test</h3>
              <p>We call it. We miss a call on purpose. We send a test invoice. Then it goes live.</p>
            </article>
            <article className="card">
              <span className="card-tag">04</span>
              <h3 className="card-title">Watch</h3>
              <p>You can see what was missed, what was recovered, and what still needs a person.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="cta-band">
            <span className="section-label">Primary next step</span>
            <h2 className="cta-title">Walk the current phone path with us.</h2>
            <p className="cta-copy">
              Thirty minutes. Bring how you take calls today. We will tell you which of the four
              jobs is worth turning on first.
            </p>
            <div className="cta-row">
              <a href={BOOKING} className="button button-primary">
                Book a walkthrough
              </a>
              <Link to="/cleaning" className="button button-secondary">
                Cleaning company? Photos are a different door.
              </Link>
            </div>
            <p className="cta-fine">Framework Systems · Tuscumbia, Alabama · todd@frameworksystems.co</p>
          </div>
        </div>
      </section>
    </>
  );
}
