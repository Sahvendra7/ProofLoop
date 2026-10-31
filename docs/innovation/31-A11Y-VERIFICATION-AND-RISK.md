# 31 — Accessibility verification matrix, AT scenarios, user research and residual risk (2026-10-26)

**Status: plan, plus records of what was actually checked: the research session (§1, 2026-10-26) and Release 1 (§6–§7, 2026-10-31).** Nothing below may be
reported as "tested with screen readers" or "validated with blind users" until the corresponding row says
*Done*, with a date and a person.

**Available to the owner (stated 2026-10-26):** VoiceOver + Safari on macOS; TalkBack + Chrome on Android.
**Not available:** VoiceOver + Safari on iOS; NVDA on Windows. Those rows stay *Unverified* with a procedure.

## 1. Verification matrix

Statuses in this table are as of 2026-10-26, before Release 1. What Release 1 actually ran is in §6.

| # | Check | Layer | Method | Status | Evidence / where |
|---|---|---|---|---|---|
| V1 | Source inspection of every route and shared component | Static | Read code | **Done (2026-10-26)** | `25` §1–4 |
| V2 | Token contrast pairs | Static | WCAG luminance formula on CSS tokens | **Done** | `25` §6 |
| V3 | Homepage reflow at 320 CSS px | Automated (manual run) | Production, in-app browser, `scrollWidth` | **Done: pass** | `25` §4.1 [live] |
| V4 | Footer focus ring visibility | Manual keyboard | Production, real Tab key, computed style + screenshot | **Done: fail** | `25` §4.1 [live] |
| V5 | Homepage heading outline and preview text volume | Automated (manual run) | Production DOM query | **Done** | 30 headings, one `h1`; ~1,450 chars in 10 previews |
| V6 | Existing E2E + axe suite | Automated | `npm run test:e2e` | **Not run in this session** (last recorded 34/34 in the owner's release log `15`, which is not in this branch) | — |
| V7 | axe with 2.1/2.2 tags, moderate logged | Automated | Stage 0 | Future (can run now) | `30` §2 |
| V8 | Reflow on every route at 320 px | Automated | Stage 0 | Future (can run now) | `30` §2 |
| V9 | Forced-colours rendering | Automated artefact + manual | `emulateMedia({forcedColors:'active'})`; Windows Contrast themes for confirmation | Future; Windows confirmation **Unverified** (no Windows) | `29` §5 |
| V10 | Text spacing (1.4.12) and 200 % text (1.4.4) | Automated + manual | Injected spacing CSS; Chrome font size "Very large" | Future (can run now) | `30` §2 |
| V11 | Focus after every state change | Automated | Stage 1 E2E `:focus` assertions | Future | `30` §3.3 |
| V12 | Announcer messages | Automated | Read announcer text in E2E | Future | `30` §3.3 |
| V13 | Result in words = server outcome, no forbidden words | Automated | Stubbed outcomes via `page.route` | Future | `30` §3.3 |
| V14 | Keyboard walkthrough (§2) | Manual | Owner, Chrome + Safari on macOS | Future (can run now) | §2 |
| V15 | VoiceOver + Safari macOS scenarios S1–S7 | AT | Owner | Future (can run now) | §3 |
| V16 | TalkBack + Chrome Android scenarios S1–S7 | AT | Owner | Future (can run now) | §3 |
| V17 | VoiceOver + Safari iOS | AT | Needs an iPhone | **Unverified** | §3 |
| V18 | NVDA + Chrome/Firefox Windows | AT | Needs Windows (VM is acceptable) | **Unverified** | §3 |
| V19 | Voice Control (macOS) "Click …" names | AT | Owner | Future (can run now) | 2.5.3 |
| V20 | Zoom 400 % + macOS Zoom magnifier | Manual | Owner | Future (can run now) | §2 |
| V21 | Participants: blind and low-vision | Users | §4 | Future; recruitment required | §4 |

## 2. Layer 2 — manual keyboard script

Run on macOS Chrome and Safari (Safari: enable "Press Tab to highlight each item" in Settings → Advanced).
For each step record: focus visible (Y/N), focus location, anything surprising.

1. `/` — Tab once: skip link visible; Enter → focus moves into `main`. Tab through the hero: every control shows a
   ring. Continue to the footer: **ring visible on every footer link** (fails today, A11Y-08).
2. `/` — How-it-works: Tab to step-bar links, Shift+Tab back up through the steps; check the focused element is never
   fully covered by the nav or the step bar (A11Y-12).
3. Verdict explorer: Tab to the tablist; Left/Right switch tabs and move focus; Tab leaves the tablist into the panel.
4. Problem rail: Tab to the region, Left/Right arrow scroll it; "Next problems" button scrolls.
5. Mobile menu (narrow window <900 px): Enter opens; Escape closes; focus stays on the toggle.
6. `/scan` — consent: Space ticks the box; Tab reaches "Continue"; Enter. **Record where focus lands** (A11Y-01).
7. Choose: Enter on "Upload a photo" opens the file dialog; Escape cancels — focus returns to the button.
8. Camera: deny permission → error; focus location; Tab reaches "Choose another photo". Allow → Capture (Enter).
9. Frame: arrow keys move, +/- zoom; Tab passes through without being trapped; Enter on "Analyse this photo".
10. Failure (local backend without a YouCam key gives "Live analysis isn't configured"): focus location; retry
    buttons reachable.
11. `/results` (sample data): Tab into the focus radios; arrows change selection; Enter on "See matching products".
12. `/matches`: Arrow keys within Budget/Finish groups; Space toggles fragrance-free; Tab order stays logical after
    the list reloads.
13. `/product` → "Save baseline & start trial" → `/trial`: "Show synthetic 21-day follow-up": **where is focus?**
14. `/trial`: Tab through the every-concern table region (focusable), plan, instrument check, assistant quick
    questions (press one: focus kept?), profile `details` (Enter toggles), Edit/Remove profile with Escape-free
    confirm.
15. `/trials`: "Delete all my data" → focus on confirm? Cancel → focus back? Confirm → focus on success?
16. Zoom: repeat steps 1, 11, 13 at 200 % and 400 % browser zoom; and with macOS Zoom (picture-in-picture
    magnifier) following keyboard focus.
17. Text spacing: apply the 1.4.12 bookmarklet/CSS and repeat steps 1 and 11.

## 3. Layer 3 — assistive-technology scenarios

**Common setup.** Use sample data unless the scenario says otherwise. Live capture on production spends YouCam
units (12 per analysis) and must be approved by the owner each time; S2 and S4 can use the failure path on a
local backend with no YouCam key instead. Record per scenario: AT/browser/OS versions, steps, exact speech for key
moments (copy from the VoiceOver caption panel or TalkBack's "Copy last utterance"), completion (Y/N), errors,
workaround used.

| ID | Scenario | Key moments to record | Expected after Stage 1 (today's expected behaviour in `26` §4) |
|---|---|---|---|
| S1 | Understand the product from `/` in 2 minutes using headings only | Headings list; preview announcements | Hero H1, section H2s; each preview one short image description |
| S2 | Upload a photo and reach analysis (or failure) | Each step change; error speech | Each step heading spoken on arrival; failure as alert, focus on the error heading |
| S3 | Sample data → choose a focus → start a trial | Why the first focus is first; plan lines | Ordering sentence heard before the list; plan lines readable as a list |
| S4 | Instrument check (sample: "Run the sample instrument check") | Result heading; band change | Focus on the result heading, which states spread and band |
| S5 | Synthetic verdict: outcome, numbers, fairness, next step | First three utterances after the action | Verdict heading → result in words → next step |
| S6 | Ask "Is it working?" in the assistant | Focus during and after; answer announcement once | Focus stays on the button; answer read once, with its source |
| S7 | Delete all data | Confirm focus; success speech | "Yes, delete everything" focused; "Everything was deleted" spoken and focused |

**Per-AT notes**

- **VoiceOver + Safari (macOS)** — Cmd+F5 to start; VO = Ctrl+Option; rotor VO+U for headings/links/form
  controls; tables VO+Cmd+T for the table, then VO+arrows. Safari is the pairing Apple supports.
- **TalkBack + Chrome (Android)** — swipe right/left to move; reading controls (swipe up then down) set to
  "Headings"; double-tap to activate. Also test path A of `28` §3 with the phone's camera (Guided Frame if Pixel 6+).
- **VoiceOver + Safari (iOS)** — *Unverified.* Procedure: rotor (two-finger rotate) "Headings"; run S1–S7; for S2,
  test path A: Camera app face announcements → Photos → Upload. Also test whether the file picker's "Take Photo"
  gives face announcements (`28` §3 [unverified]).
- **NVDA + Chrome/Firefox (Windows)** — *Unverified.* Procedure: browse mode H for headings, T for tables, F for
  form fields; check whether focus moves switch NVDA into focus mode unexpectedly at the framer
  (`role="application"`).

Differences to expect: VoiceOver may read both the route title and the focused `h1`; NVDA may read the `h1` only;
TalkBack's reading of `aria-live` text during focus changes can be cut off. Decide on double speech from these
recordings, not in advance.

## 4. Layer 4 — validation with blind and low-vision people

**Why.** Code fixes and our own AT runs show that the interface can be operated. They don't show that blind
people understand a verdict, can produce comparable photos, or trust the result. Only participants can answer
those questions. Nothing generated by an AI model, including this document, counts as participant feedback.

**Participants.** 6–8 adults: 3–4 screen-reader users (aim for at least two iPhone VoiceOver users and one
Android TalkBack user; one desktop NVDA or JAWS user), 2–3 low-vision users of zoom or magnification, at least
one with a colour-vision deficiency if possible. Recruit through local blindness and low-vision organisations
or university disability services; pay for time; obtain informed consent that covers recording and covers photos
of faces separately.

**Privacy.** Default to sample data. A participant takes a real photo only if they choose to, in a fresh session,
with "Delete all my data" run together at the end. Don't record the screen while a face photo is visible; use
audio and notes. Budget live analyses explicitly (12 units each; at most 2 per participant = ≤ 24 units) and get the
owner's approval for the total.

**Tasks.**

1. "Tell me what this site does" (S1).
2. "Explore with sample data and start a trial for the concern you'd choose." (S3)
3. "Take or upload a photo of your face as if starting a real test." Offer paths A–D (`28` §3); note which they pick.
4. "Here is a trial with a result. What happened, how sure is ProofLoop, and what would you do next?" Use the four
   stubbed outcomes in random order: improvement, no clear change, inconclusive, early look.
5. "Ask the assistant whether it's working."
6. "Delete everything you've done here."

**Measures per task.** Completion (unaided / with hint / failed); errors; time; assistance requested (from
whom, for what); a single-ease rating (1–7); for task 4, a correctness check of the participant's own words against
the server outcome (did they over-read it? did they think "no clear change" meant "doesn't work"?); for task 3,
whether YouCam accepted the photo and the capture-match level when a check-in is simulated.

**Questions.** "What did you expect to hear after pressing that?" · "How confident are you in the result, and
why?" · "Would you take your next photo the same way?" · "Was anything read that you didn't need?" · "Would you
want help from another person for any step?" · "How did you feel about photographing your face here?"

**Recording template.** Participant ID (no names) · AT/device · task · outcome · quotes (paraphrased unless
consented) · severity of each issue observed (blocker/high/medium/low, same scale as `25` §5) · linked issue ID.

**Independence.** Ask after each task: "Could you do this on your own next time?" (yes / with notes / no).
Report independence separately from completion.

## 5. Release and residual-risk assessment

### 5.1 What can be confidently corrected in code

Focus loss (A11Y-01/02/04/05), announcer consistency (A11Y-14), preview noise (06), server-sourced text (07),
focus ring and display colour (08/09), state contrast and forced-colours fallbacks (11), drag alternatives (10),
motion controls (13), visible chart table (15), "Check again" control (16), file-input tab stop (17), titles (23).
Each has an automated test that fails today and should pass after the fix. (Written before Release 1; §6
records which were implemented and passed.)

### 5.2 What depends on assistive-technology behaviour

- Whether moving focus plus Next's title announcement causes double speech, and how each AT handles it.
- Live-region timing on page transitions, especially TalkBack.
- `role="application"` in the framer under NVDA browse mode and VoiceOver.
- How "±" and "→" are pronounced; whether `aria-valuetext` is read on slider change.
- iOS Safari HEIC handling on upload, and whether the file picker's camera gives face announcements.

### 5.3 What requires disabled-user testing

Comprehension of the verdict and band; trust; whether path A (OS camera + upload) yields usable, comparable
photos; whether "Use the whole photo" or the current 1.6× default gives fewer rejections; whether the result in
words is too long or just right; whether the preview images are better as one sentence or should be omitted.

### 5.4 Technical limits that cannot currently be removed

- **No face detection in ProofLoop.** It can't tell a blind user their face is centred or level. OS cameras
  partly fill the gap, with reported edge inaccuracy.
- **Comparability can't be guaranteed.** ProofLoop measures mean brightness and capture method only. Lighting
  evenness, angle, distance, sharpness and location are unmeasured, for every user, sighted or not.
- **YouCam rejects photos only after submission.** The rejection is clear, but it isn't real-time guidance.
- **Masks and Skin Simulation are visual by nature.** Their text equivalents can say what they are, not what they
  show. Neither affects the verdict.
- **Browser/AT variation.** No set of tests here covers JAWS, older iOS versions or every Android vendor.

### 5.5 Release gate for an "accessibility improved" claim

Allowed wording after Stage 1 ships and V11–V16 pass: "We've fixed the blocking focus and announcement problems
found in our accessibility audit and tested the main flows with VoiceOver on macOS and TalkBack on Android."
Not allowed: "WCAG 2.2 AA compliant", "fully accessible", "tested with blind users" (until §4 is done), "works with
all screen readers".

## 6. Release 1 verification record (2026-10-31)

Branch `feat/a11y-r1`, committed as `e6e3e85`; not pushed or deployed. Implementation in `30` §7.

### 6.1 What was actually run

| Kind | Result | Notes |
|---|---|---|
| **Automated: full Playwright suite**, desktop (Chrome) + mobile (Pixel 7 emulation) | **95 passed, 1 skipped, 0 failed** | Skip = the 320 px reflow test on the mobile project (it sets its own viewport and runs on desktop). Isolated E2E backend with no YouCam or Gemini key: no units spent |
| Automated: new `e2e/a11y.spec.ts` repeated 3× (both projects) | **117 passed, 3 skipped, 0 failed** | Stability check |
| **Automated: axe** (`wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`) on home, results, matches, verdict, post-delete trials, `/scan`, `/privacy`, `/trials`, assistant panel | **0 violations at any impact** (none serious/critical; none logged as moderate/minor) | Includes `target-size` (2.2) |
| Automated: rendered text contrast over gradients | Pass. Hero "Run a fair test." and "hope to evidence." were 2.79/2.84:1 before the fix; the final CTA body text on phones was 3.81:1 before the glow change | Pixel sampling of the real render, not axe |
| Backend regression tests (`pytest`) | **1,239 passed, 2 skipped** | No backend file changed |
| TypeScript (`tsc --noEmit`), ESLint | Clean | |
| Production build (`next build`) | Compiled; all 9 routes static | |
| **Keyboard walkthrough** (agent-driven, real key presses in Chromium, dev build, keyless local backend) | Pass after two fixes (below) | Not a human session; not a screen reader |
| **Screen-reader testing** (VoiceOver, TalkBack, NVDA) | **Not performed** | Scripts in §7 |
| **Testing with blind or low-vision people** | **Not performed** | Plan in §4 |

**Keyboard walkthrough journeys (all pass):** first load (focus untouched, first Tab = skip link); "Explore with
sample data" → focus on "Your skin snapshot"; arrow keys in the focus picker; "See matching products" → focus on
"Look more hydrated"; Space on fragrance-free → focus stays, announcer "5 products match. 1 set aside by your
filters."; "Details & trial" → product `h1`; "Save baseline & start trial" → trial `h1`, title "Waiting for
check-in · Look more hydrated · ProofLoop"; "Show synthetic 21-day follow-up" → focus on the verdict heading with
a white ring on the espresso panel, Result in words matching the server; "Is it working?" → focus stays on the
button, answer announced; nav "My trials" → `h1`; delete-all Enter / Tab / Enter (cancel) → focus back on "Delete
all my data"; confirm → "Everything was deleted."; consent Enter unticked → checkbox focused, `aria-invalid`,
reason as description; Space, Tab, Enter → "Add your photo". No console errors.

**Bugs the walkthrough found (fixed and re-tested):**

1. In development (React Strict Mode runs effects twice) the route-focus code treated the first load as a
   navigation, focused the hero `h1` and added `tabindex` before hydration, causing a hydration warning. Fixed by
   tracking the handled path instead of a first-run flag; regression test "a fresh page load leaves focus alone".
2. Delete-all moved focus one animation frame late, so a very fast Tab could start from the page body. Fixed with
   a synchronous render (`flushSync`) and focus in the same tick.

**Not walked by keyboard here:** live camera capture on a real device, the OS file dialog, the owner-only Gemini
unlock (covered by mocked E2E), "Check again" (covered by stubbed E2E), the instrument check on a real trial.

### 6.2 Status after Release 1 (supersedes the rows named in `27`)

| SC | Before | After R1 | Evidence | Still needed |
|---|---|---|---|---|
| 2.4.3 Focus Order | Fail | Pass (code + automated) | `a11y.spec.ts` focus tests | AT confirmation; profile flow on PR #4 |
| 4.1.3 Status Messages | Fail | Pass (code + automated) | announcer tests | AT timing confirmation |
| 2.4.7 Focus Visible | Fail | Pass (automated, homepage surfaces + verdict panel) | focus-ring test | Other dark surfaces checked by inspection only |
| 1.4.3 Contrast (Minimum) | Fail (2 instances) | Pass on tested surfaces (+ 1 new instance fixed) | rendered contrast test | Pages beyond `/` not pixel-sampled |
| 1.4.11 Non-text Contrast | Fail | Pass for segmented options, toggle, focus card | selected-state test | Assistant input rings (owner-only) unchanged |
| 1.1.1 Non-text Content | Partial | Improved (previews); product art and mask still as before | preview test | Stage 3 items |
| 2.4.2 Page Titled | Pass (minimum) | State-aware titles for scan steps and trial | E2E `toHaveTitle` | — |
| 2.5.7 Dragging Movements | Fail | **Still fail** | — | Stage 2 move buttons |
| 2.2.2 Pause, Stop, Hide | Fail | **Still fail** | — | Stage 2 |
| 2.4.11 Focus Not Obscured | Unknown | Unknown | — | Reverse-Tab test (Stage 2) |
| Forced colours (no SC; supports 1.4.11) | Not handled | Selection, toggles, cards and states keep a boundary or mark (Chromium emulation) | forced-colours test | Confirm on Windows contrast themes (no Windows available) |

No WCAG conformance claim follows from this table.

### 6.3 Integration with `main` `c0f01c3` (2026-10-31)

`main` moved from `bcc2cba` to `c0f01c3` (#5 backend dependency upgrades, #6 12 MP image guard, #7 privacy
retention wording). It was merged into `feat/a11y-r1` as `e6b91cc` with **no conflicts**; the accessibility commits
`e6e3e85` and `c9a1377` are unchanged. The worktree's linked `backend/venv` still holds the pre-#5 packages (Pillow
11.0.0, FastAPI 0.115.6), so backend tests and the E2E backend ran in a throwaway virtualenv built from the merged
`requirements-dev.txt` (Pillow 13.0.0, FastAPI 0.133.0, Starlette 1.3.1, python-multipart 0.0.31). That virtualenv
and the temporary Playwright config used to point at it were not committed.

| Check | Release 1 baseline (on `bcc2cba`) | Integrated (on `c0f01c3`) |
|---|---|---|
| Full Playwright suite, desktop + mobile | 95 passed, 1 skipped | **97 passed, 1 skipped, 0 failed**. The +2 are #7's `privacy.spec.ts` on both projects |
| `a11y.spec.ts` + `privacy.spec.ts`, repeated 2× | — (a11y ×3: 117 passed) | **82 passed, 2 skipped, 0 failed** |
| Axe 2.0–2.2 A/AA, incl. `/privacy` with #7's new text | 0 violations | **0 violations** (none logged at any impact) |
| Backend `pytest` | 1,239 passed, 2 skipped | **1,256 passed, 2 skipped**. The +17 are #6's image-guard tests; 1 warning is a Starlette deprecation notice from #5's upgrade, unrelated to accessibility |
| TypeScript, ESLint | Clean | **Clean** |
| `next build` | Compiled | **Compiled**; `/privacy` static |

Skips are the 320 px reflow test on the mobile project, by design. No YouCam or Gemini key was present in any run.

### 6.4 Screen-reader validation (2026-10-31)

**VoiceOver + Safari on macOS: performed by scripted control, V1–V12.** Setup: macOS 27.0.1, Safari 27.0.1,
VoiceOver turned on by the owner, with "Allow VoiceOver to be controlled with AppleScript" enabled by the owner.
The agent stepped VoiceOver's own cursor (the equivalent of VO+Right and VO+Space) and recorded the exact text
VoiceOver spoke (its "last phrase") after each action. Ran against a local production build of the integrated
branch with a backend lacking YouCam or Gemini keys (upgraded packages; no units spent).

**Method limits.** This is VoiceOver's real output, but no person listened. Speech rate, timing, interruptions
and comprehension were not judged. Tab-key navigation wasn't exercised, because macOS blocks scripted key presses
without an Accessibility permission the agent may not grant. Navigation was by VoiceOver cursor, and keyboard focus
was read back from VoiceOver's keyboard cursor. V13–V14 (file upload, analysis failure) need the macOS file dialog
and were **not run**.

| # | Result | VoiceOver said (verbatim, abridged with …) |
|---|---|---|
| V1 | Pass | "main" → "Is it working? Run a fair test. region" → "heading level 1 Is it working? Run a fair test. 3 items" |
| V2 | Pass | "Preview of the snapshot screen: eight skin scores from sample data image": one image, no mock scores read |
| V3 | Pass, with an unexpected first phrase | "Is it working?Run a fair test." then "heading level 1 Your skin snapshot main". The first phrase is the *previous* page's heading, read as raw text; most likely Next.js's route announcer picking up the hidden previous page. Not reproduced on a second run (§6.4.1) |
| V4 | Pass | "Focus group" → "Brighter under-eyes Under-eye 68 · room to improve 72 or higher counts as up · 64 or lower as down Most room selected radio button, 1 of 8" |
| V5 | Pass | "Matches · ProofLoop" (title). VoiceOver and keyboard cursors were both on "Calm visible redness heading level 1"; the heading wasn't read separately (no double reading). On the re-run, focus reached the heading while it still said "Matching products" (loading text), so the goal name wasn't spoken |
| V6 | Pass | "on Fragrance-free only switch" → "3 products match." (announcer) |
| V7 | Pass | "heading level 1 Calm Barrier Serum" (product) → "heading level 1 Calm visible redness" (trial) |
| V8 | **Failed, fixed, re-tested: pass** | Before: "heading level 2 No clear change yet. No clear change yet. region": the verdict was read twice, because the section was a region named by its own heading. After the fix: "heading level 2 No clear change yet." once. Reading order: explanation → "Under-eye dial: baseline 68, check-in 69, normal variation plus or minus 3 points. The result is described in words below." → "+1 point · normal variation ±3" → "Result in words region" → "heading level 2 Result in words" → "description list 6 items" → "Timing 1 of 12" … "Next step 11 of 12" |
| V9 | Pass | "Your redness score went from 99 to 98. That is inside your ±7 band … From your plan · no AI." Keyboard focus stayed on "Is it working? button" |
| V10 | Pass, repetitive | "Yes, delete everything Removes this session … This can't be undone. button". Cancel → "Delete all my data button Delete all my data region" (VoiceOver adds the section's name). Confirm → "heading level 2 Everything was deleted. main" |
| V11 | Pass | "I'm 18 or over, this is my own face, and I agree … Tick the box to confirm before continuing. invalid data unticked tickbox" |
| V12 | Pass | "ticked … tickbox", then Continue → "heading level 2 Add your photo main" |
| V13–V14 | Not run | File dialog |

#### 6.4.1 Findings

| Finding | Severity | Source | Action |
|---|---|---|---|
| Verdict headline read twice on focus | High (breaks the "read once" rule) | Release 1 (region named by the focused heading) | **Fixed** in a follow-up commit on this branch; E2E guard added; VoiceOver re-check passes |
| "-1 points" / "+1 points" in Result in words and the dial caption | Low (wording) | Release 1 / pre-existing caption | **Fixed**: "1 point"; E2E scenario added |
| Previous page's heading spoken before the new one, once | Medium (misleading) | Probably Next.js's route announcer reading a hidden previous page | Not fixed; intermittent (not reproduced). Re-check with a person listening |
| Matches heading focused while still saying "Matching products" | Low | Release 1 timing: the loading heading takes focus | Not fixed; candidate follow-up: focus the heading after data loads |
| Score read as "69Room to improve", then "out of 100," as a separate phrase | Medium | Pre-existing (`MetricBar`) | Not fixed (outside Release 1); candidate Stage 2 item |
| Filter options read twice in linear reading ("≤ $25 radio button", then "≤ $25"); group labels read in capitals ("BUDGET group") | Low | Pre-existing `Segmented` markup / CSS uppercase | Not fixed; candidate Stage 2 item |
| Section names repeated after a focused control (e.g. "…button Delete all my data region") | Low | VoiceOver landmark context | Accept, or drop names from non-landmark sections later |

**TalkBack + Chrome on Android: not performed.** No Android device was connected, and TalkBack and USB debugging
are device settings the agent may not change. NVDA, iOS VoiceOver and research with blind and low-vision people
also remain outstanding. Nothing here substitutes for testing with blind and low-vision users.

### 6.5 Known limitations carried into review (not addressed in Release 1)

| Limitation | WCAG | Where | Status |
|---|---|---|---|
| Positioning the photo needs dragging or arrow keys; there's no single-pointer alternative | 2.5.7 Dragging Movements (AA) — **fail** | `frontend/src/app/scan/framer.tsx` | Stage 2 (move and centre buttons), not approved |
| Homepage marquee and floating chips loop with no pause control (hover-only pause; reduced motion stops them) | 2.2.2 Pause, Stop, Hide (A) — **fail** | `globals.css` `.marquee`/`.float`, `page.tsx`, `previews.tsx` | Stage 2, not approved |
| Two sticky layers (nav + homepage step bar) versus 6 rem scroll padding may hide focused items; untested | 2.4.11 Focus Not Obscured (Minimum) (AA) — **unknown** | `globals.css`, `home/how-it-works.tsx` | Stage 2 reverse-Tab test, not approved |
| Profile removal and profile form focus/announcements | 2.4.3, 4.1.3 | `profile-block.tsx`, `skin-profile.tsx` (PR #4 only) | Waits for PR #4 to merge; fix described in `30` §7.3 |

## 7. Screen-reader test scripts for Release 1

**Who runs them:** the owner (or anyone), on the two available setups. Record the actual speech; mark each step
Pass / Fail / Unclear. The "Expected" column is what the code is designed to produce, not a recording.

**Getting the branch onto a device (nothing deployed).** Start a keyless backend on :8201 and the frontend on
:3201: no YouCam or Gemini keys, so no units. On the owner's machine these are the entries `a11y-backend-keyless`
and `a11y-frontend` in the local, untracked `.claude/launch.json`. Elsewhere, from the repository root:
`YOUCAM_API_KEY= GEMINI_API_KEY= GEMINI_FREE_TEXT_ENABLED=false CORS_ORIGINS=http://localhost:3201 backend/venv/bin/uvicorn app.main:app --app-dir backend --port 8201`
and `NEXT_PUBLIC_API_URL=http://localhost:8201 npm --prefix frontend run dev -- -p 3201`.
- macOS: open `http://localhost:3201` in Safari.
- Android: connect the phone by USB with USB debugging on, then run `adb reverse tcp:3201 tcp:3201` and
  `adb reverse tcp:8201 tcp:8201`, and open `http://localhost:3201` in Chrome on the phone. `localhost` keeps the page a secure context,
  so the camera works too.

### 7.1 VoiceOver + Safari (macOS)

Setup: System Settings → Accessibility → VoiceOver on (Cmd+F5). Safari → Settings → Advanced → "Press Tab to
highlight each item". Turn on the Caption Panel (VO+Cmd+F8 → Visuals) to copy speech. VO = Ctrl+Option.

| # | Action | Expected |
|---|---|---|
| V1 | Load `/` | Page title read; VO+U → Headings lists "Is it working? Run a fair test." and section headings |
| V2 | VO+Right through the hero | Phone mock-up read once as an image: "Preview of the snapshot screen: eight skin scores from sample data, image"; no individual scores read |
| V3 | Tab to "Explore with sample data", VO+Space | Possibly the title "Your snapshot · ProofLoop", then "Your skin snapshot, heading level 1". Record whether this sounds repetitive |
| V4 | VO+Right to the focus picker; VO+Space a radio | Radio name includes goal, score and "counts as up / down" lines; selected state spoken |
| V5 | Activate "See matching products" | "Look more hydrated, heading level 1" |
| V6 | Toggle "Fragrance-free only" | "on/checked"; then, without moving, "5 products match. 1 set aside by your filters." |
| V7 | Open a product; "Save baseline & start trial" | Trial `h1` read |
| V8 | "Show synthetic 21-day follow-up" | "Measured change: up, beyond normal variation., heading level 2"; VO+Right reaches the body text, the dial summary ("Hydration dial: baseline 69, check-in 77 … described in words below") and then the "Result in words" heading and its definition list |
| V9 | "Is it working?" | Focus stays on the button; "Checking your plan…", then the answer once, ending with "From your plan · no AI." |
| V10 | `/trials` → "Delete all my data" | "Yes, delete everything, button", description "…This can't be undone." Cancel → back on "Delete all my data". Confirm → "Everything was deleted., heading level 2" |
| V11 | `/scan`, untick consent, Continue | Focus on checkbox: "…unchecked, invalid data, Tick the box to confirm before continuing." |
| V12 | Tick, Continue | "Add your photo, heading level 2" |
| V13 | Upload `frontend/e2e/fixtures/synthetic-portrait.png` | "Fill the oval with your face, heading level 2"; zoom slider "Zoom 160 percent" |
| V14 | "Analyse this photo" (local, no key) | "Live analysis isn't configured on this server., heading level 2", read once, not followed by a second "alert" reading |

### 7.2 TalkBack + Chrome (Android)

Setup: Settings → Accessibility → TalkBack on. Swipe right/left = next/previous; double-tap = activate; reading
controls (swipe up then down) set to Headings for heading jumps. Use "Copy last spoken phrase" from the TalkBack menu (its location varies by version)
to record speech.

| # | Action | Expected |
|---|---|---|
| T1 | Load `/`, swipe through the hero | Phone mock-up read once as an image with its label |
| T2 | Double-tap "Explore with sample data" | "Your skin snapshot, heading 1" (TalkBack may read the title first) |
| T3 | Double-tap a focus option, then "See matching products" | Selected state spoken; then "Look more hydrated, heading 1" |
| T4 | Double-tap "Fragrance-free only" | "On"; then "5 products match. 1 set aside by your filters." Record whether TalkBack cuts the announcement short |
| T5 | Start the trial; double-tap "Show synthetic 21-day follow-up" | Verdict heading spoken; swiping on reaches Result in words |
| T6 | Double-tap "Is it working?" | Focus stays; answer announced once |
| T7 | `/trials`: delete, cancel, delete, confirm | Same as V10 |
| T8 | `/scan`: consent without tick; then continue | Same as V11–V12 |
| T9 | Optional, real camera: "Take a photo" → allow → wait | "Take your photo, heading 2", then "Camera ready. The Capture button is below the preview." **Capture and Analyse on the local keyless server only**, so no units are spent |

### 7.3 Still outstanding

- **VoiceOver V1–V12 were run by scripted control on 2026-10-31 (§6.4); V13–V14 and the whole TalkBack script
  T1–T9 were not.** A person listening should still repeat V1–V12, especially V3 (stale heading) and V8. Until then, R1's focus and announcement behaviour is verified
  by automation and an agent-driven keyboard walkthrough only.
- **iOS VoiceOver and NVDA: unverified.** No device or machine is available.
- **Real blind and low-vision participants (§4): not started.**
- The questions to settle from these sessions: the title + `h1` double reading on route changes; TalkBack
  cut-offs; whether the Result in words list is too long; whether step headings should be more specific.
