import { composeEmail } from "./email.ts";
import { verifyAnalysis } from "./sign.server.ts";
import { fetchCheckoutSession } from "./stripe.server.ts";
import type { Analysis } from "./types.ts";
import { PREMIUMFLAG_PRICE } from "../site.ts";

export type UnlockOutcome =
  { ok: true; subject: string; body: string } | { ok: false; message: string };

export async function unlock(input: {
  sessionId: string;
  analysis: Analysis;
  sig: string;
}): Promise<UnlockOutcome> {
  if (!verifyAnalysis(input.analysis, input.sig)) {
    return {
      ok: false,
      message:
        "This result could not be verified against the server. Run the bill again in this browser, then pay from that page. If you already paid, email todd@frameworksystems.co with the Stripe receipt.",
    };
  }
  if (input.analysis.allPay) {
    return {
      ok: false,
      message: "Every line on this bill came back Pay. There is no email to unlock.",
    };
  }
  const check = await fetchCheckoutSession(input.sessionId);
  if (!check.ok) {
    console.error("[premiumflag] stripe check failed:", check.error);
    return {
      ok: false,
      message:
        "The payment could not be confirmed with Stripe. Reload this page in a minute. If it still fails, email todd@frameworksystems.co with the Stripe receipt.",
    };
  }
  if (!check.paid) return { ok: false, message: "Stripe shows this checkout as not paid yet." };
  if (check.clientReferenceId !== input.analysis.id) {
    return {
      ok: false,
      message:
        "This payment was made for a different bill. Pay from the page that shows this result.",
    };
  }
  // client_reference_id can be added to any of our Payment Links, so the amount has to be this one.
  if (
    check.currency !== "usd" ||
    check.amountTotal == null ||
    check.amountTotal < PREMIUMFLAG_PRICE * 100
  ) {
    return {
      ok: false,
      message:
        "That payment was not for a PremiumFlag email. Pay with the Unlock button on this page.",
    };
  }
  const email = composeEmail(input.analysis);
  return { ok: true, subject: email.subject, body: email.body };
}
