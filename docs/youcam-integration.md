# YouCam integration

All provider-specific paths, payloads, prices and response models live in
`backend/app/providers/youcam/` (`endpoints.py`, `models.py`, `errors.py`, `client.py`).
Nothing else in the codebase knows a YouCam URL or field name.

Sources read on 2026-10-12: docs.perfectcorp.com — *AI Skin Analysis* (v2.0 walkthrough and the
OpenAPI pages for `POST/GET /s2s/v2.0/task/skin-analysis`), *AI Skin Simulation* (overview and the
OpenAPI pages for `POST/GET /s2s/v2.0/task/skin-simulation`). Previous-winner repositories were used as
secondary evidence only (see `competitive-analysis.md`).

## Capability status

| Capability | Status | Evidence |
|---|---|---|
| Auth (`Authorization: Bearer <key>`, server-side only) | **Verified live** | `GET /s2s/v1.0/client/credit` → 200 (2026-10-11) |
| File registration `POST /s2s/v2.0/file/skin-analysis` | **Verified live** | probe + UI runs; response `data.files[0].{file_id, requests[0].{url, headers}}` |
| Presigned upload `PUT` with returned headers | **Verified live** | probe + UI runs; the API key is never sent to the storage host (unit-tested) |
| Skin Analysis task `POST /s2s/v2.0/task/skin-analysis` (`format: "json"`, 8 SD concerns) | **Verified live** | 10 successful analyses; all 8 `dst_actions` accepted and returned |
| Polling `GET /s2s/v2.0/task/skin-analysis/{id}` (`running` → `success`/`error`) | **Verified live** | typical completion 7–9 s |
| Result parsing `data.results.output[]` (`type`, `ui_score`, `raw_score`, `mask_urls`) | **Verified live** | `tests/fixtures/youcam/analysis-success-live.json` (URLs redacted) |
| Task error format | **Verified live** | `{"task_status":"error","error":"error_src_face_too_small","error_message":"…60% of the image width."}` — fixture `analysis-error-face-too-small-live.json`. The parser also accepts the older `"('message', 'code')"` tuple form seen in a July 2026 third-party capture |
| Failed tasks are not billed | **Verified live** | rejected scan left the balance unchanged; ledger recorded 0 |
| Unit cost: 8 concerns = 12 units | **Verified live** | credit 980 → 932 after 4 successes + 1 rejection |
| Detection masks (`mask_urls`, alpha PNG per concern) | **Verified live** | rendered over the user's photo on the results page; presigned, short-lived, not stored |
| Skin Simulation `POST /s2s/v2.0/task/skin-simulation` (flat body `{src_file_id, <concern>: 0–1}`) | **Verified live** | 2 successes (probe + UI); 4 units each; result at `data.results.url` (fixture `simulation-success-live.json`) |
| Credit balance `GET /s2s/v1.0/client/credit` | **Verified live** | used for reconciliation; never exposed to the browser |
| `429` / `5xx` / timeout / malformed handling | Implemented, **fixture-tested only** | `tests/test_provider_client.py` (MockTransport); not provoked against the live API |
| Webhooks | **Not implemented** | Bounded polling instead (see ADR-003) |
| HD concerns (`hd_*`) | **Not implemented** | Need ≥1080 px short side and different pricing; SD is sufficient for the product |
| Skin Analysis `skin_type` (SD `dst_action`; whole / t_zone / u_zone labels) | **Verified live 2026-10-26; implemented behind `SKIN_PROFILE_ENABLED` (off)** | Paired gate on identical bytes: 8 actions = 12 units, 8 + `skin_type` = **14** (it counts as a concern); the 8 shared `ui_score`/`raw_score` identical. Entries `{type:"skin_type", region, skin_type, mask_urls, url}`, no score or confidence. Report `backend/tests/fixtures/youcam/skin-type-gate-report-20261026T094239Z.json`, response `skin-type-success-live.json` |
| Fitzpatrick (`/s2s/v2.0/task/fitzpatrick-scale-analyzer`, 10 units) / Facial Color Tones (`/s2s/v2.0/task/skin-tone-analysis`, 20 units) | **Researched 2026-10-26, rejected** | See `docs/innovation/17-SKIN-PROFILE-DECISION-MEMO.md` §7 |
| Face Analyzer API | **Not implemented** | Out of scope |

Nothing on a ProofLoop screen says "YouCam" unless the data on that screen came from one of the
verified rows above. Sample data is labelled as a replay; synthetic follow-ups are labelled synthetic.

## Lifecycle as implemented

```
browser ──multipart──▶ POST /api/v1/scans (consent=true, Idempotency-Key)
                         │ decode + EXIF-transpose + strip metadata + re-encode JPEG (Pillow)
                         │ reserve 12 units in the usage ledger (budget + per-session rate limit)
                         │ 202 {status: processing, stage: queued}
                         ▼ background job (bytes held in memory only)
            POST /s2s/v2.0/file/skin-analysis      stage=registering
            PUT  <presigned url> (+returned headers) stage=uploading
            POST /s2s/v2.0/task/skin-analysis       stage=analyzing
            GET  …/{task_id}  every 2 s → 3 s → 4.5 s → 6 s (cap), 90 s overall timeout
                         │ validate with Pydantic; normalise (missing ≠ 0); store scores only
                         ▼
browser ◀── GET /api/v1/scans/{id} polled every 1.2 s, shows the real stage
```

### Retry policy (double-billing aware)

YouCam bills on task success, so a duplicated task that succeeds is billed twice.

| Step | Retried on | Never retried on |
|---|---|---|
| File registration, presigned PUT, polling GET | connect errors, timeouts, 429, 502/503/504 (3 attempts, exponential backoff) | 4xx other than 429 |
| Task creation | connect errors (request never left) and 429 (explicit refusal) | read timeouts and 5xx — the task may exist |

A timeout after task creation is settled in the ledger as *possibly billed*, so budget accounting stays
pessimistic. A process restart marks in-flight scans failed and keeps their reservation counted.

### Error normalisation

| Provider signal | ProofLoop code | User guidance |
|---|---|---|
| `error_src_face_too_small` | `face_too_small` | Move closer so your face fills most of the frame |
| `error_src_face_out_of_bound` | `face_out_of_frame` | Keep forehead and chin inside the frame |
| `error_lighting_dark` | `too_dark` | Face a window or soft light |
| `error_below_min_image_size` | `image_too_small` | Shorter side ≥ 480 px |
| HTTP 401/403 | `provider_auth_failed` | (server misconfiguration) |
| HTTP 400 `CreditInsufficiency` | `provider_out_of_units` | Sample data still available |
| HTTP 429 / 5xx / timeout | `provider_rate_limited` / `provider_unavailable` / `provider_timeout` | Try again |
| success without usable metrics | `provider_malformed_response` | Nothing saved |

## Score semantics

YouCam documents `ui_score` (1–100) as a raw score "adjusted to be more favorable for user motivation",
and the overall `all` score as "higher is better". ProofLoop therefore treats every concern score as an
appearance score where **higher means the concern is less visible**. The pre-existing MVP had this inverted
(it treated a high redness score as "more redness") — see `architecture-audit.md` C1.

ProofLoop requests 8 SD concerns: `moisture, oiliness, redness, texture, pore, acne, radiance, dark_circle_v2`.
`all`, `skin_age` and `resize_image` entries are ignored (ProofLoop does not show an age estimate).

## Repeatability (how big is "no change"?)

All analyses are of one stock portrait (`test-face.jpg`, not committed), 2026-10-11, through ProofLoop's own client.

| Run | What changed | moisture | oiliness | redness | texture | pore | acne | radiance | dark circle |
|---|---|---|---|---|---|---|---|---|---|
| A | face = 75% of width | 69 | 99 | 99 | 88 | 79 | 99 | 82 | 68 |
| A′ | identical bytes to A | 69 | 99 | 99 | 88 | 79 | 99 | 82 | 68 |
| B | face = 65% | 69 | 99 | 99 | 88 | 79 | 99 | 83 | 68 |
| C | A, 18% darker | 71 | 99 | 99 | 89 | 80 | 99 | 82 | 67 |
| F | face = 70% | 69 | 99 | 99 | 88 | 79 | 99 | 82 | 68 |
| G | face = 80% | 69 | 99 | 99 | 86 | 79 | 99 | 82 | 67 |
| H | A, shifted left 8% of face width | 69 | 99 | 99 | 89 | 79 | 99 | 83 | 68 |
| I | A, shifted up 8% | 69 | 99 | 99 | 88 | 80 | 99 | 82 | 68 |
| UI | framed in the browser (canvas resample, re-encode) | 72 | 99 | 99 | 91 | 84 | 99 | 83 | 68 |
| UI′ | identical pipeline, check-in | 72 | 99 | 99 | 91 | 84 | 99 | 83 | 68 |
| **Range** | | **3** | 0* | 0* | **5** | **5** | 0* | **1** | **1** |

\* saturated at 99–100 on this face, so variability is **not characterised**.

Findings:
1. The API is deterministic: identical bytes give identical scores.
2. Framing and moderate lighting changes move scores by ≤ 2.
3. Image processing matters more than framing for fine-detail concerns: the browser-framed copy of the
   same photo moved pores by 5 and texture by 3. Hence the "same camera" instruction on check-ins.

Noise bands used by the comparison (`backend/app/domain/compare.py`): observed range + 2, floor 3 —
moisture ±5, texture ±7, pore ±7, radiance ±3, dark circle ±3 (**measured**). Oiliness/redness/acne were
saturated, so their variation is uncharacterised; since 2026-10-19 they use the widest measured band, ±7,
labelled **assumed** in the API (`band_evidence`) and UI (previously an optimistic ±3 floor). Each trial
stores its band when it starts (migration `0002`), so recalibrating the table never changes a running
trial's verdict.
Limits: one face, one lighting setup, synthetic perturbations of one photo. Real re-captures on different
days, cameras and lighting will vary more. The comparability check (lighting difference, camera vs upload,
days apart) is the second line of defence, and a poor-comparability pair yields "inconclusive".

## Units spent during development (this pass)

| Activity | Units |
|---|---|
| Probe: 4 analyses + 1 rejected (0) | 48 |
| Probe: 1 simulation | 4 |
| UI: baseline analysis + 1 rejected (0) | 12 |
| Probe: 4 repeatability analyses | 48 |
| UI: 1 simulation + 1 check-in analysis | 16 |
| **Total** (credit 980 → 852, reconciled) | **128** |

Later live spend: the owner's supervised instrument check on 2026-10-25 (24 units, 840 → 816) and the paired `skin_type` gate on 2026-10-26
(**26 units**, 816 → 804 → 790; one 8-action and one 9-action analysis of the same bytes, no retries,
no other balance movement; `scripts/skin_type_gate.py`, capped at 26 by an isolated ledger).

## Running the live checks yourself

```bash
cd backend
YOUCAM_LIVE=1 ./venv/bin/python -m pytest -m live -k credit        # 0 units
YOUCAM_LIVE=1 YOUCAM_LIVE_IMAGE=face.jpg ./venv/bin/python -m pytest -m live   # 12 units
YOUCAM_LIVE=1 ./venv/bin/python -m scripts.youcam_live_probe --image face.jpg --face-box x0,y0,x1,y1 [--simulate] [--repeatability]
YOUCAM_LIVE=1 ./venv/bin/python -m scripts.skin_type_gate --image face.jpg --face-box x0,y0,x1,y1   # ≤ 26 units, hard cap
```

Ordinary `pytest` runs never touch the network; provider tests replay the live-captured fixtures through
`httpx.MockTransport`.
