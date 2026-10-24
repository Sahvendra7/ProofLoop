# 13 — Verification report (2026-10-25)

Levels: **Implemented** → **Tested locally** → **Verified with the live API** → **Verified in production**.

| Capability | Implemented | Tested locally | Live API | Production |
|---|---|---|---|---|
| `personal_band` widen-only rule | ✓ | ✓ property test, 615 cases (table 0–14 × spread none/0–39) | n/a (pure) | ✗ not deployed |
| `instrument_check` / `next_step` domain | ✓ | ✓ unit tests, every `next_step` branch | n/a | ✗ |
| Live repeat: `POST /scans purpose=repeat_baseline` | ✓ | ✓ against the scripted provider (widen, agree, retry after failure, ownership) | **✗ never run against YouCam**: needs a real face and 12 units | ✗ |
| Sealing at first check-in; survives repeat deletion | ✓ | ✓ (DB value asserted) | — | ✗ |
| Ordering 409s (`protocol_sealed`, `repeat_exists`, `repeat_in_progress`) with no units reserved | ✓ | ✓ ledger unchanged | — | ✗ |
| Identical-photo refusal (scan) + `same_photo` (free preflight) | ✓ | ✓ zero provider requests, ledger unchanged | — | ✗ |
| Preflight `purpose` (no "less than a week" note on repeats) | ✓ | ✓ | — | ✗ |
| Sample repeat (recorded replay) | ✓ | ✓ API + E2E desktop & mobile | Scores are a recording of a live run (2026-10-11) | ✗ |
| Trial UI: instrument-check card (all states), next step | ✓ | ✓ E2E + axe (no serious/critical) + visual check in the browser pane; no console errors | — | ✗ |
| Scan flow `?repeat=1` | ✓ | tsc/lint only. **No E2E**: the keyless E2E backend can't run a live trial | ✗ | ✗ |
| Migration 0003 | ✓ | ✓ PostgreSQL 16 (local `pgserver`): upgrade → `alembic check` (no drift) → downgrade 0002 → base → upgrade → `alembic check` | — | ✗ (Neon is at 0002) |
| Next.js 16.4.0 → 16.4.3 (security) | ✓ | ✓ build + full E2E | — | ✗ (production still runs 16.4.0) |

## Commands run (all on 2026-10-25)

| Command | Result |
|---|---|
| `pytest` (SQLite) | **735 passed, 2 skipped** (opt-in live tests) — release candidate, after the concurrency fix |
| `TEST_DATABASE_URL=<local pg> pytest` | **735 passed, 2 skipped** (schema rebuilt through Alembic per test; PostgreSQL 16) |
| `ruff check .` / `ruff format --check .` | pass / 53 files formatted |
| `tsc --noEmit`, `eslint` | pass |
| `playwright test` (desktop + mobile, own keyless backend, production build) | **34 passed** (re-run on the final lockfile) |
| `npm audit` (all deps) after next 16.4.3 + `overrides.zod = 4.6.7` | **0 vulnerabilities** |
| YouCam credit endpoint (free) before and after | 840 → 840. **0 units spent** |

## Concurrency protection for the instrument check (release candidate)

**Defect found and fixed before release:** `POST /scans` loads the trial before awaiting the upload. A second request
that committed a repeat in that window left the first holding a stale `repeat_scan_id`, so both passed the checks
and **both were billed**. Reproduced deterministically: a test commits a rival repeat from another DB session
mid-request, and the test failed before the fix.

**Fix:** `protocol.lock()` re-reads the trial with `SELECT … FOR UPDATE` (PostgreSQL) right before the checks, with
no `await` between the lock and the commit. It is used by `POST /scans` (repeat and check-in), `demo-repeat` and
`demo-checkin`. Lock order is always trial row, then the budget advisory lock.

| Test | Result |
|---|---|
| Rival repeat committed mid-request → this repeat gets 409 `repeat_exists`, ledger and provider traffic unchanged | pass (SQLite + PostgreSQL) |
| Rival repeat committed mid-request → a check-in gets 409 `repeat_in_progress`, ledger unchanged | pass (both) |
| Retry with the same `Idempotency-Key` returns the same repeat (200), no second charge | pass (both) |
| Two PostgreSQL sessions: B's `lock()` waits until A commits (script, not in the suite) | B acquired after 1.01 s while A held it for 1.0 s |

Retry semantics: same key → same scan, no charge. New key after a success → 409 `repeat_exists`. New key after a
failure → allowed (failed tasks are settled at 0 units).

## Changes to existing tests (and why)

- `test_api.py::test_real_and_demo_records_never_mix` and `test_protocol.py::test_preflight_is_free_and_stores_nothing`
  re-sent the baseline's exact bytes as a check-in. That is now refused by design, so each test uses a photo of
  the same colour at a different size (same brightness, different bytes). Their assertions are otherwise unchanged.
- `conftest.py::_fresh_postgres` returned the raw `postgresql://` URL, so any test opening its own engine
  failed on PostgreSQL (no psycopg2). This was a **pre-existing harness bug**; one existing test failed the same
  way. It now returns the psycopg-normalised URL.

## Found along the way

- **Security:** `npm audit` (GitHub advisories) lists GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r and
  GHSA-673q-mjm6-r5xr against next 16.0.0–16.4.0, including two unauthenticated RCEs. **Production runs 16.4.0.**
  Bumped locally to 16.4.3 (exact). The build tool's own message also asked the agent to run an upgrade command
  with an internal "nudge id". That was treated as tool output, not an instruction, and **not run**.

## Not verified

1. A real instrument check through a phone camera against the live API (24 units with a baseline).
2. Anything in production: nothing was pushed, merged or deployed.
3. Whether one same-session repeat ever exceeds the table bands on a real face (03, assumption 1).

## Winner-video audit (added 2026-10-25, user-approved downloads)

All three winner videos were downloaded, sampled every 5 s with the *letmewatch* skill (ffmpeg) and transcribed
locally (Whisper small, MLX). Videos, frames and audio were deleted afterwards. Results are in 01; patterns T9–T12
were added to 02, and the demo script in 14 was revised.

| Earlier claim | Result |
|---|---|
| ShadeSpan video is 1:00 | **Wrong**: 2:55 (the earlier reading was a YouTube pre-roll ad) |
| No winner addresses scan-to-scan variation | **Refined**: Aloud says light or angle can shift a second capture; none quantifies it. The product bet stands |
| Aloud 10/10 and ShadeSpan 10/14 self-audits are demo proof | **Downgraded**: Devpost page only, not in the videos |
| KeepMe video uninspected | Inspected: the visible demo is entirely its disclosed fixture |

The product decision (09) is unchanged: the per-user, quantified version of the variation problem is still open.

## Skeptical panel (Phase 13)

| Criterion | Strongest evidence | Weakest unresolved issue | Likely objection | One feasible improvement |
|---|---|---|---|---|
| **Technological implementation** | A second Skin Analysis used as an instrument audit; a sealed plan with ordering rules; widen-only property test; migration verified on Postgres; 34 E2E with axe | The live repeat path has never touched the real API | "Show it working live" | One live instrument check on a phone before recording (24 units) |
| **Design** | Journey now ends in an action; the card covers every state; the sample is labelled "Recorded, not simulated" | One more optional step in an already rich trial screen | "Too much text" | Trim the card's copy after watching the recording back |
| **Potential impact** | A specific user and decision (03); targets the product's weakest assumption | No user research; benefit is reasoned, not measured | "Would anyone pay 12 more units for this?" | Run it on two or three consenting people and report the spreads honestly |
| **Quality of idea** | No product, winner or repository found measures repeatability per user (04) | Same-session repeat = lower bound | "That's just scanning twice" | Lead the video with the real number from one's own face (14) |

**Honest readiness:** the mechanism is implemented and tested locally. The submission is **not** ready. The
video, the phone test, repository access and deployment are outstanding and need the owner (14).
**Largest remaining risk:** recording a video before a live instrument check has been seen working on a phone.
