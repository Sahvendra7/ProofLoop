# 04 — Competitor and repository map (2026-10-25)

Extends `solution-landscape.md` (2026-10-19), which covers Neutrogena Skin360, Glow Mind AI, Sharp, Claro,
MySkin Data/SpotTrack and journaling apps. App-store listings are self-descriptions. Unless marked, nothing
here was installed or run.

## Search strategy

Two targeted web searches (2026-10-25): progress-tracking skincare apps with repeatability or consistency
claims, and apps that answer "is my skincare working". Plus GitHub API metadata for the named repositories.
**Not done:** installing apps, paid market reports, Reddit sentiment mining.

## Direct and adjacent products

| Product | Category | What it does (per listing) | States per-user variation? | Source |
|---|---|---|---|---|
| Skinlapse: AI Skin Coach | Direct | Weekly re-scans, on-device "Clarity Score", before/after timeline; recommends product *types* | No | [App Store](https://apps.apple.com/py/app/id6785582868) |
| Ara – AI Skincare Coach | Direct | Skin Score over time, scan-over-scan charts; medical disclaimer; subscription | No | [Google Play](https://play.google.com/store/apps/details?id=kr.ara) |
| SkinAI: Skin Scanner | Direct | 0–100 score, focus area, side-by-side before/after, "per-metric improvements" | No | [App Store](https://apps.apple.com/app/id6760270869) |
| USkin – Face Scanner | Adjacent | 6 metrics; scan a product to see if it "matches your skin" | No | [mwm.ai](https://mwm.ai/apps/uskin-face-scanner/6778808846) |
| SkinMax | Adjacent | Week-by-week tracking, skin age | No | [mwm.ai](https://mwm.ai/apps/skinmax-ai-face-scanner/6758164262) |
| Philips Lumea skin selfie analyser | Adjacent (device app) | Support article concedes scores can be inconsistent; blames light, distance and angle; advises matching them | Acknowledges the problem, offers no measurement | [Philips support](https://www.philips.co.uk/c-f/XC000021434/why-does-the-philips-lumea-skin-selfie-analyser-show-inconsistent-results) |
| Perfect Corp AI Skin Analysis (B2B) | Platform | Marketing claims "95% test-retest reliability", study unnamed | Population-level claim only | [Perfect Corp blog](https://www.perfectcorp.com/business/blog/ai-skincare/ai-skin-analysis-ecommerce-beauty-brands) |

**Finding (INFERENCE from listings):** every scoring tracker found compares scores over time. None of the ten
listings across both passes states how much a score moves on unchanged skin, measures that per user, or refuses
to call a change. One vendor (Philips) publicly acknowledges the problem.
**Caveat:** a listing can omit a feature the app has. This is "not advertised", not "absent".

## Open-source repositories

| Repo | Last push | Licence | Mechanism (read 10-19) | Lesson |
|---|---|---|---|---|
| [Shubh3005/SkinIQ](https://github.com/Shubh3005/SkinIQ) | 2026-07-23 | none → not reusable | `ScanComparison.tsx`: improved / worsened / same by direct comparison | The gap in code: any difference is a change |
| [DurtyDhiana/skin-scan](https://github.com/DurtyDhiana/skin-scan) | 2025-10-27 | MIT | Local OpenCV heuristics | Would replace YouCam with unvalidated measures |
| [jenniiiiiii007S/skincare-recommendation-system](https://github.com/jenniiiiiii007S/skincare-recommendation-system) | 2026-05-13 | none | Gemini + ChromaDB routine builder | LLM routine without measurement |
| [StephenSook/aloud](https://github.com/StephenSook/aloud) | 2026-09-05 | MIT | See 01 | Instrument honesty |
| [Abhinav0905/shadespan](https://github.com/Abhinav0905/shadespan) | 2026-08-17 | Apache-2.0 | See 01 | Instrument audit |
| [ankitlade12/keepme](https://github.com/ankitlade12/keepme) | 2026-08-17 | MIT | See 01 | Inconclusive gate |

## Current hackathon field

Gallery unpublished on 2026-10-25 (00). **Nothing is claimed about current competitors.**

## Overlap map

| Mechanism | Consumer trackers | Previous winners | OSS | ProofLoop today | After this pass |
|---|---|---|---|---|---|
| Score over time | Everywhere | Aloud (one session) | SkinIQ | ✓ | ✓ |
| Says scans vary with capture (qualitative) | Philips support article | **Aloud**: "light or angle can shift them" on a second capture (video 2:00–2:08) | — | ✓ | ✓ |
| Variation band on the verdict | Not advertised | — | — | ✓ (one stock face) | ✓ |
| Pre-registered decision rule | — | — | — | ✓ | ✓ |
| Ceiling / detectability check | — | — | — | ✓ | ✓ |
| Comparability gate before spend | Advice only (Philips) | KeepMe (quality gate, not over time) | — | ✓ | ✓ + identical-photo refusal |
| **Repeatability measured on the user** | — | — | — | ✗ | **✓ instrument check** |
| **Verdict → next purchase decision** | Coaches give generic advice | Aloud routine | — | ✗ | **✓ next step** |
| Population-level validation | Vendor claims | — | — | ✗ | ✗ (out of reach; see 03) |

**Underserved gap (INFERENCE):** "how much does *my* score move when nothing changed?" Philips and Aloud (1st
place) both *acknowledge* that capture conditions move scores, so the problem is recognised. Neither they nor any
other product, winner or repository found gives a magnitude, a per-user measurement, or a decision rule.
