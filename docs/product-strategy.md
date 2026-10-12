# Product strategy

## Decision: refine the positioning (not a pivot)

ProofLoop keeps its loop — measure, choose, shop, re-measure — but narrows it around one moment and one question:

> **"I started a new product a few weeks ago. Is it actually changing anything?"**

ProofLoop becomes **a fair test for your skincare**: pick one focus, pick one product, save a baseline, check in later, and get an honest verdict that distinguishes a real measured change from normal scan-to-scan variation.

## Answers to the strategy questions

**1. Is the current idea sufficiently differentiated?**
Not as built. The MVP was "scan → generic match % → fake simulation → fabricated Day 21 improvement". Every part of that exists elsewhere, and the Day 21 jump manufactured the very result the product claims to verify. The *loop* is differentiated; the execution undermined it.

**2. Is the measure → shop → measure loop a compelling central insight?**
Yes, and the challenge brief names it: shoppers wonder about their skin "right when they're standing in front of a mirror deciding whether a product is working." None of the three previous winners measures change over time (see `competitive-analysis.md`). The insight only lands if the comparison is trustworthy, so the product's core asset is the **verdict logic**, not the shopping grid.

**3. Does it solve a specific, identifiable problem?**
Refined, yes: people who buy a targeted product (a hydrating serum, an oil-control gel, a soothing cream) have no way to judge it besides their own eye in different lighting each morning. They either give up too early, keep paying for something that isn't doing anything, or credit a product for day-to-day variation. ProofLoop gives them a consistent instrument and an explicit "can't tell yet" answer.

**4. Which part creates the greatest user value?**
The check-in verdict: per-metric change, compared against a measured noise band, with a comparability check on the two photos (lighting, framing). Recommendations get the user into a trial; the verdict is why they come back.

**5. What is generic, unconvincing or unnecessary?**
- A single "Match 87%" number with no mathematical meaning → replaced by explicit match tiers and ranked reasons.
- "Overall skin appearance" as a goal → removed; no single measured metric backs it.
- Hard-coded "What this means" copy that always said "Oiliness is your highest signal" regardless of data → replaced with copy generated from the actual scores.
- The CSS gradient "goal visualization" labelled "Connected to YouCam API" → replaced by the real YouCam Skin Simulation API, labelled as an appearance preview.
- The Day 21 jump that always improved every metric → replaced by a clearly separate demo timeline whose follow-up has mixed outcomes, so the demo shows the verdict logic rather than a rosy story.
- Inverted metric semantics: the MVP treated a high redness score as "more redness". YouCam documents scores where higher means better-looking skin. Fixed throughout.

**6. What would make a judge remember it?**
"We measured the measurement first." Before trusting a change, ProofLoop ran repeated YouCam analyses of the same face under small framing and lighting changes to estimate how much scores move when the skin has not changed. Changes inside that band are reported as "within normal scan variation". That is a sentence a skeptical judge can verify in the code and the docs.

**7. What should be removed, improved or narrowed?**
Narrowed to eight concerns we request from YouCam (moisture, oiliness, redness, texture, pore, acne, radiance, dark circles — one 12-unit SD task) and seven focus goals, each tied to one metric. Removed the fake simulation, the always-positive Day 21, the hackathon nav link, and the hard-coded insight. Improved: real provider lifecycle, persistence, explanations, consent, deletion.

**8. Can a distinct advantage be created without copying the winners?**
Yes. ProofLoop's subject (longitudinal product trials for a consumer) is different from Aloud (accessibility in one session), ShadeSpan (B2B catalogue audit) and KeepMe (try-on integrity). We borrow their *discipline* — one-file provider boundary, live-captured fixtures, inconclusive states, measured unit cost — not their features.

## Audience and commerce value

- **Primary user:** a skincare buyer starting, or 2–8 weeks into, a targeted product, who wants a straight answer.
- **Commerce value:** a trial gives a retailer a reason for the shopper to return (the check-in), and an honest basis for the next purchase — keep going, switch, or stop. ProofLoop does not claim conversion or retention numbers it has not measured.

## Guardrails (non-negotiable)

1. No causal claims. A change after starting a product is reported as an observed change, never as the product's effect.
2. No medical language. Cosmetic appearance only; no diagnosis, no treatment efficacy.
3. Demo data never mixes with real data. Comparisons are only made between scans of the same provenance.
4. Every displayed metric maps to a field YouCam returned for that scan.
5. Only catalogue products are recommended; catalogue products are clearly a sample catalogue, not real listings.

## Trade-offs accepted

- **Fewer goals, deeper answers.** Users with a goal outside the eight measured concerns get an explicit "we can't measure that" instead of a weak match.
- **Re-measurement needs a second real scan** (12 units). The demo timeline exists so judges can see the verdict without waiting weeks; it is labelled everywhere.
- **The noise band is estimated from a small live experiment** (a handful of analyses of one face), not a validated study. The docs say so and the thresholds live in one file.
