# 25 — Accessibility audit report: blind and low-vision users (2026-10-26)

**Status: research document (2026-10-26).** Written before any code changed. **Release 1** (Stages 0 and 1 of `30`)
has since been implemented as `e6e3e85` on `feat/a11y-r1`; it is not deployed. §5 starts with each issue's Release 1 status; `30` §7
and `31` §6 hold the implementation and verification records. `path:line` references point to the audited revision
`94ecb84`, before Release 1, so many have moved. This is the evidence file for the accessibility package:

| File | Contents |
|---|---|
| `25` (this file) | Route map, shared components, journeys, route-by-route findings, ranked issue register |
| `26-A11Y-PRINCIPLES-AND-JOURNEYS.md` | User groups, design principles, screen-reader journey maps |
| `27-A11Y-WCAG22-TRACEABILITY.md` | WCAG 2.2 AA traceability matrix |
| `28-A11Y-CAMERA-AND-RESULTS-SPEC.md` | Accessible capture, image feedback, scores, comparison and verdict presentation |
| `29-A11Y-DESIGN-SYSTEM.md` | Token, focus, contrast, forced-colours and motion recommendations |
| `30-A11Y-IMPLEMENTATION-PLAN.md` | Staged plan, optional-feature ranking, files, tests, rollback |
| `31-A11Y-VERIFICATION-AND-RISK.md` | Verification matrix (done vs future), AT scenarios, user research, residual risk |
| `32-A11Y-DECISION-MEMO.md` | What to build first, what to defer, why it matters for ProofLoop |

**What was reviewed.** Branch `feat/skin-profile` at `94ecb84`: production `bcc2cba` plus PR #4's optional checked
skin profile behind `SKIN_PROFILE_ENABLED`. PR #4 is a draft, not merged, and the flag is off in production.
Findings marked **[flag]** exist only on PR #4's branch: they are **not** part of the production baseline (`main`,
`bcc2cba`) and **not** part of accessibility Release 1, which was built on `main`. Stack: Next.js 16.4.3 (App Router), React 19.3, Tailwind 4, lucide-react, Playwright 1.64 with
`@axe-core/playwright` 4.10 (`frontend/package.json`).

**Evidence labels**

| Label | Meaning |
|---|---|
| **[std]** | Normative W3C text (WCAG 2.2 Recommendation, 12 Dec 2024, <https://www.w3.org/TR/WCAG22/>) |
| **[guide]** | Implementation guidance: W3C WAI tutorials/Understanding, WAI-ARIA APG, MDN, vendor docs (URL given) |
| **[research]** | Survey or peer-reviewed work (abstract/summary level unless stated) |
| **[repo]** | Read in this repository (`path:line`) |
| **[live]** | Observed on <https://proofloop-app.vercel.app> on 2026-10-26 with the in-app browser (read-only; no data created) |
| **[measured]** | Contrast computed from the CSS tokens with the WCAG relative-luminance formula (script in §6) |
| **[inference]** | Our reasoning from the above, not an observation |
| **[unverified]** | Not checked; the verification step is named in `31` |

No finding below comes from testing with a screen reader or with disabled people. Announcements described as
"expected" are derived from code and documented AT behaviour, and must be confirmed in `31`.

---

## 1. Route map

| Route | Entry | Main component | Purpose | Title (`metadata`) |
|---|---|---|---|---|
| `/` | — | `src/app/page.tsx` + `home/*` | Value proposition, demo previews, verdict explainer | "ProofLoop — is your skincare working? Run a fair test." |
| `/scan` | Nav "Start a fair test" | `scan/scan-flow.tsx`, `scan/framer.tsx` | Consent → choose → camera/upload → frame → (capture match) → analysing → failed | "Scan · ProofLoop" (all steps) |
| `/scan?trial=…` | Trial "Check in now" | same | Check-in capture with free capture-match preflight | same |
| `/scan?trial=…&repeat=1` | Instrument check | same | Second baseline photo of unchanged skin | same |
| `/results?scan=…` | After analysis / sample data | `results/results-view.tsx`, `results/skin-profile.tsx` [flag] | Eight scores, masks, skin-type card [flag], "In your words" [flag], focus picker | "Your snapshot · ProofLoop" |
| `/matches?scan=…&goal=…` | Focus picker | `matches/matches-view.tsx` | Filtered, tiered product list with reasons | "Matches · ProofLoop" |
| `/product?id=…&scan=…&goal=…` | Match card | `product/product-view.tsx` | Facts, match logic, Skin Simulation preview, start trial | "Product · ProofLoop" |
| `/trial?id=…` | After start / My trials | `trial/trial-view.tsx`, `trial/assistant-panel.tsx`, `trial/profile-block.tsx` | Waiting state or verdict, next step, comparability, all concerns, assistant, instrument check, plan, profile, history chart | "Trial · ProofLoop" |
| `/trials` | Nav "My trials" | `trials/trials-view.tsx` | Trial and scan lists; delete all data | "My trials · ProofLoop" |
| `/privacy` | Nav, footer | `privacy/page.tsx` | Method, data flow, matching, limits | "How it works & privacy · ProofLoop" |
| `*` | — | `not-found.tsx` | 404 | default |

Steps 1–4 are labelled visually ("Step 1 of 4 · Measure" … "Step 4 of 4 · Trial") in a pill or eyebrow; they are
plain text, not exposed as a progress structure [repo `scan-flow.tsx:58`, `results-view.tsx:74,222`,
`matches-view.tsx:47`, `trial-view.tsx:35`].

## 2. Shared components

| Component | File | Used by | Accessibility-relevant behaviour |
|---|---|---|---|
| Root layout | `src/app/layout.tsx` | all | `lang="en"`, skip link to `#main`, `<main id="main">`, sticky nav, footer |
| `SiteNav` | `components/site-nav.tsx` | all | `nav aria-label="Primary"`, `aria-current="page"`, mobile disclosure with `aria-expanded`/`aria-controls`, Escape closes |
| `SiteFooter` | `components/site-footer.tsx` | all | Two `nav` landmarks on a `bg-strawberry-ink` surface; decorative SVG wordmark `aria-hidden` |
| `Button`, `ButtonLink` | `components/ui.tsx:23-55` | all | Native elements; `loading` sets `disabled` + `aria-busy` |
| `Notice` | `components/ui.tsx:66-91` | all | `role="alert"` for error, `role="status"` otherwise — **on every instance, including static ones** |
| `Spinner`, `Skeleton` | `components/ui.tsx:93-106` | loading states | Spinner has `role="status"` + text; Skeleton is `aria-hidden` with no text |
| `Segmented` | `components/ui.tsx:108-145` | filters, profile answers, simulation strength | Native radios (`sr-only`) in `fieldset`/`legend` |
| `Toggle` | `components/ui.tsx:147-156` | fragrance filter | Native checkbox with `role="switch"` |
| `PageIntro` | `components/ui.tsx:158-166` | `/trials`, 404 | `h1` |
| `Reveal`, `useInView` | `components/reveal.tsx` | home, dial | Visible without JS and under reduced motion |
| `Dial` | `components/dial.tsx` | home, verdict | SVG `aria-hidden` + `sr-only` summary sentence |
| `BandChart` | `components/band-chart.tsx` | trial history | SVG `aria-hidden` + `sr-only` data table |
| `MetricBar`, `ProvenanceBadge/Note`, `BandLegend` | `components/measure.tsx` | results, matches, trials | Score as text + "out of 100"; bar `aria-hidden`; provenance detail in `title` |
| `PhoneFrame` + `*Screen` previews | `components/previews.tsx` | home, scan guide | `<figure aria-label>` whose mock-screen text **is exposed** |
| `ProductArt` | `components/product-art.tsx` | matches, product, trial | `role="img" aria-label="Illustration of …"` |
| `useGo` | `lib/navigation.ts` | flow navigation | `scrollTo(0)` + `router.push`; does not manage focus |

## 3. Core end-to-end journeys

| ID | Journey | Routes |
|---|---|---|
| J1 | Explore with sample data to a labelled synthetic verdict | `/` → `/results` → `/matches` → `/product` → `/trial` |
| J2 | Live baseline: consent, capture or upload, frame, analyse | `/scan` → `/results` |
| J3 | Instrument check (second photo of unchanged skin) | `/trial` → `/scan?repeat=1` → `/trial` |
| J4 | Check-in and verdict (every outcome) | `/trial` → `/scan?trial` → capture match → `/trial` |
| J5 | Ask the trial assistant | `/trial` |
| J6 | Skin profile: answer, save, edit, remove [flag] | `/results`, `/trial` |
| J7 | Delete all data | `/trials` |

Journey maps with expected announcements are in `26` §4.

## 4. Route-by-route findings

IDs refer to the register in §5. "Strength" rows record what already works and should be preserved.

### 4.1 Global (layout, nav, footer, focus, motion)

- **Strength.** Skip link is the first tab stop and works (E2E test `e2e/journey.spec.ts:159`); `lang="en"`;
  landmarks `header`/`nav`/`main`/`footer`; `aria-current="page"`; the mobile menu is a real disclosure.
- **Strength.** Reduced motion is honoured globally (`globals.css:243-259`) and reveal content is visible without
  JS (`reveal.tsx`, `layout.tsx:36`).
- **Strength.** At 320 CSS px wide the live homepage has no horizontal page scroll (`scrollWidth` 320 = viewport)
  [live]. This is evidence for 1.4.10 Reflow on `/` only.
- **A11Y-08 Focus ring invisible on strawberry surfaces.** The only focus style is
  `:focus-visible { outline: 3px solid var(--color-strawberry-ink) }` (`globals.css:90-94`). On the footer, the
  final CTA and the How-it-works phone panels the background *is* strawberry-ink, so the ring is 1.00:1 [measured].
  On production, Tab onto the footer "Start a fair test" link gives `:focus-visible` = true, outline
  `rgb(214,26,47) 3px solid` on background `rgb(214,26,47)` and no underline: nothing visible [live]. On espresso
  panels the ring is 3.19:1 [measured], just above 3:1.
- **A11Y-12 Sticky layers may hide focus.** The nav is `sticky top-0` (~4.5 rem incl. padding) and the homepage
  step bar is also sticky (`how-it-works.tsx:448`, `top-[5.25rem]` / `sm:top-24`). `scroll-padding-top` is 6 rem
  (`globals.css:74`), less than the two stacked layers [inference]. WCAG 2.4.11 names sticky headers as the
  typical cause and lists scroll-padding as technique C43 [guide:
  <https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html>]. **[unverified]** — reverse-tab
  test in `31` §2.
- **A11Y-13 Endless motion.** `.marquee` (38 s loop) pauses only on `:hover`; `.float` chips loop every 6 s
  (`globals.css:192-200`, `page.tsx:108-127`, `previews.tsx:180`). Only `prefers-reduced-motion` stops them.
  WCAG 2.2.2 requires a pause/stop/hide mechanism for automatic motion lasting over 5 s shown alongside other content
  [std]; hover is not available to keyboard or touch users [inference].
- **A11Y-04 No focus management on client navigation.** `useGo` scrolls and pushes; Next.js 16.4.3's scroll handler
  states "This handler intentionally leaves focus untouched; resetting focus on navigation is deferred"
  (`node_modules/next/dist/client/components/layout-router.js`, ~line 152) [repo]. The App Router announcer
  (`app-router-announcer.js`) speaks `document.title` when it changes [repo]. So after "See matching products" the
  user hears "Matches · ProofLoop" and focus stays on a now-removed button (browser fallback: `<body>`) [inference].
  Titles do not change between scan steps or between a waiting trial and a verdict (§1).

### 4.2 Homepage `/`

- **Strength.** One `h1`, 30 headings in a sensible outline [live]; the verdict explorer is a correct APG tabs
  pattern with arrow keys and roving `tabindex` (`verdict-explorer.tsx:606-641`); the problem rail is a focusable
  labelled region with button alternatives to swiping (`problem-rail.tsx:515-546`); the marquee duplicate is
  `aria-hidden`.
- **A11Y-06 Preview noise.** Ten `PhoneFrame` figures expose their mock screens to AT: ~1,450 characters of
  sample and synthetic UI (counted on production) [live]. One reads "Verdict … A measured change. 69 → 77" from a
  synthetic demo (`previews.tsx:157-178`). The "Synthetic demo" tag is inside, but a screen-reader user hears the
  fake screen as content before the labels make sense [inference].
- **A11Y-09 Display text below 3:1.** `text-strawberry` (`#fe3144`) is used for headline phrases on
  `berry-glow` (berry-milk) backgrounds: hero "Run a fair test." (`page.tsx:40`) and "hope to evidence."
  (`how-it-works.tsx:444`). 2.82:1 on berry-milk; 2.03:1 at the glow's red hotspot [measured]. Large text needs
  3:1 (1.4.3) [std]. On white/paper it is 3.66/3.46:1 and passes as large text. axe skips text whose background
  is a `background-image` [guide: <https://dequeuniversity.com/rules/axe/4.10/color-contrast>], which is why the
  existing axe runs (`docs/final-audit.md:50`) report nothing.
- **A11Y-19 Colour-named legend.** "Black needle: baseline. Pink arc: normal variation. Red needle: a check-in
  beyond it." (`page.tsx:176`). The dial's sr-only summary covers screen-reader users; sighted users with colour
  vision deficiency get a colour-only key. The dashed/solid needle difference is not mentioned [inference].
- **Low.** The dial's centre value "±5" is announced after the summary, repeating it; pronunciation of "±" varies
  by screen reader [unverified].

### 4.3 Scan `/scan` (consent, choose, camera, frame, capture match, analysing, failed)

- **Strength.** Consent text is clear; camera permission is requested only on "Take a photo"; every camera error
  has a specific message and an upload fallback (`scan-flow.tsx:280-306`, E2E `camera.spec.ts:81-99`); file type,
  size and minimum resolution are validated with plain explanations (`scan-flow.tsx:221-244`); the capture-match
  conditions are a real `table` with a caption (`scan-flow.tsx:446-455`); analysis progress has text states
  "done / in progress / waiting".
- **A11Y-01 Focus is lost at every step.** The whole step is swapped by `setStep` (`scan-flow.tsx:43-160`); the
  activating button unmounts; only `window.scrollTo` runs (`:51-53`). Continue → choose, Take a photo → camera,
  Capture → frame, Analyse → analysing, failure → failed: focus falls to `<body>` each time and nothing is
  announced except an error `role="alert"` [inference from code; behaviour on `<body>` focus varies by AT,
  **[unverified]**]. This affects every live capture and both check-in types.
- **A11Y-03 No nonvisual framing.** The camera view has an oval drawn in SVG (`scan-flow.tsx:330-332`) and the
  framer shows "Drag to position" (`framer.tsx:133-137`). Nothing tells a blind user whether their face is in the
  oval; there is no face detection in the client. What *is* checked automatically is listed in `28` §2.
- **A11Y-10 Framer needs dragging or a keyboard.** Position changes only by pointer drag or arrow keys inside a
  `role="application"` (`framer.tsx:53-75,103-113`). WCAG 2.5.7 requires a single-pointer alternative to dragging
  [std]; zoom has buttons and a slider, position does not. The zoom slider announces raw values (1.6) with no
  `aria-valuetext`.
- **A11Y-17 Hidden file input is a second, invisible tab stop.** The `sr-only` `<input type=file>` (`:258`)
  remains focusable after the visible "Upload a photo" button, with no visible focus [inference]; screen-reader
  users meet "Upload a photo" twice.
- **A11Y-14 Announcements.** "Starting camera…" is not a live region and the Capture button silently becomes
  enabled (`:333-344`); the capture-match result sits inside an `aria-live="polite"` wrapper that also contains the
  heading, the explanation, a nested `role="status"/"alert"` Notice and a table (`:425-480`) — likely double or
  verbose speech [inference]; the analysing stage list is `aria-live="polite"` and re-renders five items per stage
  (`:563-577`).
- **Low.** "Continue" is `disabled` until the consent box is ticked (`:204`), so it is skipped in tab order and
  gives no reason [inference].

### 4.4 Results `/results`

- **Strength.** Each concern is a list item with name, score "out of 100" (sr-only) and a text band label
  (`measure.tsx:39-63`); the band colours have darker text variants (`format.ts:28-33`); the focus picker uses
  native radios in a `fieldset`, so the selected state is exposed; missing concerns are stated, never filled.
- **A11Y-14 (cont.) Silent loading.** The page-level `Loading()` (`results-view.tsx:290-301`) and the profile
  skeletons are `aria-hidden` boxes with no text.
- **A11Y-20 Unexplained order.** Without a server plan the focus list is ordered "testable first, lowest score
  first" (`results-view.tsx:204-215`) but the only cue is a "Most room" badge on the first item; the
  `ranking_explanation` sentence appears only with the flag on (`:228`).
- **A11Y-21 Masks are visual-only.** Alt text "Your photo" and "{label} detection mask" (`:171,177`) name the
  image but carry none of its information; that is acceptable only if the page says the overlay adds no
  measurement beyond the score [inference].
- **[flag] A11Y-11 Selected state contrast.** `Segmented` marks the chosen option by a white pill on
  `bg-sunken`: 1.16:1 [measured]; WCAG 1.4.11 needs 3:1 for visual information identifying state [std]. Used for
  the profile questions, filters and simulation strength. Priority chips use `bg-ink` (fine).
- **[flag] Low.** "2 of 2 selected" is announced via a pre-rendered `aria-live` paragraph — good pattern. Tapping
  a third chip silently does nothing.

### 4.5 Matches `/matches` and product `/product`

- **A11Y-14 (cont.)** The entire results area is `aria-live="polite" aria-busy` (`matches-view.tsx:73`): changing
  a filter can re-announce the whole product list, or nothing until busy clears [inference]. There is no
  short "3 products match; 2 set aside" message.
- **A11Y-11 (cont.) Toggle.** Off-state track `line-strong` on `sunken`: 1.41:1 [measured].
- **A11Y-22 Redundant illustration names.** `ProductArt` has `role="img"` "Illustration of {name}" next to the
  same name as a heading (`product-art.tsx:16`).
- **Low.** "Details & trial" repeats on every card (`:157`); passes 2.4.4 in context but lists of links read
  "Details & trial" ×N. Tier and provenance detail is also in `title` attributes (`:146`, `measure.tsx:15`),
  which are not available to touch or keyboard users (the detail text is visible nearby, so no loss).
- **Product page.** The Skin Simulation before/after uses a range slider with a clear label; the images have
  honest alt text (`product-view.tsx:198,201`). The "Start a trial" error uses `role="alert"`. The
  `#ffb4a2` error text on ink is 9.69:1 [measured].

### 4.6 Trial `/trial` (waiting, instrument check, verdict, next step, plan, history)

- **Strength.** The verdict is carried in words in an `h2` ("Measured change: up, beyond normal variation.";
  `format.ts:56-82`); up and down share one colour by design, so direction never depends on colour
  (`globals.css:38-45`, `trial-view.tsx:143-146`); every-concern and instrument-check data are real tables with
  `scope`, a caption and focusable scroll regions; the plan's three zones are an ordered list with text values;
  "assumed" bands are labelled in text.
- **A11Y-02 Verdict and instrument-check updates are silent and drop focus.** "Show synthetic 21-day follow-up"
  (`trial-view.tsx:92-133`), the assistant's "Show synthetic check-in" (`assistant-panel.tsx:400-416`) and "Run
  the sample instrument check" (`:270-301`) replace the clicked control's container. The verdict section is
  inserted *above* the old focus position; nothing is announced [inference].
- **A11Y-07 Accessible text recomputes the verdict.** The dial's sr-only summary decides "beyond"/"within"
  itself (`dial.tsx:55-61`) and the chart's sr-only table does the same per point (`band-chart.tsx:81-90`).
  Today both match the server rule `abs(delta) <= band` (`backend/app/domain/compare.py:197-208`) [repo]. But
  the verdict for an inconclusive comparison, an early look or a widened band is decided on the server; any
  client re-derivation can drift. Integrity issue, not a current user-facing error.
- **A11Y-15 Chart for sighted low-vision users.** Within and beyond points differ only in colour, 1.13:1 against
  each other; the band fill is 1.14:1 against white [measured]; the data table is `sr-only`, so a magnifier user
  cannot use it (`band-chart.tsx:69`).
- **A11Y-16 "Refresh in a few seconds" with no control.** Processing check-ins and instrument checks ask the user
  to refresh (`trial-view.tsx:57,329`); there is no button or polling.
- **Low.** The "Focus" badge is 0.65 rem white on accent; the dial is greyed out (`opacity-60 grayscale`) when
  inconclusive, which is decorative because the heading says so.

### 4.7 Assistant panel (`/trial`)

- **Strength.** A persistent `sr-only` `aria-live="polite"` region exists from first render and receives a full
  text version of each answer, including its source label (`assistant-panel.tsx:194-198`); errors use
  `role="alert"`; source labels are text, never colour ("From your plan · no AI"); the canonical verdict is not
  restated by Gemini (topic selection only); consent checkboxes are native; the owner-key field is labelled and
  linked to its error.
- **A11Y-05 Pressed buttons become `disabled`.** Quick-question buttons and Ask set `disabled={pending}`
  (`:186,274`). Disabling the focused element removes it from focus in Chromium [inference; **[unverified]** per
  browser], so the user is dropped to `<body>` just as the answer is announced.
- **A11Y-18 Read aloud competes with screen readers.** `speechSynthesis` plays alongside VoiceOver/TalkBack
  (`:333-347`). It is optional and stops on unmount; it duplicates native features (see `30` §5).
- **Low.** Input rings `line-strong` on white: 1.64:1 [measured] (owner-only form).

### 4.8 Skin profile on `/trial` [flag: PR #4 only] and My trials `/trials`

- **A11Y-02b Destructive and editing flows drop focus.** "Remove profile" → confirm → "Remove"
  (`profile-block.tsx:106-118`), "Edit answers" → form (`:93-105`), "Delete all my data" → "Yes, delete
  everything" (`trials-view.tsx:99-110`): each swap unmounts the focused button. The deletion success message is
  a `role="status"` Notice that is *mounted with its text* at the top of the page (`trials-view.tsx:48`); MDN
  advises that live regions be present before their content changes [guide:
  <https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions>], so this announcement is
  unreliable [inference]. The profile removal result has no announcement at all; the text inside the `<details>`
  just changes.
- **Strength.** Deletion requires a confirmation step and says it cannot be undone (3.3.4 "Confirmed") [std];
  the confirmation restates the scope; the profile block states that removal leaves scores, plan and result
  unchanged.
- **Observation (not invented).** The backend exposes `DELETE /trials/{id}` and `DELETE /scans/{id}`
  (`backend/app/api/v1/trials.py:367`, `scans.py:171`); the UI offers only "Delete all my data". Per-trial
  deletion is a product decision (`32`).
- **Low.** The trials list does not say whether a trial has a verdict yet; each link's name is the whole row.

### 4.9 Privacy `/privacy` and 404

- **Strength.** Plain headings per section with anchors used by the footer; code spans for endpoints. No issues
  beyond the global ones.

## 5. Ranked issue register

**Release 1 status (`e6e3e85`, not deployed).** Detail per file in `30` §7; verification in `31` §6.

| Status | Issues |
|---|---|
| Implemented in Release 1 (Stages 0–1, plus the owner's selected-state item) | A11Y-01, 02 (except 02b), 04, 05, 06, 07 (text equivalents; the chart's visual point colours are unchanged), 08, 09, 11, 14, 16, 17, 23 |
| Partly implemented | A11Y-10 (zoom `aria-valuetext` only; move buttons are Stage 2) |
| Not implemented: depends on PR #4 | A11Y-02b (profile removal and profile form focus), applies only once PR #4 merges |
| Not implemented: Stage 2 (not approved) | A11Y-12, 13, 15, 19, 24, 25 |
| Not implemented: Stage 3 (not approved) | A11Y-03, 20, 21, 22 |
| Not implemented: Stage 4 (optional) | A11Y-18, 26 |

The table below is the original pre-release register and is kept unchanged as the baseline.

**Severity framework.** *Blocker* — prevents a blind or low-vision user completing a core journey (J1–J7)
independently. *High* — completion possible but with significant confusion, risk of a wrong belief, or a WCAG AA
failure on a core path. *Medium* — inconsistent or effortful; AA failure off the core path. *Optional* — an
improvement beyond AA or a convenience.

Groups follow the brief: **1** blockers, **2** significant AT problems, **3** low-vision readability, **4**
announcement/focus consistency, **5** enhancements.

| ID | Grp | Priority | Affected users | Where | Current behaviour (evidence) | WCAG | Why it's a barrier | Fix (summary; detail in `28`–`30`) | Complexity · deps | Regression risk | Test that proves it |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A11Y-01 | 1 | **Blocker** | Screen-reader and keyboard users | `scan/scan-flow.tsx:43-160`, `framer.tsx` | Step swap unmounts the focused button; focus → `<body>`; no announcement [repo] | 2.4.3, 4.1.3, 1.3.2 | User doesn't know a new step appeared or where it starts; the capture flow is the product's entry | Move focus to each step's heading (`tabIndex={-1}`) after the step renders; set a step-specific `document.title` | S · none | Low (focus only) | E2E: after each transition, `document.activeElement` is the step heading; VO/TalkBack scripts in `31` |
| A11Y-02 | 1 | **Blocker** | Screen-reader, keyboard | `trial/trial-view.tsx:92-133,270-301`, `assistant-panel.tsx:400-416`; (b) `trials-view.tsx:21-110`, `profile-block.tsx:43-119` | Verdict/instrument result appear silently above; delete/remove/edit flows drop focus; success not reliably announced [repo] | 2.4.3, 4.1.3, 3.3.4 | The verdict is the product's answer; deletion is a privacy promise — both must be perceivable | Focus the new verdict `h2` / instrument heading / confirm button / success message; announce outcomes through a persistent live region | S–M · shared announcer | Low | E2E focus assertions + announcer-text assertions; AT scripts |
| A11Y-03 | 1 | **Blocker (partly removable)** | Blind users capturing independently | `scan-flow.tsx:267-349`, `framer.tsx` | No nonvisual framing feedback; only post-hoc server rejections [repo] | 1.1.1, 3.3.2 (instructions), 1.3.3 | Blind users cannot know whether the photo is usable or comparable before spending a scan | Accessible capture guide; recommend OS accessible camera (iOS VoiceOver face announcements; Pixel Guided Frame) + Upload; announce camera states; "same method every time"; optional sighted help, never required (`28`) | M · copy + small UI | Low | Usability sessions (`31` §4); TalkBack/VO scripts |
| A11Y-04 | 2 | High | Screen-reader, keyboard | `lib/navigation.ts`, all flow pages | Route change announces only the generic title; focus not reset [repo, Next source] | 2.4.3, 2.4.2 | User must re-find their place on every step of J1/J2 | Focus the `h1` after client navigation within the flow; informative titles (e.g. "Verdict: no clear change yet · Hydration trial") | S · none | Low–Med (double speech of title + h1; test) | E2E: `h1` focused after `useGo`; AT scripts |
| A11Y-05 | 2 | High | Screen-reader, keyboard | `trial/assistant-panel.tsx:186,274`; `Button loading` in `ui.tsx:38` | `disabled` on the focused button while pending | 2.4.3 | Focus loss at the moment the answer arrives | Use `aria-disabled="true"` + ignore clicks while pending; keep focus | S | Low | E2E: focus stays on the pressed button |
| A11Y-06 | 2 | High | Screen-reader | `components/previews.tsx:14-26`, `page.tsx`, `how-it-works.tsx`, `scan-flow.tsx:169` | ~1,450 chars of mock UI read as content, incl. a synthetic "A measured change." [live] | 1.3.1, 1.1.1 | Noise; risk of mistaking demo numbers for results | Treat each preview as one image: hide inner content from AT, give a one-sentence description that says "sample" or "synthetic" | S | Low | axe + text snapshot of accessibility tree (Playwright `ariaSnapshot`) |
| A11Y-07 | 2 | High (integrity) | Screen-reader | `components/dial.tsx:55-61`, `band-chart.tsx:81-90` | Summary/table re-derive "beyond/within" client-side [repo] | 1.3.1 (equivalence) | Text equivalent could contradict the server verdict | Build summaries only from server fields (`focus_outcome`, `changes[].verdict`); history rows show numbers and difference only, unless the server supplies a verdict | S (frontend) · optional backend field | Low | Unit/E2E: summary text equals `OUTCOME_COPY[focus_outcome]` for each outcome fixture |
| A11Y-08 | 3 | High | Keyboard users with low vision | `globals.css:90-94`; strawberry/espresso surfaces | Focus ring same colour as background (1.00:1) [live, measured] | 2.4.7, (2.4.13 AAA) | Focus disappears in footer and CTA panels | Surface-aware `--focus-ring` (white on strawberry/espresso, strawberry-ink or espresso on light) | S | Low | Screenshot test of focused footer link; contrast unit check |
| A11Y-09 | 3 | High | Low vision | `page.tsx:40`, `how-it-works.tsx:444` (berry-glow headings) | `#fe3144` large text 2.82:1 (2.03:1 hotspot) [measured] | 1.4.3 | Headline phrases fade into the pink | Use `berry-deep` (5.28:1 on berry-milk, 3.80:1 at hotspot) on berry surfaces; keep `#fe3144` on white/paper only | S | Low (visual) | Token contrast check; visual review |
| A11Y-10 | 2 | High | Pointer-only motor + low vision; switch users | `scan/framer.tsx` | Positioning only by drag or arrow keys; slider value "1.6" [repo] | 2.5.7, 4.1.2 | Users who can't drag can't position the photo | Add move buttons (up/down/left/right, centre) and `aria-valuetext` ("Zoom 160%") | S | Low | E2E: buttons change offset; axe |
| A11Y-11 | 3 | High | Low vision; forced-colours users | `components/ui.tsx:117-156`; `results-view.tsx:239-246`; inputs | Selected segment 1.16:1; toggle off 1.41:1; input ring 1.64:1 [measured]; selection shown by background/box-shadow which forced colours remove [guide: MDN forced-colors] | 1.4.11 | Users can't see which answer/filter is chosen | Selected = ink fill + check icon; toggle and inputs get `ink-3` borders; forced-colours fallbacks (`29` §5) | S–M | Medium (visual identity) | Contrast checks; `emulateMedia({forcedColors:'active'})` screenshots |
| A11Y-12 | 3 | Medium | Keyboard low-vision | `globals.css:74`, `how-it-works.tsx:448` | Two sticky layers vs 6 rem scroll padding [inference] | 2.4.11 | Focused item can sit under the step bar | Increase scroll padding on `/`, or un-stick the step bar under 900 px | S | Low | Reverse-Tab E2E: focused rect not covered by sticky rects |
| A11Y-13 | 3 | Medium | Low vision, attention/cognitive, vestibular | `globals.css:192-200`, `page.tsx:108`, `previews.tsx:180` | Marquee and float loop forever; hover-only pause [repo] | 2.2.2 | Moving text competes with reading; zoomed users see constant motion | Pause control or stop after one pass; float stops after a few cycles | S | Low | E2E: animation state after pause; manual |
| A11Y-14 | 4 | High | Screen-reader | `ui.tsx:66-106`, `matches-view.tsx:73`, `scan-flow.tsx:425,563`, loading skeletons | Mixed live-region patterns; silent skeletons; whole-list live region [repo] | 4.1.3 | Some changes are silent, others verbose | One persistent polite announcer + `announce()`; `Notice` no longer implicitly live; short messages ("Loading your snapshot", "3 products match") | M | Medium (announcement timing) | E2E on announcer text; AT scripts |
| A11Y-15 | 3 | Medium | Low vision, CVD | `components/band-chart.tsx` | Point colours 1.13:1 apart; band 1.14:1; table sr-only [measured] | 1.4.1, 1.4.11 | Can't tell which points are beyond the band | Visible "Show the numbers" table (disclosure); marker shape + text label for compared point; band outline | S–M | Low | Visual + axe |
| A11Y-16 | 4 | Medium | All, esp. screen-reader | `trial-view.tsx:57,329` | "Refresh in a few seconds", no control [repo] | 3.3.2 (instructions), usability | Browser reload loses place; SR users rarely reload | Add "Check again" button (or poll ≤ every 3 s for 60 s) with an announcement | S | Low | E2E with processing fixture |
| A11Y-17 | 4 | Medium | Keyboard, screen-reader | `scan-flow.tsx:258` | Focusable invisible file input [repo] | 2.4.7, 2.4.3 | Extra invisible stop; duplicate control | `tabIndex={-1}` on the input; the button stays the control | XS | Low | E2E tab order |
| A11Y-18 | 5 | Optional | Screen-reader (conflict), low vision (benefit) | `assistant-panel.tsx:333-347` | Read aloud via `speechSynthesis` [repo] | — | Two voices at once | Keep optional; label "Read aloud with this device's voice"; don't extend to results (`30` §5) | XS | Low | Manual |
| A11Y-19 | 3 | Medium | CVD | `page.tsx:176` | Legend names colours only [repo] | 1.4.1 | Colour-only key | Name shape too: "solid line = baseline; shaded arc = normal variation; dashed needle = inside, solid = beyond" | XS | None | Copy review |
| A11Y-20 | 4 | Medium | Screen-reader, cognitive | `results-view.tsx:204-228` | Ordering rule not stated without flag [repo] | 1.3.1, 3.3.2 | Users can't tell why an item is first | Always show the ranking sentence | XS | None | E2E text |
| A11Y-21 | 4 | Low | Screen-reader | `results-view.tsx:155-198` | Mask alt names but doesn't explain [repo] | 1.1.1 | Unclear whether something is missed | One sentence: "The overlay shows where YouCam looked; it adds no score beyond the numbers above" | XS | None | Copy review |
| A11Y-22 | 4 | Low | Screen-reader | `product-art.tsx:16` | Redundant `role=img` names [repo] | 1.1.1 | Noise | Mark decorative (`aria-hidden`) | XS | None | axe/ariaSnapshot |
| A11Y-23 | 4 | Low | Screen-reader | Page titles (`*/page.tsx`) | Static titles across states [repo] | 2.4.2 | Title can't orient the user mid-flow | State-aware `document.title` | S | Low | E2E `toHaveTitle` |
| A11Y-24 | 5 | Optional | Low vision | `globals.css:140-146` (`.eyebrow` 0.72 rem), badges 0.65–0.7 rem | Small uppercase spaced text [repo] | (1.4.12 OK; AAA-adjacent) | Hard to read at default size | Eyebrow 0.8125 rem, less tracking; badges ≥ 0.75 rem | XS | Low | Visual |
| A11Y-25 | 5 | Optional | Low vision with text spacing/zoom | `ui.tsx:17-21` fixed `h-10/h-12/h-14` | Fixed-height pills [repo] | 1.4.12, 1.4.4 | Wrapped text may overflow at 200 % text or with spacing overrides **[unverified]** | `min-h-*` + vertical padding | XS | Low | Text-spacing bookmarklet test (`31` §2) |
| A11Y-26 | 5 | Optional | Everyone, esp. AT users | footer / new page | No accessibility statement or help entry | 3.2.6 (only if help exists) | Users can't learn about known limits or ask for help | Short "Accessibility" page in the footer: what works, known limits, how to report | S | None | Content review |

## 6. How contrast was measured

WCAG 2 relative luminance and `(L1+0.05)/(L2+0.05)`, run on the hex tokens in `globals.css` and alpha blends where
classes use `/NN` opacity. Script kept in the session scratchpad (not committed); key results:

| Pair | Ratio | Use |
|---|---|---|
| `ink-3` #6b4a4a on white / paper / sunken / berry-milk | 7.77 / 7.33 / 6.68 / 5.97 | helper text — passes |
| `strawberry` #fe3144 on white / paper / berry-milk / glow hotspot | 3.66 / 3.46 / **2.82** / **2.03** | display headings |
| `strawberry-ink` #d61a2f on white / paper / berry-soft / berry-milk | 5.19 / 4.90 / 4.49 / 3.99 | links, nav, buttons |
| `berry-deep` #b8001f on berry-milk / glow hotspot | 5.28 / 3.80 | proposed display colour on berry |
| White on strawberry-ink; white/85 on espresso | 5.19; 12.23 | footer, dark panels — pass |
| Focus ring strawberry-ink vs strawberry-ink / espresso / berry-milk / white | **1.00** / 3.19 / 3.99 / 5.19 | A11Y-08 |
| Selected segment white vs sunken; toggle off vs sunken; input ring vs white | **1.16 / 1.41 / 1.64** | A11Y-11 |
| Chart: within point vs beyond point; band fill vs white | **1.13 / 1.14** | A11Y-15 |
| White on strawberry-glow hotspot | 3.68 | FinalCta body text — passes only away from the hotspot **[unverified placement]** |

## 7. What the current automated tests do and do not catch

- Every E2E spec runs axe with `withTags(["wcag2a","wcag2aa"])` and fails only on `serious`/`critical`
  (`e2e/journey.spec.ts:9-13`, `protocol.spec.ts:8-11`, `profile.spec.ts:7-10`; assistant scoped to the panel).
  axe tags are not cumulative: WCAG 2.1 and 2.2 rules (`wcag21a`, `wcag21aa`, `wcag22aa`, e.g. `target-size`) are
  not run [guide: <https://github.com/dequelabs/axe-core/blob/develop/doc/API.md>]. Moderate findings (e.g.
  heading order) are discarded.
- axe skips text over `background-image`, so the berry-glow headline (A11Y-09) is invisible to it [guide].
- axe cannot detect focus loss (A11Y-01/02/05), missing or verbose announcements (A11Y-14), meaningful order,
  colour-only meaning in SVG (A11Y-15), dragging alternatives (A11Y-10), motion (A11Y-13), forced-colours
  rendering (A11Y-11), or whether text equivalents agree with the server (A11Y-07).
- The suite runs with `reducedMotion: "reduce"` (`playwright.config.ts:23`), so motion and reveal states in
  default settings are never tested.
- The keyboard test covers only the skip link (`journey.spec.ts:159-166`); the verdict-explorer arrow keys are
  tested (`:137-142`).

The plan for closing these gaps without new dependencies is in `30` Stage 0 and `31` §1.
