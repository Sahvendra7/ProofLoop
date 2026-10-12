# ADR-006: Demo mode is an explicit, separate provenance

**Decision.** Sample data is created only by an explicit user action (`POST /scans/demo`), replays a recorded live YouCam response through the same normaliser, and is stored with `provenance="demo"`. Synthetic follow-ups exist only for demo trials and are flagged `synthetic_timeline`. Live trials refuse demo check-ins and vice versa. When the provider is unconfigured or fails, live scans fail visibly.

**Context.** The MVP's `DEMO_MODE=true` silently replaced every real scan with fixed numbers and mixed the fabricated "Day 21" into the same tables.

**Why.** Judges need a reliable demo path, and users must never mistake a fixture for a measurement.

**Trade-offs.** Two code paths for creating scans; demo trials can't show a simulation preview (no photo).

**Revisit when.** Never relax the separation; extend the fixtures if more demo scenarios are needed.
