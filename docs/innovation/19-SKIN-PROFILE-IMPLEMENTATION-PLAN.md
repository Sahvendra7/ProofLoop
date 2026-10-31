# 19 — Skin profile: implementation sequence (2026-10-26)

**Not authorised.** This is the order of work if the owner selects A4 (`17`) and approves gate G0. Once the design
spec (`docs/superpowers/specs/2026-10-26-skin-profile-design.md`) is approved, a step-by-step TDD plan is written to
`docs/superpowers/plans/` (writing-plans) before any code. File paths are relative to the repo root.

## 0. Owner decisions (blocking)

| # | Decision | Default if silent |
|---|---|---|
| D1 | Select A4, A0 (self-report only, 0 units) or nothing | Nothing |
| D2 | Approve G0 spend (≤ 26 units) and which image (stock `test-face.jpg` recommended) | No spend; A0 only |
| D3 | Open a YouCam support ticket on tier counting and whole-vs-zone meaning (free) | Recommended in parallel |
| D4 | Correct the privacy page's YouCam retention line (24 h results vs 30-day files), independently of this feature | Recommended |

## 1. Sequence

| # | Task | Files | Tests first | Done when |
|---|---|---|---|---|
| T1 | Paired-probe mode (8 vs 9 actions, same bytes, credit read around each) | `backend/scripts/youcam_live_probe.py` | MockTransport test: two task creations, identical bytes, credit reads; refuses to run without `YOUCAM_LIVE=1` | Mock test green |
| G0 | **Owner-supervised run** | — | — | Deltas recorded; scores compared; redacted `backend/tests/fixtures/youcam/skin-type-success-live.json`; `docs/youcam-integration.md` rows updated. **Go/no-go per `17` §8** |
| T2 | Response model + parser | `backend/app/providers/youcam/models.py` (`SkinOutput.region`, `.skin_type`), new `backend/app/domain/profile.py` (`parse_skin_type`), `backend/app/domain/normalize.py` (stop listing `skin_type` as ignored) | New `backend/tests/test_profile.py`: 8 classes × 3 regions, missing, partial, unrecognised, non-string, duplicates; synthetic fixtures `tests/fixtures/youcam/skin-type-*.synthetic.json` | Green |
| T3 | Action-set pinning | `backend/app/domain/metrics.py` (`baseline_actions`, `trial_actions`), `backend/app/api/v1/scans.py::create_scan`, `backend/app/services/scans.py::ScanJobRunner.start/_run`, `backend/app/api/v1/trials.py::_instrument_out`, `backend/app/api/v1/system.py::system_status`, `backend/app/core/config.py` (`skin_profile_enabled`), `backend/app/providers/youcam/endpoints.py` (tier rule per G0) | Pinning across a flag flip; 9-action reserve; failed = 0; timeout kept; idempotent replay keeps the set; old 8-action trials untouched | Green on SQLite **and** PostgreSQL |
| T4 | Migration + storage | `backend/migrations/versions/0004_skin_profile.py`, `backend/app/db/models.py` (`ScanRow.skin_type_json`, `TrialRow.profile_json`), `services/scans.py` (store label) | up → `alembic check` → down → up on local PG; golden `TrialOut` of existing fixtures unchanged | Clean |
| T5 | Rules + focus plan | `backend/app/domain/profile.py` (P1–P3, C1–C8, `RULES_VERSION`), `backend/app/api/schemas.py`, new route in `backend/app/api/v1/scans.py` (`POST /scans/{id}/focus-plan`) | Rule matrix; ordering equals today's when there is no self-report; **property test: profile never changes `focus_band`/`repeat_spread`/`compare()`/`next_step()`** | Green |
| T6 | Snapshot lifecycle | `backend/app/api/v1/trials.py` (`create_trial` accepts `profile`; `_trial_out` adds `ProfileOut` + stability; `PATCH`/`DELETE …/profile`), `backend/app/services/protocol.py` (reuse `lock`) | Amendment before/after seal; concurrent PATCH → one 409; withdraw nulls labels; session delete cascades; foreign trial → 404 | Green |
| T7 | Sample mode | `backend/app/services/demo.py`, `backend/app/data/demo_fixture.json`, `demo_repeat.json` (labelled sample reading; repeat "held") | Sample trial shows profile with the sample provenance label; 0 units | Green |
| T8 | Frontend | `frontend/src/lib/types.ts`, `api.ts`, `format.ts`; `frontend/src/app/results/results-view.tsx` (`SkinTypeCard`, `InYourWords`, `GoalPicker` from focus plan with fallback); `frontend/src/app/trial/trial-view.tsx` (collapsed block, stability line, edit/remove); `frontend/src/app/scan/scan-flow.tsx` (consent bullet, "same time of day" tip); `frontend/src/app/privacy/page.tsx` | New `frontend/e2e/profile.spec.ts`: skip, agree, disagree, ceiling pick, edit after seal, remove; keyboard; axe; mobile | tsc, eslint, Playwright green |
| T9 | Guards | New `backend/tests/test_profile_guards.py` (copy lint over backend rule texts; caplog leakage); `frontend` copy lint over `format.ts`; assistant regression (`tests/test_assistant_*` + identical reply with/without profile) | — | Full suite green: `pytest` (SQLite + PG), `ruff check . && ruff format --check .`, `npx tsc --noEmit && npm run lint && npx playwright test` |
| T10 | Docs | `docs/youcam-integration.md`, `docs/submission-copy.md`, `docs/demo-script.md` (25 s beat, `17` §5), `docs/innovation/13-VERIFICATION-REPORT.md` | — | Reviewed by owner |
| T11 | Release (owner-approved) | — | — | Per `15` §3: Neon backup branch → merge → cancel Vercel prod → Render `0003 → 0004` → `/health/ready` → redeploy Vercel. Flag **off**; verify with sample data (0 units); flag **on**; one owner live trial (≤ 42 units); balance read before and after |

## 2. Timeline against the deadline (2026-11-02 11:45 ET)

| Day | Work |
|---|---|
| Oct 27 | D1–D4; T1; G0; T2 |
| Oct 28 | T3, T4, T5 |
| Oct 29 | T6, T7, T8 |
| Oct 30 | T9, T10; **stop rule: if not green and reviewed by end of day, do not ship** (keep A0 or nothing) |
| Oct 31 | T11 (if approved) |
| Nov 1–2 | Video and submission (critical path, `15` §8) |

## 3. Fallback A0 (if G0 fails or D1 = A0)

Skip T1, G0, the label parts of T2–T4 and T7. Keep T5 (rules without L1: P1–P3, C5), T6 (snapshot of self-report
only), T8 (no reading card), T9, T10. Migration 0004 then only adds `trials.profile_json`. Unit impact: **0**.
