"""Async YouCam client. All HTTP details, retries and polling live here.

Retry policy (units are only billed on task *success*, per the docs, but a
duplicate task that succeeds is billed twice):
  * file registration, presigned PUT, polling GETs: retried on transport errors
    and 429/502/503/504 with exponential backoff.
  * task creation: retried only when the request provably never reached the
    server (connect errors) or was refused with 429. A read timeout after
    sending is NOT retried, because the task may already exist.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass, field

import httpx
from pydantic import ValidationError

from app.core.logging import get_logger
from app.providers.youcam import endpoints as ep
from app.providers.youcam.errors import (
    ProviderError,
    ProviderErrorCode,
    from_http_status,
    from_task_error,
)
from app.providers.youcam.models import (
    AnalysisPollResponse,
    CreditResponse,
    FileResponse,
    SimulationPollResponse,
    SkinOutput,
    TaskCreateResponse,
)

log = get_logger("proofloop.youcam")

StageCallback = Callable[[str], Awaitable[None]]
Sleep = Callable[[float], Awaitable[None]]

_RETRY_STATUSES = {429, 502, 503, 504}


@dataclass
class AnalysisResult:
    outputs: list[SkinOutput]
    requested_actions: list[str]
    units_estimated: int
    duration_s: float


@dataclass
class SimulationResult:
    image_url: str
    intensities: dict[str, float]
    units_estimated: int
    duration_s: float


@dataclass
class PollPolicy:
    initial_s: float = 2.0
    max_s: float = 6.0
    timeout_s: float = 90.0
    factor: float = 1.5


@dataclass
class YouCamClient:
    api_key: str
    base_url: str
    file_path_template: str = "/s2s/v2.0/file/{feature}"
    http: httpx.AsyncClient | None = None
    poll: PollPolicy = field(default_factory=PollPolicy)
    sleep: Sleep = asyncio.sleep
    max_attempts: int = 3

    def __post_init__(self) -> None:
        self._owns_http = self.http is None
        if self.http is None:
            self.http = httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=10.0))

    async def aclose(self) -> None:
        if self._owns_http and self.http is not None:
            await self.http.aclose()

    # ------------------------------------------------------------ public ---
    async def analyze_skin(
        self,
        image: bytes,
        content_type: str,
        actions: Sequence[str],
        on_stage: StageCallback | None = None,
    ) -> AnalysisResult:
        started = time.monotonic()
        notify = on_stage or _noop
        await notify("registering")
        file_id = await self._register_and_upload(ep.SKIN_ANALYSIS_FEATURE, image, content_type, notify)
        await notify("analyzing")
        task_id = await self._create_task(ep.ANALYSIS_TASK_PATH, ep.analysis_body(file_id, actions))
        data = await self._poll_until_done(ep.ANALYSIS_TASK_PATH, task_id, AnalysisPollResponse)
        outputs = data.data.results.output if data.data.results else []
        if not outputs:
            raise ProviderError(ProviderErrorCode.malformed, "success without results.output")
        return AnalysisResult(
            outputs=outputs,
            requested_actions=list(actions),
            units_estimated=ep.analysis_units(len(actions)),
            duration_s=round(time.monotonic() - started, 2),
        )

    async def simulate_skin(
        self, image: bytes, content_type: str, intensities: Mapping[str, float]
    ) -> SimulationResult:
        started = time.monotonic()
        body_preview = ep.simulation_body("placeholder", intensities)  # validate before spending a registration
        file_id = await self._register_and_upload(ep.SKIN_SIMULATION_FEATURE, image, content_type, _noop)
        task_id = await self._create_task(ep.SIMULATION_TASK_PATH, ep.simulation_body(file_id, intensities))
        data = await self._poll_until_done(ep.SIMULATION_TASK_PATH, task_id, SimulationPollResponse)
        url = data.result_url()
        if not url:
            raise ProviderError(ProviderErrorCode.malformed, "simulation success without a result url")
        concerns = {k: v for k, v in body_preview.items() if k != "src_file_id"}
        return SimulationResult(
            image_url=url,
            intensities=concerns,
            units_estimated=ep.simulation_units(sum(1 for v in concerns.values() if v > 0)),
            duration_s=round(time.monotonic() - started, 2),
        )

    async def credit_balance(self) -> float:
        body = await self._request("GET", ep.CREDIT_PATH, retry_on_transport=True)
        try:
            return CreditResponse.model_validate(body).total()
        except ValidationError as exc:
            raise ProviderError(ProviderErrorCode.malformed, "credit response") from exc

    # ----------------------------------------------------------- lifecycle ---
    async def _register_and_upload(self, feature: str, image: bytes, content_type: str, notify: StageCallback) -> str:
        ext = "png" if content_type == "image/png" else "jpg"
        path = ep.file_path(self.file_path_template, feature)
        body = await self._request(
            "POST", path, json=ep.file_body(f"capture.{ext}", len(image), content_type), retry_on_transport=True
        )
        try:
            registered = FileResponse.model_validate(body).first()
        except (ValidationError, ValueError) as exc:
            raise ProviderError(ProviderErrorCode.malformed, "file registration response") from exc
        upload = registered.requests[0]
        await notify("uploading")
        headers = dict(upload.headers)
        headers.setdefault("Content-Type", content_type)
        await self._put(upload.url, image, headers)
        return registered.file_id

    async def _put(self, url: str, data: bytes, headers: dict[str, str]) -> None:
        assert self.http is not None
        for attempt in range(1, self.max_attempts + 1):
            try:
                resp = await self.http.put(url, content=data, headers=headers)
            except httpx.TransportError as exc:
                if attempt == self.max_attempts:
                    raise ProviderError(ProviderErrorCode.upload_failed, type(exc).__name__) from exc
                await self.sleep(_backoff(attempt))
                continue
            if resp.status_code < 300:
                return
            if resp.status_code in _RETRY_STATUSES and attempt < self.max_attempts:
                await self.sleep(_backoff(attempt))
                continue
            raise ProviderError(
                ProviderErrorCode.upload_failed, f"PUT HTTP {resp.status_code}", http_status=resp.status_code
            )

    async def _create_task(self, path: str, body: dict) -> str:
        payload = await self._request("POST", path, json=body, retry_on_transport=False)
        try:
            return TaskCreateResponse.model_validate(payload).data.task_id
        except ValidationError as exc:
            raise ProviderError(ProviderErrorCode.malformed, "task creation response") from exc

    async def _poll_until_done(self, task_path: str, task_id: str, model):
        deadline = time.monotonic() + self.poll.timeout_s
        interval = self.poll.initial_s
        polls = 0
        while True:
            await self.sleep(interval)
            polls += 1
            body = await self._request("GET", ep.poll_path(task_path, task_id), retry_on_transport=True)
            try:
                parsed = model.model_validate(body)
            except ValidationError as exc:
                raise ProviderError(ProviderErrorCode.malformed, "poll response") from exc
            status = parsed.data.task_status
            if status == "success":
                log.info("task_success", extra={"task_path": task_path, "polls": polls})
                return parsed
            if status == "error":
                err = from_task_error(parsed.data.error, parsed.data.error_message)
                log.info("task_error", extra={"task_path": task_path, "provider_code": err.provider_code})
                raise err
            if time.monotonic() + interval > deadline:
                raise ProviderError(ProviderErrorCode.timeout, f"no result after {polls} polls")
            interval = min(self.poll.max_s, interval * self.poll.factor)

    async def _request(self, method: str, path: str, *, json: dict | None = None, retry_on_transport: bool) -> dict:
        assert self.http is not None
        url = self.base_url.rstrip("/") + path
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        for attempt in range(1, self.max_attempts + 1):
            try:
                resp = await self.http.request(method, url, json=json, headers=headers)
            except httpx.ConnectError as exc:
                # Never reached the server: safe to retry even for task creation.
                if attempt == self.max_attempts:
                    raise ProviderError(ProviderErrorCode.unavailable, "connect error") from exc
                await self.sleep(_backoff(attempt))
                continue
            except httpx.TimeoutException as exc:
                if not retry_on_transport or attempt == self.max_attempts:
                    raise ProviderError(ProviderErrorCode.timeout, f"{method} timed out") from exc
                await self.sleep(_backoff(attempt))
                continue
            except httpx.TransportError as exc:
                if not retry_on_transport or attempt == self.max_attempts:
                    raise ProviderError(ProviderErrorCode.unavailable, type(exc).__name__) from exc
                await self.sleep(_backoff(attempt))
                continue

            if resp.status_code < 300:
                try:
                    return resp.json()
                except ValueError as exc:
                    raise ProviderError(ProviderErrorCode.malformed, "non-JSON body") from exc
            retryable = resp.status_code == 429 or (retry_on_transport and resp.status_code in _RETRY_STATUSES)
            if retryable and attempt < self.max_attempts:
                await self.sleep(_backoff(attempt))
                continue
            log.warning("provider_http_error", extra={"method": method, "path": path, "status": resp.status_code})
            raise from_http_status(resp.status_code, resp.text)
        raise ProviderError(ProviderErrorCode.unavailable, "exhausted retries")  # pragma: no cover


def _backoff(attempt: int) -> float:
    return min(8.0, 0.75 * (2 ** (attempt - 1)))


async def _noop(_: str) -> None:
    return None
