# ADR-001: Keep the Next.js + FastAPI split

**Decision.** Keep the existing two-service architecture; rewrite internals rather than migrate.

**Context.** The MVP already used Next.js (App Router) and FastAPI. The YouCam key must stay server-side, and the core value is domain logic (normalisation, matching, noise-banded comparison) that benefits from plain, testable Python. Next.js 16 here runs with Cache Components.

**Options.** (a) Keep both; (b) move everything into Next.js route handlers; (c) a single Python app with server-rendered templates.

**Why (a).** Zero migration cost, the strongest typing story on each side (Pydantic ↔ TypeScript types), and the backend can be tested without a browser. (b) would put polling jobs and image processing into a runtime with fewer image libraries; (c) would give up a modern consumer UI.

**Trade-offs.** Two processes to run and deploy; API contract duplicated in `api/schemas.py` and `src/lib/types.ts`.

**Revisit when.** The contract drifts often enough to justify generating TS types from OpenAPI, or deployment needs a single process.
