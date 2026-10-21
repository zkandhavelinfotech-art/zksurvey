# Phase 7 — Deployment runbook

## Before the first customer
1. **Domain + TLS** (e.g. app.yourdomain.com) behind a reverse proxy; set `APP_URL=https://…`, `TRUST_PROXY=1`.
2. **Secrets** in `.env` (see `.env.example`): `SERVER_SECRET` (random 32+), `SMTP_URL`, Razorpay keys + webhook secret, `SELLER_GSTIN`.
   In production the server **refuses to start** if any of these are unsafe or missing.
3. **Razorpay**: create the webhook `https://APP_URL/api/webhooks/razorpay` for `payment.captured` and `order.paid`; use the same secret in `RAZORPAY_WEBHOOK_SECRET`. Test with Razorpay test keys first.
4. **Email**: configure SPF/DKIM for the sender domain, send yourself a verification email.
5. **First Super Admin**: set `SUPER_EMAIL` / `SUPER_PASSWORD`, start once, then delete the password from `.env`. Sign in and change nothing else; there is no demo account.
6. **Legal**: replace `legal.html` text with counsel-approved Terms/Privacy (DPDP Act 2023); confirm GST treatment of invoices with your CA.

## Run
`docker compose up -d --build` (app + PostgreSQL) or `npm ci --omit=dev && node server/src/index.js` with an external PostgreSQL.
Migrations run automatically at start. Health: `GET /healthz`. Logs: one JSON line per request on stdout.

## Backups and restore
`DATABASE_URL=… sh server/backup.sh /var/backups/zksurvey` (gzip `pg_dump`, keeps 14). Schedule nightly with cron and copy off the machine.
Restore: `gunzip -c backup.sql.gz | psql "$DATABASE_URL"` into an empty database. **Test a restore before launch.**

## Operations
- Suspend/reactivate/delete accounts, change plans, read support tickets: Platform console (Super Admin).
- Failed emails: `/api/admin/outbox` (rows with `error`), or `select * from mail_outbox where error is not null`.
- Payment disputes: `orders` + `invoices`; payment ids are stored.
- Erasure requests: the owner does it in Settings; for a respondent’s request, the survey owner deletes the response in Responses.

## Known limits (see the Phase 7 gap analysis)
One app instance is assumed (jobs run in-process; run a single replica or move jobs to a scheduler first). No automatic recurring
billing. No Meta/Instagram/YouTube/X API posting. Security review and load test not done.
