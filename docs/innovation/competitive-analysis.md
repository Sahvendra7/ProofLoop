# Competitive analysis — source-level re-check (2026-10-19)

Builds on `docs/competitive-analysis.md` (2026-10-12), which covers the three previous winners' Devpost
pages and repositories in depth. This pass re-cloned each repository (shallow, into a scratch directory,
never into ProofLoop) and answered the specific questions below from source. **Fact** = seen in code or
on the page; **Analysis** = our reading.

| Project | Repo (last commit) | Licence |
|---|---|---|
| Aloud — 1st | [StephenSook/aloud](https://github.com/StephenSook/aloud) (2026-09-04) | MIT |
| ShadeSpan — 2nd | [Abhinav0905/shadespan](https://github.com/Abhinav0905/shadespan) (2026-08-17) | Apache-2.0 |
| KeepMe — 3rd–5th | [ankitlade12/keepme](https://github.com/ankitlade12/keepme) (2026-08-16) | MIT |

No code was copied from any of them.

## Aloud

- **Target user (Fact):** blind and low-vision shoppers; accessibility is the product, not a mode
  (`app/accessibility/page.tsx`: capture framed "by sound alone", lighting gate, auto-capture).
- **Grounding (Fact):** spoken claims come from `ui_score` only; `lib/label-read.ts` passes every string
  through a guardrail lint.
- **Uncertainty (Fact):** `lib/skin-tone.ts` — "Bias-aware confidence calibration from YouCam Skin Tone
  Analysis… lower confidence and say so. Tone is used only to calibrate honesty". Tests assert lower
  scores are attributed to "makeup OR lighting, never blame" (`tests/unit/look-verify.spec.ts`).
- **Analysis:** Aloud's credibility came from *saying less when the instrument is weaker*. ProofLoop's
  equivalent is the assumed-band rule and the ceiling flag.

## ShadeSpan

- **From capability to decision tool (Fact):** grades garments per skin tone using published colour science,
  worst-case not average.
- **Budget (Fact):** `pipeline/orchestrator.py` `UnitLedger.charge()` — an `asyncio.Lock`-guarded cap checked
  before every call. **Cache (Fact):** `_cache_key` = SHA-1 of garment bytes + person bytes + category +
  engine; renders are content-addressed so re-runs spend nothing.
- **Provider isolation (Fact):** `youcam/endpoints.py`, `client.py`, `mock.py`.
- **Generalises (Analysis):** "spend units only when the answer can change" — the principle behind
  ProofLoop's free preflight. ProofLoop already had a stricter ledger (DB-backed, survives restarts).

## KeepMe

- **Inconclusive handling (Fact):** `lib/integrity.ts` `decideState()` returns `"inconclusive"` *before*
  any scoring when `alignmentReliable === false || qualityConfidence < 0.55`; the API refuses to approve an
  inconclusive result (`route.ts`: "A conclusive, non-failed verified result is required", 409).
- **Testing (Fact):** unit tests on the decision function (`integrity.test.ts`), Playwright + axe.
- **Analysis:** KeepMe gates on *input quality first*. ProofLoop did the same for the verdict, but only after
  paying for the scan; the preflight moves the gate in front of the spend.

## Principles adopted vs. avoided

| Adopt (as a principle) | Avoid copying |
|---|---|
| Lower your confidence where the instrument is weakest, visibly (Aloud) | Voice-first UX, accessibility audience, Skin Tone API bias layer |
| Don't spend units unless the answer can change (ShadeSpan) | B2B catalogue audits, colour-science scoring |
| Gate on input quality before computing a verdict (KeepMe) | Identity contracts, JWS receipts, ClamAV/private blob infra |

## Gap none of them (or the consumer apps) fill

None measures change over time. The consumer apps found in this pass that do (see
`solution-landscape.md`) compare two scores without a noise band, so any difference reads as progress.
