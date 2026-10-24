# Framework Systems — website

Public marketing site. Live design (Playfair / DM Sans, navy, sienna, cream). New information architecture, 2026-09-08.

Not a bundle. Three doors, plus one unlisted:

| Door | URL | Who |
|---|---|---|
| The shop platform | `/platform` | Any service shop — missed-call text-back, secretary, invoice follow-up, Google reviews. White-label. |
| Cleaning | `/cleaning` (`/crewflag`) | Walkthrough photos, recurring quality, lockouts. CrewFlag. |
| Shipping | `/shipping` (`/invoiceflag`) | 3PL / parcel invoice audit. InvoiceFlag. |
| Contractors (unlisted) | `/premium` | Workers comp / GL audit bill against the payroll summary and the certificates. PremiumFlag, $249 a bill. Not linked from the homepage or nav until the Stripe link exists. See `docs/premiumflag.md`. |

Old plumbing pages (`/plumbing`, `/services`, `/how-it-works`) redirect to `/platform`.

## Cutover

This repo is the rebuild. `frameworksystems.co` still points at the previous HTML repo until DNS / Vercel is switched.

App URLs that stay where they are:

- CrewFlag app: https://crewflag.vercel.app
- InvoiceFlag Stripe links: unchanged

## PremiumFlag

`/premium` is built and unlisted. Switching it on is three Vercel env vars (`ANTHROPIC_API_KEY`, `PREMIUMFLAG_SIGNING_SECRET`, `STRIPE_SECRET_KEY`), a $249 Stripe Payment Link that redirects to `/premium?session_id={CHECKOUT_SESSION_ID}`, and that link pasted into `PREMIUMFLAG_STRIPE_URL` in `src/lib/site.ts`. The full product description, the Pay/Flag rules, and the step-by-step are in `docs/premiumflag.md`. The handoff it was built from is `docs/handoff-2026-10-24-framework-and-premiumflag.md`.

## Local

`npm run dev` — port 8080. `npm run test:premiumflag` runs the PremiumFlag rules, screening, and email tests.
