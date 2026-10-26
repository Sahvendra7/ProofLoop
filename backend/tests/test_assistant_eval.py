"""The evaluation corpus (tests/assistant_eval/corpus.json, v2), replayed offline.

Content integrity (the model cannot put its own text on screen) is a property of the code and is replayed here in
full. Selection quality (did the model pick the right topics) needs the real model: scripts/assistant_eval.py --live.
Offline, model-routed questions are replayed with their gold answer, which tests the pipeline only.
"""

from __future__ import annotations

from collections import Counter
from datetime import UTC, datetime

import pytest

from app.api.schemas import TrialOut
from app.services.assistant.explanations import APPROVED_SENTENCES, EXPLANATION_IDS, eligible_ids, render
from app.services.assistant.gemini import GeminiFailure, select_explanations
from app.services.assistant.route import route_question
from app.services.assistant.verdict import canonical_verdict
from tests.assistant_eval.replay import (
    FORMS,
    gold,
    legacy_response,
    legacy_texts,
    load_corpus,
    protocol_transport,
    run_protocol,
    score,
)
from tests.assistant_fixtures import CONSISTENT_STATES, capture_trials, make_state
from tests.test_assistant_gemini import GEMINI, KEY

CORPUS = load_corpus()
QUESTIONS = CORPUS["questions"]
PROTOCOL = CORPUS["protocol"]
RULES = [q for q in QUESTIONS if q["route"] == "rules"]
MODEL = [q for q in QUESTIONS if q["route"] == "model"]
# Offered for a trial with a measured result: insufficient_data and early_checkin are not.
ELIGIBLE_AFTER_RESULT = [i for i in EXPLANATION_IDS if i not in ("insufficient_data", "early_checkin")]


@pytest.fixture
def settings(make_settings):
    return make_settings(GEMINI_FREE_TEXT_ENABLED=True, GEMINI_API_KEY=KEY, GEMINI_API_URL=GEMINI)


@pytest.mark.parametrize("case", RULES, ids=[q["id"] for q in RULES])
def test_rule_routed_questions(case):
    assert route_question(case["question"]) == case["route_ids"]


@pytest.mark.parametrize("case", MODEL, ids=[q["id"] for q in MODEL])
def test_model_routed_questions_reach_the_model(case):
    assert route_question(case["question"]) is None


@pytest.mark.anyio
@pytest.mark.parametrize("case", PROTOCOL, ids=[c["id"] for c in PROTOCOL])
async def test_protocol_case(case, settings):
    result = await run_protocol(case, ELIGIBLE_AFTER_RESULT, settings)
    assert result.ok, (case["id"], result.got, result.ids)


@pytest.mark.anyio
@pytest.mark.parametrize("form", FORMS)
async def test_no_v1_free_text_case_can_render(form, settings):
    """Every v1 explanation, including the 10 that were wrongly shown then, is now rejected outright."""
    shown = []
    for case_id, text in legacy_texts():
        transport = protocol_transport(
            {"response": legacy_response(text, form)["candidates"][0]["content"]["parts"][0]}
        )
        try:
            async with transport as http:
                ids = await select_explanations("Is it working?", ELIGIBLE_AFTER_RESULT, settings, http)
        except GeminiFailure as failure:
            assert failure.reason == "malformed", case_id
            continue
        shown.append((case_id, ids))
    assert shown == []
    assert len(legacy_texts()) == 128


@pytest.mark.anyio
@pytest.mark.parametrize("state", CONSISTENT_STATES)
async def test_gold_selections_render_only_approved_text(api, settings, state):
    """Pipeline replay: each model-routed question, answered with its gold IDs, renders registry text only."""
    fresh, done = capture_trials(api)
    trial = TrialOut.model_validate(make_state(fresh, done, state))
    verdict = canonical_verdict(trial, datetime.now(UTC))
    eligible = eligible_ids(trial, verdict)
    approved = {eid: list(APPROVED_SENTENCES[eid].values()) for eid in EXPLANATION_IDS}
    for case in MODEL:
        ids = gold(case, eligible)
        assert score(ids, case, eligible) == "correct", case["id"]
        for shown in render(ids, trial, verdict):
            assert shown.id in approved
            assert case["question"] not in shown.text  # nothing from the question is echoed


def test_scoring():
    case = {"required": ["variation_band"], "acceptable": ["variation_band", "measurement_limits"]}
    eligible = list(EXPLANATION_IDS)
    assert score(["variation_band"], case, eligible) == "correct"
    assert score(["variation_band", "measurement_limits"], case, eligible) == "correct"
    assert score(["variation_band", "next_step"], case, eligible) == "partial"
    assert score(["next_step"], case, eligible) == "incorrect"
    ambiguous = {"required": [], "acceptable": list(EXPLANATION_IDS)}
    assert score(["measurement_limits"], ambiguous, eligible) == "correct"


def test_corpus_covers_the_brief():
    categories = Counter(q["category"] for q in QUESTIONS)
    for needed in (
        "medical",
        "causal",
        "predictive",
        "product_switching",
        "prompt_injection",
        "fabricated_numbers",
        "reverse_verdict",
        "negation",
        "hypothetical",
        "slang",
        "indirect",
        "ambiguous",
        "off_topic",
        "missing_data",
    ):
        assert categories[needed] >= 1, needed
    labelled = {i for q in MODEL for i in q["required"] + q["acceptable"]} | {i for q in RULES for i in q["route_ids"]}
    assert labelled == set(EXPLANATION_IDS), "every explanation is the right answer to some question"
    assert {c["category"] for c in PROTOCOL} >= {
        "valid",
        "invalid_ids",
        "schema",
        "model_prose",
        "api_failure",
        "limits",
    }


HOLDOUT_SHA256 = "9d497b0bde0142a0b09e3e84d1e076ca1ec68f781f5de4a85f1c4119f59670e4"


def test_holdout_is_frozen():
    """holdout_v1.json was labelled before tuning. Any edit (including a relabel) must be a new, documented file."""
    import hashlib
    from pathlib import Path

    path = Path(__file__).parent / "assistant_eval" / "holdout_v1.json"
    assert hashlib.sha256(path.read_bytes()).hexdigest() == HOLDOUT_SHA256


def test_holdout_scoring():
    from tests.assistant_eval.replay import load_holdout, score_holdout

    case = {
        "expected": ["detectability", "measurement_limits"],
        "acceptable": ["detectability", "measurement_limits", "variation_band"],
        "required": ["detectability", "measurement_limits"],
    }
    eligible = list(EXPLANATION_IDS)
    assert score_holdout(["measurement_limits", "detectability"], case, eligible) == "exact"
    assert score_holdout(["detectability"], case, eligible) == "acceptable"
    assert score_holdout(["detectability", "variation_band"], case, eligible) == "acceptable"
    assert score_holdout(["detectability", "next_step"], case, eligible) == "partial"
    assert score_holdout(["unsupported_question"], case, eligible) == "incorrect"
    holdout = load_holdout()
    assert len(holdout["questions"]) == 49
    for q in holdout["questions"]:
        assert set(q["expected"]) <= set(q["acceptable"]) <= set(EXPLANATION_IDS), q["id"]
        assert set(q["required"]) <= set(q["acceptable"]), q["id"]


@pytest.mark.parametrize("case", RULES, ids=[q["id"] for q in RULES])
def test_rule_routed_answers_score_correct(case):
    from app.services.assistant.route import routed_ids

    ids = routed_ids(case["question"], ELIGIBLE_AFTER_RESULT)
    assert ids and score(ids, case, ELIGIBLE_AFTER_RESULT) == "correct"


HOLDOUT_V2_SHA256 = "8cdd3b0525e8384feae67330f39158f62d792625f1d09b26d3d2eefe7e628ae5"


def test_holdout_v2_is_frozen():
    import hashlib
    from pathlib import Path

    path = Path(__file__).parent / "assistant_eval" / "holdout_v2.json"
    assert hashlib.sha256(path.read_bytes()).hexdigest() == HOLDOUT_V2_SHA256


def test_fallback_expected_applies_only_when_expected_is_ineligible():
    from tests.assistant_eval.replay import score_holdout

    case = {
        "expected": ["insufficient_data"],
        "fallback_expected": ["next_step"],
        "acceptable": ["insufficient_data", "next_step", "waiting_rule"],
        "required": ["insufficient_data", "next_step"],
    }
    no_result = list(EXPLANATION_IDS)
    with_result = [i for i in EXPLANATION_IDS if i != "insufficient_data"]
    assert score_holdout(["insufficient_data"], case, no_result) == "exact"
    assert score_holdout(["next_step"], case, no_result) == "acceptable"
    assert score_holdout(["next_step"], case, with_result) == "exact"
    assert score_holdout(["unsupported_question"], case, with_result) == "incorrect"
