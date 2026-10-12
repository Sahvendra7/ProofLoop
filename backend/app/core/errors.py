"""Application error type and the JSON error envelope every endpoint returns."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logging import get_logger, request_id_var

log = get_logger("proofloop.errors")


class AppError(Exception):
    """An expected failure with a stable machine code and a user-safe message."""

    def __init__(self, code: str, message: str, status_code: int = 400, hint: str | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.hint = hint


def _envelope(code: str, message: str, hint: str | None = None) -> dict:
    return {"error": {"code": code, "message": message, "hint": hint, "request_id": request_id_var.get()}}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=_envelope(exc.code, exc.message, exc.hint))

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        field = ".".join(str(part) for part in first.get("loc", []) if part not in ("body", "query"))
        message = f"Invalid value for '{field}': {first.get('msg', 'invalid')}" if field else "Invalid request."
        return JSONResponse(status_code=422, content=_envelope("invalid_request", message))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "not_found" if exc.status_code == 404 else "http_error"
        return JSONResponse(status_code=exc.status_code, content=_envelope(code, str(exc.detail)))

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled_error", extra={"error_type": type(exc).__name__})
        return JSONResponse(status_code=500, content=_envelope("internal_error", "Something went wrong on our side."))
