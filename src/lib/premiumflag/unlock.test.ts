import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "./rules.ts";
import { signAnalysis } from "./sign.server.ts";
import { unlock } from "./unlock.server.ts";
import { AnalysisSchema } from "./types.ts";
import type { Analysis } from "./types.ts";
import { FILES, align, bill, cert, line, summary } from "./test-fixtures.ts";

process.env.PREMIUMFLAG_SIGNING_SECRET = "test-signing-secret";
process.env.STRIPE_SECRET_KEY = "rk_test_premiumflag";

const SESSION = "cs_test_a1b2c3d4e5f6g7h8";
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Stripe answers the Checkout Session read with a paid $249 session, unless told otherwise. */
function stripeSession(over: Record<string, unknown>) {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        status: "complete",
        payment_status: "paid",
        amount_total: 24900,
        currency: "usd",
        livemode: false,
        ...over,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
}

function analysis(flagged = true): Analysis {
  const b = bill({
    balance_due: 10000,
    lines: [
      line({
        id: "L1",
        description: "Uninsured subcontractor - J Smith Roofing",
        category: "subcontractor",
        basis: "subcontract_cost",
        entity_name: "J Smith Roofing",
        audited_amount: 30000,
        premium: 4500,
      }),
    ],
  });
  const certs = flagged
    ? [
        cert({
          id: "C1-1",
          insured_name: "John Smith Roofing LLC",
          wc_policy_number: "WC 998877",
          wc_effective: "2024-11-01",
          wc_expiration: "2026-11-01",
        }),
      ]
    : [];
  const e = evaluate({
    bill: b,
    summary: summary([]),
    certificates: certs,
    alignment: align({ L1: { certs: certs.map((c) => c.id) } }),
    files: FILES,
  });
  return {
    id: "pf_0123456789abcdef0123",
    version: 1,
    createdAt: "2026-10-24T00:00:00.000Z",
    ...e,
  };
}

/** What the browser hands back: the analysis after JSON storage, validated again on the server. */
const roundTrip = (a: Analysis): Analysis => AnalysisSchema.parse(JSON.parse(JSON.stringify(a)));

describe("unlock", () => {
  it("returns the email for a paid $249 checkout made for this bill", async () => {
    const a = analysis();
    stripeSession({ client_reference_id: a.id });
    const r = await unlock({ sessionId: SESSION, analysis: roundTrip(a), sig: signAnalysis(a) });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.match(r.subject, /WC-4471/);
      assert.match(r.body, /J Smith Roofing/);
      assert.match(r.body, /WC 998877/);
    }
  });

  it("refuses a cheaper Payment Link that carries this bill's reference", async () => {
    const a = analysis();
    stripeSession({ client_reference_id: a.id, amount_total: 1900 });
    const r = await unlock({ sessionId: SESSION, analysis: roundTrip(a), sig: signAnalysis(a) });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /not for a PremiumFlag email/);
  });

  it("refuses a payment made for a different bill", async () => {
    const a = analysis();
    stripeSession({ client_reference_id: "pf_ffffffffffffffffffff" });
    const r = await unlock({ sessionId: SESSION, analysis: roundTrip(a), sig: signAnalysis(a) });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /different bill/);
  });

  it("refuses a checkout that is not paid", async () => {
    const a = analysis();
    stripeSession({ client_reference_id: a.id, status: "open", payment_status: "unpaid" });
    const r = await unlock({ sessionId: SESSION, analysis: roundTrip(a), sig: signAnalysis(a) });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /not paid/);
  });

  it("refuses a result that was edited after it was signed", async () => {
    const a = analysis();
    stripeSession({ client_reference_id: a.id });
    const edited = { ...roundTrip(a), disputedPremium: 1 };
    const r = await unlock({ sessionId: SESSION, analysis: edited, sig: signAnalysis(a) });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /could not be verified/);
  });

  it("has nothing to unlock when every line is Pay", async () => {
    const a = analysis(false);
    assert.equal(a.allPay, true);
    stripeSession({ client_reference_id: a.id });
    const r = await unlock({ sessionId: SESSION, analysis: roundTrip(a), sig: signAnalysis(a) });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /no email to unlock/);
  });
});
