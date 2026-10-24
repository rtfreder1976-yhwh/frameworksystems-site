import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluate, summaryPeriodProblem } from "./rules.ts";
import { autoAlign } from "./match.ts";
import { FILES, align, bill, cert, line, row, summary } from "./test-fixtures.ts";

const subLine = () =>
  line({
    id: "L1",
    description: "Uninsured subcontractor - J Smith Roofing",
    category: "subcontractor",
    basis: "subcontract_cost",
    entity_name: "J Smith Roofing",
    audited_amount: 30000,
    rate: 15,
    rate_basis: "per_100",
    premium: 4500,
  });

const wcCert = (over: Parameters<typeof cert>[0] | object = {}) =>
  cert({
    id: "C1-1",
    insured_name: "John Smith Roofing LLC",
    wc_policy_number: "WC 998877",
    wc_effective: "2024-11-01",
    wc_expiration: "2026-11-01",
    ...over,
  });

describe("evaluate: what stays Pay", () => {
  it("a bill that only grew comes back all Pay at $0", () => {
    const b = bill({
      lines: [
        line({
          id: "L1",
          description: "5183 Plumbing NOC - AL",
          class_code: "5183",
          state: "AL",
          audited_amount: 240000,
          estimated_amount: 150000,
          rate: 6.1,
          rate_basis: "per_100",
          premium: 14640,
        }),
      ],
      balance_due: 5490,
    });
    const s = summary([
      row({
        id: "R1",
        name_or_role: "Plumbers",
        class_code: "5183",
        state: "AL",
        straight_time_wages: 240000,
        total_wages: 240000,
      }),
    ]);
    const e = evaluate({
      bill: b,
      summary: s,
      certificates: [],
      alignment: autoAlign(b, s.rows, []),
      files: FILES,
    });
    assert.equal(e.allPay, true);
    assert.equal(e.flaggedCount, 0);
    assert.equal(e.disputedExposure, 0);
    assert.equal(e.disputedPremium, null);
    assert.match(e.lines[0]!.reason, /Matches the payroll summary/);
  });

  it("growth over the estimate with no rows is the true-up, not a flag", () => {
    const b = bill({
      lines: [
        line({
          id: "L1",
          description: "5183",
          class_code: "5183",
          audited_amount: 150000,
          estimated_amount: 100000,
        }),
      ],
    });
    const e = evaluate({
      bill: b,
      summary: summary([]),
      certificates: [],
      alignment: align({}),
      files: FILES,
    });
    assert.equal(e.lines[0]!.label, "pay");
    assert.match(e.lines[0]!.reason, /true-up/);
  });

  it("a sub with no certificate in the upload stays Pay", () => {
    const e = evaluate({
      bill: bill({ lines: [subLine()] }),
      summary: summary([]),
      certificates: [],
      alignment: align({}),
      files: FILES,
    });
    assert.equal(e.lines[0]!.label, "pay");
    assert.match(e.lines[0]!.reason, /No certificate in the upload/);
  });

  it("a certificate that ended before the period does not flag", () => {
    const c = wcCert({ wc_effective: "2023-01-01", wc_expiration: "2024-01-01" });
    const e = evaluate({
      bill: bill({ lines: [subLine()] }),
      summary: summary([]),
      certificates: [c],
      alignment: align({ L1: { certs: ["C1-1"] } }),
      files: FILES,
    });
    assert.equal(e.lines[0]!.label, "pay");
    assert.match(e.lines[0]!.reason, /does not cover the audit period/);
  });

  it("a workers comp policy ignores a certificate that only carries general liability", () => {
    const c = cert({
      id: "C1-1",
      insured_name: "John Smith Roofing LLC",
      gl_policy_number: "GL 1",
      gl_effective: "2025-01-01",
      gl_expiration: "2026-01-01",
      gl_each_occurrence: 1000000,
    });
    const e = evaluate({
      bill: bill({ lines: [subLine()] }),
      summary: summary([]),
      certificates: [c],
      alignment: align({ L1: { certs: ["C1-1"] } }),
      files: FILES,
    });
    assert.equal(e.lines[0]!.label, "pay");
  });

  it("no audit period means certificates cannot flag, and a warning says so", () => {
    const c = wcCert({ wc_effective: "2024-01-01", wc_expiration: "2027-01-01" });
    const e = evaluate({
      bill: bill({ lines: [subLine()], audit_period_start: null, audit_period_end: null }),
      summary: summary([]),
      certificates: [c],
      alignment: align({ L1: { certs: ["C1-1"] } }),
      files: FILES,
    });
    assert.equal(e.lines[0]!.label, "pay");
    assert.match(e.warnings.join(" "), /audit period could not be read/);
  });

  it("a GL certificate below the required limits is not a flag", () => {
    const b = bill({
      policy_type: "general_liability",
      required_gl_each_occurrence: 1000000,
      lines: [subLine()],
    });
    const c = cert({
      id: "C1-1",
      insured_name: "John Smith Roofing LLC",
      gl_policy_number: "GL 1",
      gl_effective: "2025-01-01",
      gl_expiration: "2026-01-01",
      gl_each_occurrence: 500000,
    });
    const e = evaluate({
      bill: b,
      summary: summary([]),
      certificates: [c],
      alignment: align({ L1: { certs: ["C1-1"] } }),
      files: FILES,
    });
    assert.equal(e.lines[0]!.label, "pay");
    assert.match(e.lines[0]!.reason, /below what the audit requires/);
  });

  it("a GL certificate whose limit can't be read does not meet a stated requirement", () => {
    const b = bill({
      policy_type: "general_liability",
      required_gl_each_occurrence: 1000000,
      lines: [subLine()],
    });
    const c = cert({
      id: "C1-1",
      insured_name: "John Smith Roofing LLC",
      gl_policy_number: "GL 1",
      gl_effective: "2025-01-01",
      gl_expiration: "2026-01-01",
      gl_each_occurrence: null,
    });
    const e = evaluate({
      bill: b,
      summary: summary([]),
      certificates: [c],
      alignment: align({ L1: { certs: ["C1-1"] } }),
      files: FILES,
    });
    assert.equal(e.lines[0]!.label, "pay");
    assert.match(e.lines[0]!.reason, /could not be read/);
  });

  it("an audit that does not say WC or GL applies no certificate, and says so", () => {
    const e = evaluate({
      bill: bill({ policy_type: "unknown", lines: [subLine()] }),
      summary: summary([]),
      certificates: [wcCert()],
      alignment: align({ L1: { certs: ["C1-1"] } }),
      files: FILES,
    });
    assert.equal(e.lines[0]!.label, "pay");
    assert.match(e.lines[0]!.reason, /does not say whether/);
    assert.match(e.warnings.join(" "), /does not say whether/);
  });

  it("a combined audit does not flag a sub insured on only one of the two policies", () => {
    const e = evaluate({
      bill: bill({ policy_type: "both", lines: [subLine()] }),
      summary: summary([]),
      certificates: [wcCert()],
      alignment: align({ L1: { certs: ["C1-1"] } }),
      files: FILES,
    });
    assert.equal(e.lines[0]!.label, "pay");
    assert.match(e.lines[0]!.reason, /combined audit/);
  });

  it("a correct audit on a large payroll is not read as keeping the overtime premium", () => {
    const b = bill({
      lines: [line({ id: "L1", description: "5183", class_code: "5183", audited_amount: 1020000 })],
    });
    const s = summary([
      row({
        id: "R1",
        name_or_role: "Plumbers",
        class_code: "5183",
        straight_time_wages: 1000000,
        overtime_wages: 30000,
        overtime_premium: 10000,
      }),
    ]);
    const e = evaluate({
      bill: b,
      summary: s,
      certificates: [],
      alignment: autoAlign(b, s.rows, []),
      files: FILES,
    });
    assert.equal(e.lines[0]!.label, "pay");
  });

  it("a move into a cheaper class code, or one the bill does not rate, stays Pay", () => {
    const s = summary([
      row({ id: "R1", name_or_role: "Doe, Jane", class_code: "5183", straight_time_wages: 40000 }),
    ]);
    const cheaper = bill({
      lines: [
        line({
          id: "L1",
          description: "Jane Doe",
          class_code: "8810",
          entity_name: "Jane Doe",
          audited_amount: 40000,
          rate: 0.45,
          rate_basis: "per_100",
        }),
        line({
          id: "L2",
          description: "5183 Plumbing",
          class_code: "5183",
          audited_amount: 200000,
          rate: 6.1,
          rate_basis: "per_100",
        }),
      ],
    });
    const unrated = bill({
      lines: [
        line({
          id: "L1",
          description: "Jane Doe",
          class_code: "8810",
          entity_name: "Jane Doe",
          audited_amount: 40000,
          rate: 0.45,
          rate_basis: "per_100",
        }),
      ],
    });
    for (const b of [cheaper, unrated]) {
      const e = evaluate({
        bill: b,
        summary: s,
        certificates: [],
        alignment: align({ L1: { rows: ["R1"] } }),
        files: FILES,
      });
      assert.equal(e.lines[0]!.label, "pay");
      assert.match(e.lines[0]!.reason, /does not show that 8810 costs more/);
    }
  });
});

describe("evaluate: a certificate needs its policy number", () => {
  it("a workers comp certificate with dates but no policy number cannot clear a sub", () => {
    const e = evaluate({
      bill: bill({ lines: [subLine()] }),
      summary: summary([]),
      certificates: [wcCert({ wc_policy_number: null })],
      alignment: align({ L1: { certs: ["C1-1"] } }),
      files: FILES,
    });
    assert.equal(e.lines[0]!.label, "pay");
    assert.match(e.lines[0]!.reason, /no policy number/);
  });

  it("a GL certificate with dates but no policy number cannot clear a sub on a GL audit", () => {
    const c = cert({
      id: "C1-1",
      insured_name: "John Smith Roofing LLC",
      gl_policy_number: "  ",
      gl_effective: "2025-01-01",
      gl_expiration: "2026-01-01",
      gl_each_occurrence: 1000000,
    });
    const e = evaluate({
      bill: bill({ policy_type: "general_liability", lines: [subLine()] }),
      summary: summary([]),
      certificates: [c],
      alignment: align({ L1: { certs: ["C1-1"] } }),
      files: FILES,
    });
    assert.equal(e.lines[0]!.label, "pay");
    assert.match(e.lines[0]!.reason, /no policy number/);
  });
});

describe("summaryPeriodProblem", () => {
  it("stops a summary from another year", () => {
    const m = summaryPeriodProblem(bill(), {
      ...summary([]),
      period_start: "2024-01-01",
      period_end: "2024-12-31",
    });
    assert.match(m ?? "", /covers 01\/01\/2024 to 12\/31\/2024/);
    assert.match(m ?? "", /audits 01\/01\/2025 to 12\/31\/2025/);
  });

  it("stops a summary whose dates overlap the audit period but don't match it", () => {
    const m = summaryPeriodProblem(
      bill({ audit_period_start: "2025-07-01", audit_period_end: "2026-07-01" }),
      summary([]),
    );
    assert.match(m ?? "", /not the same period as the audit/);
  });

  it("lets a summary for the audit period through", () => {
    assert.equal(summaryPeriodProblem(bill(), summary([])), null);
  });

  it("lets a summary with no dates through, and the result says what it assumed", () => {
    const s = { ...summary([]), period_start: null, period_end: null };
    assert.equal(summaryPeriodProblem(bill(), s), null);
    const e = evaluate({
      bill: bill({ lines: [subLine()] }),
      summary: s,
      certificates: [],
      alignment: align({}),
      files: FILES,
    });
    assert.match(e.warnings.join(" "), /does not show its dates/);
  });
});

describe("evaluate: the six flags", () => {
  it("a sub with workers comp in force for the whole period, cited from the certificate", () => {
    const c = wcCert({ insurer: "Builders Mutual" });
    const e = evaluate({
      bill: bill({ lines: [subLine()], balance_due: 10000 }),
      summary: summary([]),
      certificates: [c],
      alignment: align({ L1: { certs: ["C1-1"] } }),
      files: FILES,
    });
    const l = e.lines[0]!;
    assert.equal(l.label, "flag");
    assert.equal(l.rule, "sub_has_wc_cert");
    assert.equal(l.ourAmount, 0);
    assert.equal(l.disputedExposure, 30000);
    assert.equal(l.disputedPremium, 4500);
    assert.equal(l.proof?.file, "certs.pdf");
    assert.match(l.proof!.detail, /John Smith Roofing LLC/);
    assert.match(l.proof!.detail, /WC 998877/);
    assert.equal(e.flaggedCount, 1);
    assert.equal(e.disputedPremium, 4500);
    assert.equal(e.premiumKnownForAllFlags, true);
    assert.equal(e.undisputedPremium, 5500);
  });

  it("a certificate covering part of the period flags as partial with no premium figure", () => {
    const c = wcCert({ wc_effective: "2025-07-01", wc_expiration: "2026-07-01" });
    const e = evaluate({
      bill: bill({ lines: [subLine()] }),
      summary: summary([]),
      certificates: [c],
      alignment: align({ L1: { certs: ["C1-1"] } }),
      files: FILES,
    });
    const l = e.lines[0]!;
    assert.equal(l.label, "flag");
    assert.equal(l.partial, true);
    assert.equal(l.ourAmount, null);
    assert.equal(l.disputedPremium, null);
    assert.equal(l.disputedExposure, 30000);
    assert.equal(e.premiumKnownForAllFlags, false);
    assert.equal(e.undisputedPremium, null);
  });

  it("a GL audit flags sub cost when the certificate meets the required limits", () => {
    const b = bill({
      policy_type: "general_liability",
      required_gl_each_occurrence: 1000000,
      lines: [subLine()],
    });
    const c = cert({
      id: "C1-1",
      insured_name: "John Smith Roofing LLC",
      gl_policy_number: "GL 1",
      gl_effective: "2025-01-01",
      gl_expiration: "2026-01-01",
      gl_each_occurrence: 1000000,
      gl_aggregate: 2000000,
    });
    const e = evaluate({
      bill: b,
      summary: summary([]),
      certificates: [c],
      alignment: align({ L1: { certs: ["C1-1"] } }),
      files: FILES,
    });
    assert.equal(e.lines[0]!.rule, "sub_has_gl_cert");
    assert.match(e.lines[0]!.proof!.detail, /\$1,000,000\.00 each occurrence/);
  });

  it("a combined audit flags a sub insured on both policies, citing both", () => {
    const c = wcCert({
      gl_policy_number: "GL 1",
      gl_effective: "2025-01-01",
      gl_expiration: "2026-01-01",
      gl_each_occurrence: 1000000,
    });
    const e = evaluate({
      bill: bill({ policy_type: "both", lines: [subLine()] }),
      summary: summary([]),
      certificates: [c],
      alignment: align({ L1: { certs: ["C1-1"] } }),
      files: FILES,
    });
    const l = e.lines[0]!;
    assert.equal(l.label, "flag");
    assert.match(l.reason, /workers comp and general liability/);
    assert.match(l.proof!.detail, /WC 998877/);
    assert.match(l.proof!.detail, /GL 1/);
  });

  it("overtime premium inside the class payroll: the extra half comes out", () => {
    const b = bill({
      lines: [
        line({
          id: "L1",
          description: "5183 Plumbing NOC",
          class_code: "5183",
          audited_amount: 110000,
          rate: 6.1,
          rate_basis: "per_100",
        }),
      ],
    });
    const s = summary([
      row({
        id: "R1",
        name_or_role: "Plumbers",
        class_code: "5183",
        straight_time_wages: 100000,
        overtime_wages: 10000,
        overtime_premium: 3333.33,
      }),
    ]);
    const e = evaluate({
      bill: b,
      summary: s,
      certificates: [],
      alignment: autoAlign(b, s.rows, []),
      files: FILES,
    });
    const l = e.lines[0]!;
    assert.equal(l.rule, "overtime_premium_included");
    assert.equal(l.ourAmount, 106666.67);
    assert.equal(l.disputedExposure, 3333.33);
    assert.equal(l.disputedPremium, 203.33);
  });

  it("a worksheet that states overtime premium is included flags even when the totals differ", () => {
    const b = bill({
      lines: [
        line({
          id: "L1",
          description: "5183",
          class_code: "5183",
          audited_amount: 120000,
          includes_overtime_premium: true,
        }),
      ],
    });
    const s = summary([
      row({
        id: "R1",
        name_or_role: "Plumbers",
        class_code: "5183",
        straight_time_wages: 100000,
        overtime_wages: 6000,
        overtime_premium: 2000,
      }),
    ]);
    const e = evaluate({
      bill: b,
      summary: s,
      certificates: [],
      alignment: autoAlign(b, s.rows, []),
      files: FILES,
    });
    assert.equal(e.lines[0]!.rule, "overtime_premium_included");
    assert.equal(e.lines[0]!.ourAmount, 118000);
  });

  it("overtime without the premium split on the summary is not flagged", () => {
    const b = bill({
      lines: [line({ id: "L1", description: "5183", class_code: "5183", audited_amount: 110000 })],
    });
    const s = summary([
      row({
        id: "R1",
        name_or_role: "Plumbers",
        class_code: "5183",
        straight_time_wages: 100000,
        overtime_wages: 10000,
      }),
    ]);
    const e = evaluate({
      bill: b,
      summary: s,
      certificates: [],
      alignment: autoAlign(b, s.rows, []),
      files: FILES,
    });
    assert.equal(e.lines[0]!.label, "pay");
  });

  it("an excluded owner counted as payroll", () => {
    const b = bill({
      lines: [
        line({
          id: "L1",
          description: "Officer - Todd Frederickson",
          category: "owner_officer",
          entity_name: "Todd Frederickson",
          audited_amount: 52000,
          premium: 1200,
        }),
      ],
    });
    const s = summary([
      row({
        id: "R1",
        name_or_role: "Todd Frederickson",
        is_owner_officer: true,
        excluded: true,
        straight_time_wages: 52000,
      }),
    ]);
    const e = evaluate({
      bill: b,
      summary: s,
      certificates: [],
      alignment: align({ L1: { rows: ["R1"] } }),
      files: FILES,
    });
    assert.equal(e.lines[0]!.rule, "owner_excluded");
    assert.equal(e.lines[0]!.ourAmount, 0);
    assert.equal(e.lines[0]!.disputedPremium, 1200);
    assert.equal(e.lines[0]!.proof?.file, FILES.summary);
  });

  it("an officer counted above the cap the document states", () => {
    const b = bill({
      owner_officer_cap: 62400,
      lines: [
        line({
          id: "L1",
          description: "Officer - Todd Frederickson",
          category: "owner_officer",
          entity_name: "Todd Frederickson",
          audited_amount: 90000,
        }),
      ],
    });
    const s = summary([
      row({
        id: "R1",
        name_or_role: "Todd Frederickson",
        is_owner_officer: true,
        straight_time_wages: 90000,
      }),
    ]);
    const e = evaluate({
      bill: b,
      summary: s,
      certificates: [],
      alignment: align({ L1: { rows: ["R1"] } }),
      files: FILES,
    });
    assert.equal(e.lines[0]!.rule, "owner_over_cap");
    assert.equal(e.lines[0]!.ourAmount, 62400);
    assert.equal(e.lines[0]!.disputedExposure, 27600);
    assert.equal(e.lines[0]!.proof?.file, FILES.bill);
  });

  it("a named person moved into a more expensive class code than the summary carries", () => {
    const b = bill({
      lines: [
        line({
          id: "L1",
          description: "Jane Doe",
          class_code: "5183",
          entity_name: "Jane Doe",
          audited_amount: 40000,
          rate: 6.1,
          rate_basis: "per_100",
        }),
        line({
          id: "L2",
          description: "8810 Clerical",
          class_code: "8810",
          audited_amount: 60000,
          rate: 0.45,
          rate_basis: "per_100",
        }),
      ],
    });
    const s = summary([
      row({ id: "R1", name_or_role: "Doe, Jane", class_code: "8810", straight_time_wages: 40000 }),
    ]);
    const e = evaluate({
      bill: b,
      summary: s,
      certificates: [],
      alignment: align({ L1: { rows: ["R1"] } }),
      files: FILES,
    });
    const l = e.lines[0]!;
    assert.equal(l.rule, "class_code_mismatch");
    assert.equal(l.disputedExposure, 40000);
    assert.equal(l.disputedPremium, 2260);
    assert.match(l.reason, /class 8810/);
    assert.match(l.reason, /more expensive/);
  });

  it("the full contract amount when the records split labor and materials", () => {
    const b = bill({
      lines: [
        line({
          id: "L1",
          description: "Deck Co - contract",
          category: "subcontractor",
          basis: "total_contract",
          entity_name: "Deck Co",
          audited_amount: 50000,
        }),
      ],
    });
    const s = summary([
      row({
        id: "R1",
        name_or_role: "Deck Co",
        is_subcontractor: true,
        labor_amount: 20000,
        materials_amount: 30000,
      }),
    ]);
    const e = evaluate({
      bill: b,
      summary: s,
      certificates: [cert({ id: "C1-1", insured_name: "Someone Else" })],
      alignment: align({ L1: { rows: ["R1"] } }),
      files: FILES,
    });
    assert.equal(e.lines[0]!.rule, "total_contract_as_payroll");
    assert.equal(e.lines[0]!.ourAmount, 20000);
    assert.equal(e.lines[0]!.disputedExposure, 30000);
  });
});
