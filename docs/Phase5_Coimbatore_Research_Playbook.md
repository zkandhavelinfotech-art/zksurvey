# Phase 5 — Coimbatore customer-research playbook (Milro liquid dishwash launch)

Template in the app: **Templates → Coimbatore dishwash category research** (30 questions, 8 sections, 4 logic rules, 4 segments, target 300).
Public link once published: `public/run.html?s=coimbatore-dishwash-research`

## 1. Aim and sample
Survey **200–500 households** in Coimbatore before launch (the brief said 100–500; 200 is the practical floor for comparing four segments). With a simple random sample, the margin of error at 95% confidence is roughly ±9.8% at 100, ±6.9% at 200, ±5.7% at 300 and ±4.4% at 500 responses — and each segment has fewer people than the total, so segment figures are wider. Responses gathered through WhatsApp, Instagram or QR are a convenience sample, not a random one: treat results as strong direction, not as market share. The survey has a *target sample* field and the Segments page shows progress against it.

## 2. Rules the survey follows (category first, not brand first)
1. **Do not name the client brand** until the concept section. The runner hides the client name for the "Category Research" type, and the Builder's validation turns red if the brand appears in an earlier question or in the intro.
2. **Ask the problem unprompted first** (Long Text), then show the prompted list. Prompted lists are randomised.
3. **Do not educate early.** The concept ("needs less liquid per wash…") appears in the second-to-last section, after behaviour, pain, switching, trial and channels.
4. **Neutral introduction:** "We are researching everyday dishwashing problems faced by families in Coimbatore. We are not asking you to buy anything…"
5. **Consent with proof:** lead capture shows the survey's consent wording and stores the wording and a timestamp with the lead.

## 3. Your research questions → where they are in the survey
| Your question | Survey question | Section |
|---|---|---|
| Which dishwash product do you use? | Which product do you mainly use to wash utensils at home? | Current behaviour |
| Which brand do you use? | Which brand do you use today? | Current behaviour |
| What do you spend monthly? | About how much do you spend on dishwash products each month? | Current behaviour |
| What do you like? | What do you like most about the product you use now? (added in v11) | Current behaviour |
| What do you dislike? | In your own words, what is the most difficult part…? · Which of these have you faced…? · bar-dislike follow-up | Pain points |
| Is grease removal important? | How important is removing grease and oil for you? (1–5) | Pain points |
| Liquid, bar or powder? | Which format would you prefer? | New-product acceptance |
| Pack size? | Which pack size would you buy first? | New-product acceptance |
| What price is reasonable? | What price feels reasonable for a 500 ml pack? | New-product acceptance |
| Where do you purchase? | Where do you usually buy…? · Where would you prefer to buy a new brand? (WhatsApp / e-commerce / supermarket) | Purchase channels |
| Would you try a new local brand? | Would you try a new local liquid dishwash brand? | New-product acceptance |
| What would make you switch? | What made you change? · What would make you try it? | Switching · New-product acceptance |
| Trial pack, recommend | Would you take a small trial pack? · Would you recommend…? | Acceptance · Channels |
| Other pain points / switching | Have you changed product in the last 12 months? · Does it get used up faster than expected? · Ranking of what matters | Pain points · Switching |

## 4. Segments (Segments page; editable)
| Segment | Rule | Use |
|---|---|---|
| A · Existing liquid users | mainly use = Dishwash liquid | Switching target |
| B · Dishwash-bar users | mainly use = Dishwash bar | Conversion target (answers the bar-dislike question) |
| C · Price-conscious families | compares prices **or** calls current product "Too expensive" | Value / trial-pack offers |
| D · Convenience-focused households | prefers WhatsApp **or** e-commerce for a new brand | Channel-led launch |
A respondent can belong to more than one segment, so percentages add to more than 100%.

## 5. Research → Scale (ZK Growth360)
Research (survey 200–500 households) → Segment → Position (match message to segment) → Trial (WhatsApp, e-commerce, supermarkets) → Launch (tagged campaigns + QR) → Optimise (leads, conversion, CAC) → Scale (repeat, referral, new segments, new cities).

Client proposal sentence: *"We will use ZK Growth360 to research the Coimbatore market, identify high-potential customer segments, validate product acceptance, and build a go-to-market launch strategy."*

## 6. Fieldwork checklist
- [ ] Publish the survey; open the public link on a phone and complete it once.
- [ ] Create one campaign per channel (Campaigns → tracked link + QR), e.g. residents' WhatsApp groups, society notice-boards (QR), Instagram.
- [ ] Watch Segments → sample progress; stop at the target, not before ~200.
- [ ] Remove the demo data before reporting (Settings → Reset), or work in a fresh browser/workspace.
- [ ] Export responses (Responses page) before and after cleaning.

## 7. Known limits in the prototype
Responses are stored in the browser that opens the public link, so this build can **demonstrate** the fieldwork flow but cannot yet collect real responses from many people's phones. Real collection needs the Phase 7 backend.
