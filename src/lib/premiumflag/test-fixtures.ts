import type {
  Alignment,
  BillExtract,
  BillLine,
  FlatCertificate,
  SummaryExtract,
  SummaryRow,
} from "./types.ts";

/** Builders for PremiumFlag tests. Every field defaults to "the document did not say". */

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
