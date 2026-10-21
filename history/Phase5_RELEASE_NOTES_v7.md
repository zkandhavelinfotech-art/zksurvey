# ZKSurvey v7 — Rebrand, dark redesign and full Survey Builder

## Redesign
- New dark design system (`css/zk.css`) on all 34 pages: dark backgrounds, light text, purple-cyan accent. An automated check found no light backgrounds on any page.
- New ZKSurvey logo mark and wordmark ("Survey & Launch Intelligence") in header, sidebar and footer.
- Public header menu: Platform, Use cases, Survey Builder, Growth Framework, Demo survey, Open ZKSurvey (collapses to a menu on mobile).
- Footer on every page: "Powered by Zlandavel Infotech Pvt Ltd, Chennai, India" (also in the admin sidebar).
- Admin sidebar gains a Survey Builder link, correct active state, and becomes a scrolling top menu on mobile.
- Landing page: new "Any survey, any industry" section (Milro product launch, Scriptcraft Pro, blank/feedback/polls).

## Survey Builder (any industry)
Survey details, Sections, Questions, Answer options, Conditional logic, Preview and Publish workflow, all functional. See GAP_ANALYSIS.md section 1.
- Surveys list: create (blank / Milro / Scriptcraft template), duplicate, archive, restore, delete, open live link.
- Conditional logic engine with IF/AND/OR, show, hide, skip section, end survey, redirect, and a live logic trace in Preview.
- Publish: validation checklist, Draft → Published → Unpublished / Archived, shareable link `public/run.html?s=<slug>`, UTM campaign link generator, response counter.
- Excel/CSV import and CSV export. SheetJS is bundled in `js/vendor`, so import works offline.

## Sample surveys
- **Milro Dishwash** (published): 14 questions, rules for bar users, price concern, purchase intent, early end.
- **Scriptcraft Pro** (draft): existing / new / general-tool branching, issues faced, feature priorities, free-core expectation, open-ended price with currency, payment preference, lead capture.

## Notes
- Open through a local server (`python3 -m http.server`) rather than double-clicking, so localStorage is shared across pages.
- v7 uses new storage keys; older v5/v6 browser data is ignored.
- Static prototype: responses are stored in the browser only.
