"""Opt-in smoke tests against the real YouCam API.

    YOUCAM_LIVE=1 pytest -m live                     # auth + credit read, spends 0 units
    YOUCAM_LIVE=1 YOUCAM_LIVE_IMAGE=face.jpg pytest -m live   # + one analysis, spends 12 units

The image must be a front-facing photo where the face fills >60% of the width.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.core.config import Settings
from app.domain.metrics import REQUESTED_PROVIDER_ACTIONS
from app.domain.normalize import normalize_outputs
from app.providers.youcam.client import YouCamClient
from app.services.imaging import prepare_image

pytestmark = [
    pytest.mark.live,
    pytest.mark.anyio,
    pytest.mark.skipif(os.environ.get("YOUCAM_LIVE") != "1", reason="live tests are opt-in (YOUCAM_LIVE=1)"),
]


@pytest.fixture
def live_client():
    settings = Settings()
    if not settings.provider_configured:
        pytest.skip("YOUCAM_API_KEY not configured")
    return YouCamClient(
        api_key=settings.youcam_api_key.get_secret_value(),
        base_url=settings.youcam_api_url,
        file_path_template=settings.youcam_file_path,
    )


async def test_live_auth_and_credit(live_client):
    balance = await live_client.credit_balance()
    assert balance >= 0
    await live_client.aclose()


async def test_live_analysis(live_client):
    image_path = os.environ.get("YOUCAM_LIVE_IMAGE")
    if not image_path:
        pytest.skip("set YOUCAM_LIVE_IMAGE to spend 12 units on a real analysis")
    prepared = prepare_image(Path(image_path).read_bytes())
    result = await live_client.analyze_skin(prepared.data, prepared.content_type, REQUESTED_PROVIDER_ACTIONS)
    normalized = normalize_outputs(result.outputs, result.requested_actions)
    assert len(normalized.readings) == len(REQUESTED_PROVIDER_ACTIONS)
    await live_client.aclose()
