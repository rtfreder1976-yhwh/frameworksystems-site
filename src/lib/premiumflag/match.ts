import type { Alignment, BillExtract, BillLine, FlatCertificate, SummaryRow } from "./types.ts";

/** Helpers shared by the rules engine, the email, and the page: names, dates, money. */

const NAME_NOISE = new Set([
  "llc",
  "l.l.c",
  "inc",
  "incorporated",
  "co",
  "corp",
  "corporation",
  "company",
  "ltd",
  "limited",
  "lp",
  "llp",
  "pllc",
  "dba",
  "the",
  "and",
  "&",
  "of",
]);

export function normalizeName(s: string): string {
  const tokens = s
    .toLowerCase()
    .replace(/[.,'’"()]/g, " ")
    .replace(/[^a-z0-9& ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !NAME_NOISE.has(t));
  // "A.B.C. Roofing" and "ABC Roofing" are the same name: fold runs of single letters.
  const merged: string[] = [];
  let run = "";
  for (const t of tokens) {
    if (t.length === 1) {
      run += t;
      continue;
    }
    if (run) {
      merged.push(run);
      run = "";
    }
    merged.push(t);
  }
  if (run) merged.push(run);
  return merged.join(" ");
}

export function nameTokens(s: string): string[] {
  return normalizeName(s).split(" ").filter(Boolean);
}

/** Same party? Tolerates punctuation, legal suffixes, initials, and a longer trade name. */
export function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ta = new Set(nameTokens(a));
  const tb = new Set(nameTokens(b));
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  if (small.size === 0) return false;
  let hits = 0;
  for (const t of small) {
    if (big.has(t)) hits += 1;
    else if (t.length === 1 && [...big].some((x) => x.startsWith(t))) hits += 1;
  }
  if (hits === small.size && small.size >= 2) return true;
  const union = new Set([...ta, ...tb]).size;
  return union > 0 && hits / union >= 0.6;
}

/** First four digits of a class code, so "5645" and "5645-01" compare equal. */
export function sameClassCode(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const da = a.replace(/\D/g, "").slice(0, 4);
  const db = b.replace(/\D/g, "").slice(0, 4);
  return da.length === 4 && da === db;
}

/** Parse a date to a UTC day timestamp. Accepts YYYY-MM-DD, M/D/YYYY, M/D/YY, and Date.parse. */
export function parseDate(s: string | null | undefined): number | null {
  if (!s) return null;
  const v = s.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(v);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return Date.UTC(y, Number(m[1]) - 1, Number(m[2]));
  }
  const t = Date.parse(v);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

export type Coverage = "full" | "partial" | "none" | "unknown";

/** How a certificate's effective/expiration window sits against the audit period. */
export function coverage(
  effective: string | null | undefined,
  expiration: string | null | undefined,
  periodStart: string | null | undefined,
  periodEnd: string | null | undefined,
): Coverage {
  const e = parseDate(effective);
  const x = parseDate(expiration);
  const s = parseDate(periodStart);
  const n = parseDate(periodEnd);
  if (e == null || x == null || s == null || n == null) return "unknown";
  if (x < s || e > n) return "none";
  if (e <= s && x >= n) return "full";
  return "partial";
}

export type PeriodFit = "match" | "partial" | "mismatch" | "unknown";

const DAY_MS = 86_400_000;

/**
 * How the payroll summary's dates sit against the audit period. Within a month at each end is
 * the same period; overlapping otherwise is partial; no overlap is a mismatch.
 */
export function periodFit(
  summaryStart: string | null | undefined,
  summaryEnd: string | null | undefined,
  auditStart: string | null | undefined,
  auditEnd: string | null | undefined,
): PeriodFit {
  const s = parseDate(summaryStart);
  const e = parseDate(summaryEnd);
  const as = parseDate(auditStart);
  const ae = parseDate(auditEnd);
  if (s == null || e == null || as == null || ae == null || e < s || ae < as) return "unknown";
  if (Math.abs(s - as) <= 31 * DAY_MS && Math.abs(e - ae) <= 31 * DAY_MS) return "match";
  return Math.min(e, ae) - Math.max(s, as) > 0 ? "partial" : "mismatch";
}

const pad = (n: number) => String(n).padStart(2, "0");

export function fmtDate(s: string | null | undefined): string {
  const t = parseDate(s);
  if (t == null) return s?.trim() || "an unreadable date";
  const d = new Date(t);
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${d.getUTCFullYear()}`;
}

export function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Deterministic alignment: a conservative name/class-code match. The model's alignment is
 * merged over this, so a miss on either side still lands.
 */
export function autoAlign(
  bill: BillExtract,
  rows: SummaryRow[],
  certs: FlatCertificate[],
): Alignment {
  return {
    lines: bill.lines.map((line) => ({
      line_id: line.id,
      summary_row_ids: rowsForLine(line, rows).map((r) => r.id),
      certificate_ids: line.entity_name
        ? certs.filter((c) => namesMatch(c.insured_name, line.entity_name)).map((c) => c.id)
        : [],
      note: null,
    })),
  };
}

function rowsForLine(line: BillLine, rows: SummaryRow[]): SummaryRow[] {
  if (line.entity_name) {
    return rows.filter((r) => namesMatch(r.name_or_role, line.entity_name));
  }
  if (line.class_code) {
    return rows.filter(
      (r) =>
        sameClassCode(r.class_code, line.class_code) &&
        (!line.state ||
          !r.state ||
          r.state.trim().toUpperCase() === line.state.trim().toUpperCase()),
    );
  }
  if (line.category === "overtime") {
    return rows.filter((r) => (r.overtime_premium ?? 0) > 0 || (r.overtime_wages ?? 0) > 0);
  }
  return [];
}

export function mergeAlignments(a: Alignment, b: Alignment): Alignment {
  const byLine = new Map<string, { rows: Set<string>; certs: Set<string>; notes: string[] }>();
  for (const src of [a, b]) {
    for (const l of src.lines) {
      const cur = byLine.get(l.line_id) ?? { rows: new Set(), certs: new Set(), notes: [] };
      l.summary_row_ids.forEach((id) => cur.rows.add(id));
      l.certificate_ids.forEach((id) => cur.certs.add(id));
      if (l.note) cur.notes.push(l.note);
      byLine.set(l.line_id, cur);
    }
  }
  return {
    lines: [...byLine.entries()].map(([line_id, v]) => ({
      line_id,
      summary_row_ids: [...v.rows],
      certificate_ids: [...v.certs],
      note: v.notes.length ? v.notes.join(" ") : null,
    })),
  };
}
