# ProofLoop Architecture

## Stack
- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, Lucide React (icons), Recharts (charts).
- **Backend**: FastAPI, Python 3, Pydantic, HTTPX (async client for YouCam).
- **Database**: SQLite (for MVP) via SQLAlchemy / SQLModel to simulate PostgreSQL persistence, easy to run locally.

## Components
1. **Frontend (`/frontend`)**
   - Clean, premium mobile-first UI.
   - Pages: Landing, Scan, Results (Profile), Goals, Recommendations, Product (Simulation), Journey (Progress).
   - API client to communicate with our FastAPI backend.
2. **Backend (`/backend`)**
   - Endpoints:
     - `POST /api/scan`: Uploads image, talks to YouCam API (or demo mode), creates `Scan` and `SkinMeasurement`.
     - `GET /api/products`: Recommends products based on measurement and goal.
     - `POST /api/baseline`: Saves baseline for a user.
     - `GET /api/journey`: Compares latest scan against baseline.
3. **YouCam API Client (`/backend/services/youcam.py`)**
   - Upload URL generation.
   - Task creation.
   - Polling / Result extraction.
   - Demo mode fallback logic (explicitly flagged).

## Data Model
- `Session`: Anonymous user session.
- `Scan`: Represents a single analysis instance.
- `SkinMeasurement`: The structured data from YouCam (Hydration, Oiliness, etc.).
- `Goal`: The user's chosen focus area (e.g., Hydration).
- `Product`: Structured catalogue item.

## Deployment
- Can be run locally via `docker-compose` or separate `npm run dev` / `uvicorn` commands.
