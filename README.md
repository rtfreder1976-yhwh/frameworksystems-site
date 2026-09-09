# Framework Systems — website

Public marketing site. Live design (Playfair / DM Sans, navy, sienna, cream). New information architecture, 2026-09-08.

Not a bundle. Three doors:

| Door | URL | Who |
|---|---|---|
| The shop platform | `/platform` | Any service shop — missed-call text-back, secretary, invoice follow-up, Google reviews. White-label. |
| Cleaning | `/cleaning` (`/crewflag`) | Walkthrough photos, recurring quality, lockouts. CrewFlag. |
| Shipping | `/shipping` (`/invoiceflag`) | 3PL / parcel invoice audit. InvoiceFlag. |

Old plumbing pages (`/plumbing`, `/services`, `/how-it-works`) redirect to `/platform`.

## Cutover

This repo is the rebuild. `frameworksystems.co` still points at the previous HTML repo until DNS / Vercel is switched.

App URLs that stay where they are:

- CrewFlag app: https://crewflag.vercel.app
- InvoiceFlag Stripe links: unchanged

## Local

`npm run dev` — port 8080.
