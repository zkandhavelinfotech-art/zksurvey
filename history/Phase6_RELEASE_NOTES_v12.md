# ZKSurvey v12 · Phase 6 — Release Notes

Build v12 · 15 Oct 2026 · Zlandavel Infotech Pvt Ltd

## New in v12
- **Marketing site:** home, pricing (Free/Starter/Growth/Agency), legal (draft), register, login.
- **Accounts:** B2C buyer registers, lands in onboarding, builds and runs surveys from their own dashboard; data isolated per account (browser-level).
- **Onboarding:** goal → product/audience → draft survey from 6 customer templates (samples hidden from customers).
- **Plans & limits:** survey count, response cap, poster sizes/watermark, Meta Ads brief, clients; upgrade prompts.
- **Billing screens:** plan, usage, invoices (simulated).
- **Super Admin console (Platform):** accounts, plan editing, suspend/reactivate, event log, health.
- **Distribute:** survey posters (IG post 1080², IG Story 1080×1920, FB 1200×630, YouTube 1280×720, X 1600×900) with per-channel UTM QR; channel kits for Instagram, Facebook, YouTube, X, WhatsApp; poll kit; Meta Ads brief; tracked campaigns; lead-source table.
- **Launch Journey** page: step-by-step flow of a product launch/survey.
- Brand-bias validation extended (title, intro, product name); global unique slugs; "Made with ZKSurvey" on Free.
- **Design freeze:** skip links, focus rings, mobile fixes; axe-core WCAG A/AA = 0 violations on 35 pages.

## Verified
48/48 SaaS flow checks (register/login, isolation, limits, suspension, slug collision, posters, share links, 31 pages × 3 widths) and 29/29 v11 regression checks. Automated only; no real-device or screen-reader testing.

## Not done — read before demoing as "live"
- **Payments are simulated.** No gateway, no GST invoices.
- **No social/Meta posting.** Facebook/X/WhatsApp open share links; Instagram/YouTube are download + copy; Meta Ads is a downloadable brief. API integration = Phase 8.
- **Auth is client-side** and not secure; data lives in one browser, so survey links work only on the browser that created them. Real backend = Phase 7.
- Pricing values and legal text are placeholders.
- Demo Super Admin: super@zksurvey.demo / Admin@123 — prototype only.
- Links generated on localhost point to localhost; host the files before sharing.

See `ZKSurvey_v12_Phase6_SaaS_Gap_Analysis.md` and `docs/Phase6_Design_Freeze.md`.
