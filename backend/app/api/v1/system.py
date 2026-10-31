"""Sessions, data deletion, system status and the Skin Simulation preview."""

from __future__ import annotations

from collections.abc import Callable

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.api import presenters as p
from app.api import schemas as s
from app.api.deps import current_session, provider_factory, settings_dep
from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import SessionRow
from app.db.session import db_session, get_db
from app.domain.catalog import load_catalog
from app.domain.compare import NOISE_BANDS
from app.domain.metrics import METRICS
from app.providers.youcam import endpoints as ep
from app.providers.youcam.client import YouCamClient
from app.providers.youcam.errors import ProviderError, ProviderErrorCode
from app.services import demo, usage
from app.services.imaging import prepare_image
from app.services.sessions import create_session

router = APIRouter(tags=["system"])


@router.post("/sessions", response_model=s.SessionOut, status_code=status.HTTP_201_CREATED)
def new_session(db: Session = Depends(get_db)) -> s.SessionOut:
    row, token = create_session(db)
    return s.SessionOut(session_id=row.id, token=token, created_at=p._aware(row.created_at))


@router.delete("/sessions/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_data(session: SessionRow = Depends(current_session), db: Session = Depends(get_db)) -> Response:
    """Delete the session and every scan, score and trial in it. Usage-ledger rows keep only unit counts."""
    db.delete(session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/system/status", response_model=s.SystemStatusOut)
def system_status(db: Session = Depends(get_db), settings: Settings = Depends(settings_dep)) -> s.SystemStatusOut:
    committed = usage.units_committed(db)
    return s.SystemStatusOut(
        provider_configured=settings.provider_configured,
        provider_name="YouCam AI Skin Analysis (S2S API v2.0)",
        analysis_endpoint=f"POST {ep.ANALYSIS_TASK_PATH}",
        simulation_endpoint=f"POST {ep.SIMULATION_TASK_PATH}",
        concerns=[m.provider_type for m in METRICS],
        budget=s.BudgetOut(
            limit=settings.provider_unit_budget,
            committed=committed,
            remaining=max(0, settings.provider_unit_budget - committed),
        ),
        noise_bands=NOISE_BANDS,
        demo_note=demo.fixture_note(),
        catalog_disclaimer=load_catalog().disclaimer,
        skin_profile_enabled=settings.skin_profile_enabled,
    )


@router.post("/simulations", response_model=s.SimulationOut)
async def simulate(
    image: UploadFile = File(...),
    goal: str = Form(...),
    intensity: float = Form(0.4),
    consent: bool = Form(...),
    session: SessionRow = Depends(current_session),
    settings: Settings = Depends(settings_dep),
    factory: Callable[[], YouCamClient | None] = Depends(provider_factory),
) -> s.SimulationOut:
    if not consent:
        raise AppError("consent_required", "Please confirm consent before sending a photo.", 400)
    concern = p.SIMULATION_CONCERN_FOR_GOAL.get(goal)
    if concern is None:
        raise AppError("simulation_unavailable", "YouCam's Skin Simulation doesn't support this focus.", 422)
    if not 0.1 <= intensity <= 0.6:
        raise AppError("invalid_request", "Intensity must be between 0.1 and 0.6.", 422)
    provider = factory() if settings.provider_configured else None
    if provider is None:
        raise AppError("provider_not_configured", "Live previews aren't configured on this server.", 503)

    raw = await image.read(settings.max_upload_bytes + 1)
    if len(raw) > settings.max_upload_bytes:
        raise AppError("image_too_large", "Photos must be under 10 MB.", 413)
    prepared = prepare_image(raw)
    del raw

    units = ep.simulation_units(1)
    session_id = session.id
    with db_session() as db:
        call_id = usage.reserve(db, settings, session_id=session_id, kind="skin_simulation", units=units).id
    try:
        result = await provider.simulate_skin(prepared.data, prepared.content_type, {concern: intensity})
    except ProviderError as exc:
        with db_session() as db:
            usage.settle(
                db,
                call_id,
                success=False,
                error_code=exc.code.value,
                possibly_billed=exc.code is ProviderErrorCode.timeout,
            )
        status_code = (
            422 if exc.code.value in {"face_too_small", "face_out_of_frame", "too_dark", "image_too_small"} else 502
        )
        raise AppError(exc.code.value, "The preview couldn't be generated.", status_code, hint=exc.guidance) from exc
    with db_session() as db:
        usage.settle(db, call_id, success=True, duration_s=result.duration_s)
    return s.SimulationOut(
        image_url=result.image_url,
        goal=goal,
        concern=concern,
        intensity=intensity,
        provider="YouCam AI Skin Simulation",
        endpoint=f"POST {ep.SIMULATION_TASK_PATH}",
        units=units,
        expires_note="The provider link expires within about two hours and is not stored by ProofLoop.",
    )
