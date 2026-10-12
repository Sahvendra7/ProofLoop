"""Provider usage ledger: reserve units before a call, settle after.

Units are reserved at the documented price before any provider request, so a
burst of concurrent requests cannot overspend the deployment budget. Failed
tasks are settled at 0 units (YouCam documents that failed tasks are not billed).
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import ProviderCallRow, utcnow


def units_committed(db: Session) -> int:
    pending = db.scalar(
        select(func.coalesce(func.sum(ProviderCallRow.units_reserved), 0)).where(ProviderCallRow.status == "pending")
    )
    charged = db.scalar(
        select(func.coalesce(func.sum(ProviderCallRow.units_charged), 0)).where(ProviderCallRow.status != "pending")
    )
    return int(pending or 0) + int(charged or 0)


_BUDGET_LOCK_KEY = 7_204_311  # arbitrary, app-wide


def reserve(db: Session, settings: Settings, *, session_id: str, kind: str, units: int) -> ProviderCallRow:
    if db.get_bind().dialect.name == "postgresql":
        # Serialise check-then-insert across concurrent requests; released at commit/rollback.
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": _BUDGET_LOCK_KEY})
    limit = (
        settings.live_scans_per_session_per_hour
        if kind == "skin_analysis"
        else settings.simulations_per_session_per_hour
    )
    since = utcnow() - timedelta(hours=1)
    recent = db.scalar(
        select(func.count(ProviderCallRow.id)).where(
            ProviderCallRow.session_id == session_id,
            ProviderCallRow.kind == kind,
            ProviderCallRow.created_at >= since,
            ProviderCallRow.status != "error",
        )
    )
    if (recent or 0) >= limit:
        raise AppError(
            "session_rate_limited",
            "You've reached the hourly limit for live analyses in this session.",
            429,
            hint="Try again later, or explore with sample data.",
        )
    if units_committed(db) + units > settings.provider_unit_budget:
        raise AppError(
            "budget_exhausted",
            "This deployment has used its live-analysis allowance.",
            503,
            hint="Sample data is still available.",
        )
    row = ProviderCallRow(session_id=session_id, kind=kind, units_reserved=units)
    db.add(row)
    db.flush()
    return row


def settle(
    db: Session,
    call_id: int,
    *,
    success: bool,
    error_code: str | None = None,
    duration_s: float | None = None,
    possibly_billed: bool = False,
) -> None:
    """possibly_billed: the outcome is unknown (e.g. timed out after the task was
    created), so the reserved units stay counted against the budget."""
    row = db.get(ProviderCallRow, call_id)
    if row is None:
        return
    row.status = "success" if success else "error"
    row.units_charged = row.units_reserved if (success or possibly_billed) else 0
    row.error_code = error_code
    row.duration_s = duration_s
