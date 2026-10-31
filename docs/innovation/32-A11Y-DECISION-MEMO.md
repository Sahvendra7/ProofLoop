# 32 — Accessibility: product decision memo (2026-10-26)

**Status: decision taken 2026-10-31.** The owner approved Stage 0 + Stage 1, plus selected states and forced
colours. These are implemented as `e6e3e85` on `feat/a11y-r1`, not deployed. §3 (defer) and §4 (don't build)
remain open recommendations; the release timing in §5 and decisions 2–4 in §6 are still the owner's. Evidence in `25`; designs in
`28`–`29`; plan in `30`; verification in `31`.

## 1. Bottom line

ProofLoop's *content* is already unusually accessible. Verdicts are written in words, up and down are deliberately
the same colour, tables are real tables, the chart and dial have text equivalents, and errors explain how to
recover. Its *interaction* is not. Almost every step change, result reveal and confirmation drops keyboard focus
to the page body without announcing anything, so a screen-reader user loses their place at exactly the moments
that matter: starting the scan, seeing the verdict, deleting their data. On the visual side, two brand pairings
fail and the focus ring vanishes on red panels.

**Recommendation: build Stage 0 + Stage 1 of `30` as the first release (R1).** It is small (≈ 1½–2 days
[inference]), frontend-only, needs no new dependency, can be rolled back instantly, and removes the
blockers that don't depend on the camera:

1. Focus moves to the heading of whatever replaced the control the user pressed (scan steps, verdict, instrument
   check, confirmations, route changes).
2. One persistent announcer for status; static notices stop being live regions.
3. A visible **Result in words** under the verdict heading, built only from server fields.
4. Homepage previews become one short, honest image description each.
5. A surface-aware focus ring, and `berry-deep` instead of `#fe3144` for headline phrases on pink.
6. A widened axe gate (WCAG 2.1/2.2 tags) and focus/announcement tests that fail today.

## 2. Why this strengthens the product, not just compliance

- **The verdict is the product.** "Result in words" ("Hydration went from 69 to 77, +8; your plan counted a
  change only beyond ±5; conditions comparable; next step: keep going if you like it") is the clearest statement
  of ProofLoop's fair-test idea for *every* user, not only screen-reader users. It repeats the server's verdict
  and adds nothing to it.
- **It reinforces server authority.** Removing the client-side "beyond/within" re-derivations closes a small
  integrity gap (A11Y-07) that a future band or rule change could otherwise open.
- **Privacy promises become perceivable.** "Delete everything, instantly" is a homepage promise; today its success
  message may never be announced.
- **The capture guide is honest.** It says what is and isn't checked, which matches the brand's "measured, not
  assumed" voice. It also sends blind users to the phone's own accessible camera instead of a home-grown
  imitation.

## 3. Defer

| Item | Why defer |
|---|---|
| Stage 2 visual fixes (selected states, forced colours, chart table, motion) | Real failures, but not blockers; they need visual review with the owner |
| Stage 3 capture changes, especially the default zoom for uploads | Needs blind participants' photos to choose the default (`31` §4) |
| Accessibility statement + footer help link | Needs the R1 outcome to describe the limits truthfully |
| Per-trial deletion UI (backend exists) | Product decision; "delete all" already meets the privacy promise |

## 4. Don't build

- A separate "accessible mode" or guided screen-reader workflow. Fixing the main flow is cheaper and keeps a
  single source of truth.
- A "read the result aloud" control or spoken capture coaching. These duplicate OS features (Speak Screen,
  Select to Speak, Spoken Content) and talk over screen readers.
- In-app text-size, contrast or saved accessibility preferences. Browser zoom and OS settings already do this, and
  the real problem is fixed contrast and reflow.
- Face detection or "alignment" claims. ProofLoop has no such capability, and the browser API isn't production-ready
  [inference].

## 5. Timing and risk

The hackathon deadline is 2026-11-02 and the critical path is the video and submission (the owner's release log `15` §8 and PR #4's skin-profile memo `17` §1; neither is in this branch).
Two options:

- **R1 before the deadline.** Low technical risk (frontend-only, instant rollback), but any deploy needs your
  explicit approval and the full E2E suite green. Reasonable only if it doesn't take time from the video.
- **R1 after the deadline (recommended if time is tight).** Nothing in R1 changes measurements or verdicts, so it
  doesn't affect submission evidence.

Either way, don't make accessibility claims beyond `31` §5.5.

## 6. Decisions needed from the owner

1. Approve Stage 0 + Stage 1 as R1 (yes / change scope / not now).
2. Ship R1 before or after 2026-11-02.
3. Budget for participant sessions: time, payment, and up to ≈ 200 YouCam units if participants choose live
   photos (`31` §4).
4. Whether per-trial deletion should be added to the UI.
