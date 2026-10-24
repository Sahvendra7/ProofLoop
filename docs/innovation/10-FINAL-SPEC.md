# 10 — Final spec: Instrument check + Next step

Single source of truth for this pass. Code and copy must agree with it; if they don't, this document wins
until it is amended.

## User and scenario

Maya (03) starts a trial for "Look more hydrated" with a serum. Her baseline hydration is 69. The table band
is ±5, measured on one stock photo. Before her first check-in she taps **Check the instrument on your face**,
steps away, comes back and takes a fresh photo. ProofLoop shows both scans side by side. If her hydration
differs by 6, her band becomes ±8 and the lines move to 78 / 60. If it differs by 2, the band stays ±5 and
the screen says so. Three weeks later her check-in is judged against the sealed band, and the verdict ends in
one next step.

## Product promise

"Before your trial counts anything, ProofLoop can measure how much your own score moves when your skin hasn't
changed. That can only make the test stricter, never easier."

## Mechanism

### Instrument check (repeat baseline)

| Rule | Value |
|---|---|
| When | After the trial exists, **before any check-in** (any status). At most one non-failed repeat per trial. A failed repeat may be retried |
| What | One new capture, analysed like any scan (12 units live, 0 sample) |
| Spread | \|repeat − baseline\| on the focus metric (`spread`). Deltas for all 8 concerns are shown as context |
| Band | `personal_band = max(table_band, spread + PERSONAL_MARGIN)`, `PERSONAL_MARGIN = 2` (the table's own margin). Never smaller than the registered band |
| Evidence label | `"personal"` when widened; otherwise the registered label (`measured` / `assumed`) stays, plus "checked on you: within band" |
| Sealing | The first check-in (live or synthetic) writes `trials.repeat_spread`. After that the band can't change, even if the repeat scan is deleted |
| Ordering | A check-in is refused while a repeat is processing (409 `repeat_in_progress`). A repeat is refused once any check-in exists (409 `protocol_sealed`) or a repeat already exists (409 `repeat_exists`) |
| Identical photo | A repeat or check-in whose cleaned image has the same SHA-256 as the baseline's is refused (409 `same_photo`) before any units are reserved. The free preflight reports `same_photo: true`, level `poor` |
| Provenance | Live trials take live repeats only. Sample trials take only the recorded sample repeat (`POST /trials/{id}/demo-repeat`) |

### Next step

Computed server-side from the outcome of the pre-registered focus. One action per comparison:

| Outcome | Early? | Detectable | `next_step.action` |
|---|---|---|---|
| `insufficient_data` / `inconclusive` | any | any | `retake` |
| `measured_decline` | any | any | `pause_and_review` |
| `measured_improvement` | yes | any | `finish_the_test` |
| `measured_improvement` | no | any | `keep_going` |
| `no_clear_change` | yes | any | `finish_the_test` |
| `no_clear_change` | no | `both` / `improve_only` | `consider_switching` |
| `no_clear_change` | no | `decline_only` / `neither` | `nothing_to_gain` |

`consider_switching` links to `/matches?scan=<baseline>&goal=<goal>`. No action claims the product caused anything.
The decline copy uses cosmetic language: "If your skin feels irritated, stop using it."

## Real vs simulated

| Item | Live | Sample |
|---|---|---|
| Repeat scores | YouCam Skin Analysis on the user's new photo | Replay of a **recorded** YouCam analysis (2026-10-11) of the *same* sample portrait, re-framed through ProofLoop's browser pipeline. Labelled. `ui_score` only (raw scores were not kept for that run) |
| What the sample shows | — | Hydration +3, texture +3, pores +5, radiance +1, others 0: all within the table bands, so **no widening**. That is the recorded truth and is not altered for drama |
| Next step | From real outcome | From the synthetic follow-up outcome (labelled synthetic) |

## API contract

`POST /api/v1/scans` (multipart) — new optional field `purpose`: `"checkin"` (default) | `"repeat_baseline"`.
`purpose=repeat_baseline` requires `trial_id`. The repeat scan is stored with `trial_id = NULL`, and the trial
points to it (`trials.repeat_scan_id`). That keeps it out of check-in lists and counts.

`POST /api/v1/trials/{id}/demo-repeat` → `201 TrialOut`. 409 `provenance_mismatch` for live trials, plus the
ordering errors above.

`POST /api/v1/trials/{id}/preflight` → `PreflightOut` gains `same_photo: bool`.

`TrialOut.protocol` gains `instrument_check`; `ProtocolOut.band_evidence` and `ChangeOut.band_evidence` gain
`"personal"`; `ComparisonOut` gains `next_step`.

```jsonc
// ProtocolOut.instrument_check — success, widened (live)
{
  "status": "complete",            // available | processing | complete | failed | unavailable
  "unavailable_reason": null,      // "sealed" when a check-in exists and no repeat was taken
  "scan_id": "ab12…",
  "sample": false,
  "note": null,                    // recorded-replay note for sample trials
  "units": 12,                     // what running it costs (0 for sample)
  "table_band": 5,
  "spread": 6,
  "personal_band": 8,
  "widened": true,
  "sealed": false,
  "changes": [ { "metric": "moisture", "label": "Hydration", "baseline": 69, "current": 75, "delta": 6,
                 "noise_band": 5, "verdict": "better", "band_evidence": "measured" } /* …8 rows */ ]
}
// available (no repeat yet)
{ "status": "available", "unavailable_reason": null, "scan_id": null, "sample": true,
  "note": "…recorded…", "units": 0, "table_band": 5, "spread": null, "personal_band": null,
  "widened": false, "sealed": false, "changes": [] }
// failed (provider error) — retry allowed, band unchanged
{ "status": "failed", "scan_id": "cd34…", "spread": null, "personal_band": null, "widened": false, … }
// unavailable — a check-in happened without a repeat
{ "status": "unavailable", "unavailable_reason": "sealed", … }
```

```jsonc
// ComparisonOut.next_step
{ "action": "consider_switching", "goal": "hydration", "baseline_scan_id": "ab12…" }
```

Errors (`{"error": {"code", "message", "hint"}}`, existing envelope): `same_photo` 409, `protocol_sealed` 409,
`repeat_exists` 409, `repeat_in_progress` 409, `invalid_request` 422 (bad `purpose`, or repeat without `trial_id`).

## Data

Migration `0003` (additive, nullable):
- `scans.content_digest VARCHAR(64)`: SHA-256 hex of the cleaned image bytes. It is not the image, and it is
  deleted with the scan.
- `trials.repeat_scan_id VARCHAR(32)` FK → `scans.id` `ON DELETE SET NULL`.
- `trials.repeat_spread INTEGER`, CHECK 0–100 (Postgres).

## Error states

Provider failure of a repeat: status `failed`, band unchanged, retry allowed. Preflight unavailable: unchanged
behaviour (warn, may proceed). Legacy baselines without a digest: the identical check is skipped. Budget or
rate limit: existing 503/429.

## Privacy and security

No photo is stored. The digest is a one-way fingerprint stored only to detect exact re-use; the privacy page
says so. Ownership is enforced on every trial route (existing `owned_trial`). The repeat is deletable like
any scan, and "Delete all my data" removes it.

## Accessibility

The instrument-check result is a real `<table>` with a caption. The band change is stated in words, not only
by a visual. Buttons state their unit cost. Live regions announce preflight results (existing).

## Scope

In: everything above. **Out:** pooling repeats across users, a two-scan check-in, return windows, the overlay
guide, any new YouCam endpoint.

## Success criteria

1. Widen-only holds for all inputs (property test).
2. Every ordering rule returns its 409 and reserves no units.
3. Sealing survives deletion of the repeat scan.
4. Sample E2E: start a sample trial → run the sample instrument check → see 8 rows and "band stays ±5" →
   synthetic follow-up → see one next step.
5. Existing test suites still pass; `alembic upgrade/downgrade/upgrade` is clean on SQLite and `alembic check`
   passes.

## Known limitations

Same-session repeat = lower bound on real noise. The +2 margin is inherited, not derived. One pair can't narrow
a band. The sample repeat is a re-encode of one photo, not a second capture of a person. No user research.
