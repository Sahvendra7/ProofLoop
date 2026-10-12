# ADR-005: Verdicts use measured noise bands and a comparability check

**Decision.** A check-in only counts as a change when a metric moves beyond its noise band (observed range across 10 live analyses of one face + 2, floor 3). Pairs with very different lighting are "inconclusive". Direction follows YouCam's "higher is better" semantics. Change is never attributed to a product.

**Context.** The MVP compared raw deltas, inverted the direction for most metrics, and fabricated a +13/−13 "Day 21".

**Options.** Raw deltas; a fixed arbitrary threshold; empirically measured per-metric bands.

**Why.** It is the product's core promise. A threshold we measured is defensible; one we picked is not. The repeatability run also found that pores/texture react to image processing, which the bands and the "same camera" guidance now reflect.

**Trade-offs.** One face and synthetic perturbations understate real-world variation; three metrics saturated at 99–100 and are uncharacterised (floor of 3 assumed).

**Revisit when.** Re-captures across days/cameras from consenting users are available — recompute bands per metric and per score range.
