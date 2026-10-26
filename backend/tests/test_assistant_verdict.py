"""The canonical verdict: derived on the server from the stored trial, re-checked against its own numbers."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.api.schemas import TrialOut
from app.services.assistant.validate import check_reply, extract_numbers
from app.services.assistant.verdict import canonical_verdict
from tests.assistant_fixtures import CONFLICTING_STATES, CONSISTENT_STATES, EXPECTED, capture_trials, make_state


@pytest.fixture
def base_trials(api):
    return capture_trials(api)


def verdict_of(trial: dict):
    return canonical_verdict(TrialOut.model_validate(trial), datetime.now(UTC))


def test_real_sample_checkin_is_consistent(base_trials):
    _, done = base_trials
    v = verdict_of(done)
    assert v.code == done["comparison"]["focus_outcome"]
    assert v.next_step == done["comparison"]["next_step"]["action"]
    assert v.early == done["comparison"]["early"]


@pytest.mark.parametrize("state", CONSISTENT_STATES)
def test_every_verdict_state(base_trials, state):
    v = verdict_of(make_state(*base_trials, state))
    assert (v.code, v.next_step, v.early, v.action) == EXPECTED[state]
    assert v.statement
    # The statement only uses numbers it lists as facts, and passes the fixed-wording checks for its own verdict.
    assert set(extract_numbers(v.statement + " " + v.next_step_text)) <= {str(abs(n)) for n in v.facts.values()}
    outcome = (
        v.code
        if v.code
        in ("measured_improvement", "measured_decline", "no_clear_change", "inconclusive", "insufficient_data")
        else None
    )

    class Facts:
        def numbers_seen(self):
            return {str(abs(n)) for n in v.facts.values()}

    assert check_reply(v.statement, None, Facts(), outcome, set(), tool_calls=1) == []


def test_early_is_stated(base_trials):
    v = verdict_of(make_state(*base_trials, "improvement_early"))
    assert "early check-in" in v.statement and str(v.facts["planned_days"]) in v.statement


@pytest.mark.parametrize("state", CONFLICTING_STATES)
def test_conflicting_data_gives_no_verdict(base_trials, state):
    v = verdict_of(make_state(*base_trials, state))
    assert (v.code, v.next_step, v.action) == ("unavailable", "none", "none")
    assert v.inconsistencies, "the reason codes are kept for the log"
    assert extract_numbers(v.statement) == [], "no number from data that disagrees with itself"


def test_stored_outcome_is_not_trusted_on_its_own(base_trials):
    # Same numbers, only the stored label changed: the verdict must not follow the label.
    v = verdict_of(make_state(*base_trials, "conflicting_outcome"))
    assert v.code != "no_clear_change"


@pytest.mark.parametrize("state", CONSISTENT_STATES)
def test_band_is_a_fact_in_every_state(base_trials, state):
    # Explanations may cite "your ±N band" before any check-in too.
    trial = make_state(*base_trials, state)
    assert verdict_of(trial).facts["band"] == trial["focus_noise_band"]
