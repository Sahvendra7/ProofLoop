# 28 — Accessible capture and results specification (2026-10-26)

**Status: specification (2026-10-26), partly implemented in Release 1** (`e6e3e85` on `feat/a11y-r1`, not deployed).
**Implemented:** §5 step headings, focus and announcements (the nested live regions are gone; titles are
state-aware); the zoom slider's `aria-valuetext` (§6); the Result in words block (§10); the dial summary without
its own classification (§10–11); the preview treatment in §12; `aria-disabled` while the assistant is pending (§13).
**Not implemented (Stages 2–3, not approved):** capture paths and guide (§3), retake copy and the two-failure hint
(§4), move buttons and "Use the whole photo" (§6), scores, ordering sentence, visible legend and mask sentence (§7),
plain-language plan and instrument text (§8–9), the visible chart table and markers (§11), decorative product art
(§12), and the speech-button label (§13). Issue IDs and evidence labels are defined in `25`.
Copy below is draft wording for review, not final text. Every behaviour uses existing capabilities; anything that
would need a new capability is marked **[new capability — not proposed]**.

## 1. Scope and non-goals

**In scope:** the capture flow on `/scan` (consent, choose, camera, upload, framing, capture match, analysing,
failure), the snapshot on `/results`, and the instrument check, verdict, next step, plan and history on `/trial`.

**Non-goals.** No client-side face detection or "alignment" feature (the app has none, and the browser Shape
Detection `FaceDetector` API is experimental and not broadly available [inference]). No change to bands, rules,
verdicts, next steps or units. No AI-written descriptions of the user's skin or photo. No audio guidance played by
ProofLoop during capture.

## 2. What ProofLoop can and cannot verify about a photo

| Check | Where | When | Cost |
|---|---|---|---|
| File type JPEG/PNG/WebP; ≤10 MB; shorter side ≥480 px | Browser, `scan-flow.tsx:221-244` | On choosing a file | free |
| Zoomed past the photo's detail (crop < 480 px) | Browser, `framer.tsx:50-51,172-176` | While framing | free |
| Image decodes; ≥480 px; not "obviously" dark (mean luminance <28/255) | Server, `backend/app/services/imaging.py:20-23,74` | On upload / preflight | free |
| Same photo as the baseline (SHA-256 of the cleaned photo) | Server, `backend/app/services/protocol.py:87` | Check-in / instrument check | free |
| Brightness difference vs baseline (fair ≥12, poor ≥25 on 0–255) and camera vs upload mismatch | Server, `backend/app/domain/compare.py:71-72,210-246` | Capture match (free) and again in the verdict | free |
| Face too small, face out of frame, too dark, image too small | YouCam, mapped in `backend/app/services/scans.py:156-160` | During analysis | The UI says "If YouCam rejects the photo, nothing is saved and no units are used" (`scan-flow.tsx:579-580`); billing on rejection is **[unverified]** (the server records `possibly_billed`, `scans.py:144`) |

**Cannot be verified by ProofLoop:** face centred or level; head angle; glasses, makeup or hair; evenness of light
*across* the face (only the mean is measured); sharpness or motion blur; distance from the camera; same location
or time of day; that the face is the user's own (consent attestation only). The capture guide must say this
plainly, and no copy may imply that following the guide makes two photos comparable.

## 3. Capture paths

Offer all four paths on the "choose" step, in this order, with no path required.

| Path | Who it suits | How it works with existing features | Honest limits |
|---|---|---|---|
| **A. Take the photo with your phone's camera app, then upload it** | Screen-reader users on phones | iPhone: the Camera app with VoiceOver announces faces and their position, for example "One face. Small face. Bottom left corner" [guide: <https://www.imore.com/making-iphone-camera-work-blind>]. Pixel 6 or later: **Guided Frame** in the Camera app with TalkBack on guides framing and can shoot automatically [guide: <https://support.google.com/pixelcamera/answer/14110054>]. Then "Upload a photo" (existing) | Users report that face-position announcements are sometimes inaccurate at the frame edges [research, user forum: <https://www.applevis.com/comment/112446>]. ProofLoop's upload path still applies its checks (§2). The iOS file picker's own "Take Photo" option may not give face announcements **[unverified]**, so the guide recommends the Camera app first, then Photos |
| **B. Take a photo here** (existing in-browser camera) | Sighted and low-vision users; anyone without path A | Existing camera step, plus the announcements in §5 | No framing feedback |
| **C. Ask someone to help** | Anyone who wants certainty about framing | Same as A or B; the guide lists what the helper should check | Must never be required |
| **D. Explore with sample data** | Anyone | Existing | Not a measurement of the user |

**Consistency rule, stated in the guide.** "Use the same method for every photo in a trial (both via your camera
app and upload, or both here)." Reason: a camera-vs-upload mismatch already downgrades comparability to "fair"
(`compare.py:233-237`), and capture method is in the plan's "Conditions to match" (`trial-view.tsx:497-505`).

**Research basis.** Audio, vibration and overlay cues measurably help blind photographers frame shots: in
PortraitFramer, all participants centred faces using vibration and overlay cues (about 13 s per successful photo), and in EasySnap sighted judges preferred
photos taken with audio feedback [research: Jayant et al., ASSETS 2011,
<https://www.cs.rochester.edu/hci/pubs/pdfs/supporting-blind-photography.pdf>]. A 2022 ASSETS study of selfies by
people with visual impairments found current selfie apps don't give enough help [research:
<https://keithv.com/pub/selfies/penuela-visual-impaired-selfies.pdf>]. ProofLoop shouldn't build its own guidance
before testing whether OS-level guidance (path A) is enough [inference].

### 3.1 Draft capture guide (a `details` disclosure on the choose step, and a section on `/privacy`)

> **Using a screen reader or low vision? How to take a usable photo**
>
> ProofLoop can check a photo's size and overall brightness, and whether it's the same photo as before. YouCam
> then rejects photos where your face is too small, partly outside the frame or too dark. ProofLoop **can't** tell
> whether your face is centred or level, whether light is even across your face, or whether you're wearing
> glasses or makeup.
>
> 1. On iPhone, open the Camera app with VoiceOver on and switch to the front camera. VoiceOver says how many
>    faces it sees and where. Aim for "one face, centred". On a Pixel 6 or later, open the Camera app with TalkBack on
>    and follow Guided Frame's prompts. (Exact steps vary by phone and software version: confirm in testing.)
> 2. Face a window or other soft light, glasses off, hair off your forehead, no makeup.
> 3. Come back here, choose **Upload a photo** and pick the photo.
> 4. Use the same method, place and time of day for every photo in this trial.
>
> If you'd like certainty about framing, a sighted helper can check that your whole face, hairline to chin, is
> in the photo and that both sides are lit. This is optional.

## 4. When the user should retake, and when help is useful

| Signal (source) | What we say (draft) | Action offered |
|---|---|---|
| YouCam `face_too_small` / `face_out_of_frame` | Existing titles, plus: "Hold the phone a little closer, at eye level. If you're using your camera app's face announcements, wait for 'centred' before taking the photo." | Adjust and retry (re-frame same photo); Choose another photo; guide link |
| `too_dark` | Existing, plus "Face a window or a lamp in front of you." | Choose another photo |
| Capture match **poor** | Existing copy (`scan-flow.tsx:364-366`) is good; add the two brightness numbers in words: "This photo's brightness is 92 out of 255; your baseline's was 131." | Retake (primary); Analyse anyway (12 units) |
| Capture match **fair** | Existing, plus the reason list (already rendered) | Analyse; Use another photo |
| Same photo | Existing ("Take a fresh photo") | Take a fresh photo |
| Two failed attempts in a row on the same step | "If framing keeps failing, a sighted helper can check the photo for you, or you can explore with sample data." | Same actions; nothing forced |

## 5. Focus and announcements in the capture flow

Implementation pattern: a persistent polite announcer in the root layout (`30` Stage 1) and a heading with
`tabIndex={-1}` at the top of each step that receives focus once the step mounts.

| Step | Focus target | Announcement (polite unless noted) | Title |
|---|---|---|---|
| Consent | H1 on first load (no move) | — | "Before your photo · Scan · ProofLoop" |
| Choose | H2 "How do you want to add your photo?" | — | "Add a photo · Scan · ProofLoop" |
| Camera | H2 "Camera" | "Starting camera." then "Camera ready. The Capture button is below the preview." | "Camera · Scan · ProofLoop" |
| Camera error | Error heading (`role="alert"` already announces) | — | "Camera problem · Scan · ProofLoop" |
| Frame | H2 "Check the framing" | — | "Framing · Scan · ProofLoop" |
| Capture match | H2 "Is this a fair comparison?" | Once, when the result arrives: the level title + the two brightness values + capture methods | "Comparison check · Scan · ProofLoop" |
| Analysing | H2 "Measuring" | Each stage label once; no elapsed seconds | "Measuring · Scan · ProofLoop" |
| Failed | Error heading | `role="alert"` (existing) | "Couldn't analyse · Scan · ProofLoop" |

The nested `aria-live` wrappers at `scan-flow.tsx:425` and `:563` are removed in favour of the announcer.

## 6. Framing control (`framer.tsx`)

- Add **Move up / down / left / right** and **Centre** buttons next to the zoom buttons (2.5.7), each moving by
  the same step as the arrow keys (0.02 frame widths).
- Zoom slider: `aria-valuetext="Zoom 160 percent"`; buttons stay.
- Keep `role="application"` only if testing shows arrow keys are needed inside VoiceOver/NVDA browse mode; with move
  buttons present, a plain focusable group with `aria-describedby` instructions is simpler [inference; test in
  `31` §3].
- **Default zoom for uploads.** The framer opens at 1.6× (`framer.tsx:34`), a centre crop. A photo already framed
  with path A may lose forehead or chin at 1.6× and be rejected as "face out of frame" [inference]. Offer
  **"Use the whole photo"** (zoom 1, the 3:4 cover fit) as a button with the explanation "Best if you framed the
  photo with your camera app's face guidance". Whether 1× or 1.6× gives fewer rejections must be measured with
  participants' photos, not assumed (`31` §4).
- Instruction text without sight: "If you can't see the preview, choose **Use the whole photo** if you framed
  it with your camera app, or **Analyse this photo** as it is. YouCam will reject the photo if your face is too
  small or outside the frame, and nothing is saved."

## 7. Skin-analysis scores (`/results`)

- Keep the list. Each item reads, in order: name, score, "out of 100", band label, then the "Higher = …" helper.
  Move the helper after the score so the number comes first [inference; confirm preference in testing].
- The band legend says the bands are ProofLoop's grouping, not a clinical scale (existing text) — keep.
- Missing concerns are announced in the existing warn Notice; make it a static paragraph (not a live region).
- Always render the ordering sentence above the focus picker, e.g. "Listed with the concerns that could show a
  gain first, lowest score first" (A11Y-20); with the flag on use the server's `ranking_explanation`.
- Give the focus `fieldset` a visible legend "Pick one focus to test" (replaces the sr-only "Focus").
- **Masks:** keep the overlay; add "The overlay shows where YouCam looked for each concern. It adds no information
  beyond the score." Alt for the base image: "Your photo" (no description of skin; ProofLoop makes no claims about
  what the photo shows).

## 8. Plan and variation band in plain language

Built from `protocol.noise_band`, `protocol.improve_at`, `protocol.decline_at`, `band_evidence` and
`planned_checkin_at` — server values, already shown in `ProtocolCard`:

> "Two photos of unchanged skin can differ by up to 5 points on hydration. So your plan only counts a change if
> your score moves more than 5 points from 69: to **75 or higher** counts as up, **63 or lower** counts as down.
> These lines were fixed on 26 Oct and don't move. Planned check-in: 23 Nov."

For `band_evidence: personal`: add "Your instrument check showed your two photos differed by 7, so your band was
widened from ±5 to ±7. It can only widen." For `assumed`: existing `EVIDENCE_COPY.assumed`.

## 9. Instrument check

The existing copy already explains purpose and the widen-only rule. Add, above the button:

> "Why two photos? Take a second photo now, minutes after the first. Your skin hasn't changed, so any difference
> between the two scans is the measurement's own wobble. If it's bigger than the standard band, your band widens
> before anything counts. This costs 12 units and is optional."

After completion, focus the instrument heading (its text already states the spread and band in words).

## 10. Verdict: the "Result in words" block

A visible paragraph group immediately after the verdict `h2`, for everyone. It is generated **only** from server
fields. The dial keeps its visual role; its own sr-only summary is replaced by a pointer to this block
(`aria-hidden` on the SVG remains).

**Template** (`comparison` = `trial.comparison`, `focus` = `comparison.changes` item where
`metric === comparison.focus_metric`):

1. If `comparison.early`: "Early look: day {days_apart} of a planned {planned_checkin_days}-day test."
2. Headline: `OUTCOME_COPY[focus_outcome].headline` (already the `h2`).
3. Numbers — only when `focus_outcome` is `measured_improvement`, `measured_decline` or `no_clear_change`:
   "{metric_label} went from {focus.baseline} to {focus.current}, a change of {signed focus.delta} points. Your plan
   counted a change only beyond ±{focus.noise_band}{" (assumed)" if band_evidence = assumed}."
   For `inconclusive`: "The numbers are in the table below for context; they don't count as a result because
   {comparability.issues[0] lower-cased}." For `insufficient_data`: `OUTCOME_COPY.insufficient_data.body`.
4. Fairness: "Conditions: {comparable | comparable, with caveats | not comparable}." from `comparability.level`.
5. "Next step: {NEXT_STEP_COPY[next_step.action].title}" — with the body text in the Next step section that
   follows, unchanged.
6. If synthetic: prefix "Synthetic demo, not a measurement."

**Forbidden in any accessible text:** "worked", "didn't work", "effective", "improved your skin", "significant",
"proof", "because of the product", any probability or confidence figure, any claim about what the photo shows.
These rules mirror the existing copy discipline in `format.ts` and `docs/decisions/005-noise-banded-verdicts.md`.

**Why not keep client-side classification?** The server already decides `verdict` per metric and
`focus_outcome`, including poor-comparability overrides and widened bands (`compare.py:197-208,281-289`). The
accessible version must not be a second implementation (A11Y-07).

## 11. Chart and dial equivalents

- **BandChart:** add a visible `details` "Show the numbers" directly under the figure, containing the existing table
  (no longer `sr-only`), with columns When / Score / Difference from baseline. Classification column only for the
  compared check-in, from `comparison.changes`, or for every point if the backend later returns a per-history
  verdict **[optional backend change]**. Visual: band gets a 1 px `ink-3` dashed outline; the compared point gets a
  distinct shape and a text label ("check-in, beyond ±5"); synthetic stays hollow.
- **Dial:** visual unchanged. The legend copy names shape and position, not only colour (A11Y-19).
- **Homepage dials:** keep their sr-only summaries (illustration values, no server verdict exists), and fix the
  "±" double read by using "plus or minus" in the summary only (already done) and `aria-hidden` on the centre value.

## 12. Images and previews

| Image | Treatment |
|---|---|
| User's photo (frame, preflight, analysing, masks) | `alt` "Your photo" / "Your check-in photo" — no description of content |
| Detection mask | `alt` "{concern} detection mask" + the explanation sentence (§7) |
| Skin Simulation | Existing alt + figcaption already says "an appearance preview, not a prediction"; keep |
| Product illustration | Decorative (`aria-hidden`); the name is the heading |
| Homepage phone previews | `role="img"` + one-sentence label including "sample data" or "synthetic demo"; inner content hidden |
| Editorial hero photo | Keep descriptive alt + visible credit |

## 13. Assistant

Keep the security and privacy boundaries exactly as they are (owner key, consent versions, allowlisted actions, no
links in replies). Changes: `aria-disabled` instead of `disabled` while pending; label the speech button "Read
aloud with this device's voice"; keep the pre-rendered live region; the answer's source label stays text.
