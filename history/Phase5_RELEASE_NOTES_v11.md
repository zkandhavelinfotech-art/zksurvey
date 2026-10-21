# ZKSurvey v11 — Phase 5 close-out build

**Build:** v11 · **Phase:** 5 — Responsive / UI QA (close-out) · **Next roadmap release:** v12 → Phase 6 UI/UX Design Freeze (gap analysis: `ZKSurvey_v12_Phase6_Roadmap_Gap_Analysis.md`)

This build closes the items v10 left partial or static, adds the Coimbatore category-research survey and segmentation, and adds an Architecture & Integrations readiness page with Phase 7/8 design documents. It is still a **static prototype**: data lives in the browser, there is no real login, and no external service is called.

## 1. New: Coimbatore customer research (Milro liquid dishwash)
- Template **Coimbatore dishwash category research** — 30 questions in 8 sections (household profile → current behaviour → pain points → switching → new-product acceptance → purchase channels → concept → stay in touch), 4 logic rules, target sample 300.
- **Category-first rules built in:** new survey type *Category Research*; the client brand is hidden in the public runner; validation turns red if the brand appears before the concept section or in the intro; pain points are asked unprompted (Long Text) before the prompted, randomised list; the concept comes last.
- **Segments A–D** (existing liquid users, bar users, price-conscious families, convenience-focused households) as saved, editable rules — new **Segments** page with a cards view, a compare-segments table for any choice question, and sample-progress against the target.
- **Your 11 research questions are all covered** — mapping in `docs/Phase5_Coimbatore_Research_Playbook.md` (the *like* question was missing and was added).
- **ZK Growth360** (Research → Scale) section added to the Growth Framework page, with the client proposal sentence.
- Extra templates: Customer NPS, Event feedback.

## 2. v10 partial / static items — closed
| v10 item | v11 |
|---|---|
| Question Bank used a separate store | Rebuilt: reusable groups, insert a group or one question into any survey (also from the Builder's *From question bank* button) |
| Survey Templates page was a static page | Real: six templates create editable drafts; the Builder's *New survey* uses the same list |
| Settings saved nothing | Saved in the browser; plus workspace **export / import / reset** (JSON) |
| AI Insights was a static mock | **Insights**: rule-based findings from real responses; every line shows its rule and evidence size; clearly labelled *not AI* |
| Campaigns were only tags seen in responses | **Campaign entity**: name, survey, channel, dates, budget, audience, status; tracked link; **QR code** (download SVG); response / lead / cost-per-lead from the UTM tag |
| `campaign-builder`, `login`, `survey-templates` in old layout | Rebuilt on the current dark design system |
| `customer-dashboard`, `survey-preview`, 11 old `public/survey-*.html` pages | Replaced with redirects to the real Dashboard / Builder / runner |
| Demo numbers could be mistaken for real | Generated responses are flagged; a **Sample data** banner shows on every data page |
| Consent | Lead consent wording is configurable per survey; wording + timestamp stored with the lead |
| Architecture / integrations undocumented | **Architecture & Integrations** page; `docs/Phase7_Architecture_and_API.md`, `docs/Phase7_SQLServer_Schema.sql`, `docs/Phase8_Integrations_Plan.md` |
| Responsive QA | 28 pages × 3 widths (390 / 768 / 1360) checked for horizontal overflow and white backgrounds; fixes: header wrapping, split layouts, notification bell on mobile |

## 3. Not done in v11 (honest list)
- **No real authentication or access control** — the login page and role switcher only change which menu items show.
- **No server:** responses are stored in the browser that opens the survey, so real fieldwork from many phones needs Phase 7.
- **Integrations:** none are live. Meta, WhatsApp, Google Analytics/Ads, YouTube and email delivery are Phase 8; only tagged links and QR codes work.
- **AI narrative / real PDF-PPT reports:** Phase 9 (print-to-PDF only).
- **Multi-language:** a language label exists; no translated surveys.
- **Lead scoring formula:** not built.
- **Accessibility:** responsive and colour-background checks were run; a formal keyboard / screen-reader / WCAG contrast audit is a Phase 6 item.
- Demo data is synthetic (64 sample Coimbatore responses) — reset it in Settings before presenting real numbers.

## 4. Test result
Automated browser suite: 29/29 checks — full public run-through with UTM, logic rules, segments (add/delete), question bank (add/insert), templates, campaign + QR, settings persistence, export/import round-trip, insights, brand-bias validation, redirects, login, demo banner, regression (user survey → publish → response counted, not demo), 28-page responsive/background audit, no console errors.

## 5. Files
`docs/` Phase 7 architecture + SQL schema, Phase 8 plan, Phase 5 Coimbatore playbook · `history/` earlier release notes and gap analyses renamed with their phase.
