# ZKSurvey v13 · Phase 7 — Release notes

Build v13 · 17 Oct 2026 · Zlandavel Infotech Pvt Ltd, Chennai
**Stack changed as requested: Node.js + Express + PostgreSQL** (not ASP.NET Core + SQL Server). The Phase 6 UI is kept.

## What is new
**A real backend**
- Express API + PostgreSQL 16 with SQL migrations (`server/`). 15 tables; every tenant table carries `account_id`.
- The browser no longer holds the data. A survey published by a customer works for respondents on any device (verified in the tests with a separate browser).

**Accounts and security**
- Registration, login, logout with server sessions (httpOnly cookie, hashed token), scrypt passwords, login lockout.
- **Email verification** (needed to publish or subscribe) and **password reset by email** (one-hour, single-use link).
- **Tenant isolation** enforced on every query and tested (another account gets 403/empty).
- **Plan limits enforced by the API** — survey count, publish, response cap — so bypassing the UI does not help.
- CSRF protection, rate limits, Helmet/CSP headers, audit log, admin actions logged.
- **No demo logins.** The Super Admin is created from `SUPER_EMAIL` / `SUPER_PASSWORD`; the old `super@zksurvey.demo` is gone.

**Selling it**
- **Razorpay checkout** (order → checkout signature check → webhook, idempotent) with a **mock gateway for development only** (refused in production).
- **GST invoices** with sequential numbers per financial year, CGST+SGST (in-state) or IGST, buyer GSTIN/state from Billing details; printable invoice page.
- Plan periods (1 or 12 months), cancel at period end, automatic downgrade after a 3-day grace.
- Platform console: real accounts, usage, collected revenue, plan editing, suspend/delete, send reset link, support messages.

**Launch and lead-source tracking**
- **Tracked short links** `/s/<code>` per channel: UTM tags, click counts (link-preview bots not counted), **Open Graph preview image** from your poster so Facebook/WhatsApp/X/LinkedIn show it.
- Distribute page uses short links in captions, QR codes and share buttons; source table shows clicks → responses → leads.

**Privacy and operations**
- Respondent consent notice on every survey; consent (time + version) stored with each response; IP stored only as a keyed hash.
- Settings: download all my data (JSON), delete account (invoices retained for tax law), retention period enforced daily.
- Support page → tickets in the Platform console. Forgot/reset/verify pages.
- Dockerfile, docker-compose, `.env.example` (production refuses unsafe config), `/healthz`, JSON logs, `backup.sh`, runbook.

## Tested
19/19 API tests on real PostgreSQL · 43/43 browser end-to-end checks · 29/29 Phase 5/6 regression checks · axe-core WCAG A/AA: 0 violations on 39 pages · npm audit: 0 vulnerabilities. Details: `docs/Phase7_Test_Report.md`.

## Not done / not verified — read before launching
- **Razorpay live calls are untested** (no keys here): order creation and the hosted checkout window. Signature/webhook logic is tested with computed HMACs. Run a test-mode payment first.
- **No automatic recurring billing** (customers renew each period), no proration or refunds/credit notes.
- **SMTP, Docker image, load and security testing were not run** in this environment.
- **No Instagram / Facebook / YouTube / X / Meta Ads API posting.** You still download the poster, copy the caption and use share links. That is Phase 8 and needs Meta app review.
- **Required questions and skip logic are not re-checked on the server** — a hand-made API call can submit incomplete answers.
- The UI still loads a whole account snapshot per page (blocking requests, scripts inline in pages); fine for hundreds to a few thousand responses, not for tens of thousands. Insights/analytics run in the browser.
- Team seats / invitations are not built (plans list seats; there is one login per account). Agency "clients" are labels, not separate logins.
- Terms/Privacy text is still a **draft** needing counsel; GST treatment needs your CA; prices are still placeholders.
- Jobs (expiry, retention) run inside the app process — run **one** instance.

## Upgrading from v12
v12 data lived in browsers and cannot be migrated automatically. A customer can use Settings → *Import backup* with a v12 export while signed in (plan limits apply).

See `ZKSurvey_v13_Phase7_Gap_Analysis.md` for the real gap list and the Phase 8 plan.
