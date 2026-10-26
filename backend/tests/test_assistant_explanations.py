"""The approved-explanation registry: stable IDs, exact approved text, eligibility per trial state."""

from __future__ import annotations

import re
from datetime import UTC, datetime

import pytest

from app.api.schemas import TrialOut
from app.services.assistant.explanations import (
    APPROVED_SENTENCES,
    EXPLANATION_IDS,
    MAX_SELECTED,
    SelectionError,
    eligible_ids,
    render,
)
from app.services.assistant.validate import check_reply, extract_numbers
from app.services.assistant.verdict import canonical_verdict
from tests.assistant_fixtures import CONFLICTING_STATES, CONSISTENT_STATES, capture_trials, make_state

ALWAYS = {
    "variation_band",
    "waiting_rule",
    "photo_comparability",
    "measurement_limits",
    "next_step",
    "instrument_check",
    "detectability",
    "unsupported_question",
}
EARLY = {"no_checkin", "processing", "improvement_early", "decline_early", "inside_band_early"}
NO_CONCLUSION = {"no_checkin", "processing", "inconclusive", "insufficient"}


@pytest.fixture
def states(api) -> dict[str, TrialOut]:
    fresh, done = capture_trials(api)
    return {s: TrialOut.model_validate(make_state(fresh, done, s)) for s in CONSISTENT_STATES + CONFLICTING_STATES}


def verdict(trial: TrialOut):
    return canonical_verdict(trial, datetime.now(UTC))


def test_registry_ids():
    assert set(EXPLANATION_IDS) == ALWAYS | {"early_checkin", "insufficient_data"}
    assert MAX_SELECTED == 3
    for eid in EXPLANATION_IDS:
        assert APPROVED_SENTENCES[eid], eid


@pytest.mark.parametrize("state", CONSISTENT_STATES)
def test_eligibility_per_state(states, state):
    trial = states[state]
    expected = (
        ALWAYS
        | ({"early_checkin"} if state in EARLY else set())
        | ({"insufficient_data"} if state in NO_CONCLUSION else set())
    )
    assert set(eligible_ids(trial, verdict(trial))) == expected


@pytest.mark.parametrize("state", CONFLICTING_STATES)
def test_inconsistent_data_only_allows_generic_text(states, state):
    trial = states[state]
    assert set(eligible_ids(trial, verdict(trial))) == {"measurement_limits", "unsupported_question"}


def _approved_pieces(eid: str, values: dict) -> list[str]:
    return [t.format(**values) for t in APPROVED_SENTENCES[eid].values()]


@pytest.mark.parametrize("state", CONSISTENT_STATES + CONFLICTING_STATES)
def test_rendered_text_is_only_approved_sentences_and_verified_numbers(states, state):
    trial = states[state]
    v = verdict(trial)
    for eid in eligible_ids(trial, v):
        [shown] = render([eid], trial, v)
        assert shown.id == eid and shown.title
        # The text is a concatenation of approved sentences, each filled only from server data.
        rest = shown.text
        for piece in sorted(_approved_pieces(eid, _values(trial, v)), key=len, reverse=True):
            rest = rest.replace(piece, "")
        assert rest.strip() == "", (eid, rest)
        verified = {str(abs(n)) for n in v.facts.values()}
        assert set(extract_numbers(shown.text)) <= verified, (eid, shown.text)


def _values(trial: TrialOut, v) -> dict:
    return {
        "band": trial.focus_noise_band,
        "planned_days": trial.protocol.planned_checkin_days,
        "days_until": v.facts.get("days_until_checkin", 0),
        "label": trial.goal.metric_label.lower(),
        "next_step_text": v.next_step_text,
    }


@pytest.mark.parametrize("state", CONSISTENT_STATES)
def test_no_text_contradicts_the_canonical_verdict(states, state):
    trial = states[state]
    v = verdict(trial)
    outcome = (
        v.code
        if v.code
        in ("measured_improvement", "measured_decline", "no_clear_change", "inconclusive", "insufficient_data")
        else None
    )

    class Facts:
        def numbers_seen(self):
            return {str(abs(n)) for n in v.facts.values()}

    for shown in render([e for e in eligible_ids(trial, v) if e != "unsupported_question"][:MAX_SELECTED], trial, v):
        assert check_reply(shown.text, None, Facts(), outcome, set(), tool_calls=1) == [], (state, shown.id, shown.text)


def test_next_step_text_is_the_canonical_one(states):
    for state in CONSISTENT_STATES:
        trial = states[state]
        v = verdict(trial)
        [shown] = render(["next_step"], trial, v)
        assert shown.text == v.next_step_text


def test_no_new_scientific_or_efficacy_claims():
    every = " ".join(t for sentences in APPROVED_SENTENCES.values() for t in sentences.values())
    assert not re.search(r"\b(clinical\w*|proven|scientific\w*|guarantee\w*|dermatologist|validated)\b", every, re.I)
    band = " ".join(APPROVED_SENTENCES["variation_band"].values())
    assert "not a validation study" in band


@pytest.mark.parametrize(
    "ids",
    [
        ["no_such_topic"],
        ["variation_band", "variation_band"],
        ["variation_band", "waiting_rule", "photo_comparability", "measurement_limits"],
        [],
        ["unsupported_question", "variation_band"],
        ["insufficient_data"],  # not eligible after a measured result
    ],
)
def test_render_rejects_invalid_selections(states, ids):
    trial = states["improvement_full"]
    with pytest.raises(SelectionError):
        render(ids, trial, verdict(trial))


def test_multi_topic_render_keeps_the_order(states):
    trial = states["improvement_early"]
    shown = render(["early_checkin", "variation_band"], trial, verdict(trial))
    assert [s.id for s in shown] == ["early_checkin", "variation_band"]
