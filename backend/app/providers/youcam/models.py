"""Typed views of YouCam responses. Unknown fields are ignored; required ones are validated."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class _Lenient(BaseModel):
    model_config = ConfigDict(extra="ignore")


class UploadRequest(_Lenient):
    url: str
    method: str = "PUT"
    headers: dict[str, str] = Field(default_factory=dict)


class RegisteredFile(_Lenient):
    file_id: str
    requests: list[UploadRequest] = Field(min_length=1)


class FileData(_Lenient):
    files: list[RegisteredFile] = Field(min_length=1)


class FileResponse(_Lenient):
    # v2.0 replies under "data"; older generations used "result".
    data: FileData | None = None
    result: FileData | None = None

    def first(self) -> RegisteredFile:
        payload = self.data or self.result
        if payload is None:
            raise ValueError("file response has neither data nor result")
        return payload.files[0]


class TaskCreated(_Lenient):
    task_id: str = Field(min_length=1)


class TaskCreateResponse(_Lenient):
    data: TaskCreated


class SkinOutput(_Lenient):
    type: str
    ui_score: float | None = None
    raw_score: float | None = None
    score: float | None = None
    mask_urls: list[str] = Field(default_factory=list)
    # Only on `skin_type` entries (verified live 2026-10-26): one per region with a label string.
    # Typed loosely so one odd value can't fail the whole response; domain.profile validates them.
    region: Any = None
    skin_type: Any = None


class AnalysisResults(_Lenient):
    output: list[SkinOutput] = Field(default_factory=list)


class AnalysisPoll(_Lenient):
    task_status: Literal["running", "success", "error"]
    # Live (2026-10-11): error is a bare code with a separate error_message.
    # Earlier captures (2026-07) used a stringified "('message', 'code')" tuple.
    error: str | None = None
    error_message: str | None = None
    results: AnalysisResults | None = None


class AnalysisPollResponse(_Lenient):
    data: AnalysisPoll


class SimulationPoll(_Lenient):
    task_status: Literal["running", "success", "error"]
    error: str | None = None
    error_message: str | None = None
    # The GET schema documents a top-level `url`; we accept the common placements.
    url: str | None = None
    results: dict | list | None = None


class SimulationPollResponse(_Lenient):
    data: SimulationPoll

    def result_url(self) -> str | None:
        d = self.data
        if d.url:
            return d.url
        res = d.results
        if isinstance(res, dict):
            if isinstance(res.get("url"), str):
                return res["url"]
            res = res.get("output") or []
        if isinstance(res, list):
            for item in res:
                if isinstance(item, dict):
                    if isinstance(item.get("url"), str):
                        return item["url"]
                    urls = item.get("mask_urls") or item.get("urls")
                    if isinstance(urls, list) and urls and isinstance(urls[0], str):
                        return urls[0]
        return None


class CreditGrant(_Lenient):
    amount: float | None = None
    amount_dec: float | None = None
    expiry: int | None = None


class CreditResponse(_Lenient):
    results: list[CreditGrant] = Field(default_factory=list)

    def total(self) -> float:
        return sum(float(g.amount_dec if g.amount_dec is not None else (g.amount or 0)) for g in self.results)
