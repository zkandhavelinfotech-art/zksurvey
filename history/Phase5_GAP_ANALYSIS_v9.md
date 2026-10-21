# ZKSurvey — Gap Analysis v9 (scope vs. v8 build)

This supersedes `GAP_ANALYSIS_v7.md`. Same 24-section scope and the Survey Builder checklist;
updated to reflect what v8 actually closed, and what the next build (v9) should target.

## 1. What changed since v7
| Area | v7 | v8 |
|---|---|---|
| Responses screen | Static 5 fake rows | Real, filterable by survey, per-response answer viewer |
| Leads screen | Static 5 fake rows | Real leads pulled from Lead Capture answers, editable status pipeline |
| Analytics | Static mock numbers | Real per-question tallies from actual responses, for any survey |
| Dashboard | Hardcoded Milro copy | Real KPIs/signals for whichever survey's tab is selected |
| Demo data | N/A | Synthetic data for Milro + Scriptcraft only, seeded once; user-created surveys start empty (bug from the first attempt was caught and fixed) |

## 2. Section-by-section status (24-section scope)
| # | Area | Status | Notes |
|---|---|---|---|
| 1 | Objectives / core flow | Partial → **Better** | Response → insight now works (Analytics/Dashboard). Insight → strategy (Growth Strategy Builder) still not connected. |
| 2 | Roles | Not started | Still no login/roles. |
| 3 | Customers and projects | Visual only | Unchanged. Biggest structural gap now that Builder/Analytics/Leads are real. |
| 4 | Survey Builder | Done | Unchanged from v7. |
| 5 | Conditional logic | Done | Unchanged. |
| 6 | Public survey experience | Partial | Unchanged. |
| 7 | Campaign management | Visual only | Unchanged — campaigns still aren't linked to the UTM data responses already carry. |
| 8 | Attribution | **Partial → Done for reporting** | Responses/Dashboard/Analytics all read `utm_source` per response now. Sources/Campaigns screens still don't. |
| 9 | Customer dashboard | **Done** | Real per-survey KPIs. |
| 10 | Market intelligence and analytics | **Done** | Real per-question tallies and auto-insights. |
| 11 | Lead management | **Partial → mostly Done** | Capture, list and status pipeline are real. Lead scoring and CRM export are not. |
| 12 | AI insights | Visual only | Unchanged, Phase 9. |
| 13 | Growth framework | Done (presentation) | Unchanged. |
| 14 | Growth strategy builder | Visual only | Unchanged — does not read Analytics output yet. |
| 15 | Content and creative testing | Not started | Unchanged. |
| 16 | Reports | Visual only | Unchanged — now has real data (Analytics/Dashboard) it could export from. |
| 17 | Notifications | Not started | Unchanged. |
| 18 | Administration | Visual only | Unchanged. |
| 19–20 | Architecture / Integrations | Not started | Phase 7/8. |
| 21 | Milro first customer | Done | Now has 46 real-looking responses with real analytics behind it. |
| 22 | Phases | On track | See roadmap below. |
| 23 | Out of scope for prototype | Unchanged | |
| 24 | Positioning | **Partial → Better** | Response → insight is now a real, working loop for the first time. |

## 3. Recommended v9 scope (biggest remaining gaps, in order)
1. **Campaigns and Sources, wired to real attribution.** The data already exists in every
   response (`utm_source`, `utm_medium`, `utm_campaign`). Campaigns/Sources just need to read it,
   the same way Analytics now does — this is the cheapest high-value fix left.
2. **Customers → Projects → Surveys hierarchy.** Right now a survey's "customer" and "product" are
   free-text fields on the survey itself. Promoting Customer and Project to real entities (so one
   customer can have several projects, and several surveys per project) is the structural gap
   every other visual-only screen (Customers, Products, Reports) depends on.
2a. **Response exports.** Responses and Leads tables need a "Download CSV" button — small effort,
   immediately useful, and the natural companion to the Excel import already in the Builder.
3. **Reports.** With Analytics now real, a Report can literally be "Analytics for survey X,
   rendered as a page" — the hard part (the numbers) already exists.
4. **Growth Strategy Builder reading real signals.** Auto-suggest a 30/60/90-day activity from the
   top Analytics signal (e.g. "65% say poor grease removal → add a grease-removal demo video to
   the pre-launch plan").
5. **Roles and a basic login gate.** Even a static role switcher (no real auth) would validate the
   navigation model described in scope section 2 before Phase 7 build real RBAC.

## 4. Roadmap
| Phase | Scope | Status |
|---|---|---|
| 1–4 | Definition, static prototype, dashboard, growth framework | Complete |
| **5** | **Responsive / UI QA** | **In progress — meaningfully further along.** Done: dark design system (34 pages, no light backgrounds), full Survey Builder (v7), real Responses/Leads/Analytics/Dashboard on actual response data (v8). Remaining: Campaigns/Sources attribution, Customers/Projects hierarchy, response export, Reports, Growth Strategy Builder wired to real signals (see v9 scope above). |
| 6 | UI/UX freeze | Pending |
| 7 | React + ASP.NET Core + SQL Server | Pending — `js/store.js`'s shapes (`analyze()`, response/question/rule objects) are written to map cleanly onto future API endpoints and DB tables |
| 8 | Integrations | Pending |
| 9 | AI insights, reports, automation | Pending |
| 10 | Production deployment and SaaS launch | Pending |
