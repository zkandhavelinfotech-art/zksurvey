# Phase 7 — Architecture and API (Node.js · Express · PostgreSQL)

## Shape
Browser pages → same-origin JSON API (`/api/*`) → PostgreSQL. Express also serves `web/` and the tracked short links (`/s/:code`).
Sessions are an httpOnly cookie (`zk_sid`); the database stores only the SHA-256 of the token.

### The browser bridge (important to understand)
The Phase 6 screens were written against a synchronous in-browser store. To avoid rewriting 36 screens in the same release,
`web/js/auth.js` loads a snapshot of the signed-in account at page start (`GET /api/bootstrap`) and writes changes back to the
API (debounced, flushed before navigation). **The server is authoritative** — limits, ownership, slugs, publishing, consent,
payment — and every rule is enforced in the API and covered by tests. What the bridge costs: (1) the whole workspace is loaded
per page, fine for hundreds or low thousands of responses but not for tens of thousands (Phase 9: paged/aggregate endpoints);
(2) several screens use blocking requests. A React front end on the same API removes both.

## Authentication & account
| Method · Path | Purpose |
|---|---|
| POST /api/auth/register | create account, send verification email, start session |
| POST /api/auth/login · /logout | session; 8 failures lock 15 min |
| POST /api/auth/verify {token} · /resend-verification | email verification (24 h link) |
| POST /api/auth/forgot · /reset | password reset (1 h, single use; revokes all sessions) |
| GET/PATCH /api/account | profile, onboarding flag, GST billing details |
| POST /api/account/password | change password (other sessions revoked) |
| GET /api/account/export | all my data as JSON (DPDP access/portability) |
| DELETE /api/account {password} | erase account, surveys, responses (invoices kept, detached) |

## Workspace (authenticated, tenant-scoped)
| Method · Path | Purpose |
|---|---|
| GET /api/bootstrap[?lite=1] | user, plans, workspace snapshot (+ admin data for Super Admin) |
| GET/DELETE /api/workspace | load / erase all surveys and settings |
| PUT /api/surveys/:id | create/update survey + definition; **enforces** plan survey limit, verified email and response cap on publish, unique slug |
| DELETE /api/surveys/:id | delete (cascades responses) |
| PUT /api/surveys/:id/starts | start counter |
| POST /api/surveys/:id/responses/bulk · /delete | sample (demo) responses only · delete responses |
| PUT /api/kv · DELETE /api/kv/:key | campaigns, segments, strategy, settings … (`zk_*` keys, 1 MB each, 300 keys) |
| GET /api/slugs/:slug | link availability |
| PUT /api/surveys/:id/poster | PNG ≤ 3 MB, used as link-preview image |
| POST/GET /api/surveys/:id/links | create/list tracked short links (channel + UTM) with click counts |

## Public (no login)
| Method · Path | Purpose |
|---|---|
| GET /api/public/surveys/:slug | definition + `closed` reason (`unpublished`, `closed` = suspended owner, `cap` = plan limit) |
| POST /api/public/surveys/:slug/start | start counter |
| POST /api/public/surveys/:slug/responses | needs `consent.given=true`; honeypot `website`; unknown question ids dropped; ≤ 60 KB; duplicate within 30 s ignored; cap re-checked inside a per-account lock; 40/10 min per IP in production |
| GET /api/public/surveys/:slug/poster.png | link-preview image |
| GET /s/:code | Open Graph page + click count (bots excluded) + redirect to the survey with UTM |
| POST /api/support | contact form → support ticket |

## Billing
| Method · Path | Purpose |
|---|---|
| GET /api/billing | mode, orders, invoices |
| POST /api/billing/checkout {planId, months 1\|12} | creates order (amount + 18 % GST); Razorpay order in production |
| POST /api/billing/verify | checks Razorpay signature, activates plan, issues invoice |
| POST /api/billing/mock-pay | development gateway only (refused in production) |
| POST /api/webhooks/razorpay | HMAC-verified `payment.captured`/`order.paid`; idempotent with `/verify` |
| POST /api/billing/cancel · /resume | cancel at period end |
| GET /api/invoices/:id/html | printable invoice (CGST+SGST in-state, IGST out-of-state) |

An hourly job downgrades accounts to Free 3 days after the paid period ends (or at period end if cancelled). A daily job deletes
responses older than the account’s retention setting.

## Super Admin (`role = superadmin`)
`GET /api/admin/overview|accounts|audit|outbox`, `PATCH /api/admin/accounts/:id` (plan, status, verify), `DELETE /api/admin/accounts/:id`,
`POST /api/admin/accounts/:id/reset-link`, `PUT /api/admin/plans`, `PATCH /api/admin/tickets/:id`.

## Data model (see `server/migrations/001_init.sql`)
accounts · sessions · email_tokens · plans · surveys (def jsonb, slug unique) · responses (answers/utm/consent jsonb, demo flag, ip_hash) ·
survey_starts · workspace_kv · orders · invoices (retained on account erasure) · events · audit_log · support_tickets · short_links · mail_outbox.
Amounts are stored in paise.

## Conventions
Errors: `{error: code, message}` with HTTP 400/401/402/403/404/409/413/429. Limit errors use 402 (`limit_surveys`, `limit_responses`),
unverified email 403 (`verify_email`), slug conflict 409 (`slug_taken`).
