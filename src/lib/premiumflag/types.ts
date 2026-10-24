import { z } from "zod";

/**
 * PremiumFlag data shapes.
 *
 * The extraction schemas (bill, payroll summary, certificates) are what the model fills in from
 * ONE uploaded document. They are deliberately "what the page says": nullable everywhere, no
 * inferred values, no judgment. The rules engine in rules.ts is the only thing that decides
 * Pay or Flag, and it only ever flags a line that a document in the upload contradicts.
 */

export const PolicyTypeSchema = z.enum(["workers_comp", "general_liability", "both", "unknown"]);
export type PolicyType = z.infer<typeof PolicyTypeSchema>;

export const LineCategorySchema = z.enum([
  "employee_payroll",
  "subcontractor",
  "owner_officer",
  "overtime",
  "other",
]);
export type LineCategory = z.infer<typeof LineCategorySchema>;

export const LineBasisSchema = z.enum([
  "payroll",
  "subcontract_cost",
  "total_contract",
  "other",
  "unknown",
]);
export type LineBasis = z.infer<typeof LineBasisSchema>;

export const BillLineSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: LineCategorySchema,
  class_code: z.string().nullable(),
  state: z.string().nullable(),
  entity_name: z.string().nullable(),
  basis: LineBasisSchema,
  /** The exposure the carrier used for the line: payroll, or cost paid to a sub. */
  audited_amount: z.number().nullable(),
  estimated_amount: z.number().nullable(),
  rate: z.number().nullable(),
  rate_basis: z.enum(["per_100", "per_1000", "unknown"]),
  premium: z.number().nullable(),
  /** true only when the document shows overtime premium (the extra half) inside the base. */
  includes_overtime_premium: z.boolean().nullable(),
  notes: z.string().nullable(),
});
export type BillLine = z.infer<typeof BillLineSchema>;

export const BillDocumentTypeSchema = z.enum([
  "audit_bill",
  "audit_worksheet",
  "records_request",
  "payroll_register",
  "other",
]);
export type BillDocumentType = z.infer<typeof BillDocumentTypeSchema>;

export const BillExtractSchema = z.object({
  document_type: BillDocumentTypeSchema,
  carrier: z.string().nullable(),
  insured_name: z.string().nullable(),
  policy_number: z.string().nullable(),
  policy_type: PolicyTypeSchema,
  audit_period_start: z.string().nullable(),
  audit_period_end: z.string().nullable(),
  bill_date: z.string().nullable(),
  state: z.string().nullable(),
  /** Officer payroll maximum, only when the document states one. */
  owner_officer_cap: z.number().nullable(),
  /** Per-occurrence GL limit the document requires on sub certificates, only when stated. */
  required_gl_each_occurrence: z.number().nullable(),
  lines: z.array(BillLineSchema),
  audited_premium_total: z.number().nullable(),
  estimated_premium_total: z.number().nullable(),
  balance_due: z.number().nullable(),
  contains_ssn: z.boolean(),
  reading_notes: z.string().nullable(),
});
export type BillExtract = z.infer<typeof BillExtractSchema>;

export const SummaryRowSchema = z.object({
  id: z.string(),
  name_or_role: z.string(),
  state: z.string().nullable(),
  class_code: z.string().nullable(),
  straight_time_wages: z.number().nullable(),
  /** Overtime pay at the full rate, when the summary shows it. */
  overtime_wages: z.number().nullable(),
  /** The extra-half portion of overtime, when the summary shows it. */
  overtime_premium: z.number().nullable(),
  total_wages: z.number().nullable(),
  is_owner_officer: z.boolean().nullable(),
  /** The summary marks the person as excluded or exempt from coverage. */
  excluded: z.boolean().nullable(),
  is_subcontractor: z.boolean().nullable(),
  labor_amount: z.number().nullable(),
  materials_amount: z.number().nullable(),
  notes: z.string().nullable(),
});
export type SummaryRow = z.infer<typeof SummaryRowSchema>;

export const SummaryExtractSchema = z.object({
  document_type: z.enum(["payroll_summary", "payroll_register", "other"]),
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  rows: z.array(SummaryRowSchema),
  contains_ssn: z.boolean(),
  looks_like_register: z.boolean(),
  reading_notes: z.string().nullable(),
});
export type SummaryExtract = z.infer<typeof SummaryExtractSchema>;

export const CertificateSchema = z.object({
  id: z.string(),
  /** The named insured on the certificate: the subcontractor. Never the holder. */
  insured_name: z.string(),
  insurer: z.string().nullable(),
  wc_policy_number: z.string().nullable(),
  wc_effective: z.string().nullable(),
  wc_expiration: z.string().nullable(),
  gl_policy_number: z.string().nullable(),
  gl_effective: z.string().nullable(),
  gl_expiration: z.string().nullable(),
  gl_each_occurrence: z.number().nullable(),
  gl_aggregate: z.number().nullable(),
  certificate_holder: z.string().nullable(),
  notes: z.string().nullable(),
});
export type Certificate = z.infer<typeof CertificateSchema>;

export const CertificatesExtractSchema = z.object({
  document_type: z.enum(["certificate", "other"]),
  certificates: z.array(CertificateSchema),
  contains_ssn: z.boolean(),
  reading_notes: z.string().nullable(),
});
export type CertificatesExtract = z.infer<typeof CertificatesExtractSchema>;

/** Which summary rows and certificates belong to each bill line. */
export const AlignmentSchema = z.object({
  lines: z.array(
    z.object({
      line_id: z.string(),
      summary_row_ids: z.array(z.string()),
      certificate_ids: z.array(z.string()),
      note: z.string().nullable(),
    }),
  ),
});
export type Alignment = z.infer<typeof AlignmentSchema>;

/** A certificate plus the file it came from. ids are unique across files. */
export type FlatCertificate = Certificate & { file: string };

export const RuleIdSchema = z.enum([
  "sub_has_wc_cert",
  "sub_has_gl_cert",
  "overtime_premium_included",
  "owner_excluded",
  "owner_over_cap",
  "class_code_mismatch",
  "total_contract_as_payroll",
]);
export type RuleId = z.infer<typeof RuleIdSchema>;

export const AnalysisLineSchema = z.object({
  id: z.string(),
  description: z.string(),
  category: LineCategorySchema,
  classCode: z.string().nullable(),
  entityName: z.string().nullable(),
  basis: LineBasisSchema,
  carrierAmount: z.number().nullable(),
  carrierPremium: z.number().nullable(),
  label: z.enum(["pay", "flag"]),
  rule: RuleIdSchema.nullable(),
  /** A certificate covers part of the audit period, so the exact split needs payment dates. */
  partial: z.boolean(),
  ourAmount: z.number().nullable(),
  disputedExposure: z.number().nullable(),
  disputedPremium: z.number().nullable(),
  reason: z.string(),
  proof: z.object({ file: z.string(), detail: z.string() }).nullable(),
});
export type AnalysisLine = z.infer<typeof AnalysisLineSchema>;

export const AnalysisSchema = z.object({
  id: z.string().regex(/^pf_[a-z0-9]{10,40}$/),
  version: z.literal(1),
  createdAt: z.string(),
  documentType: z.enum(["audit_bill", "audit_worksheet"]),
  carrier: z.string().nullable(),
  insuredName: z.string().nullable(),
  policyNumber: z.string().nullable(),
  policyType: PolicyTypeSchema,
  auditPeriodStart: z.string().nullable(),
  auditPeriodEnd: z.string().nullable(),
  billDate: z.string().nullable(),
  lines: z.array(AnalysisLineSchema),
  flaggedCount: z.number().int().nonnegative(),
  allPay: z.boolean(),
  /** Audited payroll or cost the flagged lines put in question. */
  disputedExposure: z.number(),
  /** Premium in dispute, where the bill shows a rate or a premium for the line. */
  disputedPremium: z.number().nullable(),
  premiumKnownForAllFlags: z.boolean(),
  auditedPremiumTotal: z.number().nullable(),
  balanceDue: z.number().nullable(),
  undisputedPremium: z.number().nullable(),
  warnings: z.array(z.string()),
  files: z.object({
    bill: z.string(),
    summary: z.string(),
    certificates: z.array(z.string()),
  }),
});
export type Analysis = z.infer<typeof AnalysisSchema>;
