import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  autoAlign,
  coverage,
  fmtDate,
  mergeAlignments,
  money,
  namesMatch,
  normalizeName,
  parseDate,
  periodFit,
  sameClassCode,
} from "./match.ts";
import type { BillExtract, FlatCertificate, SummaryRow } from "./types.ts";

describe("names", () => {
  it("ignores suffixes, punctuation, dotted initials, and first-name initials", () => {
    assert.equal(normalizeName("A.B.C. Roofing, Inc."), "abc roofing");
    assert.equal(namesMatch("J. Smith Roofing", "John Smith Roofing LLC"), true);
    assert.equal(namesMatch("ABC Roofing, Inc.", "abc roofing"), true);
    assert.equal(namesMatch("A.B.C. Roofing", "ABC Roofing LLC"), true);
  });
  it("does not match different trades or a bare surname", () => {
    assert.equal(namesMatch("Smith Roofing", "Smith Plumbing"), false);
    assert.equal(namesMatch("Smith", "Smith Roofing"), false);
    assert.equal(namesMatch(null, "Smith Roofing"), false);
  });
});

describe("dates and money", () => {
  it("parses the common layouts", () => {
    assert.equal(parseDate("2025-01-05"), Date.UTC(2025, 0, 5));
    assert.equal(parseDate("1/5/25"), Date.UTC(2025, 0, 5));
    assert.equal(parseDate("01/05/2025"), Date.UTC(2025, 0, 5));
    assert.equal(parseDate("not a date"), null);
    assert.equal(fmtDate("2025-01-05"), "01/05/2025");
    assert.equal(money(1234.5), "$1,234.50");
    assert.equal(money(null), "—");
  });
  it("judges certificate coverage against the audit period", () => {
    assert.equal(coverage("2025-01-01", "2026-01-01", "2025-01-01", "2025-12-31"), "full");
    assert.equal(coverage("2025-06-01", "2026-06-01", "2025-01-01", "2025-12-31"), "partial");
    assert.equal(coverage("2023-01-01", "2024-01-01", "2025-01-01", "2025-12-31"), "none");
    assert.equal(coverage(null, "2026-01-01", "2025-01-01", "2025-12-31"), "unknown");
    assert.equal(coverage("2025-01-01", "2026-01-01", null, null), "unknown");
    assert.equal(coverage("01/01/2025", "01/01/2026", "1/1/25", "12/31/25"), "full");
  });
  it("compares class codes on their first four digits", () => {
    assert.equal(sameClassCode("5645", "5645-01"), true);
    assert.equal(sameClassCode("5645", "5183"), false);
    assert.equal(sameClassCode(null, "5645"), false);
  });
});

describe("autoAlign", () => {
  const bill = {
    document_type: "audit_bill",
    carrier: null,
    insured_name: null,
    policy_number: null,
    policy_type: "workers_comp",
    audit_period_start: "2025-01-01",
    audit_period_end: "2025-12-31",
    bill_date: null,
    state: "AL",
    owner_officer_cap: null,
    required_gl_each_occurrence: null,
    lines: [
      {
        id: "L1",
        description: "5645 Carpentry - AL",
        category: "employee_payroll",
        class_code: "5645",
        state: "AL",
        entity_name: null,
        basis: "payroll",
        audited_amount: 200000,
        estimated_amount: null,
        rate: null,
        rate_basis: "unknown",
        premium: null,
        includes_overtime_premium: null,
        notes: null,
      },
      {
        id: "L2",
        description: "Sub: ABC Roofing LLC",
        category: "subcontractor",
        class_code: null,
        state: null,
        entity_name: "ABC Roofing LLC",
        basis: "subcontract_cost",
        audited_amount: 30000,
        estimated_amount: null,
        rate: null,
        rate_basis: "unknown",
        premium: null,
        includes_overtime_premium: null,
        notes: null,
      },
      {
        id: "L3",
        description: "Officer: Todd Frederickson",
        category: "owner_officer",
        class_code: "8810",
        state: "AL",
        entity_name: "Todd Frederickson",
        basis: "payroll",
        audited_amount: 60000,
        estimated_amount: null,
        rate: null,
        rate_basis: "unknown",
        premium: null,
        includes_overtime_premium: null,
        notes: null,
      },
    ],
    audited_premium_total: null,
    estimated_premium_total: null,
    balance_due: null,
    contains_ssn: false,
    reading_notes: null,
  } satisfies BillExtract;
  const rows: SummaryRow[] = [
    {
      id: "R1",
      name_or_role: "Carpenters",
      state: "AL",
      class_code: "5645",
      straight_time_wages: 200000,
      overtime_wages: null,
      overtime_premium: null,
      total_wages: 200000,
      is_owner_officer: null,
      excluded: null,
      is_subcontractor: null,
      labor_amount: null,
      materials_amount: null,
      notes: null,
    },
    {
      id: "R2",
      name_or_role: "Frederickson, Todd",
      state: "AL",
      class_code: "8810",
      straight_time_wages: 60000,
      overtime_wages: null,
      overtime_premium: null,
      total_wages: 60000,
      is_owner_officer: true,
      excluded: null,
      is_subcontractor: null,
      labor_amount: null,
      materials_amount: null,
      notes: null,
    },
  ];
  const certs: FlatCertificate[] = [
    {
      id: "C1-1",
      file: "certs.pdf",
      insured_name: "A.B.C. Roofing",
      insurer: null,
      wc_policy_number: "WC1",
      wc_effective: "2025-01-01",
      wc_expiration: "2026-01-01",
      gl_policy_number: null,
      gl_effective: null,
      gl_expiration: null,
      gl_each_occurrence: null,
      gl_aggregate: null,
      certificate_holder: null,
      notes: null,
    },
  ];

  it("links class-code lines by code, named lines by name", () => {
    const a = autoAlign(bill, rows, certs);
    const byId = Object.fromEntries(a.lines.map((l) => [l.line_id, l]));
    assert.deepEqual(byId.L1?.summary_row_ids, ["R1"]);
    assert.deepEqual(byId.L1?.certificate_ids, []);
    assert.deepEqual(byId.L2?.certificate_ids, ["C1-1"]);
    assert.deepEqual(byId.L3?.summary_row_ids, ["R2"]);
  });
  it("merges two alignments without duplicates", () => {
    const a = autoAlign(bill, rows, certs);
    const m = mergeAlignments(a, {
      lines: [{ line_id: "L2", summary_row_ids: [], certificate_ids: ["C1-1"], note: "same sub" }],
    });
    const l2 = m.lines.find((l) => l.line_id === "L2");
    assert.deepEqual(l2?.certificate_ids, ["C1-1"]);
    assert.equal(l2?.note, "same sub");
  });
});

describe("periodFit", () => {
  it("matches a summary within a month of the audit period at each end", () => {
    assert.equal(periodFit("2025-04-01", "2026-03-31", "2025-03-15", "2026-03-15"), "match");
    assert.equal(periodFit("2025-01-01", "2025-12-31", "2025-01-01", "2025-12-31"), "match");
  });
  it("calls a calendar-year summary against a mid-year policy partial", () => {
    assert.equal(periodFit("2025-01-01", "2025-12-31", "2025-07-01", "2026-07-01"), "partial");
  });
  it("calls last year's summary a mismatch", () => {
    assert.equal(periodFit("2024-01-01", "2024-12-31", "2025-01-01", "2025-12-31"), "mismatch");
  });
  it("is unknown when either side has no dates", () => {
    assert.equal(periodFit(null, null, "2025-01-01", "2025-12-31"), "unknown");
    assert.equal(periodFit("2025-01-01", "2025-12-31", null, "2025-12-31"), "unknown");
  });
});
