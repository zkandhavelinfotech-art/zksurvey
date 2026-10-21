# ZKSurvey v9 — Customers/Projects hierarchy, real attribution, exports, Reports

Closes items 1–4 of `GAP_ANALYSIS_v9.md`'s recommended scope (item 5 — Growth Strategy Builder on
real signals, and a role switcher — is deferred; see `GAP_ANALYSIS_v10.md`).

## Customers → Projects → Surveys hierarchy
- **Customers** page is now real: create/edit/delete customers, add/edit/delete projects under
  each one. Seeded with Milro → Dishwash Product Launch and Scriptcraft Pro → Pre-Launch
  Validation, matching the two sample surveys.
- **Survey Builder → Survey Details** has a new **Project** picker. Choosing a project auto-fills
  Customer/Product/Industry; a "+ New" button lets you create a customer and project inline
  without leaving the builder. Free-text Customer/Product fields still exist for surveys that
  aren't linked to a project (unlinked is a valid state, not an error).
- **Products** page is now a real, derived list of every product across every project, with which
  customer/project and surveys it belongs to.
- Deleting a customer or project never deletes a survey — it just unlinks it (confirmed by test).

## Real attribution (Campaigns & Sources)
Both pages read the same UTM data every response already carries (no new data entry needed):
- **Sources**: total responses per channel across every survey, with percentage share.
- **Campaigns**: every distinct campaign tag seen in responses, with source, medium, which
  survey(s), response count and the active date range.

## Response & lead export
- **Responses** and **Leads** both have an **Export CSV** button — full answer set per response
  (one column per question) or the lead fields plus status. Matches the format of the Excel
  import already in the Builder, so a round trip (export → edit → re-import) is possible.

## Reports
- **Reports** page: pick a survey and a report type (Pre-Launch, Market Research, Survey,
  Customer Insight, Product Validation), click Generate — it builds a real report from
  `ZKData.analyze()` (same numbers as Analytics/Dashboard, so they can never disagree) and a
  **Print / Save as PDF** button for a clean, print-only layout. Native PDF/PPT file export is
  still a Phase 9 engineering item; this is the browser-print bridge until then.

## Verified (automated, headless browser)
- All 17 existing builder/publish/preview/logic checks still pass — nothing broke.
- 14 new checks: customer/project CRUD, project-linking auto-fill, quick-create from the builder,
  Products reflecting a new project, Sources/Campaigns showing real data, Reports rendering real
  findings, CSV downloads for both Responses and Leads (file contents checked, not just "it
  downloaded"), and that deleting a customer unlinks rather than deletes its survey.
- 34-page scan: no light backgrounds, no console errors anywhere.

## Known limits carried forward
Growth Strategy Builder is still static and doesn't read Analytics signals yet; there's still no
login or role switching. See `GAP_ANALYSIS_v10.md` for what's next and a straight answer on how
many more of these static-prototype releases are actually left.
