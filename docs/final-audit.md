# Final audit — 2026-10-12

Replaces the earlier self-assessment (9.8/10, "flawless"), which was not supported by the code at the time
(see `architecture-audit.md`).

## Release-candidate polish pass (latest)

This pass was limited to visual polish, imagery and verification; the overall design was not reopened. Scoring
and verdict logic were not changed. Screenshots are in `screenshots/final-pass/` (`before-*` shows the defects).

### Fixed in this pass

| Area | Defect (as found) | Fix |
|---|---|---|
| Band chart (trial) | The "normal variation ±N" label sat inside the plot, so the trend line and the check-in marker ran through it. The x-axis labels were clipped at both ends ("eline · Oct 12", "Day 21 · synth"). On phones, text scaled down to about 6–7 px | The label moved into an HTML legend above the plot (band swatch, baseline, synthetic marker). End labels are anchored inward and split onto two lines. A compact 340-unit viewBox is used below `sm`. Points are inset from the axis so score labels clear the tick labels |
| Variation dial (verdict, homepage) | At 320–390 px, the "+8 points · normal variation ±5" line ran into the lower ticks | The headline value sits in the tick-free interior (x 33–167 of 200). The secondary line is a new `caption` prop rendered in the clear band under the gauge. Verified at 320, 375, 390, 768 and 1280 px by geometric overlap checks |
| Trial page, phones | **Pre-existing:** the page scrolled sideways by 66–161 px at 375 px. The `sr-only` class was on the chart's `<table>`, and `overflow: hidden` doesn't clip table boxes | `sr-only` moved to a wrapper `<div>`. The accessible data table is unchanged |
| Hero phone mockup at 320 px | The "Sample data" provenance tag was clipped | The header wraps |
| Camera errors | Every `getUserMedia` failure showed one generic message. On plain HTTP (e.g. a phone opening `http://<LAN IP>:3000`) it said "this browser can't open the camera" | Specific messages for blocked, no camera, camera busy, and https-required, each with the upload fallback |
| Camera retake | After capture, the only option was "Choose another photo", which went back to the chooser | Added "Retake photo", which goes straight back to the camera (camera captures only) |

### Imagery

One editorial photo was added to the homepage hero: Pavel Danilyuk on Pexels, under the Pexels License. Source,
licence, edits and compliance notes are in `assets-credits.md`. It is served locally (50 KB WebP) and carries a
visible caption: "Editorial photo by Pavel Danilyuk on Pexels. Not a ProofLoop user or result." It sits in an arch
beside the sample-data phone and is never used as a scan, result or testimonial. No supporting lifestyle photos
and no product photography were added; product art stays illustrative.

### Tests run in this pass (all executed 2026-10-12)

| Command | Result |
|---|---|
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `next build` (with `NEXT_DIST_DIR=.next-release` so the running dev server's `.next` was untouched; the directory was deleted afterwards) | pass, 9 static routes |
| `ruff check .` / `ruff format --check .` | pass / 46 files already formatted |
| `pytest` | **65 passed, 2 skipped** (opt-in live tests) |
| `npx playwright test` | **26 passed**: 13 scenarios × desktop Chrome + Pixel 7 emulation |

New or extended browser tests:
- **Camera** (`e2e/camera.spec.ts`, 6 scenarios). Uses Chrome's fake capture device: preview, capture, retake, upload reaching the API; every media track ends after capture and after cancel. Also stubbed `NotAllowedError`, `NotFoundError` and `NotReadableError` messages, and the https-required message.
- **Regression** (sample journey):
  - no dial text overlaps a tick, needle or hub (verdict and homepage);
  - the band legend is visible;
  - no chart text is clipped by or overlaps other chart text;
  - no page-level horizontal overflow on the trial page.
- **Hero:** the photo loads from our own origin and the editorial disclaimer is visible.
- **Privacy:** "Delete all my data" works end to end, the old session token returns 401 afterwards, and axe passes on that screen.
- **Accessibility:** axe WCAG 2 A/AA (serious and critical) runs on home, results, matches, verdict and post-delete trials, in both projects. No violations.
- **Responsive overflow** (manual script in the browser): 11 routes (home, scan, live and sample results, matches, product, live and sample trial, trials, privacy, 404) at 375, 768 and 1280 px. After the fixes, page overflow is 0 everywhere.

### Not verified in this pass

- **Physical-device camera capture.** No phone was connected: no `adb`, no Xcode device tools, nothing phone-like on USB. Only Chrome's fake camera was exercised. Real-device test checklist:
  1. Serve the app over **HTTPS** to the phone (e.g. a deployed preview, or a tunnel such as `cloudflared`/`ngrok` to :3000 with the backend reachable and `NEXT_PUBLIC_API_URL` and `CORS_ORIGINS` set to match). On plain `http://<LAN IP>` the camera API is hidden. The app now says so.
  2. iOS Safari and Android Chrome: tap "Take a photo" → the permission prompt appears only then. Deny once → "Camera access was blocked." with the upload fallback. Re-allow in settings → retry works.
  3. The front camera opens (`facingMode: user`), the preview is mirrored, and the captured frame is **not** mirrored in the framer. Confirm that this is acceptable.
  4. Note the captured resolution (the request asks for an ideal 1440×1920). The framer flags low resolution if the crop is under 480 px.
  5. "Retake photo" reopens the camera. "Cancel" turns the camera indicator off. The camera indicator also goes off after capture.
  6. Analyse → a live YouCam result (about 12 units), masks appear over the photo, and a simulation renders from the same tab.
  7. Background the tab mid-preview, then return: the preview resumes, or Capture stays disabled and Cancel recovers.
  8. Landscape orientation: the framing oval and buttons stay usable.
- **Detection masks** were not re-observed in this pass. They exist only in the tab that took the photo; stored scans don't keep photos or mask URLs. A fresh live scan would spend YouCam units, so none was run. Masks were verified live in the earlier pass.
- `test-face.jpg` (git-ignored) has undocumented origin. It is not used anywhere.

### Remaining issues (release)

| Severity | Issue |
|---|---|
| Blocker for judging | No hosted deployment. It needs your authorisation (frontend, backend, persistent DB, budget-capped key) |
| Blocker for judging | Demo video not recorded. Real-device camera test still outstanding (checklist above) |
| Minor | Revisiting a live scan in a new tab silently drops the "Where YouCam looked" mask card. A one-line explanation would help ("photos aren't stored, so masks are only shown right after a scan") |
| Minor | After "Delete all my data", the trials view opens a fresh, empty anonymous session straight away. Nothing old survives (tested), but it creates an empty session row |
| Minor | The matches list shows product illustrations without a visible "illustration" label. The fictional-catalogue note appears on the matches page and the product page, and the art's accessible name says "Illustration of …" |
| Minor | On desktop (≥640 px) the band chart scales with the card width, so its type is large on very wide screens. This is cosmetic |
| Known | Noise bands come from one face and one session. Acne, oiliness and redness bands are assumed |

---

*The sections below are from the earlier pass and are kept for history. Where they differ, the section above is
current: the E2E count is now 26, the camera path has automated coverage, and a licensed hero photo exists.*

## Definition of done

| Requirement | Status | Evidence |
|---|---|---|
| Competitive analysis with evidence | Done | `competitive-analysis.md` (3 Devpost pages + 3 repos inspected) |
| Product strategy | Done | `product-strategy.md` — refine, not pivot |
| Architecture + decisions | Done | `architecture.md`, `decisions/001–006` |
| Existing code reviewed before changes | Done | `architecture-audit.md` (5 Critical, 7 High findings) |
| High-impact issues fixed | Done | All Critical and High findings addressed |
| YouCam status verified honestly | Done | `youcam-integration.md` — Skin Analysis and Skin Simulation verified live through our client |
| Frontend/backend contracts aligned | Done | Pydantic schemas ↔ `src/lib/types.ts`; E2E exercises both |
| Main workflow executed | Done | Live in the browser: rejected scan → framed scan → masks → simulation → trial → live check-in → verdict. Sample path: E2E |
| Recommendation behaviour tested | Done | 13 recommendation tests incl. low hydration, oil, redness, mixed, missing, unsupported goal, budget, preference conflict, no matches, ties, determinism |
| Real/demo separation verified | Done | API tests (provenance mismatch both ways), E2E, UI labels |
| Responsive UX reviewed | Done | 375 px and ~800 px in the browser; E2E mobile project (Pixel 7) |
| Security and privacy reviewed | Done | Image hygiene, no image storage, hashed tokens, CORS, headers, budget, deletion; secrets scan clean |
| Tests executed | Done | see below |
| Production builds verified | Done | `next build` (also from a clean `npm ci`) |
| Setup instructions checked | Done | Backend and frontend README steps run from clean copies |
| Submission assets prepared | Partly | `demo-script.md`, `submission-copy.md` written; video and screenshots not recorded |

## Test results (final run)

| Command | Result |
|---|---|
| `ruff check .` / `ruff format --check .` | pass / 46 files formatted |
| `pytest` | **65 passed, 2 skipped** (opt-in live tests) |
| `YOUCAM_LIVE=1 pytest -m live -k credit` | 1 passed (0 units) |
| `npm run lint` / `npm run typecheck` / `npm run build` | pass / pass / pass |
| `npm run test:e2e` | **10 passed** (5 scenarios × desktop + mobile, axe WCAG A/AA on 4 screens) |
| Live probe + UI runs | 10 successful analyses, 2 rejected (0 units), 2 simulations; 128 units, reconciled with the account |

Defects found by verification and fixed during this pass: settings injection ignored app config; `CORS_ORIGINS`
comma list crashed startup; invalid `<dl>` markup; non-focusable scroll region on mobile; low-contrast band
labels; navigation kept the previous page's scroll offset; trial baselines listed as unassigned scans; the first
noise bands were too tight for pores (found by the live UI run and corrected with a second experiment).

## Not verified / known gaps

- **Camera capture** (`getUserMedia`) was not exercised; only the upload path was tested live. Test on a real phone before recording.
- **No hosted deployment.** The rules require testing access (a website, demo or build). Deploying needs your authorisation.
- **No git commit** has been made; all changes are in the working tree.
- 429/5xx/timeout handling is fixture-tested only.
- Noise bands come from one face and one session; acne/oiliness/redness bands are assumed.
- The catalogue is fictional, so there is no product photography and no real purchase path.
- `npm audit` reports advisories in development dependencies only (`--omit=dev`: 0).

## Readiness (honest)

| Dimension | Score | Why |
|---|---|---|
| Technological implementation | **8/10** | Two YouCam APIs verified live through a typed, isolated, tested client; idempotency, budget ledger, reconciled costs. Missing: deployment, webhooks, live-tested failure modes beyond face-too-small. |
| Design | **7.5/10** | Coherent editorial system, accessible, works at 375 px; honest states everywhere. Illustrated (not photographed) products, and no real-device camera pass yet. |
| Potential impact | **6.5/10** | Credible, specific problem named in the brief; value depends on users returning weeks later, which is unproven. |
| Quality of idea | **7.5/10** | "Measure the measurement" is distinctive and verifiable; risk that judges read it as "another skin tracker" unless the video leads with the verdict logic. |
| Demo reliability | **7/10** locally / **4/10** for judges today | Sample path needs no provider; live path depends on YouCam and units. No hosted URL yet. |

## Highest-impact next steps

1. **Deploy** (frontend + backend + Postgres or a persistent volume) with a budget-capped key, and put the URL in the submission. Requires your go-ahead.
2. **Record the video** following `demo-script.md`, leading with the verdict screen; test the camera path on a real phone first.
3. **Strengthen the noise bands** with a few re-captures across days/cameras (≈12 units each) and update `NOISE_BANDS` + docs.
