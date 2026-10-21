# ZKSurvey — v12 / Phase 6 Roadmap Gap Analysis (scope vs. the v11 build)

**Reviewed build:** v11 · Phase 5 close-out
**Next roadmap release:** **v12 · Phase 6 — UI/UX Design Freeze**
Supersedes `history/Phase5_GAP_ANALYSIS_v11_proposal.md`. Scope source: the 24-section project scope.

## 1. How v10's partial / static / architecture items ended up
| # | v10 gap | v11 result | Still open |
|---|---|---|---|
| 1 | Question Bank on a separate store | **Closed** — reusable groups insert into any survey | Excel/CSV import into the bank |
| 2 | Survey Templates static | **Closed** — 6 working templates | Saving your own survey as a template |
| 3 | Settings static | **Closed** — persists; export / import / reset | Server-side settings (Phase 7) |
| 4 | AI Insights static mock | **Partly closed** — real rule-based insights, labelled | AI narrative, risk and recommendations (Phase 9) |
| 5 | Campaign was not an entity | **Closed** — entity, tracked link, QR, response/lead/cost counts | Ad-platform spend and clicks (Phase 8) |
| 6 | Legacy pages in old layout | **Closed** — rebuilt or redirected | — |
| 7 | 11 duplicate `public/survey-*` pages | **Closed** — redirect to the real runner | — |
| 8 | Roles: menu switcher only | **Open** by design | Real login, RBAC, tenant isolation (Phase 7) |
| 9 | Public survey: no QR / WhatsApp embed / multi-language | **Partly closed** — QR + tagged links done | WhatsApp embed (Phase 8); translated surveys (design in Phase 6, build Phase 7) |
| 10 | Lead scoring formula | **Open** | Define formula in Phase 6, build Phase 7 |
| 11 | Reports are print-to-PDF | **Open** | Real PDF / Excel / PowerPoint (Phase 9) |
| 12 | Notifications in-app only | **Open** | Email / WhatsApp (Phase 8) |
| 13 | Architecture undocumented | **Closed as design** — page, API contract, SQL schema draft | Not built; not reviewed by a DBA |
| 14 | Integrations undocumented | **Closed as plan** — Phase 8 plan, status page | None are live |
| 15 | Demo vs real data unclear | **Closed** — flagged and bannered | — |
| 16 | Consent | **Partly closed** — wording + timestamp stored with the lead | Withdrawal flow, audit trail (Phase 7) |

## 2. The 24-section scope after v11
| Area | Status |
|---|---|
| 1 Objectives / core flow | Working end to end in the prototype |
| 2 Roles | Partial (menu only) |
| 3 Customers / projects | Done |
| 4 Survey Builder (+ category research, bank, templates) | Done |
| 5 Conditional logic | Done |
| 6 Public survey | Mostly done — no WhatsApp embed or translation |
| 7 Campaigns | Done at entity level; platform sync is Phase 8 |
| 8 Attribution | Done |
| 9 Customer dashboard | Done (merged into Dashboard) |
| 10 Analytics + segments | Done |
| 11 Leads | Mostly done — no scoring formula |
| 12 AI insights | Rule-based only |
| 13–15 Growth framework, strategy, creative testing | Done (live ad metrics need Phase 8) |
| 16 Reports | Print only |
| 17 Notifications | In-app only |
| 18 Administration | Partial — users and settings work in the browser; roles not enforced |
| 19 Architecture | Designed, not built |
| 20 Integrations | Planned, none live |
| 21 Milro first customer | Done, plus the Coimbatore category-research programme |
| 24 Positioning | Demonstrated |

## 3. What v12 / Phase 6 is
Phase 6 is **a freeze, not a feature release.** v12 is the build of v11 after the checks below, tagged as the design reference for Phase 7. After the tag, new screens are a change request.

### Phase 6 checklist (the real remaining work)
| # | Item | Why it matters |
|---|---|---|
| 1 | Accessibility audit: keyboard order, focus states, labels, colour contrast to WCAG AA, screen-reader pass on the public survey | Not done yet; the runner is the one screen respondents touch |
| 2 | Empty / error / loading states for every screen (including slow-network and offline on the public runner) | Prototype mostly shows the happy path |
| 3 | Real-device pass: low-end Android Chrome, iOS Safari, 360 px width, WhatsApp in-app browser | Coimbatore respondents will mostly arrive from WhatsApp on phones |
| 4 | Component inventory and design tokens written down (colours, type, spacing, buttons, tables, modals) | Gives the React build a spec |
| 5 | Copy freeze: labels, validation messages, consent wording, thank-you text, Tamil copy for the runner | Translation scope depends on this |
| 6 | Decide the lead-score formula and statuses | Needed before the Leads table is designed |
| 7 | Report layouts (survey, segment, pre-launch) designed as print/PDF pages | Needed for Phase 9 export |
| 8 | Role × screen matrix (who can see/edit what) | Becomes the RBAC spec |
| 9 | Customer walkthrough and sign-off with Milro on the Coimbatore survey and dashboard | The freeze needs a named approver |
| 10 | Data-shape freeze: survey definition, response, segment, campaign JSON | Phase 7 schema depends on it |

**Exit criteria for Phase 6:** items 1–10 done or consciously deferred in writing; no open "bad" findings from the accessibility and real-device passes; sign-off recorded.

## 4. After the freeze
| Phase | Scope | Closes these gaps |
|---|---|---|
| **7 — React + ASP.NET Core + SQL Server** | Real login/RBAC, multi-tenant database, server-side responses and consent, analytics API, settings, import of the prototype JSON | Roles, persistence, real fieldwork, consent audit, architecture |
| **8 — Integrations** | Email → WhatsApp → GA → Meta → Google Ads → YouTube (one at a time) | Notifications, ad metrics, WhatsApp embed |
| **9 — AI + reports + automation** | AI narrative on top of the rule-based insights, PDF/Excel/PowerPoint, automations | Insights, reports |
| **10 — Production deployment** | Cloud hosting, monitoring, backups, launch | — |

## 5. Phase map
| Build | Phase | Status |
|---|---|---|
| v4 – v10 | Phase 5 | Delivered |
| **v11** | **Phase 5 (close-out)** | **This build** |
| **v12** | **Phase 6 — design freeze** | Roadmap above; a checklist and tag on v11, not a feature build |
| Phase 7 project | Phase 7 | New engineering project (not a "v13" zip) |
| Phase 8 / 9 | Phase 8 / 9 | After Phase 7 |
| Production launch | **Phase 10** | The actual final release |

**Answer to "what is the last static release?"** v12 — and only if you approve the freeze. Everything after it is engineering in Phases 7–10.

## 6. Risks to raise now
1. The prototype cannot collect real responses from several phones; Coimbatore fieldwork waits for Phase 7 (or a stop-gap such as a hosted form tool, outside this product).
2. WhatsApp-group sampling is a convenience sample; report results as direction, with margins of error stated.
3. WhatsApp Business template approval and Meta app review take weeks — start the paperwork during Phase 7.
4. Personal data (name, mobile, city) arrives with Phase 7 — consent, retention, deletion and access rules must be agreed before real collection.
