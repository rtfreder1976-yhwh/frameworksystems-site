import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { pdfTextLayer } from "./pdf-text.server";
import { SSN_MESSAGE, screenCsv, screenText } from "./screen.ts";
import {
  AlignmentSchema,
  BillExtractSchema,
  CertificatesExtractSchema,
  SummaryExtractSchema,
} from "./types.ts";
import type {
  Alignment,
  BillExtract,
  CertificatesExtract,
  FlatCertificate,
  SummaryExtract,
  SummaryRow,
} from "./types.ts";

/**
 * Reading documents with the model. The model only transcribes into a fixed schema; it never
 * decides Pay or Flag. Every read is one document in, one JSON object out.
 */

export const MODEL = "claude-opus-5-5";
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_CSV_CHARS = 1_000_000;

export type UploadKind = "bill" | "summary" | "certificate";
const MAX_PAGES: Record<UploadKind, number> = { bill: 60, summary: 60, certificate: 80 };

export type Upload = {
  kind: UploadKind;
  filename: string;
  mediaType: "application/pdf" | "text/csv";
  base64: string;
};

export type RefusalReason =
  "ssn" | "register" | "records_request" | "not_a_bill" | "not_a_summary" | "not_a_certificate";

export type ExtractOutcome =
  | { ok: true; kind: "bill"; filename: string; extract: BillExtract }
  | { ok: true; kind: "summary"; filename: string; extract: SummaryExtract }
  | { ok: true; kind: "certificate"; filename: string; extract: CertificatesExtract }
  | { ok: false; refused: true; reason: RefusalReason; filename: string; message: string }
  | { ok: false; refused: false; filename: string; message: string };

export const RECORDS_REQUEST_MESSAGE =
  "This is the first letter, the one that asks for records. It is not the upload. Wait for the bill or the audit worksheet with the figures on it.";
export const UNAVAILABLE_MESSAGE =
  "PremiumFlag is not switched on in this deployment yet. Email todd@frameworksystems.co with the subject PremiumFlag.";

export class PremiumFlagError extends Error {
  code: "unavailable" | "unreadable";
  constructor(message: string, code: "unavailable" | "unreadable" = "unreadable") {
    super(message);
    this.name = "PremiumFlagError";
    this.code = code;
  }
}

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new PremiumFlagError(UNAVAILABLE_MESSAGE, "unavailable");
  return new Anthropic({ apiKey, maxRetries: 2, timeout: 240_000 });
}

type Content = Anthropic.Beta.BetaContentBlockParam[];

/** One structured read. Opus 5.5 with adaptive thinking (the default) at the effort given. */
async function structured<S extends z.ZodType>(
  schema: S,
  system: string,
  content: Content,
  label: string,
  effort: "medium" | "high" = "high",
): Promise<z.infer<S>> {
  const message = await client()
    .beta.messages.parse({
      model: MODEL,
      max_tokens: 16_000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      output_config: { effort, format: zodOutputFormat(schema) },
      messages: [{ role: "user", content }],
    })
    .catch((err: unknown) => {
      // API errors keep their class for friendlyError; a reply that does not fit the schema
      // (the SDK's parse step rejects it) becomes a plain "try again".
      if (err instanceof Anthropic.APIError) throw err;
      console.error("[premiumflag] parse failed:", err);
      throw new PremiumFlagError(`Couldn't read ${label} into the expected shape. Try again.`);
    });
  if (message.stop_reason === "refusal") {
    throw new PremiumFlagError(`The reader declined ${label}. Try a cleaner copy of the file.`);
  }
  if (message.stop_reason === "max_tokens") {
    throw new PremiumFlagError(`${label} is too long to read in one pass. Split it and try again.`);
  }
  if (!message.parsed_output) {
    throw new PremiumFlagError(`Couldn't read ${label} into the expected shape. Try again.`);
  }
  return message.parsed_output;
}

const COMMON_RULES = `Rules that apply to every field:
- Transcribe what the document shows. Never infer, estimate, average, or fill a gap. A value that is not on the page is null.
- Never transcribe a Social Security number. If one appears anywhere, set contains_ssn to true and leave it out.
- Amounts are plain numbers in dollars with no symbols or commas. Dates are YYYY-MM-DD. Class codes are the code as printed (for example "5645").
- reading_notes: one or two sentences on anything that was hard to read, else null.`;

const BILL_SYSTEM = `You read premium audit documents for a contractor's workers compensation or general liability policy and fill a schema.
${COMMON_RULES}
document_type: "audit_bill" when the document shows audited figures with a premium, balance due, or refund; "audit_worksheet" when it is the auditor's worksheet, schedule, or summary of audited exposures; "records_request" when it only asks for payroll, certificates, tax forms, or an audit appointment and shows no audited figures; "payroll_register" when it is a payroll report of checks or pay periods; "other" otherwise.
policy_type from the document: workers_comp, general_liability, both (one audit covering both policies), or unknown.
lines: one entry for every exposure line the carrier used. Each class code and state. Each named subcontractor. Each "uninsured subcontractors", "casual labor", or "1099" line. Each owner, officer, partner, or member. Each overtime line. Keep the carrier's wording in description. Do not merge lines. Do not add lines that are not on the document. Lines that are only premium arithmetic (minimum premium, expense constant, terrorism, assessments, credits) get category "other" and basis "other".
- category: "subcontractor" for payments to subs or 1099 labor; "owner_officer" for a named owner, officer, partner, or member; "overtime" when the line is overtime or overtime premium; "employee_payroll" for a class-code payroll line; "other" otherwise.
- basis: what the carrier measured on the line. "payroll"; "subcontract_cost" for payments to subs; "total_contract" when the document shows the whole contract price, including materials, used as the exposure; "other"; "unknown".
- entity_name: the person or business the line is about, when the line names one. Null for a class-code total.
- audited_amount: the exposure the carrier used (payroll or cost). estimated_amount: the original estimate for the same line, if the document shows it. rate and rate_basis: the rate printed for the line and whether it is per 100 or per 1000 of exposure. premium: the premium printed for the line.
- includes_overtime_premium: true only when the document states or shows that overtime premium (the extra half) is included in the audited payroll for the line; false when it shows it excluded or deducted; null when the document does not say.
owner_officer_cap: the officer payroll maximum, only if the document states one. required_gl_each_occurrence: the per-occurrence limit the document requires on subcontractor certificates, only if stated.
audited_premium_total, estimated_premium_total, balance_due: as printed.`;

const SUMMARY_SYSTEM = `You read a contractor's payroll summary prepared for a premium audit and fill a schema.
${COMMON_RULES}
document_type: "payroll_summary" when the document totals wages by person or role, class code, or state for a period; "payroll_register" when it lists individual checks or pay periods with hours, deductions, taxes, or net pay; "other" otherwise. looks_like_register is true for a register.
rows: one per person or role per class code per state, as the document presents them. name_or_role as printed. straight_time_wages; overtime_wages (overtime pay at the full rate, if shown); overtime_premium (the extra half, if shown); total_wages as printed. is_owner_officer; excluded (the document marks the person excluded or exempt from coverage); is_subcontractor (1099 or sub); labor_amount and materials_amount when a contract or invoice is split; otherwise null. If only a total is printed, leave the parts null. Never compute a value the document does not show.`;

const CERT_SYSTEM = `You read certificates of insurance (ACORD 25 or similar) that a contractor collected from subcontractors and fill a schema with one entry per certificate in the document.
${COMMON_RULES}
- insured_name is the NAMED INSURED on the certificate, which is the subcontractor. It is never the certificate holder and never the producer or agent. certificate_holder is the holder as printed.
- Workers compensation: wc_policy_number, wc_effective, wc_expiration from the WORKERS COMPENSATION AND EMPLOYERS' LIABILITY line. If that line is blank or struck through, leave those null.
- General liability: gl_policy_number, gl_effective, gl_expiration, gl_each_occurrence, gl_aggregate from the COMMERCIAL GENERAL LIABILITY line. Null when blank.
- insurer: the insurer named for that coverage line, if readable.
- document_type is "other" when the document is not a certificate of insurance.`;

const ALIGN_SYSTEM = `You link the lines on a premium audit bill to the records a contractor uploaded. You receive JSON: the bill lines, the payroll summary rows, and the certificates. For each bill line return summary_row_ids for the rows that describe the same person, role, class code and state, and certificate_ids for the certificates whose named insured is the same business or person as the line's entity_name.
Rules:
- Link only when the names clearly refer to the same party. Ignore punctuation, capitalization, LLC/Inc/Co, "dba", and initials versus full first names. "J. Smith Roofing" and "John Smith Roofing LLC" are the same party. "Smith Roofing" and "Smith Plumbing" are not.
- A class-code line with no entity name links to every summary row with that class code (and state, when both show one). It links to no certificates.
- A line that names no subcontractor ("uninsured subcontractors", "casual labor") links to no certificates unless the line's notes list the names.
- An owner or officer line links to the summary rows for that person.
- An overtime line links to the summary rows that carry overtime for that class or person.
- Never link on a guess. An empty list is the right answer when nothing matches. Put any doubt in note.
Return one entry per bill line id.`;

const isPdf = (bytes: Buffer): boolean => bytes.subarray(0, 5).toString("latin1") === "%PDF-";

const refuse = (filename: string, reason: RefusalReason, message: string): ExtractOutcome => ({
  ok: false,
  refused: true,
  reason,
  filename,
  message,
});

const fail = (filename: string, message: string): ExtractOutcome => ({
  ok: false,
  refused: false,
  filename,
  message,
});

export async function extractUpload(upload: Upload): Promise<ExtractOutcome> {
  const { kind, filename } = upload;
  try {
    const bytes = Buffer.from(upload.base64, "base64");
    if (!bytes.length) return fail(filename, "That file is empty.");
    if (bytes.length > MAX_FILE_BYTES) {
      return fail(filename, "That file is over 3 MB. Export a smaller PDF or split it.");
    }

    if (upload.mediaType === "text/csv") {
      if (kind !== "summary") {
        return fail(
          filename,
          "Only the payroll summary can be a CSV. The bill and the certificates need to be PDFs.",
        );
      }
      const text = bytes.toString("utf8").replace(/^/, "");
      if (text.length > MAX_CSV_CHARS) {
        return fail(
          filename,
          "That CSV is too long for a summary. Export the summary by person or role and class code, not every check.",
        );
      }
      const verdict = screenCsv(text);
      if (!verdict.ok) return refuse(filename, verdict.reason, verdict.message);
      const extract = await structured(
        SummaryExtractSchema,
        SUMMARY_SYSTEM,
        [
          {
            type: "document",
            source: { type: "text", media_type: "text/plain", data: text },
            title: filename,
          },
          { type: "text", text: `Read "${filename}" and fill the schema from what it shows.` },
        ],
        "the payroll summary",
      );
      return finishSummary(filename, extract);
    }

    if (!isPdf(bytes)) return fail(filename, "That file is not a PDF.");
    const layer = await pdfTextLayer(new Uint8Array(bytes));
    if (layer) {
      if (layer.pages > MAX_PAGES[kind]) {
        return fail(
          filename,
          `${filename} runs ${layer.pages} pages. The limit here is ${MAX_PAGES[kind]}. Send only the audit pages.`,
        );
      }
      const verdict = screenText(layer.text, kind);
      if (!verdict.ok) return refuse(filename, verdict.reason, verdict.message);
    }
    const content: Content = [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: upload.base64 },
        title: filename,
      },
      { type: "text", text: `Read "${filename}" and fill the schema from what it shows.` },
    ];
    if (kind === "bill") {
      return finishBill(
        filename,
        await structured(BillExtractSchema, BILL_SYSTEM, content, "the audit bill"),
      );
    }
    if (kind === "summary") {
      return finishSummary(
        filename,
        await structured(SummaryExtractSchema, SUMMARY_SYSTEM, content, "the payroll summary"),
      );
    }
    return finishCertificates(
      filename,
      await structured(CertificatesExtractSchema, CERT_SYSTEM, content, "the certificates"),
    );
  } catch (err) {
    return fail(filename, friendlyError(err));
  }
}

function finishBill(filename: string, extract: BillExtract): ExtractOutcome {
  if (extract.contains_ssn) return refuse(filename, "ssn", SSN_MESSAGE);
  if (extract.document_type === "records_request") {
    return refuse(filename, "records_request", RECORDS_REQUEST_MESSAGE);
  }
  if (extract.document_type === "payroll_register") {
    return refuse(
      filename,
      "register",
      "That file is a payroll register, not the audit bill. Upload the bill or the auditor's worksheet in this slot.",
    );
  }
  if (extract.document_type === "other") {
    return refuse(
      filename,
      "not_a_bill",
      "That file does not read as a premium audit bill or worksheet. Upload the carrier's audit bill, or the auditor's worksheet with the audited figures on it.",
    );
  }
  if (!extract.lines.length) {
    return fail(
      filename,
      "The bill came back with no line items. If the figures are on a separate worksheet or schedule, upload that page in this slot.",
    );
  }
  return { ok: true, kind: "bill", filename, extract };
}

function finishSummary(filename: string, extract: SummaryExtract): ExtractOutcome {
  if (extract.contains_ssn) return refuse(filename, "ssn", SSN_MESSAGE);
  if (extract.document_type === "payroll_register" || extract.looks_like_register) {
    return refuse(
      filename,
      "register",
      "That file reads as a payroll register, check by check. PremiumFlag needs the summary: person or role, state, class code, straight-time wages, overtime wages, overtime premium. Export that and try again.",
    );
  }
  if (extract.document_type === "other") {
    return refuse(
      filename,
      "not_a_summary",
      "That file does not read as a payroll summary. Export one by person or role, state, and class code, with straight-time and overtime wages.",
    );
  }
  if (!extract.rows.length) {
    return fail(
      filename,
      "The payroll summary came back with no rows. Check the export and try again.",
    );
  }
  return { ok: true, kind: "summary", filename, extract };
}

function finishCertificates(filename: string, extract: CertificatesExtract): ExtractOutcome {
  if (extract.contains_ssn) return refuse(filename, "ssn", SSN_MESSAGE);
  if (extract.document_type === "other" || !extract.certificates.length) {
    return refuse(
      filename,
      "not_a_certificate",
      `No certificate of insurance was found in ${filename}. Each certificate needs the insured name, the workers comp or general liability line, a policy number, and effective and expiration dates.`,
    );
  }
  return { ok: true, kind: "certificate", filename, extract };
}

/** Which summary rows and certificates belong to each bill line, judged on names only. */
export async function alignWithModel(
  bill: BillExtract,
  rows: SummaryRow[],
  certs: FlatCertificate[],
): Promise<Alignment> {
  const payload = {
    audit_period: { start: bill.audit_period_start, end: bill.audit_period_end },
    bill_lines: bill.lines.map((l) => ({
      id: l.id,
      description: l.description,
      category: l.category,
      class_code: l.class_code,
      state: l.state,
      entity_name: l.entity_name,
      notes: l.notes,
    })),
    summary_rows: rows.map((r) => ({
      id: r.id,
      name_or_role: r.name_or_role,
      state: r.state,
      class_code: r.class_code,
      is_owner_officer: r.is_owner_officer,
      is_subcontractor: r.is_subcontractor,
      has_overtime: (r.overtime_wages ?? 0) > 0 || (r.overtime_premium ?? 0) > 0,
    })),
    certificates: certs.map((c) => ({
      id: c.id,
      insured_name: c.insured_name,
      file: c.file,
      has_workers_comp: Boolean(c.wc_policy_number || c.wc_effective),
      has_general_liability: Boolean(c.gl_policy_number || c.gl_effective),
    })),
  };
  const out = await structured(
    AlignmentSchema,
    ALIGN_SYSTEM,
    [{ type: "text", text: JSON.stringify(payload, null, 1) }],
    "the match between the bill and the records",
    "medium",
  );
  const lineIds = new Set(bill.lines.map((l) => l.id));
  const rowIds = new Set(rows.map((r) => r.id));
  const certIds = new Set(certs.map((c) => c.id));
  return {
    lines: out.lines
      .filter((l) => lineIds.has(l.line_id))
      .map((l) => ({
        ...l,
        summary_row_ids: l.summary_row_ids.filter((id) => rowIds.has(id)),
        certificate_ids: l.certificate_ids.filter((id) => certIds.has(id)),
      })),
  };
}

export function friendlyError(err: unknown): string {
  if (err instanceof PremiumFlagError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return UNAVAILABLE_MESSAGE;
  if (err instanceof Anthropic.RateLimitError) {
    return "The reader is busy right now. Try again in a minute.";
  }
  if (err instanceof Anthropic.APIError) {
    console.error("[premiumflag] API error", err.status, err.message);
    return `Reading failed (${err.status ?? "network"}). Try again.`;
  }
  console.error("[premiumflag]", err);
  return "Reading failed. Try again.";
}
