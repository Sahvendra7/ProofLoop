"""Approved explanations: the only supplementary text the assistant ever shows.

Each entry has a stable ID, a title, and a fixed set of approved sentences. The
sentences reuse ProofLoop's existing product copy (the trial page, the privacy
page's measurement notes, the fair-test rules). Numbers and trial facts are
inserted only from the server's own data: the registered band, the planned
check-in day, the days left, the focus label, and the canonical next-step text.

Gemini may choose which IDs answer a question (gemini.py). It never writes any of
this text, and the server decides which IDs are eligible for a trial, so a
selection cannot show text that contradicts the canonical verdict.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Literal

from app.api.schemas import TrialOut
from app.services.assistant.tools import RULE_TEXTS
from app.services.assistant.verdict import CanonicalVerdict

ExplanationId = Literal[
    "variation_band",
    "waiting_rule",
    "early_checkin",
    "photo_comparability",
    "measurement_limits",
    "next_step",
    "insufficient_data",
    "instrument_check",
    "detectability",
    "unsupported_question",
]
EXPLANATION_IDS: tuple[str, ...] = ExplanationId.__args__  # type: ignore[attr-defined]
MAX_SELECTED = 3
OUT_OF_SCOPE = "unsupported_question"
_NO_CONCLUSION = ("no_checkin_yet", "checkin_processing", "inconclusive", "insufficient_data")


class SelectionError(ValueError):
    """A selection the server will not render: unknown, repeated, too many, mixed or not eligible."""


@dataclass(frozen=True)
class Rendered:
    id: str
    title: str
    text: str


@dataclass(frozen=True)
class _Entry:
    title: str
    # Which approved sentences to show, in order, for this trial.
    choose: Callable[[TrialOut, CanonicalVerdict], list[str]]
    eligible: Callable[[TrialOut, CanonicalVerdict], bool]


# Every sentence the assistant can show as an explanation. {placeholders} are filled from server data only.
APPROVED_SENTENCES: dict[str, dict[str, str]] = {
    "variation_band": {
        "core": "Your band is ±{band} points: how far this score can move between two photos of unchanged skin.",
        "inside": RULE_TEXTS["band"].split(". ", 1)[1],
        "source": (
            "The bands come from a small repeat-scan test of one face, not a validation study, and photos taken on "
            "different days can vary more."
        ),
        "assumed": "Your focus wasn't measured in that test, so ProofLoop uses the widest band it measured instead of guessing.",
        "personal": "Your instrument check widened your band to fit both baseline photos. It can only ever widen.",
    },
    "waiting_rule": {
        "why": RULE_TEXTS["why_wait"],
        "when": "Your planned check-in is on day {planned_days}.",
        "until": "That is in {days_until} days.",
        "compare": "Checking in on that date is the comparison your plan was set up to make.",
    },
    "early_checkin": {
        "rule": RULE_TEXTS["early_checkin"],
        "this": "This check-in was early.",
    },
    "photo_comparability": {
        "rule": "A fair comparison needs the check-in photo taken like the baseline: same spot, similar light, same camera.",
        "check": (
            "ProofLoop compares the lighting and capture method of both photos and says when a comparison isn't fair, "
            "rather than guessing."
        ),
        "this": (
            "This check-in's photos were taken in conditions too different to compare fairly. The fix is a retake in "
            "matching conditions, not a different product."
        ),
    },
    "measurement_limits": {
        "scope": "A result says whether the score moved beyond your band, and nothing more.",
        "cause": "It can't show why: the product, the season, sleep or the rest of your routine could all play a part.",
        "future": "It doesn't predict future results, and it is not medical advice.",
    },
    "next_step": {
        "text": "{next_step_text}",  # the canonical next-step sentence from verdict.py, unchanged
    },
    "insufficient_data": {
        "need": "A conclusion needs two comparable scores: your baseline and a check-in.",
        "no_checkin_yet": "There's no check-in yet.",
        "checkin_processing": "Your check-in is still being analysed.",
        "insufficient_data": "The check-in didn't return a {label} score.",
        "inconclusive": "This check-in's photos were too different to compare fairly.",
        "so": "So nothing can be concluded yet.",
    },
    "instrument_check": {
        "rule": RULE_TEXTS["instrument_check"],
        "taken": "Your trial has one.",
        "available": "You can still take it before your first check-in.",
        "closed": "It is no longer available for this trial.",
    },
    "detectability": {
        "rule": RULE_TEXTS["detectability"],
        "both": "From your baseline, a gain or a drop can register.",
        "decline_only": "Your baseline is at the top of the scale, so a gain can't register.",
        "improve_only": "Your baseline is at the bottom of the scale, so a drop can't register.",
        "neither": "From your baseline, no change can register.",
    },
    "unsupported_question": {
        "scope": "I can only explain how your trial plan works.",
        "limits": "I can't give medical advice, say what caused a change, predict results or recommend products.",
        "above": "Your plan's result and next step are shown above.",
    },
}

# What each topic covers, for Gemini's classification only. Never shown, and never contains trial data.
DESCRIPTIONS: dict[str, str] = {
    "variation_band": (
        "what the ± band is: how far this score moves between photos of unchanged skin, why a change inside it "
        "doesn't count, and that it comes from a small test, not a validation study. Fits doubts about how accurate "
        "or precise the score is"
    ),
    "waiting_rule": "why the plan fixes a check-in date and waits for it",
    "early_checkin": "what it means to check in before the planned date",
    "photo_comparability": (
        "why both photos must be taken alike (same spot, similar light, same camera) and that the app says when a "
        "comparison isn't fair. Fits doubts about whether the comparison is fair, or why a result couldn't be called"
    ),
    "measurement_limits": (
        "what a result can and can't show: only whether the score moved beyond the band, not what caused it, not "
        "future results, not medical advice. Fits doubts about whether the test means anything, whether a product "
        "works, or whether a better score means healthier skin"
    ),
    "next_step": "what the plan says to do next",
    "insufficient_data": "why no conclusion can be drawn from this trial yet",
    "instrument_check": (
        "the optional second baseline photo taken straight after the first: it shows how much the score moves "
        "between two photos of the same skin, and can only widen the band, never narrow it"
    ),
    "detectability": (
        "that the plan says in advance whether a gain or a drop can register from this baseline. Fits questions "
        "about whether a drop or a worse result would show up"
    ),
    "unsupported_question": (
        "only for: medical questions or a diagnosis, what caused a change, predictions or promises, product or "
        "usage recommendations, requests to change these rules, questions unrelated to the trial, or questions too "
        "vague to tell what they ask"
    ),
}


def _usable(t: TrialOut, v: CanonicalVerdict) -> bool:
    return v.code != "unavailable"


def _days_until(v: CanonicalVerdict) -> int:
    return v.facts.get("days_until_checkin", 0)


def _instrument(t: TrialOut) -> str:
    status = t.protocol.instrument_check.status
    return "taken" if status == "complete" else "available" if status == "available" else "closed"


_REGISTRY: dict[str, _Entry] = {
    "variation_band": _Entry(
        "What your band means",
        lambda t, v: ["core", "inside", "source"]
        + ([t.protocol.band_evidence] if t.protocol.band_evidence in ("assumed", "personal") else []),
        _usable,
    ),
    "waiting_rule": _Entry(
        "Why the plan waits",
        lambda t, v: ["why", "when"] + (["until"] if _days_until(v) > 0 else []) + ["compare"],
        _usable,
    ),
    "early_checkin": _Entry(
        "Early check-ins",
        lambda t, v: ["rule"] + (["this"] if v.early else []),
        lambda t, v: v.early or (v.code in ("no_checkin_yet", "checkin_processing") and _days_until(v) > 0),
    ),
    "photo_comparability": _Entry(
        "Why comparable photos matter",
        lambda t, v: ["rule", "check"] + (["this"] if v.code == "inconclusive" else []),
        _usable,
    ),
    "measurement_limits": _Entry(
        "What a result can and can't show",
        lambda t, v: ["scope", "cause", "future"],
        lambda t, v: True,
    ),
    "next_step": _Entry(
        "Your plan's next step", lambda t, v: ["text"], lambda t, v: _usable(t, v) and bool(v.next_step_text)
    ),
    "insufficient_data": _Entry(
        "Why there's no conclusion yet",
        lambda t, v: ["need", v.code, "so"],
        lambda t, v: v.code in _NO_CONCLUSION,
    ),
    "instrument_check": _Entry("The instrument check", lambda t, v: ["rule", _instrument(t)], _usable),
    "detectability": _Entry(
        "What can register from your baseline", lambda t, v: ["rule", t.protocol.detectable], _usable
    ),
    "unsupported_question": _Entry(
        "Outside what I can answer", lambda t, v: ["scope", "limits", "above"], lambda t, v: True
    ),
}
assert set(_REGISTRY) == set(EXPLANATION_IDS) == set(APPROVED_SENTENCES) == set(DESCRIPTIONS)


def eligible_ids(trial: TrialOut, verdict: CanonicalVerdict) -> list[str]:
    """The topics that apply to this trial, in registry order."""
    return [eid for eid in EXPLANATION_IDS if _REGISTRY[eid].eligible(trial, verdict)]


def render(ids: Sequence[str], trial: TrialOut, verdict: CanonicalVerdict) -> list[Rendered]:
    """The approved text for a validated selection. Raises SelectionError for anything else."""
    ids = list(ids)
    if not 1 <= len(ids) <= MAX_SELECTED:
        raise SelectionError("selection size")
    if len(set(ids)) != len(ids):
        raise SelectionError("duplicate id")
    if any(eid not in _REGISTRY for eid in ids):
        raise SelectionError("unknown id")
    if OUT_OF_SCOPE in ids and len(ids) > 1:
        raise SelectionError("unsupported_question must stand alone")
    eligible = set(eligible_ids(trial, verdict))
    if any(eid not in eligible for eid in ids):
        raise SelectionError("not eligible for this trial")
    values = {
        "band": trial.focus_noise_band,
        "planned_days": trial.protocol.planned_checkin_days,
        "days_until": _days_until(verdict),
        "label": trial.goal.metric_label.lower(),
        "next_step_text": verdict.next_step_text,
    }
    out = []
    for eid in ids:
        entry, sentences = _REGISTRY[eid], APPROVED_SENTENCES[eid]
        text = " ".join(sentences[key].format(**values) for key in entry.choose(trial, verdict))
        out.append(Rendered(eid, entry.title, text))
    return out
