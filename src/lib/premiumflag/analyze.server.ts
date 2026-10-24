import { autoAlign, mergeAlignments } from "./match.ts";
import { evaluate } from "./rules.ts";
import { alignWithModel, friendlyError } from "./extract.server";
import { newAnalysisId, signAnalysis } from "./sign.server";
import type {
  Analysis,
  BillExtract,
  CertificatesExtract,
  FlatCertificate,
  SummaryExtract,
} from "./types.ts";

export type AnalyzeInput = {
  bill: { filename: string; extract: BillExtract };
  summary: { filename: string; extract: SummaryExtract } | null;
  certificates: Array<{ filename: string; extract: CertificatesExtract }>;
};

export type AnalyzeOutcome =
  { ok: true; analysis: Analysis; sig: string } | { ok: false; missing: string[]; message: string };

export const MISSING_SUMMARY =
  "The payroll summary is missing. Without it there is nothing to compare the bill to.";
export const MISSING_CERTIFICATES =
  "The bill counts subcontractors and there are no certificates in the upload. Add the workers comp or general liability certificates for those subs. A sub who never had one is owed.";

export async function analyze(input: AnalyzeInput): Promise<AnalyzeOutcome> {
  const bill: BillExtract = {
    ...input.bill.extract,
    lines: input.bill.extract.lines.map((l, i) => ({ ...l, id: `L${i + 1}` })),
  };
  if (bill.document_type !== "audit_bill" && bill.document_type !== "audit_worksheet") {
    return {
      ok: false,
      missing: [],
      message:
        "The file in the bill slot is not an audit bill or worksheet. Start over with the bill.",
    };
  }
  if (!bill.lines.length) {
    return { ok: false, missing: [], message: "The bill has no line items to compare." };
  }
  if (!input.summary) return { ok: false, missing: ["payroll summary"], message: MISSING_SUMMARY };

  const summary: SummaryExtract = {
    ...input.summary.extract,
    rows: input.summary.extract.rows.map((r, i) => ({ ...r, id: `R${i + 1}` })),
  };
  const certificates: FlatCertificate[] = input.certificates.flatMap((f, fi) =>
    f.extract.certificates.map((c, ci) => ({ ...c, id: `C${fi + 1}-${ci + 1}`, file: f.filename })),
  );
  const hasSubLines = bill.lines.some(
    (l) =>
      l.category === "subcontractor" ||
      l.basis === "subcontract_cost" ||
      l.basis === "total_contract",
  );
  if (hasSubLines && certificates.length === 0) {
    return { ok: false, missing: ["certificates"], message: MISSING_CERTIFICATES };
  }

  let alignment = autoAlign(bill, summary.rows, certificates);
  if (summary.rows.length || certificates.length) {
    try {
      alignment = mergeAlignments(
        alignment,
        await alignWithModel(bill, summary.rows, certificates),
      );
    } catch (err) {
      return { ok: false, missing: [], message: friendlyError(err) };
    }
  }

  const evaluation = evaluate({
    bill,
    summary,
    certificates,
    alignment,
    files: {
      bill: input.bill.filename,
      summary: input.summary.filename,
      certificates: input.certificates.map((c) => c.filename),
    },
  });
  const analysis: Analysis = {
    id: newAnalysisId(),
    version: 1,
    createdAt: new Date().toISOString(),
    ...evaluation,
  };
  return { ok: true, analysis, sig: signAnalysis(analysis) };
}
