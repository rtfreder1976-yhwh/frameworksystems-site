import type { Analysis, AnalysisLine } from "./types.ts";
import { fmtDate, money } from "./match.ts";

/**
 * The dispute email. Plain text. The contractor sends it; PremiumFlag never contacts the carrier.
 *
 * It names the policy and the audit period, lists only the flagged lines (their figure, our
 * figure, the reason, the document that proves it), asks for a revised audit in writing, and
 * says the undisputed lines will be paid. It never claims the bill is on hold, never gives
 * coverage advice, and never promises the carrier will reduce the bill.
 */
export function composeEmail(a: Analysis): { subject: string; body: string } {
  const flags = a.lines.filter((l) => l.label === "flag");
  const policy = a.policyNumber ?? "[policy number]";
  const period =
    a.auditPeriodStart && a.auditPeriodEnd
      ? `${fmtDate(a.auditPeriodStart)} to ${fmtDate(a.auditPeriodEnd)}`
      : "[audit period]";
  const docWord = a.documentType === "audit_worksheet" ? "worksheet" : "bill";
  const subject = `Premium audit dispute - policy ${policy} - audit period ${period}`;

  const out: string[] = [];
  out.push(`To: ${a.carrier ? `${a.carrier} ` : ""}Premium Audit Department`);
  out.push("");
  out.push(
    `Re: Policy ${policy}, premium audit for ${period}${
      a.billDate ? `, ${docWord} dated ${fmtDate(a.billDate)}` : ""
    }`,
  );
  out.push("");
  out.push(
    `I have compared the audit ${docWord} to our payroll summary and the subcontractor certificates of insurance. ${
      flags.length === 1 ? "One line does" : `${flags.length} lines do`
    } not match those records. I am requesting a revised audit in writing on ${
      flags.length === 1 ? "that line" : "those lines"
    }. Every other line is not in dispute, and I will pay it${
      a.undisputedPremium != null ? ` (${money(a.undisputedPremium)})` : ""
    } by the due date on the ${docWord}.`,
  );
  out.push("");
  out.push(flags.length === 1 ? "Line in dispute:" : "Lines in dispute:");
  out.push("");
  flags.forEach((l, i) => {
    out.push(...disputeBlock(l, i + 1));
    out.push("");
  });
  out.push(
    "The records cited above are attached. Please send the revised audit and the corrected premium in writing.",
  );
  out.push("");
  out.push(a.insuredName ?? "[your name and company]");
  return { subject, body: out.join("\n") };
}

function disputeBlock(l: AnalysisLine, n: number): string[] {
  const desc = l.description.toLowerCase();
  const entity =
    l.entityName && !desc.includes(l.entityName.toLowerCase()) ? ` (${l.entityName})` : "";
  const code = l.classCode && !l.description.includes(l.classCode) ? `, class ${l.classCode}` : "";
  const basis =
    l.basis === "subcontract_cost"
      ? "subcontract cost"
      : l.basis === "total_contract"
        ? "contract amount"
        : "payroll";
  const yours =
    l.carrierAmount != null
      ? `${money(l.carrierAmount)} of ${basis}${
          l.carrierPremium != null ? ` (${money(l.carrierPremium)} premium)` : ""
        }`
      : "as billed";
  const ours = l.partial
    ? "remove the payments dated inside the certificate period; the rest stands"
    : l.rule === "class_code_mismatch"
      ? `${money(l.ourAmount)} of payroll under the class code the summary shows`
      : l.ourAmount != null
        ? `${money(l.ourAmount)} of ${basis}`
        : "see reason";
  return [
    `${n}. ${l.description}${entity}${code}`,
    `   Your figure: ${yours}`,
    `   Our figure: ${ours}`,
    `   Reason: ${l.reason}`,
    `   Proof: ${l.proof ? `${l.proof.detail} (attached: ${l.proof.file})` : "see the attached records"}`,
  ];
}
