# Architecture audit (pre-change baseline)

Audited commit `c253aa1` on 2026-10-12, before any changes in this pass.

## Baseline checks

| Check | Command | Result |
|---|---|---|
| Backend tests | `pytest -q` | 3 passed |
| Frontend types | `npx tsc --noEmit` | pass |
| Frontend lint | `npm run lint` | **15 errors, 4 warnings** (`any`, setState-in-effect, unescaped entities) |
| Frontend build | `npm run build` | pass (7 static routes) |
| Live YouCam auth | `GET /s2s/v1.0/client/credit` | 200 — key is valid, 980 units available |

## What exists

- **Backend:** FastAPI app, one router, in-memory `dict` storage, a `YouCamService` class, a 4-product recommendation function, 3 tests.
- **Frontend:** Next.js 16.4 (Cache Components + Partial Prefetching enabled), 6 client pages, state passed between pages through `sessionStorage`, untyped `any` payloads.
- **Docs:** an earlier "final audit" that rated the MVP 9.8/10 and "flawless" — not supported by the code (see Critical findings).

## Findings

### Critical

| # | Finding | Evidence | Improvement |
|---|---|---|---|
| C1 | **Metric direction inverted.** YouCam documents scores where higher = better-looking skin (`all`: "higher is better"; Aloud's live runs: "Higher numbers mean healthier looking"). The engine treats `redness > 50` as "more redness" and recommends soothing products to people whose redness looks *best*. | `services/recommendation.py`, `journey/page.tsx` `isGood` logic | Normalise to a documented "higher = better appearance" scale; define "attention" as a low score; test it |
| C2 | **Result retrieval path wrong.** Code downloads a ZIP and looks for `score_info.json`, but never sends `format: "json"` and parses `results.url`/`result.url`. With `format: "json"` scores arrive inline in `data.results.output[]`. Missing fields silently become **0** via `_safe_int`, which renders as real measurements. | `services/youcam.py` `_poll_task_result`, `_safe_int` | Request `format: "json"`; parse `output[]`; treat missing metrics as *missing*, never 0 |
| C3 | **Fabricated progress.** `/demo/journey-jump` adds +13 hydration, −13 oiliness, −9 redness to the baseline and is stored in the same table as real scans; `/journey` compares it as if real. Uses one global `"current_user"` baseline shared by every visitor. | `api/endpoints.py` | Separate demo timeline with provenance; per-session baselines; comparisons only within one provenance |
| C4 | **Fake simulation presented near YouCam branding.** A CSS gradient toggle captioned "Connected to YouCam API". The backend `simulate` call uses a nested `{"simulation": {...}}` body; the documented body is flat (`{src_file_id, redness: 0.4, ...}`). | `product/page.tsx`, `youcam.py` `_create_simulation_task` | Real Skin Simulation integration per the OpenAPI page, or nothing |
| C5 | **Hard-coded "insight".** Results page always says "Your highest measured signal is Oiliness" regardless of the data. | `profile/page.tsx` | Generate copy from the actual scores |

### High

| # | Finding | Improvement |
|---|---|---|
| H1 | In-memory storage: all scans and the single baseline vanish on restart; no session isolation. | SQLite via SQLAlchemy (Postgres-compatible URL), anonymous session tokens, per-session ownership checks |
| H2 | Upload handling: trusts the client `content_type`, no size limit, no decode, EXIF (including GPS) forwarded to the provider, hard-codes `image/jpeg` for PNGs. | Pillow decode + size/dimension limits + EXIF-transpose + metadata strip + re-encode JPEG |
| H3 | Error handling: `raise Exception(str(e))` → HTTP 500 with raw provider text; `print()` logging; no provider error normalisation (`error_src_face_too_small`, `error_lighting_dark`, etc.). | Typed `ProviderError` codes mapped to user guidance; structured logging; no secrets/images in logs |
| H4 | Polling is a fixed 15 × 2 s loop inside the HTTP request; a slow task holds the request for 30 s and the browser has no progress. Retries none; a double click starts two billed tasks. | Background job + scan status endpoint; bounded polling with backoff; idempotency key |
| H5 | File registration path and PUT headers: uses `/s2s/v2.0/file` and ignores the returned upload headers. | Configurable path, send the returned headers, verify live |
| H6 | `DEMO_MODE=true` silently replaces every real scan with fixed numbers — the same UI as a real result apart from a small badge. | Demo is an explicit user action producing a scan with `provenance="demo_fixture"`; real scans fail visibly when the provider fails |
| H7 | Recommendation `match_score` is arbitrary (base 60, +20/+25, capped at 99) and presented as "Match 87%". | Categorical match tiers + lexicographic ranking with explicit reasons |

### Medium

| # | Finding | Improvement |
|---|---|---|
| M1 | No API versioning; contracts duplicated as `any` in the frontend. | `/api/v1`, Pydantic response models, a typed TS client mirroring them |
| M2 | Camera permission requested via a mode switch with no consent copy; no preview/correction before an irreversible, billed upload. | Consent step, preview + framing/crop tool, explicit "Analyse" action |
| M3 | Lint fails (15 errors). | Rewrite pages with types; lint clean |
| M4 | No tests for provider, API, persistence, or frontend. | Provider tests with `httpx.MockTransport` and real captured fixtures; API tests; Playwright journey |
| M5 | README run command (`uvicorn main:app`) is wrong (module is `app.main:app`). | Fix setup docs; add `make`-style scripts |
| M6 | `CORS allow_credentials=True` with `allow_methods/headers=["*"]`. | Explicit methods/headers, no credentials needed |

### Low

| # | Finding | Improvement |
|---|---|---|
| L1 | Default Next.js SVGs in `public/`, nav link to devpost.com, "Hackathon MVP" badge. | Remove |
| L2 | Product images are placeholders with the word "Product". | Designed packaging illustrations generated from catalogue metadata, labelled as a sample catalogue |
| L3 | `datetime.utcnow()` (deprecated). | Timezone-aware UTC |
| L4 | Previous `docs/final-audit.md` overstated readiness. | Replace with an evidence-based audit |

## What is worth keeping

- FastAPI + Next.js split: sound for a server-held API key and a typed Python domain layer.
- The product concept and the page sequence (refined, not replaced).
- Tailwind v4 and the App Router setup, including Cache Components (pages become static shells with client data islands).
