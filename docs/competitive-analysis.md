# Competitive analysis

Researched 2026-10-12. Sources inspected directly:

| Source | How inspected |
|---|---|
| Current challenge overview — youcam-api-skin-ai-ecommerce.devpost.com | In-app browser (WebFetch is blocked by Devpost with HTTP 403) |
| Current official rules — `/rules` | In-app browser, full text |
| Aloud (1st, previous hackathon) — devpost.com/software/aloud-lxqr70 | Devpost page + public repo `github.com/StephenSook/aloud` (cloned, `lib/youcam.ts`, `tests/fixtures/youcam/*`, `docs/FACTS.md` read) |
| ShadeSpan (2nd) — devpost.com/software/shadespan | Devpost page + public repo `github.com/abhinav0905/shadespan` (cloned, `src/shadespan/youcam/*` read) |
| KeepMe (3rd–5th) — devpost.com/software/keepme | Devpost page + public repo `github.com/ankitlade12/keepme` (cloned, `docs/architecture.md`, `docs/privacy.md`, `lib/youcam.ts` skimmed) |
| YouCam API docs — docs.perfectcorp.com (AI Skin Analysis, AI Skin Simulation, OpenAPI path pages) | `curl` of the published Markdown/OpenAPI pages |

Not inspected: the current challenge's project gallery (no public submissions were listed at the time of research), and any live deployment of the three winners (we did not exercise their apps).

Convention below: **Fact** = stated on the Devpost page or visible in the repository. **Analysis** = our interpretation.

---

## What the current challenge rewards

**Fact.** Four equally weighted criteria: Technological Implementation, Design, Potential Impact, Quality of the Idea. Ties break in that order, so Technological Implementation is the tie-breaker. Judges are not required to run the project and "may choose to judge based solely on the text description, images, and video". The demo video must be 1–3 minutes and must explain the YouCam API used. Submission closes Nov 2, 2026 11:45 ET.

**Fact.** The Skin AI brief: *"People don't wonder about their skin in the abstract; they wonder right before a purchase, right after a bad breakout, or right when they're standing in front of a mirror deciding whether a product is working."*

**Analysis.** The brief names ProofLoop's exact moment — *deciding whether a product is working* — almost verbatim. Because judges may only watch the video, the product's insight has to be visible in 3 minutes, and every claim in the video must be true of the code.

---

## Aloud — 1st place

| | |
|---|---|
| Target audience | Blind and low-vision shoppers buying skincare on a phone |
| Problem | Beauty e-commerce is built on images; shoppers using screen readers cannot independently learn what a product is or whether it suits them |
| Central insight | Skin AI should be *spoken*, grounded only in structured scores, and honest about its own accuracy limits for the person it affects most |
| Use of YouCam | Fact: server-side register → presigned PUT → `POST /s2s/v2.0/task/skin-analysis` with 7 SD concerns, `format: "json"` → poll. Also YouCam Skin Tone Analysis to lower confidence on deeper tones / low light, and the YouCam MCP server as an alternate engine |
| Architecture | Fact: Next.js on Vercel; one provider module (`lib/youcam.ts`); fixtures captured from real runs pin response shapes; a `FACTS.md` ledger requires every judged claim to cite a source and a code reference |
| UX strengths | Screen-off operation; sound-guided capture with a lighting gate and auto-capture; consent before the camera opens in plain words |
| Reliability / trust | Claim linter in CI blocks medical language; per-concern `ui_score` is the only source of spoken skin claims; measured unit cost (12 units per 7-concern capture) by reading the credit balance before and after |
| Demo strategy | One product, four flows, every flow shown working with the screen off |
| Differentiation | Specific, documented, underserved audience plus legal/regulatory retail motivation |
| What ProofLoop can learn | Ground every sentence in a returned field; capture real fixtures; measure unit cost instead of assuming it; disclose the instrument's own limits; keep a claims ledger |
| What not to copy | The accessibility audience, voice-first interaction, allergen tooling, the tone-bias caveat as a feature. These are Aloud's identity |

**Verified API facts we reuse (from Aloud's committed fixtures, captured live 2026-07-18):** with `format: "json"` the poll response carries `data.results.output[]` entries of the form `{type, ui_score, raw_score, mask_urls}` plus `{type:"all", score}`, `{type:"skin_age", score}` and a `resize_image` entry; task errors arrive as `task_status:"error"` with `error` as a stringified tuple `"('message', 'error_code')"`; failed tasks bill 0 units; a face at ~54% of image width was rejected with `error_src_face_too_small`.

## ShadeSpan — 2nd place

| | |
|---|---|
| Target audience | Merchandising teams at apparel brands (B2B) |
| Problem | Garments are photographed on one model; colours that wash out on some skin tones are only discovered months later through returns |
| Central insight | Point try-on at the *catalogue* instead of the shopper, and grade each garment on its **worst** skin tone, never the average |
| Use of YouCam | Fact: Apparel VTO (`/s2s/v2.0/task/cloth`) across a 14 × 6 grid; Skin AI on face crops |
| Architecture | Fact: async Python (httpx, pydantic, FastAPI, typer). "Every YouCam path and payload lives in exactly one file" (`youcam/endpoints.py`). Content-addressed render cache; a budget ledger checked before every call; offline mock mode |
| Scoring | Fact: published colour science only — WCAG contrast, CIEDE2000, a saturation bonus, and a categorical washout veto. "No model opinions anywhere in the score" |
| Evidence to user | Fact: renders shown next to grades; a render-fidelity check that publishes its own error rate (agrees with eye-checks on 10 of 14 cells) and is reported as a warning, never folded into the score |
| Differentiation | Non-obvious, opposite-end-of-funnel use of the same API, with an economic argument (one audit ≈ one shopper session in units) |
| What ProofLoop can learn | One-file provider boundary; budget ledger and real balance reads; explainable formulas; **report a measurement's error rate instead of hiding it**; worst-case framing that protects the user |
| What not to copy | B2B catalogue auditing, apparel VTO, colour-contrast scoring, the Fitzpatrick panel |

## KeepMe — 3rd–5th place

| | |
|---|---|
| Target audience | Apparel shoppers using AI try-on, and retailers deploying it |
| Problem | Generative try-on can silently change a shopper's glasses, face, hair, skin or body |
| Central insight | Consent should be specific enough for software to enforce: an "Identity Contract" of what may change, verified with evidence before approval |
| Use of YouCam | Fact: YouCam AI Clothes v3 (`/s2s/v2.0/task/cloth-v3`) end-to-end; Skin Analysis v2.1 as an extra consistency signal |
| Architecture | Fact: Next.js 16 + private FastAPI integrity worker (OpenCV/MediaPipe), Postgres, private blob storage, ClamAV, signed JWS receipts, OpenTelemetry, Vitest + Playwright + axe-core |
| Trust layer | Fact: states passed / needs review / failed / **inconclusive**; "a hard finding cannot be hidden behind an average score"; verified deletion of every artifact |
| Demo vs real | Fact: the guided glasses-removal scenario is "prominently labeled as a controlled synthetic fixture"; live mode is labelled as a YouCam result |
| What ProofLoop can learn | An explicit **inconclusive** state; label fixtures as fixtures in the UI and API; immediate user-initiated deletion; image hygiene (decode, strip metadata, re-encode) before provider use |
| What not to copy | Identity contracts, integrity receipts, signed JWS, the malware-scanner and private-blob infrastructure (overkill for ProofLoop's data, which is scores rather than images) |

---

## Cross-cutting lessons

1. **All three winners treat honesty as a feature, not a disclaimer.** Aloud lowers its confidence out loud; ShadeSpan publishes its fidelity check's error rate; KeepMe has an "inconclusive" state. A judge remembers a product that knows the limits of its own instrument.
2. **All three isolate the provider in one module and pin its shapes with fixtures.**
3. **None of them measures change over time.** Aloud compares bare skin to made-up skin within one session; ShadeSpan audits a catalogue once; KeepMe verifies one generation. The longitudinal question — *is this product working for me after three weeks?* — is open.
4. **All three file-register on a feature-scoped path** (`/s2s/{v}/file/{feature}`), while the official docs show `POST /s2s/v2.0/file`. ProofLoop makes the path configurable and verifies it live (see `docs/youcam-integration.md`).

## Where ProofLoop sits

Generic AI skincare recommenders end at "here are products for your skin type". Consumer beauty apps that track progress typically show a photo diary and leave the judgement to the user's eye, or show a score going up without saying whether the change is larger than the instrument's own scan-to-scan variation. ProofLoop's defensible space is the step nobody owns: **a fair test of whether a product is changing what the camera measures**, with an honest "within normal scan variation" and "not comparable" verdict. That is a measurement-integrity idea applied over time, which is distinct from all three winners' subjects while sharing their discipline.
