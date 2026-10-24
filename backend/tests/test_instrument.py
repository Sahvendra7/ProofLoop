"""Instrument check (repeat baseline), the identical-photo guard, and the next step after a verdict."""

from __future__ import annotations

import copy

import pytest
from sqlalchemy import create_engine, text

from app.domain.compare import (
    NOISE_BANDS,
    PERSONAL_MARGIN,
    instrument_check,
    next_step,
    personal_band,
)
from tests.conftest import face_jpeg, load_fixture, new_session, wait_for_scan
from tests.test_api import V1, upload

OTHER_PHOTO = face_jpeg(color=(190, 156, 136))  # a different photo of "the same face"
THIRD_PHOTO = face_jpeg(color=(200, 162, 142))


# ------------------------------------------------------------- domain ----
@pytest.mark.parametrize("table", range(0, 15))
@pytest.mark.parametrize("spread", [None, *range(0, 40)])
def test_personal_band_never_narrows(table, spread):
    band = personal_band(table, spread)
    assert band >= table
    if spread is not None:
        assert band >= spread + PERSONAL_MARGIN or band == table
        assert band == max(table, spread + PERSONAL_MARGIN)
    else:
        assert band == table


def test_instrument_check_widens_only_when_the_repeat_disagrees():
    base = {"moisture": 69, "pore": 79, "acne": 99}
    agree = instrument_check(base, {"moisture": 72, "pore": 84, "acne": 99}, "moisture", 5)
    assert (agree.spread, agree.personal_band, agree.widened) == (3, 5, False)
    # pore +5 is reported as context but doesn't touch the focus band
    assert {c.metric: c.delta for c in agree.changes}["pore"] == 5

    disagree = instrument_check(base, {"moisture": 63, "pore": 79, "acne": 99}, "moisture", 5)
    assert (disagree.spread, disagree.personal_band, disagree.widened) == (6, 8, True)


def test_instrument_check_without_a_focus_reading_changes_nothing():
    check = instrument_check({"pore": 79}, {"pore": 80}, "moisture", 5)
    assert check.spread is None and check.personal_band == 5 and not check.widened


@pytest.mark.parametrize(
    ("outcome", "early", "detectable", "action"),
    [
        ("insufficient_data", False, "both", "retake"),
        ("inconclusive", True, "both", "retake"),
        ("measured_decline", True, "both", "pause_and_review"),
        ("measured_decline", False, "decline_only", "pause_and_review"),
        ("measured_improvement", True, "both", "finish_the_test"),
        ("measured_improvement", False, "both", "keep_going"),
        ("no_clear_change", True, "both", "finish_the_test"),
        ("no_clear_change", False, "both", "consider_switching"),
        ("no_clear_change", False, "improve_only", "consider_switching"),
        ("no_clear_change", False, "decline_only", "nothing_to_gain"),
        ("no_clear_change", False, "neither", "nothing_to_gain"),
    ],
)
def test_next_step_follows_the_plan(outcome, early, detectable, action):
    assert next_step(outcome, early, detectable) == action


# ---------------------------------------------------------------- API ----
def _fixture_with(**scores) -> dict:
    """The recorded live analysis with some ui_scores replaced (keyed by provider type)."""
    data = copy.deepcopy(load_fixture("analysis-success-live.json"))
    for item in data["data"]["results"]["output"]:
        if item["type"] in scores:
            item["ui_score"] = scores[item["type"]]
    return data


def _live_trial(client, h, goal="hydration"):
    scan = wait_for_scan(client, h, upload(client, h).json()["id"])
    r = client.post(
        f"{V1}/trials", headers=h, json={"scan_id": scan["id"], "goal": goal, "product_id": "thale-water-reserve"}
    )
    assert r.status_code == 201, r.text
    return scan, r.json()


def _repeat(client, h, trial_id, image=OTHER_PHOTO):
    return client.post(
        f"{V1}/scans",
        headers=h,
        data={"consent": "true", "source": "camera", "trial_id": trial_id, "purpose": "repeat_baseline"},
        files={"image": ("me.jpg", image, "image/jpeg")},
    )


def _committed(client) -> int:
    return client.get(f"{V1}/system/status").json()["budget"]["committed"]


def test_new_trial_offers_the_instrument_check(api):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)
        check = trial["protocol"]["instrument_check"]
        assert check["status"] == "available" and check["units"] == 12 and check["sample"] is False
        assert check["table_band"] == 5 and check["personal_band"] is None and check["changes"] == []


def test_live_repeat_that_disagrees_widens_the_band_and_moves_the_lines(api, fake_youcam):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)  # moisture 69, band 5
        fake_youcam.analysis_result = _fixture_with(moisture=75)
        r = _repeat(client, h, trial["id"])
        assert r.status_code == 202, r.text
        wait_for_scan(client, h, r.json()["id"])

        t = client.get(f"{V1}/trials/{trial['id']}", headers=h).json()
        check, proto = t["protocol"]["instrument_check"], t["protocol"]
        assert check["status"] == "complete" and check["spread"] == 6
        assert check["personal_band"] == 8 and check["widened"] is True and check["sealed"] is False
        assert len(check["changes"]) == 8
        assert (proto["noise_band"], proto["improve_at"], proto["decline_at"]) == (8, 78, 60)
        assert proto["band_evidence"] == "personal" and t["focus_noise_band"] == 8
        # The repeat is not a check-in
        assert t["checkins"] == [] and t["comparison"] is None
        summary = client.get(f"{V1}/trials", headers=h).json()[0]
        assert summary["checkin_count"] == 0


def test_live_repeat_that_agrees_keeps_the_band(api, fake_youcam):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)
        fake_youcam.analysis_result = _fixture_with(moisture=71)
        wait_for_scan(client, h, _repeat(client, h, trial["id"]).json()["id"])
        proto = client.get(f"{V1}/trials/{trial['id']}", headers=h).json()["protocol"]
        assert proto["instrument_check"]["spread"] == 2 and proto["instrument_check"]["widened"] is False
        assert proto["noise_band"] == 5 and proto["band_evidence"] == "measured"


def test_check_in_is_judged_against_the_personal_band_and_seals_it(api, fake_youcam, database_url):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)
        fake_youcam.analysis_result = _fixture_with(moisture=75)
        repeat = wait_for_scan(client, h, _repeat(client, h, trial["id"]).json()["id"])
        # +7 would clear the table band (5) but not the personal band (8)
        fake_youcam.analysis_result = _fixture_with(moisture=76)
        wait_for_scan(client, h, upload(client, h, trial_id=trial["id"], image=THIRD_PHOTO).json()["id"])
        t = client.get(f"{V1}/trials/{trial['id']}", headers=h).json()
        assert t["comparison"]["focus_outcome"] == "no_clear_change"
        focus = next(c for c in t["comparison"]["changes"] if c["metric"] == "moisture")
        assert focus["noise_band"] == 8 and focus["band_evidence"] == "personal"
        assert t["protocol"]["instrument_check"]["sealed"] is True

        # Deleting the repeat scan after sealing can't narrow the band back
        assert client.delete(f"{V1}/scans/{repeat['id']}", headers=h).status_code == 204
        after = client.get(f"{V1}/trials/{trial['id']}", headers=h).json()
        assert after["protocol"]["noise_band"] == 8 and after["comparison"]["focus_outcome"] == "no_clear_change"
        engine = create_engine(database_url)
        with engine.connect() as conn:
            spread = conn.execute(text("SELECT repeat_spread FROM trials WHERE id = :id"), {"id": trial["id"]}).scalar()
        engine.dispose()
        assert spread == 6


def test_repeat_refused_after_a_check_in_and_without_spending(api, fake_youcam):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)
        wait_for_scan(client, h, upload(client, h, trial_id=trial["id"], image=THIRD_PHOTO).json()["id"])
        before = _committed(client)
        r = _repeat(client, h, trial["id"])
        assert r.status_code == 409 and r.json()["error"]["code"] == "protocol_sealed"
        assert _committed(client) == before
        check = client.get(f"{V1}/trials/{trial['id']}", headers=h).json()["protocol"]["instrument_check"]
        assert check["status"] == "unavailable" and check["unavailable_reason"] == "sealed"


def test_only_one_repeat_but_a_failed_one_can_be_retried(api, fake_youcam):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)
        fake_youcam.create_status = 500
        failed = wait_for_scan(client, h, _repeat(client, h, trial["id"]).json()["id"])
        assert failed["status"] == "failed"
        check = client.get(f"{V1}/trials/{trial['id']}", headers=h).json()["protocol"]["instrument_check"]
        assert check["status"] == "failed" and check["personal_band"] is None

        fake_youcam.create_status = 200
        ok = _repeat(client, h, trial["id"], image=THIRD_PHOTO)
        assert ok.status_code == 202, ok.text
        wait_for_scan(client, h, ok.json()["id"])
        r = _repeat(client, h, trial["id"], image=face_jpeg(color=(170, 140, 120)))
        assert r.status_code == 409 and r.json()["error"]["code"] == "repeat_exists"


def test_check_in_refused_while_the_repeat_is_running(api, database_url):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)
        repeat = wait_for_scan(client, h, _repeat(client, h, trial["id"]).json()["id"])
        # The scripted provider never yields mid-poll, so hold the repeat in "processing" directly.
        engine = create_engine(database_url)
        with engine.begin() as conn:
            conn.execute(text("UPDATE scans SET status = 'processing' WHERE id = :id"), {"id": repeat["id"]})
        engine.dispose()
        before = _committed(client)
        r = upload(client, h, trial_id=trial["id"], image=THIRD_PHOTO)
        assert r.status_code == 409 and r.json()["error"]["code"] == "repeat_in_progress"
        assert _committed(client) == before


def test_identical_photo_is_refused_for_free(api, fake_youcam):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)  # baseline used face_jpeg()
        calls, before = len(fake_youcam.requests), _committed(client)
        for r in (_repeat(client, h, trial["id"], image=face_jpeg()), upload(client, h, trial_id=trial["id"])):
            assert r.status_code == 409 and r.json()["error"]["code"] == "same_photo"
        assert len(fake_youcam.requests) == calls and _committed(client) == before

        pre = client.post(
            f"{V1}/trials/{trial['id']}/preflight",
            headers=h,
            data={"source": "camera"},
            files={"image": ("me.jpg", face_jpeg(), "image/jpeg")},
        ).json()
        assert pre["same_photo"] is True and pre["level"] == "poor"
        other = client.post(
            f"{V1}/trials/{trial['id']}/preflight",
            headers=h,
            data={"source": "camera"},
            files={"image": ("me.jpg", OTHER_PHOTO, "image/jpeg")},
        ).json()
        assert other["same_photo"] is False


def test_repeat_needs_a_trial_and_a_known_purpose(api):
    with api() as client:
        h = new_session(client)
        r = client.post(
            f"{V1}/scans",
            headers=h,
            data={"consent": "true", "source": "camera", "purpose": "repeat_baseline"},
            files={"image": ("me.jpg", OTHER_PHOTO, "image/jpeg")},
        )
        assert r.status_code == 422
        r = client.post(
            f"{V1}/scans",
            headers=h,
            data={"consent": "true", "source": "camera", "purpose": "warmup"},
            files={"image": ("me.jpg", OTHER_PHOTO, "image/jpeg")},
        )
        assert r.status_code == 422


def test_sample_trial_replays_the_recorded_repeat(api, fake_youcam):
    with api() as client:
        h = new_session(client)
        scan = client.post(f"{V1}/scans/demo", headers=h).json()
        trial = client.post(
            f"{V1}/trials",
            headers=h,
            json={"scan_id": scan["id"], "goal": "refine_pores", "product_id": "thale-water-reserve"},
        ).json()
        assert trial["protocol"]["instrument_check"]["units"] == 0
        assert trial["protocol"]["instrument_check"]["sample"] is True
        calls = len(fake_youcam.requests)
        t = client.post(f"{V1}/trials/{trial['id']}/demo-repeat", headers=h)
        assert t.status_code == 201, t.text
        check = t.json()["protocol"]["instrument_check"]
        assert len(fake_youcam.requests) == calls
        assert check["status"] == "complete" and "recorded" in check["note"].lower()
        deltas = {c["metric"]: c["delta"] for c in check["changes"]}
        assert deltas == {
            "moisture": 3,
            "oiliness": 0,
            "redness": 0,
            "texture": 3,
            "pore": 5,
            "acne": 0,
            "radiance": 1,
            "dark_circle": 0,
        }
        # pores +5 → 5 + 2 = 7, exactly the table band: no widening
        assert check["spread"] == 5 and check["personal_band"] == NOISE_BANDS["pore"] and check["widened"] is False

        again = client.post(f"{V1}/trials/{trial['id']}/demo-repeat", headers=h)
        assert again.status_code == 409 and again.json()["error"]["code"] == "repeat_exists"

        # The synthetic follow-up seals the plan and carries a next step
        done = client.post(f"{V1}/trials/{trial['id']}/demo-checkin", headers=h).json()
        assert done["protocol"]["instrument_check"]["sealed"] is True
        assert done["comparison"]["next_step"]["action"] == "finish_the_test"  # day 21 of 28, pores 0 change
        assert done["comparison"]["next_step"]["goal"] == "refine_pores"


def test_live_trial_cannot_take_the_sample_repeat(api):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)
        r = client.post(f"{V1}/trials/{trial['id']}/demo-repeat", headers=h)
        assert r.status_code == 409 and r.json()["error"]["code"] == "provenance_mismatch"


def test_repeat_respects_ownership(api):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)
        other = new_session(client)
        assert _repeat(client, other, trial["id"]).status_code == 404
        assert client.post(f"{V1}/trials/{trial['id']}/demo-repeat", headers=other).status_code == 404


def test_preflight_for_an_instrument_check_does_not_expect_weeks_to_pass(api):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)

        def pre(purpose):
            return client.post(
                f"{V1}/trials/{trial['id']}/preflight",
                headers=h,
                data={"source": "camera", "purpose": purpose},
                files={"image": ("me.jpg", OTHER_PHOTO, "image/jpeg")},
            )

        assert any("less than a week" in i for i in pre("checkin").json()["issues"])
        assert not any("less than a week" in i for i in pre("repeat_baseline").json()["issues"])
        assert pre("warmup").status_code == 422


# ----------------------------------------------------------- concurrency --
def _commit_rival_repeat(database_url: str, trial_id: str) -> None:
    """Another request wins the race: its repeat is committed while this request is mid-flight."""
    from sqlalchemy.orm import Session as SASession

    from app.db.models import ScanRow, TrialRow

    engine = create_engine(database_url)
    with SASession(engine) as other:
        t = other.get(TrialRow, trial_id)
        rival = ScanRow(
            session_id=t.session_id,
            provenance="youcam",
            status="processing",
            stage="queued",
            source="camera",
            requested_metrics="[]",
            units_estimated=12,
        )
        other.add(rival)
        other.flush()
        t.repeat_scan_id = rival.id
        other.commit()
    engine.dispose()


def _race_during_upload(monkeypatch, database_url: str, trial_id: str) -> None:
    # The route loads the trial, then awaits the upload; the rival commits in that window.
    from app.api.v1 import scans as scans_route

    real = scans_route.prepare_image

    def racing_prepare(raw):
        _commit_rival_repeat(database_url, trial_id)
        return real(raw)

    monkeypatch.setattr(scans_route, "prepare_image", racing_prepare)


def test_concurrent_repeat_is_refused_and_not_billed(api, database_url, monkeypatch, fake_youcam):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)
        before, calls = _committed(client), len(fake_youcam.requests)
        _race_during_upload(monkeypatch, database_url, trial["id"])
        r = _repeat(client, h, trial["id"])
        assert r.status_code == 409 and r.json()["error"]["code"] == "repeat_exists"
        assert _committed(client) == before and len(fake_youcam.requests) == calls


def test_check_in_racing_a_new_repeat_is_refused(api, database_url, monkeypatch):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)
        before = _committed(client)
        _race_during_upload(monkeypatch, database_url, trial["id"])
        r = upload(client, h, trial_id=trial["id"], image=THIRD_PHOTO)
        assert r.status_code == 409 and r.json()["error"]["code"] == "repeat_in_progress"
        assert _committed(client) == before


def test_retrying_a_repeat_with_the_same_key_returns_it_without_billing_again(api):
    with api() as client:
        h = new_session(client)
        _, trial = _live_trial(client, h)
        hk = {**h, "Idempotency-Key": "repeat-key-0001"}
        first = _repeat(client, hk, trial["id"])
        assert first.status_code == 202
        wait_for_scan(client, h, first.json()["id"])
        committed = _committed(client)
        again = _repeat(client, hk, trial["id"])
        assert again.status_code == 200 and again.json()["id"] == first.json()["id"]
        assert _committed(client) == committed
