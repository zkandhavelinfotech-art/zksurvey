# Phase 6 — UI/UX Design Freeze (v12)

Status: **Frozen for build Phase 7 except items in "Open"**.

## Design tokens (css/style.css, css/zk.css)
- Dark UI only; no white page or card backgrounds (QR tile white quiet-zone is intentional for scan reliability).
- Focus ring: 3px #9ce6ff, offset 2px (`:focus-visible`). Skip link on every page, dark-themed.
- Breakpoints verified: 1360, 768, 390 px — no horizontal page scroll; wide tables scroll inside focusable `.table-wrap`.

## Screen inventory (36 pages)
Public: index, pricing, register, login, legal, public/run.
Owner/customer admin: onboarding, dashboard, surveys, survey-builder, survey-templates, questions (bank), distribute, campaigns, campaign-builder, responses, leads, sources, analytics, segments, insights, reports, strategy-builder, content-testing, launch-journey, growth-framework, billing, settings.
Super Admin only: platform, architecture.

## Role × access
| Role | Access |
|---|---|
| Visitor | public pages, survey runner |
| Owner (B2C buyer) | own workspace; empty account → onboarding |
| Agency | owner + clients |
| Customer / Marketing | role-scoped menus (preview switcher, Super Admin only) |
| Super Admin | everything + platform, architecture, accounts |
Route guard is client-side (UX only, not security) until Phase 7.

## Plan limits (placeholders, editable in Platform)
Survey count, response cap, poster sizes/watermark, Meta brief (Growth+), clients (Agency).

## Accessibility
- axe-core (WCAG 2.0 A/AA rules) run on 35 pages: after fixes, **0 violations**. Fixed: unlabeled selects/inputs, missing `lang`, non-focusable scroll regions.
- Not covered by automation: screen-reader walkthrough, colour-contrast on canvas posters, keyboard flow of the poster tool. Manual audit still open.

## Open before Phase 7
Final pricing; legal text; real logo/brand assets; Tamil/Hindi copy; manual accessibility pass.
