# Checked skin profile — design spec (2026-10-26)

Status: **A4 approved 2026-10-26; gate G0 passed (14 units with `skin_type`, scores unchanged); implemented behind
`SKIN_PROFILE_ENABLED` (off), not deployed.** Deviations from this draft, decided during the build: amendments are
recorded beside the frozen snapshot (never "after seal" only: every change after creation is after the plan was fixed);
the user can also decline the camera reading (`use_camera_reading`), giving stability `not_used`; the sample repeat
reports `not_checked` because the recorded repeat predates skin-type readings; CORS now allows `PATCH`. Recommended option A4 from
`docs/innovation/17-SKIN-PROFILE-DECISION-MEMO.md`. Evidence: `docs/innovation/16-SKIN-PROFILE-RESEARCH-REPORT.md`
(IDs S1–S15, §2.x). UX: `18`. Sequence: `19`. Costs and risks: `20`.

Build is blocked on gate **G0** (`17` §8): a paired live call that settles the price tier and whether `skin_type`
changes the other eight scores.

## 1. Agreed understanding

- **Outcome:** a first-time user picks a focus that the measurement can actually show, in terms they recognise,
  and sees an AI skin-type label treated as provisional: dated, zoned, user-checked and stability-checked.
- **Hard constraints:** the profile is set before the protocol is committed and never changes `focus_band`,
  `repeat_spread`, `compare()`, `focus_outcome()` or `next_step()`. No diagnosis, ethnicity, phototype or
  product-suitability claims. Gemini plays no part. Data stays minimal and deletable.
- **Success:** (1) a user whose chosen concern sits at the ceiling sees why and what has room; (2) the trial page
  shows a frozen profile as context; (3) every existing test passes and historical verdicts are byte-identical;
  (4) a live trial costs at most +2 units per scan.

## 2. Four layers (kept separate in code, data and UI)

| Layer | Source | Stored as | May influence |
|---|---|---|---|
| L1 AI-observed attribute | `skin_type` regions from the baseline (and later) scans | `scans.skin_type_json` | Profile card text, conflict notices, stability line |
| L2 User-confirmed input | Self-report + agree/disagree/unsure | `trials.profile_json.self_report`, `.user_view` | Picker priority, profile card wording |
| L3 Deterministic rules | `backend/app/domain/profile.py` (pure) | Not stored; `rules_version` recorded in the snapshot | Picker order and annotations, education notices |
| L4 Trial measurement and verdict | Existing `domain/compare.py`, `services/protocol.py` | Unchanged | **Nothing above can reach this layer** |

## 3. Data model — migration `0004_skin_profile` (additive, nullable)

```
scans.skin_type_json   TEXT NULL   -- {"whole": "Oily"|null, "t_zone": ..., "u_zone": ..., "unrecognised": 0}
trials.profile_json    TEXT NULL   -- snapshot, see below
```

No new table and no image column. `scans.requested_metrics` (existing) already records each scan's action set,
which is how action sets are pinned (§4.2). Downgrade drops both columns. The old code ignores them, so the
`bcc2cba` code rolls back safely with 0004 applied.

Snapshot v1, written once at `POST /trials`:

```json
{
  "version": 1,
  "rules_version": "2026-10-26.1",
  "created_at": "2026-10-27T10:00:00Z",
  "self_report": {"shine": "often", "tightness": "rarely", "reactive": "unsure", "priorities": ["oil_balance"]},
  "camera": {"scan_id": "<baseline>", "whole": "Oily", "t_zone": "Oily", "u_zone": "Normal"},
  "user_view": "agree",
  "amendments": [],
  "withdrawn_at": null
}
```

- `self_report` enums: `shine`, `tightness` ∈ {often, sometimes, rarely, unsure}; `reactive` ∈ {yes, no, unsure};
  `priorities` ⊆ goal keys, ≤ 2. Every field is nullable (skippable).
- `camera` is copied from the baseline scan at commit; `null` if not requested or missing.
- `amendments[]`: `{at, self_report, user_view, after_seal: bool}`. They are appended and the original is never
  overwritten.
- Withdrawal replaces the object with `{"version":1,"withdrawn_at":…}` and nulls `skin_type_json` on the trial's
  baseline, repeat and check-in scans.

**Retention:** the same as every trial row. It is deleted by `DELETE /api/v1/trials/{id}` and by
`DELETE /api/v1/sessions/me` (cascade). There is no cross-trial profile.

## 4. Backend changes

### 4.1 Provider layer (`backend/app/providers/youcam/`)

- `models.py::SkinOutput`: add `region: str | None = None`, `skin_type: str | None = None`. Today
  `extra="ignore"` drops them silently.
- `endpoints.py`: add `SKIN_TYPE_ACTION = "skin_type"`. Keep `analysis_units(len(actions))`; until G0 proves
  otherwise it counts `skin_type` as a concern, so 9 actions reserve **14** (the conservative reading). If G0
  measures 12, add `_UNTIERED_ACTIONS = frozenset({SKIN_TYPE_ACTION})` and exclude it from the count, citing the
  balance delta in the docstring.
- `client.py`: no change. `analyze_skin(…, actions)` already takes the action list.

### 4.2 Action-set pinning (`backend/app/domain/metrics.py`, `api/v1/scans.py`, `services/scans.py`)

- New `def baseline_actions(profile_enabled: bool) -> tuple[str, ...]`: `REQUESTED_PROVIDER_ACTIONS`, plus
  `skin_type` when enabled.
- New `def trial_actions(baseline: ScanRow) -> tuple[str, ...]` = `tuple(json.loads(baseline.requested_metrics))`.
- `create_scan`: with no `trial_id`, use `baseline_actions(settings.skin_profile_enabled)`. With a `trial_id`
  (repeat or check-in), use `trial_actions(baseline)`. Units = `analysis_units(len(actions))`.
- `ScanJobRunner.start(scan_id, call_id, image, actions)` passes `actions` to `analyze_skin` and
  `normalize_outputs` instead of the module constant.
- `trials.py::_instrument_out` reports units from `trial_actions(baseline)`.
- Result: trials created before the flag keep 8 actions forever. A flag flip never mixes action sets within a
  trial.

### 4.3 Parsing (`backend/app/domain/profile.py`, new, pure)

```python
SkinTypeLabel = Literal["Normal", "Oily", "Dry", "Combination", "Redness",
                        "Dry & Redness", "Oily & Redness", "Combination & Redness"]
REGIONS = ("whole", "t_zone", "u_zone")

@dataclass(frozen=True)
class SkinTypeReading:
    whole: SkinTypeLabel | None
    t_zone: SkinTypeLabel | None
    u_zone: SkinTypeLabel | None
    unrecognised: int          # region entries with a string outside the 8 documented classes

def parse_skin_type(outputs) -> SkinTypeReading | None: ...
```

Rules: only `type == "skin_type"` entries count. The first entry per region wins. A non-string or unknown label
counts as `unrecognised` and becomes `None`, never coerced. If no entries are present, return `None`.
`normalize_outputs` stops listing `skin_type` under `ignored_types`. Metric readings are unaffected.

`ScanJobRunner._run` stores `json.dumps(asdict(reading))` when `"skin_type" in actions`. A missing label never
fails the scan: the eight scores are the product.

### 4.4 Rules (`backend/app/domain/profile.py`) — `RULES_VERSION = "2026-10-26.1"`

**Focus ordering** (replaces the client-side `rank` in `results-view.tsx::GoalPicker`, same result when there is
no self-report). Lexicographic key per goal *g* with metric *m*:

`(m missing, improve_at is None, g not in priorities, ui_score, g.key)`

The key is shown to the user as one sentence (UX `18` §3.4). The **AI label is not in the key.**

| ID | Inputs | Required evidence | Applies when | Action | Fallback | Does **not** establish | Tests |
|---|---|---|---|---|---|---|---|
| P1 Priority | `priorities` | User said so | *g* ∈ priorities | Badge "You picked this"; key component 3 | No priorities → key degrades to today's | That *g* is the right thing to test | ordering with/without; 0, 1, 2 priorities; unknown key → 422 |
| P2 Ceiling (existing) | score, band | `detectability()` | `improve_at is None` | "Can't show gains" + existing warning | Missing score → disabled row (existing) | That the concern is "fine" | unchanged tests + picked-at-ceiling case |
| P3 Most room (existing) | order | — | first testable row | "Most room" | none testable → no badge | That it will improve | unchanged |
| C1 Agreement | `shine`, L1 | Both sources (S2: self-report tracks sebum) | `shine = often` and any region ∈ {Oily, Combination, Oily & Redness, Combination & Redness} | Note on profile card: "You and the camera both point to shine (T-zone: Oily)." | Either missing → skip | That skin is oily in general (S1 seasonality) | each label × each `shine` value |
| C2 Disagreement | `shine`/`tightness`, L1 | S2 | `shine = often` and no region Oily/Combination; or Oily region and `shine = rarely`; same pattern for Dry/`tightness` | Neutral notice: answers and camera differ; neither is a diagnosis; the user's words are used | Missing → skip | Which source is right | matrix |
| C3 Label vs score | L1, scores | ProofLoop scores are the test instrument | Oily region and oil balance ≥ 80; Dry region and hydration ≥ 80; Redness-containing region and redness ≥ 80 | On that goal's row: "The skin-type reading says *oily*, but the oil-balance score shows little visible shine. Your test uses the score." | Missing score → skip | That either reading is wrong | boundary 79/80; each pair |
| C4 Redness ≠ sensitive | L1 | S3 (IFSI) | any region label contains "Redness" | Fixed notice: redness describes how the photo looks; sensitive skin is about how skin feels | — | Rosacea, irritation, sensitivity | each Redness class |
| C5 Reactive self-report | `reactive` | Fair-test logic (one change at a time) | `reactive = yes` | Fixed notice: "Change one product at a time so you can tell what made a difference." | — | Any safety guidance (patch-test copy is unresolved, `16` §3.2) | yes/no/unsure |
| C6 Stability | L1 on baseline + repeat | Same-session repeat (our instrument check) | repeat complete with a label | `held` if all three regions are equal; `changed` otherwise; `partial` if any side is missing | No repeat → `not_checked` | Long-term stability (minutes apart only) | equal / one region differs / missing side / repeat failed |
| C7 Missing label | L1 | — | requested but `None` or all regions `None` | Card shows self-report only + "The camera didn't return a skin-type reading for this photo." | — | — | none / partial / unrecognised |
| C8 Snapshot date | L1 | S1 (season) | label shown | "Describes this photo, taken {date}. Readings can shift with season and conditions." | — | — | rendering |

On the trial page, `changed` suppresses C1/C3 wording and shows "changed between two photos minutes apart — we
won't lean on it". It never alters the protocol.

### 4.5 API contracts (`backend/app/api/schemas.py`; mirrored in `frontend/src/lib/types.ts`)

```
ScanOut.skin_type: SkinTypeOut | None
  SkinTypeOut { status: "complete"|"partial"|"missing"|"not_requested", whole, t_zone, u_zone: str|None }

POST /api/v1/scans/{scan_id}/focus-plan            (no units, no state, owner-scoped)
  in : FocusPlanIn  { self_report: SelfReportIn | None }
  out: FocusPlanOut { order: [ {goal, rank, badges: [..], notes: [{rule_id, text}]} ],
                      profile_notes: [{rule_id, text}], ranking_explanation: str, rules_version }

POST /api/v1/trials       TrialCreateIn gains  profile: ProfileIn | None
  ProfileIn { self_report: SelfReportIn | None, user_view: "agree"|"disagree"|"unsure"|None }

GET  /api/v1/trials/{id}  TrialOut gains profile: ProfileOut | None
  ProfileOut { self_report, camera, user_view, stability: "held"|"changed"|"partial"|"not_checked",
               notes: [{rule_id, text}], amended: bool, after_seal_amendment: bool, rules_version }

PATCH  /api/v1/trials/{id}/profile   { self_report?, user_view?, expected_amendments: int } -> ProfileOut
DELETE /api/v1/trials/{id}/profile   -> 204 (withdraw)
```

Self-report travels only in request bodies, never in query strings. All endpoints reuse `current_session` and
`owned_scan`/`owned_trial` (404 on foreign IDs). `focus-plan` is a POST only because it carries a body; it writes
nothing.

### 4.6 Units, idempotency, concurrency, failures

- **Ledger:** unchanged `usage.reserve/settle`. The reservation uses the pinned action count. Failed tasks settle at
  0; timeouts keep the reservation (existing `possibly_billed`).
- **Idempotency:** the scan `Idempotency-Key` is unchanged, and the replay returns the original scan with its
  original action set.
- **Concurrency:** `PATCH`/`DELETE …/profile` call `protocol.lock(db, trial)` (row `FOR UPDATE`) and require
  `expected_amendments == len(amendments)`, else 409 `profile_conflict`. Lock order is the same as today: trial
  row, then the budget lock (the profile endpoints never take the budget lock).
- **Failures:** if a label is missing, unrecognised or malformed, the scan still completes (C7). Provider error codes
  are unchanged. A profile `PATCH` after the session is deleted gets 404.
- **Never:** a profile write inside `create_scan`'s locked section; any await between `lock` and commit.

### 4.7 Security and privacy

- Self-report (especially `reactive`) is treated as sensitive. It is optional, behind a separate checkbox
  ("Save my answers with this trial"). Without it, the answers are used for the focus plan and discarded.
- **No new image retention.** The label comes from the same request as the scores.
- Logs record only `skin_type_regions_returned` (0–3) and `skin_type_unrecognised` (count), plus profile event
  names (`profile_saved`, `profile_amended`, `profile_withdrawn`) with no field values. A test asserts no label or
  self-report value appears in logs.
- The privacy page gains a "Skin-type reading and your answers" section. **Also flagged:** the existing page says
  YouCam keeps "processed results … for 24 hours", but YouCam's file-retention doc says uploaded files and
  `file_id`s are kept **30 days** (`16` §2.2). Owner to review that copy regardless of this feature.
- Gemini: **no role.** `services/assistant/*` is untouched. A regression test checks that assistant replies for a
  trial are identical with and without a profile.

### 4.8 Flags and observability

- `SKIN_PROFILE_ENABLED` (backend, default `false`) controls whether new baselines include `skin_type` and whether
  `focus-plan`/profile writes are accepted (otherwise 404 `feature_disabled`). It is exposed as
  `SystemStatusOut.skin_profile_enabled`; the frontend hides every profile surface when false.
- Kill switch: setting it to false stops new 9-action baselines. Pinned trials continue with 9 actions (consistency
  outweighs ≤2 units). Existing snapshots still render, read-only.
- Metrics, as counts only: label returned / partial / missing; stability held / changed / partial; self-report
  saved vs skipped.

## 5. Frontend changes (detail in UX `18`)

`frontend/src/app/results/results-view.tsx`: a `ProfileCard` and a self-report step before `GoalPicker`.
`GoalPicker` renders server `FocusPlanOut` order and notes (falling back to the current client order if the call
fails). `frontend/src/app/trial/trial-view.tsx`: one collapsed "Profile at the start" block and a stability line
after the instrument check. `frontend/src/lib/format.ts`: all copy. `frontend/src/lib/types.ts`: mirrored
schemas. `frontend/src/lib/api.ts`: three calls. `frontend/src/app/privacy/page.tsx`: new section.

## 6. Testing strategy (synthetic fixtures only; no live calls)

| Level | What it proves | Examples |
|---|---|---|
| Schema | Parsing matches the recorded shape | `tests/fixtures/youcam/skin-type-*.synthetic.json`: all 8 classes × 3 regions; missing; partial; unrecognised string; non-string; duplicate region; skin_type plus 8 scores; `all`=0 |
| Workflow | Pinning, ledger, protocol isolation | 9-action reserve = 14; failed = 0; timeout kept; check-in after flag flip uses baseline set; idempotent replay keeps set; concurrent PATCH → one 409; withdraw nulls label + snapshot; session delete cascades |
| Protocol immutability | L4 untouched | Property test: random profiles × fixtures → `focus_band`, `repeat_spread`, `compare()`, `next_step()` identical with/without profile; golden snapshot of existing trials' `TrialOut` minus `profile` unchanged after 0004 |
| Leakage | No sensitive values in logs or URLs | `caplog` scan for every enum value; route table has no self-report query params |
| Regression | Assistant and quick questions unaffected | Existing `test_assistant_*` pass; same reply with/without profile |
| Copy lint | No forbidden claims | Fail on "diagnos", "Fitzpatrick", "ethnic", "suits your skin", "sensitive skin" outside rule C4's text, "treat", "cure" in `format.ts` and backend notes |
| Frontend | Behaviour and accessibility | Playwright: skip self-report; agree/disagree; ceiling pick; withdraw; keyboard only; axe clean; mobile |
| Live (G0 only) | Price tier, perturbation, real shape | Paired call (`20` §1.3); its redacted response becomes `skin-type-success-live.json` |

What these tests **cannot** show: accuracy of the label, its fairness across skin tones, or its stability across days.
Those need consented real-world data that we don't have. The UI and the submission must not imply otherwise.

## 7. Deployment and rollback

Follows `15` §3. Neon backup branch before 0004 → merge → cancel the Vercel production build → Render runs
`alembic upgrade head` (0003 → 0004) → `/health/ready` → redeploy Vercel. Flag `false` at deploy; verify with
sample data (0 units); enable; one owner live trial (≈ 42 units worst case). Rollback: flag false (instant), then
code rollback to `bcc2cba` (columns are ignored), then `alembic downgrade 0003` only if needed.
