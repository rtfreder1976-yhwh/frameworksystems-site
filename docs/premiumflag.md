# PremiumFlag

The fourth Framework Systems product. One job: a contractor already has the workers comp or
general liability **audit bill**. PremiumFlag compares that bill to the payroll summary and the
subcontractor certificates, labels every line Pay or Flag, and (for $249, once) writes the email
that asks the carrier for a revised audit on the flagged lines.

Same shape as InvoiceFlag. A file comes in, the lines that do not match get flagged, an email goes
out. It is not a monthly tool. It is not insurance. It does not sell a policy and it never talks
to the carrier. It is not CrewFlag and it is not InvoiceFlag, and it is never bundled with them.

Source of truth for scope: `docs/handoff-2026-10-24-framework-and-premiumflag.md` (the handoff
this was built from). This document is the product description plus what the build actually does.

## Status (2026-10-24)

| Build-order step (handoff) | State |
| --- | --- |
| 1. `/premium` upload for the three files; reject a payroll register | Done |
| 2. Read the bill and the summary; label each line Pay or Flag with the six rules only | Done |
| 3. Nothing flagged: show that and charge nothing | Done |
| 4. Something flagged: show the count and the disputed dollars; hide the email | Done |
| 5. After the Stripe payment, show the email and a copy button | Built. Needs the Payment Link and two env vars (below) |
| 6. Only then add the homepage door | **Not done, on purpose.** See "Step 6" |

The page is live at `/premium` but unlisted: not in the nav, the footer, the homepage, or the
About page, and it carries `noindex` until `PREMIUMFLAG_STRIPE_URL` in `src/lib/site.ts` is
filled in. `/shipping`, `/cleaning`, `/platform` and their Stripe and mail links are unchanged.

## What Todd does to switch it on

Code cannot do these. Each one is a setting in Vercel or Stripe.

1. **Anthropic key.** In Vercel, project `frameworksystems-site`, add the environment variable
   `ANTHROPIC_API_KEY` (Production and Preview). The reader uses Claude Opus 5.5 for the three
   document reads and the match step. Without the key the page says PremiumFlag is not switched
   on yet.
2. **Signing secret.** Add `PREMIUMFLAG_SIGNING_SECRET`: any long random string (for example the
   output of `openssl rand -hex 32`). The analysis lives in the contractor's browser between
   "read the bill" and "pay"; this signs it so a paid session unlocks the email for the bill it
   was bought for and nothing else. Without it, each server instance uses its own temporary key
   and unlocks fail after a cold start.
3. **Stripe price and Payment Link.** In Stripe, create a one-time price of **$249.00** named
   PremiumFlag, statement descriptor FRAMEWORK SYSTEMS, and a Payment Link for it. On the Payment
   Link, under "After payment", choose **"Don't show confirmation page"** and set the redirect to
   `https://frameworksystems.co/premium?session_id={CHECKOUT_SESSION_ID}` (use the
   `frameworksystems-site.vercel.app` host until the domain moves). The `{CHECKOUT_SESSION_ID}`
   text is literal; Stripe fills it in. The page appends `client_reference_id` to the link
   itself, so do not add it in Stripe.
4. **Stripe key.** Add `STRIPE_SECRET_KEY` in Vercel. A restricted key with only
   **Checkout Sessions: Read** is enough and is the safer choice. The server uses it for one
   call: confirm the session is paid and belongs to this bill.
5. **Paste the link.** Put the Payment Link URL into `PREMIUMFLAG_STRIPE_URL` in
   `src/lib/site.ts` and deploy. That one edit turns on the Unlock button and removes `noindex`.
6. **Test with a real card** on one flagged bill. Then do step 6 below.

Environment variables, all server-side, none `VITE_`:

| Variable | Used for | Missing means |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Reading the bill, summary, certificates; matching lines to records | Upload returns "not switched on in this deployment yet" |
| `PREMIUMFLAG_SIGNING_SECRET` | Signing the analysis between the result and the unlock | Per-instance temporary key; unlocks can fail after a restart |
| `STRIPE_SECRET_KEY` | Confirming a Checkout Session is paid | Unlock fails closed with "could not be confirmed with Stripe" |

## Who it is for

A contractor whose workers comp audit bill, or general liability audit bill, already arrived. The
books were opened. The carrier did the math. Something on the bill does not match what the
contractor sent.

Not for a one-person policy that never got audited. Not for health, life, or auto. Not for cash
labor that was never on a payroll summary. If there is no record, there is no line to flag.
Nothing in the build invents payroll.

## The two letters

The carrier sends two. PremiumFlag reads only the second.

1. The request. "Send payroll and certificates." The reader recognizes this letter
   (`document_type: records_request`) and stops: *"This is the first letter, the one that asks
   for records. It is not the upload."*
2. The bill, or the auditor's worksheet with the audited figures. This is the upload.

## What the user uploads

Three files. No login. No payroll-system connection. No Social Security numbers.

1. **The audit bill or worksheet.** PDF. Up to 60 pages, 3 MB.
2. **Payroll summary.** CSV or PDF. Columns that matter: person or role, state, class code,
   straight-time wages, overtime wages, overtime premium. Not a register.
3. **Workers comp (or GL) certificates for subs.** PDFs, or one zip of PDFs (unpacked in the
   browser). Each certificate needs the insured name, the coverage line, a policy number, and
   effective and expiration dates. Required whenever the bill counts subcontractors.

### Refusals, in order

Before a file reaches the reader, deterministic code (`src/lib/premiumflag/screen.ts`) checks the
CSV text or the PDF's own text layer:

- **Social Security numbers** in any layout (`123-45-6789`, `123 45 6789`, nine digits next to an
  SSN label, an SSN column). Refused in every slot. Masked SSNs (`***-**-1234`) mark a register.
- **A payroll register** in the summary slot: any register-only column (net pay, check number or
  date, deductions, withholding or FICA, direct deposit, 401k, garnishment) or two softer ones
  (pay date, employee ID, "check", pay period). In PDF text, two distinct register-only terms.

After the read, the reader's own flags are honored the same way: `contains_ssn` refuses the file
in any slot, `document_type: payroll_register` or `looks_like_register` refuses the summary, and a
file that is not a bill, not a summary, or not a certificate is sent back with a plain message.

If the summary is missing, or the bill counts subs and there are no certificates, the compare step
stops and says exactly what is missing. It does not guess a dispute.

## What it returns

A short result, then the locked email.

Every line on the bill gets one of two labels:

- **Pay.** The line matches the summary, or nothing in the upload contradicts it. Payroll grew,
  the class code matches, the sub had no certificate: they owe it.
- **Flag.** A document in the upload contradicts the line. The document is cited.

The rules engine (`src/lib/premiumflag/rules.ts`) is plain code, with unit tests, and it flags a
line only through these six rules. Each flag names the proof: which uploaded file, and what it says.

| Rule | Flags when | Our figure |
| --- | --- | --- |
| `sub_has_wc_cert` | A sub was billed as payroll or cost, and a certificate in the upload shows workers comp in force for that sub across the audit period | $0 (full coverage) or "remove the payments dated inside the certificate period" (partial coverage, no premium figure) |
| `sub_has_gl_cert` | On a GL audit (or a combined one), sub cost was counted and a certificate covers that sub for general liability across the period, at the required limits when the bill states them | Same as above |
| `overtime_premium_included` | The worksheet states overtime premium is in the base, or the audited payroll equals straight time plus full overtime on a summary that splits the premium portion | Audited payroll minus the premium portion. The straight-time part of overtime stays |
| `owner_excluded` | A named owner or officer is counted while the summary marks them excluded | $0 |
| `owner_over_cap` | A named owner or officer is counted above a cap the audit document itself states | The cap |
| `class_code_mismatch` | A named person's payroll sits in a class code the summary does not carry for them | Same payroll under the summary's code (premium left to the carrier) |
| `total_contract_as_payroll` | The full contract amount was used when the records split labor and materials | The labor amount |

What never flags: a bill that is bigger than last year's estimate (the true-up), a sub without a
certificate in the upload, a difference the upload does not explain, cash labor that is not on the
summary. Those come back Pay with a one-line reason.

Dollars on the result: **disputed premium** where the bill shows a premium or a rate for the line
(pro-rated when only part of the line is disputed), and **disputed exposure** (the audited payroll
or cost in question). If every flagged line has a premium figure, the result also shows the
undisputed remainder of the balance due.

If every line is Pay, the result says so, says to pay the bill, and charges nothing. There is no
email in that case.

## The email

Plain text. The contractor sends it. PremiumFlag does not send it anywhere.

It names the policy number and the audit period from the bill, lists only the Flag lines, and for
each gives the carrier's figure, the contractor's figure, the reason, and the uploaded document
that proves it. It asks for a revised audit in writing and says the lines that are not in dispute
will be paid by the due date. It does not claim the whole bill is on hold, does not give coverage
advice or class-code advice that is not in the documents, and does not promise the carrier will
reduce the bill. `src/lib/premiumflag/email.ts`, with tests.

## Price and payment flow

**$249 once, per bill.** Stripe one-time payment. Statement descriptor FRAMEWORK SYSTEMS.
No subscription, no tokens, no $19 tier, no pack with InvoiceFlag or CrewFlag, no free letter.
The free result is only the all-Pay case.

How the unlock works, end to end:

1. The result comes back with a signed analysis. The browser keeps it (session and local storage).
   The server keeps nothing.
2. "Unlock the email" opens the Payment Link with `?client_reference_id=<analysis id>`.
3. Stripe sends the buyer back to `/premium?session_id=cs_...`.
4. The page sends the session id and the stored analysis to the server. The server checks the
   signature, asks Stripe for that session, requires `payment_status: paid` and a
   `client_reference_id` equal to the analysis id, then composes the email and returns it.
5. The page shows the subject and body with a copy button.

Until the Payment Link exists, the button reads "not live yet" and points people at
todd@frameworksystems.co with the subject PremiumFlag.

## Page rules

`/premium`, on this site, not a subdomain, not a new Vercel project. The page says it is not
InvoiceFlag and not CrewFlag, says it does not sell insurance, explains that the records-request
letter is not the upload, and carries the one limit: people paid cash who are not on the summary
cannot be seen and will not be invented.

## How it is built

- `src/routes/premium.tsx`: the page. `src/components/premiumflag-tool.tsx`: upload, progress,
  result table, locked and unlocked email.
- `src/lib/premiumflag/server.ts`: three TanStack Start server functions, `extractDocumentFn`,
  `analyzeBillFn`, `unlockEmailFn`. Server-only modules are loaded inside the handlers.
- `extract.server.ts`: one structured read per document with `claude-opus-5-5` (effort high,
  adaptive thinking, server-side refusal fallback on), PDF passed as a document block, CSV as a
  text document. A second small read links bill lines to summary rows and certificates by name,
  merged with a conservative deterministic match (`match.ts`). The reader never judges.
- `pdf-text.server.ts`: the PDF text layer (unpdf) for the pre-read screen and the page count.
- `rules.ts`, `email.ts`, `screen.ts`, `match.ts`: pure code with tests
  (`npm run test:premiumflag`).
- `sign.server.ts`, `stripe.server.ts`, `unlock.server.ts`: HMAC over the analysis, one Stripe
  read, the gate.
- Files: 3 MB each, 60 pages (80 for certificates). Each document is sent in its own request, so
  nothing hits the 4.5 MB request limit on Vercel.
- Not built, by instruction: accounts, a dashboard, carrier login, a payroll integration, a place
  to store certificates for next year.

## Step 6: the homepage door

Do this only after a real card has paid for one flagged bill and the email came back. Then add a
fourth door on the homepage under the same rule as the others, and change "three doors" to "four"
on the homepage, the About page, the root meta description, the README, and `CLAUDE.md`. Suggested
copy from the handoff, use it:

- Eyebrow: Contractors
- Title: The audit bill
- Body: PremiumFlag reads the workers comp or general liability audit bill against the payroll
  summary and the certificates. You see the lines that match. You pay for the email on the lines
  that do not.
- Price line: $249 a bill. Not a subscription.
- Button: Review a bill
- Link: /premium

Add "Premium" to the nav and the footer at the same time. Nothing else on the site changes.

## Domain (Todd does this in Vercel, not in code)

`frameworksystems.co` and `www.frameworksystems.co` are on the old project,
`framework-systems-website`. The public site is still the old one. When the new pages are ready,
move those two domains onto project `frameworksystems-site`. Leave the old project in place. Do
not point anything at `frameworksystems.com`.
