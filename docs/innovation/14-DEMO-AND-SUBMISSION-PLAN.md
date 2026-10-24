# 14 — Demo and submission plan

## The one memorable proof moment

**"Same face, sixty seconds apart, nothing changed: my hydration score moved N points."**

Whatever N turns out to be on the owner's own face is the headline (T5 in 02), and **it must be real**.

- If N is larger than the band, the plan card visibly widens (lines move out). That shows the mechanism changing
  the test.
- If N is within the band, the screen says "your band stays ±5". That is still proof the band was checked on a
  real face, and it's honest.

Either outcome works. No fixture may stand in for the live moment. The sample repeat, labelled "Recorded,
not simulated", is the fallback and is said aloud as a sample.

Live cost of the full live story: baseline 12 + instrument check 12 (+ optional goal preview 4) = **24–28
units**, from 388 deployment / 840 account. **Needs the owner's go-ahead before recording.**

## Script (target 2:40, hard cap 3:00) — revised after the winner-video audit (01, 02 T9–T12)

| Time | Screen | Say | Proof shown | Pattern |
|---|---|---|---|---|
| 0:00 | Title card over the instrument-check table from the presenter's own face: two scans, one minute apart | "Same face. Same minute. Nothing changed. My score moved *N* points." | The thesis in one image | T9, T5 |
| 0:06 | Hero | "So when a serum's score goes up three points, is it working? Every skin app measures your skin. ProofLoop measures the measurement first." | User + decision | T12 |
| 0:15 | One sourced card | "Even device makers admit selfie scores move with light, distance and angle (Philips support). Nobody tells you by how much." | Problem is real, cited | T10 (only claims we can source) |
| 0:25 | Consent → framing → measuring stages | "One photo, metadata stripped, never stored." | Privacy | — |
| 0:35 | **Endpoint card** (10 s): `POST /s2s/v2.0/file/skin-analysis` → presigned `PUT` → `POST …/task/skin-analysis` (8 SD concerns, 12 units) → `GET …/{task_id}` | "This is YouCam's AI Skin Analysis API, called server-side. The key never leaves the server." | **Genuine YouCam** (rules: explain the API) | T11 |
| 0:45 | Results → focus | "Before I start, it tells me what would count: 75 or higher. Redness is at 99: it can't show a gain, so it's flagged." | Detectability | — |
| 1:00 | Matches → product → Skin Simulation preview | "Every match reason listed. The preview is YouCam Skin Simulation: a look, not a promise." | Commerce + second API | — |
| 1:12 | Trial → plan card | "The plan is fixed now: the lines, the band, day 28." | Pre-registration | — |
| 1:20 | **Instrument check, live** (button shows "12 units") | "That band came from one stock photo. So I take a second photo now…" → result | **The moment**, shown on a real phone | T1, T7 |
| 1:50 | Plan card | Widened: "My lines moved out. It can only make the test stricter, and it's sealed at my first check-in." / Kept: "My band held: checked on my face, not assumed." | Widen-only, sealing | T2, T4 |
| 2:02 | Check-in → capture match (free) | "Before a check-in spends anything: matching light? And it refuses my baseline photo outright, because the same photo always scores the same." | Free gates, units visible | T3, T7 |
| 2:15 | Sample trial → synthetic follow-up *(say "synthetic")* → next step | "This is a sample with a synthetic follow-up. Early look: finish the test before deciding. After 28 days with no change, it points me to other matches for the same goal." | Verdict → decision | T6, T8 |
| 2:35 | Limits line → closing card with QR to the live app and the repo | "Not medical, no causation, a lower bound on noise. ProofLoop: is it working? Run a fair test." | Honesty + access | T12 |

Rules: say "synthetic" and "sample" aloud whenever they're on screen, and keep captions burned in (Aloud does;
a judge may watch without sound). Show the phone the app is built for. **No real brand labels on screen**: 1st place showed
one, but the rules restrict trademarks. ProofLoop's catalogue is fictional; keep it that way. No unlicensed music.
Unlike KeepMe's fixture-only demo, ProofLoop's live YouCam call **must appear on screen** (0:35 and 1:20).

## Submission checklist (owner actions marked ⚑)

| Item | Status |
|---|---|
| ⚑ Approve live unit spend for recording (24–28 units) | pending |
| ⚑ Real-phone camera test (instrument check through the camera, not upload) | not done |
| ⚑ Record and upload the video publicly (YouTube preferred) | not done |
| ⚑ Repository access: make it public with a licence, or share it with `contact_event@PerfectCorp.com` | not done |
| Text description: update `docs/submission-copy.md` with the instrument check | to do after approval of this pass |
| ⚑ Deploy this pass (migration 0003 → Render first, then Vercel; see `proofloop-deployment-state` ordering) | **requires authorization** |
| ⚑ Optional: Social Sharing Bonus (+500 units per platform) | owner's choice |
| ⚑ Submit on Devpost before **Nov 2, 11:45 am ET** | not done |
