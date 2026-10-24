import { useEffect, useRef, useState } from "react";
import { analyzeBillFn, extractDocumentFn, unlockEmailFn } from "@/lib/premiumflag/server";
import type { Analysis } from "@/lib/premiumflag/types";
import { fmtDate, money } from "@/lib/premiumflag/match";
import { MAX_CERTIFICATE_FILES, MAX_FILE_BYTES, MAX_ZIP_BYTES } from "@/lib/premiumflag/limits";
import { TOO_MANY_CERTIFICATES, unpackCertificateZip } from "@/lib/premiumflag/zip";
import { EMAIL, EMAIL_LABEL, PREMIUMFLAG_PRICE, PREMIUMFLAG_STRIPE_URL } from "@/lib/site";

const STORAGE_KEY = "premiumflag.result.v1";

type Stored = { analysis: Analysis; sig: string };
type DocKind = "bill" | "summary" | "certificate";
type DocState = "queued" | "reading" | "done" | "refused" | "error";
type Doc = { key: string; kind: DocKind; filename: string; state: DocState; message?: string };
type Prepared = {
  kind: DocKind;
  filename: string;
  mediaType: "application/pdf" | "text/csv";
  base64: string;
};
type Phase =
  | { kind: "idle" }
  | { kind: "working"; step: "reading" | "comparing" }
  | { kind: "stopped"; title: string; messages: string[] }
  | { kind: "result"; stored: Stored };
type Unlock =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "unlocked"; subject: string; body: string }
  | { kind: "failed"; message: string };

function loadStored(): Stored | null {
  try {
    const raw =
      window.sessionStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function saveStored(stored: Stored | null) {
  try {
    if (!stored) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const raw = JSON.stringify(stored);
    window.sessionStorage.setItem(STORAGE_KEY, raw);
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Storage can be blocked. The page still works for this tab.
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function fileToBase64(file: File): Promise<string> {
  return bytesToBase64(new Uint8Array(await file.arrayBuffer()));
}

function isCsv(file: File): boolean {
  return /\.csv$/i.test(file.name) || file.type === "text/csv";
}

function isZip(file: File): boolean {
  return /\.zip$/i.test(file.name);
}

/** Every certificate as its own read, capped before any read starts. */
async function prepareCertificates(files: File[]): Promise<Prepared[]> {
  const out: Prepared[] = [];
  for (const f of files) {
    if (isZip(f)) {
      if (f.size > MAX_ZIP_BYTES) {
        throw new Error(
          `${f.name} is over ${MAX_ZIP_BYTES / (1024 * 1024)} MB. Zip only the certificates for this bill.`,
        );
      }
      const data = new Uint8Array(await f.arrayBuffer());
      for (const entry of unpackCertificateZip(f.name, data, out.length)) {
        out.push({
          kind: "certificate",
          filename: entry.name,
          mediaType: "application/pdf",
          base64: bytesToBase64(entry.bytes),
        });
      }
    } else {
      if (out.length >= MAX_CERTIFICATE_FILES) throw new Error(TOO_MANY_CERTIFICATES);
      out.push({
        kind: "certificate",
        filename: f.name,
        mediaType: "application/pdf",
        base64: await fileToBase64(f),
      });
    }
  }
  return out;
}

export function PremiumFlagTool({ sessionId }: { sessionId?: string }) {
  const [billFile, setBillFile] = useState<File | null>(null);
  const [summaryFile, setSummaryFile] = useState<File | null>(null);
  const [certFiles, setCertFiles] = useState<File[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [unlock, setUnlock] = useState<Unlock>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Coming back from Stripe (session_id in the URL) or reloading: restore the result.
  useEffect(() => {
    const stored = loadStored();
    if (!sessionId) {
      if (stored) setPhase({ kind: "result", stored });
      return;
    }
    if (!stored) {
      setUnlock({
        kind: "failed",
        message:
          "This browser has no bill on file. The result lives in the browser that ran it. Open this link there, or run the bill again and pay from that page.",
      });
      return;
    }
    setPhase({ kind: "result", stored });
    setUnlock({ kind: "checking" });
    let cancelled = false;
    unlockEmailFn({ data: { sessionId, analysis: stored.analysis, sig: stored.sig } })
      .then((r) => {
        if (cancelled) return;
        setUnlock(
          r.ok
            ? { kind: "unlocked", subject: r.subject, body: r.body }
            : { kind: "failed", message: r.message },
        );
      })
      .catch(() => {
        if (cancelled) return;
        setUnlock({
          kind: "failed",
          message: `Couldn't reach the server to confirm the payment. Reload this page in a minute. If it still fails, email ${EMAIL_LABEL} with your Stripe receipt.`,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const setDoc = (key: string, state: DocState, message?: string) =>
    setDocs((prev) => prev.map((d) => (d.key === key ? { ...d, state, message } : d)));

  async function run() {
    if (!billFile || !summaryFile) return;
    setUnlock({ kind: "idle" });
    saveStored(null);
    for (const f of [billFile, summaryFile, ...certFiles.filter((c) => !isZip(c))]) {
      if (f.size > MAX_FILE_BYTES) {
        setPhase({
          kind: "stopped",
          title: "That file is too big",
          messages: [`${f.name} is over 3 MB. Export a smaller PDF or split it.`],
        });
        return;
      }
    }
    setPhase({ kind: "working", step: "reading" });

    let prepared: Prepared[];
    try {
      prepared = [
        {
          kind: "bill",
          filename: billFile.name,
          mediaType: "application/pdf",
          base64: await fileToBase64(billFile),
        },
        {
          kind: "summary",
          filename: summaryFile.name,
          mediaType: isCsv(summaryFile) ? "text/csv" : "application/pdf",
          base64: await fileToBase64(summaryFile),
        },
        ...(await prepareCertificates(certFiles)),
      ];
    } catch (err) {
      setPhase({
        kind: "stopped",
        title: "Couldn't open a file",
        messages: [err instanceof Error ? err.message : "One of the files could not be opened."],
      });
      return;
    }

    const queue: Doc[] = prepared.map((p, i) => ({
      key: `${p.kind}-${i}`,
      kind: p.kind,
      filename: p.filename,
      state: "queued",
    }));
    setDocs(queue);

    const results = await Promise.all(
      prepared.map(async (p, i) => {
        const key = queue[i].key;
        setDoc(key, "reading");
        try {
          const r = await extractDocumentFn({ data: p });
          if (r.ok) setDoc(key, "done");
          else setDoc(key, r.refused ? "refused" : "error", r.message);
          return r;
        } catch (err) {
          const message =
            err instanceof Error && err.message ? err.message : "The server did not answer.";
          setDoc(key, "error", message);
          return { ok: false as const, refused: false as const, filename: p.filename, message };
        }
      }),
    );

    const refused = results.filter((r) => !r.ok && r.refused);
    if (refused.length) {
      setPhase({
        kind: "stopped",
        title: "Stopped before reading",
        messages: refused.map((r) => `${r.filename}: ${r.message}`),
      });
      return;
    }
    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      setPhase({
        kind: "stopped",
        title: "Couldn't read a file",
        messages: failed.map((r) => `${r.filename}: ${r.message}`),
      });
      return;
    }

    const bill = results.find((r) => r.ok && r.kind === "bill");
    const summary = results.find((r) => r.ok && r.kind === "summary");
    if (
      !bill ||
      !bill.ok ||
      bill.kind !== "bill" ||
      !summary ||
      !summary.ok ||
      summary.kind !== "summary"
    ) {
      setPhase({ kind: "stopped", title: "Couldn't read the files", messages: ["Try again."] });
      return;
    }
    const certificates = results.flatMap((r) =>
      r.ok && r.kind === "certificate" ? [{ filename: r.filename, extract: r.extract }] : [],
    );

    setPhase({ kind: "working", step: "comparing" });
    try {
      const a = await analyzeBillFn({
        data: {
          bill: { filename: bill.filename, extract: bill.extract },
          summary: { filename: summary.filename, extract: summary.extract },
          certificates,
        },
      });
      if (!a.ok) {
        setPhase({
          kind: "stopped",
          title: a.missing.length ? "Something is missing" : "Couldn't compare the bill",
          messages: [a.message],
        });
        return;
      }
      const stored = { analysis: a.analysis, sig: a.sig };
      saveStored(stored);
      setPhase({ kind: "result", stored });
    } catch {
      setPhase({
        kind: "stopped",
        title: "Couldn't compare the bill",
        messages: ["The server did not answer. Try again."],
      });
    }
  }

  function reset() {
    setPhase({ kind: "idle" });
    setDocs([]);
    setUnlock({ kind: "idle" });
    setCopied(false);
    saveStored(null);
    setBillFile(null);
    setSummaryFile(null);
    setCertFiles([]);
    formRef.current?.reset();
  }

  async function copyEmail(subject: string, body: string) {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  const ready = Boolean(billFile && summaryFile) && phase.kind !== "working";

  return (
    <div>
      <form
        ref={formRef}
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <span className="panel-label">Review a bill</span>
        <h2>Three files. Nothing to log into.</h2>
        <div className="grid gap-5 md:grid-cols-3" style={{ marginTop: 18 }}>
          <FileField
            id="pf-bill"
            label="1. The audit bill"
            hint="The bill, or the auditor's worksheet with the figures on it. PDF."
            accept="application/pdf,.pdf"
            files={billFile ? [billFile] : []}
            onChange={(fs) => setBillFile(fs[0] ?? null)}
          />
          <FileField
            id="pf-summary"
            label="2. Payroll summary"
            hint="By person or role, state, class code, straight time, overtime, overtime premium. A CSV, or a PDF with text. Not a register, not a scan."
            accept=".csv,text/csv,application/pdf,.pdf"
            files={summaryFile ? [summaryFile] : []}
            onChange={(fs) => setSummaryFile(fs[0] ?? null)}
          />
          <FileField
            id="pf-certs"
            label="3. Certificates for subs"
            hint="Workers comp or general liability certificates, up to 60. PDFs, or a zip of PDFs. Skip only if the bill names no subs."
            accept="application/pdf,.pdf,.zip,application/zip"
            multiple
            files={certFiles}
            onChange={setCertFiles}
          />
        </div>
        <p className="form-fine">
          Up to 3 MB a file. No Social Security numbers. A CSV or a PDF with text is checked for
          them before anything reads it, and the payroll summary has to be one of those. A scanned
          bill or certificate is checked by the reader, which refuses it if it finds one. We
          don&apos;t keep the files: each is read once to produce the result.
        </p>
        <div className="cta-row" style={{ marginBottom: 0 }}>
          <button type="submit" className="pf-button button button-primary" disabled={!ready}>
            {phase.kind === "working" ? "Working…" : "Read the bill"}
          </button>
          {phase.kind !== "idle" && (
            <button
              type="button"
              className="pf-button button button-secondary dark"
              onClick={reset}
            >
              Start over
            </button>
          )}
        </div>
      </form>

      {phase.kind === "working" && (
        <div className="panel" style={{ marginTop: 24 }} aria-live="polite">
          <span className="panel-label">{phase.step === "reading" ? "Reading" : "Comparing"}</span>
          <h2>
            {phase.step === "reading"
              ? "Reading the files. This takes a minute or two."
              : "Lining the bill up against the records."}
          </h2>
          <ul className="detail-list" style={{ marginTop: 12 }}>
            {docs.map((d) => (
              <li key={d.key}>
                <strong>{d.filename}</strong>: {describe(d)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {phase.kind === "stopped" && (
        <div className="notice" style={{ marginTop: 24 }} role="alert">
          <p>
            <strong>{phase.title}.</strong>
          </p>
          {phase.messages.map((m, i) => (
            <p key={i} style={{ marginTop: 8 }}>
              {m}
            </p>
          ))}
        </div>
      )}

      {phase.kind !== "result" && unlock.kind === "failed" && (
        <div className="notice" style={{ marginTop: 24 }} role="alert">
          <p>{unlock.message}</p>
        </div>
      )}

      {phase.kind === "result" && (
        <Result
          analysis={phase.stored.analysis}
          unlock={unlock}
          copied={copied}
          onCopy={copyEmail}
        />
      )}
    </div>
  );
}

function describe(d: Doc): string {
  switch (d.state) {
    case "queued":
      return "waiting";
    case "reading":
      return d.kind === "bill"
        ? "reading the bill"
        : d.kind === "summary"
          ? "reading the summary"
          : "reading the certificate";
    case "done":
      return "read";
    case "refused":
      return `refused. ${d.message ?? ""}`;
    case "error":
      return `failed. ${d.message ?? ""}`;
  }
}

function FileField({
  id,
  label,
  hint,
  accept,
  multiple,
  files,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  accept: string;
  multiple?: boolean;
  files: File[];
  onChange: (files: File[]) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-semibold" style={{ color: "var(--navy)" }}>
        {label}
      </label>
      <p className="text-sm" style={{ color: "var(--body)", margin: "4px 0 10px" }}>
        {hint}
      </p>
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        className="block w-full text-sm"
        onChange={(e) => onChange(Array.from(e.currentTarget.files ?? []))}
      />
      {files.length > 1 && (
        <p className="text-sm" style={{ color: "var(--muted)", marginTop: 6 }}>
          {files.length} files chosen.
        </p>
      )}
    </div>
  );
}

function Result({
  analysis: a,
  unlock,
  copied,
  onCopy,
}: {
  analysis: Analysis;
  unlock: Unlock;
  copied: boolean;
  onCopy: (subject: string, body: string) => void;
}) {
  const payHref = PREMIUMFLAG_STRIPE_URL
    ? `${PREMIUMFLAG_STRIPE_URL}${
        PREMIUMFLAG_STRIPE_URL.includes("?") ? "&" : "?"
      }client_reference_id=${encodeURIComponent(a.id)}`
    : "";
  const period =
    a.auditPeriodStart && a.auditPeriodEnd
      ? `${fmtDate(a.auditPeriodStart)} to ${fmtDate(a.auditPeriodEnd)}`
      : "audit period not read";

  return (
    <div style={{ marginTop: 24 }}>
      <div className="panel">
        <span className="panel-label">The result</span>
        <h2>
          {a.allPay
            ? "Every line matches your records. Pay the bill."
            : `${a.flaggedCount} ${a.flaggedCount === 1 ? "line does" : "lines do"} not match the records.`}
        </h2>
        <p>
          {a.carrier ?? "Carrier"} · policy {a.policyNumber ?? "not read"} · {period}
          {a.insuredName ? ` · ${a.insuredName}` : ""}
        </p>
        {a.allPay ? (
          <div className="notice" style={{ marginTop: 16 }}>
            <p>
              <strong>There is no email to buy. You owe us $0.</strong> Payroll grew, or the subs on
              the bill had no certificate in the upload. Nothing you uploaded contradicts a line.
            </p>
          </div>
        ) : (
          <div className="notice" style={{ marginTop: 16 }}>
            <p>
              {a.disputedPremium != null && (
                <>
                  <strong>{money(a.disputedPremium)} of premium is in dispute</strong>
                  {a.premiumKnownForAllFlags
                    ? ". "
                    : " on the lines where the bill shows a rate or a premium. "}
                </>
              )}
              {a.disputedExposure > 0 && (
                <>{money(a.disputedExposure)} of audited payroll or cost is in question. </>
              )}
              {a.undisputedPremium != null && (
                <>The rest of the bill, {money(a.undisputedPremium)}, is not in dispute.</>
              )}
            </p>
          </div>
        )}
        {a.warnings.length > 0 && (
          <ul className="detail-list" style={{ marginTop: 16 }}>
            {a.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="table-wrap" style={{ marginTop: 24 }}>
        <table>
          <thead>
            <tr>
              <th>Line</th>
              <th>Carrier used</th>
              <th>Records support</th>
              <th>Call</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {a.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  <strong style={{ color: "var(--navy)" }}>{l.description}</strong>
                  {l.entityName &&
                    !l.description.toLowerCase().includes(l.entityName.toLowerCase()) && (
                      <>
                        <br />
                        {l.entityName}
                      </>
                    )}
                  {l.classCode && (
                    <>
                      <br />
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.78rem" }}>
                        class {l.classCode}
                      </span>
                    </>
                  )}
                </td>
                <td>
                  {money(l.carrierAmount)}
                  {l.carrierPremium != null && (
                    <>
                      <br />
                      <span className="text-sm">{money(l.carrierPremium)} premium</span>
                    </>
                  )}
                </td>
                <td>{l.partial ? "Part of it" : money(l.ourAmount)}</td>
                <td>
                  <Call label={l.label} />
                </td>
                <td>
                  {l.reason}
                  {l.proof && (
                    <>
                      <br />
                      <span className="text-sm">
                        Proof: {l.proof.detail} ({l.proof.file})
                      </span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!a.allPay && (
        <article className="panel" style={{ marginTop: 24 }}>
          <span className="panel-label">The email</span>
          {unlock.kind === "unlocked" ? (
            <>
              <h2>Send this to the carrier.</h2>
              <p>
                <strong>Subject:</strong> {unlock.subject}
              </p>
              <textarea
                readOnly
                value={unlock.body}
                rows={20}
                className="mt-3 w-full rounded-xl border p-4 text-sm"
                style={{
                  borderColor: "var(--border)",
                  fontFamily: "'DM Mono', monospace",
                  color: "var(--text)",
                  background: "var(--cream)",
                }}
              />
              <div className="cta-row" style={{ marginBottom: 0 }}>
                <button
                  type="button"
                  className="pf-button button button-primary"
                  onClick={() => onCopy(unlock.subject, unlock.body)}
                >
                  {copied ? "Copied" : "Copy the email"}
                </button>
              </div>
              <p className="form-fine">
                It goes from your email, not ours. Attach the certificates and the payroll summary
                you uploaded here. Pay the lines that are not in dispute by the due date.
              </p>
            </>
          ) : unlock.kind === "checking" ? (
            <>
              <h2>Confirming the payment with Stripe.</h2>
              <p>One moment.</p>
            </>
          ) : (
            <>
              <h2>The email that asks for a revised audit is written.</h2>
              <p>
                It names the policy and the audit period, lists only the flagged lines with the
                carrier's figure, your figure, the reason, and the document that proves it, asks for
                a revised audit in writing, and says you will pay the rest. ${PREMIUMFLAG_PRICE}{" "}
                once, for this bill. Not a subscription. Charges appear as FRAMEWORK SYSTEMS.
              </p>
              {unlock.kind === "failed" && (
                <div className="notice" style={{ marginTop: 12, marginBottom: 12 }} role="alert">
                  <p>{unlock.message}</p>
                </div>
              )}
              <div className="cta-row" style={{ marginBottom: 0 }}>
                {payHref ? (
                  <a href={payHref} className="pf-button button button-primary">
                    Unlock the email — ${PREMIUMFLAG_PRICE}
                  </a>
                ) : (
                  <button type="button" className="pf-button button button-primary" disabled>
                    Unlock the email — ${PREMIUMFLAG_PRICE}
                  </button>
                )}
              </div>
              <p className="form-fine">
                {payHref
                  ? "Pay from this browser. The result is kept here, not on our server, and the unlock comes back to this page."
                  : `The payment link is not live yet. Email ${EMAIL_LABEL} with the subject PremiumFlag and we will send the email by hand.`}{" "}
                {!payHref && (
                  <a href={`${EMAIL}?subject=PremiumFlag`} style={{ color: "var(--accent)" }}>
                    Email {EMAIL_LABEL}
                  </a>
                )}
              </p>
            </>
          )}
        </article>
      )}
    </div>
  );
}

function Call({ label }: { label: "pay" | "flag" }) {
  const flag = label === "flag";
  return (
    <span
      className="inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase"
      style={{
        background: flag ? "rgba(157, 59, 26, 0.12)" : "rgba(47, 107, 79, 0.12)",
        color: flag ? "var(--color-fail)" : "var(--color-pass)",
        fontFamily: "'DM Mono', monospace",
      }}
    >
      {flag ? "Flag" : "Pay"}
    </span>
  );
}
