# ProofLoop

**A fair test for your skincare.** Measure your skin with the YouCam AI Skin Analysis API, choose one product
for one goal, and check back weeks later. ProofLoop tells you whether a score moved further than normal
scan-to-scan variation — or says plainly that it can't tell yet.

Built for the YouCam API Skin AI & eCommerce VTO Hackathon (Skin AI track).

## Why

People wonder whether a product is working while standing in front of a mirror — a bad instrument with
different light every morning. Skin scanners give a number; shops give a product; nobody tells you whether the
next number is actually different from the last one. ProofLoop closes that loop honestly:

1. **Measure** — a framed selfie goes to YouCam Skin Analysis (8 concerns, scores 1–100, higher = better-looking).
2. **Choose one focus** — each focus is tied to one measured score.
3. **Pick a product** — deterministic matching from a catalogue, with every reason shown and no fake percentages.
   Optional **goal preview** from YouCam AI Skin Simulation.
4. **Fair-test plan** — when the trial starts, ProofLoop fixes what will count: the scores that would mean up or
   down, the band (measured, or assumed and set to the strictest measured), and a day-28 check-in. Focuses at
   the top of the scale, where a gain can't register, are flagged before you choose them.
5. **Check in** — a free capture-match check compares the new photo's lighting and camera with the baseline
   *before* any units are spent; the scan is then judged against the plan. Outcomes: measured change, no clear
   change, or inconclusive — and "early look" before the planned date.

## How YouCam is used

| API | Endpoint | Where |
|---|---|---|
| File upload | `POST /s2s/v2.0/file/skin-analysis` + presigned `PUT` | every live scan / preview |
| AI Skin Analysis | `POST /s2s/v2.0/task/skin-analysis`, `GET …/{task_id}` (`format: json`, 8 SD concerns, 12 units) | baseline and check-in scans; per-concern detection masks shown over the user's photo |
| AI Skin Simulation | `POST /s2s/v2.0/task/skin-simulation`, `GET …/{task_id}` (4 units) | optional goal preview on the product page |

All of the above were verified against the live API through ProofLoop's own client — see
[`docs/youcam-integration.md`](docs/youcam-integration.md) for evidence, costs and the repeatability study.

## Run it locally

Requirements: Python 3.12, Node 22.

```bash
# backend (http://localhost:8000)
cd backend
python3.12 -m venv venv
./venv/bin/pip install -r requirements-dev.txt
cp .env.example .env          # add YOUCAM_API_KEY for live scans; leave blank for sample data only
./venv/bin/uvicorn app.main:app --reload --port 8000
```

```bash
# frontend (http://localhost:3000)
cd frontend
npm install
npm run dev
```

Without a key, everything except live scans and previews works, and live scans fail with a clear message
instead of inventing results. **Try with sample data** replays a recorded YouCam response, labelled as such.

## Tests

```bash
cd backend && ./venv/bin/python -m pytest          # 91 tests, no network; 2 opt-in live tests skipped
cd backend && TEST_DATABASE_URL=postgresql://… ./venv/bin/python -m pytest   # same suite on PostgreSQL, schema via Alembic
cd backend && ./venv/bin/ruff check . && ./venv/bin/ruff format --check .
cd frontend && npm run lint && npm run typecheck && npm run build
cd frontend && npm run test:e2e                     # Playwright, desktop + mobile, axe; isolated keyless backend
```

Live checks (spend units only when asked): `YOUCAM_LIVE=1 ./venv/bin/python -m pytest -m live`.

## Deploy

Hosted on free tiers: Next.js on Vercel (Hobby), FastAPI on Render (Free web service), PostgreSQL on Neon (Free).
Schema changes go through Alembic (`backend/migrations`). Runbook, settings and limits: [docs/deployment.md](docs/deployment.md).

## Privacy

Photos are cleaned (metadata stripped) and sent to YouCam, never stored by ProofLoop. The server keeps scores,
capture metadata and trials under an anonymous session token; "Delete all my data" removes them immediately.
ProofLoop is not a medical device and never attributes a change to a product.

## Docs

- [Innovation pass (2026-10-19)](docs/innovation/idea-selection.md): audit, research, decision, demo plan
- [Product strategy](docs/product-strategy.md) · [Competitive analysis](docs/competitive-analysis.md)
- [Architecture](docs/architecture.md) · [Decisions](docs/decisions/) · [Audit of the previous MVP](docs/architecture-audit.md)
- [YouCam integration & evidence](docs/youcam-integration.md)
- [Design direction](docs/design-direction.md)
- [Deployment](docs/deployment.md)
- [Demo script](docs/demo-script.md) · [Submission copy](docs/submission-copy.md) · [Final audit](docs/final-audit.md)

The product catalogue is fictional sample data created to demonstrate matching.
