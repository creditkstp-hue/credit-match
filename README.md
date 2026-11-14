# Credit Match affiliate management MVP

Branch: `feature/credit-match-trust-and-consent`. No live site deploy has been performed.

## Features
- Customer assessment POSTs a limited, non-identifying profile to `/.netlify/functions/affiliate?action=match`. Relevance uses configured goals, reported negative items, monitoring gap, active status and editorial priority. **Not lender underwriting, eligibility verification, or approval probability.**
- Outbound affiliate clicks use `action=click&id=...`; Netlify Blobs saves an anonymous event before a 302 redirect.
- `/admin.html` lets the owner create or edit offers, set active state, partner URL, disclosure, relevance rules, and priority.
- Commission ledger accepts owner-entered partner statement entries (pending, approved, paid, reversed). Dashboard summarizes clicks and commission entries. This is not an affiliate-network reconciliation.
- Three existing URLs are seeded as defaults; new offers can be added without modifying code.

## Setup
1. Create or connect a **separate Credit Match Netlify site** to `creditkstp-hue/credit-match`. Do not point it at the trading site.
2. Deploy from the reviewed branch, after verifying the scope. Netlify Functions folder is `netlify/functions`.
3. Set `CREDIT_MATCH_ADMIN_KEY` to a **strong secret (at least 32 randomly generated characters)** in the site environment variables. Never commit it to GitHub.
4. For existing email assessment, configure `BREVO_API_KEY` and a verified `BREVO_SENDER_EMAIL`. Check service availability, verified sender, and API permissions.
5. Test `/admin.html` on HTTPS, save an offer, reload and verify persistence, inspect `action=match`, then make a test redirect and confirm one click recorded. Enter a manual $0 commission to verify report flow without inventing revenue.
6. Confirm all affiliate-program policies allow your actual placement and referral methods. Verify destination URLs and disclosure text.

## Security and data limitations
- Admin API uses a header secret; access is denied when the environment variable is absent. The static admin HTML page itself can be opened publicly, but it displays no private offer data without authorization. Only use the site on HTTPS.
- Netlify Blobs is key/value storage, not a transactional analytics database. Click and commission records are append-only, anonymous click records, and reports are capped at 10,000 records per category. Add rate limiting, network callbacks/webhooks, deduplication, conversion attribution, reconciliation, audit trails, and proper owner login before scaling.
- Production and nonproduction context use separate Blobs store namespaces. Avoid testing changes against production.
- Commission entries are individually recorded, not state transitions; do **not** double-enter the same conversion as pending and paid. Replace this workflow with idempotent status transitions before production financial reporting.
- No purchase or live financial-service referral has been tested. Customer profile values are not saved in click records. Consent to receive an assessment is distinct from marketing opt-in.
- Users should be offered genuine free options where appropriate, with no unsupported claim that a tradeline or dispute service improves credit.

## Two separate customer journeys
- **Personal Credit Builder:** asks about self-reported credit score band, utilization, account age, payment history, negative items, and consumer monitoring. Only personal-segment partner offers may appear.
- **Business Credit Builder:** asks about business stage and entity type, EIN, separate bank account, monthly revenue, business credit history, monitoring, and funding interest. Only business-segment partner offers may appear.
- Owner dashboard now includes a **Customer track** selector for each offer; business and personal offers share management and reporting but are filtered separately.
- Existing three seed links remain **personal only**. There are **no verified business affiliate links configured yet**; the business track therefore displays an educational foundation checklist instead of an irrelevant offer.
- Business offers must be added in the manager with the business segment after affiliate approval and checking partner program rules; do not treat them as lender eligibility decisions.
- No customer's EIN, bank details, or full credit report are requested or stored. The assessment only uses the user's self-reported status answers to generate educational suggestions.
