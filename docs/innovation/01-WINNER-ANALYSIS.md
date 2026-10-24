# 01 — Winner analysis (2026-10-25, audited against full videos)

Builds on `competitive-analysis.md` (same folder, 2026-10-19), which read each winner's **source code** in a scratch
clone. This version re-checks every claim against the **full videos**. Nothing was copied from any project.

Labels: **OBSERVED** (seen in code, video frames/narration, or live output) · **FACT** (cited source) ·
**INFERENCE** · **HYPOTHESIS**. Capability labels: VERIFIED · VERIFIED-BUT-CONSTRAINED · PLAUSIBLE-UNTESTED · UNSUPPORTED.

## Method and coverage

| Item | Access | Confidence |
|---|---|---|
| Devpost pages (all three) | Read in full | — |
| Repos (all three) | Exist and not archived (GitHub API, 2026-10-25); licences MIT / Apache-2.0 / MIT; source read 2026-10-19 | — |
| Aloud video (YouTube `2rPntXmDqHQ`, **2:55**) | Downloaded (user-approved), frames every 5 s via the *letmewatch* skill, narration transcribed locally (Whisper small, MLX) | High for structure and narration. Frames between the 5 s samples are unseen |
| ShadeSpan video (YouTube `wGVi5A1MDwM`, **2:55**) | Same | High |
| KeepMe video (Vimeo `1218788062`, **2:05**) | Same (via the public Devpost embed player) | High |

Transcripts come from automatic speech recognition and contain errors (e.g. "Ucam" for YouCam, "SEDSpan" for
ShadeSpan). They are paraphrased here; quotes are short. Videos, frames and audio were deleted after the audit.

## Aloud — 1st place (2:55)

| Time | What the video shows / says | Label |
|---|---|---|
| 0:00–0:08 | Title card "Two bottles." over a phone scanning a barcode; the problem in one line: if you can't see the label, the shelf goes silent | OBSERVED |
| 0:09–0:24 | Three stat cards, each with a source line: 8.5M blind or low-vision Americans (2024 ACS), "Sued" (Sephora, Fenty, Ulta), 5,114 ADA suits in 2025 | OBSERVED |
| 0:25–0:35 | Product thesis: voice-first assistant usable with the screen off. A chip names the **YouCam Skin Analysis API** | OBSERVED |
| 0:40–1:02 | Live barcode decode of a real product, with a chip reading *SCAN · REAL PRODUCT · LIVE DECODE*. Allergens spoken first; EU CosIng (33,116) and 91 allergen names | OBSERVED. **The product's brand label is visible on screen** |
| 1:05–1:18 | Live WebRTC voice conversation, every reply mirrored as text | OBSERVED |
| 1:20–1:42 | Selfie framed by sound on a real phone; *TONAL GUIDANCE · LIGHTING GATE · AUTO-CAPTURE*; "8.2 seconds, first try, on a real iPhone"; 7 concerns as structured scores | OBSERVED |
| 1:35–1:58 | The spoken read itself says lighting can shift the scores, and that redness is less reliable on deeper skin tones, "so treat these as approximate". Skin tone is used as a neutral metric to lower confidence "out loud" | OBSERVED |
| 2:00–2:08 | "Verify your look": a second capture against the bare-skin baseline. On the phone: the two photos are compared and "light or angle can shift them" | OBSERVED. **Qualitative variation caveat, no magnitude or band** |
| 2:10–2:25 | "Wired end to end, not wrapped." A code card shows the exact endpoints (file register, presigned PUT, task POST, task GET), "7 concerns · 12-unit SD tier · format: json". Chips: MCP engine option, claim linter in CI, verified on production | OBSERVED |
| 2:28–2:36 | Web app, iOS TestFlight, Android APK running in an emulator | OBSERVED |
| 2:37–2:55 | Perfect Corp's own scale figures; closing card with three QR codes (web, iOS, Android) and the repo URL | OBSERVED |

Not in the video: the Devpost page's "kill experiment" (10 of 10 captures under 30 s). The video shows one
capture (8.2 s). The YouCam Skin Tone API is described in narration, not shown as a call.

## ShadeSpan — 2nd place (2:55)

| Time | What the video shows / says | Label |
|---|---|---|
| 0:00–0:20 | Opens on its project site: "The same t-shirt. Two customers. One of them can't see it.", then the same failure at the other end of the tone range | OBSERVED |
| 0:25–0:55 | "Why nobody catches this today": stat cards (30–35% apparel returns, ~23% attributed to style/colour, 84 photoshoots) with a cited source line (NRF 2025) | OBSERVED |
| 0:57–1:09 | What it does: renders every garment on a six-tone panel with **YouCam Apparel VTO**, scores with standard colour science | OBSERVED |
| 1:05–1:35 | One number: **14.3%** of garments pass on every tone (2 of 14), over the full render grid. The rule is worst tone, never average | OBSERVED |
| 1:35–1:48 | Live local app. The engine selector defaults to **"Mock (zero API units)"** with a unit cap of 400 | OBSERVED |
| 1:50–2:12 | Drops a new garment photo, switches to **Live — YouCam Apparel VTO**; renders arrive one by one with a running unit count ("Rendering 3/6… 6 units") | OBSERVED |
| 2:10–2:28 | Result card: "Grade F — this colour fails on Fitzpatrick IV", graded on the weakest tone, **12 units spent** | OBSERVED |
| 2:30–2:42 | A second colour holds on all six (Grade B) | OBSERVED |
| 2:44–2:55 | Closing line: everyone else points try-on at the shopper; we pointed it at the catalogue | OBSERVED |

Not in the video: the render-drift self-audit (10 of 14) is on the Devpost page only.

## KeepMe — 3rd–5th (2:05)

| Time | What the video shows / says | Label |
|---|---|---|
| 0:00–0:07 | Landing page: "Change the clothes, not the person."; a "Live YouCam" status pill | OBSERVED |
| 0:05–0:42 | Narration describes Live Mode (AI Clothes v3, async task, optional Skin Analysis v2.1 consistency signal). On screen: a six-step flow; the "Identity drift demo" is marked as the recommended demo | OBSERVED |
| 0:30–0:42 | Identity contract with protected zones; consent box says no personal image is sent to YouCam in the disclosed synthetic scenario | OBSERVED |
| 0:45–1:12 | "A protected region changed", **92%** evaluation confidence; banner says the scenario is controlled; component evidence (threshold profile `mvp_conservative_v1`), two findings (high: preserve zone changed; medium: skin appearance shift) | OBSERVED |
| 1:12–1:22 | Restore and re-verify → "Passed after your repair" (93%) | OBSERVED |
| 1:25–1:40 | Integrity receipt. Generator: "KeepMe controlled demo"; consistency signal: "Controlled demo signal"; disclaimer that it isn't identity verification or medical analysis; signed JSON download | OBSERVED |
| 1:45–2:05 | "Your images are gone." Deletion confirmed; only a non-identifying deletion event is kept | OBSERVED |

**No live YouCam generation result appears in the sampled frames.** The whole visible path is the disclosed
fixture, while the narration describes Live Mode (OBSERVED at 5 s sampling; a shot under 5 s could be missed).
Also: a headline 92% confidence figure sits beside the claim that a hard finding can't hide in an average (OBSERVED).

## Cross-cutting observations (revised)

- **All three open on the thesis inside 5 seconds**, with one image: two bottles, two customers, one person and
  their clothes. OBSERVED.
- **Two of three cite sources on screen for their market numbers** (Aloud, ShadeSpan). OBSERVED.
- **Each closes on one reframing sentence**: the first beauty AI a blind shopper can use alone; pointed at the
  catalogue, not the shopper; change the clothes, not the person. OBSERVED.
- **Instrument honesty is shown, not just claimed**: Aloud speaks its confidence caveats; ShadeSpan grades on the
  worst tone and shows units spent; KeepMe labels its fixture on every screen and in the receipt. OBSERVED.
- **Aloud names the exact API pipeline on screen**, which satisfies the rule to "explain the YouCam API used".
  ShadeSpan names the API and shows its live use; KeepMe names the APIs in narration only. OBSERVED.
- **Variation between scans:** Aloud acknowledges that light or angle can shift a second capture's scores, but gives
  no magnitude, band or decision rule. Neither of the others addresses it. OBSERVED. *The gap ProofLoop targets —
  quantifying how much a score moves on unchanged skin, per user — survives, but "nobody acknowledges it" would
  be false.*
- **Length is not decisive among these:** 2:55, 2:55, 2:05. OBSERVED. (An earlier version of this file said
  ShadeSpan ran 1:00; that reading came from a YouTube pre-roll ad.)
- **A disclosed fixture as the whole demo did not prevent placing** (KeepMe). INFERENCE: n = 1, and we can't know
  whether it cost KeepMe a higher place.
- **A third-party brand was visible in the 1st-place video** (Aloud, 0:45), although the rules restrict
  trademarks. INFERENCE: this was not penalised, but ProofLoop should still follow the rule.

## Audit log: what changed from the frame-sample version

| Earlier claim | Status | Correction |
|---|---|---|
| ShadeSpan video is 1:00 and won with "one number" in 60 s | **Wrong** | 2:55. The 60.0 s reading and the "Pressu…" frame were a pre-roll ad |
| ShadeSpan headline at ≈0:45 | **Wrong** | At 0:00 |
| Aloud's 10/10 kill experiment is a "memorable proof" | **Downgraded** | Page-only; the video shows one 8.2 s capture |
| ShadeSpan's 10/14 drift audit is in its demo | **Downgraded** | Page-only |
| Aloud frames at ≈1:00 / 1:35 / 2:10 | Confirmed, refined | Exact ranges above |
| None of the winners addresses scan-to-scan variation | **Refined** | Aloud says light or angle can shift a second capture's scores (qualitative). No winner quantifies it |
| KeepMe video "not inspected" | **Now inspected** | The visible demo is entirely the disclosed fixture |
| Aloud's chapter chips such as *REAL PRODUCT · LIVE DECODE* | Confirmed | — |
