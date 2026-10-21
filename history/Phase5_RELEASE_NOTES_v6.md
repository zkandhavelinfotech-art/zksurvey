# ZKSurvey Static Product Prototype — v6 Release

## New: multi-survey support in Survey Builder
v5 made the Questions/Answer Options tabs functional, but they still edited a single shared
draft. This release turns that into a real per-survey data model:

- Survey Builder now has a **Working Survey** selector at the top. It reads the same survey list
  as `admin/surveys.html` (`localStorage: zk_surveys`), and each survey keeps its **own**
  question set (`localStorage: zk_builder_questions_map`, keyed by survey id) with its own set of
  sections.
- Opening a survey from the Surveys list (`Open` button) now deep-links straight into that
  survey's question set (`survey-builder.html?survey=<id>`).
- This directly closes the "no shared data model" gap called out in `GAP_ANALYSIS.md` for the
  Surveys ↔ Survey Builder relationship (the rest of that gap — Campaigns, Leads, Customers —
  is still open, see the updated gap analysis below).

## New: Scriptcraft Pro — Pre-Launch Survey
A second product, **Scriptcraft Pro** (professional screenwriting software), now has its own
seeded survey covering exactly what was asked for — existing users, new users, pricing strategy
and issues faced:

1. **Respondent Profile** — routes the respondent into "already use dedicated screenwriting
   software," "use general tools (Word/Docs/pen & paper)," or "new to screenwriting."
2. **Existing Software Experience** — which tool they use today, satisfaction, and their single
   biggest issue with it (pricing, learning curve, formatting/export, no collaboration, no cloud
   sync, bugs, no AI assistance).
3. **New / Alternative-Tool Users** — what they use instead, and what's stopped them from
   adopting dedicated software.
4. **Feature Priorities** — which capabilities matter most (formatting, cloud/mobile, real-time
   collaboration, AI assistance, export quality, offline, outlining tools, version history).
5. **Pricing Strategy** — two questions, deliberately not one:
   - *Freemium expectation:* "If core screenplay writing and formatting features were completely
     free, which of these would you still expect to pay extra for?" — this is the question that
     follows from the ₹50–150/month discussion: it tests which premium features justify a paid
     tier once the core writing experience is free, rather than assuming a hard price ceiling.
   - *Realistic price:* an open-ended "maximum monthly price you'd realistically pay" (a plain
     number field) plus a separate currency dropdown — matching the buyer-focused version you
     preferred over fixed price bands, since predefined ranges anchor respondents rather than
     revealing true willingness to pay.
6. **Issues & Feedback** — open text on their biggest frustration with screenwriting tools today.
7. **Stay Updated** — an optional launch-notification lead-capture question, mirroring the
   Milro survey's end-of-survey lead capture pattern.

All of these questions are fully editable through the same Questions / Answer Options CRUD
introduced in v5 — add, edit, delete, and bulk Excel/CSV import all work per survey now.

## Known limitation carried over from v5
Static prototypes opened directly as `file://` pages can have `localStorage` isolated per file in
some browsers. For the Working Survey selector and survey-to-builder linking to behave
consistently, open the prototype through a local server (e.g. `npx serve .` or
`python3 -m http.server`) rather than double-clicking the HTML files.

## Status
Phase 5 — Responsive / UI QA — **In progress.** Functional CRUD (v5) and a shared multi-survey
data model (v6) are both part of this phase; a full responsive/cross-device QA sweep of every
screen is still outstanding.
Phase 6–10 — unchanged, still pending (see README.md phase table).
