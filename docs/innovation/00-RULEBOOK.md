# 00 — Rulebook (verified 2026-10-25)

Source: the official rules at <https://youcam-api-skin-ai-ecommerce.devpost.com/rules>, read in the in-app
browser on 2026-10-25 (plain HTTP fetches return 403). The official rules prevail over this summary.
Project gallery (`/project-gallery`) on 2026-10-25: "haven't published this gallery yet" — **no competing
entries are visible**, so nothing in these documents claims anything about the current field.

## Dates (Eastern Time)

| Milestone | Date |
|---|---|
| Submission period | Sep 29, 2026 12:00 pm – **Nov 2, 2026 11:45 am** |
| Judging | Nov 3 – Nov 20, 2026 |
| Winners | ~Nov 24, 2026 |

Today is Oct 25: **8 calendar days** remain, and the video, a real-phone test and the Devpost form are not done.

## HARD GATES (fail any one → not judged or disqualified)

| # | Gate | Rule text (paraphrased) | ProofLoop status 2026-10-25 |
|---|---|---|---|
| H1 | Eligibility | Age of majority; not in an excluded country; no sponsor ties | Owner's call — not verifiable from the repo |
| H2 | Working app + YouCam API | "working application that integrates at least one Perfect Corp. YouCam API" with consumer/eCommerce value | Skin Analysis + Skin Simulation live; `/health/ready` ok, Alembic 0002, provider configured |
| H3 | New or significantly updated | Existing projects must be significantly updated after Sep 29 and **explain how** | First commit is inside the period; `submission-copy.md` explains updates |
| H4 | Repository | All source, assets, instructions; public + licence **or** private and shared with `contact_event@PerfectCorp.com` | Private (`Sahvendra7/ProofLoop`); **sharing not yet confirmed** |
| H5 | Text description | Features, functionality, consumer/eCommerce value | Draft in `docs/submission-copy.md` |
| H6 | Video | 1–3 min, public on YouTube/Vimeo, **explains the YouCam API used**, shows the project **on the device it was built for**, no third-party trademarks or unlicensed music | **Not recorded** |
| H7 | Testing access | Free, unrestricted access until judging ends (Nov 20) | Live at `proofloop-app.vercel.app` — Render free tier cold-starts (~1 min); unit budget must last to Nov 20 |
| H8 | Third-party rights | Authorised use of SDKs/data/images | Pexels hero credited; catalogue fictional and labelled |
| H9 | English | All materials in English | Yes |

Stage One is pass/fail on "reasonably fits the theme and reasonably applies the required APIs".

## JUDGING OBJECTIVES (Stage Two, equally weighted; ties broken in this order)

1. **Technological Implementation** — how thoroughly and skilfully a YouCam API is integrated; consumer/eCommerce
   value; "genuine effort and a working, non-trivial implementation".
2. **Design** — "a complete, coherent product experience — not just a technical proof of concept".
3. **Potential Impact** — "a credible, specific case for solving a real problem for a real audience — and does the
   solution actually address that problem *based on what's demonstrated*".
4. **Quality of the Idea** — "creative, non-obvious use" of a YouCam API and "genuine understanding of the problem space".

Judges "may choose to judge based solely on the text description, images, and video". The video is the product
for most judges.

## Budget-relevant rules

- 1,000 free units per registrant, valid 90 days from redemption.
- **Social Sharing Bonus (new in our notes):** 500 units per qualifying shared demo video, max one per platform,
  two total. Requires tagging @YouCam API, naming the APIs used, the disclosure "Received API credits for
  sharing", public for 30 days, an account created before Sep 29, and the form by Nov 2 11:45 am ET. Optional;
  does not affect judging. **Owner's decision** — it would fund a real calibration study (see 03, §Science).

## Verified YouCam facts used in this pass

From <https://docs.perfectcorp.com/reference/description/ai_skin_analysis.md> (2026-10-25):

| Fact | Status |
|---|---|
| SD analysis costs 9 (1–4 concerns) / **12 (5–8)** / 14 / 16 units; failed tasks are not billed | VERIFIED (docs + our ledger, 2026-10-11) |
| `ui_score` 1–100 "adjusted… to produce more favorable results"; `raw_score` 1–100, higher is better | VERIFIED (docs) |
| Face should fill 60–80% of image width; short side ≥ 480 px (SD) | VERIFIED (docs + live rejection fixture) |
| The docs make **no statement about repeatability** | VERIFIED (absence, docs page read in full by the fetch tool) |
| Results retained 24 h; masks expire | VERIFIED (docs) |
| Account balance **840 units** (2026-10-25, free credit endpoint); deployment ledger 12/400 committed | OBSERVED |
