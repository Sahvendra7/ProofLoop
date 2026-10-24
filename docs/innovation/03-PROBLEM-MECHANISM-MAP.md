# 03 — Problem-mechanism map

## One user, one decision

```
Specific user      Maya, 29. Bought a $38 hydrating serum three weeks ago; the shop's return window
                   is 30 days. She has an app that gives her skin a hydration score.
        ↓
Decision           Keep using it (and rebuy), give it longer, or stop and return it before day 30.
        ↓
Current difficulty Her score went 69 → 72. Is that the serum, or the light from a different window?
        ↓
Why methods fail   • Mirror: different light every morning (Philips' own support page attributes
                     selfie-analyser inconsistency to lighting, distance and angle [1])
                   • Apps: show the trend and treat any difference as change (04)
                   • Vendor reliability claims are population statistics ("95% test-retest" [2],
                     unsourced). A high ICC doesn't tell an individual how many points her own
                     score moves when nothing has changed [3]
        ↓
Missing mechanism  (a) a decision rule fixed before looking                → ProofLoop has it
                   (b) knowing whether a change can register at all        → ProofLoop has it
                   (c) checking comparability before paying                → ProofLoop has it
                   (d) how much *her* score moves when her skin hasn't     → MISSING: the bands come
                       changed, from a real second capture                    from one stock photo,
                                                                              digitally perturbed
                   (e) turning the verdict into keep / wait / switch       → MISSING
        ↓
Opportunity        Measure the instrument on her face before the trial starts (repeat capture,
                   widen-only), refuse a check-in that reuses the baseline photo, and end every
                   verdict with one pre-agreed next step.
        ↓
Benefit            Fewer false "it's working" calls on her face; no wasted check-ins on an
                   identical photo; a decision she can act on inside the return window.
                   (Not validated with users. See "What remains unvalidated".)
```

[1] Philips support, "Why does the Philips Lumea skin selfie analyser show inconsistent results?"
<https://www.philips.co.uk/c-f/XC000021434/why-does-the-philips-lumea-skin-selfie-analyser-show-inconsistent-results>
— FACT: names lighting, distance and angle as the causes.
[2] Perfect Corp business blog: "95% test-retest reliability rate", no study named
<https://www.perfectcorp.com/business/blog/ai-skincare/ai-skin-analysis-ecommerce-beauty-brands> — FACT that the
claim is made; the claim itself is UNVERIFIED.
[3] Vaz et al., "The case for using the repeatability coefficient…", PLOS ONE 2013
<https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3767825/> — FACT: ICC depends on between-subject spread; individual
change needs an absolute measurement-error index.

## Candidate obstacles: tested, not assumed

| Obstacle | Evidence | Status in ProofLoop | Severity now |
|---|---|---|---|
| Scan-to-scan variability | 10 live runs, one stock face: identical bytes → identical scores; reframing/darkening ≤ 2; browser re-encode moved pores 5 (OBSERVED 10-11) | Bands from those runs | **High.** No real re-capture has ever been measured |
| Lighting / framing / capture differences | Our ≤ 2-point result for 18% darker; Philips [1] says it matters | Free luminance + source preflight | Medium (preflight covers lighting, not pose or expression) |
| Hard-to-interpret numbers | `ui_score` is "adjusted… more favorable" (docs) | Lines in points, plain words | Low |
| Expectation setting | — | 28-day plan, early-look label | Low |
| Adherence | Untested; out of reach before the deadline | Copy only | Not addressable by Nov 2 |
| Ceiling effects | acne/oiliness/redness 99 on the test face; **raw_score is also 100.0** for acne and redness (computed 2026-10-25 from fixtures), so raw scores don't escape the ceiling | Detectability + ceiling flag | Low (handled) |
| Insufficient evidence | Single face, single day | Assumed-band labelling | **High** (same root as row 1) |
| False confidence in a number | Apps compare without bands (04) | Bands, inconclusive state | Medium |
| Observed change ≠ causation | Uncontrolled before/after design | Stated on every verdict | Fixed by design; can't be solved |
| Result → action | Verdict ends at a label | — | **High** for Design and Impact |
| Identical-photo self-deception | Identical bytes → identical scores (OBSERVED) | Nothing stops it; costs 12 units and returns a guaranteed "no change" | Medium, and free to fix |

## Scientific basis audit

**Measured (OBSERVED, 2026-10-11, one stock portrait):** the API is deterministic for identical bytes; digital
reframing (65–80% face width, 8% shifts) and 18% darkening move every characterised concern by ≤ 2 `ui_score`
points; a canvas resample and re-encode moved pores +5, texture +3 and moisture +3.

**Assumed (not measured):**

1. A real second capture (new expression, head angle, camera auto-exposure, a minute later) varies no more than
   the band. **Never tested.** It's the most load-bearing assumption in the product.
2. Day-to-day biological variation (sleep, time of day, recent washing) fits inside the band. Untested, and
   untestable before Nov 2.
3. Results from one light-skinned stock face generalise to other faces, tones and devices. Untested. Aloud's
   page cites published dermatology on tone-dependent redness reliability.
4. Acne, oiliness and redness noise ≤ 7. Untested (saturated).
5. Higher `ui_score` is better for every concern requested. VERIFIED-BUT-CONSTRAINED: the docs state it
   generally; ProofLoop requests no wrinkle or eyelid concerns, where the direction is unstated.

**What the bands are:** observed range + 2, floor 3. **Not** MDC95: estimating SEM needs repeated captures from
many people. They must never be called confidence intervals.

**What one repeat pair can and cannot show.** With within-person differences d ~ N(0, σ_d²), a 95% limit is about
1.96 σ_d, while a single |d| has a median of only about 0.67 σ_d. One small difference therefore **cannot**
justify narrowing a band. One large difference **can** show that noise on this face, today, is at least that
large. Hence the rule adopted in 09: **widen-only**, band = max(table band, |d| + 2), using the table's own margin.
The +2 margin is an assumption carried over from the table, not a derived quantity. A same-session repeat also
excludes day-to-day variation, so even a widened band is still a **lower bound** on real noise. The preflight
and the "early look" label stay the other defences.

**What would validate the bands properly:** ≥ 10 consenting people × 2 days × 2 captures (80 analyses, about 960
units). That's more than the 840 available. A minimal version (3 people × 2 days × 2 captures = 144 units) is
feasible only if the owner recruits two volunteers and approves the spend. The Social Sharing Bonus (00) could
fund the larger study. Every instrument check a real user runs is also one real repeat pair. Pooling them is
**not** implemented: it would need explicit consent and cohort suppression.

## What remains unvalidated after this pass

- That users want to spend a second capture (and, live, 12 more units) for a truer band. No user research exists.
- That one immediate repeat captures enough of the real noise. By construction it gives a lower bound.
- That the next-step mapping matches what users would do. It's a reasoned default, not a tested one.
