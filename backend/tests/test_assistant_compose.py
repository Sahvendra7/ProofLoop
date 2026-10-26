"""Fixed-wording answers: grounded in the tools and valid under the same rules as Gemini's replies."""

from __future__ import annotations

import re

import pytest

from app.services.assistant.compose import compose
from app.services.assistant.validate import check_reply
from app.services.assistant.verdict import UNAVAILABLE_STATEMENT
from tests.assistant_fixtures import CONFLICTING_STATES, CONSISTENT_STATES, capture_trials, make_state
from tests.test_assistant_tools import toolbox

INTENTS = ("is_it_working", "when_check_in", "should_switch", "status")


@pytest.fixture
def trials(api) -> dict[str, dict]:
    fresh, done = capture_trials(api)
    return {"fresh": fresh, "done": done} | {state: make_state(fresh, done, state) for state in ALL_STATES}


ALL_STATES = CONSISTENT_STATES + CONFLICTING_STATES


def assert_grounded_and_valid(trial: dict, intent: str):
    tools = toolbox(trial)
    out = compose(intent, tools)
    assert out.reply and len(out.reply) <= 700
    assert out.trace, "every answer shows what it checked"
    outcome = tools.get_latest_result().outcome
    available = {out.action.action} if out.action and out.action.available else set()
    failures = check_reply(
        out.reply,
        out.action.action if out.action else None,
        tools,
        outcome,
        available,
        tool_calls=len(out.trace),
    )
    assert failures == [], (intent, out.reply, failures)
    return out


@pytest.mark.parametrize("intent", INTENTS)
def test_fresh_sample_trial_answers_are_grounded(trials, intent):
    out = assert_grounded_and_valid(trials["fresh"], intent)
    assert "trial_plan" in out.sources


@pytest.mark.parametrize("intent", INTENTS)
@pytest.mark.parametrize("state", ALL_STATES)
def test_answers_in_every_state_are_grounded(trials, intent, state):
    assert_grounded_and_valid(trials[state], intent)


@pytest.mark.parametrize("state", CONFLICTING_STATES)
def test_conflicting_data_is_never_summarised(trials, state):
    for intent in ("is_it_working", "should_switch", "status"):
        out = compose(intent, toolbox(trials[state]))
        assert out.reply == UNAVAILABLE_STATEMENT and out.action is None


def test_no_check_in_yet_says_so_with_the_planned_day(trials):
    tools = toolbox(trials["fresh"])
    out = compose("is_it_working", tools)
    assert "no check-in yet" in out.reply.lower()
    assert str(tools.get_trial_status().planned_days) in out.reply


def test_should_switch_follows_the_plans_next_step(trials):
    out = compose("should_switch", toolbox(trials["inside_band_full"]))
    assert out.action is not None and out.action.action == "open_matches" and out.action.available
    assert "rule:band" in out.sources


def test_retake_on_a_sample_trial_offers_the_sample_check_in(trials):
    out = compose("should_switch", toolbox(trials["inconclusive"]))
    assert out.action is not None and out.action.action == "run_sample_checkin"


def test_improvement_wording_never_claims_cause(trials):
    out = compose("is_it_working", toolbox(trials["improvement_full"]))
    assert not re.search(r"\b(product|serum|cream|it)\s+(worked|caused)\b", out.reply, re.I)


def test_trace_lists_only_read_only_tools(trials):
    out = compose("should_switch", toolbox(trials["done"]))
    assert {step.tool for step in out.trace} <= {
        "get_trial_status",
        "get_latest_result",
        "explain_rule",
        "propose_action",
    }
