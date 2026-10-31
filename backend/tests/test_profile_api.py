"""Checked skin profile through the API: pinned action sets, the reading, the focus plan and the frozen snapshot."""

from __future__ import annotations

import copy
import json
import logging

from sqlalchemy import create_engine, text

from tests.conftest import FakeYouCam, face_jpeg, load_fixture, new_session, wait_for_scan
from tests.test_api import V1, upload

SKIN_TYPE_RESULT = "skin-type-success-live.json"  # recorded by the paired gate on 2026-10-26
OTHER_PHOTO = face_jpeg(color=(190, 156, 136))
ON = {"SKIN_PROFILE_ENABLED": True}
ANSWERS = {"shine": "rarely", "tightness": "often", "reactive": "unsure", "priorities": ["hydration"]}


def skin_fake(labels: dict | None = None, drop_skin_type: bool = False) -> FakeYouCam:
    data = copy.deepcopy(load_fixture(SKIN_TYPE_RESULT))
    out = data["data"]["results"]["output"]
    if drop_skin_type:
        data["data"]["results"]["output"] = [o for o in out if o["type"] != "skin_type"]
    for o in out:
        if labels and o["type"] == "skin_type" and o["region"] in labels:
            o["skin_type"] = labels[o["region"]]
    return FakeYouCam(analysis_result=data)


def task_actions(fake: FakeYouCam) -> list[list[str]]:
    return [b["dst_actions"] for b in fake.bodies("POST", "/s2s/v2.0/task/skin-analysis")]


def live_scan(client, h, **kw) -> dict:
    return wait_for_scan(client, h, upload(client, h, **kw).json()["id"])


def start_trial(client, h, scan_id, profile=None, goal="hydration"):
    body = {"scan_id": scan_id, "goal": goal, "product_id": "thale-water-reserve"}
    if profile is not None:
        body["profile"] = profile
    return client.post(f"{V1}/trials", headers=h, json=body)


def repeat(client, h, trial_id, image=OTHER_PHOTO):
    return client.post(
        f"{V1}/scans",
        headers=h,
        data={"consent": "true", "source": "camera", "trial_id": trial_id, "purpose": "repeat_baseline"},
        files={"image": ("me.jpg", image, "image/jpeg")},
    )


def ledger(database_url: str) -> list[tuple[int, int]]:
    engine = create_engine(database_url)
    with engine.connect() as conn:
        rows = conn.execute(text("select units_reserved, units_charged from provider_calls order by id")).all()
    engine.dispose()
    return [tuple(r) for r in rows]


# --- flag off: nothing changes ---------------------------------------------------------------


def test_flag_off_keeps_todays_request_price_and_shape(api, database_url):
    fake = skin_fake()
    with api(fake) as client:
        h = new_session(client)
        scan = live_scan(client, h)
        assert task_actions(fake) == [[*json.loads(json.dumps(scan["provider_run"]["concerns_requested"]))]]
        assert "skin_type" not in task_actions(fake)[0]
        assert scan["provider_run"]["units"] == 12 and scan["skin_type"] is None
        assert ledger(database_url) == [(12, 12)]
        assert client.get(f"{V1}/system/status").json()["skin_profile_enabled"] is False
        r = client.post(f"{V1}/scans/{scan['id']}/focus-plan", headers=h, json={})
        assert r.status_code == 404 and r.json()["error"]["code"] == "feature_disabled"
        r = start_trial(client, h, scan["id"], profile={"self_report": ANSWERS})
        assert r.status_code == 404 and r.json()["error"]["code"] == "feature_disabled"


# --- flag on: the reading comes from the same task ----------------------------------------------


def test_baseline_requests_skin_type_in_the_same_task_and_reserves_the_measured_tier(api, database_url):
    fake = skin_fake()
    with api(fake, **ON) as client:
        h = new_session(client)
        scan = live_scan(client, h)
        assert task_actions(fake)[0][-1] == "skin_type" and len(task_actions(fake)[0]) == 9
        assert len(fake.bodies("POST", "/s2s/v2.0/file/")) == 1  # one upload, one task
        assert scan["provider_run"]["units"] == 14
        assert ledger(database_url) == [(14, 14)]
        assert scan["skin_type"] == {
            "status": "complete",
            "whole": "Dry",
            "t_zone": "Normal",
            "u_zone": "Dry",
            "note": None,
        }
        assert len(scan["metrics"]) == 8  # scores unchanged by the extra action


def test_missing_or_unsupported_label_never_fails_the_scan(api):
    for fake, status in ((skin_fake(drop_skin_type=True), "missing"), (skin_fake({"whole": "Very Oily"}), "partial")):
        with api(fake, **ON) as client:
            h = new_session(client)
            scan = live_scan(client, h)
            assert scan["status"] == "complete"
            assert scan["skin_type"]["status"] == status
            if status == "partial":
                assert scan["skin_type"]["whole"] is None and scan["skin_type"]["t_zone"] == "Normal"


def test_a_trial_keeps_its_baseline_action_set_when_the_flag_flips(api, database_url):
    fake = skin_fake()
    with api(fake) as client:  # baseline without the reading
        h = new_session(client)
        scan = live_scan(client, h)
        trial = start_trial(client, h, scan["id"]).json()
    with api(fake, **ON) as client:  # flag turned on later
        r = repeat(client, h, trial["id"])
        assert r.status_code == 202
        wait_for_scan(client, h, r.json()["id"])
        assert "skin_type" not in task_actions(fake)[-1]
        assert client.get(f"{V1}/trials/{trial['id']}", headers=h).json()["protocol"]["instrument_check"]["units"] == 12

    fake2 = skin_fake()
    with api(fake2, **ON) as client:  # and the other way round
        scan = live_scan(client, h)
        trial = start_trial(client, h, scan["id"]).json()
    with api(fake2) as client:
        wait_for_scan(client, h, repeat(client, h, trial["id"]).json()["id"])
        assert task_actions(fake2)[-1][-1] == "skin_type"
        assert ledger(database_url)[-1] == (14, 14)


# --- focus plan -------------------------------------------------------------------------------


def test_focus_plan_orders_and_explains_without_spending(api, database_url):
    fake = skin_fake()
    with api(fake, **ON) as client:
        h = new_session(client)
        scan = live_scan(client, h)
        before = ledger(database_url)
        r = client.post(
            f"{V1}/scans/{scan['id']}/focus-plan",
            headers=h,
            json={"self_report": {"shine": "often", "priorities": ["oil_balance"]}},
        )
        assert r.status_code == 200, r.text
        plan = r.json()
        assert ledger(database_url) == before
        stuck = [i for i in plan["order"] if "cant_show_gains" in i["badges"]]  # acne, redness, oil all at 99
        assert stuck[0]["goal"] == "oil_balance" and "picked" in stuck[0]["badges"]  # first of them, not above room
        assert all("cant_show_gains" in i["badges"] for i in plan["order"][plan["order"].index(stuck[0]) :])
        assert "Balance shine" in plan["priority_note"]["text"]
        assert {n["rule_id"] for n in plan["profile_notes"]} == {"C2"}  # said shiny; camera saw no oily zone
        assert plan["rules_version"] == "2026-10-26.1"
        assert plan["camera"] == {
            "status": "complete",
            "whole": "Dry",
            "t_zone": "Normal",
            "u_zone": "Dry",
            "note": None,
        }

        rejected = client.post(
            f"{V1}/scans/{scan['id']}/focus-plan",
            headers=h,
            json={"self_report": {"shine": "often"}, "use_camera_reading": False},
        ).json()
        assert rejected["profile_notes"] == [] and rejected["camera"] is None


def test_focus_plan_validates_and_respects_ownership(api):
    with api(skin_fake(), **ON) as client:
        h = new_session(client)
        scan = live_scan(client, h)
        bad = client.post(f"{V1}/scans/{scan['id']}/focus-plan", headers=h, json={"self_report": {"priorities": ["x"]}})
        assert bad.status_code == 422
        bad = client.post(f"{V1}/scans/{scan['id']}/focus-plan", headers=h, json={"self_report": {"shine": "always"}})
        assert bad.status_code == 422
        other = new_session(client)
        assert client.post(f"{V1}/scans/{scan['id']}/focus-plan", headers=other, json={}).status_code == 404


# --- the snapshot is frozen at commitment ---------------------------------------------------------


def _without(d: dict, *keys: str) -> dict:
    return {k: v for k, v in d.items() if k not in keys}


def test_trial_freezes_the_profile_and_the_plan_is_identical_without_it(api):
    with api(skin_fake(), **ON) as client:
        h = new_session(client)
        scan = live_scan(client, h)
        plain = start_trial(client, h, scan["id"]).json()
        with_profile = start_trial(client, h, scan["id"], profile={"self_report": ANSWERS, "user_view": "agree"})
        assert with_profile.status_code == 201, with_profile.text
        t = with_profile.json()
        p = t["profile"]
        assert p["at_start"]["self_report"] == ANSWERS
        assert p["at_start"]["camera"] == {"scan_id": scan["id"], "whole": "Dry", "t_zone": "Normal", "u_zone": "Dry"}
        assert p["at_start"]["user_view"] == "agree" and p["rules_version"] == "2026-10-26.1"
        assert p["stability"] == "not_checked" and p["latest"] is None and p["withdrawn"] is False
        assert {n["rule_id"] for n in p["notes"]} == {"C1"}  # said tight/flaky often; camera: dry
        assert plain["profile"] is None
        # The plan, band and protocol are byte-identical with or without a profile.
        assert t["protocol"] == plain["protocol"] and t["focus_noise_band"] == plain["focus_noise_band"]
        assert _without(t, "id", "created_at", "profile") == _without(plain, "id", "created_at", "profile")


def test_rejecting_the_reading_keeps_only_the_users_words(api):
    with api(skin_fake(), **ON) as client:
        h = new_session(client)
        scan = live_scan(client, h)
        t = start_trial(client, h, scan["id"], profile={"self_report": ANSWERS, "use_camera_reading": False}).json()
        assert t["profile"]["at_start"]["camera"] is None
        assert t["profile"]["at_start"]["camera_rejected"] is True
        assert t["profile"]["stability"] == "not_used"


def test_invalid_profile_refuses_the_trial_before_anything_is_saved(api):
    with api(skin_fake(), **ON) as client:
        h = new_session(client)
        scan = live_scan(client, h)
        r = start_trial(client, h, scan["id"], profile={"self_report": {"priorities": ["a", "b", "c"]}})
        assert r.status_code == 422
        assert client.get(f"{V1}/trials", headers=h).json() == []


def test_later_answers_never_change_the_committed_snapshot(api):
    with api(skin_fake(), **ON) as client:
        h = new_session(client)
        scan = live_scan(client, h)
        t = start_trial(client, h, scan["id"], profile={"self_report": ANSWERS}).json()
        at_start = t["profile"]["at_start"]
        r = client.patch(
            f"{V1}/trials/{t['id']}/profile",
            headers=h,
            json={"self_report": {"shine": "often"}, "user_view": "disagree", "expected_amendments": 0},
        )
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["at_start"] == at_start
        assert p["latest"]["self_report"]["shine"] == "often" and p["latest"]["user_view"] == "disagree"
        assert p["amendments"] == 1
        stale = client.patch(
            f"{V1}/trials/{t['id']}/profile", headers=h, json={"user_view": "agree", "expected_amendments": 0}
        )
        assert stale.status_code == 409 and stale.json()["error"]["code"] == "profile_conflict"
        after = client.get(f"{V1}/trials/{t['id']}", headers=h).json()
        assert after["protocol"] == t["protocol"]
        other = new_session(client)
        assert (
            client.patch(f"{V1}/trials/{t['id']}/profile", headers=other, json={"expected_amendments": 1}).status_code
            == 404
        )


def test_amending_a_trial_without_a_profile_is_refused(api):
    with api(skin_fake(), **ON) as client:
        h = new_session(client)
        t = start_trial(client, h, live_scan(client, h)["id"]).json()
        r = client.patch(f"{V1}/trials/{t['id']}/profile", headers=h, json={"expected_amendments": 0})
        assert r.status_code == 404 and r.json()["error"]["code"] == "profile_not_found"


# --- instrument-check consistency --------------------------------------------------------------


def test_label_consistency_across_the_instrument_check_pair(api, fake_youcam):
    fake = skin_fake()
    with api(fake, **ON) as client:
        h = new_session(client)
        t = start_trial(client, h, live_scan(client, h)["id"], profile={"self_report": ANSWERS}).json()
        wait_for_scan(client, h, repeat(client, h, t["id"]).json()["id"])
        assert client.get(f"{V1}/trials/{t['id']}", headers=h).json()["profile"]["stability"] == "held"

    changed = skin_fake({"u_zone": "Normal"})
    with api(changed, **ON) as client:
        t = start_trial(
            client, h, live_scan(client, h, image=face_jpeg(color=(120, 110, 100)))["id"], profile={}
        ).json()
    with api(skin_fake({"u_zone": "Combination"}), **ON) as client:
        wait_for_scan(client, h, repeat(client, h, t["id"]).json()["id"])
        body = client.get(f"{V1}/trials/{t['id']}", headers=h).json()
        assert body["profile"]["stability"] == "changed"
        assert body["protocol"]["instrument_check"]["status"] == "complete"


# --- withdrawal and deletion ----------------------------------------------------------------------


def test_withdrawing_removes_answers_and_readings_but_not_the_plan(api, database_url):
    with api(skin_fake(), **ON) as client:
        h = new_session(client)
        scan = live_scan(client, h)
        t = start_trial(client, h, scan["id"], profile={"self_report": ANSWERS}).json()
        wait_for_scan(client, h, repeat(client, h, t["id"]).json()["id"])
        assert client.delete(f"{V1}/trials/{t['id']}/profile", headers=h).status_code == 204
        body = client.get(f"{V1}/trials/{t['id']}", headers=h).json()
        assert body["profile"]["withdrawn"] is True and body["profile"]["at_start"] is None
        # Removed, not "missing": the reading came back and the user deleted it.
        assert body["baseline"]["skin_type"] == {
            "status": "removed",
            "whole": None,
            "t_zone": None,
            "u_zone": None,
            "note": None,
        }
        assert body["protocol"] == t["protocol"] | {"instrument_check": body["protocol"]["instrument_check"]}
        engine = create_engine(database_url)
        with engine.connect() as conn:
            stored = [
                r[0] for r in conn.execute(text("select skin_type_json from scans where skin_type_json is not null"))
            ]
            snap = conn.execute(text("select profile_json from trials")).scalar_one()
        engine.dispose()
        # Only a content-free marker is kept: no label survives removal.
        assert stored and all(json.loads(v) == {"removed": True} for v in stored)
        assert set(json.loads(snap)) == {"version", "withdrawn_at"}
        # A later check-in still measures with the pinned action set but keeps no label.
        r = upload(client, h, trial_id=t["id"], image=face_jpeg(color=(150, 140, 130)))
        wait_for_scan(client, h, r.json()["id"])
        body = client.get(f"{V1}/trials/{t['id']}", headers=h).json()
        assert body["checkins"][-1]["skin_type"]["status"] == "removed"


def test_delete_my_data_removes_profiles(api, database_url):
    with api(skin_fake(), **ON) as client:
        h = new_session(client)
        start_trial(client, h, live_scan(client, h)["id"], profile={"self_report": ANSWERS})
        assert client.delete(f"{V1}/sessions/me", headers=h).status_code == 204
    engine = create_engine(database_url)
    with engine.connect() as conn:
        assert conn.execute(text("select count(*) from trials")).scalar_one() == 0
        assert conn.execute(text("select count(*) from scans")).scalar_one() == 0
    engine.dispose()


def test_logs_never_carry_answers_or_labels(api, caplog):
    caplog.set_level(logging.DEBUG)
    with api(skin_fake({"whole": "Combination & Redness"}), **ON) as client:
        h = new_session(client)
        scan = live_scan(client, h)
        client.post(f"{V1}/scans/{scan['id']}/focus-plan", headers=h, json={"self_report": ANSWERS})
        t = start_trial(client, h, scan["id"], profile={"self_report": ANSWERS}).json()
        client.patch(
            f"{V1}/trials/{t['id']}/profile",
            headers=h,
            json={"self_report": {"reactive": "yes"}, "expected_amendments": 0},
        )
        client.delete(f"{V1}/trials/{t['id']}/profile", headers=h)
    logged = " ".join(r.getMessage() + json.dumps(getattr(r, "__dict__", {}), default=str) for r in caplog.records)
    for value in ("Combination & Redness", "Dry", "rarely", "often", "reactive"):
        assert value not in logged


# --- sample mode and existing trials ---------------------------------------------------------------


def test_sample_scan_carries_a_labelled_sample_reading(api):
    with api(**ON) as client:
        h = new_session(client)
        scan = client.post(f"{V1}/scans/demo", headers=h).json()
        assert scan["skin_type"]["status"] == "complete"
        assert "2026-10-26" in scan["skin_type"]["note"]
        t = start_trial(client, h, scan["id"], profile={"self_report": ANSWERS}).json()
        t = client.post(f"{V1}/trials/{t['id']}/demo-repeat", headers=h).json()
        # The recorded sample repeat predates skin-type readings, so consistency isn't claimed.
        assert t["profile"]["stability"] == "not_checked"


def test_existing_trials_read_identically_with_the_feature_on(api):
    with api() as client:
        h = new_session(client)
        demo = client.post(f"{V1}/scans/demo", headers=h).json()
        t = start_trial(client, h, demo["id"]).json()
        client.post(f"{V1}/trials/{t['id']}/demo-repeat", headers=h)
        before = client.post(f"{V1}/trials/{t['id']}/demo-checkin", headers=h).json()
    with api(**ON) as client:
        after = client.get(f"{V1}/trials/{t['id']}", headers=h).json()
    assert after["comparison"] == before["comparison"]
    assert after["protocol"] == before["protocol"]
    assert after["profile"] is None and after["baseline"]["skin_type"] is None


def test_quick_answers_are_identical_with_a_profile(api):
    with api(**ON) as client:
        h = new_session(client)
        demo = client.post(f"{V1}/scans/demo", headers=h).json()
        plain = start_trial(client, h, demo["id"]).json()
        prof = start_trial(client, h, demo["id"], profile={"self_report": ANSWERS, "user_view": "disagree"}).json()
        for intent in ("is_it_working", "when_check_in", "should_switch"):
            a = client.post(f"{V1}/trials/{plain['id']}/assistant/quick", headers=h, json={"intent": intent}).json()
            b = client.post(f"{V1}/trials/{prof['id']}/assistant/quick", headers=h, json={"intent": intent}).json()
            assert json.dumps(a).replace(plain["id"], "T") == json.dumps(b).replace(prof["id"], "T")


def test_cors_allows_the_profile_patch_from_the_frontend(api):
    with api(**ON, CORS_ORIGINS="http://localhost:3000") as client:
        r = client.options(
            f"{V1}/trials/t/profile",
            headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "PATCH"},
        )
        assert r.status_code == 200, r.text
        assert "PATCH" in r.headers["access-control-allow-methods"]


def test_reading_states_are_distinct_on_the_scan(api):
    """Returned, never returned, removed by the user, and not requested each read differently."""
    with api(skin_fake(), **ON) as client:
        h = new_session(client)
        returned = live_scan(client, h)
        assert returned["skin_type"]["status"] == "complete"
        t = start_trial(client, h, returned["id"], profile={"self_report": ANSWERS}).json()
        client.delete(f"{V1}/trials/{t['id']}/profile", headers=h)
        removed = client.get(f"{V1}/scans/{returned['id']}", headers=h).json()
        assert removed["skin_type"]["status"] == "removed"
        # Removal makes the reading unavailable to new focus plans too.
        plan = client.post(f"{V1}/scans/{returned['id']}/focus-plan", headers=h, json={}).json()
        assert plan["camera"]["status"] == "removed"
        assert all(not i["notes"] for i in plan["order"])
    with api(skin_fake(drop_skin_type=True), **ON) as client:
        assert live_scan(client, h, image=OTHER_PHOTO)["skin_type"]["status"] == "missing"
    with api(skin_fake()) as client:
        assert live_scan(client, h, image=face_jpeg(color=(170, 150, 140)))["skin_type"] is None


def test_a_trial_without_a_saved_profile_says_so(api):
    with api(skin_fake(), **ON) as client:
        h = new_session(client)
        scan = live_scan(client, h)
        t = start_trial(client, h, scan["id"]).json()
        assert t["profile"] is None
        assert t["baseline"]["skin_type"]["status"] == "complete"  # the reading stays with the scan


def test_removal_never_touches_the_plan_or_verdict(api):
    with api(**ON) as client:
        h = new_session(client)
        demo = client.post(f"{V1}/scans/demo", headers=h).json()
        t = start_trial(client, h, demo["id"], profile={"self_report": ANSWERS}).json()
        client.post(f"{V1}/trials/{t['id']}/demo-repeat", headers=h)
        before = client.post(f"{V1}/trials/{t['id']}/demo-checkin", headers=h).json()
        assert client.delete(f"{V1}/trials/{t['id']}/profile", headers=h).status_code == 204
        after = client.get(f"{V1}/trials/{t['id']}", headers=h).json()
        assert after["comparison"] == before["comparison"] and after["protocol"] == before["protocol"]
        assert after["baseline"]["skin_type"]["status"] == "removed"


def test_profile_edits_and_removal_respect_ownership(api):
    with api(skin_fake(), **ON) as client:
        h = new_session(client)
        t = start_trial(client, h, live_scan(client, h)["id"], profile={"self_report": ANSWERS}).json()
        other = new_session(client)
        assert client.delete(f"{V1}/trials/{t['id']}/profile", headers=other).status_code == 404
        assert client.delete(f"{V1}/trials/{t['id']}/profile").status_code == 401
        body = client.get(f"{V1}/trials/{t['id']}", headers=h).json()
        assert body["profile"]["withdrawn"] is False and body["profile"]["at_start"]["self_report"] == ANSWERS


def test_removal_works_with_the_flag_off_and_edits_do_not(api, make_settings):
    with api(skin_fake(), **ON) as client:
        h = new_session(client)
        t = start_trial(client, h, live_scan(client, h)["id"], profile={"self_report": ANSWERS}).json()
    # Switching the feature off (the first rollback step) must never trap a user's data.
    with api(skin_fake()) as client:
        r = client.patch(f"{V1}/trials/{t['id']}/profile", headers=h, json={"expected_amendments": 0})
        assert r.status_code == 404 and r.json()["error"]["code"] == "feature_disabled"
        assert client.delete(f"{V1}/trials/{t['id']}/profile", headers=h).status_code == 204
        assert client.delete(f"{V1}/trials/{t['id']}/profile", headers=h).status_code == 204  # idempotent
        body = client.get(f"{V1}/trials/{t['id']}", headers=h).json()
        assert body["profile"]["withdrawn"] is True
        assert body["baseline"]["skin_type"]["status"] == "removed"


def test_an_unreadable_stored_profile_never_breaks_the_trial_and_can_still_be_erased(api, database_url):
    with api(skin_fake(), **ON) as client:
        h = new_session(client)
        t = start_trial(client, h, live_scan(client, h)["id"], profile={"self_report": ANSWERS}).json()
        engine = create_engine(database_url)
        for broken in ("not json", "[]", '{"version": 1}', '{"camera": {"whole": "Dry"}, "created_at": "x"}'):
            with engine.begin() as conn:
                conn.execute(text("update trials set profile_json = :p"), {"p": broken})
            r = client.get(f"{V1}/trials/{t['id']}", headers=h)
            assert r.status_code == 200, broken
            assert r.json()["profile"] is None and r.json()["protocol"] == t["protocol"]
        r = client.patch(f"{V1}/trials/{t['id']}/profile", headers=h, json={"expected_amendments": 0})
        assert r.status_code == 404 and r.json()["error"]["code"] == "profile_not_found"
        assert client.delete(f"{V1}/trials/{t['id']}/profile", headers=h).status_code == 204
        with engine.connect() as conn:
            stored = conn.execute(text("select skin_type_json from scans")).scalars().all()
            snap = conn.execute(text("select profile_json from trials")).scalar_one()
        engine.dispose()
        assert all(v is None or json.loads(v) == {"removed": True} for v in stored)
        assert set(json.loads(snap)) == {"version", "withdrawn_at"}
