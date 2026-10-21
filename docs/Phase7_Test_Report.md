# Phase 7 — Test report (build v13)

Run on 17 Oct 2026 against PostgreSQL 16.15, Node 22, Chromium (Playwright). All automated; no manual or real-device testing.

| Suite | What it proves | Result |
|---|---|---|
| `npm test` (node:test, real PostgreSQL) | Registration/login, lockout, CSRF, email verification, password reset (token single-use, sessions revoked), **tenant isolation**, **plan limits enforced in the API**, publish requires verified email, unique slugs, response cap, consent/honeypot/answer sanitising, suspended accounts, Super Admin guard, GST invoices (CGST+SGST vs IGST), Razorpay webhook + checkout signature checks and idempotency, subscription expiry/cancellation, retention job, data export and erasure (invoices retained), short links/Open Graph/bot-excluded click counts, support tickets, security headers | **19 / 19** |
| `server/test/e2e/e2e_flow.py` (Playwright, real server + DB) | Whole customer journey in browsers: register → verify → onboarding → survey stored in PostgreSQL → publish refused until verified → poster + short links + link-preview image → **respondent in a separate browser** answers via the short link → response with `utm_source=instagram` visible to the owner → second customer isolated → upgrade (test gateway) → invoice → sign-out/in → password reset → Super Admin sees accounts and revenue, suspends an account (public survey closes, login refused) → no demo credentials → no horizontal overflow at 390 px → no JS errors | **43 / 43** |
| `server/test/e2e/regression_v11.py` | Phase 5/6 behaviour still works on the server: Coimbatore research survey, logic, segments, campaigns, settings, builder, analytics, 36 pages × 3 widths with no white backgrounds or overflow | **29 / 29** |
| `server/test/e2e/accessibility_axe.py` (axe-core, WCAG 2.0 A/AA rules) | 39 pages signed in | **0 violations** |
| `npm audit` | dependencies | 0 known vulnerabilities |

## Not tested (be aware)
- **Razorpay live:** order creation against Razorpay’s API and the hosted checkout window were not exercised (no keys/network here). Signature and webhook logic were tested with locally computed HMACs.
- **SMTP delivery**, **Docker image / compose file** (no Docker in the build environment), **load**, **security penetration**, **screen readers**, **real phones**.
