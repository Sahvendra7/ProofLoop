"""End-to-end API behaviour through FastAPI with a scripted YouCam and a temp database."""

from __future__ import annotations

from tests.conftest import FakeYouCam, face_jpeg, load_fixture, new_session, wait_for_scan

V1 = "/api/v1"


def upload(client, headers, *, consent="true", key=None, trial_id=None, image=None):
    data = {"consent": consent, "source": "camera"}
    if trial_id:
        data["trial_id"] = trial_id
    h = dict(headers)
    if key:
        h["Idempotency-Key"] = key
    return client.post(
        f"{V1}/scans", headers=h, data=data, files={"image": ("me.jpg", image or face_jpeg(), "image/jpeg")}
    )


def test_session_is_required(api):
    with api() as client:
        r = client.get(f"{V1}/scans")
        assert r.status_code == 401
        assert r.json()["error"]["code"] == "session_required"
        assert r.headers["X-Request-ID"]


def test_live_scan_lifecycle(api):
    with api() as client:
        h = new_session(client)
        r = upload(client, h)
        assert r.status_code == 202
        body = r.json()
        assert body["status"] == "processing" and body["provenance"]["kind"] == "youcam"
        done = wait_for_scan(client, h, body["id"])
        assert done["status"] == "complete"
        assert {m["key"]: m["ui_score"] for m in done["metrics"]}["moisture"] == 69
        assert done["provider_run"]["endpoint"] == "POST /s2s/v2.0/task/skin-analysis"
        assert done["provider_run"]["units"] == 12
        assert done["masks_available"] is True  # masks without an expiry get a short TTL

        status = client.get(f"{V1}/system/status").json()
        assert status["budget"]["committed"] == 12


def test_failed_scan_is_reported_not_faked(api):
    fake = FakeYouCam(analysis_result=load_fixture("analysis-error-face-too-small-live.json"))
    with api(fake) as client:
        h = new_session(client)
        done = wait_for_scan(client, h, upload(client, h).json()["id"])
        assert done["status"] == "failed"
        assert done["metrics"] == []
        assert done["failure"]["code"] == "face_too_small"
        assert "fills most of the frame" in done["failure"]["hint"]
        # documented: failed tasks are not billed
        assert client.get(f"{V1}/system/status").json()["budget"]["committed"] == 0


def test_idempotency_key_prevents_double_spend(api, fake_youcam):
    with api() as client:
        h = new_session(client)
        first = upload(client, h, key="retry-key-0001").json()
        second = upload(client, h, key="retry-key-0001")
        assert second.status_code == 200
        assert second.json()["id"] == first["id"]
        wait_for_scan(client, h, first["id"])
        creates = [r for r in fake_youcam.requests if r.method == "POST" and "/task/" in r.url.path]
        assert len(creates) == 1


def test_consent_is_required(api):
    with api() as client:
        h = new_session(client)
        r = upload(client, h, consent="false")
        assert r.status_code == 400 and r.json()["error"]["code"] == "consent_required"


def test_unconfigured_provider_fails_visibly(api):
    with api(YOUCAM_API_KEY="") as client:
        h = new_session(client)
        r = upload(client, h)
        assert r.status_code == 503
        assert r.json()["error"]["code"] == "provider_not_configured"
        assert client.get(f"{V1}/scans", headers=h).json() == []  # nothing fabricated


def test_bad_upload_is_rejected_before_any_provider_call(api, fake_youcam):
    with api() as client:
        h = new_session(client)
        r = upload(client, h, image=b"not an image")
        assert r.status_code == 400
        assert fake_youcam.requests == []


def test_budget_and_rate_limit(api):
    with api(PROVIDER_UNIT_BUDGET=12) as client:
        h = new_session(client)
        wait_for_scan(client, h, upload(client, h).json()["id"])
        r = upload(client, h)
        assert r.status_code == 503 and r.json()["error"]["code"] == "budget_exhausted"
    with api(LIVE_SCANS_PER_SESSION_PER_HOUR=1) as client:
        h = new_session(client)
        wait_for_scan(client, h, upload(client, h).json()["id"])
        assert upload(client, h).json()["error"]["code"] == "session_rate_limited"


def test_sessions_are_isolated(api):
    with api() as client:
        a, b = new_session(client), new_session(client)
        scan = client.post(f"{V1}/scans/demo", headers=a).json()
        assert client.get(f"{V1}/scans/{scan['id']}", headers=b).status_code == 404
        assert client.get(f"{V1}/scans/{scan['id']}/recommendations?goal=hydration", headers=b).status_code == 404


def test_demo_journey_end_to_end(api):
    with api() as client:
        h = new_session(client)
        scan = client.post(f"{V1}/scans/demo", headers=h).json()
        assert scan["provenance"]["kind"] == "demo"
        assert scan["provider_run"] is None
        assert "No provider call" in scan["provenance"]["detail"]

        recs = client.get(f"{V1}/scans/{scan['id']}/recommendations", params={"goal": "hydration"}, headers=h).json()
        assert recs["status"] == "ok" and recs["measurement"] == 69
        product_id = recs["matches"][0]["product"]["id"]

        trial = client.post(
            f"{V1}/trials", headers=h, json={"scan_id": scan["id"], "goal": "hydration", "product_id": product_id}
        ).json()
        assert trial["provenance"]["kind"] == "demo" and trial["comparison"] is None
        summaries = client.get(f"{V1}/trials", headers=h).json()
        assert summaries[0]["baseline_scan_id"] == scan["id"]

        after = client.post(f"{V1}/trials/{trial['id']}/demo-checkin", headers=h).json()
        assert after["checkins"][0]["synthetic_timeline"] is True
        assert after["checkins"][0]["provenance"]["label"] == "Synthetic demo"
        comp = after["comparison"]
        assert comp["focus_outcome"] == "measured_improvement"  # +8 vs band 5
        verdicts = {c["metric"]: c["verdict"] for c in comp["changes"]}
        assert verdicts["acne"] == "worse" and verdicts["pore"] == "within_variation"
        assert verdicts["texture"] == "within_variation"  # +5 is inside texture's 7-point band
        assert comp["comparability"]["days_apart"] == 21.0
        assert [p["is_baseline"] for p in after["history"]] == [True, False]


def test_real_and_demo_records_never_mix(api):
    with api() as client:
        h = new_session(client)
        demo_scan = client.post(f"{V1}/scans/demo", headers=h).json()
        demo_trial = client.post(
            f"{V1}/trials",
            headers=h,
            json={"scan_id": demo_scan["id"], "goal": "hydration", "product_id": "thale-water-reserve"},
        ).json()
        r = upload(client, h, trial_id=demo_trial["id"])
        assert r.status_code == 409 and r.json()["error"]["code"] == "provenance_mismatch"

        live = wait_for_scan(client, h, upload(client, h).json()["id"])
        live_trial = client.post(
            f"{V1}/trials",
            headers=h,
            json={"scan_id": live["id"], "goal": "hydration", "product_id": "thale-water-reserve"},
        ).json()
        assert live_trial["provenance"]["kind"] == "youcam"
        r = client.post(f"{V1}/trials/{live_trial['id']}/demo-checkin", headers=h)
        assert r.status_code == 409

        checkin = wait_for_scan(client, h, upload(client, h, trial_id=live_trial["id"]).json()["id"])
        trial = client.get(f"{V1}/trials/{live_trial['id']}", headers=h).json()
        assert trial["checkins"][0]["id"] == checkin["id"]
        assert trial["comparison"]["focus_outcome"] in {"no_clear_change", "inconclusive"}  # same fixture -> delta 0


def test_recommendation_validation(api):
    with api() as client:
        h = new_session(client)
        scan = client.post(f"{V1}/scans/demo", headers=h).json()
        r = client.get(f"{V1}/scans/{scan['id']}/recommendations", params={"goal": "overall"}, headers=h)
        assert r.status_code == 422 and r.json()["error"]["code"] == "unknown_goal"
        r = client.get(
            f"{V1}/scans/{scan['id']}/recommendations", params={"goal": "hydration", "finish": "sparkly"}, headers=h
        )
        assert r.status_code == 422


def test_delete_my_data_removes_everything(api):
    with api() as client:
        h = new_session(client)
        scan = client.post(f"{V1}/scans/demo", headers=h).json()
        assert client.delete(f"{V1}/sessions/me", headers=h).status_code == 204
        assert client.get(f"{V1}/scans/{scan['id']}", headers=h).status_code == 401


def test_simulation_endpoint(api, fake_youcam):
    with api() as client:
        h = new_session(client)
        r = client.post(
            f"{V1}/simulations",
            headers=h,
            data={"goal": "calm_redness", "intensity": "0.4", "consent": "true"},
            files={"image": ("me.jpg", face_jpeg(), "image/jpeg")},
        )
        assert r.status_code == 200, r.text
        assert r.json()["concern"] == "redness" and r.json()["units"] == 4
        r = client.post(
            f"{V1}/simulations",
            headers=h,
            data={"goal": "hydration", "consent": "true"},
            files={"image": ("me.jpg", face_jpeg(), "image/jpeg")},
        )
        assert r.status_code == 422 and r.json()["error"]["code"] == "simulation_unavailable"


def test_catalog_and_goals(api):
    with api() as client:
        goals = client.get(f"{V1}/goals").json()
        assert len(goals) == 8
        assert {g["key"] for g in goals if not g["simulation_available"]} == {"hydration", "oil_balance"}
        catalog = client.get(f"{V1}/products").json()
        assert "fictional" in catalog["disclaimer"]
        assert client.get(f"{V1}/products/nope").status_code == 404
