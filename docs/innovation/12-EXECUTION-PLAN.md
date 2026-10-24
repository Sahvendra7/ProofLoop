# 12 — Execution plan

One vertical slice: domain → data → API → UI → E2E. Each task lists files, behaviour, tests, acceptance and rollback.

| # | Task | Files | Behaviour | Contract change | Tests | Acceptance / evidence | Rollback |
|---|---|---|---|---|---|---|---|
| 1 | Domain rules | `domain/compare.py` | `personal_band`, `instrument_check`, `next_step`; `BandEvidence` gains `personal`; `compare(focus_evidence=)` | none (pure) | `test_instrument.py`: widen-only property, branches of `next_step` | pytest green | revert file |
| 2 | Migration 0003 + models | `migrations/versions/0003_*.py`, `db/models.py` | 3 nullable columns, FK SET NULL, CHECK | DB | up/down/up on SQLite; `alembic check` | clean | `alembic downgrade 0002` |
| 3 | Digest + same-photo | `api/v1/scans.py`, `api/v1/trials.py` (preflight), `schemas.py` | store digest; 409 `same_photo`; `PreflightOut.same_photo` | yes | API tests: no ledger row on refusal | tests | additive |
| 4 | Repeat endpoints + sealing | `scans.py` (`purpose`), `trials.py` (`demo-repeat`, sealing in `demo-checkin`), `services/demo.py`, `data/demo_repeat.json` | ordering 409s; seal on first check-in | yes | API tests for each rule; deletion-after-seal | tests | additive |
| 5 | Presenters | `trials.py::_protocol_out/_trial_out`, `presenters.comparison_out` | `instrument_check`, effective band everywhere, `next_step` | yes | API tests | tests | — |
| 6 | Frontend types/API | `lib/types.ts`, `lib/api.ts`, `lib/format.ts` | new fields and copy | — | `tsc`, lint | build | revert |
| 7 | Trial UI | `app/trial/trial-view.tsx` | Instrument-check card (available / processing / complete / failed / unavailable); next-step block | — | E2E | screenshot | revert |
| 8 | Scan flow | `app/scan/scan-flow.tsx` | `?repeat=1`: repeat copy, `purpose` sent, same-photo handling | — | E2E (stubbed) | — | revert |
| 9 | Privacy copy | `app/privacy/page.tsx` | mention the digest | — | — | — | — |
| 10 | Docs | `docs/innovation/13`, `14`, README, youcam-integration | evidence and limits | — | — | — | — |

Parallelism: one writer only. The shared contract (task 5) is a dependency of 6–8, and they all touch `trial-view`.
