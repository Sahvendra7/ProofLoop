# Deployment (free tiers, $0)

| Part | Host and plan | Name / ID | Status (2026-10-12) |
|---|---|---|---|
| PostgreSQL | Neon **Free** (org `Sahvendra`, plan `free`) | project `proofloop` (`wandering-wind-06917825`), branch `main`, database `proofloop`, role `proofloop_app`; Postgres 17, AWS us-east-1, 0.25 CU, scales to zero after 5 min | **Created, schema migrated** (Alembic revision `0001`, 6 tables, 14 indexes, all constraints verified) |
| API (FastAPI) | Render **Free** web service, region Virginia | `proofloop-api` → `https://proofloop-api.onrender.com` (hostname currently unclaimed) | **Blocked:** Render can't read the private GitHub repo |
| Web (Next.js) | Vercel **Hobby** | project `proofloop-app` → `https://proofloop-app.vercel.app` (unclaimed) | **Blocked:** Vercel's GitHub app can't see the repo |

Source: private repo `Sahvendra7/ProofLoop`, branch `main`.

## What only the account owner can do

1. **Give both hosts read access to the private repo** (no change of visibility):
   - Render: Dashboard → Account settings → Git providers → connect GitHub (or "Configure"), and include `Sahvendra7/ProofLoop`.
   - Vercel: GitHub → Settings → Applications → Vercel → Repository access → add `ProofLoop`.
2. **Enter the two secrets in Render** (service `proofloop-api` → Environment). They never go into Git or a chat:
   - `DATABASE_URL`: Neon console → project `proofloop` → Connect → role `proofloop_app`, database `proofloop`, **connection pooling off** (direct host, without `-pooler`). Paste the full `postgresql://…?sslmode=require…` string as given. The backend adds the psycopg driver itself.
   - `YOUCAM_API_KEY`: the key from the YouCam console.

## Backend service settings (Render)

| Setting | Value |
|---|---|
| Runtime / plan / region | Python / **Free** / Virginia (same AWS region as Neon) |
| Branch / auto-deploy | `main` / yes |
| Python | 3.12 (`/.python-version`) |
| Build command | `pip install -r backend/requirements.txt` |
| Start command | `cd backend && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips='*'` |
| `APP_ENV` | `production`: the app refuses to start on SQLite |
| `CORS_ORIGINS` | the exact Vercel production origin, e.g. `https://proofloop-app.vercel.app` (comma-separated; no wildcards) |
| `PROVIDER_UNIT_BUDGET` | `400` YouCam units, enforced against the ledger in Neon |
| `LIVE_SCANS_PER_SESSION_PER_HOUR` / `SIMULATIONS_PER_SESSION_PER_HOUR` | `6` / `6` |
| `MAX_CONCURRENT_PROVIDER_JOBS` | `3` |
| `YOUCAM_API_URL` / `YOUCAM_FILE_PATH` | `https://yce-api-01.makeupar.com` / `/s2s/v2.0/file/{feature}` |
| `LOG_LEVEL` | `INFO` |
| Secrets (owner enters) | `DATABASE_URL`, `YOUCAM_API_KEY` |

Health:
- `GET /health` is a liveness check. It doesn't touch the database, so platform pings don't keep Neon awake and burn its free compute hours.
- `GET /health/ready` runs `SELECT 1`, reports the Alembic revision, and returns 503 without details if the database is unreachable.

## Frontend settings (Vercel)

| Setting | Value |
|---|---|
| Root directory / framework | `frontend` / Next.js (`npm run build`) |
| `NEXT_PUBLIC_API_URL` | `https://proofloop-api.onrender.com` (production + preview). This is the only public variable; it is not a secret |
| Deployment protection | previews only; production is public |

`next.config.ts` fails any Vercel build whose `NEXT_PUBLIC_API_URL` is missing, not HTTPS, or points at localhost.
Without that check the client would fall back to `http://localhost:8000`.

## Database and migrations

- Schema is managed by Alembic (`backend/migrations`). `0001_initial_schema` mirrors `app/db/models.py`. It was checked on PostgreSQL 17 for upgrade, downgrade, re-upgrade, and `alembic check` (no drift).
- Production runs `alembic upgrade head` before every start. The revision is already applied on Neon, so the first start is a no-op.
- `0002_trial_protocol` (branch `feat/fair-test-protocol`, not deployed) adds three nullable columns and two
  CHECK constraints to `trials`. It is additive: existing rows keep NULLs and are served as "reconstructed"
  plans. Verified on a local PostgreSQL 16 (pgserver): upgrade, `alembic check` (no drift), downgrade,
  re-upgrade, and the full test suite. It runs automatically on the next Render start after a deploy.
- Local development and tests keep SQLite with `create_all`. `TEST_DATABASE_URL=postgresql://… pytest` runs the full suite on Postgres, rebuilding the schema through the migrations for every test.
- Connections: direct (non-pooled) Neon host, SQLAlchemy pool of 5 + 5 overflow, `pool_pre_ping`, recycled after 240 s, because Neon closes idle connections when it scales to zero.
- Budget reservations take a transaction-scoped Postgres advisory lock, so concurrent requests can't overspend.

## Scan jobs, sleep and restarts (honest behaviour)

- Live scans run as in-process asyncio tasks after the upload request returns. Nothing survives a process restart.
- On every start, `recover_interrupted_scans()` marks any scan still `processing` as **failed** ("interrupted by a server restart", with a retry hint). Its unit reservation stays counted, because YouCam may have billed it.
- Render Free only spins down after 15 minutes with **no inbound requests**, and the browser polls while a scan runs. So spin-down cannot interrupt a live scan; a redeploy or crash can, and the user then sees a clear failure.
- Free Render runs a single instance, so there is no cross-instance job contention.

## Free-tier limits that affect judges

- **Cold start:** after 15 idle minutes the API takes about a minute to wake on the first request. Neon resumes in about a second. The frontend is static and always fast.
- **Render:** 750 instance hours a month per workspace. Without a payment method, overages suspend the service instead of billing.
- **Neon Free:** 100 CU-hours a month, 0.5 GB on this branch (project allowance 1 GB), 5 GB egress. Limits suspend; they don't charge.
- **Vercel Hobby:** non-commercial use. 5,000 image transformations a month (one hero image). Limits pause; they don't charge.
- **YouCam:** units are a separate budget. The deployment cap is 400 units (about 33 analyses at 12 units, or 100 simulations at 4).
- No keep-alive pings are used.
