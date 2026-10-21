# ZKSurvey Static Product Prototype — v5 Release

## Rebrand
- Renamed the product from **ZKLaunchIQ** (formerly also floated as ZKMarketPulse) to **ZKSurvey** across every page, the sidebar logo, page titles, the README and all release notes.
- Locked the name in `admin/settings.html` (was listed as two placeholder names).

## New: functional Survey / Question / Answer CRUD
The prototype's forms and buttons were previously decorative (`data-toast` attributes with no
click handler wired up, or a generic "Prototype action completed" toast). This release makes the
survey-authoring workflow actually work in the browser, backed by `localStorage` (still no
backend — that's Phase 7):

- **Surveys** (`admin/surveys.html`): create, rename/edit status, and delete surveys from a real list.
- **Question Bank** (`admin/questions.html`): create, edit and delete reusable question groups.
- **Survey Builder → Questions tab**: add, edit and delete individual questions (text, section,
  type, required flag). Choice-type questions automatically get starter answer options.
- **Survey Builder → Answer Options tab**: pick any choice-based question and add, edit or delete
  its answer options; per-question settings (required, allow multiple, show "Other", randomise)
  now actually save.
- **Bulk import from Excel**: the Questions tab has an "Import File" control that accepts
  `.xlsx`, `.xls` or `.csv` (columns: `Section, Question, Type, Options, Required`, options
  pipe-separated). Matching question text updates the existing question; new text adds a
  question. A "Download Template" button provides a starter CSV. This uses SheetJS
  (loaded from a CDN) for `.xlsx`/`.xls`, with a built-in CSV parser as a dependency-free
  fallback — it's an optional convenience on top of the manual add/edit/delete flow, not a
  replacement for it.

## New files
- `js/crud.js` — shared localStorage store, modal dialog, confirm-delete, and the Excel/CSV
  import helpers reused by the three screens above.
- `GAP_ANALYSIS.md` — section-by-section comparison of the full project scope against what this
  static prototype currently covers.

## Status
Phase 1 — Complete
Phase 2 / 2B — Complete
Phase 3 — Complete
Phase 4 — Complete (static prototype)
Phase 5 — Responsive / UI QA — **Next** (this release delivers the functional-CRUD slice of Phase 5; a full responsive/cross-device QA pass across every screen is still outstanding)
Phase 6 — UI/UX Design Freeze — Pending
Phase 7 — React + ASP.NET Core + SQL Server — Pending
Phase 8 — Marketing & Platform Integrations — Pending
Phase 9 — AI Insights + Reports + Automation — Pending
Phase 10 — Production Deployment & SaaS Launch — Pending
