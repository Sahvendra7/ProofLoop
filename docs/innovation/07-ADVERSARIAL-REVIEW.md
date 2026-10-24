# 07 — Adversarial review (top five)

Perspectives: **J** skeptical judge · **U** target user · **T** technical reviewer · **S** scientific skeptic ·
**C** competition analyst · **O** operations/privacy.

## B1 — Instrument check (repeat baseline, widen-only)

- **For:** the only candidate that attacks the product's weakest assumption, and it does it on the user's face,
  with the sponsor's own API. It's a non-obvious use (the analysis as a measuring instrument that gets audited),
  in the same family as ShadeSpan's and Aloud's self-audits (01).
- **Against:** it costs a second capture (and 12 units live), and a same-session repeat misses day-to-day variation.
- **Most damaging unsupported assumption:** that one immediate repeat captures enough real noise to matter.
  It's a lower bound, and the doc and UI must say so.
- **Failure conditions:** users upload the same photo twice (→ B3 refusal); users treat "agreed" as "validated"
  (→ copy: "this check can only widen the band"); repeats always land inside the table bands, making the
  feature look inert (then it's still evidence, but less dramatic).
- **Simplest falsification test:** two real captures of the owner's face, a minute apart, 24 units. If every
  concern is within its table band, B1 rarely changes a verdict (its value becomes reassurance plus data). If any
  concern exceeds it, the table band was too narrow for real captures, and B1 is load-bearing. **Not run: needs
  the owner's face and approval to spend.**
- **Cut that preserves the insight:** drop the 8-concern table, keep focus only. Drop live and keep sample —
  no: live is the point. Minimum = live + focus + widen-only + identical guard.
- J: "Isn't this just scanning twice?" → Yes, and that's the point: no consumer app found measures its noise on
  you. The widen-only rule and the sealing at the first check-in are the non-obvious parts.
- U: "Why spend more?" → so a later "it's working" is less likely to be noise. Optional, priced on the button.
- T: async scan job plus trial state machine → reuse the existing job runner, add an explicit purpose and seal
  the result at the first check-in. Covered by API tests.
- S: "|d| + 2 is arbitrary" → it's the table's own construction, and widen-only makes the error one-sided
  (stricter, never looser). Stated as an assumption.
- C: closest is Aloud (1st place), which tells the user that light or angle can shift a second capture, but
  quantifies nothing (01, video 2:00–2:08). That's evidence the problem is real, and that the quantified version is open.
- O: +12 units per use against a 400-unit cap; only a digest of the image is stored; the repeat scan is
  deletable, and its effect survives deletion only once sealed (intended).
- **Survives:** yes.

## A1 — Next step

- **For:** turns a label into the decision in 03; nearly free; strongest Design and Impact lift.
- **Against:** obvious; can read as advice; "consider switching" could look like an upsell.
- **Unsupported assumption:** that users want a recommended action rather than only facts.
- **Failure:** a decline mapped to a medical-sounding instruction → keep cosmetic language ("if your skin feels
  irritated, stop using it").
- **Falsification:** show 5 users the verdict with and without the step. Not possible before Nov 2.
- **Cut:** drop the switch link and keep the sentence.
- J: "That's copy." → It's computed server-side from the pre-registered plan, so the action can't be cherry-picked.
- C: coaching apps give generic routines (04).
- **Survives:** yes, as the supporting improvement.

## B2 — Two-scan check-in

- **For:** reduces false positives at the moment of the decision.
- **Against:** 24 units per check-in, forever; a judge never sees it (check-ins are weeks later); no prior rule for
  disagreement.
- **Unsupported assumption:** that "both agree" is calibrated.
- **Falsification:** a repeat-pair study (same as B1's).
- **Survives:** no. B1 measures the same noise once, earlier, and at half the cost.

## B3 — Identical-photo guard

- **For:** removes a guaranteed false "no change" and saves 12 units. Premise OBSERVED.
- **Against:** small; a near-identical re-encode slips past a byte digest.
- **Unsupported assumption:** none for exact duplicates.
- **Survives:** yes, as part of B1's integrity (a repeat must be a new photo).

## A2 — Return-window plan

- **For:** a sharp commerce story.
- **Against:** the catalogue is fictional; windows are user-entered; it changes the plan date, which shortens
  trials and gives products less time.
- **Unsupported assumption:** that retailer windows are known and fixed.
- **Survives:** as positioning language only (as on 10-19).
