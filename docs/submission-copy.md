# Submission copy (Devpost draft)

**Tagline:** Is your skincare working? ProofLoop runs a fair test — and tells you when the answer is "not yet".

## Inspiration
The challenge brief describes the moment exactly: someone "standing in front of a mirror deciding whether a
product is working." The mirror is a bad instrument — different light every morning, and the hope that an
expensive serum is doing something. Scanners give you a number and shops give you a product, but nobody tells
you whether the next number is actually different from the last one.

## What it does
1. **Measure.** A framed selfie goes to the YouCam AI Skin Analysis API, which scores eight visible concerns
   (hydration, oil balance, redness, texture, pores, blemishes, radiance, under-eye) from 1 to 100. YouCam's
   per-concern detection masks are shown over your photo.
2. **Choose one focus.** Each focus is tied to one measured score, ordered from your lowest.
3. **Pick a product.** Matches come from a catalogue by explicit rules: a tier (strong / good / possible), every
   reason listed, cautions drawn from your own scores (e.g. an exfoliating acid when redness scores low), budget
   and fragrance-free filters with set-aside products explained. No match percentages — there's no data that
   would make one meaningful. An optional **YouCam AI Skin Simulation** preview shows what the goal looks like.
4. **Check in.** Weeks later, a new scan is compared against the baseline. A change only counts if it exceeds
   that concern's **noise band**, which we measured on the live API, and the pair passes a comparability check
   (lighting, capture method). Outcomes: measured change, no clear change, or inconclusive. ProofLoop never
   attributes a change to a product.

## How we built it
- **YouCam APIs (server-side, verified live):** `POST /s2s/v2.0/file/skin-analysis` + presigned `PUT`;
  `POST /s2s/v2.0/task/skin-analysis` (`format: json`, 8 SD concerns, 12 units) with bounded polling of
  `GET …/{task_id}`; `POST /s2s/v2.0/task/skin-simulation` (4 units). Live-captured, redacted responses pin the
  shapes in tests.
- **Backend:** FastAPI, Pydantic, SQLAlchemy (SQLite, Postgres-ready), httpx, Pillow. Every YouCam path lives in
  one package. Background jobs report real stages; idempotency keys prevent double billing; units are reserved
  in a ledger before any call, against a deployment budget and per-session limits. Uploads are decoded, stripped
  of metadata and re-encoded; photos are never stored.
- **Frontend:** Next.js 16 (App Router, Cache Components), React 19, Tailwind v4, an editorial design system,
  accessible components (keyboard framing tool, text alternatives for charts).
- **Quality:** 65 backend tests with no network, opt-in live tests, Playwright E2E on desktop and mobile with
  axe WCAG A/AA scans.

## "We measured the measurement first"
We ran ten live analyses of one face: identical bytes gave identical scores; reframing or 18% darker moved any
score ≤ 2 points; the same photo re-encoded in the browser moved pores by 5. Bands are the observed range + 2
(±3 most concerns, ±5 hydration, ±7 pores and texture). It's one face — a floor, not a validation study — and
the docs say so.

## Challenges
- The previous MVP had YouCam's score direction inverted, silently returned 0 for missing fields, and
  fabricated a "Day 21" improvement. We rebuilt the provider layer against the docs and verified it live.
- Live error payloads changed format since earlier public captures (bare code + `error_message` vs a
  stringified tuple); the parser handles both.
- YouCam rejects faces under 60% of the frame width, so capture needed a framing step.

## Accomplishments
- A real end-to-end loop on the live API: baseline → simulation preview → check-in → honest verdict.
- Sample data that is a replay of a real response, labelled everywhere and never mixed with real trials.
- Unit accounting reconciled exactly against the account balance.

## What we learned
Fine-detail measurements (pores, texture) react to image processing more than to framing — so "use the same
camera" is part of the product, not a footnote.

## What's next
Re-capture studies across days and devices to calibrate bands per concern and score range; webhooks; a
retailer view of anonymised trial outcomes per product.

## Significantly updated during the submission period
The repository's first commit (`c253aa1`) was an MVP with an unverified YouCam client, in-memory storage and a
fabricated progress demo. During the submission period we rebuilt the provider integration and verified it live,
added persistence, sessions, deletion, unit budgeting, the recommendation engine, noise-banded comparison, the
Skin Simulation integration, the full frontend, and the test suites. See `docs/architecture-audit.md`.

## Built with
youcam-skin-analysis-api · youcam-skin-simulation-api · fastapi · python · pydantic · sqlalchemy · httpx · pillow ·
next.js · react · typescript · tailwindcss · playwright · axe-core

**Disclosure:** the product catalogue is fictional sample data created to demonstrate matching.
