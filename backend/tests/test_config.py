from app.core.config import Settings


def test_cors_origins_accepts_comma_separated_env(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000, https://proofloop.example")
    settings = Settings(_env_file=None)
    assert settings.cors_origins == ["http://localhost:3000", "https://proofloop.example"]


def test_placeholder_key_is_not_configured():
    assert Settings(_env_file=None, YOUCAM_API_KEY="your_api_key_here").provider_configured is False
    assert Settings(_env_file=None, YOUCAM_API_KEY="").provider_configured is False
    assert Settings(_env_file=None, YOUCAM_API_KEY="real-looking-key").provider_configured is True


def test_hosted_postgres_urls_get_the_psycopg_driver():
    for given in ("postgres://u:p@db.example/app?sslmode=require", "postgresql://u:p@db.example/app?sslmode=require"):
        url = Settings(_env_file=None, DATABASE_URL=given).database_url
        assert url == "postgresql+psycopg://u:p@db.example/app?sslmode=require"
    assert Settings(_env_file=None, DATABASE_URL="sqlite:///x.db").database_url == "sqlite:///x.db"


def test_production_refuses_to_start_on_sqlite(tmp_path):
    import pytest

    from app.main import create_app

    settings = Settings(_env_file=None, APP_ENV="production", DATABASE_URL=f"sqlite:///{tmp_path / 'x.db'}")
    with pytest.raises(RuntimeError, match="requires DATABASE_URL"):
        create_app(settings=settings)


def test_readiness_reports_the_database(api):
    client = api()
    with client:
        body = client.get("/health/ready").json()
    assert body["status"] == "ok"
    assert body["database"] in {"sqlite", "postgresql"}
