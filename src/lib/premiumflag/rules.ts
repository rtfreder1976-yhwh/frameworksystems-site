import type {
  Alignment,
  Analysis,
  AnalysisLine,
  BillExtract,
  BillLine,
  FlatCertificate,
  RuleId,
  SummaryExtract,
  SummaryRow,
} from "./types.ts";
import { coverage, fmtDate, money, sameClassCode } from "./match.ts";

/**
 * The Pay / Flag engine. Pure code, no model.
 *
 * A line is flagged only when a document in the upload contradicts it, and only through one
 * of the rules the handoff lists. A bill that is bigger than the estimate is the true-up:
 * it is never a flag on its own.
 */

export type EvaluateInput = {
  bill: BillExtract;
  summary: SummaryExtract;
  certificates: FlatCertificate[];
  alignment: Alignment;
  files: { bill: string; summary: string; certificates: string[] };
};

export type Evaluation = Omit<Analysis, "id" | "version" | "createdAt">;

type Flag = {
  rule: RuleId;
  ourAmount: number | null;
  exposure: number | null;
  partial: boolean;
  reason: string;
  proof: { file: string; detail: string };
};

type Ctx = {
  bill: BillExtract;
  rows: SummaryRow[];
  certs: FlatCertificate[];
  files: EvaluateInput["files"];
};

const sum = (xs: Array<number | null | undefined>): number =>
  xs.reduce<number>((a, x) => a + (x ?? 0), 0);
const round2 = (n: number): number => Math.round(n * 100) / 100;
const approx = (a: number, b: number, tol = 0.01): boolean =>
  Math.abs(a - b) <= Math.max(1, Math.abs(b) * tol);
const uniq = <T>(xs: T[]): T[] => [...new Set(xs)];
const names = (rows: SummaryRow[]): string => rows.map((r) => r.name_or_role).join(", ");
const rowTotal = (r: SummaryRow): number =>
  r.total_wages ?? (r.straight_time_wages ?? 0) + (r.overtime_wages ?? 0);
const isSubLike = (line: BillLine): boolean =>
  line.category === "subcontractor" ||
  line.basis === "subcontract_cost" ||
  line.basis === "total_contract";

export function evaluate(input: EvaluateInput): Evaluation {
  const { bill, summary, certificates, alignment, files } = input;
  const rowsById = new Map(summary.rows.map((r) => [r.id, r] as const));
  const certsById = new Map(certificates.map((c) => [c.id, c] as const));
  const alignById = new Map(alignment.lines.map((l) => [l.line_id, l] as const));

  const lines: AnalysisLine[] = bill.lines.map((line): AnalysisLine => {
    const al = alignById.get(line.id);
    const rows = uniq(al?.summary_row_ids ?? [])
      .map((id) => rowsById.get(id))
      .filter((r): r is SummaryRow => Boolean(r));
    const certs = uniq(al?.certificate_ids ?? [])
      .map((id) => certsById.get(id))
      .filter((c): c is FlatCertificate => Boolean(c));
    const ctx: Ctx = { bill, rows, certs, files };
    const base = {
      id: line.id,
      description: line.description,
      category: line.category,
      classCode: line.class_code,
      entityName: line.entity_name,
      basis: line.basis,
      carrierAmount: line.audited_amount,
      carrierPremium: line.premium,
    };
    const flag = judge(line, ctx);
    if (flag) {
      // A reclassification disputes the rate, not the payroll, so its premium is unknown.
      const disputedPremium =
        flag.partial || flag.rule === "class_code_mismatch"
          ? null
          : premiumFor(line, flag.exposure);
      return {
        ...base,
        label: "flag",
        rule: flag.rule,
        partial: flag.partial,
        ourAmount: flag.ourAmount,
        disputedExposure: flag.exposure,
        disputedPremium,
        reason: flag.reason,
        proof: flag.proof,
      };
    }
    return {
      ...base,
      label: "pay",
      rule: null,
      partial: false,
      ourAmount: line.audited_amount,
      disputedExposure: null,
      disputedPremium: null,
      reason: payReason(line, ctx),
      proof: null,
    };
  });

  const flagged = lines.filter((l) => l.label === "flag");
  const disputedExposure = round2(sum(flagged.map((l) => l.disputedExposure)));
  const premiumKnownForAllFlags =
    flagged.length > 0 && flagged.every((l) => l.disputedPremium != null);
  const disputedPremium = flagged.some((l) => l.disputedPremium != null)
    ? round2(sum(flagged.map((l) => l.disputedPremium)))
    : null;
  const dueBase = bill.balance_due ?? bill.audited_premium_total;
  const undisputedPremium =
    premiumKnownForAllFlags && dueBase != null && disputedPremium != null
      ? round2(Math.max(0, dueBase - disputedPremium))
      : null;

  const warnings: string[] = [];
  if (!bill.audit_period_start || !bill.audit_period_end) {
    warnings.push(
      "The audit period could not be read from the bill, so certificates could not be checked against it. Any sub line stays Pay until that is fixed.",
    );
  }
  if (!bill.policy_number) {
    warnings.push("No policy number was read from the bill. The email leaves a blank to fill in.");
  }
  if (summary.rows.length === 0) {
    warnings.push(
      "The payroll summary came back with no rows, so nothing on the bill could be matched to it.",
    );
  }
  if (bill.reading_notes) warnings.push(`Reading the bill: ${bill.reading_notes}`);

  return {
    documentType: bill.document_type === "audit_worksheet" ? "audit_worksheet" : "audit_bill",
    carrier: bill.carrier,
    insuredName: bill.insured_name,
    policyNumber: bill.policy_number,
    policyType: bill.policy_type,
    auditPeriodStart: bill.audit_period_start,
    auditPeriodEnd: bill.audit_period_end,
    billDate: bill.bill_date,
    lines,
    flaggedCount: flagged.length,
    allPay: flagged.length === 0,
    disputedExposure,
    disputedPremium,
    premiumKnownForAllFlags,
    auditedPremiumTotal: bill.audited_premium_total,
    balanceDue: bill.balance_due,
    undisputedPremium,
    warnings,
    files,
  };
}

function judge(line: BillLine, ctx: Ctx): Flag | null {
  if (isSubLike(line)) return subCertificateFlag(line, ctx) ?? totalContractFlag(line, ctx);
  switch (line.category) {
    case "owner_officer":
      return ownerFlag(line, ctx);
    case "overtime":
      return overtimeFlag(line, ctx);
    case "employee_payroll":
      return overtimeFlag(line, ctx) ?? classCodeFlag(line, ctx);
    default:
      return line.includes_overtime_premium ? overtimeFlag(line, ctx) : null;
  }
}

/** Premium behind a slice of exposure, from the line's own premium or printed rate. */
function premiumFor(line: BillLine, exposure: number | null): number | null {
  if (exposure == null) return null;
  if (line.premium != null && line.audited_amount != null && line.audited_amount > 0) {
    return round2((line.premium * exposure) / line.audited_amount);
  }
  if (line.rate != null && line.rate_basis !== "unknown") {
    return round2((exposure * line.rate) / (line.rate_basis === "per_100" ? 100 : 1000));
  }
  return null;
}

/** A sub billed as payroll or cost, with a certificate in the upload in force for the period. */
function subCertificateFlag(line: BillLine, { bill, certs }: Ctx): Flag | null {
  if (!certs.length) return null;
  const who = line.entity_name ?? "This sub";
  const period = `${fmtDate(bill.audit_period_start)} to ${fmtDate(bill.audit_period_end)}`;
  const wantWc = bill.policy_type !== "general_liability";
  const wantGl = bill.policy_type !== "workers_comp";
  let partial: Flag | null = null;

  if (wantWc) {
    for (const c of certs) {
      if (!c.wc_policy_number && !c.wc_effective && !c.wc_expiration) continue;
      const cov = coverage(
        c.wc_effective,
        c.wc_expiration,
        bill.audit_period_start,
        bill.audit_period_end,
      );
      if (cov !== "full" && cov !== "partial") continue;
      const proof = {
        file: c.file,
        detail: `Certificate of insurance for ${c.insured_name}: workers compensation${
          c.insurer ? ` with ${c.insurer}` : ""
        }${c.wc_policy_number ? `, policy ${c.wc_policy_number}` : ""}, effective ${fmtDate(
          c.wc_effective,
        )} to ${fmtDate(c.wc_expiration)}.`,
      };
      if (cov === "full") {
        return {
          rule: "sub_has_wc_cert",
          ourAmount: 0,
          exposure: line.audited_amount,
          partial: false,
          reason: `${who} carried workers comp for the whole audit period (${period}). Payments to an insured sub are not payroll on this policy.`,
          proof,
        };
      }
      partial ??= {
        rule: "sub_has_wc_cert",
        ourAmount: null,
        exposure: line.audited_amount,
        partial: true,
        reason: `${who} carried workers comp from ${fmtDate(c.wc_effective)} to ${fmtDate(
          c.wc_expiration,
        )}, inside the audit period. Payments dated inside those dates come off this line. Work outside them stays.`,
        proof,
      };
    }
  }

  if (wantGl) {
    const required = bill.required_gl_each_occurrence;
    for (const c of certs) {
      if (!c.gl_policy_number && !c.gl_effective && !c.gl_expiration) continue;
      if (required != null && c.gl_each_occurrence != null && c.gl_each_occurrence < required) {
        continue;
      }
      const cov = coverage(
        c.gl_effective,
        c.gl_expiration,
        bill.audit_period_start,
        bill.audit_period_end,
      );
      if (cov !== "full" && cov !== "partial") continue;
      const limits =
        c.gl_each_occurrence != null
          ? `, ${money(c.gl_each_occurrence)} each occurrence${
              c.gl_aggregate != null ? ` / ${money(c.gl_aggregate)} aggregate` : ""
            }`
          : "";
      const proof = {
        file: c.file,
        detail: `Certificate of insurance for ${c.insured_name}: general liability${
          c.insurer ? ` with ${c.insurer}` : ""
        }${c.gl_policy_number ? `, policy ${c.gl_policy_number}` : ""}, effective ${fmtDate(
          c.gl_effective,
        )} to ${fmtDate(c.gl_expiration)}${limits}.`,
      };
      if (cov === "full") {
        return {
          rule: "sub_has_gl_cert",
          ourAmount: 0,
          exposure: line.audited_amount,
          partial: false,
          reason: `${who} carried general liability for the whole audit period (${period})${
            required != null ? " at the limits the audit requires" : ""
          }. Cost paid to an insured sub does not belong in the audited base.`,
          proof,
        };
      }
      partial ??= {
        rule: "sub_has_gl_cert",
        ourAmount: null,
        exposure: line.audited_amount,
        partial: true,
        reason: `${who} carried general liability from ${fmtDate(c.gl_effective)} to ${fmtDate(
          c.gl_expiration,
        )}, inside the audit period. Payments dated inside those dates come off this line. Work outside them stays.`,
        proof,
      };
    }
  }

  return partial;
}

/** The full contract price was used as exposure when the records split labor and materials. */
function totalContractFlag(line: BillLine, { rows, files }: Ctx): Flag | null {
  if (line.basis !== "total_contract" || line.audited_amount == null) return null;
  const labor = sum(rows.map((r) => r.labor_amount));
  if (!(labor > 0) || labor >= line.audited_amount) return null;
  const materials = sum(rows.map((r) => r.materials_amount));
  const who = line.entity_name ?? "this contract";
  const split = `labor ${money(labor)}${materials > 0 ? `, materials ${money(materials)}` : ""}`;
  return {
    rule: "total_contract_as_payroll",
    ourAmount: round2(labor),
    exposure: round2(line.audited_amount - labor),
    partial: false,
    reason: `The audit used the full contract amount (${money(
      line.audited_amount,
    )}) for ${who}. The records split it: ${split}. Only the labor is exposure.`,
    proof: { file: files.summary, detail: `Payroll summary rows for ${names(rows)}: ${split}.` },
  };
}

/** An owner or officer counted while the records show an exclusion, or counted above the cap. */
function ownerFlag(line: BillLine, { bill, rows, files }: Ctx): Flag | null {
  const who = line.entity_name ?? "The owner or officer";
  const excluded = rows.find((r) => r.excluded === true);
  if (excluded) {
    return {
      rule: "owner_excluded",
      ourAmount: 0,
      exposure: line.audited_amount,
      partial: false,
      reason: `${who} is marked excluded from coverage on the payroll summary, but the audit counts ${money(
        line.audited_amount,
      )} of payroll for that person.`,
      proof: {
        file: files.summary,
        detail: `Payroll summary row "${excluded.name_or_role}" is marked excluded${
          excluded.notes ? ` (${excluded.notes})` : ""
        }.`,
      },
    };
  }
  const cap = bill.owner_officer_cap;
  if (cap != null && line.audited_amount != null && line.audited_amount > cap + 0.5) {
    return {
      rule: "owner_over_cap",
      ourAmount: cap,
      exposure: round2(line.audited_amount - cap),
      partial: false,
      reason: `The audit counts ${money(
        line.audited_amount,
      )} for ${who}. The same document sets the officer payroll maximum at ${money(cap)}.`,
      proof: {
        file: files.bill,
        detail: `The audit document states an officer payroll maximum of ${money(cap)}.`,
      },
    };
  }
  return null;
}

/** Overtime premium (the extra half) sitting inside the auditable payroll base. */
function overtimeFlag(line: BillLine, { rows, files }: Ctx): Flag | null {
  const audited = line.audited_amount;
  if (audited == null) return null;
  const premiumPortion = round2(sum(rows.map((r) => r.overtime_premium)));
  if (!(premiumPortion > 0)) return null;
  const straight = sum(rows.map((r) => r.straight_time_wages));
  const otFull = sum(rows.map((r) => r.overtime_wages));
  const grossIncl = straight + otFull;
  const shown = line.includes_overtime_premium === true;
  const isOtLine = line.category === "overtime";
  const numbersSay =
    (grossIncl > 0 && otFull > 0 && approx(audited, grossIncl)) ||
    (isOtLine && otFull > 0 && approx(audited, otFull)) ||
    (isOtLine && approx(audited, premiumPortion));
  if (!shown && !numbersSay) return null;
  const ourAmount = round2(Math.max(0, audited - premiumPortion));
  const reason = shown
    ? `The worksheet shows overtime premium inside the audited payroll. The straight-time part of overtime stays; the extra half (${money(
        premiumPortion,
      )}) comes out.`
    : isOtLine
      ? `This line carries the overtime premium (${money(
          premiumPortion,
        )} on the summary). The extra half of overtime is not auditable payroll.`
      : `The audited payroll equals straight time plus full overtime on the summary (${money(
          grossIncl,
        )}), so the overtime premium (${money(premiumPortion)}) is inside it. The extra half comes out.`;
  return {
    rule: "overtime_premium_included",
    ourAmount,
    exposure: round2(audited - ourAmount),
    partial: false,
    reason,
    proof: {
      file: files.summary,
      detail: `Payroll summary${rows.length ? ` rows for ${names(rows)}` : ""}: straight time ${money(
        straight,
      )}, overtime ${money(otFull)}, overtime premium ${money(premiumPortion)}.`,
    },
  };
}

/** A named person's payroll placed in a class code the summary does not carry for them. */
function classCodeFlag(line: BillLine, { rows, files }: Ctx): Flag | null {
  if (!line.entity_name || !line.class_code) return null;
  const coded = rows.filter((r) => r.class_code);
  if (!coded.length || coded.some((r) => sameClassCode(r.class_code, line.class_code))) {
    return null;
  }
  const codes = uniq(coded.map((r) => r.class_code as string));
  const total = sum(coded.map(rowTotal));
  return {
    rule: "class_code_mismatch",
    ourAmount: line.audited_amount,
    exposure: line.audited_amount,
    partial: false,
    reason: `The audit puts ${line.entity_name} in class ${
      line.class_code
    }. The payroll summary carries that payroll under class ${codes.join(
      ", ",
    )}. Same payroll, different code.`,
    proof: {
      file: files.summary,
      detail: `Payroll summary rows for ${names(coded)}: class code ${codes.join(", ")}${
        total > 0 ? `, ${money(total)}` : ""
      }.`,
    },
  };
}

function payReason(line: BillLine, { bill, rows, certs }: Ctx): string {
  const audited = line.audited_amount;
  if (isSubLike(line)) {
    if (!line.entity_name) {
      return "The bill does not name the sub on this line. A certificate can only clear a named sub; ask the carrier for the list behind the number.";
    }
    if (!certs.length) {
      return `No certificate in the upload for ${line.entity_name}. Payment to a sub without a certificate is counted as payroll.`;
    }
    if (!bill.audit_period_start || !bill.audit_period_end) {
      return `${line.entity_name} has a certificate in the upload, but the audit period could not be read from the bill, so the dates could not be checked.`;
    }
    const required = bill.required_gl_each_occurrence;
    if (
      required != null &&
      certs.some((c) => c.gl_each_occurrence != null && c.gl_each_occurrence < required)
    ) {
      return `${line.entity_name} has a general liability certificate in the upload, but its limits are below what the audit requires.`;
    }
    return `${line.entity_name} has a certificate in the upload, but it does not cover the audit period (${fmtDate(
      bill.audit_period_start,
    )} to ${fmtDate(bill.audit_period_end)}), or its dates could not be read.`;
  }
  if (rows.length && audited != null) {
    const recorded = sum(rows.map(rowTotal));
    if (recorded > 0 && approx(audited, recorded)) {
      return `Matches the payroll summary (${names(rows)}: ${money(recorded)}).`;
    }
    if (recorded > 0 && audited < recorded) {
      return `The carrier used less payroll (${money(audited)}) than the summary shows (${money(
        recorded,
      )}).`;
    }
    if (recorded > 0) {
      return `The summary shows ${money(recorded)} for ${names(rows)}; the audit used ${money(
        audited,
      )}. Nothing in the upload shows why, so the line stands as billed.`;
    }
  }
  if (audited != null && line.estimated_amount != null && audited > line.estimated_amount) {
    return `Payroll grew past the estimate (${money(line.estimated_amount)} estimated, ${money(
      audited,
    )} audited). That is the true-up, not an error.`;
  }
  return "No document in the upload contradicts this line.";
}
