"""ProofLoop API application factory."""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1 import assistant, catalog, scans, system, trials
from app.core.config import Settings, get_settings
from app.core.errors import install_error_handlers
from app.core.logging import RequestContextMiddleware, configure_logging, get_logger
from app.db.session import get_engine, init_engine
from app.domain.catalog import load_catalog
from app.providers.youcam.client import PollPolicy, YouCamClient
from app.services.assistant.limits import AskLimiter
from app.services.demo import load_fixture
from app.services.scans import ScanJobRunner, recover_interrupted_scans

log = get_logger("proofloop.app")


def _default_provider_factory(settings: Settings) -> Callable[[], YouCamClient | None]:
    client: YouCamClient | None = None

    def factory() -> YouCamClient | None:
        nonlocal client
        if not settings.provider_configured:
            return None
        if client is None:
            client = YouCamClient(
                api_key=settings.youcam_api_key.get_secret_value(),  # type: ignore[union-attr]
                base_url=settings.youcam_api_url,
                file_path_template=settings.youcam_file_path,
                poll=PollPolicy(
                    initial_s=settings.youcam_poll_initial_s,
                    max_s=settings.youcam_poll_max_s,
                    timeout_s=settings.youcam_poll_timeout_s,
                ),
            )
        return client

    return factory


def create_app(
    settings: Settings | None = None,
    provider_factory: Callable[[], YouCamClient | None] | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    if settings.is_production and settings.database_url.startswith("sqlite"):
        # Container disks are ephemeral: trials would silently vanish on the next restart.
        raise RuntimeError("APP_ENV=production requires DATABASE_URL to point at PostgreSQL, not SQLite.")

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        init_engine(settings.database_url)
        load_catalog()  # fail fast on an invalid catalogue
        load_fixture()
        recovered = recover_interrupted_scans()
        log.info(
            "startup",
            extra={"provider_configured": settings.provider_configured, "recovered_scans": recovered},
        )
        yield
        await app.state.job_runner.drain()
        await app.state.gemini_http.aclose()
        client = app.state.provider_factory()
        if client is not None:
            await client.aclose()

    app = FastAPI(
        title="ProofLoop API",
        version="2.0.0",
        description="A fair test for your skincare: YouCam skin measurements, explainable matches, honest progress.",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.provider_factory = provider_factory or _default_provider_factory(settings)
    app.state.job_runner = ScanJobRunner(app.state.provider_factory, settings.max_concurrent_provider_jobs)
    # Trial assistant: Gemini is only ever called for free text, behind GEMINI_FREE_TEXT_ENABLED.
    app.state.gemini_http = httpx.AsyncClient()
    app.state.ask_limiter = AskLimiter(settings.assistant_asks_per_session_per_hour, settings.assistant_asks_per_day)

    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type", "X-Session-Token", "Idempotency-Key", "X-Request-ID", "Authorization"],
        expose_headers=["X-Request-ID"],
    )
    install_error_handlers(app)

    for module in (system, scans, catalog, trials, assistant):
        app.include_router(module.router, prefix="/api/v1")

    @app.get("/health", tags=["system"])
    def health() -> dict:
        # Deliberately database-free: platform health pings must not keep a scale-to-zero database awake.
        return {"status": "ok", "provider_configured": settings.provider_configured}

    @app.get("/health/ready", tags=["system"])
    def ready() -> JSONResponse:
        """Readiness: the database answers and its schema matches the code."""
        try:
            with get_engine().connect() as conn:
                conn.execute(text("SELECT 1"))
                schema = (
                    "managed by create_all"
                    if conn.dialect.name == "sqlite"
                    else conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one_or_none()
                )
        except Exception as exc:  # report, never leak details
            log.warning("readiness_failed", extra={"error_type": type(exc).__name__})
            return JSONResponse(status_code=503, content={"status": "unavailable", "database": "unreachable"})
        return JSONResponse(
            content={
                "status": "ok",
                "database": get_engine().dialect.name,
                "schema_revision": schema,
                "provider_configured": settings.provider_configured,
            }
        )

    return app


app = create_app()
