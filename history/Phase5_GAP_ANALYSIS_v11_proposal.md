# ZKSurvey — Gap Analysis v11 (scope vs. v10 build)

Current build: **v10** · Phase: **5 — Responsive / UI QA (final stretch)**
Next build: **v11** · Phase: **5 — close-out, ending with the Phase 6 design-freeze decision**

## 1. Where the 24-section scope stands after v10
| # | Area | Status |
|---|---|---|
| 1 | Objectives / core flow | **Working end to end** (survey → response → insight → report → strategy) |
| 2 | Roles | **Partial** — menu switcher only; no login, no enforced access |
| 3 | Customers / projects | Done |
| 4 | Survey Builder | Done |
| 5 | Conditional logic | Done |
| 6 | Public survey | Partial — no QR/WhatsApp embed, no real multi-language; 11 old Milro mock pages still exist beside the real runner |
| 7 | Campaign management | Partial — attribution is real; campaign as an entity (budget, audience) is not |
| 8 | Attribution | Done |
| 9 | Customer dashboard | Done (but `customer-dashboard.html` is an old static page, not the real Dashboard) |
| 10 | Analytics | Done |
| 11 | Leads | Mostly done — no lead scoring formula |
| 12 | AI insights | Static mock (Phase 9) |
| 13 | Growth framework | Done (presentation) |
| 14 | Strategy builder | **Done (v10)** |
| 15 | Content / creative testing | **Done at survey level (v10)**; live ad metrics need Phase 8 |
| 16 | Reports | Done (print to PDF; real PDF/PPT is Phase 9) |
| 17 | Notifications | **In-app done (v10)**; email/WhatsApp is Phase 8 |
| 18 | Administration | **Partial** — Users done; Settings is still a static form |
| 19–20 | Architecture / integrations | Not started by design (Phases 7–8) |
| 21 | Milro first customer | Done |
| 23 | Out of scope | Unchanged |
| 24 | Positioning | **Proven in the prototype** |

## 2. What is still static or disconnected (exact list)
Pages that do not use the shared data layer:
- `admin/questions.html` — Question Bank groups live in a separate store from real surveys (leftover from v5).
- `admin/settings.html` — static form, saves nothing.
- `admin/insights.html` — static mock; Phase 9 by design, but should be clearly labelled "sample".
- `admin/customer-dashboard.html`, `admin/campaign-builder.html`, `admin/survey-preview.html`, `admin/survey-templates.html`, `admin/login.html` — older v2B-style layout, not on the current design system.
- `public/survey-*.html` (11 files) — old Milro-only demo pages duplicated by the real runner (`public/run.html`).

## 3. Proposed v11 — Phase 5 close-out
1. **Retire or merge the duplicates:** replace the 11 `public/survey-*.html` pages and
   `customer-dashboard.html` with redirects to the real runner / Dashboard.
2. **Question Bank joins the real data:** "Question groups" become reusable question sets you can
   insert into any survey from the Builder.
3. **Survey Templates actually create surveys** (Milro, Scriptcraft, blank, NPS, event feedback).
4. **Bring the remaining legacy pages onto the dark admin-shell** (campaign-builder, login,
   survey-preview, settings) and make Settings persist.
5. **Label sample-only screens** (AI Insights) so nobody mistakes them for working analysis.
6. **Final responsive pass** at 390 / 768 / 1360 widths on every page, with screenshots, and a
   keyboard/contrast check — this is the literal Phase 5 deliverable.

## 4. Phase map — which build belongs to which phase
| Build | Phase | Notes |
|---|---|---|
| v4 – v10 | **Phase 5** | All iterations of the static prototype |
| **v11** | **Phase 5 (close-out)** | Items in section 3; ends Phase 5 |
| Design freeze tag | **Phase 6** | A decision on v11, not a new build. After it, no new screens. |
| Backend / React / SQL Server | **Phase 7** | New engineering project, not a "v12" zip |
| Integrations | Phase 8 | Meta, WhatsApp, Google Analytics/Ads, email |
| AI + reports + automation | Phase 9 | Real AI insights, PDF/PPT export, automations |
| Production launch | **Phase 10** | The actual final release |

## 5. Answer to "when is the last static release?"
**v11 is the proposed last static-prototype build.** If you approve it, it is tagged as the
Phase 6 design freeze and everything after that is Phase 7+ engineering. Items 1–6 above are
the full remaining list; if you prefer to freeze v10 as-is, items 1–5 can move into Phase 7
as cleanup tasks with no design risk.
