"""The fair-test protocol: detectability, registered bands, and the free capture preflight."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine, text

from app.domain.compare import (
    CONSERVATIVE_BAND,
    MEASURED_BANDS,
    NOISE_BANDS,
    CaptureInfo,
    band_evidence,
    compare,
    compare_metric,
    detectability,
)
from tests.conftest import face_jpeg, new_session, wait_for_scan
from tests.test_api import V1, upload

T0 = datetime(2026, 10, 1, tzinfo=UTC)


def cap(lum=85.0, source="camera", days=0) -> CaptureInfo:
    return CaptureInfo(luminance_mean=lum, source=source, captured_at=T0 + timedelta(days=days))


# ------------------------------------------------------------ noise bands --
def test_uncharacterised_concerns_get_the_widest_measured_band():
    assert CONSERVATIVE_BAND == max(MEASURED_BANDS.values()) == 7
    for metric in ("acne", "oiliness", "redness"):
        assert NOISE_BANDS[metric] == CONSERVATIVE_BAND
        assert band_evidence(metric) == "assumed"
    for metric in MEASURED_BANDS:
        assert band_evidence(metric) == "measured"


def test_assumed_band_is_never_narrower_than_any_measured_band():
    # Guards against a future edit quietly re-introducing an optimistic guess.
    assumed = [m for m in NOISE_BANDS if band_evidence(m) == "assumed"]
    assert all(NOISE_BANDS[m] >= max(MEASURED_BANDS.values()) for m in assumed)


def test_change_carries_band_evidence():
    assert compare_metric("acne", 90, 84).band_evidence == "assumed"
    assert compare_metric("acne", 90, 84).verdict == "within_variation"  # -6 inside the conservative 7
    assert compare_metric("moisture", 60, 66).band_evidence == "measured"


# ---------------------------------------------------------- detectability --
@pytest.mark.parametrize(
    ("metric", "baseline", "improve_at", "decline_at", "kind"),
    [
        ("moisture", 69, 75, 63, "both"),  # band 5
        ("redness", 99, None, 91, "decline_only"),  # band 7: 107 is off the scale
        ("radiance", 96, 100, 92, "both"),  # band 3: 100 is still reachable
        ("radiance", 97, None, 93, "decline_only"),
        ("pore", 4, 12, None, "improve_only"),
        ("moisture", 94, 100, 88, "both"),
    ],
)
def test_detectability_lines(metric, baseline, improve_at, decline_at, kind):
    d = detectability(metric, baseline)
    assert (d.improve_at, d.decline_at, d.detectable) == (improve_at, decline_at, kind)


def test_detectability_lines_match_the_verdict_rule():
    # The lines must be exactly where compare_metric starts calling a change.
    for metric in NOISE_BANDS:
        for baseline in (1, 30, 69, 93, 99):
            d = detectability(metric, baseline)
            if d.improve_at is not None:
                assert compare_metric(metric, baseline, d.improve_at).verdict == "better"
                assert compare_metric(metric, baseline, d.improve_at - 1).verdict == "within_variation"
            if d.decline_at is not None:
                assert compare_metric(metric, baseline, d.decline_at).verdict == "worse"
                assert compare_metric(metric, baseline, d.decline_at + 1).verdict == "within_variation"


def test_registered_band_overrides_current_table_for_focus_only():
    # A trial registered with band 5 keeps it even if the table later says 7.
    result = compare(
        {"pore": 70, "texture": 70}, {"pore": 76, "texture": 76}, cap(), cap(days=28), "pore", focus_band=5
    )
    by = {c.metric: c for c in result.changes}
    assert by["pore"].noise_band == 5 and by["pore"].verdict == "better"
    assert by["texture"].noise_band == NOISE_BANDS["texture"] and by["texture"].verdict == "within_variation"
    assert result.focus_outcome == "measured_improvement"


# ----------------------------------------------------------------- API ----
def _live_trial(client, h, goal="hydration"):
    scan = wait_for_scan(client, h, upload(client, h).json()["id"])
    r = client.post(
        f"{V1}/trials", headers=h, json={"scan_id": scan["id"], "goal": goal, "product_id": "thale-water-reserve"}
    )
    assert r.status_code == 201, r.text
    return scan, r.json()


def test_scan_metrics_expose_what_would_count(api):
    with api() as client:
        h = new_session(client)
        scan = client.post(f"{V1}/scans/demo", headers=h).json()
        by = {m["key"]: m for m in scan["metrics"]}
        assert (by["moisture"]["improve_at"], by["moisture"]["decline_at"]) == (75, 63)
        assert by["moisture"]["band_evidence"] == "measured"
        assert by["redness"]["detectable"] == "decline_only" and by["redness"]["improve_at"] is None
        assert by["redness"]["band_evidence"] == "assumed"


def test_trial_registers_its_protocol(api):
    with api() as client:
        h = new_session(client)
        scan, trial = _live_trial(client, h)
        proto = trial["protocol"]
        assert proto["registered"] is True
        assert proto["focus_metric"] == "moisture" and proto["baseline_score"] == 69
        assert (proto["noise_band"], proto["improve_at"], proto["decline_at"]) == (5, 75, 63)
        assert proto["band_evidence"] == "measured" and proto["detectable"] == "both"
        assert proto["planned_checkin_days"] == 28
        planned = datetime.fromisoformat(proto["planned_checkin_at"])
        observed = datetime.fromisoformat(scan["observed_at"])
        assert abs((planned - observed) - timedelta(days=28)) < timedelta(seconds=1)
        assert proto["baseline_capture"]["source"] == "camera"
        assert proto["baseline_capture"]["luminance_mean"] == scan["capture"]["luminance_mean"]


def test_registered_band_survives_a_table_change(api, database_url, monkeypatch):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)
        # Recalibration after the trial started must not move its goalposts.
        monkeypatch.setitem(NOISE_BANDS, "moisture", 9)
        again = client.get(f"{V1}/trials/{trial['id']}", headers=h).json()
        assert again["protocol"]["noise_band"] == 5 and again["focus_noise_band"] == 5


def test_trial_from_before_protocols_falls_back_and_says_so(api, database_url):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)
        engine = create_engine(database_url)
        with engine.begin() as conn:
            conn.execute(
                text(
                    "UPDATE trials SET focus_band = NULL, band_evidence = NULL, planned_checkin_days = NULL WHERE id = :id"
                ),
                {"id": trial["id"]},
            )
        engine.dispose()
        legacy = client.get(f"{V1}/trials/{trial['id']}", headers=h).json()
        assert legacy["protocol"]["registered"] is False
        assert legacy["protocol"]["noise_band"] == NOISE_BANDS["moisture"]
        assert legacy["protocol"]["planned_checkin_days"] == 28


def test_ceiling_focus_can_only_show_a_decline(api):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h, goal="calm_redness")
        proto = trial["protocol"]
        assert proto["baseline_score"] == 99 and proto["detectable"] == "decline_only"
        assert proto["improve_at"] is None and proto["decline_at"] == 91


def _preflight(client, h, trial_id, image=None, source="camera"):
    return client.post(
        f"{V1}/trials/{trial_id}/preflight",
        headers=h,
        data={"source": source},
        files={"image": ("me.jpg", image or face_jpeg(), "image/jpeg")},
    )


def test_preflight_is_free_and_stores_nothing(api, fake_youcam):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)
        calls_before = len(fake_youcam.requests)
        committed_before = client.get(f"{V1}/system/status").json()["budget"]["committed"]
        scans_before = len(client.get(f"{V1}/scans", headers=h).json())

        r = _preflight(client, h, trial["id"])
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["level"] == "good" and body["units_spent"] == 0
        assert body["early"] is True and body["days_since_baseline"] < 1
        assert any("less than a week" in i for i in body["issues"])
        assert body["candidate_capture"]["luminance_mean"] == body["baseline_capture"]["luminance_mean"]

        assert len(fake_youcam.requests) == calls_before  # no provider traffic at all
        assert client.get(f"{V1}/system/status").json()["budget"]["committed"] == committed_before
        assert len(client.get(f"{V1}/scans", headers=h).json()) == scans_before


def test_preflight_flags_lighting_and_capture_mismatch(api):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)  # baseline: camera, luminance of (196,160,140)
        darker = face_jpeg(color=(120, 95, 80))
        body = _preflight(client, h, trial["id"], image=darker, source="upload").json()
        assert body["level"] == "poor"
        assert any("lighting" in i for i in body["issues"])
        assert any("uploaded" in i for i in body["issues"])


def test_preflight_rejects_unusable_photo_before_any_spend(api):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)
        r = _preflight(client, h, trial["id"], image=face_jpeg(color=(8, 8, 8)))
        assert r.status_code == 422 and r.json()["error"]["code"] == "too_dark"
        r = _preflight(client, h, trial["id"], image=face_jpeg(width=320, height=400))
        assert r.status_code == 422 and r.json()["error"]["code"] == "image_too_small"


def test_preflight_respects_ownership_and_provenance(api):
    with api() as client:
        owner = new_session(client)
        _, trial = _live_trial(client, owner)
        stranger = new_session(client)
        assert _preflight(client, stranger, trial["id"]).status_code == 404

        demo_scan = client.post(f"{V1}/scans/demo", headers=owner).json()
        demo_trial = client.post(
            f"{V1}/trials",
            headers=owner,
            json={"scan_id": demo_scan["id"], "goal": "hydration", "product_id": "thale-water-reserve"},
        ).json()
        r = _preflight(client, owner, demo_trial["id"])
        assert r.status_code == 409 and r.json()["error"]["code"] == "provenance_mismatch"

        r = _preflight(client, owner, trial["id"], source="screenshot")
        assert r.status_code == 422


def test_concurrent_preflights_do_not_deadlock(api):
    """Regression: React StrictMode sends the preflight twice at once in development. As an
    `async def` endpoint its blocking SQLite flush stalled the event loop until the lock timed out."""
    import asyncio
    import time

    import httpx

    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)

        async def both():
            transport = httpx.ASGITransport(app=client.app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:

                def post():
                    return ac.post(
                        f"{V1}/trials/{trial['id']}/preflight",
                        headers=h,
                        data={"source": "camera"},
                        files={"image": ("me.jpg", face_jpeg(), "image/jpeg")},
                    )

                return await asyncio.gather(post(), post())

        started = time.monotonic()
        responses = asyncio.run(both())
        assert [r.status_code for r in responses] == [200, 200]
        assert time.monotonic() - started < 3  # the stalled version took the 5 s busy timeout
