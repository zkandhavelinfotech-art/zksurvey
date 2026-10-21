# ZKSurvey v8 — Real data on Dashboard, Analytics, Responses and Leads

v7 built a complete, working Survey Builder on top of sample data. v8 closes the next biggest
gap from `GAP_ANALYSIS_v7.md`: the screens *after* the builder were still static mockups. They
now read real responses.

## What's now real (previously static mock screens)
- **Responses** — every response across every survey, with a per-survey filter, a completion-rate
  KPI row (responses vs. survey starts), a channel chip per row, and a "View" modal that shows
  every answer for that respondent.
- **Leads** — every Lead Capture answer (with consent) pulled out of responses, with the scope's
  status pipeline (New → Interested → Qualified → Contacted → Converted) as an editable dropdown
  that persists in this browser.
- **Analytics** — pick any survey; every Single/Multiple Choice, Dropdown, Yes/No, Image Choice
  and Ranking question gets a real tallied bar chart from actual answers, plus auto-generated
  "68% of respondents said X" signal cards and a response-source breakdown.
- **Dashboard** — survey tabs across the real survey list; KPIs (total responses, leads captured,
  completion rate, top channel), response-source bars, top consumer signals, a key question
  breakdown (auto-picks a purchase-intent-style question) and a recommended-message panel, all
  computed from the selected survey's actual responses.

## Demo data, scoped correctly
Earlier seeding accidentally generated synthetic responses for **any** newly published survey —
including ones a reviewer creates themselves — which made every test survey look pre-populated.
Fixed: synthetic demo responses are now seeded **once, ever**, and **only** for the two known
sample surveys (Milro Dishwash and Scriptcraft Pro). A survey you create and publish starts with
zero responses, as it should. Verified with an automated test that publishes a brand-new survey
and confirms it shows the "no responses yet" empty state.

## Also new
- Response "starts" are now tracked (`ZKData.addStart`) when a respondent clicks "Start survey" on
  the public link, so completion rate (responses ÷ starts) is real, not assumed.
- `ZKData.analyze(surveyId)` is a new shared function — one place that turns a survey's responses
  into tallies, sources, completion rate and lead count — used by both Analytics and Dashboard so
  the two screens never disagree with each other.
- Milro's dashboard numbers now genuinely say "65% — Poor grease removal" because 65% of the
  seeded respondents actually answered that; the figure is computed, not hand-typed copy.

## Verified (automated, headless browser)
- 17 existing builder/publish/preview checks still pass.
- 7 new checks: response modal, lead status persistence across reload, analytics/dashboard empty
  states on a draft survey, dashboard switching between surveys, and the seeding-isolation fix.
- 34-page scan: no light/white backgrounds anywhere, no console errors on any page.

## Known limits carried forward
- Campaigns, Sources, Customers, Products, Growth Strategy Builder and Reports are still static —
  see `GAP_ANALYSIS_v9.md` for the prioritised list of what's next.
- All data is still browser localStorage; nothing is sent to a server (Phase 7).
