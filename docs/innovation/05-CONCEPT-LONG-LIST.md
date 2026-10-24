# 05 — Concept long list (23 concepts, six lenses)

Field key: **U** target user · **P** problem · **Alt** current alternative · **Ins** insight · **Mech** mechanism ·
**YC** YouCam's role · **Ben** user benefit · **Diff** differentiation · **Ev** evidence for the problem ·
**Eff** engineering effort (S < 1 day, M 1–2 days, L > 2 days) · **Units** API units per use · **Data** data
dependencies · **Risk** main risks · **Demo** demo potential (1–5) · **AC** acceptance criteria.
Default user unless stated: a consumer three to four weeks into a skincare product, as in 03.

## Lens A — the user's decision

**A1. Next step after the verdict.**
- P: the verdict is a label, not a decision. Alt: guess.
- Ins: the pre-registered plan already implies the action.
- Mech: deterministic map from (outcome, early, detectability) to keep going / finish the test / consider switching / pause & review / retake. "Switch" opens same-goal matches without the current product.
- YC: indirect (it consumes analysis outcomes). Ben: an action, not a number. Diff: trackers give generic coaching; this follows from a pre-agreed rule. Ev: problem map row "Result → action" (03).
- Eff S. Units 0. Data: none. Risk: reads as advice → cosmetic language, no medical claims. Demo 4.
- AC: every outcome maps to exactly one step, computed server-side, unit-tested for all branches.

**A2. Return-window-aware plan.**
- U: a shopper with a retailer return window. P: the verdict arrives after the window closes.
- Mech: the user enters return-window days; the planned check-in lands 2 days before it closes.
- YC: indirect. Ben: decide while a refund is possible. Diff: commerce-native. Ev: none gathered (hypothesis).
- Eff M (migration + UI). Units 0. Data: windows are user-entered, since the catalogue is fictional. Risk: implies we know retailer policies. Demo 3.
- AC: plan date = min(28, window − 2), labelled.

**A3. Adverse-change stop rule.** Folded into A1 ("pause & review" on a measured decline). Not separate.

## Lens B — the missing measurement

**B1. Instrument check: a repeat baseline on the user's own face.**
- P: bands come from one stock photo, digitally perturbed, and were never checked on the user.
- Ins: one immediate second capture can only reveal *more* noise than assumed, so a widen-only rule is safe.
- Mech: an optional second capture before any check-in. Both scans compared across 8 concerns. Focus band = max(table, |d| + 2). Sealed at the first check-in.
- YC: **central**: a second Skin Analysis used to measure the measurement. Ben: a band that has seen her face. Diff: no product found does this (04).
- Ev: 03 (assumption 1); Philips [1]. Eff M. Units 12 live / 0 sample (recorded replay). Data: a recorded browser-framed re-analysis exists (2026-10-11).
- Risk: costs units; identical photo → falsely reassuring (→ B3). Demo 5 (a real number on a real face).
- AC: widen-only property-tested; blocked after a check-in; check-ins blocked while it runs; identical photo refused; band and evidence visible in the plan.

**B2. Two-scan check-in (both must agree).**
- Mech: each check-in takes 2 captures; a change counts only if both clear the line.
- YC: 2× analysis. Ben: fewer false positives at check-in. Diff: high.
- Eff M. Units 24 per check-in. Risk: doubles cost every time; agreement rule untested. Demo 3.
- AC: verdict requires both scans beyond the line.

**B3. Identical-photo guard.**
- P: re-using the baseline photo returns identical scores (OBSERVED), so a guaranteed "no change" costs 12 units.
- Mech: SHA-256 of the cleaned image stored on the scan; preflight flags it (free), and the scan endpoint refuses it.
- YC: protects spend. Eff S. Units saves 12. Data: digest column. Risk: low (a digest is not the image). Demo 2.
- AC: same bytes → 409 `same_photo`, no ledger row.

**B4. Ghost alignment overlay.** Store the baseline face box (not the photo) and show an outline on the next capture. Eff M. Units 0. Risk: needs client-side face detection (MediaPipe ~ MBs). Demo 3. AC: framing within ±5% of baseline.

**B5. Verdict on raw_score.** Ins hoped raw escapes the ui_score ceiling. **Falsified 2026-10-25:** raw is 100.0 for acne and redness on the test face, and moisture raw range was 5.4 vs ui 2. Rejected.

**B6. Pre-registered sequential looks (day 14 + day 28, alpha-spending).** Statistically elegant; no SD estimate to spend alpha against. Eff M. Demo 2. Rejected for now.

## Lens C — competitive whitespace

**C1. Product "fair-test record".** Aggregate consented outcomes per product. Needs many users; cold start; cohort suppression. Eff L. Demo 2.

**C2. Shareable verdict receipt.** Plan, outcome, bands, limits as a printable or shareable page (for a dermatologist or a return request). Eff M. Units 0. Risk: could be read as proof of efficacy. Demo 3.

**C3. Confound warning.** Warn when two running trials share a focus metric. Eff S. Units 0. Demo 2. AC: 409 or warning on overlap.

## Lens D — YouCam capabilities

**D1. Face/Skin Tone Analyzer as a comparability gate (white balance, tone).** PLAUSIBLE-UNTESTED; extra units per scan; payloads unverified by us. Eff M–L. Demo 3.

**D2. HD Skin Analysis subregions (pores/wrinkles by zone).** 16 units; untested here. Finer focus, but a new band study needed. Eff M. Demo 3.

**D3. Skin Simulation "target picture" at the improvement line.** Rejected 10-19: implies the product will produce that look.

**D4. Simulation as an explainer of what ±band looks like.** Same honesty issue as D3; it shows an appearance, not a measured score. Rejected.

**D5. Face Analyzer pose check.** PLAUSIBLE-UNTESTED; would cover pose, which the preflight doesn't. Eff M. Units unknown. Demo 3.

## Lens E — trust and accessibility

**E1. Spoken verdict / screen-reader-first summary.** Aloud territory. Eff S–M. Demo 2.

**E2. "What would change our mind" line on each verdict.** E.g. "a score ≥ 75 in matching light". Partly present in the plan card. Eff S. Demo 2.

**E3. In-browser preflight (no upload).** Compute luminance client-side so the preflight photo never leaves the device. Eff S–M. Privacy gain; the digest check (B3) would also need computing client-side. Demo 1.

## Lens F — radical alternatives

**F1. Pre-purchase "will it register on me?" only.** Absorbed 10-19 by detectability.

**F2. B2B claim-check panels.** Brands pre-register a cosmetic claim and run consented panels. Needs recruits; outside the consumer framing. Eff L. Demo 2.

**F3. Repeatability-as-a-service for skin-AI apps.** Developers measure their own instrument per device and user. Interesting, but a pivot away from a working consumer product with 8 days left. Eff L. Demo 2.

## Stop rule

New searches and lenses stopped producing new mechanisms after F3. Remaining ideas were variants of A1, B1 or C2.
