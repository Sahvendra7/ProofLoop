# 17 — Skin profile: product decision memo (2026-10-26)

**Status: A4 selected by the owner on 2026-10-26; gate G0 passed the same day (§8); built behind
`SKIN_PROFILE_ENABLED`, off by default, not deployed.** Evidence is in `16`; IDs like S3 and
§2.1 refer to it.

## 1. Bottom line

Build a small **"checked skin profile"** (Approach 4 below), and only if a paid verification gate passes. The profile
helps people pick a test that can show a result, and it applies ProofLoop's own discipline to the AI label: show
it, let the user confirm or correct it, and check whether it held between the two instrument-check photos. It never
ranks concerns by itself, never touches the band or the verdict, and is frozen when the plan is committed.

Do **not** build Fitzpatrick, facial colour tones, routine planning or skin-type product filters. Each adds cost
or claims the evidence does not support (`16` §3).

**Honest value statement:** this is a modest improvement to an already-differentiated product. The critical path
to 2026-11-02 is the video and the submission (`15` §8). If the gate fails or time runs short, ship the zero-unit
fallback or nothing.

## 2. The user problem

People arrive with a self-image ("I have oily skin") and want to test a product aimed at it. ProofLoop then shows
eight scores that may not match that self-image. In the owner's live check, oil balance read **99**, at the top of
the scale (`15` §5). A test aimed at shine could therefore never show an improvement. Today the focus picker
handles this with "Can't show gains", but it doesn't connect to what the user believes about their skin, so the
reason feels arbitrary.

**Who:** a first-time ProofLoop user choosing a focus (steps 3–4 in `16` §1.1).
**Job:** "Help me pick something to test that this measurement can actually show, in terms I recognise."
**Not the job:** telling the user what their skin is, or what to buy for it.

## 3. Approaches compared

| | **A1 Lightweight label** | **A2 Label + guided personalisation** | **A3 Profile-driven tracking + routine** | **A4 Checked profile (recommended)** | **A0 Self-report only (fallback)** |
|---|---|---|---|---|---|
| What | Add `skin_type` to the baseline call; show whole/T/U labels on the snapshot | A1 + self-report (shine, dryness, reactive skin, priorities) + priority in focus picker + education cards + personalised capture tips | Profile chooses primary and secondary concerns, logs routine, sets the schedule | A2 minus personalised capture tips, **plus** label stability from the instrument check, conflict surfacing, per-trial pinned action set, frozen snapshot | Self-report + existing scores only; no API change |
| User value | Low–med: a familiar word, with no help acting on it | Med: connects self-image to the test | Looks high, but adds weak, unsupported advice | **Med–high: prevents untestable trials and teaches that a label is a snapshot** | Med: most of A4's picker value |
| Complexity | Low–med (parser, column, UI line) | Med | High | Med (≈ A2 + one comparison) | Low |
| Unit cost (live trial: baseline + repeat + check-in) | 36 → 36–42 | 36 → 36–42 | Same or more | 36 → **36–42** (+0–2 per scan; `16` §2.1 unresolved) | **+0** |
| UI change | 1 card | Self-report step + picker annotations + cards | New tracking surfaces | Self-report step + profile card + picker annotations + one line on the trial page | Self-report step + picker annotations |
| Persistence / privacy | AI label per scan | + self-report | + routine logs (more personal data) | AI label per scan + frozen per-trial snapshot; delete with session | Snapshot only (or browser-only) |
| Scientific validity | Shows an unvalidated label bare | Better: user check, but the label is still untested | Weak: secondary concerns without bands break the one-focus pre-registration; routine advice is unsupported (S14) | **Best available: label is user-checked and stability-checked, and never drives ranking** | Good: no unvalidated AI claim |
| Medical-confusion risk | Med ("Redness" read as sensitive) | Med | High | Low (explicit redness ≠ sensitivity copy, S3) | Low |
| Build + test + demo | ~1 day | ~2 days | 4+ days | **~3 days** incl. guards and docs (`19` §2), + 24–26-unit gate | ~1.5 days |
| Workflow compatibility | High | High | Low (alters what a trial is) | High (pre-commit only; protocol untouched) | High |
| Judging impact | Small | Moderate | Risky ("feature soup") | **Moderate, with a distinct idea** | Small–moderate |

**Why not A3:** ProofLoop's verdict rests on one pre-registered focus with a measured band. Adding "secondary
observations" invites reading noise as signal across eight metrics, which the protocol exists to prevent, and a
routine planner would need efficacy evidence we don't have (S14).

**Why A4 over A2:** A2 shows an AI label with no way to know whether it is reliable. A4 adds what ProofLoop already
has, a second capture minutes later. If the label flips between two photos of the same face, the product says so
and stops using it. No other entry we know of does this, and it is the same "test the instrument" idea that
already sets ProofLoop apart.

**Why A4 drops personalised capture tips:** no evidence ties capture advice to skin type. Universal advice (same
light, same time of day, bare face) applies to everyone and already lives in `FairPhotoGuide`.

## 4. Recommended scope (A4)

**In scope**

1. Request `skin_type` (SD) in the **baseline** scan when the flag is on, and in every later scan of that trial (pinned
   action set). Never mix action sets within a trial.
2. Parse the three region labels; store them on the scan. Show the date and the zones. Never invent a label when one
   is missing.
3. Self-report (optional, skippable): visible shine (often / sometimes / rarely / not sure), tightness or flaking
   (same scale), "my skin reacts easily to products" (yes / no / not sure), and up to two concerns that matter most.
4. Profile card: "What you said" beside "What the camera read". Agreement or disagreement is shown plainly;
   **the user's answer wins** for wording. The AI label never ranks.
5. Focus picker: deterministic annotations and user priority (design spec §5). Same testability rules as today.
6. Freeze a **profile snapshot** into the trial at `POST /trials` (versioned, `rules_version`). It is shown on the
   trial page as context only.
7. Label stability: after an instrument check, compare baseline vs repeat labels and show "held" or "changed". If
   it changed, the profile is marked unstable. That has no effect on the protocol.
8. Correction and withdrawal at any time. Changes after commitment are recorded as an amendment, are labelled
   "changed after your plan was fixed", and are never used by the trial.
9. Sample-data mode with a clearly labelled sample profile.

**Explicit non-goals (v1)**

- Fitzpatrick phototype, facial colour tones, undertone, ethnicity: any capture or display.
- Product filtering, re-ranking or "suits your skin type" badges. The catalogue has no such data, and adding it
  would be our own unsupported claim.
- Ingredient, routine, SPF or patch-test advice.
- Any profile input into `focus_band`, `repeat_spread`, `compare()`, `focus_outcome()` or `next_step()`.
- Profile topics in the trial assistant or any Gemini use for profiles.
- HD analysis, pose detection, blur scoring.
- A cross-trial "my skin" profile. The snapshot is per trial; nothing persists beyond the session.

## 5. The smallest honest demo (≈25 s of video)

1. "I'd say my skin is oily — I want to test a shine-control serum."
2. Camera reads **T-zone: Oily · Cheeks: Normal · Whole face: Oily** (dated, sample-labelled in sample mode).
3. Focus picker: *Balance shine* is pinned as "You picked this", **but** "Oil balance is 99 — the scale tops out,
   so this test can only show a drop." Suggested alternative with room: *Hydration 72*.
4. After the instrument check: "Your skin-type reading **held** on both photos" (or "**changed** — we won't lean on
   it").
5. Later verdict: unchanged logic, and the profile appears only as context.

The demo shows ProofLoop refusing a test that can't succeed, which fits "doesn't claim more than the evidence
proves".

## 6. Hackathon criteria (equal weight; `docs/hackathon-rules.md`)

| Criterion | Effect of A4 | Risk |
|---|---|---|
| Technological implementation | A second documented Skin Analysis output, parsed defensively. Per-trial action pinning keeps measurement consistent; stability is checked with no extra call; ledger-safe | Touches the scan pipeline 6 days before the deadline. Mitigated by the flag and the gate |
| Design | User agency (confirm, correct, reject); clear "said vs read"; fits the existing editorial style | Scope creep into a dashboard; mitigated by the single card |
| Potential impact | Stops users spending weeks on a test that cannot show a result; teaches that labels shift | Impact is unmeasured; no user research |
| Quality of the idea | "We check the AI's label the way we check the scores" | Judges may see "skin type" as commodity unless the stability check is shown |

## 7. Decision table

| Item | Decision | Why (evidence) |
|---|---|---|
| `skin_type` in pinned action set | **Build** (behind flag, after gate) | Documented output, same call, ≤ +2 units (`16` §2.1) |
| Self-report profile | **Build** | Free; the user is the authority on sensations (S3) |
| Said-vs-read card, conflict copy | **Build** | Self-report and instruments can disagree (S2) |
| Picker priority + annotations | **Build** | Reuses `detectability()` |
| Label stability via instrument check | **Build** | No extra call; addresses the missing stability evidence |
| Frozen, versioned snapshot; amendments | **Build** | Protocol integrity |
| Zero-unit fallback (A0) | **Build if gate fails** | Keeps most of the value |
| Personalised capture tips | Defer | No evidence linking them to type |
| Finish-preference prefill from self-report | Defer | Harmless but low value |
| Profile topics in assistant | Defer | Keep Gemini/quick paths untouched |
| HD skin type, blur score, MediaPipe pose | Defer | Need their own studies |
| Fitzpatrick phototype | **Reject** | 10 units; image ≠ sun reactivity; no validation; equity concerns (S4–S7, S13) |
| Facial Color Tones | **Reject** | 20 units; aesthetic matching; device colour error (S11) |
| Routine planning / secondary concerns | **Reject** | Breaks one-focus pre-registration; unsupported advice |
| Skin-type product filters / ingredient advice | **Reject** | No outcome evidence (S14) |
| Skin Simulation for profiles | **Reject** | Prior honesty decision (`05` D3/D4) |
| Tier pricing of `skin_type` | **Investigate** | Paired call or support ticket |
| Effect of `skin_type` on other scores | **Investigate** | Paired call on identical bytes |
| Whole vs zone semantics | **Investigate** | Support ticket (free) |
| Label stability across days and people | **Investigate** | Accrues from real instrument checks; no claim until n is meaningful |
| Tone fairness of `skin_type` | **Investigate** | Ask YouCam for validation data; claim nothing meanwhile |

## 8. Gate before any build (owner decision)

**G0 — authorise the paired verification (24–26 units of the 816 balance).** Same freshly prepared image, two
calls: 8 actions (current) and 9 actions (+`skin_type`), with the free credit endpoint read before and after each
(`20` §1.3).

| Outcome | Action |
|---|---|
| 8 shared scores identical **and** label parsed | Proceed with A4; set `analysis_units` to the measured tier |
| Any shared score differs | **Do not** add `skin_type` to trial scans. Ship A0, or a separate profile-only scan (9 units, 1–4 tier) outside trials, owner's call |
| Label missing or a new shape | Stop; update parser and fixtures; re-decide |

Alternative to G0: open a YouCam support ticket (free) for the pricing and whole-vs-zone questions, and accept the
score-perturbation risk only with the paired call.

**G0 result (2026-10-26, 26 units, 816 → 790):** baseline 12, with `skin_type` **14** (it counts as a concern);
all eight shared `ui_score`/`raw_score` values and `all`/`skin_age` identical; three entries
`{type, region, skin_type, mask_urls, url}` with labels whole Dry / T-zone Normal / cheeks Dry and no numeric or
confidence field; no retries, no unexplained balance movement. Outcome: **A4**. Report:
`backend/tests/fixtures/youcam/skin-type-gate-report-20261026T094239Z.json`.
