"""Live scan jobs: run the YouCam lifecycle in the background and record each stage.

The HTTP request that starts a scan returns 202 immediately; the browser polls
GET /scans/{id}. Image bytes live only in this job's memory and are released
when it finishes. If the process restarts mid-job, the scan is marked failed
on startup rather than left "processing" forever.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlparse

from sqlalchemy import select, update

from app.core.logging import get_logger
from app.db.models import ReadingRow, ScanRow, utcnow
from app.db.session import db_session
from app.domain.metrics import REQUESTED_PROVIDER_ACTIONS
from app.domain.normalize import normalize_outputs
from app.providers.youcam.client import YouCamClient
from app.providers.youcam.errors import ProviderError, ProviderErrorCode
from app.services import usage
from app.services.imaging import PreparedImage

log = get_logger("proofloop.scans")

DEFAULT_MASK_TTL = timedelta(hours=1)


def presigned_expiry(url: str, now: datetime) -> datetime:
    """Read X-Amz-Date/X-Amz-Expires from a presigned URL; fall back to a short TTL."""
    try:
        query = parse_qs(urlparse(url).query)
        start = datetime.strptime(query["X-Amz-Date"][0], "%Y%m%dT%H%M%SZ").replace(tzinfo=UTC)
        return start + timedelta(seconds=int(query["X-Amz-Expires"][0]))
    except (KeyError, ValueError, IndexError):
        return now + DEFAULT_MASK_TTL


class ScanJobRunner:
    def __init__(self, provider_factory: Callable[[], YouCamClient | None], max_concurrency: int = 3):
        self._provider_factory = provider_factory
        self._semaphore = asyncio.Semaphore(max_concurrency)
        self._tasks: set[asyncio.Task] = set()

    def start(self, scan_id: str, call_id: int, image: PreparedImage) -> None:
        task = asyncio.create_task(self._run(scan_id, call_id, image), name=f"scan-{scan_id}")
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def drain(self, wait_s: float = 5.0) -> None:
        if self._tasks:
            await asyncio.wait(self._tasks, timeout=wait_s)

    async def _set_stage(self, scan_id: str, stage: str) -> None:
        with db_session() as db:
            db.execute(update(ScanRow).where(ScanRow.id == scan_id).values(stage=stage))

    async def _run(self, scan_id: str, call_id: int, image: PreparedImage) -> None:
        provider = self._provider_factory()
        if provider is None:
            self._fail(scan_id, call_id, ProviderError(ProviderErrorCode.not_configured))
            return
        async with self._semaphore:
            try:
                result = await provider.analyze_skin(
                    image.data,
                    image.content_type,
                    REQUESTED_PROVIDER_ACTIONS,
                    on_stage=lambda stage: self._set_stage(scan_id, stage),
                )
            except ProviderError as exc:
                self._fail(scan_id, call_id, exc)
                return
            except Exception as exc:  # defensive: never leave a scan processing
                log.exception("scan_job_crashed", extra={"scan_id": scan_id})
                self._fail(scan_id, call_id, ProviderError(ProviderErrorCode.unavailable, type(exc).__name__))
                return

        normalized = normalize_outputs(result.outputs, result.requested_actions)
        if not normalized.readings:
            self._fail(scan_id, call_id, ProviderError(ProviderErrorCode.malformed, "no usable metrics"), billed=True)
            return

        now = utcnow()
        with db_session() as db:
            scan = db.get(ScanRow, scan_id)
            if scan is None:  # deleted by the user while processing
                usage.settle(db, call_id, success=True, duration_s=result.duration_s)
                return
            expiries = [presigned_expiry(r.mask_url, now) for r in normalized.readings if r.mask_url]
            for reading in normalized.readings:
                db.add(
                    ReadingRow(
                        scan_id=scan_id,
                        metric=reading.metric,
                        ui_score=reading.ui_score,
                        raw_score=reading.raw_score,
                        mask_url=reading.mask_url,
                    )
                )
            scan.status = "complete"
            scan.stage = "complete"
            scan.missing_metrics = json.dumps(normalized.missing)
            scan.provider_duration_s = result.duration_s
            scan.units_estimated = result.units_estimated
            scan.completed_at = now
            scan.masks_expire_at = min(expiries) if expiries else None
            usage.settle(db, call_id, success=True, duration_s=result.duration_s)
        log.info(
            "scan_complete",
            extra={
                "scan_id": scan_id,
                "metrics": len(normalized.readings),
                "missing": normalized.missing,
                "ignored_types": normalized.ignored_types,
                "duration_s": result.duration_s,
            },
        )

    def _fail(self, scan_id: str, call_id: int, exc: ProviderError, billed: bool = False) -> None:
        possibly_billed = billed or exc.code is ProviderErrorCode.timeout
        with db_session() as db:
            scan = db.get(ScanRow, scan_id)
            if scan is not None:
                scan.status = "failed"
                scan.stage = "failed"
                scan.failure_code = exc.code.value
                scan.failure_message = _FAILURE_TITLES.get(exc.code, "The analysis didn't complete.")
                scan.failure_hint = exc.guidance
                scan.completed_at = utcnow()
            usage.settle(db, call_id, success=False, error_code=exc.code.value, possibly_billed=possibly_billed)
        log.info("scan_failed", extra={"scan_id": scan_id, "code": exc.code.value, "provider_code": exc.provider_code})


_FAILURE_TITLES = {
    ProviderErrorCode.face_too_small: "Your face needs to fill more of the photo.",
    ProviderErrorCode.face_out_of_frame: "Part of your face was outside the photo.",
    ProviderErrorCode.too_dark: "The photo was too dark to analyse.",
    ProviderErrorCode.image_too_small: "The photo was too small to analyse.",
    ProviderErrorCode.timeout: "The analysis timed out.",
    ProviderErrorCode.unavailable: "The analysis service didn't respond.",
    ProviderErrorCode.rate_limited: "The analysis service is busy.",
    ProviderErrorCode.credits: "The live-analysis allowance is used up.",
    ProviderErrorCode.auth: "Live analysis is misconfigured on this server.",
    ProviderErrorCode.not_configured: "Live analysis isn't configured on this server.",
    ProviderErrorCode.malformed: "The analysis returned unreadable results.",
    ProviderErrorCode.upload_failed: "The photo upload failed.",
}


def recover_interrupted_scans() -> int:
    """Mark scans left 'processing' by a previous process as failed; release their reservations."""
    from app.db.models import ProviderCallRow

    with db_session() as db:
        rows = db.scalars(select(ScanRow).where(ScanRow.status == "processing")).all()
        for scan in rows:
            scan.status = "failed"
            scan.stage = "failed"
            scan.failure_code = "interrupted"
            scan.failure_message = "The analysis was interrupted by a server restart."
            scan.failure_hint = "Please run the scan again."
            scan.completed_at = utcnow()
        # A pending reservation from a dead process may or may not have been billed; keep it counted.
        for call in db.scalars(select(ProviderCallRow).where(ProviderCallRow.status == "pending")).all():
            call.status = "error"
            call.units_charged = call.units_reserved
            call.error_code = "interrupted"
        return len(rows)
