"""YouCam client against a scripted transport replaying live-captured responses."""

from __future__ import annotations

import httpx
import pytest

from app.domain.metrics import REQUESTED_PROVIDER_ACTIONS
from app.providers.youcam import endpoints as ep
from app.providers.youcam.errors import ProviderError, ProviderErrorCode, parse_task_error
from tests.conftest import FakeYouCam, load_fixture

pytestmark = pytest.mark.anyio


async def test_full_lifecycle_uses_documented_payloads(fake_youcam: FakeYouCam):
    stages: list[str] = []

    async def on_stage(stage: str) -> None:
        stages.append(stage)

    client = fake_youcam.client()
    result = await client.analyze_skin(b"jpegbytes", "image/jpeg", REQUESTED_PROVIDER_ACTIONS, on_stage)

    assert stages == ["registering", "uploading", "analyzing"]
    assert len(result.outputs) == 11  # 8 concerns + all, skin_age, resize_image
    assert result.units_estimated == 12

    register = fake_youcam.bodies("POST", "/s2s/v2.0/file/skin-analysis")[0]
    assert register["files"][0] == {"content_type": "image/jpeg", "file_name": "capture.jpg", "file_size": 9}

    put = next(r for r in fake_youcam.requests if r.method == "PUT")
    assert put.headers["Content-Length"] == "9"  # returned upload headers are honoured
    assert put.content == b"jpegbytes"
    assert "authorization" not in put.headers  # the API key never goes to the storage host

    task = fake_youcam.bodies("POST", "/s2s/v2.0/task/skin-analysis")[0]
    assert task == {"src_file_id": "file-123", "dst_actions": list(REQUESTED_PROVIDER_ACTIONS), "format": "json"}

    api_requests = [r for r in fake_youcam.requests if r.url.host == "youcam.test"]
    assert all(r.headers["authorization"] == "Bearer test-key" for r in api_requests)


async def test_live_face_too_small_error_is_normalised():
    fake = FakeYouCam(analysis_result=load_fixture("analysis-error-face-too-small-live.json"))
    with pytest.raises(ProviderError) as info:
        await fake.client().analyze_skin(b"x", "image/jpeg", ["moisture"])
    assert info.value.code is ProviderErrorCode.face_too_small
    assert info.value.provider_code == "error_src_face_too_small"
    assert "60%" in info.value.detail  # error_message carried through
    assert "fills most of the frame" in info.value.guidance


def test_parse_task_error_accepts_both_live_formats():
    assert parse_task_error("error_lighting_dark") == ("error_lighting_dark", "error_lighting_dark")
    assert parse_task_error("('The face area in the uploaded image is too small', 'error_src_face_too_small')") == (
        "error_src_face_too_small",
        "The face area in the uploaded image is too small",
    )
    assert parse_task_error(None)[0] == "unknown_error"


async def test_unknown_task_error_maps_to_rejected():
    fake = FakeYouCam(analysis_result={"status": 200, "data": {"task_status": "error", "error": "error_weird"}})
    with pytest.raises(ProviderError) as info:
        await fake.client().analyze_skin(b"x", "image/jpeg", ["moisture"])
    assert info.value.code is ProviderErrorCode.rejected


@pytest.mark.parametrize(
    ("status", "code"),
    [
        (401, ProviderErrorCode.auth),
        (429, ProviderErrorCode.rate_limited),
        (500, ProviderErrorCode.unavailable),
    ],
)
async def test_task_creation_http_errors(status, code):
    fake = FakeYouCam(create_status=status)
    with pytest.raises(ProviderError) as info:
        await fake.client().analyze_skin(b"x", "image/jpeg", ["moisture"])
    assert info.value.code is code


async def test_429_on_create_is_retried_then_gives_up():
    fake = FakeYouCam(create_status=429)
    with pytest.raises(ProviderError):
        await fake.client().analyze_skin(b"x", "image/jpeg", ["moisture"])
    creates = [r for r in fake.requests if r.method == "POST" and "/task/" in r.url.path]
    assert len(creates) == 3


async def test_500_on_create_is_not_retried_to_avoid_double_billing():
    fake = FakeYouCam(create_status=500)
    with pytest.raises(ProviderError):
        await fake.client().analyze_skin(b"x", "image/jpeg", ["moisture"])
    creates = [r for r in fake.requests if r.method == "POST" and "/task/" in r.url.path]
    assert len(creates) == 1


async def test_read_timeout_on_create_is_not_retried():
    fake = FakeYouCam(create_exc=httpx.ReadTimeout("slow"))
    with pytest.raises(ProviderError) as info:
        await fake.client().analyze_skin(b"x", "image/jpeg", ["moisture"])
    assert info.value.code is ProviderErrorCode.timeout
    creates = [r for r in fake.requests if r.method == "POST" and "/task/" in r.url.path]
    assert len(creates) == 1


async def test_connect_error_on_create_is_retried():
    fake = FakeYouCam(create_exc=httpx.ConnectError("refused"))
    with pytest.raises(ProviderError) as info:
        await fake.client().analyze_skin(b"x", "image/jpeg", ["moisture"])
    assert info.value.code is ProviderErrorCode.unavailable
    creates = [r for r in fake.requests if r.method == "POST" and "/task/" in r.url.path]
    assert len(creates) == 3


async def test_polling_is_bounded():
    fake = FakeYouCam(always_running=True)
    client = fake.client(timeout_s=0.0)
    with pytest.raises(ProviderError) as info:
        await client.analyze_skin(b"x", "image/jpeg", ["moisture"])
    assert info.value.code is ProviderErrorCode.timeout


async def test_success_without_results_is_malformed():
    fake = FakeYouCam(analysis_result={"status": 200, "data": {"task_status": "success", "results": None}})
    with pytest.raises(ProviderError) as info:
        await fake.client().analyze_skin(b"x", "image/jpeg", ["moisture"])
    assert info.value.code is ProviderErrorCode.malformed


async def test_unexpected_status_value_is_malformed():
    fake = FakeYouCam(analysis_result={"status": 200, "data": {"task_status": "exploded"}})
    with pytest.raises(ProviderError) as info:
        await fake.client().analyze_skin(b"x", "image/jpeg", ["moisture"])
    assert info.value.code is ProviderErrorCode.malformed


async def test_simulation_sends_flat_body_and_reads_live_shape(fake_youcam: FakeYouCam):
    result = await fake_youcam.client().simulate_skin(b"x", "image/jpeg", {"redness": 0.4})
    body = fake_youcam.bodies("POST", "/s2s/v2.0/task/skin-simulation")[0]
    assert body == {"src_file_id": "file-123", "redness": 0.4}
    assert result.image_url.endswith(".png")
    assert result.units_estimated == 4


def test_simulation_body_validation():
    with pytest.raises(ValueError):
        ep.simulation_body("f", {"moisture": 0.5})  # not a simulation concern
    with pytest.raises(ValueError):
        ep.simulation_body("f", {"redness": 0.0})  # all zero


def test_documented_price_table():
    assert ep.analysis_units(4) == 9
    assert ep.analysis_units(8) == 12
    assert ep.analysis_units(16) == 16
    assert ep.simulation_units(1) == 4
    assert ep.simulation_units(5) == 6


async def test_credit_balance_sums_grants(fake_youcam: FakeYouCam):
    assert await fake_youcam.client().credit_balance() == 928.0
