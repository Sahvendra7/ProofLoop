"""Sample-data mode.

The sample scan replays a recorded, sanitised YouCam response (app/data/demo_fixture.json)
through the same normaliser as live scans. No provider call is made. Demo scans and
trials carry provenance "demo" and are never compared with live ("youcam") records.

The demo follow-up is synthetic: fixed, mixed deltas dated 21 days after the
baseline so the verdict logic can be shown without waiting three weeks. It is
labelled as synthetic in the API and UI.
"""

from __future__ import annotations

import json
from datetime import timedelta
from functools import lru_cache
from pathlib import Path

from app.db.models import ReadingRow, ScanRow, utcnow
from app.domain.metrics import REQUESTED_PROVIDER_ACTIONS
from app.domain.normalize import normalize_outputs
from app.providers.youcam.models import AnalysisPollResponse

FIXTURE_PATH = Path(__file__).resolve().parents[1] / "data" / "demo_fixture.json"
REPEAT_PATH = Path(__file__).resolve().parents[1] / "data" / "demo_repeat.json"

# Deliberately mixed so the demo shows every verdict type, not a rosy story:
# moisture up beyond its measured band, radiance down beyond its measured band,
# texture/pore inside theirs, and acne -5 inside the conservative band that
# applies while acne's scan-to-scan variation is uncharacterised.
DEMO_FOLLOWUP_DELTAS = {
    "moisture": 8,
    "oiliness": 2,
    "redness": -1,
    "texture": 5,
    "pore": 0,
    "acne": -5,
    "radiance": -5,
    "dark_circle": 1,
}
DEMO_FOLLOWUP_DAYS = 21


@lru_cache
def load_fixture() -> dict:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def fixture_note() -> str:
    return load_fixture()["note"]


def build_demo_scan(session_id: str) -> ScanRow:
    fixture = load_fixture()
    parsed = AnalysisPollResponse.model_validate(fixture["response"])
    normalized = normalize_outputs(
        parsed.data.results.output if parsed.data.results else [], REQUESTED_PROVIDER_ACTIONS
    )
    now = utcnow()
    scan = ScanRow(
        session_id=session_id,
        provenance="demo",
        status="complete",
        stage="complete",
        source="sample",
        width=fixture["capture"]["width"],
        height=fixture["capture"]["height"],
        luminance_mean=fixture["capture"]["luminance_mean"],
        requested_metrics=json.dumps([m for m in REQUESTED_PROVIDER_ACTIONS]),
        missing_metrics=json.dumps(normalized.missing),
        units_estimated=0,
        observed_at=now,
        completed_at=now,
    )
    scan.readings = [
        ReadingRow(metric=r.metric, ui_score=r.ui_score, raw_score=r.raw_score, mask_url=None)
        for r in normalized.readings
    ]
    return scan


@lru_cache
def load_repeat() -> dict:
    return json.loads(REPEAT_PATH.read_text(encoding="utf-8"))


def repeat_note() -> str:
    return load_repeat()["note"]


def build_demo_repeat(baseline: ScanRow) -> ScanRow:
    """The sample instrument check: a recorded second analysis of the sample portrait.

    Scores are replayed as recorded, never adjusted. trial_id stays NULL: a repeat is
    linked from the trial (trials.repeat_scan_id) so it is never counted as a check-in.
    """
    now = utcnow()
    scores = load_repeat()["scores"]
    scan = ScanRow(
        session_id=baseline.session_id,
        provenance="demo",
        status="complete",
        stage="complete",
        source="sample",
        requested_metrics=baseline.requested_metrics,
        missing_metrics="[]",  # the recorded run returned all eight concerns
        units_estimated=0,
        observed_at=now,
        completed_at=now,
    )
    scan.readings = [ReadingRow(metric=k, ui_score=v, raw_score=None, mask_url=None) for k, v in scores.items()]
    return scan


def build_demo_followup(baseline: ScanRow, trial_id: str) -> ScanRow:
    now = utcnow()
    scan = ScanRow(
        session_id=baseline.session_id,
        trial_id=trial_id,
        provenance="demo",
        status="complete",
        stage="complete",
        source="sample",
        width=baseline.width,
        height=baseline.height,
        luminance_mean=(baseline.luminance_mean or 0) + 4,
        requested_metrics=baseline.requested_metrics,
        missing_metrics=baseline.missing_metrics,
        units_estimated=0,
        synthetic_timeline=True,
        observed_at=baseline.observed_at + timedelta(days=DEMO_FOLLOWUP_DAYS),
        completed_at=now,
    )
    scan.readings = [
        ReadingRow(
            metric=r.metric,
            ui_score=max(1, min(100, r.ui_score + DEMO_FOLLOWUP_DELTAS.get(r.metric, 0))),
            raw_score=None,
            mask_url=None,
        )
        for r in baseline.readings
    ]
    return scan
