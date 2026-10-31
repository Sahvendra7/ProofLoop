# 30 — Accessibility implementation plan (2026-10-26)

**Status: Stage 0 + Stage 1 approved by the owner and implemented on 2026-10-31 on branch `feat/a11y-r1` (from `main` `bcc2cba`) and committed as `e6e3e85`; not pushed or deployed. The implementation record is §7; Stages 2–4 are still proposals.** Issue IDs are from `25`, designs from `28`/`29`. Each
stage is a reviewable PR on its own branch, frontend-only unless marked. No new runtime or test dependency is
needed: React, Next.js, Tailwind, Playwright and `@axe-core/playwright` already cover every requirement here.

## 1. Stage overview

| Stage | Goal | Issues | Depends on | Size [inference] |
|---|---|---|---|---|
| **0** | Widen the automated gate so regressions are caught | test gaps (`25` §7) | — | ½ day |
| **1 (= first release R1)** | Focus, announcements, server-sourced result text, preview noise, focus ring, display colour | 01, 02, 04, 05, 06, 07, 08, 09, 14, 16, 17, 23 | 0 | 1–1½ days |
| **2** | Low-vision visual fixes | 10, 11, 12, 13, 15, 19, 24, 25 | 1 (announcer, focus token) | 1 day |
| **3** | Accessible capture | 03, 20, 21, 22 + `28` §3–6 | 1; user testing before the zoom decision | 1 day + testing |
| **4** | Optional | 18, 26; per-trial deletion; per-history verdict (backend) | product decisions | — |

Ordering rule: Stage 1 before anything visual, because the blockers are non-visual and the fixes share two small
primitives (announcer, focus-on-mount) that later stages reuse.

## 2. Stage 0 — test gate (no product change)

| File | Change |
|---|---|
| `frontend/e2e/helpers/a11y.ts` (new) | One shared `expectNoSeriousA11yViolations(page)` using `withTags(["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"])`; logs `moderate` results without failing; replaces the three copies in `journey`/`protocol`/`profile` specs |
| `frontend/e2e/a11y.spec.ts` (new) | Reflow loop: every route at 320×720, assert `scrollWidth <= innerWidth`. Forced colours: `page.emulateMedia({ forcedColors: "active" })` screenshot of `/results` and `/matches` (artefact, not pixel assertion). Text spacing: inject the WCAG 1.4.12 CSS and assert no element with `overflow:hidden` clips its text (`scrollHeight > clientHeight`) on key buttons |
| `frontend/e2e/a11y.spec.ts` | Token contrast: in-page evaluation of the CSS custom properties against the table in `29` (fails if a listed pair drops below its threshold) |
| `frontend/playwright.config.ts` | Optional third project `desktop-motion` with `reducedMotion: "no-preference"` running only `a11y.spec.ts` |

Expected: the 2.2 tags may surface new findings (e.g. `target-size` should pass). Any that appear are triaged
before Stage 1, not suppressed.

## 3. Stage 1 — first release (R1)

### 3.1 Primitives

| File | Change |
|---|---|
| `src/components/announcer.tsx` (new) | Client provider rendering one visually hidden `<div aria-live="polite" aria-atomic="true">` **in the initial markup** of `layout.tsx` [guide: MDN live regions]; `useAnnounce()` returns `announce(text)` which clears then sets text on the next task; dedupes identical consecutive messages |
| `src/lib/focus.ts` (new) | `useFocusOnMount(ref, enabled)` — focuses a `tabIndex={-1}` heading after mount with `preventScroll: false`; `useDocumentTitle(title)` |
| `src/components/ui.tsx` | `Notice`: add `live?: boolean` (default **false** for info/warn — static notices stop being live regions; error keeps `role="alert"`). `Button`: `softDisabled` prop rendering `aria-disabled="true"` and ignoring clicks (focus stays) |
| `src/app/layout.tsx` | Mount the announcer inside `<body>` before `SiteNav` |

### 3.2 Changes by screen

| File | Change | Issue |
|---|---|---|
| `src/app/scan/scan-flow.tsx` | Each step gets an `h2` with `tabIndex={-1}` focused on mount (§`28` §5 table); step-specific titles; remove nested `aria-live` wrappers at `:425` and `:563` and announce once via `announce()`; announce camera ready; file input `tabIndex={-1}`; consent Continue → `softDisabled` with reason | 01, 14, 17, 23 |
| `src/app/scan/framer.tsx` | Focusable heading; `aria-valuetext` on zoom (move buttons are Stage 2) | 01, 10 (part) |
| `src/app/results/results-view.tsx`, `matches/matches-view.tsx`, `product/product-view.tsx`, `trial/trial-view.tsx` | Focus the page `h1` on mount when arriving via in-app navigation (not on hard load) | 04 |
| `src/app/matches/matches-view.tsx` | Replace the list-wide `aria-live`/`aria-busy` with `announce("N products match. M set aside by your filters.")` after each load | 14 |
| `src/app/trial/result-in-words.tsx` (new) | The `28` §10 block, built only from `trial.comparison`, `trial.protocol` and `format.ts` copy | 07 |
| `src/app/trial/trial-view.tsx` | Render `ResultInWords` after the verdict `h2`; after `demoFollowup` and `runSample`, focus `#verdict` / `#instrument-title`; replace "Refresh in a few seconds" with a "Check again" button (`api.trial` + announce) | 02, 16 |
| `src/components/dial.tsx` | New optional `summary` prop; when given it replaces the internal sentence; the verdict passes "Result shown in words above." Homepage dials keep their illustration summary | 07 |
| `src/components/band-chart.tsx` | Table rows show score and difference only; no client "beyond/within" (classification returns in Stage 2 from server data) | 07 |
| `src/app/trial/assistant-panel.tsx` | Quick-question and Ask buttons use `softDisabled`; `ActionButton` "Show synthetic check-in" focuses the verdict after update | 05, 02 |
| `src/app/trials/trials-view.tsx` | Focus "Yes, delete everything" when confirming; return focus to the trigger on Cancel; on success focus a success heading and `announce()` it; clear `error` on retry | 02 |
| `src/app/trial/profile-block.tsx`, `src/app/results/skin-profile.tsx` [flag: PR #4 only; not in Release 1, see §7.3] | Focus confirm/first field when opening; focus result sentence after save/remove; announce "Answers applied. The focus list has been re-ordered." | 02 |
| `src/components/previews.tsx` | `PhoneFrame`: outer `role="img"` + `aria-label` (label must say "sample" or "synthetic"); inner content `aria-hidden` | 06 |
| `src/app/globals.css`, `site-footer.tsx`, `page.tsx`, `home/*.tsx`, `trial-view.tsx` | `--focus-ring` token + `.on-strawberry`/`.on-espresso`; `text-berry-deep` for headline phrases on berry surfaces | 08, 09 |

### 3.3 Tests added in Stage 1 (written first, failing, then made to pass)

- For each scan transition (consent→choose→camera→frame; upload→frame→failed with the no-key backend), assert
  `await expect(page.locator(":focus")).toHaveText(<step heading>)`.
- Sample journey: after "Show synthetic 21-day follow-up", focus is the verdict heading and the Result in words
  contains "69 to 77" and "±5" (values from the recorded fixtures `backend/app/data/demo_fixture.json` and
  `backend/app/services/demo.py`).
- For each focus outcome, a fixture-driven test asserts the Result in words headline equals
  `OUTCOME_COPY[focus_outcome].headline` and contains no forbidden word (`28` §10). The backend's
  E2E server can produce `measured_improvement` (sample); other outcomes need either a backend test fixture
  endpoint (not proposed) or component-level rendering in Playwright's page with a stubbed API route
  (`page.route`) — preferred, no backend change.
- Delete-all: focus moves to confirm, then to the success heading; announcer text contains "Everything was deleted".
- Assistant: after pressing "Is it working?", focus is still on that button.
- Homepage: `page.getByRole("img", { name: /synthetic demo/ })` exists and the accessibility tree under `/`
  no longer contains "A measured change." outside the verdict explorer (Playwright `ariaSnapshot`).
- Footer focus: Tab to a footer link; computed `outline-color` is white.

### 3.4 Risks and rollback

| Risk | Mitigation |
|---|---|
| Double speech: Next's announcer reads the title and focus reads the `h1` | Accept if brief; if testing shows it's noisy, focus `h1` only and make titles shorter. Decide from `31` §3 sessions |
| Focus moves feel jumpy for sighted keyboard users | Focus only headings at the top of the replaced content, with `preventScroll:false` to keep scroll consistent with today's `scrollTo` |
| `Notice` no longer live may silence something that relied on it | Audit every `Notice` call site (≈25) in the PR; errors keep `role="alert"` |
| Existing E2E selectors (`appAlert`, `role=status`) | Run full suite; update selectors deliberately |
| Visual regressions from colour/focus token | Before/after screenshots on `/`, `/trial` |

**Rollback:** frontend-only and stateless. Revert the PR commit; redeploy, or use Vercel's instant rollback to the
previous production deployment. No database, backend, flag or YouCam change is involved, so nothing needs to be
migrated back.

## 4. Stages 2–4 (summary)

**Stage 2 — low vision.** `ui.tsx` (Segmented ink selection + icon, Toggle borders, input borders, `min-h`),
`globals.css` (forced-colours block, eyebrow size, marquee pause/stop, float iteration limit, scroll padding),
`band-chart.tsx` (visible "Show the numbers" `details`, band outline, compared-point shape and label, server
classification for the compared check-in), `page.tsx` (legend copy, pause control), `framer.tsx` (move and centre
buttons), `docs/design-direction.md` (colour rule from `29` §3). Tests: contrast pairs, forced-colours artefacts,
framer move buttons change the crop, motion pause state. Risk: visual identity — review screenshots with the
owner. Rollback: revert.

**Stage 3 — capture.** `scan-flow.tsx` (guide disclosure, path ordering, two-failure hint, failure copy),
`framer.tsx` ("Use the whole photo"), `privacy/page.tsx` (guide section, what is/isn't checked), `results-view.tsx`
(ordering sentence, visible legend, mask sentence), `product-art.tsx` (decorative), `format.ts` (copy). The
default-zoom choice waits for participant photos (`31` §4). Tests: E2E text and focus; usability sessions.

**Stage 4 — optional.** Accessibility statement page + footer link (3.2.6 placement rule); "Read aloud with this
device's voice" label; trial list status text; per-trial delete UI (backend `DELETE /trials/{id}` exists); backend
per-history-point verdict field (`backend/app/api/presenters.py`) if the chart table should classify every point.

## 5. Optional features ranked

| Feature | Problem | Who benefits | Native/OS already solves? | Complexity | Testing needed | Verdict |
|---|---|---|---|---|---|---|
| **Result in words** (summary of score differences) | Verdict evidence locked in a dial and chart | Everyone; blind, low-vision, cognitive | No | S | AT + comprehension | **Core (Stage 1)** |
| **Improved capture guidance** | Blind users can't judge framing | Blind, low vision | Partly: iOS Camera VoiceOver, Pixel Guided Frame — the guide points to them | S | Usability with blind participants | **Core (Stage 3)** |
| **Accessible error recovery** | Focus loss and silent failures | Screen-reader, keyboard | No | S | AT | **Core (Stage 1)** |
| **Persistent accessibility/help entry** | No place to learn limits or ask for help | AT users | No | S | Content review | Optional (Stage 4); adds one footer link, no cognitive load |
| **Guided screen-reader workflow / separate mode** | — | — | The fixed main flow *is* the guided flow once focus and announcements work | M–L | — | **Reject**: a second mode doubles maintenance and splits testing |
| **"Read this result aloud" control** | Low-vision users who don't run a screen reader | Low vision, reading difficulty | Yes: macOS Spoken Content, iOS Speak Screen/Speak Selection, Android Select to Speak | S | Conflicts with screen readers | **Defer**; don't extend beyond the existing assistant button |
| **Spoken explanations during capture** | Hands-free guidance | Blind | Yes for framing (OS camera); ProofLoop has no face detection to drive it | M | Extensive | **Reject now**: would speak over the screen reader and could only repeat static text |
| **User text size / contrast preferences** | Small or faint text | Low vision | Yes: browser zoom, OS text size, increased contrast, forced colours | M | Low-vision testing | **Defer**: fix contrast and reflow instead (`29`) |
| **Simpler reading mode** | Dense pages | Cognitive, low vision | Partly: Safari Reader is unlikely to work on app screens [unverified] | M | Comprehension | **Defer**: Result in words + existing `details` cover the main need |
| **Saved accessibility preferences** | Re-setting preferences each visit | — | OS settings persist already | M + privacy review (local storage, no account) | — | **Reject** until a preference feature exists |

## 6. What this plan deliberately does not do

- It doesn't change verdict rules, bands, next-step logic or units, or ask Gemini to write accessible text.
- It doesn't add a UI or testing library.
- It doesn't claim WCAG conformance after any stage; `31` defines what evidence would support a claim.

## 7. Release 1 implementation record (2026-10-31)

**Where.** Branch `feat/a11y-r1`, cut from `main` (`bcc2cba`), in the worktree `.claude/worktrees/a11y-r1`.
PR #4 (`feat/skin-profile`) and its branch were not touched. Committed as `e6e3e85`; nothing pushed, merged or
deployed. No
backend file, scoring rule, band, instrument-check rule, protocol calculation, Gemini path or dataset changed. No
dependency was added (`npm ci` installed the existing lockfile in the worktree). The worktree's `backend/venv` is a
symlink to the main checkout's virtualenv so the E2E backend can start; it is untracked and must not be committed.

**Scope.** Stage 0 and Stage 1 as planned, plus the owner's item 6 (selected states, toggles, selected cards and
forced colours), which pulls the A11Y-11 part of Stage 2 forward. Found and fixed during testing: the
strawberry-glow made the final CTA's white body text 3.81:1 on phones (1.4.3).

### 7.1 Files changed

| File | Change | Issue · WCAG |
|---|---|---|
| `src/components/announcer.tsx` (new) | One persistent `role="status"` `aria-live="polite"` region (`#pl-announcer`) rendered in the first server markup; `useAnnounce()`; identical messages within 2 s are dropped; text is set in a later task so repeats still register. Also hosts `RouteHeadingFocus` | A11Y-14 · 4.1.3 |
| `src/lib/focus.ts` (new) | `focusIfFree`, `focusWhenRendered`, `focusPageHeading`: focus moves only when focus was lost (body, removed or hidden element) or sat inside the replaced area; route changes focus the first *visible* `h1` (Next.js 16 can keep the previous page mounted but hidden) | A11Y-01/02/04 · 2.4.3 |
| `src/app/layout.tsx` | Wraps nav, main and footer in `AnnouncerProvider` | — |
| `src/components/ui.tsx` | `Button`: `loading`/new `softDisabled` use `aria-disabled` and swallow clicks instead of `disabled`, so the pressed button keeps focus. `Notice`: static by default (`live` defaults to true only for errors); `headingRef` renders the title as a focusable `h2` that is not also a live region. `Segmented`: selected option is ink-filled with a check icon and a 2 px border (14.2:1; border survives forced colours). `Toggle`: `ink-3` border and knob (6.7:1 off), forced-colours system colours. `Card`/`Notice`: `CanvasText` border in forced colours. Focus outlines use `--focus-ring` | A11Y-05/11/14 · 2.4.3, 1.4.11, 4.1.3 |
| `src/app/globals.css` | `--focus-ring` token; `.on-strawberry`/`.on-espresso` set it to white. Strawberry-glow strengths 0.32/0.28 → 0.14/0.12 so white text keeps ≥4.5:1 at the glow centre | A11Y-08 · 2.4.7 (2.4.13); 1.4.3 |
| `src/app/scan/step-heading.tsx` (new) | `StepHeading` and `useStepFocusRef`: a step's heading takes focus on arrival once the user has moved past the opening step | A11Y-01 · 2.4.3 |
| `src/app/scan/scan-flow.tsx` | Every step has a focusable heading ("Add your photo", "Take your photo", "Is this a fair comparison?", "Measuring…"); failures render as a focused `h2` with the specific message (not also an alert, so it's read once); consent "Continue" is always operable and, unticked, focuses the box with `aria-invalid` and a described reason; file input `tabIndex={-1}`; nested `aria-live` wrappers removed; camera-ready, capture-match result and each server stage announced once; step-aware titles | A11Y-01/14/17/23 · 2.4.3, 3.3.1, 4.1.3, 2.4.2 |
| `src/app/scan/framer.tsx` | Focusable step heading; zoom slider `aria-valuetext="Zoom N percent"` | A11Y-10 (part) · 4.1.2 |
| `src/app/trial/result-in-words.tsx` (new) | Visible "Result in words" section built only from `comparison` server fields and the fixed copy for server codes (outcome headline, server delta and band, comparability level and issues, next-step title, early label, synthetic label); numbers are described as a result only for outcomes that use them; inconclusive says the scores "don't count as a result"; insufficient data uses its fixed body | A11Y-07 · 1.3.1, 1.1.1 |
| `src/app/trial/trial-view.tsx` | Verdict `h2` focusable and focused after the synthetic follow-up; instrument heading focused after the sample check; "Check again" replaces "refresh in a few seconds" (announces if still measuring, else focuses the result); Result in words under the verdict; dial gets the server outcome (`beyond`) and a summary without its own classification; comparability notice static; verdict panel `.on-espresso`; state-aware title | A11Y-02/07/16/23 |
| `src/components/dial.tsx` | Optional `beyond` (server decision) and `summary` props; homepage illustrations keep their own example summary | A11Y-07 |
| `src/components/band-chart.tsx` | Screen-reader table shows score and difference only; no client "beyond/within" | A11Y-07 |
| `src/app/trial/assistant-panel.tsx` | Uses the shared announcer (its own live region removed); quick questions and Ask stay focusable while pending; unlock, lock and "Stop using Gemini" move focus to the next control; "Show synthetic check-in" focuses the verdict. Owner key, consent versions, allowlisted actions and data sent to Gemini unchanged | A11Y-05/14 |
| `src/app/trials/trials-view.tsx` | Confirm and Cancel swap with `flushSync` and move focus in the same tick; the confirm button is described by the "can't be undone" sentence; success is a focused heading; errors cleared on retry | A11Y-02 · 2.4.3, 3.3.4 |
| `src/app/matches/matches-view.tsx` | List-wide `aria-live`/`aria-busy` removed; after a filter change: "N products match. M set aside by your filters." | A11Y-14 |
| `src/components/previews.tsx`, `src/app/page.tsx`, `src/app/home/how-it-works.tsx` | `PhoneFrame` is one `role="img"` with a short label saying "sample data", "synthetic demo" or "illustration"; the mock screen is `aria-hidden` | A11Y-06 · 1.1.1, 1.3.1 |
| `src/app/page.tsx`, `src/app/home/how-it-works.tsx` | Headline phrases on berry surfaces use `berry-deep` (rendered worst case was 2.79/2.84:1, now ≥3:1); final CTA `.on-strawberry` | A11Y-09/08 |
| `src/components/site-footer.tsx`, `src/app/product/product-view.tsx` | `.on-strawberry` / `.on-espresso` surfaces | A11Y-08 |
| `src/app/results/results-view.tsx` | Selected focus card: 2 px strawberry-ink border; radio mark keeps a `CanvasText` fill in forced colours; mask buttons bordered with `Highlight` state in forced colours | A11Y-11 · 1.4.11 |
| `src/app/home/verdict-explorer.tsx`, `how-it-works.tsx` | Selected tab / current step use `Highlight`/`HighlightText` in forced colours | A11Y-11 |
| `src/lib/hooks.ts` | `useDocumentTitle` | A11Y-23 · 2.4.2 |
| `e2e/helpers/a11y.ts` (new) | Shared axe gate with `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` (fails on serious/critical, logs the rest); canvas-normalised colours; rendered worst-case text contrast (all text hidden, element box captured, every pixel compared) | Stage 0 |
| `e2e/a11y.spec.ts` (new) | 21 tests: axe on `/scan`, `/privacy`, `/trials`; reflow at 320 px; preview noise; rendered headline/CTA contrast; focus rings per surface; scan step focus and consent validation; file input tab stop; first load leaves focus alone; route-change focus; filter announcement; selected-state contrast and check mark; forced colours; verdict focus + Result in words vs the server's own JSON; five stubbed outcomes including a server/number contradiction; instrument-check focus; Check again; assistant focus; delete-all focus | Stage 0/1 |
| `e2e/journey.spec.ts`, `protocol.spec.ts`, `camera.spec.ts`, `assistant.spec.ts` | Use the shared gate (2.0–2.2 tags). Deliberate expectation changes: scan failures are a focused heading, not `role="alert"`; consent Continue is not disabled; assistant answers are read from `#pl-announcer`; Ask while pending is `aria-disabled`; the early-look sentence is scoped because Result in words repeats it | — |

### 7.2 Decisions taken during implementation

- **One voice per event.** An event either moves focus (the new heading is read) or is announced, never both.
  Step-replacing failures therefore lose `role="alert"`. Inline errors that don't replace the pressed control
  keep `role="alert"`.
- **Route changes** focus the new page's `h1`. Next.js's own announcer may still read the title just before: these
  differ ("Your snapshot · ProofLoop" vs "Your skin snapshot") but may sound repetitive. This must be judged in the
  VoiceOver/TalkBack sessions (`31` §7).
- **The chart's visual point colours** are still derived in the browser (visual only, unchanged); the text
  equivalents no longer are. Server-sourced visual classification belongs to Stage 2 (A11Y-15).

### 7.3 Not done in Release 1

| Item | Why | Next step |
|---|---|---|
| Profile removal / profile form focus and announcements (A11Y-02b) | That code exists only on PR #4's branch; this branch is from `main` by the owner's choice | Apply the same pattern to `profile-block.tsx` and `skin-profile.tsx` after PR #4 merges: `focusWhenRendered` to the confirm button / first field, focused result sentence after save/remove, `announce("Answers applied. The focus list has been re-ordered.")` |
| Framer move buttons (A11Y-10 part), visible chart table and markers (A11Y-15), motion pause (A11Y-13), sticky scroll padding (A11Y-12), eyebrow/badge sizes, `min-h` buttons | Stage 2, not approved | — |
| Capture guide, "Use the whole photo", ordering sentence, mask sentence, decorative product art | Stage 3, not approved | — |
| Accessibility statement, "Read aloud" label | Stage 4, optional | — |

**Integration (2026-10-31).** `main` (`c0f01c3`: #5–#7) was merged into the branch as `e6b91cc` with no conflicts;
results in `31` §6.3. Known limitations carried into review: `31` §6.5.

**Rollback.** Frontend-only and stateless: discard the worktree branch, or after a future merge revert the commit
and use Vercel's instant rollback. Nothing to migrate.
