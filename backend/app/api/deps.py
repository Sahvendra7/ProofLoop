"""Request dependencies: DB session, the caller's anonymous session, providers."""

from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends, Header, Request
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import ScanRow, SessionRow, TrialRow
from app.db.session import get_db
from app.providers.youcam.client import YouCamClient
from app.services.scans import ScanJobRunner
from app.services.sessions import resolve_session


def settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def current_session(
    db: Session = Depends(get_db),
    x_session_token: str | None = Header(default=None, alias="X-Session-Token"),
) -> SessionRow:
    if not x_session_token:
        raise AppError("session_required", "Start a session first.", 401)
    row = resolve_session(db, x_session_token)
    if row is None:
        raise AppError("session_invalid", "This session has expired or was deleted.", 401, hint="Start a new session.")
    return row


def provider_factory(request: Request) -> Callable[[], YouCamClient | None]:
    return request.app.state.provider_factory


def job_runner(request: Request) -> ScanJobRunner:
    return request.app.state.job_runner


def owned_scan(db: Session, session: SessionRow, scan_id: str) -> ScanRow:
    scan = db.get(ScanRow, scan_id)
    if scan is None or scan.session_id != session.id:
        raise AppError("scan_not_found", "Scan not found.", 404)
    return scan


def owned_trial(db: Session, session: SessionRow, trial_id: str) -> TrialRow:
    trial = db.get(TrialRow, trial_id)
    if trial is None or trial.session_id != session.id:
        raise AppError("trial_not_found", "Trial not found.", 404)
    return trial
