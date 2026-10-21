# Phase 8 — Integrations plan (design draft)

Status: **not started** (as of v13 / Phase 7). Already real: UTM-tagged links and QR codes, tracked short links with click counts and Open Graph link previews, SMTP email, Razorpay checkout. No social or ad-platform API is called yet.

Principle from the scope: integrations are added one at a time; the first production release must not depend on all of them.

| Order | Integration | Purpose | What is needed | Risk / note |
|---|---|---|---|---|
| 1 | QR + tagged links | Offline → digital | Already working in v11 | None |
| 2 | Email | Campaign and notification mail | Transactional provider, SPF/DKIM, unsubscribe | Consent wording must match stored consent |
| 3 | WhatsApp Business Platform | Lead communication and ordering | Approved business account, message templates, opt-in proof | Template approval lead time; opt-in must come from `ConsentRecords` |
| 4 | Google Analytics | Website behaviour | GA4 property, measurement id, event mapping | Cookie consent on public pages |
| 5 | Meta / Instagram / Facebook | Audience acquisition, ad metrics | App review, Marketing API access, token refresh | Longest approval; start early |
| 6 | Google Ads | Paid acquisition metrics | Developer token, OAuth | Needed for CAC reporting |
| 7 | YouTube | Video campaign metrics | Data API key / OAuth | Lowest priority |

Each integration needs: owner, credentials store (secrets vault), failure/retry behaviour, a "disconnected" UI state, and a test account.
