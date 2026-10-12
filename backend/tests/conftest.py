from __future__ import annotations

import io
import json
import os
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.core.config import Settings
from app.main import create_app
from app.providers.youcam.client import PollPolicy, YouCamClient

FIXTURES = Path(__file__).parent / "fixtures" / "youcam"
BASE = "https://youcam.test"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def face_jpeg(width: int = 720, height: int = 960, color=(196, 160, 140)) -> bytes:
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


@dataclass
class FakeYouCam:
    """A scripted YouCam. Records every request so tests can assert on payloads."""

    analysis_result: dict = field(default_factory=lambda: load_fixture("analysis-success-live.json"))
    running_polls: int = 1
    create_status: int = 200
    create_exc: Exception | None = None
    always_running: bool = False
    requests: list[httpx.Request] = field(default_factory=list)
    _polls: int = 0

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        path = request.url.path
        if request.method == "POST" and path.startswith("/s2s/v2.0/file/"):
            body = json.loads(request.content)
            size = body["files"][0]["file_size"]
            return httpx.Response(
                200,
                json={
                    "status": 200,
                    "data": {
                        "files": [
                            {
                                "file_id": "file-123",
                                "requests": [
                                    {
                                        "method": "PUT",
                                        "url": "https://upload.test/put?X-Amz-Signature=x",
                                        "headers": {"Content-Length": str(size), "Content-Type": "image/jpeg"},
                                    }
                                ],
                            }
                        ]
                    },
                },
            )
        if request.method == "PUT" and request.url.host == "upload.test":
            return httpx.Response(200)
        if request.method == "POST" and path.startswith("/s2s/v2.0/task/"):
            if self.create_exc is not None:
                raise self.create_exc
            if self.create_status != 200:
                return httpx.Response(self.create_status, json={"status": self.create_status, "error": "nope"})
            return httpx.Response(200, json={"status": 200, "data": {"task_id": "task-abc"}})
        if request.method == "GET" and path.startswith("/s2s/v2.0/task/skin-analysis/"):
            self._polls += 1
            if self.always_running or self._polls <= self.running_polls:
                return httpx.Response(200, json={"status": 200, "data": {"task_status": "running"}})
            return httpx.Response(200, json=self.analysis_result)
        if request.method == "GET" and path.startswith("/s2s/v2.0/task/skin-simulation/"):
            return httpx.Response(200, json=load_fixture("simulation-success-live.json"))
        if request.method == "GET" and path == "/s2s/v1.0/client/credit":
            return httpx.Response(200, json={"status": 200, "results": [{"amount": 900}, {"amount_dec": 28.0}]})
        return httpx.Response(404, json={"error": "unexpected", "path": path})

    def client(self, **poll) -> YouCamClient:
        async def no_sleep(_: float) -> None:
            return None

        return YouCamClient(
            api_key="test-key",
            base_url=BASE,
            http=httpx.AsyncClient(transport=httpx.MockTransport(self.handler)),
            poll=PollPolicy(initial_s=0.0, max_s=0.0, timeout_s=poll.get("timeout_s", 5.0)),
            sleep=no_sleep,
        )

    def bodies(self, method: str, prefix: str) -> list[dict]:
        return [json.loads(r.content) for r in self.requests if r.method == method and r.url.path.startswith(prefix)]


@pytest.fixture
def fake_youcam() -> FakeYouCam:
    return FakeYouCam()


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _fresh_postgres(url: str) -> str:
    """Rebuild the schema through the real migrations, so the suite also tests them."""
    from alembic import command
    from alembic.config import Config

    cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    cfg.attributes["database_url"] = Settings(_env_file=None, DATABASE_URL=url).database_url
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")
    return url


@pytest.fixture
def database_url(tmp_path) -> str:
    """SQLite per test by default. Set TEST_DATABASE_URL to run the suite against PostgreSQL."""
    url = os.environ.get("TEST_DATABASE_URL")
    return _fresh_postgres(url) if url else f"sqlite:///{tmp_path / 'test.db'}"


@pytest.fixture
def make_settings(database_url) -> Callable[..., Settings]:
    def _make(**overrides) -> Settings:
        values = {
            "YOUCAM_API_KEY": "test-key",
            "YOUCAM_API_URL": BASE,
            "DATABASE_URL": database_url,
            "PROVIDER_UNIT_BUDGET": 400,
            "LOG_LEVEL": "WARNING",
        }
        values.update(overrides)
        return Settings(_env_file=None, **values)

    return _make


@pytest.fixture
def api(make_settings, fake_youcam):
    """TestClient wired to a scripted YouCam and a temp SQLite database."""

    def build(fake: FakeYouCam | None = None, **settings_overrides):
        settings = make_settings(**settings_overrides)
        fake = fake or fake_youcam
        client = fake.client()
        app = create_app(settings=settings, provider_factory=lambda: client if settings.provider_configured else None)
        return TestClient(app)

    return build


def new_session(client: TestClient) -> dict[str, str]:
    token = client.post("/api/v1/sessions").json()["token"]
    return {"X-Session-Token": token}


def wait_for_scan(client: TestClient, headers: dict, scan_id: str, timeout: float = 5.0) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        body = client.get(f"/api/v1/scans/{scan_id}", headers=headers).json()
        if body["status"] != "processing":
            return body
        time.sleep(0.02)
    raise AssertionError("scan did not finish")
