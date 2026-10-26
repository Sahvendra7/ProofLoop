"""Validation of the fixed wording, and message redaction.

check_reply holds the server's own templates (compose.py, verdict.py,
explanations.py) to the verdict they state: their words must agree with it, and
every number must be a verified fact. No model-written text is ever shown, so
there is no check for it: Gemini only chooses registry IDs (gemini.py).
"""

from __future__ import annotations

import re
from typing import Protocol

from app.services.assistant.tools import ACTION_CODES

MAX_REPLY_CHARS = 700

_NUMBER = re.compile(r"[+\-−±]?(\d+(?:\.\d+)?)")

# Spelled-out numbers get the same check as digits. A lone "one" or "two" is skipped: they are everyday
# prose ("the one you chose", "the two photos"), not scores or days.
_SMALL = (
    "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen "
    "seventeen eighteen nineteen"
).split()
_TENS = {w: 10 * i for i, w in enumerate("twenty thirty forty fifty sixty seventy eighty ninety".split(), start=2)}
_WORD_VALUES = {w: i for i, w in enumerate(_SMALL)} | _TENS
_T = "|".join(_TENS)
_O = "|".join(_SMALL[1:10])
_W = "|".join(sorted((w for w in _SMALL if w not in ("one", "two")), key=len, reverse=True))
_NUMBER_WORD = re.compile(rf"\b(?:(?P<tens>{_T})(?:[\s-](?P<ones>{_O}))?|(?P<word>{_W}))\b", re.I)
_BAND_MISSTATED = re.compile(rf"\bband\s+(?:\d|{_T}|{_W})", re.I)

_MEDICAL = re.compile(
    r"\b(diagnos\w*|treat\w*|cure\w*|prescri\w*|diseases?|(medical|skin) conditions?|acne treatment|eczema|"
    r"rosacea|dermatitis|infections?|medications?)\b",
    re.I,
)
_CAUSAL = (
    re.compile(r"\b(product|serum|cream|moisturi[sz]er|it)\s+(has\s+)?(worked|works|is working|caused|made)\b", re.I),
    re.compile(r"\bbecause of (the|your|this) (product|serum|cream|moisturi[sz]er)\b", re.I),
    re.compile(r"\bthanks to\b", re.I),
)
_PREDICTION = (
    re.compile(r"\bwill (improve|work|see|get|become|help|clear|fade)\b", re.I),
    re.compile(r"\byou(?:'|’)?ll see\b", re.I),
    re.compile(r"\bguarantee\w*\b", re.I),
    re.compile(r"\bin \d+ (days?|weeks?|months?) you\b", re.I),
)
_IMPROVE_WORDS = re.compile(r"\b(improved|improvement|better|working|worked)\b", re.I)
_DECLINE_WORDS = re.compile(r"\b(worse|declined|dropped)\b", re.I)
# Saying the result sits inside the band, or is inconclusive, is a verdict too. A general rule ("a change inside
# the band can't be told apart...") is not: the pattern needs a verb that places this result there.
_NO_CHANGE_WORDS = re.compile(
    r"\b(?:is|are|falls?|fell|stays?|stayed|remains?|remained|sits?)\s+(?:inside|within)\b"
    r"|\bno (?:clear|measured) change\b|\bnot a measured change\b|\bhasn(?:'|’)?t moved\b",
    re.I,
)
_INCONCLUSIVE_WORDS = re.compile(r"\binconclusive\b", re.I)

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_PHONE = re.compile(r"\+?\d[\d\s().-]{5,}\d")


class _Numbers(Protocol):
    def numbers_seen(self) -> set[str]: ...


def extract_numbers(text: str) -> list[str]:
    """Unsigned numbers, in order, from digits (ignoring ±, +, -, U+2212) and number words up to ninety-nine."""
    return [n for _, n in _number_tokens(text)]


def _number_tokens(text: str) -> list[tuple[int, str]]:
    found = [(m.start(1), m.group(1)) for m in _NUMBER.finditer(text)]
    for m in _NUMBER_WORD.finditer(text):
        value = _WORD_VALUES[(m["tens"] or m["word"]).lower()] + (_WORD_VALUES[m["ones"].lower()] if m["ones"] else 0)
        found.append((m.start(), str(value)))
    return sorted(found)


def check_reply(
    reply: str,
    action: str | None,
    tools: _Numbers,
    outcome: str | None,
    available_actions: set[str],
    tool_calls: int,
) -> list[str]:
    """Names of the rules the reply breaks. Empty means it may be shown."""
    failures: list[str] = []
    if not reply.strip() or len(reply) > MAX_REPLY_CHARS or (action is not None and action not in ACTION_CODES):
        failures.append("shape")
    if tool_calls < 1:
        failures.append("no_tool_call")
    seen = tools.numbers_seen()
    if any(n not in seen for n in extract_numbers(reply)):
        failures.append("unsupported_number")
    if _BAND_MISSTATED.search(reply):
        failures.append("band_misstated")
    if _MEDICAL.search(reply):
        failures.append("medical")
    if any(p.search(reply) for p in _CAUSAL):
        failures.append("causal")
    if any(p.search(reply) for p in _PREDICTION):
        failures.append("prediction")
    improve = bool(_IMPROVE_WORDS.search(reply))
    decline = bool(_DECLINE_WORDS.search(reply))
    no_change = bool(_NO_CHANGE_WORDS.search(reply))
    inconclusive = bool(_INCONCLUSIVE_WORDS.search(reply))
    if (
        (improve and outcome != "measured_improvement")
        or (decline and outcome != "measured_decline")
        or (no_change and outcome != "no_clear_change")
        or (inconclusive and outcome not in ("inconclusive", "insufficient_data"))
    ):
        failures.append("verdict_mismatch")
    if action not in (None, "none") and action in ACTION_CODES and action not in available_actions:
        failures.append("action_not_available")
    return failures


def redact(message: str) -> str:
    """Best-effort removal of emails and phone numbers before a message leaves the server."""
    message = _EMAIL.sub("[email]", message)

    def _phone(match: re.Match[str]) -> str:
        return "[phone]" if sum(ch.isdigit() for ch in match.group()) >= 7 else match.group()

    return _PHONE.sub(_phone, message)
