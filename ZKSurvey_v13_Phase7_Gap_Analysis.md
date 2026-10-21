# ZKSurvey v13 · Phase 7 — Gap analysis (what stands between this and selling)

Zlandavel Infotech Pvt Ltd · 17 Oct 2026

**Bottom line:** v13 is the first build that can really *run* as a product: shared data, real accounts, enforced plans, payment and invoice code, privacy handling. It is **ready for a closed pilot** (5–10 friendly customers, Razorpay test mode or manual invoicing). It is **not ready for open sale** until the items marked 🔴 are done.

## 1. v12 gaps — status now
| v12 gap | Now |
|---|---|
| Real backend + database | ✅ Node/Express/PostgreSQL |
| Real authentication, verification, reset | ✅ built and tested |
| Tenant isolation | ✅ API-level, tested · 🟡 add Postgres row-level security as a second layer |
| Payments, GST invoices | 🟡 code + tests; **live Razorpay not exercised**; one-time periods only |
| Legal, DPDP consent, export/delete | 🟡 mechanics built (consent log, export, erasure, retention); **text is draft** |
| Transactional email | 🟡 SMTP built; needs your provider + SPF/DKIM + a live test |
| Bot / abuse protection | 🟡 rate limits, honeypot, duplicate guard; no CAPTCHA |
| Support tooling | 🟡 contact form + Platform inbox; no help centre / chat / impersonation |
| Observability | 🟡 JSON logs, `/healthz`; no alerts, metrics or error tracker |
| Custom domain | ❌ Phase 10 |
| Team seats | ❌ not built |
| Social / Meta API integration | ❌ Phase 8 (see §3) |

## 2. Blockers before open sale (🔴)
1. **Live payment test** in Razorpay test mode, then live: checkout, webhook delivery, failed payment, double-click, refund by hand. Confirm GST invoice format and numbering with your CA (check whether e-invoicing applies to your turnover).
2. **Legal text** reviewed by counsel (Terms, Privacy, refund policy, DPDP data-fiduciary/processor wording, cookie notice).
3. **Production hosting checklist** (`docs/Phase7_Deployment_Runbook.md`): TLS, secrets, SMTP, **restore-tested backups**, single instance, monitoring/alerts, Super Admin 2FA (not built — add before launch).
4. **Security review**: independent test of auth, tenant isolation, file upload (poster PNG), CSP (remove `unsafe-inline` by moving page scripts out), dependency policy.
5. **Server-side survey validation**: enforce required questions, option membership and skip logic on submit (today only structure, size, consent are checked).
6. **Pricing decision** with 10–15 target buyers; plan names/limits are placeholders.

## 3. Social and Meta — the real position
| Channel | Today (v13) | Phase 8 |
|---|---|---|
| Facebook | share dialog + link-preview image from your poster | Page posting via Graph API: Meta app, business verification, App Review (`pages_manage_posts`) |
| Instagram | download poster, copy caption, link in bio/Story sticker | Content Publishing API for Business accounts (images); link stays in bio/Story — captions cannot hold clickable links |
| Meta Ads | downloadable brief; leads attributed as `meta_ads` | Marketing API campaign creation (`ads_management`) or Lead Ads; needs the customer’s ad account access + payment method — decide whether you *manage* ads or only *brief* them |
| YouTube | poster + caption + tagged link | No public API for community polls; link in description / end screen — keep manual |
| X | tweet intent link with short link | API v2 posting needs a paid tier; optional |
| WhatsApp | wa.me share link | Cloud API broadcast: verified business, approved templates, proven opt-in, per-conversation fees |
Recommendation: start the **Meta app review now** (it takes weeks and covers Facebook + Instagram + Ads), build Facebook/Instagram publishing and the Ads brief→campaign flow in Phase 8, keep YouTube/X/WhatsApp as guided kits until customers ask.

## 4. How a launch or survey flows through the product (v13)
1. Visit marketing site → **Register** (verification email sent) → **Onboarding** picks goal/template and builds a brand-neutral draft survey.
2. **Builder**: edit, question bank, logic, validation (flags brand bias) → **Publish** (server checks verified email, plan caps, unique link).
3. **Distribute**: poster in 5 sizes, per-channel **tracked short links** (UTM + click count), link-preview image, captions, share buttons, poll kit, Meta Ads brief (Growth+), tracked campaigns.
4. **Respondents** open the short link on any device → consent → survey → response stored with source/medium/campaign.
5. Owner sees **responses, leads, sources (clicks → responses → leads), analytics, insights, reports**.
6. **Billing**: limits reached → upgrade (checkout, GST invoice) · cancel at period end · downgrade after grace.
7. **Super Admin** monitors accounts, revenue, support, plans; can suspend (surveys close immediately).
Still manual in the journey: posting to the social platforms and creating ads.

## 4b. Known weaknesses in what was built
- Whole-account snapshot per page + blocking requests (see release notes) → scale ceiling; Phase 9 should add paged/aggregate endpoints and a React front end.
- Insights/analytics are rule-based and computed in the browser.
- No recurring billing: a customer who forgets to renew drops to Free after 3 days; consider Razorpay Subscriptions/e-mandate.
- In-process jobs → one instance only; move to a scheduler or lock before scaling out.
- Duplicate submissions within 30 s from one network are silently ignored (shared offices/campus Wi-Fi with identical answers could be affected — acceptable, but worth knowing).
- Automated accessibility only; no screen-reader or real-device pass.

## 5. Phase plan
| Phase | Scope |
|---|---|
| 7.1 (2–3 weeks) | Close 🔴 items 1–5: live payment test, hardening, server-side survey validation, remove inline scripts/CSP, 2FA for Super Admin, restore drill, pilot with 5–10 customers |
| 8 | Meta (Facebook + Instagram + Ads), Razorpay Subscriptions, WhatsApp Cloud API, Google Analytics, email provider API |
| 9 | React front end on the API, paged analytics, AI insights with human review, server-generated reports, team seats |
| 10 | Cloud deployment, CI/CD, monitoring, custom domains, load test, public launch |

## 6. Decisions needed from you
Pricing/limits · who pays for ads (resell vs brief only) · hosting target and domain · Razorpay + SMTP accounts and your GSTIN · counsel for legal text · whether Agency plans need separate client logins.
