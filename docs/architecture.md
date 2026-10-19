# Architecture

ProofLoop keeps the original Next.js + FastAPI split: the browser never holds the YouCam key, and the
domain logic (normalisation, matching, comparison) is plain, testable Python. Decisions are recorded in
`docs/decisions/`.

```
┌────────────────────────── Browser (Next.js 16, App Router) ──────────────────────────┐
│  static page shells  →  client data islands (useSearchParams inside <Suspense>)      │
│  lib/api.ts (typed client, anonymous session token, error envelope → ApiError)       │
│  sessionStorage: framed photo for mask overlay + simulation (this tab only)          │
└──────────────────────────────────────┬───────────────────────────────────────────────┘
                                       │ JSON / multipart, X-Session-Token
┌──────────────────────────────────────▼──────────── FastAPI (/api/v1) ────────────────┐
│ api/       routes · Pydantic schemas · presenters · deps (session, ownership)        │
│ services/  imaging (decode/strip/re-encode) · scans (background jobs) · usage ledger │
│            sessions · demo (fixture replay, synthetic follow-up)                     │
│ domain/    metrics + goals · normalize · catalog · recommend · compare   (pure)      │
│ providers/youcam/  endpoints · models · errors · client      (only YouCam-aware code) │
│ db/        SQLAlchemy models · engine (SQLite default, any SQLAlchemy URL)           │
│ core/      config · structured logging + request ids · error envelope               │
└──────────────────────────────────────┬───────────────────────────────────────────────┘
                                       │ HTTPS, Bearer key
                              YouCam S2S API v2.0
```

## Responsibilities and boundaries

| Layer | Owns | Must not |
|---|---|---|
| `providers/youcam` | Paths, payloads, prices, response validation, retries, polling, error mapping | Touch the DB or know about goals/products |
| `domain` | Score semantics, goals, matching rules, noise bands, comparability | Do I/O |
| `services` | Use cases: run a scan job, reserve/settle units, build demo data, prepare images | Format HTTP responses |
| `api` | HTTP contract, auth/ownership, mapping rows → schemas | Contain business rules |
| frontend | Presentation, capture/framing, polling, copy | Compute matches or verdicts |

## Data model

| Table | Purpose | Personal data |
|---|---|---|
| `sessions` | Anonymous session; stores SHA-256 of a random bearer token | None |
| `scans` | One analysis: provenance (`youcam`/`demo`), status, stage, failure, capture metadata (size, mean luminance, source), units, timestamps, `synthetic_timeline` | No image, no identity |
| `metric_readings` | One row per metric per scan: `ui_score` (0–100 check), `raw_score`, short-lived mask URL | Scores |
| `trials` | Baseline scan + goal + product, provenance inherited from the baseline | — |
| `provider_calls` | Usage ledger: kind, reserved/charged units, status, error code; session id nulled on deletion | None |

Integrity rules enforced in code and constraints: a trial's check-ins must share its provenance; a
synthetic follow-up cannot be a baseline; scans are only visible to their session; deleting a session
cascades to scans, readings and trials.

## Key flows

- **Live scan** — `POST /scans` validates, cleans the image, reserves units, returns 202; a background
  job runs the provider lifecycle and records each stage; the browser polls `GET /scans/{id}`.
  Idempotency-Key makes retries safe. Details: `youcam-integration.md`.
- **Recommendations** — `GET /scans/{id}/recommendations?goal=&budget_max=&fragrance_free=&finish=`
  runs `domain.recommend` against the validated catalogue (`app/data/catalog.json`).
- **Trial protocol** — `POST /trials` also fixes the plan: focus band, band evidence and planned check-in
  days are stored on the trial (migration `0002`); `TrialOut.protocol` returns the lines that count as up or
  down (`detectability()`, the same rule the verdict uses). `POST /trials/{id}/preflight` checks a check-in
  photo against the baseline's lighting and capture source with the scan's own image pipeline, without
  calling YouCam or storing anything. Scan metrics carry `improve_at` / `decline_at` so the focus picker can
  flag ceiling focuses.
- **Trial** — `POST /trials` (baseline), check-ins via `POST /scans` with `trial_id`, verdict computed on
  read by `domain.compare` (latest complete check-in vs baseline).
- **Demo** — `POST /scans/demo` replays a recorded live response through the same normaliser;
  `POST /trials/{id}/demo-checkin` (demo trials only) adds a synthetic follow-up.
- **Simulation** — `POST /simulations` (synchronous, bounded) re-sends the browser-held photo to
  YouCam Skin Simulation; the result URL is returned, not stored.

## Reliability and security properties

- Real and demo data never mix; a failed provider call never produces a "complete" scan.
- Budget ceiling (`PROVIDER_UNIT_BUDGET`) and per-session hourly limits, enforced by reserving units
  before any provider request.
- Upload limits: 10 MB, JPEG/PNG/WebP only, decompression-bomb guard, ≥480 px short side, very dark
  photos rejected locally before spending units.
- No image is written to disk or DB; logs never include image bytes, tokens or presigned URLs
  (httpx URL logging is suppressed). Every response carries `X-Request-ID`.
- CORS restricted to configured origins, methods and headers; no cookies/credentials.
- Frontend security headers: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`
  (camera only on self).

## Deployment

Two processes: `uvicorn app.main:app` (Python 3.12) and `next build && next start` (Node 22).
Configuration is environment-only (`backend/.env.example`, `NEXT_PUBLIC_API_URL`). SQLite suits a single
instance; for multiple instances set `DATABASE_URL` to Postgres (SQLAlchemy URL) and move the in-process
scan jobs to a worker — see ADR-002 and ADR-003 for when to revisit.

## Testing

| Layer | Tool | Count |
|---|---|---|
| Provider client | pytest + `httpx.MockTransport` replaying live-captured fixtures | 18 |
| Domain (normalise / recommend / compare) | pytest | 23 |
| Imaging | pytest + Pillow | 7 |
| API (lifecycle, failures, idempotency, isolation, provenance, deletion, budget) | pytest + TestClient | 15 |
| Config | pytest | 2 |
| Live smoke (opt-in, `YOUCAM_LIVE=1`) | pytest | 2 |
| Browser E2E (desktop + mobile, axe WCAG A/AA) | Playwright | 5 × 2 |
