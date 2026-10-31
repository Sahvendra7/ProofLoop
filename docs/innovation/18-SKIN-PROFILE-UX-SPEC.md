# 18 — Skin profile: UX specification (2026-10-26)

For recommended option A4 (`17`). Rules and IDs (P1–P3, C1–C8) are defined in the design spec §4.4. All copy below is
**proposed**: it lives in `frontend/src/lib/format.ts` and the backend rule texts, and must pass the copy lint
(spec §6).

**Visual identity kept:** the existing four-step rail ("Step 2 of 4 · Understand", "Step 3 of 4 · Choose"),
`font-display` headings, `Card`, `Notice`, the berry-milk pill, editorial body text. There are no new score dials,
no profile "dashboard" and no new colour.

## 1. Flow (changes in bold)

```
Scan consent ─▶ capture ─▶ analysing ─▶ Snapshot (Step 2)
                                          ├─ eight concern bars (unchanged)
                                          ├─ **Skin-type reading card**  (L1, dated, zoned)
                                          └─ **"In your words" (optional, skippable)**  (L2)
                                       ─▶ Choose focus (Step 3)
                                          └─ GoalPicker **with priority + plain-language notes** (L3)
                                       ─▶ Matches (unchanged; no skin-type filtering)
                                       ─▶ Start trial = plan fixed (unchanged) **+ profile frozen into it**
Trial page ─▶ plan card (unchanged) ─▶ instrument check (unchanged)
          └─ **"Profile at the start" (collapsed) + stability line after the instrument check**
          ─▶ check-in ─▶ verdict + next step (**unchanged; profile never next to the verdict**)
```

## 2. Consent (Step 1) — one added bullet, only when the flag is on

> **What's read:** the eight concern scores, plus a skin-type reading (for example, "T-zone: oily") that
> describes how your skin looks in this photo. Neither is a medical assessment.

## 3. Screens

### 3.1 Skin-type reading card (Snapshot page, right column, above "Where YouCam looked")

```
┌──────────────────────────────────────────────┐
│ How the camera read this photo               │  h2
│ Oct 27, 2026 · YouCam skin-type reading      │  small, ink-3
│                                              │
│  Whole face   Oily                           │  three rows, label left, value right
│  T-zone       Oily      (forehead, nose)     │
│  Cheeks       Normal    (U-zone)             │
│                                              │
│ Describes this photo only. Readings can      │  C8
│ shift with season, time since washing and    │
│ light.                                       │
│ ▸ What this reading isn't                    │  <details>
└──────────────────────────────────────────────┘
```

"What this reading isn't" (expanded):
> It isn't a diagnosis, and it isn't your skin "type" for good: oiliness changes with season and between parts of
> the face. It doesn't tell you what to buy. ProofLoop's test uses the scores, not this label.

States:

| State | Copy |
|---|---|
| Missing (C7) | "The camera didn't return a skin-type reading for this photo. Your scores are unaffected." |
| Partial | Show returned rows; the others read "Not returned". |
| Redness in any label (C4) | Notice (neutral tone): "**Redness here means how the photo looks.** It isn't the same as *sensitive* skin, which is about how skin feels — stinging, burning or itching — and can look completely normal." |
| Sample data | Existing provenance pill: "Sample data — recorded reading, not your face". |
| Flag off | Card absent. |

### 3.2 "In your words" (optional; below the reading card; collapsed by default on mobile)

```
┌──────────────────────────────────────────────┐
│ In your words  (optional)                    │
│ The camera sees one photo. You know how your │
│ skin behaves day to day.                     │
│                                              │
│ Shine through the day   ○Often ○Sometimes    │  radio groups, fieldset/legend
│                         ○Rarely ○Not sure    │
│ Tight or flaky          ○Often ○Sometimes    │
│                         ○Rarely ○Not sure    │
│ Reacts easily to new products ○Yes ○No ○Not sure│
│ What matters most (up to 2)  [chips: 8 goals] │
│                                              │
│ Does the camera's reading sound like you?    │
│   ○Yes  ○Not really  ○Not sure               │  user_view
│                                              │
│ ☐ Save my answers with this trial            │  separate consent (spec §4.7)
│   Kept with the trial and deleted with it.   │
│ [Use my answers]        Skip                 │
└──────────────────────────────────────────────┘
```

After "Use my answers", a one-line comparison replaces the form (C1/C2):

- Agreement: "**You and the camera both point to shine** (T-zone: oily)."
- Disagreement: "**Your answers and the camera differ.** Shine shifts with season, washing and light, and neither
  is a diagnosis. ProofLoop will use your words when describing your skin." [Edit answers]
- Reactive = yes (C5): "**Change one product at a time** so you can tell what made a difference."

### 3.3 Capture guidance and photo-quality feedback

Unchanged and **not personalised by skin type** (no evidence ties capture advice to type; `17` §3). The existing
`FairPhotoGuide` tips and provider error guidance (`providers/youcam/errors.py::USER_GUIDANCE`) apply to everyone.
One addition to the tips list, for all users: "Same time of day if you can."

### 3.4 Choose focus (Step 3) — GoalPicker with priority and notes

```
Pick one focus to test                                     (h2, unchanged)
Ordered by: whether a change could show up, then what you   ← ranking sentence (new)
said matters, then the lowest score.

(•) Balance shine          You picked this   Can't show gains
    Oil balance 99 · looking strong
    The skin-type reading says oily, but the oil-balance       ← C3
    score shows little visible shine. Your test uses the score.
( ) Look more hydrated     Most room
    Hydration 72 · room to improve · counts as a change at 78 or 66
( ) Smoother texture ...
```

The top line appears only when the user's own priority is untestable:
> You picked **Balance shine**, but at 99 a later scan can't score high enough to count as an improvement. Testing it
> would only show a drop. **Hydration** has the most room.

**The AI label never moves a row** (spec §4.4). Copy never says "recommended for your skin type".

### 3.5 Matches (unchanged)

No skin-type badges or filters. A one-line note, shown only when the user saved a profile:
"Matches use your focus and preferences, not your skin-type reading."

### 3.6 Start trial — confirmation adds one line

> Your plan is fixed when you start: focus, the change that would count, and the check-in day. **Your answers and
> the camera's reading are saved with it as they are today.** Changing them later won't change the plan.

### 3.7 Trial page — "Profile at the start" (collapsed `<details>` below the plan card)

```
▸ Profile at the start  ·  Oct 27
    In your words: shine often · tight rarely · reacts easily: not sure
    Camera: whole oily · T-zone oily · cheeks normal
    You said the camera's reading: sounded like you
    Skin-type reading on your instrument check: held ✓     ← C6
    This profile never affects your plan or your result.
    [Edit answers]  [Remove profile]
```

C6 states:

| Stability | Copy |
|---|---|
| held | "Held: both photos gave the same reading." |
| changed | "Changed: the reading differed between two photos taken minutes apart, so ProofLoop won't lean on it." |
| partial | "Can't tell: one of the photos didn't return a full reading." |
| not_checked | "Not checked yet. Your instrument check will show whether the reading holds." |

Edit after the first check-in (amendment with `after_seal`):
> "Saved. Marked as changed after your plan was fixed. Your plan and result are unaffected."

Remove profile (withdraw):
> "Remove your answers and the skin-type readings from this trial? Your scores, plan and result stay." [Remove]
> [Cancel]

### 3.8 Check-in and verdict

Unchanged. The profile is **not** shown beside the verdict, the next step or the assistant. If a check-in returns
a different label, it appears only inside the collapsed block, as "Camera at check-in: …", followed by:
"A different reading isn't a result and isn't caused by the product. Your result comes from the
{focus} score only."

## 4. Words to avoid (enforced by copy lint)

diagnose/diagnosis · condition · treat/treatment · cure · Fitzpatrick · phototype · ethnic/ethnicity · undertone ·
"your skin type is" · "suits/for your skin type" · "sensitive skin" (except C4's sentence) · "proves" · "works for you".

## 5. Accessibility

- Every radio group is a `fieldset` with a `legend`. Chips are toggle buttons with `aria-pressed`, and a "2 of 2
  selected" live message appears at the limit.
- Label rows use a `dl` (term = region, definition = label) so screen readers hear "T-zone, Oily".
- Agreement and disagreement are text, never colour alone. The C4 notice uses the existing `Notice` (role note).
- The self-report step is fully skippable with one button and adds no required fields.
- Playwright + axe on desktop and mobile, as for the existing suites (`frontend/e2e`).
