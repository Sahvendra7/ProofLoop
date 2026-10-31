"""Trials: a baseline scan + chosen goal + chosen product, compared against later check-ins."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api import presenters as p
from app.api import schemas as s
from app.api.deps import current_session, owned_scan, owned_trial, settings_dep
from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import ScanRow, SessionRow, TrialRow, utcnow
from app.db.session import get_db
from app.domain.catalog import load_catalog
from app.domain.compare import (
    NOISE_BANDS,
    PLANNED_CHECKIN_DAYS,
    CaptureInfo,
    assess_comparability,
    band_evidence,
    compare,
    detectability,
    next_step,
)
from app.domain.metrics import GOALS_BY_KEY
from app.providers.youcam import endpoints as ep
from app.services import demo, profiles
from app.services import protocol as proto
from app.services.imaging import prepare_image

router = APIRouter(prefix="/trials", tags=["trials"])


def _planned_days(trial: TrialRow) -> int:
    return trial.planned_checkin_days if trial.planned_checkin_days is not None else PLANNED_CHECKIN_DAYS


def _instrument_out(db: Session, trial: TrialRow, baseline: ScanRow, sealed: bool) -> s.InstrumentCheckOut:
    repeat = proto.repeat_scan(db, trial)
    table = proto.registered_band(trial)
    check = proto.check_of(trial, baseline, repeat)
    spread = proto.spread_of(db, trial, baseline)
    band = proto.effective_band(db, trial, baseline) if spread is not None else None
    if repeat is not None:
        status = "complete" if repeat.status == "complete" else repeat.status
    elif trial.repeat_spread is not None:
        status = "complete"  # sealed, and the repeat scan was deleted afterwards
    else:
        status = "unavailable" if sealed else "available"
    sample = trial.provenance == "demo"
    return s.InstrumentCheckOut(
        status=status,
        unavailable_reason="sealed" if status == "unavailable" else None,
        scan_id=repeat.id if repeat is not None else None,
        sample=sample,
        note=demo.repeat_note() if sample else None,
        units=0 if sample else ep.analysis_units(len(proto.trial_actions(baseline))),
        table_band=table,
        spread=spread,
        personal_band=band,
        widened=band is not None and band > table,
        sealed=sealed,
        changes=[p.change_out(c) for c in check.changes] if check else [],
    )


def _band_evidence(trial: TrialRow, widened: bool) -> str:
    return "personal" if widened else (trial.band_evidence or band_evidence(GOALS_BY_KEY[trial.goal].metric))


def _protocol_out(db: Session, trial: TrialRow, baseline: ScanRow, sealed: bool) -> s.ProtocolOut:
    goal = GOALS_BY_KEY[trial.goal]
    band = proto.effective_band(db, trial, baseline)
    base_score = p.scores_of(baseline).get(goal.metric)
    days = _planned_days(trial)
    evidence = _band_evidence(trial, band > proto.registered_band(trial))
    if base_score is not None:
        d = detectability(goal.metric, base_score, band)
        improve_at, decline_at, kind = d.improve_at, d.decline_at, d.detectable
    else:
        improve_at, decline_at, kind = None, None, "neither"
    return s.ProtocolOut(
        registered=trial.focus_band is not None,
        focus_metric=goal.metric,
        baseline_score=base_score,
        noise_band=band,
        band_evidence=evidence,
        improve_at=improve_at,
        decline_at=decline_at,
        detectable=kind,
        planned_checkin_days=days,
        planned_checkin_at=p.capture_of(baseline).captured_at + timedelta(days=days),
        baseline_capture=p.capture_out(baseline),
        instrument_check=_instrument_out(db, trial, baseline, sealed),
    )


def _trial_out(db: Session, trial: TrialRow) -> s.TrialOut:
    now = utcnow()
    goal = GOALS_BY_KEY[trial.goal]
    product = load_catalog().get(trial.product_id)
    if product is None:
        raise AppError("product_not_found", "This trial's product is no longer in the catalogue.", 410)
    baseline = db.get(ScanRow, trial.baseline_scan_id)
    assert baseline is not None
    checkins = db.scalars(
        select(ScanRow)
        .where(ScanRow.trial_id == trial.id, ScanRow.id != baseline.id, ScanRow.provenance == trial.provenance)
        .order_by(ScanRow.observed_at.asc())
    ).all()
    complete = [c for c in checkins if c.status == "complete"]

    history = [
        s.HistoryPointOut(
            scan_id=baseline.id,
            observed_at=p.capture_of(baseline).captured_at,
            focus_score=p.scores_of(baseline).get(goal.metric),
            synthetic=False,
            is_baseline=True,
        )
    ] + [
        s.HistoryPointOut(
            scan_id=c.id,
            observed_at=p.capture_of(c).captured_at,
            focus_score=p.scores_of(c).get(goal.metric),
            synthetic=c.synthetic_timeline,
            is_baseline=False,
        )
        for c in complete
    ]

    sealed = proto.has_checkins(db, trial)
    protocol = _protocol_out(db, trial, baseline, sealed)
    comparison = None
    if complete:
        latest = complete[-1]
        result = compare(
            p.scores_of(baseline),
            p.scores_of(latest),
            p.capture_of(baseline),
            p.capture_of(latest),
            goal.metric,
            focus_band=protocol.noise_band,
            focus_evidence="personal" if protocol.band_evidence == "personal" else None,
        )
        days = _planned_days(trial)
        action = next_step(
            result.focus_outcome or "insufficient_data", result.comparability.days_apart < days, protocol.detectable
        )
        step = s.NextStepOut(action=action, goal=goal.key, baseline_scan_id=baseline.id)
        comparison = p.comparison_out(latest, result, days, step)

    return s.TrialOut(
        id=trial.id,
        provenance=p.provenance(trial.provenance, trial=True),
        goal=p.goal_out(goal),
        product=p.product_out(product),
        created_at=p._aware(trial.created_at),
        baseline=p.scan_out(baseline, now),
        checkins=[p.scan_out(c, now) for c in checkins],
        history=history,
        comparison=comparison,
        focus_noise_band=protocol.noise_band,
        protocol=protocol,
        profile=profiles.profile_out(trial, proto.repeat_scan(db, trial)),
    )


@router.post("", response_model=s.TrialOut, status_code=status.HTTP_201_CREATED)
def create_trial(
    body: s.TrialCreateIn,
    session: SessionRow = Depends(current_session),
    db: Session = Depends(get_db),
    settings: Settings = Depends(settings_dep),
):
    if body.profile is not None:
        profiles.ensure_enabled(settings)
    scan = owned_scan(db, session, body.scan_id)
    if scan.status != "complete":
        raise AppError("scan_not_complete", "A trial needs a completed scan as its baseline.", 409)
    if scan.synthetic_timeline:
        raise AppError("invalid_baseline", "A synthetic follow-up can't be a baseline.", 409)
    goal = GOALS_BY_KEY.get(body.goal)
    if goal is None:
        raise AppError("unknown_goal", f"'{body.goal}' isn't a supported focus.", 422)
    if goal.metric not in p.scores_of(scan):
        raise AppError("metric_missing", "This scan has no measurement for that focus.", 409)
    if load_catalog().get(body.product_id) is None:
        raise AppError("product_not_found", "Product not found.", 404)
    trial = TrialRow(
        session_id=session.id,
        provenance=scan.provenance,
        goal=goal.key,
        product_id=body.product_id,
        baseline_scan_id=scan.id,
        focus_band=NOISE_BANDS[goal.metric],
        band_evidence=band_evidence(goal.metric),
        planned_checkin_days=PLANNED_CHECKIN_DAYS,
        # Frozen with the plan; validated before anything is saved.
        profile_json=profiles.snapshot(scan, body.profile, p.scores_of(scan)) if body.profile is not None else None,
    )
    db.add(trial)
    db.flush()
    return _trial_out(db, trial)


@router.get("", response_model=list[s.TrialSummaryOut])
def list_trials(session: SessionRow = Depends(current_session), db: Session = Depends(get_db)):
    trials = db.scalars(
        select(TrialRow).where(TrialRow.session_id == session.id).order_by(TrialRow.created_at.desc())
    ).all()
    catalog = load_catalog()
    out = []
    for t in trials:
        product = catalog.get(t.product_id)
        count = len(db.scalars(select(ScanRow.id).where(ScanRow.trial_id == t.id, ScanRow.status == "complete")).all())
        out.append(
            s.TrialSummaryOut(
                id=t.id,
                baseline_scan_id=t.baseline_scan_id,
                provenance=p.provenance(t.provenance, trial=True),
                goal=p.goal_out(GOALS_BY_KEY[t.goal]),
                product_name=product.name if product else t.product_id,
                created_at=p._aware(t.created_at),
                checkin_count=count,
            )
        )
    return out


@router.get("/{trial_id}", response_model=s.TrialOut)
def get_trial(trial_id: str, session: SessionRow = Depends(current_session), db: Session = Depends(get_db)):
    return _trial_out(db, owned_trial(db, session, trial_id))


@router.post("/{trial_id}/demo-checkin", response_model=s.TrialOut, status_code=status.HTTP_201_CREATED)
def demo_checkin(trial_id: str, session: SessionRow = Depends(current_session), db: Session = Depends(get_db)):
    trial = owned_trial(db, session, trial_id)
    if trial.provenance != "demo":
        raise AppError(
            "provenance_mismatch",
            "Synthetic follow-ups are only available for sample-data trials. Real trials need a real check-in scan.",
            409,
        )
    proto.lock(db, trial)
    baseline = db.get(ScanRow, trial.baseline_scan_id)
    assert baseline is not None
    proto.seal(db, trial)
    db.add(demo.build_demo_followup(baseline, trial.id))
    db.flush()
    return _trial_out(db, trial)


@router.post("/{trial_id}/demo-repeat", response_model=s.TrialOut, status_code=status.HTTP_201_CREATED)
def demo_repeat(trial_id: str, session: SessionRow = Depends(current_session), db: Session = Depends(get_db)):
    """The sample instrument check: replays a recorded second analysis of the sample portrait."""
    trial = owned_trial(db, session, trial_id)
    if trial.provenance != "demo":
        raise AppError(
            "provenance_mismatch",
            "The recorded sample repeat is only for sample-data trials. Real trials need a fresh capture of your face.",
            409,
        )
    proto.lock(db, trial)
    proto.ensure_repeat_allowed(db, trial)
    baseline = db.get(ScanRow, trial.baseline_scan_id)
    assert baseline is not None
    repeat = demo.build_demo_repeat(baseline)
    db.add(repeat)
    db.flush()
    trial.repeat_scan_id = repeat.id
    db.flush()
    return _trial_out(db, trial)


@router.post("/{trial_id}/preflight", response_model=s.PreflightOut)
def preflight(
    trial_id: str,
    image: UploadFile = File(...),
    source: str = Form("upload"),
    purpose: str = Form("checkin"),
    session: SessionRow = Depends(current_session),
    db: Session = Depends(get_db),
    settings: Settings = Depends(settings_dep),
) -> s.PreflightOut:
    """Check a check-in photo against the baseline's capture conditions without calling YouCam.

    The photo goes through the same cleaning as a real scan (so an unusable photo
    fails here, for free) and is discarded; nothing is stored and no units are reserved.
    A plain `def` on purpose: FastAPI runs it in the threadpool, so its blocking
    database calls and image decoding never stall the event loop.
    """
    trial = owned_trial(db, session, trial_id)
    if trial.provenance != "youcam":
        raise AppError("provenance_mismatch", "A sample-data trial can't take a live check-in.", 409)
    if source not in ("camera", "upload"):
        raise AppError("invalid_request", "source must be 'camera' or 'upload'.", 422)
    if purpose not in ("checkin", "repeat_baseline"):
        raise AppError("invalid_request", "purpose must be 'checkin' or 'repeat_baseline'.", 422)
    raw = image.file.read(settings.max_upload_bytes + 1)
    if len(raw) > settings.max_upload_bytes:
        raise AppError("image_too_large", "Photos must be under 10 MB.", 413)
    prepared = prepare_image(raw)
    del raw

    baseline = db.get(ScanRow, trial.baseline_scan_id)
    assert baseline is not None
    now = utcnow()
    report = assess_comparability(
        p.capture_of(baseline),
        CaptureInfo(luminance_mean=prepared.luminance_mean, source=source, captured_at=now),
        expect_interval=purpose == "checkin",
    )
    same = baseline.content_digest is not None and baseline.content_digest == prepared.digest
    if same:
        report.level = "poor"
        report.issues.insert(
            0, "This is the same photo as your baseline, so its scores would be identical. Take a fresh one."
        )
    days = _planned_days(trial)
    return s.PreflightOut(
        level=report.level,
        issues=report.issues,
        same_photo=same,
        days_since_baseline=report.days_apart,
        early=report.days_apart < days,
        planned_checkin_at=p.capture_of(baseline).captured_at + timedelta(days=days),
        baseline_capture=p.capture_out(baseline),
        candidate_capture=s.CaptureOut(
            source=source, width=prepared.width, height=prepared.height, luminance_mean=prepared.luminance_mean
        ),
    )


@router.patch("/{trial_id}/profile", response_model=s.ProfileOut)
def amend_profile(
    trial_id: str,
    body: s.ProfilePatchIn,
    session: SessionRow = Depends(current_session),
    db: Session = Depends(get_db),
    settings: Settings = Depends(settings_dep),
) -> s.ProfileOut:
    """Record changed answers. The snapshot taken at commitment, and the plan, stay as they were."""
    profiles.ensure_enabled(settings)
    trial = owned_trial(db, session, trial_id)
    proto.lock(db, trial)
    profiles.amend(trial, body)
    db.flush()
    out = profiles.profile_out(trial, proto.repeat_scan(db, trial))
    assert out is not None
    return out


@router.delete("/{trial_id}/profile", status_code=status.HTTP_204_NO_CONTENT)
def withdraw_profile(trial_id: str, session: SessionRow = Depends(current_session), db: Session = Depends(get_db)):
    """Erase the saved answers and the skin-type readings of this trial's photos. Always allowed."""
    trial = owned_trial(db, session, trial_id)
    proto.lock(db, trial)
    profiles.withdraw(db, trial)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{trial_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trial(trial_id: str, session: SessionRow = Depends(current_session), db: Session = Depends(get_db)):
    db.delete(owned_trial(db, session, trial_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
