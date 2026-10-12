"""Runtime configuration. Every knob lives here; nothing else reads the environment."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- YouCam provider -------------------------------------------------
    youcam_api_key: SecretStr | None = Field(default=None, alias="YOUCAM_API_KEY")
    youcam_api_url: str = Field(default="https://yce-api-01.makeupar.com", alias="YOUCAM_API_URL")
    # Docs show POST /s2s/v2.0/file; previous live integrations used the
    # feature-scoped form. Verified choice is recorded in docs/youcam-integration.md.
    youcam_file_path: str = Field(default="/s2s/v2.0/file/{feature}", alias="YOUCAM_FILE_PATH")
    youcam_http_timeout_s: float = Field(default=20.0, alias="YOUCAM_HTTP_TIMEOUT_S")
    youcam_poll_timeout_s: float = Field(default=90.0, alias="YOUCAM_POLL_TIMEOUT_S")
    youcam_poll_initial_s: float = Field(default=2.0, alias="YOUCAM_POLL_INITIAL_S")
    youcam_poll_max_s: float = Field(default=6.0, alias="YOUCAM_POLL_MAX_S")

    # --- Usage guards ----------------------------------------------------
    # Hard ceiling on provider units this deployment may spend (estimated from
    # the documented price table, reconciled against the credit endpoint).
    provider_unit_budget: int = Field(default=400, alias="PROVIDER_UNIT_BUDGET")
    live_scans_per_session_per_hour: int = Field(default=6, alias="LIVE_SCANS_PER_SESSION_PER_HOUR")
    simulations_per_session_per_hour: int = Field(default=6, alias="SIMULATIONS_PER_SESSION_PER_HOUR")
    max_concurrent_provider_jobs: int = Field(default=3, alias="MAX_CONCURRENT_PROVIDER_JOBS")

    # --- Uploads ---------------------------------------------------------
    max_upload_bytes: int = Field(default=10 * 1024 * 1024, alias="MAX_UPLOAD_BYTES")

    # --- Persistence / HTTP ----------------------------------------------
    database_url: str = Field(default=f"sqlite:///{BACKEND_DIR / 'proofloop.db'}", alias="DATABASE_URL")
    # Comma-separated in the environment (NoDecode stops pydantic-settings JSON-parsing it).
    cors_origins: Annotated[list[str], NoDecode] = Field(default=["http://localhost:3000"], alias="CORS_ORIGINS")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    # "production" refuses to start on SQLite: a hosted container's disk is ephemeral.
    app_env: str = Field(default="development", alias="APP_ENV")

    @field_validator("database_url", mode="after")
    @classmethod
    def _psycopg_driver(cls, value: str) -> str:
        # Hosted Postgres providers hand out postgres:// or postgresql:// URLs; SQLAlchemy needs the driver named.
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix) :]
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip().startswith("["):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() == "production"

    @property
    def provider_configured(self) -> bool:
        key = self.youcam_api_key.get_secret_value() if self.youcam_api_key else ""
        return bool(key) and key not in {"your_api_key_here", "demo_key"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
