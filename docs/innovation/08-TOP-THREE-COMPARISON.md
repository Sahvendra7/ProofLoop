# 08 — Top three

Scores 1–5 and why. Scores support judgement, they don't replace it. Weak evidence is named, not averaged away.

| | B1 Instrument check | A1 Next step | B2 Two-scan check-in |
|---|---|---|---|
| **Technological implementation** | 5: second live analysis, trial state machine, sealing, widen-only property tests, migration | 2: deterministic mapping | 4: double analysis |
| **Design** | 4: one new step with a clear before/after; risk of an extra step | 5: completes the journey | 2: invisible in a demo |
| **Potential impact** | 4: addresses the weakest assumption for this user; unvalidated with users | 4: a decision, not a label; unvalidated | 3 |
| **Quality of idea** | 5: none found elsewhere (04); non-obvious API use | 3: obvious once stated | 3 |
| Execution feasibility | M; vertical slice in a day | S | M |
| Evidence quality | Premise OBSERVED (variation exists, identical bytes are identical); real re-capture **untested** | Reasoned mapping; no user data | As B1 |
| Cost | +12 units per live use (opt-in), 0 sample | 0 | +12 per check-in, always |
| Risk | Async race (repeat vs check-in) → explicit 409s | Advice-like wording | Unit drain |
| Demo reliability | Sample mode replays a recorded re-analysis (always works); live needs a face and 12 units | Always works | Hard to show |

**Reading:** B1 is the only one that changes what ProofLoop *knows*. A1 changes what the user can *do* with it.
B2 is dominated by B1. B3 is not a contender on its own; it's the integrity guard B1 needs.
