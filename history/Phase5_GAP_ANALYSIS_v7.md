# ZKSurvey — Gap Analysis v7 (full project scope vs. this prototype)

Scope source: the 24-section ZKLaunchIQ/ZKSurvey project scope (pasted again), plus the new asks:
any-industry Survey Builder (Milro new-product launch first, Scriptcraft Pro software pre-launch second),
ZKSurvey rebrand, logo/header/menu/footer "Powered by Zlandavel Infotech Pvt Ltd, Chennai".

Legend: **Done** = works end to end in the prototype · **Partial** = real for part of it · **Visual only** = screen exists with sample data · **Not started**

## 1. Survey Builder (your headline ask)
| Requirement | Status | Notes |
|---|---|---|
| Create / edit / duplicate / delete survey | Done | Surveys list + builder. Blank survey works for any industry; Milro and Scriptcraft Pro are templates. |
| Survey details (title, type, industry, customer, product, description, language, time, lead capture, thank-you) | Done | Autosaves. Language is a label only (no translation engine). |
| Sections: create, rename, reorder, duplicate, delete | Done | Deleting a section removes its questions and any logic that depended on them (you are told). |
| Question types (all 19 in scope) | Done | All 19 render in preview and public runner. Image Choice has text only (no image upload yet). |
| Questions: add, edit, reorder, duplicate, delete, required, help text | Done | |
| Answer options: add, edit, reorder, delete, bulk add, "Other", randomise | Done | |
| Optional Excel / CSV upload and export | Done | .xlsx/.xls/.csv; same text = update, new text = add, unknown section = created. SheetJS is bundled, works offline. |
| Conditional logic: IF / AND / OR, show, hide, skip section, end survey, redirect | Done | Real engine, validated for ordering. Scriptcraft existing-vs-new branching and Milro "Dishwash Bar" / "Price concern" / "Definitely" rules all run. |
| Preview (desktop / mobile) with logic trace | Done | Shows which questions are hidden and why. |
| Publish workflow: Draft → Validate → Published → Unpublished / Archived / Restore | Done | Checklist blocks publishing when there are errors; unpublished links close. |
| Public survey link + UTM campaign link | Done | `public/run.html?s=<slug>` captures utm_* with each response. |

## 2. Scope sections 1–24
| # | Area | Status | What is missing |
|---|---|---|---|
| 1 | Objectives / core flow | Partial | Survey → response works; response → insight → strategy is not connected. |
| 2 | Roles (Super Admin, Agency, Customer, Marketing, Respondent) | Not started | No login, no roles. Respondent role is real (public link). |
| 3 | Customers and projects | Visual only | No Customer → Project → Survey hierarchy. Survey has free-text customer/product. |
| 4 | Survey Builder | **Done** | See table above. |
| 5 | Conditional logic | **Done** | Rules can only look backwards (a rule may only depend on earlier questions). |
| 6 | Public survey experience | Partial | Mobile-first runner is real. QR, WhatsApp, embed and multi-language are not. Old static `public/survey-*.html` demo pages are still separate Milro mock pages. |
| 7 | Campaign management | Visual only | Campaign screens are not linked to surveys. Only the UTM link generator is real. |
| 8 | Attribution | Partial | UTM stored with each response; no source report reads it yet. |
| 9 | Customer dashboard | Visual only | Static numbers. Does not read real responses. |
| 10 | Market intelligence and analytics | Visual only | No aggregation of collected answers. |
| 11 | Lead management | Partial | Lead Capture question with consent is real and stored in responses; Leads screen and status pipeline are not connected. |
| 12 | AI insights | Visual only | Out of scope until Phase 9. |
| 13 | Growth framework | Done (presentation) | |
| 14 | Growth strategy builder (30/60/90) | Visual only | |
| 15 | Content and creative testing | Not started | No screen to record variants and results. |
| 16 | Reports | Visual only | No generation or export. |
| 17 | Notifications | Not started | |
| 18 | Administration (users, roles, settings) | Visual only | |
| 19 | Architecture (React / ASP.NET Core / SQL Server) | Not started | Phase 7. Data shapes in `js/store.js` are written to map to API/DB tables. |
| 20 | Integrations | Not started | Phase 8. |
| 21 | Milro first customer | Done | 14-question published survey with 4 logic rules. |
| 22 | Phases | On track | See roadmap below. |
| 23 | Out of scope for prototype | Unchanged | Real auth, DB, live APIs, payments, AI, multi-tenant security, cloud. |
| 24 | Positioning (not a survey tool) | Partial | The landing page says it; the product will only prove it once responses flow into insights. |

## 3. Scriptcraft Pro survey gaps
Covered: existing vs new vs general-tool writers, issues faced, feature priorities, free-core expectation, open-ended maximum price with currency, preferred payment model, frustration, launch-notification lead capture, with real skip logic.

Still missing (our thoughts):
1. **Pricing method.** One open "maximum price" question is a good start, but it only gives a ceiling. The standard upgrade is Van Westendorp (four price questions: too cheap, cheap, expensive, too expensive) or Gabor-Granger (accept or reject a few specific prices). Both give an acceptable price range instead of one number. Recommended as an optional second block.
2. **Test the plan idea, not only the price.** Show 2–3 short plan descriptions (Free core, Pro, Studio) and ask which they would pick. That validates the "full free writing, paid premium features" model directly.
3. **Currency handling.** Answers arrive as "amount + currency". Analytics will need conversion to INR, plus outlier handling (someone entering 5000). Not built yet.
4. **Segmentation.** Analyse willingness to pay by segment: student vs professional, India vs other countries, existing-tool users vs new. The survey collects the fields; no analysis screen exists.
5. **Sample bias.** Writers reached via one WhatsApp group will not represent the market. Track source with UTM and report by source.

## 4. Things missing from the scope itself (recommend adding)
1. **Privacy and consent (India DPDP Act 2023).** Lead capture needs purpose text, consent record with timestamp, opt-out, retention period and deletion on request. Consent checkbox exists; the rest does not.
2. **Survey versioning.** Editing a published survey after responses exist will break old answers. Need version snapshots or "edit creates v2".
3. **Response quality.** Duplicate-response limit, bot protection (CAPTCHA), speeding detection, attention checks, quotas and screeners.
4. **Response export and webhooks.** CSV/Excel export of responses and a webhook to CRM or Google Sheets.
5. **Real multi-language.** Tamil/Hindi text per question, not only a language label.
6. **Audit log and team collaboration.** Who changed a published survey, comments and approvals.
7. **Accessibility and low-bandwidth.** Keyboard and screen-reader use; light pages for weak mobile networks.
8. **Templates library.** Save any survey as a reusable template (product launch, software pre-launch, NPS, event feedback).
9. **Billing and plans for ZKSurvey itself.** The scope excludes payments; a SaaS needs plan limits (surveys, responses, seats) before launch.
10. **Branding per customer.** Logo, colours and custom domain on the public survey (white-label for agencies).

## 5. Roadmap
| Phase | Scope | Status |
|---|---|---|
| 1 | Product definition and architecture | Complete |
| 2 / 2B | Static prototype and full static product | Complete |
| 3 | Customer dashboard | Complete |
| 4 | Growth framework + dark UI redesign | Complete |
| **5** | **Responsive / UI QA** | **In progress.** Done: dark design system on all 34 pages (checked: no light backgrounds), shared header/footer/logo, mobile menus, full builder. Remaining: cross-device pass on the 20 older admin pages, wire Customers/Campaigns/Leads/Analytics to real survey data, replace old Milro-only demo pages with the runner. |
| 6 | UI/UX freeze | Pending |
| 7 | React + ASP.NET Core + SQL Server | Pending |
| 8 | Integrations | Pending |
| 9 | AI insights, reports, automation | Pending |
| 10 | Production deployment and SaaS launch | Pending |
