# Demo script (≈2:40)

Record on a phone-width browser or a real phone. Every on-screen claim below is true of the current build.
Before recording: confirm the backend shows `provider_configured: true` at `/health`, and that the credit
balance covers ~30 units (one baseline, one preview, one check-in). Rehearse with **Try with sample data** —
it needs no network access to YouCam and is the fallback if the live API is slow.

| Time | Screen | Say (paraphrase freely) |
|---|---|---|
| 0:00 | Landing hero | "Three weeks into a new serum, you look in the mirror and ask: is it working? The mirror is a bad instrument — different light every morning. ProofLoop runs a fair test." |
| 0:12 | Scan → consent | "Consent comes first, in plain words: one photo, metadata stripped, scores kept, photo not stored." |
| 0:20 | Framing oval | "YouCam rejects photos where the face is under 60% of the width, so we frame first." *(Optional: show the rejected under-framed photo and the specific fix-it message — it costs 0 units.)* |
| 0:30 | Measuring stages | "These steps are live from our server: register the file, upload to YouCam's presigned URL, then `POST /s2s/v2.0/task/skin-analysis` with eight concerns. About eight seconds, twelve units." |
| 0:42 | Snapshot | "Scores 1–100, higher looks better — YouCam's own semantics. The summary is generated from the numbers. This heatmap is YouCam's detection mask over my photo." |
| 0:58 | Pick a focus | "One focus, tied to one score, so the test is fair. Ordered from my lowest score." |
| 1:05 | Matches | "No mystery percentages. A tier from explicit rules and every reason listed — including cautions from my own scores. Filters change the inputs, and anything set aside says why. Sample catalogue, clearly labelled." |
| 1:22 | Product → preview | "Facts from the catalogue on one side, match logic from my scan on the other. This preview is YouCam AI Skin Simulation — what the goal looks like, not what the product will do." |
| 1:38 | Start trial | "This scan is my baseline." |
| 1:42 | Landing "measured the measurement" section | "Before calling a change, we ran the live API ten times on one face. Same photo: identical scores. Reframed or darker: under 2 points. Re-encoded in the browser: pores moved 5. So ProofLoop only calls a change beyond ±3 to ±7 points, depending on the concern." |
| 1:58 | Sample-data trial → synthetic follow-up | "I can't wait three weeks on camera, so this is a **sample** trial with a **synthetic** follow-up — labelled on every screen. Hydration +8: beyond its ±5 band, a measured change. Texture +5: inside its band, so not a change. Blemishes −5: a measured decline. And it never says the product caused it." |
| 2:20 | Live trial check-in | "On a real trial, the check-in is a real scan. Same day, same photo: 'No clear change yet' — and a note that a week hasn't passed." |
| 2:30 | My trials → Delete all my data | "Everything is deletable instantly. ProofLoop turns YouCam's measurement into a feedback loop for shopping — and tells you the truth when the answer is 'not yet'." |

Do not: claim clinical accuracy, show the synthetic follow-up without saying "synthetic", or describe the
product images as real products.
