"""Synthetic trial states for the assistant tests and the evaluation corpus.

Each state starts from a real sample-data trial produced by the API, then reshapes
its focus comparison with the domain's own rules, so the stored outcome, early flag
and next step agree with the numbers. The "conflicting_*" states break exactly one
of those agreements on purpose.
"""

from __future__ import annotations

import copy
from typing import Any

from app.domain.compare import compare_metric, focus_outcome, next_step
from tests.conftest import new_session
from tests.test_api import V1
from tests.test_assistant_tools import sample_trial

CONSISTENT_STATES = (
    "no_checkin",
    "processing",
    "improvement_early",
    "improvement_full",
    "decline_early",
    "decline_full",
    "inside_band_early",
    "inside_band_full",
    "inside_band_nothing_to_gain",
    "inconclusive",
    "insufficient",
)
CONFLICTING_STATES = (
    "conflicting_outcome",
    "conflicting_next_step",
    "conflicting_early",
    "conflicting_band",
    "conflicting_delta",
    "missing_focus_change",
)

# What the canonical verdict must be for each consistent state: (code, next_step, early, action).
EXPECTED = {
    "no_checkin": ("no_checkin_yet", "check_in", False, "run_sample_checkin"),
    "processing": ("checkin_processing", "wait_for_analysis", False, "none"),
    "improvement_early": ("measured_improvement", "finish_the_test", True, "none"),
    "improvement_full": ("measured_improvement", "keep_going", False, "none"),
    "decline_early": ("measured_decline", "pause_and_review", True, "none"),
    "decline_full": ("measured_decline", "pause_and_review", False, "none"),
    "inside_band_early": ("no_clear_change", "finish_the_test", True, "none"),
    "inside_band_full": ("no_clear_change", "consider_switching", False, "open_matches"),
    "inside_band_nothing_to_gain": ("no_clear_change", "nothing_to_gain", False, "none"),
    "inconclusive": ("inconclusive", "retake", False, "run_sample_checkin"),
    "insufficient": ("insufficient_data", "retake", False, "run_sample_checkin"),
}


def capture_trials(api) -> tuple[dict, dict]:
    """A fresh sample trial and one with its synthetic check-in done. No YouCam call: sample data only."""
    with api() as client:
        h = new_session(client)
        fresh = sample_trial(client, h)
        done = client.post(f"{V1}/trials/{sample_trial(client, h)['id']}/demo-checkin", headers=h).json()
    return fresh, done


def focus_change(trial: dict) -> dict[str, Any]:
    c = trial["comparison"]
    return next(ch for ch in c["changes"] if ch["metric"] == c["focus_metric"])


def reshape(
    done: dict,
    *,
    step: int | None,
    early: bool,
    comparability: str = "good",
    detectable: str | None = None,
) -> dict:
    """Move the focus score by `step` points (None = missing) and recompute the verdict with the domain rules."""
    t = copy.deepcopy(done)
    c = t["comparison"]
    focus = focus_change(t)
    current = None if step is None else focus["baseline"] + step
    change = compare_metric(focus["metric"], focus["baseline"], current, focus["noise_band"])
    focus.update(current=current, delta=change.delta, verdict=change.verdict)
    c["comparability"]["level"] = comparability
    if comparability == "poor":
        c["comparability"]["issue_codes"] = ["lighting_differs_a_lot"]
        c["comparability"]["issues"] = ["The lighting differs a lot between the two photos."]
    planned = t["protocol"]["planned_checkin_days"]
    c["comparability"]["days_apart"] = 3.0 if early else float(planned)
    c["early"] = early
    if detectable:
        t["protocol"]["detectable"] = detectable
    c["focus_outcome"] = focus_outcome(change.verdict, comparability)  # type: ignore[arg-type]
    c["next_step"]["action"] = next_step(c["focus_outcome"], early, t["protocol"]["detectable"])
    return t


def make_state(fresh: dict, done: dict, state: str) -> dict:
    band = focus_change(done)["noise_band"]
    up, down, inside = band + 3, -(band + 4), max(1, band - 3)
    if state == "no_checkin":
        return copy.deepcopy(fresh)
    if state == "processing":
        t = copy.deepcopy(fresh)
        checkin = copy.deepcopy(done["checkins"][0])
        checkin["status"] = "processing"
        t["checkins"] = [checkin]
        return t
    shapes: dict[str, dict[str, Any]] = {
        "improvement_early": {"step": up, "early": True},
        "improvement_full": {"step": up, "early": False},
        "decline_early": {"step": down, "early": True},
        "decline_full": {"step": down, "early": False},
        "inside_band_early": {"step": inside, "early": True},
        "inside_band_full": {"step": inside, "early": False, "detectable": "both"},
        "inside_band_nothing_to_gain": {"step": inside, "early": False, "detectable": "decline_only"},
        "inconclusive": {"step": up, "early": False, "comparability": "poor"},
        "insufficient": {"step": None, "early": False},
    }
    if state in shapes:
        return reshape(done, **shapes[state])
    t = reshape(done, step=up, early=False)
    c = t["comparison"]
    if state == "conflicting_outcome":
        c["focus_outcome"] = "no_clear_change"  # the numbers say beyond the band
    elif state == "conflicting_next_step":
        c["next_step"]["action"] = "consider_switching"  # an improvement never leads to switching
    elif state == "conflicting_early":
        c["early"] = True  # days_apart says the full planned time passed
    elif state == "conflicting_band":
        t["focus_noise_band"] = up + 5  # the registered band would put this change inside it
    elif state == "conflicting_delta":
        focus_change(t)["delta"] = -focus_change(t)["delta"]
    elif state == "missing_focus_change":
        c["changes"] = [ch for ch in c["changes"] if ch["metric"] != c["focus_metric"]]
    else:
        raise ValueError(state)
    return t
