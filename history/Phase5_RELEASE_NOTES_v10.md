# ZKSurvey v10 — Phase 5 (Responsive / UI QA): Strategy, Content Testing, Roles, Notifications, Users

Build: **v10** · Roadmap phase: **Phase 5 — Responsive / UI QA (in progress, final stretch)**
Closes the five items recommended in `GAP_ANALYSIS_v10.md`.

## What's new
1. **Growth Strategy Builder (rebuilt, scope §14)** — reads the selected survey's real Analytics
   signals: Audience, Core problem and Core message cards, plus auto-suggested starter activities
   in 30 / 60 / 90-day windows (e.g. "Create content addressing 'Poor grease removal' (65% of
   respondents)"). Every activity has Objective, Channel, Task, Owner, Start/End, Budget, KPI and
   Status, with add / edit / delete. Auto-suggestions only fill an empty plan once; your edits are
   never overwritten.
2. **Content & Creative Testing (new, scope §15)** — ranks every message/creative-style question
   in a survey by respondent preference, plus a manual "Creative tests" log (Testing / Winner /
   Retired) for variants run outside the survey. Preference here is *stated* preference from the
   survey, not live ad performance — views/clicks/CTR need the Phase 8 ad integrations.
3. **Role switcher (scope §2)** — "Viewing as" selector in the sidebar: Super Admin, Agency /
   Consultant, Customer, Marketing Team. Each role sees only its own menu (Customer: Dashboard,
   Responses, Analytics, Insights, Growth Framework, Reports). Choice persists across pages.
4. **Notifications (scope §17)** — 🔔 bell on every admin page listing real events derived from
   your data: survey published, response milestones (10/25/50/100), new leads.
5. **Users (new, scope §18)** — add / edit / remove users with the four roles. Settings and Users
   are Super Admin only.

## Important honesty notes
- The role switcher only changes what the **menu shows**. It is *not* access control: typing a
  page URL directly still opens it. Real login and enforced permissions are Phase 7.
- Notifications are an in-app list only. No email/WhatsApp delivery (Phase 8).
- AI Insights is still a static mock (Phase 9).

## Fixes found while testing
- Notification bell initially showed "No notifications yet" even though events existed — it checked
  `window.ZKData`, but `ZKData` is a top-level `const` and is not on `window`. Fixed.
- With more menu links the sidebar was clipped on shorter screens (Settings/Users unreachable).
  The sidebar now scrolls.

## Verified (automated, headless browser)
- 17 existing builder / publish / preview / logic checks: all pass.
- 11 new checks: strategy auto-suggest + add/delete, empty-signal hint, content-test add/edit/delete,
  user add/remove, Customer and Marketing role menus, notifications content.
- 36-page scan: no light backgrounds, no console errors.
