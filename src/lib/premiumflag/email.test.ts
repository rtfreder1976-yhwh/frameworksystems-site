import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { composeEmail } from "./email.ts";
import { evaluate } from "./rules.ts";
import type { Analysis } from "./types.ts";
import { FILES, align, bill, cert, line, row, summary } from "./test-fixtures.ts";

function scenario(): Analysis {
  const b = bill({
    balance_due: 10000,
    lines: [
      line({
        id: "L1",
        description: "5183 Plumbing NOC - AL",
        class_code: "5183",
        audited_amount: 240000,
        estimated_amount: 150000,
        premium: 5500,
      }),
      line({
        id: "L2",
        description: "Uninsured subcontractor - J Smith Roofing",
        category: "subcontractor",
        basis: "subcontract_cost",
        entity_name: "J Smith Roofing",
        audited_amount: 30000,
        premium: 4500,
      }),
    ],
  });
  const s = summary([
    row({ id: "R1", name_or_role: "Plumbers", class_code: "5183", straight_time_wages: 240000 }),
  ]);
  const c = cert({
    id: "C1-1",
    insured_name: "John Smith Roofing LLC",
    insurer: "Builders Mutual",
    wc_policy_number: "WC 998877",
    wc_effective: "2024-11-01",
    wc_expiration: "2026-11-01",
  });
  const e = evaluate({
    bill: b,
    summary: s,
    certificates: [c],
    alignment: align({ L1: { rows: ["R1"] }, L2: { certs: ["C1-1"] } }),
    files: FILES,
  });
  return { id: "pf_0123456789abcdef0123", version: 1, createdAt: "2026-10-24T00:00:00.000Z", ...e };
}

describe("composeEmail", () => {
  const a = scenario();
  const { subject, body } = composeEmail(a);

  it("names the policy and the audit period", () => {
    assert.match(subject, /WC-4471/);
    assert.match(subject, /01\/01\/2025 to 12\/31\/2025/);
    assert.match(body, /Policy WC-4471/);
  });
  it("lists only the flagged lines, with both figures, the reason, and the proof", () => {
    assert.equal(a.flaggedCount, 1);
    assert.match(body, /1\. Uninsured subcontractor - J Smith Roofing/);
    assert.doesNotMatch(body, /5183 Plumbing NOC/);
    assert.match(body, /Your figure: \$30,000\.00 of subcontract cost \(\$4,500\.00 premium\)/);
    assert.match(body, /Our figure: \$0\.00 of subcontract cost/);
    assert.match(body, /Reason: J Smith Roofing carried workers comp/);
    assert.match(body, /Proof: Certificate of insurance for John Smith Roofing LLC/);
    assert.match(body, /attached: certs\.pdf/);
  });
  it("asks for a revised audit in writing and says the rest will be paid", () => {
    assert.match(body, /revised audit in writing/);
    assert.match(body, /not in dispute, and I will pay it \(\$5,500\.00\)/);
    assert.match(body, /Shoals Plumbing LLC\s*$/);
  });
  it("never claims the bill is on hold or promises an outcome", () => {
    assert.doesNotMatch(body, /on hold/i);
    assert.doesNotMatch(body, /withhold/i);
    assert.doesNotMatch(body, /guarantee|will reduce|must reduce/i);
  });
  it("leaves blanks when the bill did not give a policy number", () => {
    const { subject: s2, body: b2 } = composeEmail({ ...a, policyNumber: null, insuredName: null });
    assert.match(s2, /\[policy number\]/);
    assert.match(b2, /\[your name and company\]\s*$/);
  });
});
