"""Trial protocol state: the instrument check (repeat baseline) and when the plan is sealed.

A trial's focus band is its registered band, widened (never narrowed) by an optional
repeat baseline taken before the first check-in (domain.compare.personal_band). The
first check-in seals the plan: it writes the repeat's spread to the trial, after which
no repeat can be added and deleting the repeat scan changes nothing.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api import presenters as p
from app.core.errors import AppError
from app.db.models import ScanRow, TrialRow
from app.domain.compare import NOISE_BANDS, InstrumentCheck, instrument_check, personal_band
from app.domain.metrics import GOALS_BY_KEY


def lock(db: Session, trial: TrialRow) -> None:
    """Re-read the trial's protocol state before checking it, holding its row until commit.

    The trial is usually loaded before the request awaits the upload, so another
    request can commit a repeat in between; checking that stale copy would let two
    repeats through and bill both. On PostgreSQL this is SELECT ... FOR UPDATE, which
    also serialises requests across processes; SQLite ignores the lock (and only runs
    one writer at a time). Callers must not await between this and their commit.
    """
    db.refresh(trial, with_for_update=True)


def registered_band(trial: TrialRow) -> int:
    return trial.focus_band if trial.focus_band is not None else NOISE_BANDS[GOALS_BY_KEY[trial.goal].metric]


def repeat_scan(db: Session, trial: TrialRow) -> ScanRow | None:
    return db.get(ScanRow, trial.repeat_scan_id) if trial.repeat_scan_id else None


def has_checkins(db: Session, trial: TrialRow) -> bool:
    """Any check-in at all, whatever its status: once one exists the plan is fixed."""
    first = db.scalar(
        select(ScanRow.id).where(ScanRow.trial_id == trial.id, ScanRow.id != trial.baseline_scan_id).limit(1)
    )
    return first is not None


def check_of(trial: TrialRow, baseline: ScanRow, repeat: ScanRow | None) -> InstrumentCheck | None:
    if repeat is None or repeat.status != "complete":
        return None
    metric = GOALS_BY_KEY[trial.goal].metric
    return instrument_check(p.scores_of(baseline), p.scores_of(repeat), metric, registered_band(trial))


def spread_of(db: Session, trial: TrialRow, baseline: ScanRow) -> int | None:
    if trial.repeat_spread is not None:
        return trial.repeat_spread
    check = check_of(trial, baseline, repeat_scan(db, trial))
    return check.spread if check else None


def effective_band(db: Session, trial: TrialRow, baseline: ScanRow) -> int:
    return personal_band(registered_band(trial), spread_of(db, trial, baseline))


def ensure_repeat_allowed(db: Session, trial: TrialRow) -> None:
    if has_checkins(db, trial):
        raise AppError(
            "protocol_sealed",
            "This trial already has a check-in, so its plan is fixed.",
            409,
            hint="An instrument check has to happen before the first check-in.",
        )
    existing = repeat_scan(db, trial)
    if existing is not None and existing.status != "failed":
        raise AppError("repeat_exists", "This trial already has an instrument check.", 409)


def ensure_not_same_photo(baseline: ScanRow, digest: str) -> None:
    if baseline.content_digest is not None and baseline.content_digest == digest:
        raise AppError(
            "same_photo",
            "That's the same photo as your baseline.",
            409,
            hint="The same photo always gets the same scores, so it can't tell you anything new. Take a fresh one.",
        )


def seal(db: Session, trial: TrialRow) -> None:
    """Call when creating a check-in: freeze the instrument check's result into the trial."""
    repeat = repeat_scan(db, trial)
    if repeat is not None and repeat.status == "processing":
        raise AppError(
            "repeat_in_progress",
            "Your instrument check is still being measured.",
            409,
            hint="Wait for it to finish, then check in.",
        )
    if trial.repeat_spread is not None:
        return
    baseline = db.get(ScanRow, trial.baseline_scan_id)
    assert baseline is not None
    check = check_of(trial, baseline, repeat)
    if check is not None and check.spread is not None:
        trial.repeat_spread = check.spread
