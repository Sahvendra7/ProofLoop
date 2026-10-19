# Current-state audit — 2026-10-19

Scope: repository `main` at `f0256fb`, the live deployment, and the existing tests, inspected before any change
in this pass. "Verified" means it was executed or observed in this pass; everything else is labelled.

## What was checked, and how

| Item | Method | Result |
|---|---|---|
| Backend tests | `pytest` (SQLite) | all passed, 2 opt-in live tests skipped |
| Backend lint | `ruff check .` | pass |
| Live backend | `curl /health`, `/health/ready` | `ok`, PostgreSQL, Alembic `0001`, provider configured |
| Live frontend | `curl` status | 200 |
| Official rules / deadline | Devpost overview + `/rules` in the in-app browser | Submission closes **Nov 2, 2026, 11:45 am ET**; four equally weighted criteria; 1–3 min video that explains the YouCam API; testing access required |
| Project gallery | Devpost `/project-gallery` | "haven't published this gallery yet" — no competing submissions visible |
| YouCam units | not spent in this pass | 0 units used; no live scan, no simulation |

Not done in this pass: a live hosted scan (would spend 12 units), a physical-phone camera test (no device attached).

## Journey: what is real, what is fixture, what is assumed

| Step | Status | Source of truth |
|---|---|---|
| Landing | Works | Static; previews are labelled sample/synthetic and mirror `lib/sample.ts` |
| Scan (live) | Works, verified live on 2026-10-11/13 | YouCam Skin Analysis, 12 units, masks live |
| Scan (sample) | Works | Recorded YouCam response replayed, labelled |
| Results → focus | Works | Real scores; band labels are ProofLoop's |
| Matches / product | Works | Deterministic rules over a **fictional** catalogue (labelled) |
| Goal preview | Works, verified live | YouCam Skin Simulation, 4 units |
| Trial / baseline | Works | DB row; no protocol was stored (see risk 3) |
| Check-in (live) | Works, verified once (same-day) | Real scan; a real multi-week check-in has never been run |
| Verdict | Works | Noise bands from a **single-face, single-session** experiment |
| Synthetic follow-up | Works | Fixed deltas, labelled synthetic |
| History / delete | Works | Tested end-to-end in E2E |

## Findings that matter (ranked)

1. **Three of eight noise bands were an optimistic guess.** Acne, oiliness and redness scored 99–100 on the
   test face, so their variation was never measured; the code assumed ±3 — narrower than the ±5/±7 actually
   observed for hydration, pores and texture. Any verdict on those concerns rested on the least defensible
   number in the product. *(Fixed in this pass: widest measured band, labelled "assumed".)*
2. **Ceiling trials were accepted silently.** Sample redness is 99. With any band ≥ 1 an improvement needs a
   score above 100 — impossible — yet ProofLoop let a user start "Calm visible redness" and would eventually
   report "no clear change". The product promised a fair test it could not run. Only a generic "already looks
   strong" note existed on the matches page. *(Fixed: detectability lines, ceiling flag, ordering.)*
3. **No pre-registration.** The trial stored goal and product but not the band or what would count. The
   verdict table showed eight concerns each judged at 95%-style bands, inviting the reader to cherry-pick
   whichever one moved (eight comparisons at once). A recalibrated band table would also silently change
   the verdict of running trials. *(Fixed: protocol columns via migration 0002; "only the focus decides".)*
4. **Units were spent before comparability was known.** The lighting/source check ran *after* the 12-unit
   check-in; a poor match produced a guaranteed "we can't call this one" that the user had paid for.
   *(Fixed: free preflight endpoint + UI step.)*
5. **Latent concurrency bug (pre-existing).** `current_session` left the `last_seen_at` update uncommitted for
   the whole request. Two concurrent requests from one session (idempotent retry, double tap, React dev
   StrictMode) stalled for the SQLite busy timeout and 500'd; on Postgres the second would wait on the row
   lock while blocking the event loop — a whole-server hang. Reproduced with a test before fixing.
   *(Fixed: commit in the dependency; three regression tests.)*
6. **Hydration mismatch on `/scan` (pre-existing, minor).** `ScanFlow` reads `sessionStorage` in a `useState`
   initialiser, so server and client render different first screens. React recovers; it logs an error in
   the console. *(Not fixed: low impact, would add a consent-screen flash.)*
7. **Repeatability evidence is thin by construction.** 10 analyses, one stock face, synthetic perturbations,
   one day. It is honest about that, but it is still the weakest link in "is the change real?" (see
   `solution-landscape.md` for the calibration plan).
8. **Real-world risks for judging (unchanged):** no demo video yet; no physical-phone camera test; a real
   multi-week check-in has never happened, so the verdict path is only ever shown with synthetic data or a
   same-day re-scan; the repository is private (rules allow sharing it with `contact_event@PerfectCorp.com`).

## What looks impressive but adds little

- The homepage's interactive "verdict explorer" and floating chips: attractive, but they demonstrate the
  idea with fixed numbers. Fine as explanation; not evidence.
- Eight-concern verdict table: informative context, but before this pass it read as eight verdicts.
