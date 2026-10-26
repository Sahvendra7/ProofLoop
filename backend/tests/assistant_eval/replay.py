"""Replay the assistant evaluation corpus (corpus.json, version 2).

Two different properties are measured, and kept apart:

- Content integrity: whatever the model returns, the only explanation text that can
  be shown is the registry's approved text. Checked by replaying raw model responses
  (the `protocol` cases and every v1 free-text case in four forms) through the real
  selection code. This is a property of the code, so offline replay is meaningful.
- Selection quality: whether the topics picked fit the question. Fixed-rule routes
  are checked exactly offline. Model routes can only be measured against the real
  model (scripts/assistant_eval.py --live); offline they are replayed with the gold
  answer, which tests the pipeline, not the model.

Passing either says nothing about inputs the corpus does not contain.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx

from app.core.config import Settings
from app.services.assistant.gemini import GeminiFailure, select_explanations

HERE = Path(__file__).parent
CORPUS = HERE / "corpus.json"
FORMS = ("raw_text", "extra_field", "as_id", "prose_then_json")


def load_corpus() -> dict[str, Any]:
    return json.loads(CORPUS.read_text())


def legacy_texts() -> list[tuple[str, str]]:
    """(case id, text) for every v1 free-text case, with its placeholders filled in plausibly."""
    v1 = json.loads((HERE / load_corpus()["legacy_free_text"]).read_text())
    values = {
        "band": 5,
        "band_words": "five",
        "planned_days": 28,
        "planned_words": "twenty-eight",
        "baseline": 69,
        "current": 77,
        "abs_delta": 8,
        "abs_delta_words": "eight",
        "wrong_band": 7,
        "fake_delta": 43,
        "fake_score": 97,
        "fake_words": "ninety-seven",
    }
    return [(c["id"], c["explanation"].format(**values)) for c in v1["cases"]]


def legacy_response(text: str, form: str) -> dict:
    """The v1 text smuggled into a model response in one of four ways."""
    part = {
        "raw_text": text,
        "extra_field": json.dumps({"explanation_ids": ["variation_band"], "explanation": text}),
        "as_id": json.dumps({"explanation_ids": [text]}),
        "prose_then_json": text + " " + json.dumps({"explanation_ids": ["variation_band"]}),
    }[form]
    return _body({"text": part})


def _body(part: dict, finish: str = "STOP") -> dict:
    return {"candidates": [{"content": {"role": "model", "parts": [part]}, "finishReason": finish}]}


def protocol_transport(case: dict) -> httpx.AsyncClient:
    """A mock Gemini that answers once with the case's raw response."""

    def handler(request: httpx.Request) -> httpx.Response:
        if case.get("error") == "timeout":
            raise httpx.ReadTimeout("slow")
        if case.get("status"):
            return httpx.Response(case["status"], json={"error": {"message": "scripted"}})
        r = dict(case["response"])
        if r.get("blocked"):
            return httpx.Response(200, json={"promptFeedback": {"blockReason": "SAFETY"}})
        if r.get("empty"):
            return httpx.Response(200, json={"candidates": []})
        if "parts" in r:
            return httpx.Response(
                200, json={"candidates": [{"content": {"parts": r["parts"]}, "finishReason": "STOP"}]}
            )
        finish = r.pop("finish", "STOP")
        return httpx.Response(200, json=_body(r, finish))

    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@dataclass
class ProtocolResult:
    case_id: str
    expect: str
    got: str  # accept | malformed | provider_error | timeout
    ids: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.got == self.expect


async def run_protocol(case: dict, eligible: list[str], settings: Settings) -> ProtocolResult:
    try:
        async with protocol_transport(case) as http:
            ids = await select_explanations("Is it working?", eligible, settings, http)
    except GeminiFailure as failure:
        return ProtocolResult(case["id"], case["expect"], failure.reason)
    ok_ids = ids == case.get("ids", ids)
    return ProtocolResult(case["id"], case["expect"], "accept" if ok_ids else "wrong_ids", ids)


def score(selected: list[str], case: dict, eligible: list[str]) -> str:
    """correct | partial | incorrect, against the gold labels restricted to this trial's eligible topics."""
    acceptable = set(case["acceptable"]) & set(eligible)
    required = set(case["required"]) & set(eligible)
    hits = not required or bool(set(selected) & required)
    if hits and set(selected) <= acceptable:
        return "correct"
    if hits:
        return "partial"
    return "incorrect"


def gold(case: dict, eligible: list[str]) -> list[str]:
    """One selection the labels count as correct, for offline pipeline replay."""
    required = [i for i in eligible if i in case["required"]]
    acceptable = [i for i in eligible if i in case["acceptable"]]
    return (required or acceptable or ["unsupported_question"])[:1]


HOLDOUT = HERE / "holdout_v1.json"


def load_holdout() -> dict[str, Any]:
    return json.loads(HOLDOUT.read_text())


def score_holdout(selected: list[str], case: dict, eligible: list[str]) -> str:
    """exact | acceptable | partial | incorrect, against labels restricted to the trial's eligible topics."""
    expected = set(case["expected"]) & set(eligible)
    if not expected and case.get("fallback_expected"):  # holdout_v2: the preferred topic is ineligible in this state
        expected = set(case["fallback_expected"]) & set(eligible)
    acceptable = set(case["acceptable"]) & set(eligible)
    required = set(case["required"]) & set(eligible)
    hits = not required or bool(set(selected) & required)
    if expected and set(selected) == expected:
        return "exact"
    if hits and set(selected) <= acceptable:
        return "acceptable"
    return "partial" if hits else "incorrect"
