# Claude Code handoff (2026-10-24)

Saved verbatim from the Grok conversation Todd shared on 2026-10-24
(`/workspace/artifacts/claude-handoff-framework-and-premiumflag.md` in that workspace). The
product description that reflects what was actually built is `docs/premiumflag.md`.

---

Repo to edit: rtfreder1976-yhwh/frameworksystems-site
Live preview: https://frameworksystems-site.vercel.app/
Do not edit Framework-Systems---Website. That is the old site.

## Do not

- Do not redesign the homepage. It already says three separate tools, not a bundle.
- Do not merge InvoiceFlag, CrewFlag, and PremiumFlag into one login, one price, one token wallet, or a good/better/best ladder.
- Do not create subdomains. No invoiceflag.frameworksystems.co.
- Do not attach or build on frameworksystems.com. That domain is down and is not on this project.
- Do not add PremiumFlag to the nav or homepage until the tool below actually returns a letter.
- Do not change existing Stripe links, mailto links, or prices on /shipping and /cleaning.

## Domain (Todd does this in Vercel, not in code)

frameworksystems.co and www.frameworksystems.co are on the old project, framework-systems-website. The public site is still the old one.

When the new pages are ready, move those two domains onto project frameworksystems-site. Leave the old project in place. Do not point anything at frameworksystems.com.

## Site that is already correct

Homepage: https://frameworksystems-site.vercel.app/

Three doors. Buy one. Skip the rest.

| Door | Path | Product | Price | Leave it |
| --- | --- | --- | --- | --- |
| Cleaning companies | /cleaning | CrewFlag | First job free. Photo walkthrough $19 / $29. Quality watch $19 / $29. Lockouts $19 / $29. All three $39 / $49. | Yes. The pack is three CrewFlag tools, same job. |
| Brands that ship | /shipping | InvoiceFlag | First audit free. Then $19, or $49/mo. | Yes. |
| Any service shop | /platform | Shop platform | No price. A call, not a checkout. | Yes. It is a service. |

### Links that must keep working

InvoiceFlag, on /shipping:

- mailto: if-inbox@agentmail.to?subject=InvoiceFlag%20first%20audit
- $19 single: https://buy.stripe.com/bJe00cdmm5SG9dQgNfdQQ08
- $49/mo: https://buy.stripe.com/cNicMY3LM80O0Hk68BdQQ09
- Card statement: FRAMEWORK SYSTEMS

CrewFlag, on /cleaning:

- mailto: todd@frameworksystems.co?subject=CrewFlag
- Photo $19: https://buy.stripe.com/3cI7sEgyych41Lo54xdQQ0e
- Photo $29/mo: https://buy.stripe.com/aFacMYfuubd04XAcwZdQQ0a
- Quality $19: https://buy.stripe.com/dRmfZa9661Cqeya8gJdQQ0f
- Quality $29/mo: https://buy.stripe.com/5kQ4gs6XYch489M54xdQQ0b
- Lockout $19: https://buy.stripe.com/fZu6oAcii0ym2PsbsVdQQ0g
- Lockout $29/mo: https://buy.stripe.com/fZu9AM1DE4OCblYbsVdQQ0c
- Pack $39: https://buy.stripe.com/00wdR2822gxkeya7cFdQQ0h
- Pack $49/mo: https://buy.stripe.com/cNi4gs6XYch489MfJbdQQ0d
- Tools, separate Vercel app, do not rebuild them on this site:
  - https://crewflag.vercel.app/qc
  - https://crewflag.vercel.app/drift
  - https://crewflag.vercel.app/access

CrewFlag app project stays crewflag. Do not fold it into this repo.

## Product to build: PremiumFlag

One job. A contractor already has the audit bill. PremiumFlag compares that bill to the payroll summary and the certificates, then writes the email back to the carrier.

Same shape as InvoiceFlag. A file comes in. The lines that do not match get flagged. An email goes out. It is not a monthly tool. It is not insurance. It does not sell a policy and it does not talk to the carrier.

### Who it is for

A contractor whose workers comp audit bill, or general liability audit bill, already arrived. The books were opened. The carrier did the math. Something on the bill does not match what the contractor sent.

Not for a one-person policy that never got audited. Not for health, life, or auto. Not for cash labor that was never on a payroll summary. If there is no record, there is no line to flag. Do not build anything that invents payroll.

### The two letters

The carrier sends two. PremiumFlag uses only the second.

1. The request. "Send payroll and certificates." Ignore it.
2. The bill. The math is already done. This is the upload.

### What the user uploads

Three files. No login. No payroll-system connection. No Social Security numbers. If a file looks like a full payroll register, reject it and ask for a summary.

1. The audit bill, or the audit worksheet. PDF.
2. Payroll summary. CSV or PDF. Columns that matter: person or role, state, class code, straight-time wages, overtime wages, overtime premium. Not a register.
3. Workers comp certificates for subs. PDF. One file or a zip. Each cert needs the insured name, a workers comp line, a policy number, and effective and expiration dates.

If the summary or the certificates are missing, stop. Say what is missing. Do not guess a dispute.

### What it returns

A short result, then the email.

For each line on the bill, one of two labels:

- **Pay.** The line matches the summary. Payroll grew, the class code matches, the sub had no certificate. They owe it.
- **Flag.** The line does not match a document they uploaded. Cite the document.

Only flag a line when a document contradicts it:

- A sub was billed as payroll, and a certificate in the upload shows workers comp in force for that name on those dates.
- Overtime premium is inside the auditable payroll base. The straight-time portion can stay. The extra half is the flag. Do not flag overtime unless the worksheet shows the premium portion included.
- An owner or officer is included above the cap, or included at all when the upload shows an exclusion for that policy period.
- Payroll is in a higher class code than the summary shows for that person.
- The full contract amount was used as payroll when the summary or the invoice splits labor and materials, and labor is lower.
- On a general liability audit, sub cost was included and a certificate in the upload covers that sub for general liability at the required limits for those dates.

Do not flag a line because the bill is bigger than last year's estimate. That is the true-up. It is supposed to be bigger if they paid more labor.

If every line is Pay, the result is free. Say so. Tell them to pay the bill. Do not write a dispute email.

If one or more lines are Flag, show the count and the disputed dollars. Do not show the email until they pay.

### The email

Plain text. The contractor sends it. PremiumFlag does not send it to the carrier.

The email must:

- Name the policy number and the audit period from the bill.
- List only Flag lines.
- For each line: their amount, the contractor's amount, the reason, and which uploaded document proves it.
- Ask for a revised audit in writing.
- Say the contractor will pay the lines that are not in dispute.
- Not claim the whole bill is on hold. A dispute does not pause the undisputed premium.
- Not give coverage advice, class-code advice that is not in the documents, or a promise the carrier will reduce the bill.

### Price

$249 once, per bill. Stripe one-time payment. Statement descriptor stays FRAMEWORK SYSTEMS.

No subscription. No tokens. No $19 tier. No pack with InvoiceFlag or CrewFlag. No free letter. The free result is only the all-Pay case.

Todd will create the Stripe price. Until that link exists, use a clear placeholder constant, PREMIUMFLAG_STRIPE_URL, and do not invent a second payment flow.

### Page

Path: /premium on this same site. Not a subdomain. Not a new Vercel project.

Do not link it from the homepage until upload, the Pay/Flag result, and the locked email all work.

When it is ready, add a fourth door under the same rule as the others. Suggested copy, use it:

- Eyebrow: Contractors
- Title: The audit bill
- Body: PremiumFlag reads the workers comp or general liability audit bill against the payroll summary and the certificates. You see the lines that match. You pay for the email on the lines that do not.
- Price line: $249 a bill. Not a subscription.
- Button: Review a bill
- Link: /premium

Page rules:

- Say it is not InvoiceFlag and not CrewFlag.
- Say it does not sell insurance.
- Say the first letter from the carrier, the one that only asks for records, is not the upload. The bill is the upload.
- One short limit on the page: if the people were paid cash and they are not on the summary, this tool cannot see them and will not invent them.

### Build order

1. /premium upload for the three files. Reject a payroll register.
2. Read the bill and the summary. Label each line Pay or Flag using only the rules above.
3. If nothing is flagged, show that and charge nothing.
4. If something is flagged, show the count and the disputed dollars. Hide the email.
5. After the Stripe payment, show the email and a copy button.
6. Only then add the homepage door.

Do not build accounts, a dashboard, carrier login, a payroll integration, or a place to store certificates for next year.

## Done when

- /shipping and /cleaning links and prices are unchanged.
- /premium works on the three-file upload.
- A bill that only grew because payroll grew comes back all Pay, and the price is $0.
- A bill that counts a sub who has a certificate in the upload comes back Flag, and the email names that sub and that certificate.
- A file with Social Security numbers is refused.
- The homepage does not mention PremiumFlag until step 6.
- No bundle, no tokens, no subdomain, no edit to the old repo.
