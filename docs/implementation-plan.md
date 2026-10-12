# Implementation plan

Execution checklist for this pass. P0 items first; P2 only if every P0 holds.

## Stage 1–3 — discovery, strategy, architecture
- [x] Inspect repo, run baseline checks (`architecture-audit.md`)
- [x] Research rules, docs and previous winners (`competitive-analysis.md`)
- [x] Decide positioning (`product-strategy.md`)
- [x] Architecture + ADRs (`architecture.md`, `decisions/`)

## Stage 4 — backend (P0)
- [x] `app/providers/youcam/` — the only module that knows YouCam paths/payloads: register → PUT (returned headers) → create task (`format: "json"`) → bounded polling with backoff → typed result; error normalisation
- [x] Skin Simulation client (flat body per OpenAPI page)
- [x] Image hygiene: decode, limits, EXIF transpose, strip metadata, re-encode, comparability features (brightness, size)
- [x] Domain: metric registry (direction, labels), normalisation (missing ≠ 0), recommendation engine (tiers + ranked reasons), comparison/verdict with noise bands
- [x] Persistence: SQLAlchemy + SQLite (Postgres-compatible URL); sessions, scans, metrics, trials, usage ledger
- [x] API v1: sessions, scans (202 + status polling, idempotency), recommendations, catalogue, trials, comparison, simulation, demo timeline, deletion, system status
- [x] Budget guard + per-session rate limit
- [x] Tests: provider (MockTransport + captured fixtures), domain, API; opt-in live smoke test

## Stage 5 — frontend (P0)
- [x] Design tokens + primitives (button, field, notice, provenance badge, metric bar, product art)
- [x] Typed API client
- [x] Landing, Scan (consent → capture/upload → frame/crop → analyse with honest states), Results + focus, Matches, Product, Trial/Progress, Privacy
- [x] Accessibility: keyboard, labels, focus, reduced motion, text equivalents for charts

## Stage 6 — trust and progress (P0)
- [x] Live noise-band experiment (two rounds after the UI run exposed pores +5), recorded in `docs/youcam-integration.md`
- [x] Demo timeline separate from real records; provenance labels everywhere

## Stage 7 — integration (P0)
- [x] Run both servers; walk the journey in the browser (real + demo + one failure path)
- [x] Playwright journey test against demo mode

## Stage 8 — submission (P1)
- [x] README setup verified from scratch
- [x] `demo-script.md`, `submission-copy.md`, `final-audit.md`

## Outstanding (need the owner)
- [ ] Deploy (authorisation required)
- [ ] Record the 1–3 min video and screenshots; test camera capture on a real phone
- [ ] Commit and push
