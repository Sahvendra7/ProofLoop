# 20 — Skin profile: unit costs and risk register (2026-10-26)

No units were spent producing this file. The balance figures are the last recorded (`15` §5, 2026-10-25); read the free
credit endpoint before any spend.

## 1. Unit costs

### 1.1 Per operation

| Operation | Units | Evidence | Status |
|---|---|---|---|
| Skin Analysis, 8 SD actions (today) | 12 | Doc tier 5–8; ProofLoop live balance deltas (`docs/youcam-integration.md`) | **Verified live** |
| Skin Analysis, 8 + `skin_type` (9 actions) | **14** | Paired gate 2026-10-26: balance 804 → 790 | **Verified live** |
| Skin Analysis, profile-only (`skin_type` + ≤3 concerns, outside trials) | 9 | Doc tier 1–4; unstack: 1 concern = 9 | Doc + 3p-live; not proposed unless G0 fails |
| HD equivalent (9 actions) | 20 | Doc | Not proposed |
| Fitzpatrick v1.0 | 10 | Doc; unstack balance delta 26 = 16 + 10 | Doc + 3p-live. **Rejected** |
| Facial Color Tones v1.0 | 20 | Doc | Doc only. **Rejected** |
| Skin Simulation | 4 | ProofLoop live | Verified. Unchanged |
| Failed task (`task_status: error`) | 0 | Doc; ProofLoop live | Verified |
| Timeout after task creation | Possibly billed (ledger keeps reservation) | Doc: a successful task that times out without polling is billed | Handled by `usage.settle(possibly_billed=True)` |
| Credit balance, feature-cost list | 0 | Doc; unstack | Free |
| Profile create / edit / withdraw / focus plan | 0 | No provider call | By design |

### 1.2 Scenarios per live trial (A4; low = 12/scan, high = 14/scan)

| Scenario | Successful analyses | Today | A4 low | A4 high |
|---|---|---|---|---|
| Normal: baseline + instrument check + check-in | 3 | 36 | 36 | **42** |
| No instrument check | 2 | 24 | 24 | 28 |
| One rejected capture (face too small) on the way | 3 (+1 failed) | 36 | 36 | 42 |
| Retake after a poor-comparability check-in | 4 | 48 | 48 | 56 |
| Heavy: early check-in, retake, final check-in | 5 | 60 | 60 | 70 |
| Profile created, edited twice, withdrawn | — | 0 | 0 | 0 |
| A0 fallback, any scenario | — | same as today | +0 | +0 |
| *(Rejected)* adding Fitzpatrick to the baseline | — | — | +10 | +10 |
| *(Rejected)* adding colour tones to every scan | — | — | +60 | +60 |

**Budget:** YouCam balance 816 (2026-10-25); deployment ledger 36 of 400. A4 needs G0 (≤ 26) + one owner demo
trial (≤ 42) + buffer ≈ **70–90 units**, leaving more than 700 and staying under the ledger cap. Per-session hourly
limits are unchanged (`LIVE_SCANS_PER_SESSION_PER_HOUR=6`).

### 1.3 Gate G0: paired verification protocol (owner-supervised)

1. Read the credit balance (free).
2. Prepare **one** image with `prepare_image` and keep the bytes in memory (no disk).
3. Analysis A: 8 actions. Poll to success. Read balance → Δ₁.
4. Analysis B: the same bytes, 9 actions (`+skin_type`). Read balance → Δ₂.
5. Record Δ₁ (expect 12; **stop** if not), Δ₂ ∈ {12, 14}; exact equality of the 8 shared `ui_score`/`raw_score`;
   the three labels; redacted response as a fixture.
6. Total spend ≤ 26. One retry only on a documented, unbilled error (for example face too small).

Byte-identity with the 2026-10-11 probe can't be shown (luminance 85.0 vs 85.6 on rebuild, `16` §2.6), so a
single-call shortcut is not valid.

## 2. Risk register

L = likelihood, I = impact (H/M/L).

| ID | Risk | Type | L | I | Mitigation | Residual |
|---|---|---|---|---|---|---|
| R1 | Users read the label as a diagnosis or a permanent "type" | Scientific | H | M | Dated, zoned card; "describes this photo"; "What this reading isn't"; copy lint | M |
| R2 | "Redness" read as sensitive skin or a condition | Scientific | M | M | Rule C4 notice (IFSI definition, S3); sensitivity is self-report only | L |
| R3 | Label is unstable between captures | Model quality | **Unknown** | M | Never ranks; stability line from the instrument check; "changed" suppresses label-based wording | L–M |
| R4 | Label is less accurate on some skin tones | Model quality / equity | Unknown | H | No accuracy or fairness claim anywhere; ask YouCam for validation data; never derive tone or ethnicity (S5, S10) | M (can't be tested by us) |
| R5 | Label contradicts the score (Oily vs oil balance 99) | Model quality | M | M | Rule C3 explains; "Your test uses the score" | L |
| R6 | Adding `skin_type` changes the other 8 scores | Measurement | Unknown | **H** | G0 exact-equality test; per-trial pinned action sets | L after G0 |
| R7 | Price tier jump (+2 per scan) | Cost | M | L | Reserve 14; budget in §1.2 | L |
| R8 | Duplicate billing on retries | Cost | L | M | Existing no-retry-after-send policy (`client.py`) | L |
| R9 | Self-report (reactive skin) is sensitive personal data | Privacy | M | M | Optional; separate "save" consent; per-trial only; cascade delete; withdraw endpoint; nothing logged | L |
| R10 | The privacy page's YouCam line covers analysis results only, not the uploaded photo | Privacy (pre-existing) | — | M | Correction below; ship separately from this feature | Open |
| R11 | Profile endpoints expose another session's trial | Security | L | H | `owned_trial`/`owned_scan` (404); tests | L |
| R12 | Lost update on concurrent edits | Concurrency | L | L | `protocol.lock` + `expected_amendments` → 409 | L |
| R13 | Profile leaks into the verdict or band | Protocol integrity | L | **H** | Layer separation; property tests; golden `TrialOut` | L |
| R14 | Not finished before the deadline; video slips | Release | M | **H** | Stop rule on Oct 30; video is the critical path; A0 fallback | M |
| R15 | Migration 0004 fails on production | Release | L | H | Additive nullable columns; Neon backup branch; tested up/down on PG | L |
| R16 | Flag off doesn't stop pinned 9-action trials | Cost / ops | L | L | Documented; ≤ 2 units per scan | L |
| R17 | YouCam changes or removes the `skin_type` shape | Provider | L | M | Lenient parser; missing ≠ failure; live fixture | L |
| R18 | Third-party evidence (aloud/unstack) was wrong | Provider | L | M | G0 records our own live fixture before build | L |
| R19 | The feature blurs the pitch ("another skin analyser") | Judging | M | M | 25 s demo framed as "won't run a test that can't succeed" | M |
| R20 | Assistant or Gemini path changes | Regression | L | M | Untouched; regression tests | L |
| R21 | Copy drifts into medical or wellness-device claims | Regulatory | L | M | Cosmetic wording; copy lint; not legal advice (S15) | L |
| R22 | Self-report options feel judgemental or exclusionary | Equity / UX | L | L | Neutral options incl. "Not sure"; fully skippable | L |
| R23 | Fitzpatrick or tone added later "because it's available" | Scope | M | M | Rejected with reasons in `17` §7; revisit only with validation evidence and a non-cosmetic purpose | L |

## 3. Unresolved, and how to resolve each

| # | Question | How |
|---|---|---|
| U1 | Does `skin_type` count toward the price tier? | **Resolved 2026-10-26: yes, 14 units** |
| U2 | Does adding it change the other scores? | **Resolved 2026-10-26: no change on identical bytes (one pair)** |
| U3 | What does "whole" mean relative to the zones? | Support ticket |
| U4 | How stable is the label across captures, days and people? | Instrument-check stability counts from consented real trials; report n, claim nothing |
| U5 | Accuracy and fairness across skin tones | Ask YouCam for validation data; until then, claim nothing |
| U6 | Can a `file_id` be reused across features? | Irrelevant while Fitzpatrick and tones are rejected; support ticket if revisited |
| U7 | AAD patch-test wording | Retrieve the AAD page directly; owner approves before any safety copy |
| U8 | Exact Fitzpatrick class labels (doc table lists "Type V" twice) | Irrelevant while rejected |

## 4. Privacy wording correction (R10), verified 2026-10-26

The two official statements describe different data, so both belong in the disclosure:

- [AI Skin Analysis](https://docs.perfectcorp.com/reference/ai_skin_analysis.md): "Processed results are retained for
  24 hours after completion."
- [File retention period](https://docs.perfectcorp.com/develop/file_retention_period.md): "Uploaded files and their
  associated file_id values are stored for 30 days"; "After an AI task is created, the corresponding task_id remains
  valid for 30 days"; download URLs are "valid for 2 hours"; "All uploaded and generated images and videos are
  automatically removed after 30 days." No deletion endpoint is documented on that page.

`frontend/src/app/privacy/page.tsx` ("Where your data goes") currently says only: "YouCam documents that processed
results are retained for 24 hours." That is accurate for results but omits the uploaded photo. Required replacement:

> **YouCam** keeps the photo ProofLoop uploads, and its file ID, for up to 30 days, after which its documentation says
> uploaded and generated images are removed automatically. It documents that Skin Analysis results are retained for
> 24 hours after completion. YouCam's own terms govern its processing.

The consent screen's "What's sent" line in `frontend/src/app/scan/scan-flow.tsx` should gain the same 30-day fact.
This is independent of the skin profile (the reading travels in the same request as the scores) and ships as its own
change.
