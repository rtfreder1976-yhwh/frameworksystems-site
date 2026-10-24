/**
 * PremiumFlag file screening. Deterministic. Runs before any file reaches the model.
 *
 * Two refusals, both from the handoff: a file with Social Security numbers in it, and a
 * payroll register (check-level detail) sent in place of a payroll summary.
 */

export type ScreenReason = "ssn" | "register" | "scanned";
export type ScreenVerdict = { ok: true } | { ok: false; reason: ScreenReason; message: string };

export const SSN_MESSAGE =
  "That file has Social Security numbers in it. PremiumFlag does not take those. Remove the column, export again, or send a summary by class code.";

export const REGISTER_MESSAGE =
  "That file reads as a payroll register, check by check. PremiumFlag needs the summary: person or role, state, class code, straight-time wages, overtime wages, overtime premium. Export that and try again.";

const SSN_DASHED = /\b\d{3}-\d{2}-\d{4}\b/;
const SSN_SPACED = /\b\d{3} \d{2} \d{4}\b/;
const SSN_LABEL =
  /(?:^|[^a-z])(?:ssn|ss\s?#|ss\s*no\.?|social\s*security|soc(?:ial)?\.?\s*sec(?:urity)?\.?)(?:\s*(?:no|num|number|#))?(?:$|[^a-z])/i;
const SSN_LABEL_THEN_DIGITS =
  /(?:ssn|ss\s?#|social\s*security|soc\.?\s*sec\.?)(?:\s*(?:no|num|number|#))?[^\n\r0-9]{0,40}\d{9}\b/i;
const MASKED_SSN = /(?:\*{3}|x{3})[- ]?(?:\*{2}|x{2})[- ]?\d{4}/i;
const BARE_SSN_VALUE = /^\d{3}-?\d{2}-?\d{4}$/;

/** True when the text carries a Social Security number in any common layout. */
export function hasSsn(text: string): boolean {
  return SSN_DASHED.test(text) || SSN_SPACED.test(text) || SSN_LABEL_THEN_DIGITS.test(text);
}

/** Column names that only a check-level register carries. One is enough. */
const HARD_REGISTER: RegExp[] = [
  /\bnet\s*pay\b/i,
  /\bnet\s*(?:amount|wages|check)\b/i,
  /\bcheck\s*(?:no|num|number|#)\b/i,
  /\bcheck\s*date\b/i,
  /\bdeductions?\b/i,
  /\b(?:federal|fed|fit|fica|medicare|state|sit|sui|suta|futa)\s*(?:w\/?h|withholding|tax(?:es)?)\b/i,
  /\bdirect\s*deposit\b/i,
  /\bgross\s*to\s*net\b/i,
  /\b401\s*\(?k\)?\b/i,
  /\bgarnish/i,
];

/** Column names a register usually has and a summary sometimes has. Two together decide. */
const SOFT_REGISTER: RegExp[] = [
  /\bpay\s*date\b/i,
  /\bemployee\s*(?:id|#|no\.?|number)\b/i,
  /\bcheck\b/i,
  /\bpay\s*period\b/i,
];

export function registerSignals(cells: string[]): { hard: string[]; soft: string[] } {
  const hard: string[] = [];
  const soft: string[] = [];
  for (const cell of cells) {
    const c = cell.trim();
    if (!c) continue;
    if (HARD_REGISTER.some((re) => re.test(c))) hard.push(c);
    else if (SOFT_REGISTER.some((re) => re.test(c))) soft.push(c);
  }
  return { hard, soft };
}

export function headerLooksLikeRegister(header: string[]): boolean {
  const { hard, soft } = registerSignals(header);
  return hard.length >= 1 || soft.length >= 2;
}

/** Free text (a PDF text layer): two distinct register-only terms decide. */
export function textLooksLikeRegister(text: string): boolean {
  let distinct = 0;
  for (const re of HARD_REGISTER) if (re.test(text)) distinct += 1;
  return distinct >= 2;
}

export function detectDelimiter(firstLine: string): string {
  const candidates = [",", "\t", ";", "|"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/** Small RFC 4180 reader: quotes, doubled quotes, CRLF, any single-character delimiter. */
export function parseCsv(input: string, delimiter?: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = delimiter ?? detectDelimiter(firstLine);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === delim) {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Screen a payroll summary sent as CSV (or any delimited text). */
export function screenCsv(text: string): ScreenVerdict {
  const rows = parseCsv(text);
  if (rows.length === 0) return { ok: true };
  const header = (rows[0] ?? []).map((h) => h.trim());
  const ssnColumns = header
    .map((h, i) => (SSN_LABEL.test(` ${h} `) ? i : -1))
    .filter((i) => i >= 0);
  let masked = false;
  for (const col of ssnColumns) {
    for (const r of rows.slice(1)) {
      const v = (r[col] ?? "").trim();
      if (BARE_SSN_VALUE.test(v)) return { ok: false, reason: "ssn", message: SSN_MESSAGE };
      if (MASKED_SSN.test(v)) masked = true;
    }
  }
  if (hasSsn(text)) return { ok: false, reason: "ssn", message: SSN_MESSAGE };
  if (masked || headerLooksLikeRegister(header)) {
    return { ok: false, reason: "register", message: REGISTER_MESSAGE };
  }
  return { ok: true };
}

export const UNREADABLE_SUMMARY_MESSAGE =
  "That PDF could not be opened to check it for Social Security numbers. Export the payroll summary again, as a CSV or as a PDF with text.";

function scannedSummaryMessage(pages: number[]): string {
  const which =
    pages.length === 1
      ? `Page ${pages[0]} has no text to check for Social Security numbers, so it looks scanned.`
      : `Pages ${pages.join(", ")} have no text to check for Social Security numbers, so they look scanned.`;
  return `${which} Export the payroll summary from your payroll system as a CSV, or as a PDF with text.`;
}

/** Pages with (almost) no text of their own: a scan, or a picture of a page. */
export function pagesWithoutText(pageTexts: string[]): number[] {
  return pageTexts.flatMap((t, i) => (t.replace(/\s+/g, "").length < 20 ? [i + 1] : []));
}

/**
 * Screen a PDF by its text layer, page by page. The payroll summary is where registers and
 * Social Security numbers turn up, so every page of it has to be checkable before it is read:
 * a scanned page, or a file that won't open, is refused. A scanned bill or certificate goes on
 * to the reader, whose own contains_ssn check refuses it after the read.
 */
export function screenPdf(
  pageTexts: string[] | null,
  kind: "bill" | "summary" | "certificate",
): ScreenVerdict {
  if (kind === "summary") {
    if (pageTexts == null) {
      return { ok: false, reason: "scanned", message: UNREADABLE_SUMMARY_MESSAGE };
    }
    const blank = pagesWithoutText(pageTexts);
    if (blank.length) {
      return { ok: false, reason: "scanned", message: scannedSummaryMessage(blank) };
    }
  }
  if (pageTexts == null) return { ok: true };
  return screenText(pageTexts.join("\n"), kind);
}

/** Screen a PDF's text layer. The register test only applies to the payroll summary slot. */
export function screenText(text: string, kind: "bill" | "summary" | "certificate"): ScreenVerdict {
  if (hasSsn(text)) return { ok: false, reason: "ssn", message: SSN_MESSAGE };
  if (kind === "summary" && (MASKED_SSN.test(text) || textLooksLikeRegister(text))) {
    return { ok: false, reason: "register", message: REGISTER_MESSAGE };
  }
  return { ok: true };
}
