import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "./rules.ts";
import { autoAlign } from "./match.ts";
import type {
  Alignment,
  BillExtract,
  BillLine,
  FlatCertificate,
  SummaryExtract,
  SummaryRow,
} from "./types.ts";

export const FILES = {
  bill: "audit-bill.pdf",
  summary: "payroll-summary.csv",
  certificates: ["certs.pdf"],
};

export function bill(over: Partial<BillExtract> = {}): BillExtract {
  return {
    document_type: "audit_bill",
    carrier: "Acme Mutual",
    insured_name: "Shoals Plumbing LLC",
    policy_number: "WC-4471",
    policy_type: "workers_comp",
    audit_period_start: "2025-01-01",
    audit_period_end: "2025-12-31",
    bill_date: "2026-02-10",
    state: "AL",
    owner_officer_cap: null,
    required_gl_each_occurrence: null,
    lines: [],
    audited_premium_total: null,
    estimated_premium_total: null,
    balance_due: null,
    contains_ssn: false,
    reading_notes: null,
    ...over,
  };
}

export function line(over: Partial<BillLine> & { id: string }): BillLine {
  return {
    description: "",
    category: "employee_payroll",
    class_code: null,
    state: null,
    entity_name: null,
    basis: "payroll",
    audited_amount: null,
    estimated_amount: null,
    rate: null,
    rate_basis: "unknown",
    premium: null,
    includes_overtime_premium: null,
    notes: null,
    ...over,
  };
}

export function row(over: Partial<SummaryRow> & { id: string }): SummaryRow {
  return {
    name_or_role: "",
    state: null,
    class_code: null,
    straight_time_wages: null,
    overtime_wages: null,
    overtime_premium: null,
    total_wages: null,
    is_owner_officer: null,
    excluded: null,
    is_subcontractor: null,
    labor_amount: null,
    materials_amount: null,
    notes: null,
    ...over,
  };
}

export function cert(
  over: Partial<FlatCertificate> & { id: string; insured_name: string },
): FlatCertificate {
  return {
    file: "certs.pdf",
    insurer: null,
    wc_policy_number: null,
    wc_effective: null,
    wc_expiration: null,
    gl_policy_number: null,
    gl_effective: null,
    gl_expiration: null,
    gl_each_occurrence: null,
    gl_aggregate: null,
    certificate_holder: null,
    notes: null,
    ...over,
  };
}

export function summary(rows: SummaryRow[]): SummaryExtract {
  return {
    document_type: "payroll_summary",
    period_start: "2025-01-01",
    period_end: "2025-12-31",
    rows,
    contains_ssn: false,
    looks_like_register: false,
    reading_notes: null,
  };
}

export function align(map: Record<string, { rows?: string[]; certs?: string[] }>): Alignment {
  return {
    lines: Object.entries(map).map(([line_id, v]) => ({
      line_id,
      summary_row_ids: v.rows ?? [],
      certificate_ids: v.certs ?? [],
      note: null,
    })),
  };
}

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
    const b = bill({ lines: [subLine()] });
    const e = evaluate({
      bill: b,
      summary: summary([]),
      certificates: [],
      alignment: align({}),
      files: FILES,
    });
    assert.equal(e.lines[0]!.label, "pay");
    assert.match(e.lines[0]!.reason, /No certificate in the upload/);
  });

  it("a certificate that ended before the period does not flag", () => {
    const c = cert({
      id: "C1-1",
      insured_name: "John Smith Roofing LLC",
      wc_policy_number: "WC 1",
      wc_effective: "2023-01-01",
      wc_expiration: "2024-01-01",
    });
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
    const c = cert({
      id: "C1-1",
      insured_name: "John Smith Roofing LLC",
      wc_policy_number: "WC 1",
      wc_effective: "2024-01-01",
      wc_expiration: "2027-01-01",
    });
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
});

describe("evaluate: the six flags", () => {
  it("a sub with workers comp in force for the whole period, cited from the certificate", () => {
    const c = cert({
      id: "C1-1",
      insured_name: "John Smith Roofing LLC",
      insurer: "Builders Mutual",
      wc_policy_number: "WC 998877",
      wc_effective: "2024-11-01",
      wc_expiration: "2026-11-01",
    });
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
    const c = cert({
      id: "C1-1",
      insured_name: "John Smith Roofing LLC",
      wc_policy_number: "WC 1",
      wc_effective: "2025-07-01",
      wc_expiration: "2026-07-01",
    });
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

  it("a named person in a class code the summary does not carry for them", () => {
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
    assert.equal(l.disputedPremium, null);
    assert.equal(l.disputedExposure, 40000);
    assert.match(l.reason, /class 8810/);
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
