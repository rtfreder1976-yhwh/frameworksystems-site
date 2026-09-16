export const BOOKING =
  "https://api.singingriverai.com/widget/booking/2hbIk4Z0B7cVKMrbKKVV";
export const EMAIL = "mailto:todd@frameworksystems.co";
export const EMAIL_LABEL = "todd@frameworksystems.co";

/** InvoiceFlag free-audit inbox (AgentMail) — keep separate from general Framework EMAIL */
export const INVOICEFLAG_EMAIL = "mailto:if-inbox@agentmail.to";
export const INVOICEFLAG_EMAIL_LABEL = "if-inbox@agentmail.to";

export const STRIPE = {
  invoiceOnce: "https://buy.stripe.com/bJe00cdmm5SG9dQgNfdQQ08",
  invoiceMonthly: "https://buy.stripe.com/cNicMY3LM80O0Hk68BdQQ09",
  qcOnce: "https://buy.stripe.com/3cI7sEgyych41Lo54xdQQ0e",
  qcMonthly: "https://buy.stripe.com/aFacMYfuubd04XAcwZdQQ0a",
  driftOnce: "https://buy.stripe.com/dRmfZa9661Cqeya8gJdQQ0f",
  driftMonthly: "https://buy.stripe.com/5kQ4gs6XYch489M54xdQQ0b",
  accessOnce: "https://buy.stripe.com/fZu6oAcii0ym2PsbsVdQQ0g",
  accessMonthly: "https://buy.stripe.com/fZu9AM1DE4OCblYbsVdQQ0c",
  packOnce: "https://buy.stripe.com/00wdR2822gxkeya7cFdQQ0h",
  packMonthly: "https://buy.stripe.com/cNi4gs6XYch489MfJbdQQ0d",
} as const;

export const APP = {
  crewflag: "https://crewflag.vercel.app",
  qc: "https://crewflag.vercel.app/qc",
  drift: "https://crewflag.vercel.app/drift",
  access: "https://crewflag.vercel.app/access",
} as const;
