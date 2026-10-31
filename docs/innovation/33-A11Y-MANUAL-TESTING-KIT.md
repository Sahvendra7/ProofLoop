# 33 — Manual accessibility testing kit: screen readers and participant sessions (2026-11-01)

**Status: ready to run; results pending.** Release 1 (`31` §6.4–§6.7) and the follow-up (`31` §6.8) are covered by
automated browser tests, accessibility-tree inspection and scripted keyboard runs. This kit is the next layer:
screen readers driven by a person, and sessions with blind and low-vision participants. A check counts once its
speech or session notes are recorded.

It adds what `31` §4 and §7 don't have: checks for the follow-up, numbered NVDA and iOS lists, one result sheet,
consent wording, expected outcomes per task, and how findings become fixes.

## 1. Setup (no units, nothing deployed)

From the repository root, on the branch under test:

- Backend: `YOUCAM_API_KEY= GEMINI_API_KEY= GEMINI_FREE_TEXT_ENABLED=false SKIN_PROFILE_ENABLED=true CORS_ORIGINS=http://localhost:3201 backend/venv/bin/uvicorn app.main:app --app-dir backend --port 8201`
- Frontend: `NEXT_PUBLIC_API_URL=http://localhost:8201 npm --prefix frontend run dev -- -p 3201`
- Android: `adb reverse tcp:3201 tcp:3201` and `adb reverse tcp:8201 tcp:8201`, then open `http://localhost:3201`.
- iPhone and Windows: open `http://<this Mac's LAN IP>:3201` after adding that origin to `CORS_ORIGINS`. The camera
  needs a secure context, so use upload rather than the camera on these devices.

Use sample data only. The profile flag is on here so V20–V24 can run; it stays **off** in production.

## 2. Screen-reader checks

Run `31` §7.1 V1–V20 and §7.2 T1–T13 as written, then the additions below. Record the actual speech, not what
was expected.

### 2.1 VoiceOver + Safari (macOS), additions for the follow-up

| # | Action | Expected |
|---|---|---|
| V21 | Decided sample trial → chart card: VO+Right past the caption to "Show the numbers", VO+Space, then VO+Right into the table (or VO+Cmd+T) | "Show the numbers, collapsed" → "expanded"; "Hydration scores, oldest first, table, 3 columns, 2 rows" (or similar); each row read with its header ("Baseline · Oct 31", "Score 69") |
| V22 | Snapshot: "Add your answers", pick an answer, "Use my answers" | Focus on the first question when the form opens; after Use, focus on "Edit answers, button", then once: "Answers applied: {answers}. The focus list has been re-ordered." (or "…is unchanged") |
| V23 | Trial with a saved profile: "Edit answers" → change one → "Save answers" | Back on "Edit answers, button", then once: "Answers saved: {answers}. This trial keeps the profile it started with." |
| V24 | Safari → Settings → Zoom the page to 200 %; Tab through `/` and the trial | Nothing cut off; the focused item is visible each time (a scroll region taller than the screen may be partly out of view) |

### 2.2 TalkBack + Chrome (Android), additions

| # | Action | Expected |
|---|---|---|
| T14 | Same as V21 | Disclosure state spoken; table navigable by swipe; numbers match the chart labels |
| T15 | Same as V22 and V23 | Each confirmation spoken once; not cut short by the focus move (record if it is) |
| T16 | Android Settings → Display → Font size at maximum, then `/`, snapshot and trial | No sideways scrolling; no text cut off; buttons grow around their labels |

### 2.3 NVDA + Firefox or Chrome (Windows)

Browse mode unless noted. Speech Viewer on (NVDA menu → Tools).

| # | Action | Expected |
|---|---|---|
| N1 | Load `/`, press H repeatedly | Headings in order, starting "Is it working? Run a fair test." |
| N2 | Explore with sample data | Route title, then "Your skin snapshot, heading level 1"; not the previous page's heading |
| N3 | Down arrow through the scores | "69 out of 100, room to improve" as one phrase |
| N4 | See matching products; F to the filters (focus mode) | Each option once; "Budget" in natural case |
| N5 | Toggle "Fragrance-free only" | Switch state, then the match count once |
| N6 | Start the trial; "Show synthetic 21-day follow-up" | Verdict heading once (not twice) |
| N7 | T to the chart table after "Show the numbers" | Table with row and column headers; Ctrl+Alt+arrows announce headers |
| N8 | V22 and V23 | As in VoiceOver |
| N9 | `/trials` → Delete all → Cancel → Delete all → Confirm | Same focus moves as V10 |
| N10 | Windows contrast theme on (owner's machine only, with their consent) | Selected options, toggles and card edges still visible |

### 2.4 VoiceOver on iPhone (Safari)

Swipe navigation; rotor set to Headings where noted. Record with "Copy last spoken phrase" or notes.

| # | Action | Expected |
|---|---|---|
| I1 | Load `/`, rotor Headings, swipe down | Same order as N1 |
| I2 | Double-tap "Explore with sample data" | Snapshot heading spoken; no stale heading |
| I3 | Swipe through two scores | One phrase per score |
| I4 | Filters on Matches | Each option once; state spoken |
| I5 | Start the trial; synthetic follow-up | Verdict heading once; then Result in words |
| I6 | V21 on the phone | Disclosure and table readable by swiping |
| I7 | V22 and V23 | Each confirmation once |
| I8 | Framer: move buttons and "Centre photo" (upload a photo) | Names spoken; photo moves with a double-tap |
| I9 | "Pause animations" | Toggle state spoken; motion stops |
| I10 | Settings → Accessibility → Display & Text Size → Larger Text at maximum; reload `/` and the trial | Note whether Safari applies it to the page (it usually doesn't to web content); if it does, nothing cut off |

## 3. Result sheet (one row per check)

| Check | Date | Tester (initials) | Device / OS / browser / AT version | Speech heard (verbatim) | Result: Pass / Fail / Unclear | Severity (§4.4) | Issue link |
|---|---|---|---|---|---|---|---|
| V1 | | | | | | | |

Keep the sheet in the repository as `docs/innovation/33a-RESULTS-<date>.md`, or attach it to the issue it fed.
A check without recorded speech is "Unclear", not "Pass".

## 4. Sessions with blind and low-vision participants

Use `31` §4 for recruitment, privacy, units and measures. This adds the script parts.

### 4.1 Consent and privacy (read aloud and give in an accessible format beforehand)

A draft for the owner to adapt: the payment, the 30-day deletion period and who keeps the notes are proposals,
not existing policy.

> "This is a test of the website, not of you. We'll ask you to try some tasks and say what you hear and think.
> You can stop at any time without giving a reason, and you'll still be paid. With your permission we'll record
> the audio and take notes; we won't record your face or your screen while a photo of your face is visible. We use
> sample data. If you choose to try your own photo, it is sent to YouCam, a third-party service, for analysis, and
> we will delete everything together at the end. Notes use a participant number, not your name. Recordings are
> deleted after the findings are written up, within 30 days. Do you agree to take part? Do you agree to audio
> recording? Do you want to use your own photo, or sample data only?"

Record three separate answers (take part / audio / own photo). Any "no" is respected without follow-up.

### 4.2 Tasks with expected outcomes

| # | Task (as said to the participant) | What success looks like (not said aloud) |
|---|---|---|
| P1 | "Tell me what this site does." | Says it compares skin scores before and after a product, with a fair test; doesn't say it diagnoses |
| P2 | "Try it with sample data and pick the concern you'd test." | Reaches the snapshot, hears scores as phrases, selects a focus |
| P3 | "Tell it about your skin in your own words, then carry on." | Finds "Add your answers", applies them, hears that they were applied and whether the list changed |
| P4 | "Start a trial with a product you'd consider." | Reaches the trial page and hears its heading |
| P5 | "Show the 21-day follow-up. What happened, how sure is it, and what would you do next?" | Restates the server's outcome in their words without over-reading it; names the next step |
| P6 | "Find the exact numbers behind the chart." | Opens "Show the numbers" and reads the baseline and the check-in score |
| P7 | "Position a photo using the buttons" (upload; sample portrait offered) | Moves and centres the photo with the move buttons |
| P8 | "Stop the moving parts on the home page." | Finds and uses "Pause animations" |
| P9 | "Remove the answers you saved with this trial." | Removes the profile; hears the outcome once; knows the plan didn't change |
| P10 | "Delete everything you've done here." | Deletes all data and hears the confirmation |

Low-vision participants: run P2, P5, P6 and P10 at their own zoom or magnifier setting and note anything cut off.

### 4.3 Feedback record (one per task)

Participant ID · AT, device and settings · task · completion (unaided / with hint / failed) · independence ("on
your own next time?" yes / with notes / no) · single-ease rating 1–7 · what they expected to hear · what they
heard (quote only with consent) · issues seen (each with severity) · linked issue.

### 4.4 Severity

Same scale as `25` §5:

| Severity | Meaning | Example |
|---|---|---|
| Blocker | Can't complete the task, or misunderstands the result in a way that could cause harm | Hears "beyond normal variation" as "it works" |
| High | Completes only with help, or the meaning is wrong until corrected | Verdict read twice and taken as two results |
| Medium | Completes alone, with real effort or confusion | Has to search for the chart numbers |
| Low | Annoyance; no effect on completion or understanding | Region name repeated after a button |

### 4.5 From finding to fix

1. Within two days of a session, open one GitHub issue per distinct finding, labelled `a11y` plus its severity,
   with the task, AT/device, what was heard and the participant ID only.
2. Blockers and highs: reproduce with the same AT, add a failing automated test where the behaviour is
   observable in the DOM, fix on a branch, and re-check with a screen reader before closing.
3. Mediums and lows: triage into the next accessibility pass; record the decision on the issue.
4. Add a line to `31` §7.3 for each finding and when it is closed. Don't mark a criterion as passing because a
   participant succeeded; the criterion status stays tied to the evidence type in `31`.

## 5. What these sessions should settle

- Whether the route title followed by the page `h1` sounds repetitive (V3, V17).
- Whether TalkBack cuts announcements short when focus moves at the same time (T4, T15).
- Whether "Show the numbers" is found without prompting, and whether its table is worth its length.
- Whether "Answers applied … re-ordered" is understood without seeing the list move.
- Whether large scroll regions (the app showcase, the concern table) are comfortable to use at high zoom.
