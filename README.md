# ZKSurvey v13 · Phase 7 — Node.js + Express + PostgreSQL

Survey, market-intelligence and launch-growth SaaS by Zlandavel Infotech Pvt Ltd, Chennai.
The Phase 6 UI is unchanged in look; everything behind it is now a real server and database.

## Quick start (development)
```bash
npm install
createdb zksurvey                       # or: docker compose up db
export DATABASE_URL=postgres://zk:zk@localhost:5432/zksurvey
export SUPER_EMAIL=you@example.com SUPER_PASSWORD='ChooseAStrong1'   # first Super Admin
npm start                               # migrates the schema, creates the Super Admin, serves http://localhost:3000
```
In development (`NODE_ENV` not `production`) payments use a **mock gateway** (no money moves) and sent emails are readable at
`GET /api/dev/outbox?to=<email>`. There is **no built-in demo login**.

## Tests
```bash
export TEST_DATABASE_URL=postgres://zk:zk@localhost:5432/zksurvey_test
npm test                                # 19 API tests against real PostgreSQL
```
Browser end-to-end tests (Playwright, 43 checks) are described in `docs/Phase7_Test_Report.md`.

## Production
See `docs/Phase7_Deployment_Runbook.md` and `.env.example`. Docker: `docker compose up -d --build`.

## Layout
- `server/` — Express API (`src/routes`), SQL migrations, tests, backup script
- `web/` — static pages and JS served by Express (`js/auth.js` is the browser-side API bridge)
- `docs/` — API/architecture, runbook, test report, design freeze, Phase 8 plan
- `history/` — older release notes and gap analyses
