# Solution landscape — 2026-10-19

Time-boxed research. App-store listings are self-descriptions, not verified usage; repositories were
cloned and read, not run.

## Consumer products

| Product | Primary job | How "progress" is shown | Gap relative to ProofLoop's question |
|---|---|---|---|
| [Neutrogena Skin360](https://appfollow.io/android/neutrogena-skin360-r/com.neutrogena.skin360?country=nl) | Selfie score + brand recommendations | Score over repeat scans (weekly suggested) | No stated scan-to-scan variation; brand-tied |
| [Glow Mind AI](https://apps.apple.com/us/app/-/id6748363571) | Coach; compare two analyses side by side | Two scores next to each other | Any difference reads as change; photos go to a third-party LLM |
| [Sharp: Face Scan](https://mwm.ai/apps/sharp-face-scan-skincare/6780025151) | 0–100 score, weekly rescans adjust routine | Score trend | No variation band; routine adapts to noise |
| [Claro: Acne Tracker](https://mwm.ai/apps/claro-acne-tracker/6772650733) | Acne photo diary + AI zone score | Side-by-side + trend | Single concern; no comparability check |
| [MySkin Data](https://apps.apple.com/by/app/myskin-data/id6449375671), SpotTrack | Photo diary, date-to-date compare, face-guided alignment | Photos only | Leaves judgement to the eye (alignment guide is a good idea) |
| [Clear](https://apps.apple.com/id/app/app/id1551189203), [PeauTrace](https://apps.apple.com/app/id6754798890), [Skin Breathes](https://apps.apple.com/app/id6760603762) | Journals, self-rated progress | User says whether it improved | No measurement |

**Finding (evidence: listings):** products that score over time show the score and its trend; none of the
listings found states how much the score moves when the skin hasn't changed, or refuses to call a change.
**Hypothesis (not tested):** users over-attribute small score moves to products. We have no user data.

## Open-source repositories

| Repo | What it actually is (from code) | Quality signals | Licence | Use for ProofLoop |
|---|---|---|---|---|
| [Shubh3005/SkinIQ](https://github.com/Shubh3005/SkinIQ) | React + Supabase; HAM10000 classifier; `ScanComparison.tsx` marks fields `improved / worsened / changed / same` by direct comparison | Feature-rich README with "coming soon" items; no noise handling | none found → not reusable | Confirms the gap: any category flip = "improved" |
| [DurtyDhiana/skin-scan](https://github.com/DurtyDhiana/skin-scan) | Local OpenCV/MediaPipe "maps" (Laplacian texture, blur-diff blemishes) | 40 files, map tests only, heuristics unvalidated | MIT | Not adopted: would replace YouCam's measurement with an unvalidated one |
| [jenniiiiiii007S/skincare-recommendation-system](https://github.com/jenniiiiiii007S/skincare-recommendation-system) | Course project: Gemini + ChromaDB multi-agent routine builder, ingredient-conflict rules | Notebook-driven, no tests | none found | Not adopted: vector DB + LLM for a fictional catalogue adds cost, no credibility |

## Science and measurement principles

| Source | Principle | Engineering decision in ProofLoop |
|---|---|---|
| Vaz et al., [The case for using the repeatability coefficient](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3767825/) (PLOS ONE 2013) | Use measurement-error indices (repeatability coefficient / smallest real difference), not ICC, to judge whether an individual's change is real | The verdict compares against a per-concern band, not a correlation; the band is shown in points |
| [SRALab glossary](https://www.sralab.org/statistical-terms-use): MDC95 = 1.96 × SEM × √2 | A change must exceed the minimal detectable change; MDC ≠ meaningful change (MCID) | Verdict says "beyond normal variation", never "meaningful" or "works"; the bands are *observed ranges + margin*, explicitly **not** MDC95 (too few scans to estimate SEM) |
| Ceiling/floor effects ([OMERACT glossary](https://omeract.org/?p=12662)) | Scores bunched at a scale end cannot show change in that direction | Detectability lines; ceiling focuses flagged and listed last |
| [Smartphone colour & wrinkle tracking in cosmetic trials](https://arxiv.org/pdf/2008.01483) (arXiv 2020) | Lighting varies between sessions; normalise or control it | Capture-match preflight compares luminance and capture source before the scan |
| [Lighting & AI skin analysis preprint](https://www.preprints.org/manuscript/202409.0822) (2024, not peer-reviewed, n=14) | Found no significant lighting effect on one system — weak, small, different instrument | Not used to relax anything; our own data showed 18% darker → ≤2 points |
| Pre-registration (general research practice) | Decide outcome and threshold before seeing data; avoid picking the best of many comparisons | Trial stores band, lines and check-in date at creation; only the focus decides |
| Uncontrolled before/after designs | Cannot attribute change to the intervention | Unchanged: ProofLoop never claims causation |

No study was found that reports test-retest repeatability of a consumer selfie skin API across days and
devices. ProofLoop has **not** been clinically or independently validated.

## Calibrating the bands properly (proposed, not done)

1. Consented sample: ≥ 10 people × 2 devices × 2 days × 2 captures ⇒ 80 analyses ≈ **960 units** — more than
   the remaining balance (≈ 840). A minimal version (3 people × 2 days × 2 captures = 12 analyses, 144 units)
   would at least characterise acne/oiliness/redness on faces that aren't saturated.
2. Compute within-person SD per concern and score range; band = MDC95. Ship as a new band table; running
   trials keep their registered bands (now enforced by migration 0002).
3. Until then: assumed bands = widest measured band, labelled.
