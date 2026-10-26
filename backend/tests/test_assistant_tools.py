"""The assistant's read-only tools: derived only from the trial the page already shows."""

from __future__ import annotations

import ast
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text

from app.api.schemas import TrialOut
from app.services.assistant.tools import ToolBox, ToolError
from tests.conftest import face_jpeg, new_session, wait_for_scan
from tests.test_api import V1, upload

ASSISTANT_DIR = Path(__file__).resolve().parents[1] / "app" / "services" / "assistant"


def sample_trial(client, h) -> dict:
    scan = client.post(f"{V1}/scans/demo", headers=h).json()
    r = client.post(
        f"{V1}/trials",
        headers=h,
        json={"scan_id": scan["id"], "goal": "hydration", "product_id": "thale-water-reserve"},
    )
    assert r.status_code == 201, r.text
    return r.json()


def toolbox(trial: dict) -> ToolBox:
    return ToolBox(TrialOut.model_validate(trial), datetime.now(UTC))


def test_status_on_a_new_sample_trial(api):
    with api() as client:
        h = new_session(client)
        trial = sample_trial(client, h)
        tools = toolbox(trial)
        status = tools.get_trial_status()
        assert status.provenance == "sample"
        assert status.focus_metric == trial["goal"]["metric"]
        assert status.band == trial["focus_noise_band"]
        assert status.planned_days == trial["protocol"]["planned_checkin_days"]
        assert status.checkins_count == 0 and status.sealed is False
        assert status.instrument_check == "none"
        assert status.product_name == trial["product"]["name"]
        latest = tools.get_latest_result()
        assert latest.has_result is False and latest.checkin_processing is False


def test_latest_result_after_sample_checkin(api):
    with api() as client:
        h = new_session(client)
        trial = sample_trial(client, h)
        done = client.post(f"{V1}/trials/{trial['id']}/demo-checkin", headers=h).json()
        latest = toolbox(done).get_latest_result()
        comparison = done["comparison"]
        focus = next(c for c in comparison["changes"] if c["metric"] == comparison["focus_metric"])
        assert latest.has_result is True
        assert latest.outcome == comparison["focus_outcome"]
        assert latest.next_step == comparison["next_step"]["action"]
        assert latest.verdict == comparison["focus_outcome"]
        assert latest.delta == focus["delta"]
        assert latest.baseline_score == focus["baseline"] and latest.current_score == focus["current"]
        assert latest.band == done["focus_noise_band"]
        assert latest.comparability == comparison["comparability"]["level"]
        assert latest.comparability_issues == comparison["comparability"]["issue_codes"]
        assert toolbox(done).get_trial_status().sealed is True


def test_processing_checkin_is_reported(api, database_url):
    with api() as client:
        h = new_session(client)
        scan = wait_for_scan(client, h, upload(client, h).json()["id"])
        trial = client.post(
            f"{V1}/trials",
            headers=h,
            json={"scan_id": scan["id"], "goal": "hydration", "product_id": "thale-water-reserve"},
        ).json()
        r = upload(client, h, trial_id=trial["id"], image=face_jpeg(color=(190, 156, 136)))
        checkin = wait_for_scan(client, h, r.json()["id"])
        # The scripted provider never yields mid-poll, so hold the check-in in "processing" directly.
        engine = create_engine(database_url)
        with engine.begin() as conn:
            conn.execute(text("UPDATE scans SET status = 'processing' WHERE id = :id"), {"id": checkin["id"]})
        engine.dispose()
        current = client.get(f"{V1}/trials/{trial['id']}", headers=h).json()
        tools = toolbox(current)
        latest = tools.get_latest_result()
        assert latest.has_result is False and latest.checkin_processing is True
        assert tools.get_trial_status().provenance == "live"


def test_action_availability(api):
    with api() as client:
        h = new_session(client)
        trial = sample_trial(client, h)
        tools = toolbox(trial)
        assert tools.propose_action("run_sample_checkin").available is True
        assert tools.propose_action("open_checkin").available is False
        done = client.post(f"{V1}/trials/{trial['id']}/demo-checkin", headers=h).json()
        sealed = toolbox(done).propose_action("open_instrument_check")
        assert sealed.available is False and sealed.unavailable_reason


def test_unknown_tool_and_bad_args_raise(api):
    with api() as client:
        h = new_session(client)
        tools = toolbox(sample_trial(client, h))
        with pytest.raises(ToolError):
            tools.call("delete_trial", {})
        with pytest.raises(ToolError):
            tools.call("explain_rule", {"topic": "x"})
        with pytest.raises(ToolError):
            tools.call("get_trial_status", {"trial_id": "someone-else"})
        assert tools.call("explain_rule", {"topic": "band"}).text


def test_numbers_seen_tracks_returned_outputs(api):
    with api() as client:
        h = new_session(client)
        trial = sample_trial(client, h)
        tools = toolbox(trial)
        assert tools.numbers_seen() == set()
        tools.call("get_trial_status", {})
        assert str(trial["focus_noise_band"]) in tools.numbers_seen()


def test_assistant_package_imports_no_writers():
    forbidden = ("app.services.usage", "app.providers", "app.services.protocol", "app.services.scans")
    for path in ASSISTANT_DIR.glob("*.py"):
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                assert not node.module.startswith(forbidden), f"{path.name} imports {node.module}"
            if isinstance(node, ast.Import):
                for alias in node.names:
                    assert not alias.name.startswith(forbidden), f"{path.name} imports {alias.name}"


def test_matches_are_offered_only_when_the_plan_suggests_switching(api):
    with api() as client:
        h = new_session(client)
        trial = sample_trial(client, h)
        assert toolbox(trial).propose_action("open_matches").available is False
        done = client.post(f"{V1}/trials/{trial['id']}/demo-checkin", headers=h).json()
        assert done["comparison"]["next_step"]["action"] != "consider_switching"
        held = toolbox(done).propose_action("open_matches")
        assert held.available is False and held.unavailable_reason
        from tests.assistant_fixtures import make_state  # imports this module's sample_trial

        switching = make_state(trial, done, "inside_band_full")
        assert switching["comparison"]["next_step"]["action"] == "consider_switching"
        assert toolbox(switching).propose_action("open_matches").available is True
