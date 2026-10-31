# 27 — WCAG 2.2 AA traceability matrix (2026-10-26)

**Status: research document (2026-10-26).** Statuses below are the pre-release baseline. After Release 1
(`e6e3e85` on `feat/a11y-r1`, not deployed), `31` §6.2 supersedes the rows for 2.4.3, 4.1.3, 2.4.7, 1.4.3, 1.4.11, 1.1.1 and 2.4.2;
2.5.7 and 2.2.2 still fail and 2.4.11 is still unknown. **Update 2026-10-31:** `31` §6.7 supersedes the rows for 2.5.7
(fixed, tested), 2.2.2 (fixed, tested), 2.4.11 (passes on the tested paths, automated only) and the reading-order
issues under 1.3.1. Normative source: WCAG 2.2, W3C Recommendation 12 December 2024
(<https://www.w3.org/TR/WCAG22/>). 4.1.1 Parsing is obsolete in 2.2 and is omitted. Criterion quotations are short
excerpts of the normative text. Issue IDs and evidence labels are defined in `25`.

**Status column.** *Pass (code)* — the implementation meets the criterion on the inspected code paths; still to be
confirmed manually. *Fail* — a specific failing instance is evidenced. *Partial* — passes in some places, fails in
others. *Unknown* — cannot be decided from code; the method is given. *N/A* — no applicable content.

**This is not a conformance claim.** No status here has been confirmed with assistive technology or disabled users.
A conformance statement needs `31` §2–4 completed.

| SC (level) | Meaning for ProofLoop | Routes / components | Current implementation (evidence) | Status | Proposed improvement | Reproducible verification |
|---|---|---|---|---|---|---|
| 1.1.1 Non-text Content (A) | Photos, masks, simulation, dial, chart, product art and previews need text that serves the same purpose, or must be hidden if decorative | `previews.tsx`, `dial.tsx`, `band-chart.tsx`, `product-art.tsx`, `results-view.tsx:171-177`, `product-view.tsx:198-201`, `page.tsx:75` | Hero photo alt is descriptive; dial and chart have text equivalents; previews expose mock text (A11Y-06); product art duplicates names (A11Y-22); mask alt names only (A11Y-21) | Partial | Previews → one `role="img"` description; product art decorative; mask explanation sentence | ariaSnapshot of `/` and `/trial`; manual alt review against WAI decision tree <https://www.w3.org/WAI/tutorials/images/decision-tree/> |
| 1.3.1 Info and Relationships (A) | Scores linked to their names; selected states, tables, groups and step structure exposed | `measure.tsx`, `results-view.tsx:233-270`, tables in `trial-view.tsx`, `ui.tsx` Segmented | Native radios/fieldsets, `th scope`, captions, `dl` for facts — good. Step labels "Step 2 of 4" are plain text; profile "camera vs you" relies on visual grouping | Partial | Keep native structure; label the source of each profile value; consider `aria-current="step"` only if a step list is added | axe; VO rotor (headings/form controls/tables) per `31` §3 |
| 1.3.2 Meaningful Sequence (A) | DOM order matches reading order, esp. where grids reorder | `how-it-works.tsx:467` (`order-2`), verdict grid, `trial-view.tsx` | Alternate steps swap columns visually via CSS order; the text column still follows the phone preview in DOM — acceptable. After A11Y-06 the preview is one image | Pass (code) | None beyond A11Y-06 | Linear read with VO (VO+A) on `/` |
| 1.3.3 Sensory Characteristics (A) | Instructions must not depend on shape/position only | Framer "Fill the oval", dial legend (`page.tsx:176`) | "Fill the oval" is paired with text about hairline-to-chin; legend names colours (A11Y-19) | Partial | Shape + position + meaning in legend; framer text already describes face position | Copy review |
| 1.3.4 Orientation (AA) | Works in portrait and landscape | all | No orientation lock in code [repo] | Pass (code) | — | Rotate device in TB/VO sessions |
| 1.3.5 Identify Input Purpose (AA) | Fields collecting user data about the user | Owner-key field only (`assistant-panel.tsx:219`) | No personal-data fields (no name/email/account) | N/A | — | — |
| 1.4.1 Use of Color (A) | Verdicts, chart points, selected states, band levels not by colour alone | `band-chart.tsx`, `trial-view.tsx:389-412`, `measure.tsx` | Verdict direction in words; table "Reading" column in words; band labels in text. Chart points differ only by colour (A11Y-15); legend by colour (A11Y-19) | Partial | Marker shape + text label; visible table | Greyscale screenshot review; CVD simulation in DevTools Rendering panel |
| 1.4.3 Contrast (Minimum) (AA) | Body and helper text ≥4.5:1, large text ≥3:1 | `globals.css` tokens; `page.tsx:40`; `how-it-works.tsx:444` | Body/helper tokens 5.97–10.07:1 [measured]; `#fe3144` display text 2.82:1 on berry-milk (A11Y-09) | Fail (2 instances) | `berry-deep` on berry surfaces | Token contrast script (`25` §6) in CI; manual check on gradient hotspots |
| 1.4.4 Resize Text (AA) | 200 % text without loss | all; fixed-height pills `ui.tsx:17-21` | rem-based type; fixed `h-*` on pill buttons may clip wrapped text (A11Y-25) | Unknown | `min-h-*` on buttons | Chrome font-size "Very large" + 200 % zoom on each route (`31` §2) |
| 1.4.5 Images of Text (AA) | No text baked into images | footer wordmark (SVG text, `aria-hidden`), product art brand text | Decorative SVG text only | Pass (code) | — | — |
| 1.4.10 Reflow (AA) | No 2-D scrolling at 320 CSS px (except tables/chart) | all | `/` at 320 px: no horizontal scroll [live]; tables have focusable scroll regions (allowed exception); other routes unverified | Partial (verified on `/`) | — | Playwright at 320×720 for every route: `scrollWidth <= innerWidth` |
| 1.4.11 Non-text Contrast (AA) | Boundaries of inputs and indicators of state ≥3:1 | `ui.tsx` Segmented/Toggle, assistant inputs, chart | 1.16 / 1.41 / 1.64:1 (A11Y-11); focus-card radio dot passes (5.19:1) | Fail | Ink selected fill, `ink-3` borders | Token script + screenshot review |
| 1.4.12 Text Spacing (AA) | No loss with line-height 1.5, paragraph 2×, letter 0.12em, word 0.16em | all | Not tested; fixed-height pills and `whitespace-nowrap` dial text are risks | Unknown | `min-h`, allow wrap | Inject the WCAG text-spacing CSS via Playwright `addStyleTag`; visual diff |
| 1.4.13 Content on Hover or Focus (AA) | Tooltips dismissible/hoverable/persistent | `title` attributes (`measure.tsx:15`, `matches-view.tsx:146`) | Native `title` tooltips are user-agent controlled | Pass (code) | Don't rely on `title` for information (already duplicated in text) | — |
| 2.1.1 Keyboard (A) | Every function by keyboard | framer, tabs, rail, camera, filters | Framer has arrow/± keys; tabs have arrows; rail has buttons; all controls native | Pass (code) | Keep | Keyboard script `31` §2 |
| 2.1.2 No Keyboard Trap (A) | Can always tab out | framer `role="application"` | Arrow keys captured only for arrows/±; Tab passes through [repo `framer.tsx:62-75`] | Pass (code) | — | Keyboard script |
| 2.1.4 Character Key Shortcuts (A) | Single-key shortcuts off/remappable/focus-only | framer `+`/`-` | Active only while the framer has focus (allowed) | Pass (code) | — | — |
| 2.2.1 Timing Adjustable (A) | No time limits | analysing poll; Gemini rate limit | No user time limit; capture-store clears with tab close (not a limit) | Pass (code) | — | — |
| 2.2.2 Pause, Stop, Hide (A) | Auto motion >5 s needs a control | `.marquee`, `.float` | Hover-only pause; reduced-motion stops (A11Y-13) | Fail | Pause control / stop after one cycle | Default-motion E2E project + manual |
| 2.3.1 Three Flashes (A) | No flashing | spinners, pulse | Slow pulse/spin only | Pass (code) | — | — |
| 2.4.1 Bypass Blocks (A) | Skip repeated nav | `layout.tsx:39-44` | Skip link + landmarks; E2E tested | Pass | — | Existing E2E `journey.spec.ts:159` |
| 2.4.2 Page Titled (A) | Titles describe topic or purpose | `*/page.tsx` metadata | Titles exist per route; static across steps/states (A11Y-23) | Pass (minimum) | State-aware titles | `toHaveTitle` per state |
| 2.4.3 Focus Order (A) | Focus moves in an order that preserves meaning | scan steps, trial updates, confirms, assistant, route changes | Focus lost to `<body>` on step swaps and updates (A11Y-01/02/04/05) | **Fail** | Focus heading/confirm/result after each change | E2E `expect(page.locator(':focus'))` after each action |
| 2.4.4 Link Purpose (In Context) (A) | Link text + context explains purpose | "Details & trial", "Read the method…" | Purpose clear in card context | Pass (code) | Add product name for links lists (2.4.9 AAA) | VO rotor links list |
| 2.4.5 Multiple Ways (AA) | More than one way to reach pages | nav, footer, in-flow links | Nav + footer + flow links | Pass (code) | — | — |
| 2.4.6 Headings and Labels (AA) | Headings describe topic | all | Descriptive headings throughout; some section labels are `eyebrow` `<p>` text, fine | Pass (code) | Visible legend for focus picker | Headings list in rotor |
| 2.4.7 Focus Visible (AA) | Visible focus indicator | `globals.css:90-94` | Invisible on strawberry surfaces (A11Y-08) [live] | **Fail** | Surface-aware ring | Screenshot test of focused elements on each surface |
| 2.4.11 Focus Not Obscured (Minimum) (AA, new) | Focused item not fully hidden by sticky content | nav + step bar | Risk from two sticky layers (A11Y-12) | Unknown | Larger scroll padding / no sticky bar on small screens | Reverse-Tab E2E comparing rects |
| 2.4.13 Focus Appearance (AAA) | Indicator ≥2 px perimeter, 3:1 change | global ring | 3 px outline; 1.00–5.19:1 depending on surface | Partial | Same fix as 2.4.7 reaches AAA | Same |
| 2.5.1 Pointer Gestures (A) | Multipoint/path gestures have single-pointer alternatives | rail, framer | Rail has buttons; framer drag is a path gesture → see 2.5.7 | Partial | Move buttons | — |
| 2.5.2 Pointer Cancellation (A) | Actions on up-event | native buttons | Native click | Pass (code) | — | — |
| 2.5.3 Label in Name (A) | Accessible name contains the visible label | nav CTA `aria-label="Start a fair test"` with visible "Start"; "Cancel camera" with visible "Cancel" | Names contain the visible words | Pass (code) | — | Voice Control "Click Start" on macOS |
| 2.5.4 Motion Actuation (A) | No device-motion triggers | — | None | N/A | — | — |
| 2.5.7 Dragging Movements (AA, new) | Dragging has a single-pointer alternative | `framer.tsx` | Position by drag only for pointer users (A11Y-10) | **Fail** | Move buttons | E2E clicking move buttons changes the crop |
| 2.5.8 Target Size (Minimum) (AA, new) | Targets ≥24×24 CSS px or spaced | buttons `h-10`+, zoom buttons 36 px, segments ~32 px, inline links exempt | Appears met [repo] | Pass (code) | — | Add axe `wcag22aa` (`target-size` rule) |
| 3.1.1 Language of Page (A) | `lang` set | `layout.tsx:30` | `lang="en"` | Pass | — | axe |
| 3.1.5 Reading Level (AAA) | Lower-secondary reading level or supplement | verdict, plan copy | Plain, short sentences; terms like "variation band" explained | Partial | "Result in words" supplement (`28` §5) | Readability review with participants |
| 3.2.1 On Focus / 3.2.2 On Input (A) | No context change on focus/input | filters, radios | Filters refetch in place (no context change); radio selection doesn't navigate | Pass (code) | — | — |
| 3.2.3 Consistent Navigation (AA) | Same nav order everywhere | layout | Same nav/footer | Pass | — | — |
| 3.2.4 Consistent Identification (AA) | Same function, same name | "Start a fair test", "Delete all my data" | Consistent | Pass (code) | — | — |
| 3.2.6 Consistent Help (A, new) | If help is offered on multiple pages, same relative place | — | No help mechanism exists | N/A | If an Accessibility/help link is added (A11Y-26), keep it in the footer on every page | — |
| 3.3.1 Error Identification (A) | Errors described in text | scan validation, camera errors, API errors | Specific messages with hints; `role="alert"` | Pass (code) | Move focus to the error heading (2.4.3) | Camera/permission E2E (exists) + AT check |
| 3.3.2 Labels or Instructions (A) | Inputs have labels/instructions | consent, profile, filters, framer | Labels present; framer instructions are visual-centric; "refresh" with no control (A11Y-16) | Partial | Capture guide; "Check again" button | Copy review; usability |
| 3.3.3 Error Suggestion (AA) | Suggest fixes | file errors, camera errors, failures | Hints present ("Use a JPEG…", "upload a photo instead") | Pass (code) | — | — |
| 3.3.4 Error Prevention (Legal, Financial, Data) (AA) | Confirm data changes | delete all, remove profile, units-spending analyses | Confirm step for delete/remove; unit cost stated on buttons | Pass (code) | Keep; add focus to confirm (2.4.3) | E2E |
| 3.3.7 Redundant Entry (A, new) | Don't ask twice | profile answers draft → trial | Draft carried from results to product via sessionStorage | Pass (code) | — | — |
| 3.3.8 Accessible Authentication (Minimum) (AA, new) | No cognitive test to authenticate | owner key (owner-only) | Password field allows paste (no `onPaste` block) | Pass (code) | — | — |
| 4.1.2 Name, Role, Value (A) | Custom controls expose name/role/state | Toggle (`role=switch`), mask buttons (`aria-pressed`), tabs, framer slider | Correct; slider lacks `aria-valuetext` (A11Y-10) | Pass (minor gap) | Add `aria-valuetext` | axe; VO announces "Zoom, 160 percent, slider" |
| 4.1.3 Status Messages (AA) | Status reaches AT without focus | loading, results counts, deletion success, analysis stages, capture match | Mixed: assistant region good; others silent or verbose (A11Y-14); delete success unreliable | **Fail** | One persistent announcer | E2E on announcer contents; AT scripts |

## Higher-value AAA items worth doing

| SC | Why it matters here | Cost |
|---|---|---|
| 2.4.13 Focus Appearance | The A11Y-08 fix already reaches it | none extra |
| 1.4.6 Contrast (Enhanced) 7:1 | `ink-2`/`ink` already ≥9:1; helper `ink-3` 5.97–7.77:1 — raising `ink-3` slightly would reach 7:1 on most surfaces | low |
| 2.4.9 Link Purpose (Link Only) | "Details & trial" → "Details & trial: Hydrating Milk Essence" for link lists | low |
| 3.1.5 Reading Level | The "Result in words" block | covered by `28` |
| 2.4.12 Focus Not Obscured (Enhanced) | Follows from A11Y-12 | low |

## What cannot be decided without humans

- Whether announcements are understandable, timely and not duplicated (4.1.3 in practice) — AT testing.
- Whether the capture guide lets blind participants produce usable photos (3.3.2 in practice) — user testing.
- Whether "variation band" explanations are understood (3.1.5) — user testing.
