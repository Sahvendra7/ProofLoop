# 06 — Feasibility and overlap (top ten)

| Concept | Same mechanism elsewhere? | Current stack? | API documented? | Data obtainable? | Done + tested by Nov 2? | Shown on screen? | Consumer/eComm value | Criteria lifted | Cost | Assumed rather than measured |
|---|---|---|---|---|---|---|---|---|---|---|
| **B1 Instrument check** | None found (04) | Yes: reuses the scan job, preflight, compare | VERIFIED (same analysis endpoint) | Live: the user's face. Sample: recorded browser-framed re-analysis (2026-10-11) | Yes (M) | Yes: two scores side by side, band before/after | Fewer false "it works" calls before a repurchase | Tech, Idea, Impact | 12 units per live use, opt-in | The +2 margin; same-session ≠ across-day |
| **A1 Next step** | Generic coaching only | Yes | n/a | Existing outcome fields | Yes (S) | Yes | Directly feeds keep / switch / buy | Design, Impact | 0 | That the mapping matches user intent |
| **B3 Identical-photo guard** | No | Yes (migration) | n/a | Digest of the cleaned image | Yes (S) | Preflight message | Saves 12 units per mistake | Tech | 0 (saves) | none: identical bytes → identical scores is OBSERVED |
| B2 Two-scan check-in | No | Yes | VERIFIED | Live only | Yes (M) | Weakly (a judge won't wait) | Moderate | Tech | +12 per check-in | Agreement rule |
| A2 Return window | Not seen | Yes | n/a | User-entered only | Yes (M) | Yes | Strong story | Impact | 0 | Users know their window |
| C2 Verdict receipt | KeepMe (signed receipt, other domain) | Yes | n/a | Existing | Yes (M) | Yes | Moderate | Design | 0 | Not misused as an efficacy claim |
| B4 Ghost overlay | MySkin Data (alignment guide) | Needs MediaPipe in browser | n/a | Face box only | Risky (M–L, phone testing) | Yes | Moderate | Design | 0 | Detection quality on phones |
| D1 Tone Analyzer gate | Aloud (confidence, not a gate) | Yes | **PLAUSIBLE-UNTESTED** (payload not exercised by us) | Live | Risky: needs unit spend to verify | Yes | Moderate | Tech | ~? units per scan, unverified | That tone/WB values are stable enough |
| D2 HD subregions | YouCam itself | Yes | Documented, untested by us | Live | Risky: new band study | Yes | Moderate | Tech | 16 per scan | All HD bands |
| B5 raw_score verdict | — | — | VERIFIED field | Fixtures | — | — | — | — | — | **Falsified** (03) |

## High-risk dependency tests run before committing

| Dependency | Test | Result |
|---|---|---|
| raw_score escapes the ceiling (B5) | Ranges from 8 recorded live runs | **Falsified**: raw 100.0 for acne/redness → B5 cut |
| Identical bytes give identical scores (B3's premise) | Runs A vs A′ and UI vs UI′ (2026-10-11) | Holds: identical on all 8 concerns |
| A real sample repeat exists so sample mode never fakes data (B1) | Recorded browser-framed re-analysis of the sample portrait (docs/youcam-integration.md, run "UI") | Holds: scores recorded; raw scores not kept for that run, so the replay carries `ui_score` only |
| A live repeat behaves like any live scan (B1) | Same endpoint, same job runner | VERIFIED-BUT-CONSTRAINED: endpoint verified; **a real re-capture of a real face has never been run** (needs the owner's face and 24 units) |
| Budget for judges | 388 of 400 deployment units left, 840 in the account | A live instrument check spends 12 more per trial. Opt-in keeps judges on sample data by default |

## Overlap verdict

B1, A1 and B3 have no direct equivalent in any product, winner or repository found. B4 overlaps MySkin Data's
alignment guide, and C2 overlaps KeepMe's receipts in another domain.
