# ZKSurvey v12 · Phase 6 — SaaS Gap Analysis (real, not aspirational)

Zlandavel Infotech Pvt Ltd · Build v12 · 15 Oct 2026

**Bottom line:** v12 is a *clickable, testable SaaS product prototype*: marketing page, pricing, registration, login, onboarding, dashboard, survey builder, poster + channel kits, tracked campaigns, billing screens and a Super Admin console. It is **not yet sellable**. Everything below the "Prototype" line (accounts, payments, data, social posting) lives in one browser. Selling needs Phase 7 (real backend) and Phase 8 (payments, integrations, legal) first.

## 1. What v12 actually does vs. what is simulated

| Area | In v12 | Reality |
|---|---|---|
| Marketing page, pricing, FAQ | Built, dark UI, responsive | Real. Prices are **placeholders** — pricing decision pending |
| Registration / login / logout | Built, password hashed (SHA-256) in browser | **Prototype only.** No server, no email verification, no reset, anyone with dev-tools can read/alter data |
| Tenant isolation | Per-account localStorage namespace + slug index | Browser-only. Two buyers on two devices do not share anything; a published survey link works only on the browser that made it |
| Plans & limits | Free/Starter/Growth/Agency; enforced for survey count, response cap, poster sizes + watermark, Meta brief, clients | Enforced client-side, so bypassable. Real enforcement = server |
| Billing | Plan change, invoices list, usage meters | **Simulated.** No payment gateway, no GST invoice, no renewals/dunning |
| Super Admin | Accounts, plan edit, suspend, events, platform health | Works on the browser's own data only. Demo creds super@zksurvey.demo / Admin@123 — remove before any hosting |
| Poster generation | Canvas posters, 5 sizes, QR with per-channel utm_source | Real and usable (download PNG) |
| Instagram / Facebook / YouTube / X / WhatsApp | Caption + tagged link + share intent (FB, X, WhatsApp); IG & YouTube = download + copy | **No API posting.** Nothing is published for the user |
| Meta Ads | Downloadable campaign brief (.md): objective, audience, creative, UTM | **Not connected.** No Ads Manager / Marketing API call |
| Lead source tracking | utm_source/medium/campaign captured on each response; source/lead table | Real logic; storage is browser-local |
| Survey runner | Public page, closed on suspend/cap, brand-neutral for category research | Works only where the data lives (same browser) |

## 2. SaaS readiness gaps (ranked)

**Blockers — cannot sell without these**
1. **Real backend + database (Phase 7).** Shared storage so a buyer's link works for respondents on other devices. Schema/API drafted in `docs/`.
2. **Real authentication.** Server-side sessions/JWT, email verification, password reset, rate limiting, lockout, optional Google sign-in. Remove demo super-admin credentials.
3. **Tenant isolation on the server.** Tenant id on every row, row-level checks, tests that prove account A cannot read account B.
4. **Payments.** Indian market: Razorpay (UPI, cards, netbanking, subscriptions/e-mandate). GST invoices (18% on SaaS), invoice numbering, refunds, failed-payment handling, cancellation. Needs company bank/GST details.
5. **Legal.** Terms, Privacy Policy, refund policy, DPDP Act 2023 consent notice on every survey, data-processing terms for agencies, cookie notice. `legal.html` is **draft placeholder text — needs a lawyer.**
6. **Transactional email.** Verification, reset, receipts, response alerts (SES/SendGrid/Zoho; SPF/DKIM).

**High — needed for a credible launch**
7. Response-quality controls: duplicate/bot protection (CAPTCHA, rate limits), spam filter.
8. Data export/delete on request (DPDP), backups, retention policy.
9. Observability: error logging, uptime monitor, audit log (prototype logs events locally).
10. Support tooling: help centre, in-app chat/email, status page, impersonate-with-consent for Super Admin.
11. Custom domain / branded survey URL (white-label) for paid plans.
12. Onboarding analytics: activation funnel (register → first survey → first response) — needs real tracking.

**Medium**
13. Team seats & roles inside an account (only owner + agency clients today).
14. Public API / webhooks / Google Sheets export.
15. Localisation (Tamil/Hindi runner), accessibility manual testing with screen readers.
16. Pricing validation with 10–15 target buyers before locking tiers.

## 3. Social & Meta Ads integration — what "connects" really requires

| Channel | What is possible | Requirement | Phase |
|---|---|---|---|
| Facebook Page post | Publish link post via Graph API | Meta app, App Review (`pages_manage_posts`), business verification | 8 |
| Instagram | Publish image via Content Publishing API (Business/Creator account linked to a Page); **no clickable link in post caption**, links go via bio/Story link sticker | Same Meta review; Story link sticker not available via API | 8 |
| Meta Ads | Create campaign/ad set/ad via Marketing API; Lead Ads for in-app forms | `ads_management`, ad account access, payment method on user's ad account; or keep brief-only | 8 |
| YouTube | Poll/Community post has **no public write API**. Realistic path: link in video description/pinned comment, end-screen, Shorts caption | Manual with kit; OAuth upload only for video | manual |
| X (Twitter) | Post via API v2 | Paid API tier (cost per month), app approval | 8 (optional) |
| WhatsApp | Broadcast needs WhatsApp Business Cloud API, opt-in consent, approved templates | Meta Business verification, per-conversation fees | 8 |

Recommendation: ship Phase 8 with **Facebook + Instagram + Meta Ads brief→campaign** first (one Meta app review covers all); keep YouTube/X/WhatsApp as guided kits until demand proves out. Start the Meta app review early — it takes weeks.

## 4. How a product launch or survey flows through the app (v12)

1. **Visit** `index.html` → see features/pricing → **Register** (name, email, password, plan).
2. **Onboarding:** pick goal (category research / launch / poll / NPS / event / blank), enter product + audience; app creates a draft survey from a template (brand-neutral title for category research).
3. **Survey Builder:** edit questions, pull from the question bank, logic, validation (flags brand bias), preview.
4. **Publish:** unique slug (global uniqueness checked); plan response cap applies.
5. **Distribute:** generate poster (IG post/Story, FB, YouTube, X), QR with channel UTM, caption, share links; download Meta Ads brief (Growth+); create tracked campaign.
6. **Run:** respondents open `public/run.html?s=<slug>&utm_*` — consent, questions, thank-you. Closed if plan cap hit or account suspended.
7. **Lead source:** each response stores utm source/medium/campaign → Sources/Leads pages show which channel brought which respondents.
8. **Analyse:** dashboard, analytics, segments, insights (rule-based), report (print to PDF).
9. **Upgrade / billing** when limits hit (simulated).
10. **Super Admin** monitors accounts, plans, suspensions, events.

**Where the journey breaks in real life today:** step 6 (respondent on another device cannot reach local data) and step 9 (no real payment). Everything else is representative of the final UX.

## 5. Recommended roadmap

| Phase | Scope |
|---|---|
| 6 (this build) | UI/UX freeze: screens, tokens, flows; SaaS prototype layer |
| 7 | .NET/SQL backend (or chosen stack), real auth, tenant isolation, shared runner, email, migrate prototype JSON |
| 8 | Razorpay + GST invoices; Meta (FB/IG/Ads) integration; WhatsApp; legal sign-off |
| 9 | AI insights with human review, server-generated reports, templates marketplace |
| 10 | Hosting, CI/CD, monitoring, backups, security review, soft launch with 5–10 pilot customers |

## 6. Decisions needed from you
- Final pricing and currency (₹ INR only at launch?) and free-plan limits.
- Stack for Phase 7 (ASP.NET Core + SQL Server assumed per existing docs).
- Whether to resell Meta Ads management or only provide briefs/tracking.
- Legal counsel for Terms/Privacy/DPDP.
- Brand/domain (zksurvey.com availability, sender domain for email).
