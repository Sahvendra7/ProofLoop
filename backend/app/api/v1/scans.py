"""Scans: live YouCam analyses (async, polled) and sample-data scans."""

from __future__ import annotations

import json
import re

from fastapi import APIRouter, Depends, File, Form, Header, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api import presenters as p
from app.api import schemas as s
from app.api.deps import current_session, job_runner, owned_scan, owned_trial, settings_dep
from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import ScanRow, SessionRow, utcnow
from app.db.session import get_db
from app.domain import profile as pf
from app.domain.metrics import baseline_actions
from app.providers.youcam import endpoints as ep
from app.services import demo, profiles, protocol, usage
from app.services.imaging import prepare_image
from app.services.scans import ScanJobRunner

router = APIRouter(prefix="/scans", tags=["scans"])

_IDEMPOTENCY = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


@router.post("", response_model=s.ScanOut, status_code=status.HTTP_202_ACCEPTED)
async def create_scan(
    response: Response,
    image: UploadFile = File(...),
    consent: bool = Form(...),
    source: str = Form("upload"),
    trial_id: str | None = Form(None),
    purpose: str = Form("checkin"),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    session: SessionRow = Depends(current_session),
    db: Session = Depends(get_db),
    settings: Settings = Depends(settings_dep),
    runner: ScanJobRunner = Depends(job_runner),
) -> s.ScanOut:
    if not consent:
        raise AppError("consent_required", "Please confirm consent before analysing a photo.", 400)
    if source not in ("camera", "upload"):
        raise AppError("invalid_request", "source must be 'camera' or 'upload'.", 422)
    if purpose not in ("checkin", "repeat_baseline"):
        raise AppError("invalid_request", "purpose must be 'checkin' or 'repeat_baseline'.", 422)
    if purpose == "repeat_baseline" and not trial_id:
        raise AppError("invalid_request", "An instrument check needs the trial it belongs to.", 422)
    if idempotency_key is not None and not _IDEMPOTENCY.match(idempotency_key):
        raise AppError("invalid_request", "Idempotency-Key must be 8-64 URL-safe characters.", 422)

    if idempotency_key:
        existing = db.scalar(
            select(ScanRow).where(ScanRow.session_id == session.id, ScanRow.idempotency_key == idempotency_key)
        )
        if existing is not None:
            response.status_code = status.HTTP_200_OK
            return p.scan_out(existing, utcnow())

    if not settings.provider_configured:
        raise AppError(
            "provider_not_configured",
            "Live analysis isn't configured on this server.",
            503,
            hint="Set YOUCAM_API_KEY on the backend, or explore with sample data.",
        )

    trial = None
    if trial_id:
        trial = owned_trial(db, session, trial_id)
        if trial.provenance != "youcam":
            raise AppError("provenance_mismatch", "A sample-data trial can't take a live check-in.", 409)

    raw = await image.read(settings.max_upload_bytes + 1)
    if len(raw) > settings.max_upload_bytes:
        raise AppError("image_too_large", "Photos must be under 10 MB.", 413)
    prepared = prepare_image(raw)
    del raw

    repeat = purpose == "repeat_baseline"
    actions = baseline_actions(settings.skin_profile_enabled)
    if trial is not None:
        # All of these refuse before any units are reserved. No awaits from here to the commit.
        protocol.lock(db, trial)
        baseline = db.get(ScanRow, trial.baseline_scan_id)
        assert baseline is not None
        protocol.ensure_not_same_photo(baseline, prepared.digest)
        actions = protocol.trial_actions(baseline)
        if repeat:
            protocol.ensure_repeat_allowed(db, trial)
        else:
            protocol.seal(db, trial)

    units = ep.analysis_units(len(actions))
    call = usage.reserve(db, settings, session_id=session.id, kind="skin_analysis", units=units)
    scan = ScanRow(
        session_id=session.id,
        # A repeat baseline is linked from the trial, never as a check-in.
        trial_id=trial.id if trial and not repeat else None,
        provenance="youcam",
        status="processing",
        stage="queued",
        source=source,
        width=prepared.width,
        height=prepared.height,
        luminance_mean=prepared.luminance_mean,
        content_digest=prepared.digest,
        idempotency_key=idempotency_key,
        requested_metrics=json.dumps(list(actions)),
        units_estimated=units,
    )
    db.add(scan)
    if trial is not None and repeat:
        db.flush()
        trial.repeat_scan_id = scan.id
    db.commit()  # the job runs in the background and must see this row
    runner.start(scan.id, call.id, prepared, actions)
    return p.scan_out(scan, utcnow())


@router.post("/demo", response_model=s.ScanOut, status_code=status.HTTP_201_CREATED)
def create_demo_scan(
    session: SessionRow = Depends(current_session),
    db: Session = Depends(get_db),
    settings: Settings = Depends(settings_dep),
) -> s.ScanOut:
    scan = demo.build_demo_scan(session.id, skin_type=settings.skin_profile_enabled)
    db.add(scan)
    db.flush()
    return p.scan_out(scan, utcnow())


@router.post("/{scan_id}/focus-plan", response_model=s.FocusPlanOut)
def focus_plan(
    scan_id: str,
    body: s.FocusPlanIn,
    session: SessionRow = Depends(current_session),
    db: Session = Depends(get_db),
    settings: Settings = Depends(settings_dep),
) -> s.FocusPlanOut:
    """Order the focuses for this scan and explain them. Writes nothing and calls no provider.

    A POST only because the answers travel in the body, never in the URL.
    """
    profiles.ensure_enabled(settings)
    scan = owned_scan(db, session, scan_id)
    if scan.status != "complete":
        raise AppError("scan_not_complete", "This scan hasn't finished.", 409)
    reading = profiles.reading_of(scan) if body.use_camera_reading else None
    plan = pf.focus_plan(p.scores_of(scan), reading, profiles.self_report(body.self_report))
    camera = p.skin_type_out(scan) if body.use_camera_reading else None
    return p.focus_plan_out(plan, camera)


@router.get("", response_model=list[s.ScanOut])
def list_scans(session: SessionRow = Depends(current_session), db: Session = Depends(get_db)) -> list[s.ScanOut]:
    rows = db.scalars(select(ScanRow).where(ScanRow.session_id == session.id).order_by(ScanRow.created_at.desc())).all()
    now = utcnow()
    return [p.scan_out(r, now) for r in rows]


@router.get("/{scan_id}", response_model=s.ScanOut)
def get_scan(scan_id: str, session: SessionRow = Depends(current_session), db: Session = Depends(get_db)) -> s.ScanOut:
    return p.scan_out(owned_scan(db, session, scan_id), utcnow())


@router.delete("/{scan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scan(
    scan_id: str, session: SessionRow = Depends(current_session), db: Session = Depends(get_db)
) -> Response:
    db.delete(owned_scan(db, session, scan_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
