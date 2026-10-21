# ZKSurvey — Gap Analysis v10 (scope vs. v9 build) + when the static-prototype releases end

Supersedes `GAP_ANALYSIS_v9.md`. Same 24-section scope and Survey Builder checklist as before.

## 1. What changed since v9
| Area | v9 before | v9 after (this build) |
|---|---|---|
| Customers / Projects | Static fake rows | Real CRUD hierarchy: Customer → Project → Survey, with the Builder able to link or quick-create one inline |
| Products | Static fake rows | Real, derived from projects |
| Campaigns | Static fake rows | Real, derived from each response's UTM tag |
| Sources | Static fake rows | Real, derived from each response's UTM tag |
| Responses / Leads | Viewable only | Exportable as CSV |
| Reports | Static cards, no generation | Real report generated from `ZKData.analyze()`, printable to PDF |

## 2. Section-by-section status (24-section scope)
| # | Area | Status | Notes |
|---|---|---|---|
| 1 | Objectives / core flow | **Mostly working** | Research → Validate → Capture → (Position/Test partial) → Launch-readiness signals → Measure all have real data behind them now. Only "Optimise/Grow" (Growth Strategy Builder) is still disconnected from the rest. |
| 2 | Roles | Not started | Still the single biggest scope-section with zero prototype coverage. |
| 3 | Customers and projects | **Done** | |
| 4 | Survey Builder | Done | Unchanged since v7, now also sets the project link. |
| 5 | Conditional logic | Done | Unchanged. |
| 6 | Public survey experience | Partial | Unchanged — no QR/WhatsApp embed, no real multi-language. |
| 7 | Campaign management | **Partial → mostly Done for reporting** | Attribution is real. Creating/budgeting a campaign (vs. just reading UTM tags already seen) is still not a real entity. |
| 8 | Attribution | **Done** | |
| 9 | Customer dashboard | Done | Unchanged since v8. |
| 10 | Market intelligence and analytics | Done | Unchanged since v8. |
| 11 | Lead management | Mostly done | Status pipeline works; lead scoring formula and CRM export are not built. |
| 12 | AI insights | Visual only | Phase 9. |
| 13 | Growth framework | Done (presentation) | Unchanged. |
| 14 | Growth strategy builder | Visual only | **Biggest remaining gap now that reporting is real** — doesn't read Analytics output. |
| 15 | Content and creative testing | Not started | Unchanged. |
| 16 | Reports | **Done (generation + print)** | True PDF/PPT file export still Phase 9. |
| 17 | Notifications | Not started | Unchanged. |
| 18 | Administration | Visual only | Unchanged. |
| 19–20 | Architecture / Integrations | Not started | Phase 7/8 by design. |
| 21 | Milro first customer | Done | |
| 22 | Phases | On track | See roadmap. |
| 23 | Out of scope for prototype | Unchanged | This is the section that answers "when does this end" — see part 4 below. |
| 24 | Positioning | **Mostly proven** | The full loop — survey → response → insight → report — now genuinely works end to end for the first time. Only the "Grow" (strategy/retargeting) half of the loop is still a mockup. |

## 3. Recommended v10 scope, in order
1. **Growth Strategy Builder reads real signals.** Auto-suggest a 30/60/90-day activity from each
   survey's top Analytics finding (e.g. "65% say poor grease removal → add a grease-removal demo
   video to the pre-launch plan"), with manual add/edit/delete same as everything else here.
2. **Content & Creative Testing screen.** Record message/creative variants (already referenced in
   the Marketing Message question type) and show which variant is winning, using the same
   per-question tally logic Analytics already has.
3. **A basic role switcher (not real auth).** A "viewing as: Super Admin / Agency / Customer /
   Marketing" selector that hides/shows nav items and a read-only Customer view. This validates
   scope section 2's navigation model cheaply, ahead of real login in Phase 7.
4. **Notifications (static feed, real triggers).** A bell icon with real events — "survey
   published", "new lead", "response milestone hit" — generated from the data that already exists,
   even though delivery (email/WhatsApp) stays Phase 8.
5. **Administration: users & settings.** Even without real auth, a static user list with roles
   assigned (pairs with item 3) closes scope section 18 at the prototype level.

## 4. When is the last release?
Short answer: **there is no fixed last v-number, but the list of things a *static* prototype can
honestly still improve is now short** — probably **one more build (v10) for item 1 above, and
maybe a v11 for items 2–5** — after which Phase 5 (Responsive/UI QA) is reasonably called
complete and the right move is Phase 6 (**design freeze**), not another v-release.

The reason there's no fixed number: scope section 23 draws a hard line that no amount of
JavaScript-and-localStorage iteration can cross — real authentication, a real database,
live third-party APIs, a real payment gateway, production AI, and multi-tenant security. Those
can only be built in Phase 7 (React + ASP.NET Core + SQL Server) onward. So "the last release" is
really **two different milestones**, and it's worth being explicit about which one is being asked
for:
- **Last static-prototype release** — whenever the remaining items in section 3 above are either
  built or explicitly deferred and you're satisfied with the look, feel and flows. Realistically
  **v10–v11**, i.e. one or two more iterations like this one, not many more — most of what a
  reviewer actually clicks through is already real.
- **Last release before production** — that's Phase 6, the UI/UX design freeze: no new screens
  after that, only engineering (Phase 7–10) rebuilding the same flows on React, ASP.NET Core and
  SQL Server, then integrations (Phase 8), AI/reports/automation (Phase 9), and finally production
  deployment (Phase 10) — which is the actual last release of ZKSurvey as a product.

In short: expect **1–2 more v-releases** to close the static prototype's remaining gaps, then a
freeze, then the real build. If you'd rather freeze now and carry items 2–5 as known gaps into
Phase 7 directly, that's a reasonable call too — nothing in section 3 blocks a freeze, it's just
work that's cheaper to validate now than after the rebuild starts.

## 5. Roadmap
| Phase | Scope | Status |
|---|---|---|
| 1–4 | Definition, static prototype, dashboard, growth framework | Complete |
| **5** | **Responsive / UI QA** | **In progress, nearly done.** Done: dark design system, full Survey Builder (v7), real Responses/Leads/Analytics/Dashboard (v8), real Customers/Projects/Campaigns/Sources/Reports/exports (v9). Remaining: Growth Strategy Builder on real signals, Content/Creative testing, role switcher, notifications, admin users/settings (v10–v11, see section 3). |
| 6 | UI/UX freeze | Pending — realistically 1–2 releases away |
| 7 | React + ASP.NET Core + SQL Server | Pending |
| 8 | Integrations | Pending |
| 9 | AI insights, reports, automation | Pending |
| 10 | Production deployment and SaaS launch | Pending — the actual last release |
