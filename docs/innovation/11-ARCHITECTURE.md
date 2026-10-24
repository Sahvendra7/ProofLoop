# 11 — Architecture (delta only)

No new services, dependencies, frameworks or paid APIs. The existing layers are kept:

```
Next.js (trial-view, scan-flow)  ──HTTP──▶  FastAPI routes (scans.py, trials.py)
                                              │  presenters.py  (rows → schemas)
                                              │  domain/compare.py  ◀── pure, unit-tested:
                                              │      personal_band(), instrument_check(), next_step()
                                              │  services/demo.py   (recorded sample repeat)
                                              │  services/imaging.py (prepare_image → digest)
                                              ▼
                                         SQLAlchemy models + Alembic 0003
                                              │
                                         YouCam client (unchanged; repeat = ordinary analysis task)
```

| Concern | Decision | Reason |
|---|---|---|
| Where the band rule lives | `domain/compare.py`, next to `detectability()` and `compare()` | One function feeds the protocol card, the lines and the verdict, so nothing interprets the band twice |
| Where the next step lives | `domain/compare.py::next_step()`, exposed on `ComparisonOut` | The frontend only maps an action to copy |
| Repeat ↔ trial link | `trials.repeat_scan_id`; the repeat scan keeps `trial_id = NULL` | Existing check-in queries (`trial_id = X`) stay correct without edits |
| Sealing | Written in the check-in creation path (live `POST /scans`, `demo-checkin`) | The only moment the protocol must freeze; no read-time writes |
| Async race | Checked in the request (`repeat_in_progress`, `protocol_sealed`) | Single-row state; the existing Postgres advisory lock already serialises budget reservation |
| Digest | Computed from `PreparedImage.data` in the route | The cleaned bytes are deterministic for the same upload |
| Sample repeat data | `app/data/demo_repeat.json` | Kept apart from the baseline fixture so its provenance note is specific |
