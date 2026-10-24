import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The analysis lives in the contractor's browser between "read the bill" and "pay". It comes
 * back to the server with the Stripe session, so it is signed on the way out and checked on
 * the way in: a paid session unlocks the email for the bill it was bought for, nothing else.
 */

let ephemeralSecret: string | null = null;

function signingSecret(): string {
  const configured = process.env.PREMIUMFLAG_SIGNING_SECRET?.trim();
  if (configured) return configured;
  if (!ephemeralSecret) {
    ephemeralSecret = randomBytes(32).toString("hex");
    console.warn(
      "[premiumflag] PREMIUMFLAG_SIGNING_SECRET is not set. Using a per-process key: results will not unlock after a restart or on another instance.",
    );
  }
  return ephemeralSecret;
}

/** JSON with keys sorted at every level, so the same object always signs the same. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function signAnalysis(analysis: unknown): string {
  return createHmac("sha256", signingSecret()).update(stableStringify(analysis)).digest("hex");
}

export function verifyAnalysis(analysis: unknown, sig: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(sig)) return false;
  const expected = Buffer.from(signAnalysis(analysis), "hex");
  const given = Buffer.from(sig, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function newAnalysisId(): string {
  return `pf_${randomBytes(10).toString("hex")}`;
}
