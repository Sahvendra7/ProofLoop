"""Checked skin profile persistence: the reading per scan and the snapshot frozen with each trial.

The snapshot is written once, when the trial (and with it the plan) is created. Later answers are
appended as amendments and never rewrite it; withdrawal erases the answers and the readings. None
of this is read by the plan, band, verdict or next step (domain.compare, services.protocol).
"""

from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api import schemas as s
from app.core.config import Settings
from app.core.errors import AppError
from app.core.logging import get_logger
from app.db.models import ScanRow, TrialRow, utcnow
from app.domain import profile as pf
from app.domain.metrics import SKIN_TYPE_ACTION

SNAPSHOT_VERSION = 1

log = get_logger("proofloop.profiles")


def ensure_enabled(settings: Settings) -> None:
    if not settings.skin_profile_enabled:
        raise AppError("feature_disabled", "Skin profiles aren't available on this server.", 404)


def requested(scan: ScanRow) -> bool:
    return SKIN_TYPE_ACTION in json.loads(scan.requested_metrics or "[]")


def reading_of(scan: ScanRow) -> pf.SkinTypeReading | None:
    return pf.reading_from_json(scan.skin_type_json)


def self_report(data: s.SelfReportIn | None) -> pf.SelfReport | None:
    if data is None:
        return None
    try:
        return pf.SelfReport(data.shine, data.tightness, data.reactive, tuple(data.priorities))
    except ValueError as exc:
        raise AppError("invalid_request", str(exc).capitalize() + ".", 422) from exc


def _load(trial: TrialRow) -> dict | None:
    if not trial.profile_json:
        return None
    try:
        data = json.loads(trial.profile_json)
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def withdrawn(trial: TrialRow) -> bool:
    data = _load(trial)
    return data is not None and data.get("withdrawn_at") is not None


def snapshot(baseline: ScanRow, data: s.ProfileIn, scores: dict[str, int]) -> str:
    """The profile as it stands at commitment, with the notes the user saw, frozen."""
    report = self_report(data.self_report)
    reading = reading_of(baseline) if data.use_camera_reading else None
    camera = {"scan_id": baseline.id, **reading.regions()} if reading and reading.returned() else None
    plan = pf.focus_plan(scores, reading, report)
    return json.dumps(
        {
            "version": SNAPSHOT_VERSION,
            "rules_version": pf.RULES_VERSION,
            "created_at": utcnow().isoformat(),
            "self_report": data.self_report.model_dump() if data.self_report else None,
            "user_view": data.user_view,
            "camera": camera,
            "camera_rejected": not data.use_camera_reading,
            "notes": [{"rule_id": n.rule_id, "text": n.text} for n in plan.profile_notes],
            "amendments": [],
            "withdrawn_at": None,
        }
    )


def amend(trial: TrialRow, patch: s.ProfilePatchIn) -> None:
    data = _load(trial)
    if data is None or data.get("withdrawn_at") is not None or not isinstance(data.get("amendments"), list):
        raise AppError("profile_not_found", "This trial has no saved profile.", 404)
    if patch.expected_amendments != len(data["amendments"]):
        raise AppError(
            "profile_conflict", "Your answers changed in another tab.", 409, hint="Reload the trial and try again."
        )
    self_report(patch.self_report)  # validate
    data["amendments"].append(
        {
            "at": utcnow().isoformat(),
            "self_report": patch.self_report.model_dump() if patch.self_report else None,
            "user_view": patch.user_view,
        }
    )
    trial.profile_json = json.dumps(data)


def withdraw(db: Session, trial: TrialRow) -> None:
    """Erase the answers and every skin-type reading linked to this trial. The plan and scores stay.

    Checks the stored column, not its parsed form, so a profile that can't be read can still be erased.
    """
    if not trial.profile_json:
        raise AppError("profile_not_found", "This trial has no saved profile.", 404)
    trial.profile_json = json.dumps({"version": SNAPSHOT_VERSION, "withdrawn_at": utcnow().isoformat()})
    ids = {trial.baseline_scan_id, trial.repeat_scan_id} - {None}
    ids |= set(db.scalars(select(ScanRow.id).where(ScanRow.trial_id == trial.id)).all())
    for scan in db.scalars(select(ScanRow).where(ScanRow.id.in_(ids))).all():
        if requested(scan):
            scan.skin_type_json = pf.REMOVED_JSON


def _aware(value: str) -> datetime:
    return datetime.fromisoformat(value)


def profile_out(trial: TrialRow, repeat: ScanRow | None) -> s.ProfileOut | None:
    """None when no profile was saved, or when the stored one can't be read (the trial itself still loads)."""
    data = _load(trial)
    if data is None:
        if trial.profile_json:
            log.warning("profile_unreadable", extra={"trial_id": trial.id})
        return None
    try:
        return _profile_out(data, repeat)
    except (KeyError, TypeError, ValueError):
        log.warning("profile_unreadable", extra={"trial_id": trial.id})
        return None


def _profile_out(data: dict, repeat: ScanRow | None) -> s.ProfileOut:
    if data.get("withdrawn_at") is not None:
        return s.ProfileOut(
            at_start=None, latest=None, amendments=0, stability="not_used", notes=[], rules_version=None, withdrawn=True
        )
    camera = data.get("camera")
    if data.get("camera_rejected"):
        stability = "not_used"
    else:
        start = pf.SkinTypeReading(camera["whole"], camera["t_zone"], camera["u_zone"]) if camera else None
        done = repeat is not None and repeat.status == "complete" and requested(repeat)
        stability = pf.stability(start, reading_of(repeat) if repeat else None, repeat_complete=done)
    amendments = data.get("amendments", [])
    latest = amendments[-1] if amendments else None
    return s.ProfileOut(
        at_start=s.ProfileSnapshotOut(
            created_at=_aware(data["created_at"]),
            self_report=data.get("self_report"),
            user_view=data.get("user_view"),
            camera=camera,
            camera_rejected=bool(data.get("camera_rejected")),
        ),
        latest=s.ProfileAmendmentOut(
            at=_aware(latest["at"]), self_report=latest["self_report"], user_view=latest["user_view"]
        )
        if latest
        else None,
        amendments=len(amendments),
        stability=stability,
        notes=[s.NoteOut(**n) for n in data.get("notes", [])],
        rules_version=data.get("rules_version"),
        withdrawn=False,
    )
