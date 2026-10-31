# 29 — Accessibility recommendations for the design system (2026-10-26)

**Status: recommendations (2026-10-26), partly implemented in Release 1** (`e6e3e85` on `feat/a11y-r1`, not deployed).
**Implemented:** §2 surface-aware focus ring; §3 `berry-deep` for headline phrases on berry; §4 segmented, toggle
and focus-card rows; §5 forced-colours fallbacks (via Tailwind's `forced-colors:` variant rather than new classes).
Release 1 also lowered the strawberry-glow strengths to 0.14/0.12 so white text keeps 4.5:1 (not in the original
recommendations). **Not implemented (Stage 2, not approved):** §4 input and chart rows, §6 typography and `min-h`,
§7 motion, §8 sticky layers. Grounded in `frontend/src/app/globals.css`,
`frontend/src/components/ui.tsx` and `docs/design-direction.md`. Ratios are [measured] (`25` §6). The aim is a
few targeted changes that keep the berry-milk / strawberry / espresso identity, not a new system.

## 1. What already works (keep)

- Body and helper text: `ink` 15+:1, `ink-2` 9–10:1, `ink-3` 5.97–7.77:1 on every light surface.
- Buttons: white on `strawberry-ink` 5.19:1; the comment in `globals.css:5-8` already reserves `#fe3144` for
  large/decorative use.
- Verdict tokens: `better` and `worse` are the same colour on purpose (`globals.css:38-45`), so a verdict's
  direction is always in words and arrows. Keep this; it is the strongest colour-vision decision in the product.
- Band text colours are darkened variants of the bar colours (`format.ts:28-33`).
- Global reduced-motion override and JS-gated reveal.
- Targets: `sm` buttons are 40 px tall, zoom buttons 36 px, segments about 32 px — above the 24 px minimum (2.5.8).

## 2. Focus indicator (A11Y-08, 2.4.7, 2.4.13)

Replace the single colour with a surface-aware token:

```css
/* globals.css — sketch */
:root { --focus-ring: var(--color-strawberry-ink); }
.on-strawberry, .on-espresso { --focus-ring: #ffffff; }
:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 3px; }
```

| Surface | Ring | Ratio vs surface |
|---|---|---|
| white / paper / berry-soft | strawberry-ink | 5.19 / 4.90 / 4.49 |
| berry-milk, berry-glow | strawberry-ink (3.99) or espresso (12.72) | ≥3 either way; espresso preferred near the red hotspot |
| strawberry-ink (footer, final CTA, step panels, problem cards) | white | 5.19 |
| espresso (verdict panel, showcase card, problem cards) | white | 16.54 |

Apply `.on-strawberry` to `site-footer.tsx` wrapper, `FinalCta`, `strawberry-glow` panels and the strawberry
problem cards; `.on-espresso` to `bg-espresso`/`bg-ink` panels (`VerdictExplorer`, `Verdict`, `TrialCard`).
`outline` survives forced-colours mode (it is re-coloured, not removed) [guide:
<https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors>].

The `Segmented`/`Toggle`/focus-card rings that use `has-[:focus-visible]:outline-accent` should switch to the same
token.

## 3. Display type on berry surfaces (A11Y-09, 1.4.3)

| Text | Surface | Now | Proposed | Ratio |
|---|---|---|---|---|
| `text-strawberry` headline phrases | berry-milk / berry-glow | 2.82 (2.03 hotspot) | `text-berry-deep` | 5.28 (3.80 hotspot) |
| `text-strawberry` headline phrases | white / paper | 3.66 / 3.46 (large text, passes) | keep | — |
| `text-strawberry-ink` small text | berry-milk | 3.99 (fails for <18.66 px bold) | avoid; use berry-deep | 5.28 |

Rule for the design doc: **`#fe3144` only for large type on white or paper, and for decoration.**

## 4. State indicators and boundaries (A11Y-11, 1.4.11)

| Control | Now | Proposed | Ratio |
|---|---|---|---|
| `Segmented` selected | white pill on sunken (1.16) | `bg-ink text-paper` (same as mask/priority chips) + a check icon `aria-hidden` | 14.23 |
| `Toggle` off track | line-strong on sunken (1.41) | 2 px `ink-3` border on the track; knob with `ink-3` border | 6.68 |
| Text inputs (assistant) | `ring-line-strong` (1.64) | `ring-ink-3` | 7.77 |
| Focus picker selected card | accent-soft fill (1.20) + radio dot (5.19, passes) | keep dot; add 2 px `strawberry-ink` border on selected card | 5.19 |
| Chart band | within-soft fill (1.14) | add dashed `ink-3` outline | 7.77 |
| Chart beyond vs within point | colour only (1.13 apart) | shape (diamond for the compared check-in) + text label | — |

Cards (`ring-line`, 1.30) don't need 3:1: they aren't controls, and their content identifies them.

## 5. Forced colours / Windows High Contrast

In forced-colours mode `box-shadow` (Tailwind `ring-*`, `shadow-*`) is removed, author `background-color` is
overridden, `background-image` gradients are removed, and SVG `fill`/`stroke` are replaced [guide: MDN
forced-colors]. MDN advises small fixes rather than a separate design. Consequences here [inference]:

- Selected `Segmented` option, focus-picker dot, toggle position and mask/priority chip state **disappear**.
- Card and input boundaries (rings) disappear.
- Dial ticks and band arc become one colour; the dashed vs solid needle remains.

Minimal fixes:

```css
@media (forced-colors: active) {
  .pl-card, input[type="text"], input[type="password"] { border: 1px solid CanvasText; }
  .pl-selected { outline: 2px solid Highlight; forced-color-adjust: none; }
  .pl-toggle-track { border: 1px solid CanvasText; }
  .pl-toggle-track[data-on="true"] { background: Highlight; forced-color-adjust: none; }
}
```

(Class names are placeholders; the implementation can use Tailwind's `forced-colors:` variant instead of new
classes.) The `Result in words` block (`28` §10) and visible data table make the dial and chart non-essential in
this mode.

## 6. Typography, spacing and zoom (1.4.4, 1.4.10, 1.4.12)

- `.eyebrow` 0.72 rem uppercase with 0.14 em tracking → 0.8125 rem, 0.08 em (A11Y-24). It carries real labels
  ("Step 3 of 4 · Choose", "Match logic · from your scan").
- Badges at 0.65–0.7 rem ("Focus", tier, "Can't show gains") → ≥0.75 rem.
- Pill buttons: `h-10/h-12/h-14` → `min-h-10/min-h-12/min-h-14` with `py-2` so wrapped labels under 200 % text or
  text-spacing overrides don't overflow (A11Y-25, [unverified] until tested).
- `whitespace-nowrap` on dial values (`trial-view.tsx:195`) is fine at the clamp sizes but check at 400 % zoom.
- Line heights 0.92–0.98 on display headings are intentional; users' 1.4.12 overrides apply to them too — verify
  no clipping inside `overflow-hidden` hero containers.
- Keep `rem` units; the app never sets a fixed root font size, so browser text-size settings apply.

## 7. Motion (A11Y-13, 2.2.2)

- Marquee: add a visually small but visible "Pause animation" button (≥24 px) beside the section, or run the
  marquee once and stop. Pause on `:focus-within` as well as `:hover`.
- Float chips: limit to 3 iterations (`animation-iteration-count: 3`); they are decorative and `aria-hidden`.
- Keep the global reduced-motion override.

## 8. Sticky layers (A11Y-12, 2.4.11)

- Under 900 px, make the How-it-works step bar non-sticky, or raise `scroll-padding-top` on `/` to cover nav +
  bar (≈ 9 rem) — technique C43 [guide: Understanding 2.4.11].

## 9. Dark mode and user preferences

The app declares `color-scheme: light` only. A dark theme isn't required for WCAG and would double the contrast
work; recommend not adding one now. Users who need dark or inverted displays use OS features (Smart Invert,
Classic Invert, Android colour inversion); the photo, mask and simulation images should be tested under Smart
Invert, which normally exempts images [unverified].
