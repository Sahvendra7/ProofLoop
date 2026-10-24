# 09 — Go / no-go (2026-10-25)

## Decision

| Role | Choice | Why |
|---|---|---|
| **Primary bet** | **B1 Instrument check**: an optional repeat baseline capture before the first check-in. It compares the two scans and widens the focus band to max(table, \|d\| + 2), never narrowing. It is sealed into the trial at the first check-in. Includes **B3**: a photo identical to the baseline is refused, and the free preflight flags it | Attacks the most load-bearing unvalidated assumption (03), on the user's own face, with the sponsor's API; no equivalent found (04); survives the red team (07) |
| **Supporting** | **A1 Next step**: each verdict ends in one server-computed action. "Consider switching" opens same-goal matches | Completes the user's decision (03) at near-zero cost |
| **Fallback** | If B1's async/state work fails its tests by the end of 2026-10-26: ship B3 + A1 only (no new provider calls, no trial state changes) | Both stand alone |
| **Not doing** | B2, A2, B4, C1–C3, D1–D5, E1–E3, F1–F3; B5 falsified | See 06/07 |

**Pivot considered and rejected:** no researched direction beat deepening the fair-test mechanism. F3
(repeatability-as-a-service) is intellectually adjacent, but it abandons a deployed consumer product with 8
days left.

## Hard gates

| Gate | Test | Deadline | Result | Fallback |
|---|---|---|---|---|
| Eligibility | Rules re-read (00) | done | Unchanged; the owner must confirm personal eligibility | — |
| YouCam relevance | B1 is a second Skin Analysis call used as an instrument | done | PASS | — |
| API/account capability | Same verified endpoint; balance 840; deployment 388 left | done | PASS | — |
| Required data | Sample: recorded browser-framed re-analysis (2026-10-11). Live: the user's own capture | done | PASS (sample carries `ui_score` only, labelled) | — |
| Devices | Real phone camera for the live repeat | **owner, before recording** | NOT RUN | Upload path works on desktop |
| Privacy/licensing | Only a SHA-256 digest of the cleaned image is stored; deleted with the scan; no new third parties | spec (10) | PASS on design | — |
| Budget | 0 units spent in this pass; a live demo of B1 costs 24 (baseline + repeat) + 12 per check-in | before any live call | Needs **owner approval** for any live spend | Sample mode |
| Mechanism visible | Sample flow shows both scans, the per-concern spread and the band decision | E2E | see 13 | — |
| Complete by deadline | Vertical slice + tests + docs, target 2026-10-26 | 2026-10-26 | see 13 | Fallback above |
