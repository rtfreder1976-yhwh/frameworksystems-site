/**
 * One read against Stripe: is this Checkout Session paid, and which bill was it bought for?
 * The Payment Link carries client_reference_id = the analysis id, and after payment Stripe
 * sends the buyer back to /premium?session_id={CHECKOUT_SESSION_ID}.
 */

export type CheckoutCheck =
  | {
      ok: true;
      paid: boolean;
      clientReferenceId: string | null;
      amountTotal: number | null;
      currency: string | null;
      livemode: boolean;
    }
  | { ok: false; error: string };

const SESSION_ID = /^cs_(?:test|live)_[A-Za-z0-9]{8,}$/;

export async function fetchCheckoutSession(sessionId: string): Promise<CheckoutCheck> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return { ok: false, error: "STRIPE_SECRET_KEY is not set on the server." };
  if (!SESSION_ID.test(sessionId)) {
    return { ok: false, error: "That does not look like a Stripe checkout session." };
  }
  let res: Response;
  try {
    res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
  } catch (err) {
    return { ok: false, error: `Stripe could not be reached (${(err as Error).message}).` };
  }
  if (!res.ok) return { ok: false, error: `Stripe answered ${res.status}.` };
  const s = (await res.json()) as {
    status?: string;
    payment_status?: string;
    client_reference_id?: string | null;
    amount_total?: number | null;
    currency?: string | null;
    livemode?: boolean;
  };
  const paid =
    s.payment_status === "paid" ||
    (s.status === "complete" && s.payment_status === "no_payment_required");
  return {
    ok: true,
    paid,
    clientReferenceId: s.client_reference_id ?? null,
    amountTotal: s.amount_total ?? null,
    currency: s.currency ?? null,
    livemode: Boolean(s.livemode),
  };
}
