# Idea selection — 2026-10-19

## First-principles problem

```
User goal         Stop wasting money and skin on products that aren't doing anything visible
Decision          Keep using it, give it longer, or stop/switch
Information need  Has the thing I bought it for visibly changed, beyond day-to-day noise?
Available today   A mirror (different light daily), memory, a selfie score that moves on its own
Uncertainty       (a) measurement noise  (b) capture differences  (c) multiple things to look at
                  (d) whether a change is even measurable from here  (e) causation
ProofLoop's lever (a)–(d) are addressable with YouCam + discipline; (e) is not, and is said so
User benefit      A decision rule fixed in advance, an honest "can't tell", fewer wasted check-ins
```

Smallest set of assumptions that could break the promise: (1) repeat scans are comparable enough —
partly supported, single face; (2) the bands are defensible — **three were not**; (3) the chosen focus can
show a change — **not checked before this pass**; (4) the user reads one verdict, not eight — **not
enforced**; (5) users return weeks later — untested, out of our control before the deadline.

## Candidates (12)

Scores 1–5 (5 = best; for cost/risk columns 5 = cheapest/safest). N = novelty vs. known products,
P = problem strength, V = user value, J = fit with all four judging criteria, Y = how load-bearing YouCam
is, F = feasibility by Nov 2, D = demonstrability in a 3-min video, U = API-unit cost, E = evidence needed
(5 = none new), R = operational/security risk, M = maintenance.

| # | Category | Idea | N | P | V | J | Y | F | D | U | E | R | M | Σ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Verdict trust | **Pre-registered trial plan** (band, lines, date fixed at start; one decisive score) | 5 | 4 | 4 | 5 | 4 | 5 | 5 | 5 | 5 | 5 | 4 | 51 |
| 2 | Measurement | **Detectability / ceiling check** at focus choice | 5 | 4 | 4 | 4 | 4 | 5 | 5 | 5 | 5 | 5 | 5 | 51 |
| 3 | Comparability | **Free capture-match preflight** before a paid check-in | 4 | 4 | 4 | 4 | 3 | 5 | 4 | 5 | 5 | 4 | 4 | 46 |
| 4 | Uncertainty | **Conservative, labelled bands** for unmeasured concerns | 3 | 4 | 3 | 4 | 4 | 5 | 3 | 5 | 5 | 5 | 5 | 46 |
| 5 | Measurement | Replicate check-in (2 scans, both must agree) | 4 | 3 | 3 | 4 | 5 | 4 | 3 | 1 | 4 | 4 | 4 | 39 |
| 6 | Measurement | Personal noise floor: two baseline scans → personal band | 5 | 4 | 4 | 4 | 5 | 3 | 3 | 1 | 2 | 4 | 3 | 38 |
| 7 | Adherence | Routine log + reminders to check in | 2 | 3 | 3 | 3 | 1 | 4 | 3 | 5 | 5 | 3 | 3 | 35 |
| 8 | Skin Simulation | "Target picture": simulate the pre-registered improvement line | 4 | 2 | 2 | 3 | 5 | 4 | 5 | 2 | 4 | 4 | 4 | 39 |
| 9 | Accessibility | Spoken verdict + screen-reader-first trial | 3 | 3 | 3 | 3 | 2 | 4 | 3 | 5 | 5 | 5 | 4 | 40 |
| 10 | E-commerce | "Return-window test": align check-in with a retailer's return window | 4 | 4 | 4 | 4 | 3 | 3 | 3 | 5 | 2 | 3 | 3 | 38 |
| 11 | Other YouCam API | Skin Tone / Face Analyzer to gate comparability (pose, light) | 4 | 3 | 3 | 4 | 5 | 2 | 3 | 2 | 2 | 3 | 3 | 34 |
| 12 | Re-positioning | Pivot to "pre-purchase: will it move *my* number?" (detectability only, no trial) | 4 | 3 | 3 | 3 | 4 | 4 | 4 | 5 | 4 | 5 | 4 | 43 |

The totals are a sanity check, not the decision. The deciding arguments:

- **#1 + #2 are one idea**: a trial is only a fair test if what counts is decided *before* the data, *and*
  the decision can actually come out positive. Both are pure domain logic on data we already have, cost
  zero units, and turn ProofLoop's core claim ("fair test") from a slogan into a mechanism a judge can see
  on one screen.
- **#3** follows ShadeSpan's "spend only when the answer can change" and KeepMe's "gate on input quality
  first", applied over time. It moves an existing check in front of the spend.
- **#4** removes the least defensible number in the codebase. It makes verdicts *stricter*, never looser.
- **#6 (personal noise floor)** is scientifically the strongest idea, but doubles baseline cost (24 units)
  for every judge who tries it, needs evidence we don't have about within-session vs. across-day variance,
  and the budget (≈ 840 units, 400-unit deployment cap) can't absorb it. Deferred to the calibration plan.
- **#8 (simulate the target)** is flashy and YouCam-heavy, but simulation shows an appearance preview, not a
  measured score; tying it to a numeric line implies the product will produce that look. Rejected for
  honesty, not effort.
- **#10 (return window)** is a sharp commerce story but needs real retailer data we don't have; the
  catalogue is fictional. Kept as positioning language only.
- **#12 (pivot)** is absorbed: detectability (#2) delivers its value inside the existing journey.

## Red team

| Reviewer | Challenge | Answer |
|---|---|---|
| Judge | "Isn't this another skin tracker?" | Trackers show a score going up. ProofLoop shows, before you start, the exact score that would count, refuses to test what can't be measured, and says "early look" or "can't call it" when that is the truth. That is visible in ~10 seconds on the trial screen. |
| User | "Does this help me decide?" | Yes, in two places: it stops me starting a trial that can't succeed (ceiling), and stops me paying for a check-in whose answer would be "can't tell" (preflight). The verdict maps to one pre-agreed rule. |
| Technical skeptic | "Do the data justify the claims?" | The bands are labelled measured/assumed; assumed ones use the strictest measured band; nothing is called validated. Lines are computed by the same function the verdict uses (property-tested). Preflight reuses the server's image pipeline and comparability rules. Provider failure paths unchanged. |
| Technical skeptic | "What if the preflight is wrong or down?" | It never blocks: a server error shows "couldn't run the free check" and the user may proceed; the post-scan comparability check still applies. A photo the server can't use (too dark/small) fails there for free. |

**Leading bet:** #1 + #2 (pre-registered, detectability-aware trial plan).
**Supporting improvement:** #3 free capture-match preflight, with #4 conservative bands.
**Fallback:** if the protocol UI proved confusing, keep #4 and #2 only (pure copy + ordering changes).

## Acceptance criteria (as implemented)

| Feature | Before | After (observable) | Backend | Data | Tests |
|---|---|---|---|---|---|
| Detectability | Focus list ordered by score only | Each focus shows "75 or higher counts as up · 63 or lower as down"; ceiling focuses show "Can't show gains", sort last, and selecting one shows a warning | `detectability()`; `MetricOut.{noise_band, band_evidence, improve_at, decline_at, detectable}` | none | `test_detectability_lines` (6 cases), property test vs. `compare_metric`, E2E |
| Trial plan | Band read from the live table at view time | "Decided before the check-in, not after" card: three zones, band + evidence, planned date, conditions; legacy trials say "Reconstructed" | `ProtocolOut`; `compare(..., focus_band=)` | migration `0002`: `trials.focus_band, band_evidence, planned_checkin_days` (nullable, CHECKed on Postgres) | registered/legacy/recalibration tests, migration up/down/up + `alembic check` on Postgres, E2E |
| One decisive score | Table read as eight verdicts | Table subtitle: only the focus decides; others are context | — | — | E2E |
| Early look | No notion of a planned date | "Early look: day 21 of a planned 28-day test." | `ComparisonOut.early` | — | API + E2E |
| Preflight | Comparability known only after paying | Free "Capture match" step on check-ins: good/fair/poor, baseline vs. this photo table; poor → "Retake" primary, "Analyse anyway (12 units)" secondary | `POST /trials/{id}/preflight` (no provider call, nothing stored, ownership + provenance enforced, image hygiene reused) | — | 6 API tests incl. zero provider requests and zero ledger change; E2E with stubbed response |
| Conservative bands | acne/oiliness/redness ±3 assumed | ±7, labelled "assumed" everywhere a band is shown | `NOISE_BANDS`, `band_evidence()` | — | invariant test: assumed ≥ every measured band |

Security/privacy: the preflight photo is decoded, stripped and discarded in memory like a scan photo; it is
not sent to YouCam or stored. Ownership is enforced (404 for another session's trial).

## Demo strategy (draft — not recorded)

1. **Problem (0:00–0:15):** "Three weeks into a serum, is it working? A selfie score moves on its own."
2. **Insight (0:15–0:30):** "A fair test decides what counts *before* you look."
3. **Real YouCam (0:30–1:00):** live scan → `POST /s2s/v2.0/task/skin-analysis`, 8 concerns, 12 units, masks.
4. **The differentiator (1:00–1:40):** focus picker — "75 or higher counts as up"; tap Redness 99 →
   "can't show gains". Start trial → the plan card: zones, band (measured), day-28 date.
5. **Before paying (1:40–2:05):** check-in → Capture match flags a darker, uploaded photo → "Retake" costs nothing.
6. **Verdict (2:05–2:40):** sample trial, synthetic follow-up *(say "synthetic")* → early look, +8 beyond ±5,
   blemishes −5 inside an *assumed* ±7, radiance −5 beyond ±3. "Only the focus decides."
7. **Limits (2:40–2:55):** single-face bands, no causation, not medical.

Which outputs come from YouCam vs. ProofLoop: scores, raw scores, masks, simulation image — YouCam.
Bands, detectability lines, comparability, preflight, verdict, matching — ProofLoop, deterministic.
