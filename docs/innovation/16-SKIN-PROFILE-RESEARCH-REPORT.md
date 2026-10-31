# 16 — Skin profile research report (2026-10-26)

Research sprint: should ProofLoop add AI skin-type analysis and a personalised skin profile, and if so, how?
This file holds the evidence. The decision is in `17`, the design in
`docs/superpowers/specs/2026-10-26-skin-profile-design.md`, the UX in `18`, the sequence in `19`, costs and risks
in `20`.

**Constraints honoured:** no application code changed, no live YouCam call, no units spent, no Gemini/deploy/
database change, nothing committed. One offline, zero-network computation was run (§2.6).

**Evidence labels used throughout**

| Label | Meaning |
|---|---|
| **[repo]** | Read in this repository's source (path given) |
| **[doc]** | Official Perfect Corp / YouCam documentation (URL given) |
| **[vendor-repo]** | Official YouCam-API GitHub source (MIT) |
| **[3p-live]** | Third-party hackathon repository that recorded a live response (MIT; shape only, no code copied) |
| **[paper]** | Peer-reviewed paper or professional-body statement (abstract-level unless stated) |
| **[preprint]** | Not peer-reviewed |
| **[inference]** | Our reasoning, not a finding |
| **[unresolved]** | Could not be verified; the verification step is named |

---

## 1. Phase A — the product as built

### 1.1 Lifecycle as implemented (differs from the brief's order)

The baseline is captured **before** the focus and product are chosen. The trial is *created* (and its protocol
registered) only at step 5.

| # | Step | Where | What is persisted |
|---|---|---|---|
| 1 | Anonymous session | `POST /api/v1/sessions` — `api/v1/system.py::new_session`, `services/sessions.py` | `sessions` (token hash only) |
| 2 | Baseline scan | `POST /api/v1/scans` — `api/v1/scans.py::create_scan` → `services/imaging.py::prepare_image` → `services/usage.py::reserve` (12 units) → `services/scans.py::ScanJobRunner._run` → `providers/youcam/client.py::analyze_skin` → `domain/normalize.py::normalize_outputs` | `scans` (+ `requested_metrics` JSON, capture metadata, `content_digest`), `metric_readings`, `provider_calls`. **No image** |
| 3 | Snapshot + choose focus | `frontend/src/app/results/results-view.tsx::Snapshot`, `GoalPicker` (client-side ordering: testable first, lowest score first) | nothing |
| 4 | Choose product | `frontend/src/app/matches/matches-view.tsx`; `domain/recommend.py::recommend` (tiered rules) | nothing |
| 5 | **Commit protocol** | `POST /api/v1/trials` — `api/v1/trials.py::create_trial` | `trials.goal`, `product_id`, `focus_band`, `band_evidence`, `planned_checkin_days` (migration 0002) |
| 6 | Instrument check | `POST /api/v1/scans` with `purpose=repeat_baseline` — `services/protocol.py::ensure_repeat_allowed`, `lock` | `trials.repeat_scan_id`; repeat scan has `trial_id = NULL` |
| 7 | Check-in | free preflight `POST /trials/{id}/preflight`; then `POST /scans` with `trial_id` → `protocol.seal` | check-in scan; `trials.repeat_spread` sealed |
| 8 | Verdict + next step | `GET /trials/{id}` — `trials.py::_trial_out` → `domain/compare.py::compare`, `focus_outcome`, `next_step` | computed on read, never stored |

### 1.2 Answers to the Phase A questions

| Question | Answer |
|---|---|
| Skin attributes already returned | 8 SD concerns requested (`domain/metrics.py::METRICS`: moisture, oiliness, redness, texture, pore, acne, radiance, dark_circle_v2), each `ui_score`/`raw_score`/`mask_urls`. YouCam also returns `all`, `skin_age`, `resize_image` unrequested; these land in `Normalized.ignored_types` and are discarded [repo, fixture `tests/fixtures/youcam/analysis-success-live.json`]. |
| Is skin type stored or calculated? | **No.** `skin_type` is not requested; nothing derives a type from scores. `GOALS` map goals to single metrics only. |
| Enough data for a profile without another paid call? | **Partly.** The 8 scores support a *score-based* profile (which concerns have room to change). An appearance *type label* needs `skin_type` in the request. A user self-report costs nothing. |
| Extend existing request or separate operation? | **Extend.** `skin_type` is an SD `dst_action` in the same `POST /s2s/v2.0/task/skin-analysis` call (§2.1). Fitzpatrick and colour tones are separate tasks on separate endpoints (§2.2, §2.3). |
| Affected modules | See §1.3. |
| Relation to baseline / protocol / results | The profile is an observation of the **baseline photo** plus user input, frozen into the trial when the protocol is committed. It must not touch `focus_band`, `repeat_spread`, `compare()` or `next_step()`. |
| Migration needed? | Yes, if we persist anything: a nullable JSON column on `scans` for the AI label and on `trials` for the frozen profile snapshot (`0004`). A self-report-only fallback can avoid a migration (§17 fallback) by keeping the draft in the browser and storing nothing. |
| How to keep it optional | Feature flag; the action set is pinned per trial via `scans.requested_metrics` (already stored), so existing trials keep 8 actions forever. |

### 1.3 Source map of what a profile would touch

| Area | File :: symbol | Why it matters |
|---|---|---|
| Action set + price | `backend/app/providers/youcam/endpoints.py::analysis_body`, `analysis_units`, `_ANALYSIS_SD_UNITS` | Adding a 9th action crosses from the 5–8 tier (12) into 9–12 (14) **if** `skin_type` counts as a concern (§2.1, unresolved) |
| Response model | `providers/youcam/models.py::SkinOutput` (`extra="ignore"`) | **Silently drops** `region` and `skin_type` today; must gain two optional fields |
| Normaliser | `domain/normalize.py::normalize_outputs` | `skin_type` entries have no `ui_score`, so they would land in `ignored_types`. Needs a separate parser, not a change to the metric path |
| Constant action list | `domain/metrics.py::REQUESTED_PROVIDER_ACTIONS`, used by `api/v1/scans.py::create_scan`, `services/scans.py::ScanJobRunner._run`, `api/v1/trials.py::_instrument_out` (unit display), `api/v1/system.py::system_status` | Must become per-scan so a check-in matches its baseline's action set |
| Ledger | `services/usage.py::reserve`, `settle` | Works unchanged if `units` comes from the pinned action set |
| Protocol | `services/protocol.py`, `domain/compare.py` | **Must not change.** Tests must prove it |
| Persistence | `db/models.py::ScanRow.requested_metrics` (JSON, already per scan), `TrialRow` | Pinning comes for free; profile snapshot needs a column |
| Sample data | `services/demo.py`, `data/demo_fixture.json`, `data/demo_repeat.json` | Sample mode needs a labelled, recorded-shape sample label |
| Focus picker | `frontend/src/app/results/results-view.tsx::GoalPicker` (`rank`) | Where annotations and user priority appear |
| Wording | `frontend/src/lib/format.ts`, `frontend/src/lib/types.ts` | All copy and types |
| Consent and privacy | `frontend/src/app/scan/scan-flow.tsx::Consent`, `frontend/src/app/privacy/page.tsx` | New data category must be disclosed |
| Assistant | `services/assistant/explanations.py` (registry of approved topics) | **Leave untouched in v1** so the owner-only Gemini path and quick questions are unaffected |

### 1.4 Existing facts that shape the design

- **No image retention** [repo `services/imaging.py`, `privacy/page.tsx`]: bytes live only in the job's memory. A
  later "profile-only" analysis cannot reuse the baseline photo from our server; the browser's session-storage copy
  exists only for mask overlay. So any AI label must come from **the same request as the baseline scan**.
- **`detectability()` already exists** [repo `domain/compare.py`]: a focus near 100 cannot show an improvement.
  The live owner check had oil balance at 99 (`15` §5). This is the strongest, already-honest input for "which
  concern should I test".
- **`ScanRow.requested_metrics` is stored per scan**: pinning a trial's action set needs no new column.
- **Prior decision** (`15` §9, `05` D1/D5): Skin Tone and Face Analyzer *gates* were rejected as untested and
  unpriced. This research prices and tests them on paper; the conclusion stands (§2.2–2.3, `17`).

---

## 2. Phase B — YouCam capabilities

### 2.1 Skin Analysis `skin_type` / `hd_skin_type`

| Item | Finding | Source |
|---|---|---|
| What it is | `dst_action` `skin_type` (SD) / `hd_skin_type` (HD): "Subcategories[whole, t_zone, u_zone] … Evaluates skin type of Normal, Oily, Dry, Combination, Redness, Dry & Redness, Oily & Redness, Combination & Redness" | [doc] [AI Skin Analysis](https://docs.perfectcorp.com/reference/ai_skin_analysis.md) |
| Classes | 8 strings above (doc typo "Evalutate" in HD) | [doc] |
| JSON shape | Three entries per scan: `{"type":"skin_type","region":"whole"\|"t_zone"\|"u_zone","skin_type":"Oily","mask_urls":[…],"url":null}`. No `ui_score`, `raw_score` or confidence | **[3p-live]** recorded 2026-07-18 ([aloud fixture](https://github.com/StephenSook/aloud/blob/main/tests/fixtures/youcam/skin-type-success.json)) and 2026-10-02 ([unstack notes](https://github.com/Bowen1314/unstack/blob/main/docs/API_NOTES.md), `fixtures/recorded/skin-analysis-sd.json`). **The official docs show no example**; the GET schema only names `region` and `type` example `hd_skin_type` ([doc GET schema](https://docs.perfectcorp.com/reference/ai_skin_analysis/v2.0/paths/~1s2s~1v2.0~1task~1skin-analysis~1{task_id}/get.md)) |
| Whole vs zones | Not documented. Recorded examples: whole **Oily**, T-zone **Normal**, U-zone **Oily** (aloud); all three **Oily** (unstack). Whole is therefore not a simple combination of the zones | [3p-live]; meaning **[unresolved]** — ask YouCam support |
| Confidence / quality metadata | None documented or observed. Quality appears only as task error codes | [doc] |
| Same task? | Yes, add to `dst_actions` of the existing call. SD and HD cannot be mixed ("cannot mix HD and SD dst_actions") | [doc] |
| SD vs HD | HD needs ≥1080 px short side and costs 16 for 5–8 / 20 for 9–12 concerns; SD needs ≥480 px. No documented behavioural difference in the label | [doc] |
| Image | jpg/jpeg/png, <10 MB, short side ≥480 (SD), long side auto-resized at 2560, face >60% of width, portrait preferred; "Remove makeup", remove glasses, reveal forehead, even bright light, front-facing neutral expression | [doc] |
| Price | SD 1–4: 9 · 5–8: 12 · 9–12: 14 · 13–16: 16 units; failed tasks are not billed | [doc]; ProofLoop verified 8 actions = 12 live (`docs/youcam-integration.md`) |
| **Does `skin_type` count as a concern for the tier?** | **[unresolved].** Docs are silent. unstack's 16-action call (15 concerns + `skin_type`) cost 16, which lands in the 13–16 tier under either reading, so it settles nothing. Our 8 → 9 is exactly the boundary: **12 or 14 units** | Verify with one paired live call (`20` §1.3) or a support ticket (free) |
| Does adding it change the other 8 scores? | **[unresolved].** Identical bytes gave identical scores in our 2026-10-11 study, so a paired call on identical bytes (8 vs 9 actions) is a clean test | `20` §1.3 |
| Polling / errors / retry | Same task lifecycle the client already implements (`running`/`success`/`error`, 24 h result retention, units only on success) | [doc], [repo `client.py`] |
| Stability across captures | **No data anywhere.** Not documented, not in any repo found | [unresolved]; ProofLoop's instrument check is a natural free-of-extra-calls measurement (`17`) |
| Validation across skin tones | None published | [doc] |

**Conflict to design for [inference]:** the label vocabulary includes "Redness"/"Oily" while ProofLoop's own scores
can say the opposite (oil balance 99 = little visible shine in `15` §5). Nothing documents how the label relates to
the `oiliness` or `redness` scores.

### 2.2 AI Fitzpatrick Skin Type Analysis

| Item | Finding | Source |
|---|---|---|
| Endpoint | `POST /s2s/v2.0/task/fitzpatrick-scale-analyzer` `{src_file_id \| src_file_url, "version":"1.0", "index"?:0}`; poll `GET …/{task_id}`; optional multi-face `…/pre-process` | [doc] [Fitzpatrick](https://docs.perfectcorp.com/reference/description/ai_fitzpatrick_skin_type.md); [vendor-repo] `lhm.plugin.json` tools `AI-Fitzpatrick-Skin-Type-Analysis(-Detection)` in [beauty-skin-care-MCP](https://github.com/YouCam-API/beauty-skin-care-MCP) |
| Output | `results: {"timed": 2325, "fitzpatrick_scale": "I"}`: one Roman-numeral string, **no confidence** | [3p-live] unstack `fixtures/recorded/fitzpatrick.json` (2026-10-03). The doc gives no schema; the MCP output schema is untyped |
| Classes | I–VI. The doc's table lists "Type V" twice and omits IV | [doc] |
| How derived | "computer vision and machine learning … based on UV response modeling". No inputs, features or validation described | [doc] |
| Image | **jpg/jpeg only**, short side ≥320, long ≤4096, <10 MB; errors include `error_face_angle_invalid`, `error_insufficient_lighting` | [doc] |
| Cost | **10 units**; [3p-live] balance delta 26 = 16 (SD ×16) + 10 | [doc], unstack `balance-delta.json` |
| Distinct from `skin_type`? | Yes: a different endpoint and construct (phototype, not oil/dryness) | [doc] |
| Without another upload? | Accepts `src_file_id`. Whether a file registered under our feature-scoped path `/s2s/v2.0/file/skin-analysis` can be reused for another feature is **[unresolved]** (files are kept 30 days, per [doc] [file retention](https://docs.perfectcorp.com/develop/file_retention_period.md)). Reuse would also mean keeping a reference to the user's photo on YouCam's side for a second purpose, which needs consent |
| Diversity / calibration evidence | **None provided** | [doc] |

**Science check (§3):** an image-predicted phototype is not a measured sunburn response. The scale was built for
UV dosing, and self-report and race are weak predictors of it.

### 2.3 AI Facial Color Tones Analyzer

| Item | Finding | Source |
|---|---|---|
| Endpoint | `POST /s2s/v2.0/task/skin-tone-analysis` (+ `GET`); optional `face_angle_strictness_level` strict/high(default)/medium/low/flexible with documented pitch/yaw/roll limits | [doc] [Face tone analyzer](https://docs.perfectcorp.com/reference/description/ai_face_tone_analyzer.md); [vendor-repo] skills `facial-consultant/scripts/api-fallback.yaml` |
| Output | `results.color: {skin_color, eye_color, eye_color_name, lip_color, eyebrow_color, hair_color, hair_color_name}`: hex values plus named eye/hair colours. **No undertone, no confidence** | [doc] |
| Cost | **20 units**; failed tasks not billed; a task that times out with no polling is billed | [doc] |
| Use for ProofLoop | Aesthetic colour matching (shade finding). Not a skin-tracking measure. A possible comparability signal (skin hex shift between photos) is undermined by cross-device colour error: in a 2025 preprint, uncorrected phones averaged ΔE 6.99 against a DSLR and ITA had poor inter-device agreement ([Kang, arXiv 2512.21988](https://arxiv.org/abs/2512.21988), **[preprint]**) | — |
| Conflict | Aloud's notes claim a parallel tone call "does not add" to the 12-unit capture cost, which contradicts the documented 20 units. Likely a failed or unbilled call; **[unresolved]**, irrelevant once rejected | [3p-live] [aloud FACTS](https://github.com/StephenSook/aloud/blob/main/docs/FACTS.md) |

### 2.4 Skin Simulation

Already integrated (4 units). The "target picture" and "what ±band looks like" uses were rejected on honesty
grounds (`05` D3/D4); nothing here changes that.

### 2.5 Official YouCam repositories

| Repo | Last push | Licence | Relevance |
|---|---|---|---|
| [YouCam-API/skills](https://github.com/YouCam-API/skills) | 2026-10-14 (v1.1.1) | none declared in API metadata (README calls them installable skills) | Confirms `skin_type`/`hd_skin_type` as the 16th action; interprets it as "skin category (oily / dry / combination / normal, as returned)". No response fixtures. **Do not copy code** (no licence file detected) |
| [YouCam-API/beauty-skin-care-MCP](https://github.com/YouCam-API/beauty-skin-care-MCP) | — | MIT | `lhm.plugin.json` (v1.0.1) holds request schemas for Fitzpatrick, tone and skin analysis, plus a free `Get-Feature-Cost` tool. Its README says it "classifies Fitzpatrick skin type" alongside skincare scores |

The free `GET /s2s/v2.0/credit/feature-cost` endpoint lists per-SKU prices (unstack verified it matches the doc
tables), but it is priced by tier, so it cannot answer the "does `skin_type` count" question.

### 2.6 One offline check run during research (0 units, no network)

Could a single 9-action call be compared with the stored 2026-10-11 probe scores instead of a paired call? We rebuilt
probe variant `A_face75` from `test-face.jpg` with `scripts/youcam_live_probe.py::crop_variant` and
`prepare_image` (Pillow 11.0.0): 720×961 and deterministic across runs, but mean luminance **85.0 vs 85.6 recorded**.
Byte identity with the probe image cannot be shown, so **the verification must be a paired call on the same new
bytes** (`20` §1.3).

---

## 3. Phase C — science and limits

### 3.1 Findings that bind the design

| # | Finding | Source | Design consequence |
|---|---|---|---|
| S1 | Oily/normal/dry/combination have historically been judged subjectively. Combination skin is common but the least well defined. Sebum differs by region (forehead, nose and chin above the cheeks) and peaks in **summer**, with the largest seasonal change in the T- and U-zones | [paper] Youn et al., *Skin Res Technol* 2005;11(3):189–195, [doi 10.1111/j.1600-0846.2005.00119.x](https://doi.org/10.1111/j.1600-0846.2005.00119.x) | A type label is a **season-dependent snapshot**. Never present it as a stable trait; always show the date and the zones |
| S2 | Self-described oily vs dry tracked measured sebum (1.6–2.1×) but **not** hydration in 62 Thai women. A Korean sample underestimated its own sebum | [paper] [PubMed 31562649](https://pubmed.ncbi.nlm.nih.gov/31562649/) (*Skin Res Technol* 2020); Korean study via [JCDSA 2014](https://doi.org/10.4236/jcdsa.2014.42012) (secondary) | Self-report and camera label can legitimately disagree. Show both and let the user decide; neither is ground truth |
| S3 | **Sensitive skin** is a syndrome of unpleasant *sensations* (stinging, burning, itch) to normally harmless stimuli, not explained by a skin disease; **the skin may look normal or red** | [paper] Misery et al., IFSI consensus, *Acta Derm Venereol* 2017;97(1):4–6, [doi 10.2340/00015555-2397](https://medicaljournals.se/acta/content/html/10.2340/00015555-2397) | A photo cannot detect sensitivity. YouCam's "Redness" classes **must not** be relabelled "sensitive". Sensitivity is **self-report only** |
| S4 | Fitzpatrick typing was devised to dose UV (PUVA) therapy, from self-reported burning and tanning | [paper] Fitzpatrick, *Arch Dermatol* 1988;124(6):869–871, PMID 3377516 | It describes sun *reactivity*, not complexion |
| S5 | Clinicians commonly misuse FST to describe skin colour and ethnicity; providers should not conflate race/ethnicity with FST | [paper] Ware et al., *Cutis* 2020;105(2):77–80 ([MDedge](https://www.mdedge.com/dermatology/article/216697/pigmentation-disorders/racial-limitations-fitzpatrick-skin-type/page/0/1)) | Never derive or display ethnicity; never treat phototype as tone |
| S6 | Race and pigmentary traits are significant but **weak** predictors of self-reported FST (n = 3,386; weighted κ = 0.53) | [paper] He et al., *JAAD* 2014, [doi 10.1016/j.jaad.2014.05.023](https://doi.org/10.1016/j.jaad.2014.05.023) | Appearance does not reliably give sun sensitivity, so an image-predicted phototype cannot be read as burn risk |
| S7 | Calls to replace FST for equity reasons | [paper] Okoji, Taylor, Lipoff, *Br J Dermatol* 2021;185(1):198–199, [doi 10.1111/bjd.19932](https://doi.org/10.1111/bjd.19932) (full text not read) | Do not build product logic on FST |
| S8 | Self-report accuracy of FST studied directly (full text not read) | [paper] Eilers et al., *JAMA Dermatol* 2013;149(11):1289–94, PMID 24048361 | Listed for completeness; not relied on |
| S9 | ITA-derived FST labels on images correlated **less** with dermatologists than dermatologists did with each other | [paper] Groh et al., *Proc ACM HCI* 6 (CSCW) 2022, [arXiv 2207.02942](https://arxiv.org/abs/2207.02942) | Image-to-type conversions are not reliable labels |
| S10 | Dermatology AI performance fell on darker skin tones and uncommon diseases (DDI dataset); fine-tuning on diverse data closed the gap | [paper] Daneshjou et al., *Sci Adv* 2022, [PubMed 35960806](https://pubmed.ncbi.nlm.nih.gov/35960806/) | Absent vendor evidence, assume a possible performance gap by tone. Make no fairness claim |
| S11 | Phone colour is far from reference without calibration; ITA disagrees across devices | [preprint] Kang 2025, [arXiv 2512.21988](https://arxiv.org/abs/2512.21988) | Colour/tone outputs are a poor tracking or comparability signal |
| S12 | Rigorous selfie-grading validation **is** possible: L'Oréal-affiliated studies graded facial signs against dermatologists in 1,140 women of three ethnic groups and in a 1,041-woman US cohort | [paper] Flament et al., *Int J Cosmet Sci* 2019;41(1):67–78 ([PubMed 30664236](https://pubmed.ncbi.nlm.nih.gov/30664236/)) | Shows what YouCam has **not** published for `skin_type`; ProofLoop must not imply equivalent validation |
| S13 | "Everyone" should use sunscreen (SPF 30+, broad spectrum); "Anyone can get skin cancer, regardless of … skin tone" | [paper/professional] AAD [Sunscreen FAQs](https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/sunscreen-faqs) (updated 2025-02-11) | Any phototype-based "you need less protection" logic would contradict the professional body. Do not personalise sun advice |
| S14 | A validated multi-dimensional self-report exists (Baumann Skin Type Indicator, 64 items). Translations show acceptable reliability but mixed construct validity; **no outcome evidence** that type-guided product choice improves skin | [paper] Polish validation ([Postępy Derm Alergol](https://www.termedia.pl/Baumann-Skin-Type-Questionnaire-BSTQ-creation-and-validation-of-the-Polish-language-version-part-one,7,55953,0,1.html)); Indonesian 2026 (abstract) | Personalising product *efficacy* by type has no evidence base. Personalising **what to measure and how to explain it** needs none |
| S15 | US FDA General Wellness guidance was revised 2026-01-06. Claims to diagnose, treat or prevent a condition move a product out of the low-risk wellness category | [doc] [CRS summary](https://www.everycrsreport.com/reports/IN12657.html); [Troutman](https://troutman.com/insights/fdas-2026-guidance-on-general-wellness-devices-policy-for-low-risk-devices) | Cosmetic, appearance-only language; no condition names (acne vulgaris, rosacea, dermatitis) as outputs. **Not legal advice** |

### 3.2 Direct answers to Phase C questions

1. **Types differ in basis.** Oily/dry/normal/combination are appearance/sebum descriptors (S1, S2). Sensitive is a
   sensory syndrome (S3). Fitzpatrick is UV reactivity (S4). Colour/tone is reflectance (S11).
2. **Appearance typing ≠ phototype ≠ tone.** Different constructs; the evidence warns specifically against
   substituting one for another (S5–S7, S9).
3. **Can a selfie establish them?** Oily/dry appearance: plausibly as a *snapshot* (S2 partially supports
   self-report vs sebum, but the camera label is unvalidated). Sensitivity: **no** (S3). Phototype: **no** as
   sun-reactivity (S4, S6). Tone: only as an uncalibrated colour reading (S11).
4. **Confounders** documented by YouCam: makeup, glasses, hair, lighting, pose [doc]. In the literature: season and
   region (S1), device colour (S11). [inference]: recent washing, blotting, exercise flush, heat and alcohol could
   shift shine and redness labels in a single capture; **no study found** that quantifies this for YouCam.
5. **Tone fairness:** unknown for YouCam. The general dermatology-AI evidence shows real gaps (S10). Make no claim.
6. **Phototype → sunburn:** not supportable from an image (S4, S6, S13).
7. **Cosmetic vs medical:** keep appearance-only wording, with no condition names or treatment advice (S15).
8. **Evidence for personalisation:** for choosing *products* by type, none (S14). For choosing *what to measure*,
   the argument is measurement logic (ceiling/detectability), which ProofLoop already computes, not dermatology.
9. **Recommendations needing evidence we lack:** ingredient suggestions by type; "suitable for your skin type"
   product filters; sun or SPF advice by phototype; predicting results from type; anything about sensitivity from a
   photo; patch-test guidance (the AAD page could not be retrieved, so it is **[unresolved]**).

### 3.3 What ProofLoop must not claim (derived from §3.1)

- That a skin-type label is a diagnosis, a stable trait, or "your skin type" without date, zones and source.
- That "Redness" means sensitive skin, rosacea or irritation (S3).
- Anything about ethnicity, race or heritage, or tone as a proxy for them (S5).
- Sun sensitivity or protection needs from a photo (S4, S6, S13).
- That a product suits, or works for, a skin type (S14).
- That a change in label between scans was caused by the product.
- That the AI label is validated or fair across skin tones (S10, S12).

### 3.4 Conflicts and gaps in the evidence

- S2's self-report studies are small and regional. No large study gives κ for self-report vs instrument.
- The FST critiques (S5, S7) are commentary and surveys; the full texts of S7 and S8 were not read.
- No published study measures **YouCam's** `skin_type` accuracy, stability or tone fairness.
- S11 is a preprint.

---

## 4. Phase D — algorithms, repositories, dependencies

**Conclusion: no new runtime dependency is needed.** Everything required exists in the current stack (FastAPI,
Pydantic, SQLAlchemy/Alembic, Pillow; Next.js/React).

| Need | Option | Verdict | Reason |
|---|---|---|---|
| Parse `skin_type` entries | Extend `SkinOutput` with `region`, `skin_type`; new pure function `domain/profile.py::parse_skin_type` | **Use** | Same pattern as `normalize.py`; a `Literal` of the 8 documented classes; an unknown string becomes `unrecognised` and is never coerced |
| Rules engine | `venmo/business-rules` (MIT, last push 2024-08); JSON-logic libraries | **Reject** | A rules DSL adds indirection for about six rules. Plain dataclasses plus a lexicographic key, as in `domain/recommend.py`, are more inspectable and testable |
| Photo-quality checks | Pillow (already used) for luminance; a Laplacian-variance blur score through `ImageFilter.FIND_EDGES` + `ImageStat` costs 0 deps | **Defer** | Useful for all scans, not specific to profiles; needs its own threshold study |
| Pose / face angle | `google-ai-edge/mediapipe` (Apache-2.0, v1.1.1 2026-10-14, active) in the browser | **Defer** | Already considered as B4/D5. Phone performance and bundle size risk this close to the deadline |
| Pose via YouCam | Facial Color Tones `face_angle_strictness_level` | **Reject** | 20 units per call just to check pose |
| Colour calibration | OpenCV (`opencv-python`, MIT, active) | **Reject** | Only needed for tone work, which is rejected |
| Fixtures without spending units | Synthetic fixtures in the [3p-live] recorded shape, written by us (facts are not copyrightable; no code copied) | **Use** | Mark them `synthetic: true`, plus one **real** fixture after the paired verification call |
| YouCam SDK | No official Python SDK. The skills repo has a CLI helper (`youcam_core.py`) without a declared licence | **Don't use** | Our client already covers the lifecycle, retries and double-billing rules |

**Prioritising concerns without a universal score:** reuse `detectability()` (ceiling logic) and
`band_evidence()` (measured vs assumed band), add the user's stated priority, and order lexicographically with
the key shown in the UI. This mirrors `recommend.py`'s `RANKING_EXPLANATION`. Specified in the design spec §5.

---

## 5. Sources consulted

Official: [AI Skin Analysis](https://docs.perfectcorp.com/reference/ai_skin_analysis.md) ·
[Skin Analysis GET schema](https://docs.perfectcorp.com/reference/ai_skin_analysis/v2.0/paths/~1s2s~1v2.0~1task~1skin-analysis~1{task_id}/get.md) ·
[Fitzpatrick](https://docs.perfectcorp.com/reference/description/ai_fitzpatrick_skin_type.md) ·
[Facial Color Tones](https://docs.perfectcorp.com/reference/description/ai_face_tone_analyzer.md) ·
[File retention](https://docs.perfectcorp.com/develop/file_retention_period.md) ·
[docs index](https://docs.perfectcorp.com/llms.txt) ·
[legacy v1.9 reference](https://d3anovxlgi5hpq.cloudfront.net/document/index.html) (deprecated; last modified 2026-03-31) ·
[YouCam-API/skills](https://github.com/YouCam-API/skills) ·
[YouCam-API/beauty-skin-care-MCP](https://github.com/YouCam-API/beauty-skin-care-MCP).
Third-party live recordings (MIT): [StephenSook/aloud](https://github.com/StephenSook/aloud) ·
[Bowen1314/unstack](https://github.com/Bowen1314/unstack) ·
[DevDaring/YouCam_Hackathon](https://github.com/DevDaring/YouCam_Hackathon).
Papers and professional bodies: as linked in §3.1.
