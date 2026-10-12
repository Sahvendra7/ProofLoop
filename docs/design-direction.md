# Design direction

Reference studied: driveberry.fr (desktop 1440×900 and mobile 375×812, 2026-10-12). This document records what
ProofLoop adapts, what it deliberately does not, and the resulting system.

## What the reference does well

| Pattern on driveberry.fr | Adapted for ProofLoop as |
|---|---|
| Floating, fully rounded white nav bar over a berry-pink page; strawberry links; one red CTA | Same structure; links to real routes only; a disclosure menu on mobile |
| Berry-milk (#fcd7f3) storytelling sections alternating with quiet white sections | Pink for story sections (hero, how it works, CTA); white/near-white for app surfaces |
| Phone mockups as the main product visual, with frosted "notification" chips floating around them | Phone frames rendering **live React previews of real ProofLoop screens** fed by the recorded sample fixture, each labelled "Sample data" |
| Red rounded pain-point cards scrolling in marquees | Horizontally scrollable, snap-aligned problem cards (swipe on mobile, keyboard-scrollable region) plus a marquee of the eight measured concerns |
| A speedometer gauge made of tick marks around a central statement | **The variation dial**: tick marks with the normal-variation band shaded, a baseline needle and a check-in marker. It explains ProofLoop's core idea, not a decoration |
| Alternating "app screen panel | text panel + red CTA" blocks with a sticky feature tab bar | A six-step "how it works" with a sticky step bar; each step pairs copy with the matching screen preview and links to the real route |
| Radial-gradient strawberry CTA panel with a ring gauge | Final CTA panel with the dial |
| Giant translucent wordmark in a red footer | Same gesture with the ProofLoop wordmark |

## What we do not adopt

- Automotive imagery, car photos, the DriveBerry logo, copy, icons or layout pixels.
- Lifestyle stock photography: no licensed skin photography is in the repo, and downloading third-party images
  needs the owner's approval. Imagery is therefore original: the dial, packaging illustrations from catalogue data,
  and live UI previews. Licensed editorial photography can slot into the hero `mirror` later.
- Reviews, user counts, satisfaction percentages and "free" badges: ProofLoop has none of that evidence.
- The pinned 2,600 px hero scroll-jack: content must never wait for an animation.
- Green "verified" chips. Green appears only as a tiny "available/complete" status dot.

## System

**Colour** (contrast measured)

| Token | Value | Use |
|---|---|---|
| `berry-milk` | #fcd7f3 | Story sections |
| `blush` | #fff6fb | App page background |
| `strawberry` | #fe3144 | Display headlines ≥ 32 px, decoration, dial band edges (3.66:1 on white — large text only) |
| `strawberry-ink` | #d61a2f | Buttons (white text 5.19:1), links on white |
| `berry-deep` | #b8001f | Red text on berry-milk (5.28:1) |
| `espresso` | #2c1a1a | Body text (12.7:1 on berry-milk) |
| `cocoa` | #6b4a4a | Secondary text (5.97:1 on berry-milk, 7.77:1 on white) |
| `fresh` | #67e844 | Status dots only, always with a text label |

**Verdict colour rule.** A measured change is emphasised because it exceeds normal variation, *not* because it is
good news. "Up" and "down" beyond the band share one treatment (espresso panel, strawberry accents) and are told
apart by arrow and words. "No clear change" uses berry-milk; "inconclusive" uses a dashed white panel.

**Type.** Display: Bricolage Grotesque (variable, optical size) — warm and expressive like the reference's Ubuntu
headings, but our own. Body: Geist. Hero `clamp(3.25rem, 9vw, 7.5rem)`, section `clamp(2.25rem, 5vw, 4.5rem)`,
line-height 0.95–1.05, negative tracking.

**Shape.** Panels `rounded-[2rem]`, cards `1.5rem`, pills fully rounded. Buttons are pills with a small arrow chip.

**Motion.** CSS-only reveals triggered by one IntersectionObserver hook; a floating animation on preview chips;
a CSS marquee; the dial draws on reveal. Everything is visible without JavaScript (reveal styles apply only when
`html.js` is set) and collapses to instant under `prefers-reduced-motion`.
