# 26 — Accessibility: user groups, design principles and screen-reader journeys (2026-10-26)

**Status: research document (2026-10-26).** "Today" columns describe the audited revision `94ecb84`, before any
change. **Release 1** (`e6e3e85` on `feat/a11y-r1`, not deployed) implemented the focus and announcement targets for J1, J2 (up to
analysis; the capture guide is Stage 3), J3, J4, J5 and J7; see `31` §6. J6 covers PR #4's optional skin profile
and is not implemented. Evidence labels and issue IDs (A11Y-NN) are defined in `25`.
Announcements below are **expected** behaviour derived from code and documentation, not recordings; `31` lists
how to confirm them.

## 1. Who we are designing for

ProofLoop's users who are blind or have low vision are not one group. The groups below differ in what fails for
them and in what helps.

| Group | How they use the web | What breaks today (`25`) | What helps most |
|---|---|---|---|
| **A. Blind, screen reader** — VoiceOver + Safari (macOS, iOS), NVDA + Chrome/Firefox (Windows), TalkBack + Chrome (Android) | Navigate by headings, landmarks, form controls and the virtual cursor; hear status changes only if announced; cannot interpret charts or images | Focus loss on every flow step (A11Y-01/02/04/05); silent or verbose updates (A11Y-14); preview noise (A11Y-06); no framing feedback (A11Y-03) | Predictable focus; one-sentence announcements; the result in words; an upload path that works with the phone's own accessible camera |
| **B. Low vision** — browser zoom 200–400 %, OS magnifiers (Zoom, Magnifier), large text, high contrast | See a small part of the page at once; depend on focus indicators and strong boundaries | Invisible focus ring on red panels (A11Y-08); faint display text (A11Y-09); invisible selected states (A11Y-11); sticky layers (A11Y-12); motion (A11Y-13); sr-only chart table (A11Y-15) | Surface-aware focus ring; 3:1 state indicators; visible data table; stopping motion |
| **C. Colour-vision deficiency** | Full sight, reduced hue discrimination | Chart points by colour (A11Y-15); colour-named legend (A11Y-19). Verdicts themselves are **not** colour-coded (up/down share a colour; words carry direction) — a strength | Shapes and words alongside colour |
| **D. Combined needs** (low vision + tremor, switch access, cognitive load, fatigue) | Slower, less precise pointer; may use voice control or switch access | Drag-only positioning (A11Y-10); long, dense pages; unexplained ordering (A11Y-20); "refresh" instructions with no control (A11Y-16) | Buttons instead of gestures; plain summaries; undo/confirm on destructive actions (already present) |

**Context from survey research.** In WebAIM's 10th screen reader survey (Dec 2023–Jan 2024, 1,539 self-selected
respondents) the most common desktop pairings were JAWS+Chrome 24.7 %, NVDA+Chrome 21.3 %, JAWS+Edge 11.4 %,
NVDA+Firefox 10.0 % and VoiceOver+Safari 7.0 %; on mobile, VoiceOver was used by 70.6 % [research:
<https://webaim.org/projects/screenreadersurvey10/>]. WebAIM notes the sample is not representative. For
ProofLoop, whose capture happens on a phone, **iOS VoiceOver is the most important combination**, and it is the
one the owner cannot currently test (`31` §3) [inference]. JAWS is not in the brief's scope; NVDA results are a
reasonable proxy for Windows but not a substitute [inference].

## 2. The experience we intend

A blind user should be able to: learn what ProofLoop does in under a minute; choose sample data or a real photo;
take or upload a photo with a clear idea of what the system checks and what it can't; choose a focus knowing why
the list is ordered as it is; commit to a plan whose lines they can hear; and, weeks later, hear the outcome, the
numbers behind it, how fair the comparison was and what to do next — **without sight and without a mouse**.

A low-vision user should be able to: zoom to 400 % or enlarge text to 200 % without losing content; always see
where focus is; tell selected from unselected; and read every number in a chart as text.

## 3. Design principles

1. **The server's words are the result.** Every accessible summary of a verdict, a per-concern reading or a next
   step is built from server fields (`focus_outcome`, `changes[].verdict`, `comparability.level`,
   `next_step.action`, `early`) through the existing copy tables in `format.ts`. No component re-derives "beyond" or
   "within" (A11Y-07). Accessibility text may *explain*, never *strengthen*: no "your product worked", no
   "significant", no causal language; "can't call this one" stays exactly that.
2. **One place for focus, one voice for status.** After any action that replaces the control the user pressed,
   focus moves to the heading of what replaced it. Status that doesn't move focus goes through one persistent
   polite announcer. Errors use `role="alert"`. Nothing else is a live region.
3. **Native first, ARIA second.** Keep native radios, checkboxes, tables, `details`, `fieldset`; add ARIA only where
   HTML has no equivalent (`aria-current`, `aria-pressed`, `aria-valuetext`, the tabs pattern already in use). Not an
   `aria-label` on everything: visible labels stay the names.
4. **Equivalent, not reduced.** Keep the dial, chart, masks and previews for sighted users; give the same
   information as structured text that everyone can open (the "result in words" block and a visible data table),
   not a screen-reader-only copy that low-vision users cannot reach.
5. **Honest about the camera.** Say what the system checks automatically (`28` §2), what it can't, and when another
   person might help. Never imply that guidance guarantees comparable photos. Assistance is offered, never
   required; sample data and upload stay available.
6. **The brand adapts at the edges.** Keep berry-milk, strawberry and espresso; change only the pairings that fail
   (display red on pink, focus ring on red, pale selected states) and add forced-colours fallbacks. No new design
   system, no new UI library.
7. **Less to hear.** Decorative previews are one image with one sentence; repeated chips and illustrations are
   silent; long explanations sit behind native `details` where they already are.
8. **Same flow for everyone.** No separate "accessible mode". Improvements (focus, summaries, visible tables,
   capture guide) are on by default because they help sighted users too [inference].

## 4. Screen-reader journey maps

Format per step: **action** → *what is announced today (expected)* → **target** announcement/behaviour →
remaining need for assistance. VO = VoiceOver; TB = TalkBack. Where VO and NVDA are expected to differ, it is noted.

### J1 — Sample-data exploration (`/` → `/results` → `/matches` → `/product` → `/trial`)

| Step | Today (expected) | Target |
|---|---|---|
| Land on `/` | Title read by AT on load; H1 "Is it working? Run a fair test." Heading navigation works (30 headings) | Same, minus ~1,450 chars of preview text (A11Y-06); each preview is "Image: sample snapshot screen showing eight scores" |
| Activate "Explore with sample data" | Button gets `aria-busy`; route change → Next announcer says "Your snapshot · ProofLoop"; focus remains on a removed button | Focus lands on H1 "Your skin snapshot"; announcer may also say the title (accept; verify double speech) |
| Read scores | List of 8: "Hydration 69 out of 100, room to improve" (helper "Higher = …" read before score) | Same; plus the ordering sentence before the focus picker (A11Y-20) |
| Choose focus | Native radio group "Focus"; each option reads its whole label (name, score, counts-as-change lines, badges) — long but complete | Same; group gets a visible legend "Pick one focus to test" instead of sr-only "Focus" |
| "See matching products" | Title "Matches · ProofLoop"; focus lost | Focus H1 (goal label); announcer "3 products match. 2 set aside by your filters." |
| Change a filter | Whole list region `aria-live` may re-read all cards or nothing | Short announcement only: "Budget up to $25: 2 products match." |
| "Details & trial" → "Save baseline & start trial" | Title "Trial · ProofLoop"; focus lost | Focus H1 "Look more hydrated"; title "Hydration trial, waiting for check-in · ProofLoop" |
| "Show synthetic 21-day follow-up" | Nothing announced; verdict inserted above; focus lost (A11Y-02) | Focus moves to verdict H2 "Measured change: up, beyond normal variation."; the next element is the **Result in words** paragraph (`28` §5) |

Assistance needed: none for J1.

### J2 — Live baseline (`/scan` → `/results`)

| Step | Today (expected) | Target |
|---|---|---|
| `/scan` load | H1 "Take your baseline"; consent H2; checkbox; "Continue" is disabled and skipped by Tab | Same, but "Continue" uses `aria-disabled` with a reason ("Tick the box above to continue") so it is discoverable |
| Continue | Consent section unmounts; focus lost; nothing announced (A11Y-01) | Focus to H2 "How do you want to add your photo?"; a short **capture guide** link "Using a screen reader? How to take a usable photo" (`28` §3) |
| Take a photo | Browser permission prompt (AT announces it); camera view; "Starting camera…" silent; Capture enables silently | Focus H2 "Camera"; announce "Camera ready. Hold the phone at arm's length… Capture button is below the preview." |
| Permission denied | Error `role="alert"` with a specific message and upload fallback — **works** | Same, plus focus to the error heading and "Upload a photo" as the next control |
| Capture | Frame step appears; focus lost; "Drag to position" is visual | Focus H2 "Check the framing"; text: "ProofLoop can't see whether your face is centred. If you can't check it, use 'Analyse this photo' — YouCam will reject the photo if the face is too small or outside the frame, and nothing is saved." (wording in `28`) |
| Analyse | Analysing step: H2 "Measuring…"; five-item live list re-announces | Focus H2 "Measuring"; announcer says each stage once ("Uploading securely", "YouCam is analysing 8 concerns"); elapsed seconds silent |
| Rejected by YouCam | failed step: error alert e.g. "Your face needs to fill more of the photo." — announced (role=alert) but focus lost | Focus to error heading; buttons "Adjust and retry", "Choose another photo"; guide link repeated |
| Success | Route to `/results`; focus lost | As J1 |

Assistance needed: possibly framing (see `28` §4). The capture guide states when sighted help is useful.

### J3 — Instrument check (`/trial` → `/scan?repeat=1` → `/trial`)

| Step | Today | Target |
|---|---|---|
| Read the instrument-check section | H2 "How much does your own score move when nothing has changed?" + paragraph — understandable | Add one sentence: "It costs 12 units, is optional, and can only make your test stricter" (cost is in the button already) |
| Take a second photo | As J2, plus capture-match step (preflight) | Focus H2 "Is this a fair comparison?"; announcer gives the level once: "Good match with your baseline: brightness 128 vs 131, both from the camera." |
| Back on `/trial` | Heading text changes to the result; nothing announced if the user was already on the page (sample path) | Focus to the instrument heading, which states spread and band in words — already well written |

### J4 — Check-in and verdict, every outcome

The verdict H2 is already in words; the target adds focus and the **Result in words** block (`28` §5).

| Outcome (`focus_outcome` / `next_step.action`) | Target first three things heard |
|---|---|
| `measured_improvement` / `keep_going` | "Measured change: up, beyond normal variation." → "Hydration went from 69 to 77, +8 points. Your plan said a change had to be more than 5 points. Conditions: comparable." → "Next step: Keep going, if you like it." |
| `measured_decline` / `pause_and_review` | "Measured change: down, beyond normal variation." → numbers and band → "Next step: Pause and review." |
| `no_clear_change` / `finish_the_test` (early) | "Early look: day 9 of a planned 28-day test." → "No clear change yet." → "…+2 points; a change had to be more than 5." → "Next step: Finish the test before deciding." |
| `no_clear_change` / `consider_switching` | as above → "Next step: Consider switching." + link "See other matches for look more hydrated" |
| `inconclusive` / `retake` | "We can't call this one." → "The two photos' lighting differed a lot, so no comparison is made." (from `comparability.issues`) → "Next step: Retake the check-in." The numbers are **not** read as a result |
| `insufficient_data` / `retake` | "Not enough data to compare." → "One of the scans didn't return a measurement for hydration." → next step |
| `nothing_to_gain` (ceiling) | Verdict → "Decide on feel, not on this score." with the plan's "can only detect a drop" sentence |
| Analysis failure during check-in | Failed step on `/scan` (J2), no verdict created |

The every-concern table follows, introduced by its existing sentence "Only your focus … gives the verdict."
Screen-reader table navigation (VO: VO+arrows; NVDA: Ctrl+Alt+arrows; TB: swipe) reads "Hydration, Focus,
Baseline 69, Now 77, Change +8, Reading Beyond normal variation, up (±5)".

### J5 — Assistant

| Step | Today | Target |
|---|---|---|
| Press "Is it working?" | Button disabled → focus lost; live region says "Checking your plan…" then the full answer | Focus stays on the button (`aria-disabled`); live region reads the answer once; a "Jump to answer" is unnecessary because answers append directly below |
| Answer source | "From your plan · no AI" is text — **works**; Gemini topic picks labelled in text | Same |
| Read aloud | Device voice speaks over the screen reader | Label clarifies it uses the device voice; documented as optional |

### J6 — Skin profile [flag: PR #4 only, not in production or Release 1]

| Step | Today | Target |
|---|---|---|
| "Add your answers" | Form appears; focus lost | Focus first fieldset legend "Shine through the day" |
| "Use my answers" | Card collapses to a summary; focus lost; nothing announced | Focus H2 "In your words"; announcer "Answers applied. The focus list has been re-ordered." (the list order changes: say so) |
| Camera vs user-reported | `dt`/`dd` "Whole face: Dry"; "In your words: shine rarely…" — distinguishable by labels | Prefix headings "From the camera (one photo)" / "From you" so the source is heard before the value |
| Remove profile | Confirm appears; focus lost; after Remove, text changes silently | Focus "Remove" confirm button; after success focus a status sentence "Removed. Your scores, plan and result are unchanged." |

### J7 — Delete all data (`/trials`)

| Step | Today | Target |
|---|---|---|
| "Delete all my data" | Confirm buttons replace it; focus lost | Focus "Yes, delete everything"; the sentence "This can't be undone" is its description (`aria-describedby`) |
| Confirm | Success notice mounted at top with text; announcement unreliable; focus lost | Focus the success heading "Everything was deleted"; it lists what was removed, without listing trial names or scores |
| Cancel | Focus lost | Focus returns to "Delete all my data" |

## 5. Where human assistance may still be needed

- **Framing and lighting a selfie** without the phone's built-in guidance (`28` §4). ProofLoop cannot check
  centring, glasses, makeup, angle or even lighting across the face.
- **Matching conditions between baseline and check-in.** ProofLoop compares mean brightness and capture method
  only; same location, same time of day and same distance are the user's to reproduce.
- **Interpreting the mask overlay and the Skin Simulation preview.** Both are visual by nature. The scores and
  plan carry all information the verdict uses; the overlay and preview carry none that the verdict needs.
