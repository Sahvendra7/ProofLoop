"""Deterministic routing for typed questions the server can answer without Gemini.

Checked in order; the first match wins. Safety routes come first and match whatever
the polarity or mood of the sentence ("is this eczema?", "it's not eczema, is it?"
and "if I got a rash..." all route the same way). Questions that match nothing go
to Gemini, which can only choose among the same approved IDs.

The routes return candidate IDs. The endpoint drops any that are not eligible for
the trial; every route ends with an ID that is always eligible.
"""

from __future__ import annotations

import re

ROUTES: list[tuple[re.Pattern[str], list[str]]] = [
    # Medical: never answered, whatever the phrasing.
    (
        re.compile(
            r"\b(eczema|rosacea|psoriasis|dermatitis|rash\w*|hives|sting\w*|burn(?:s|ing)?|itch\w*|allerg\w*|"
            r"irritat\w*|sore|bleed\w*|infect\w*|swell\w*|swollen|diagnos\w*|doctor|dermatolog\w*|prescri\w*|"
            r"medic\w*|disease|skin condition|cancer|pregnan\w*|breastfeed\w*|steroid\w*)\b",
            re.I,
        ),
        ["unsupported_question"],
    ),
    # Whether it is safe to keep using a product: a medical question, never a product one.
    (
        re.compile(
            r"\b(?:safe|ok|okay|alright|all right|fine)\s+to\s+(?:keep\s+|continue\s+|carry on\s+)?"
            r"(?:use|using|apply|applying|continu\w*|keep\w*|carry on)\b",
            re.I,
        ),
        ["unsupported_question"],
    ),
    # A symptom described on the skin or face ("my skin is red", "cheeks look blotchy"), or a symptom noun.
    (
        re.compile(
            r"\b(?:skin|face|cheeks?|forehead|chin|nose|lips?|eyes?|neck|jaw)\s+(?:is|are|looks?|feels?|got|gets|went|"
            r"turned|has|have|seems?)\s+(?:a bit\s+|a little\s+|very\s+|really\s+|quite\s+|so\s+|kind of\s+|"
            r"slightly\s+|all\s+)?(?:red|redder|blotch\w*|peel\w*|flak\w*|dry|tight|raw|sore|hot|puffy|swollen|"
            r"inflam\w*|crack\w*|tingl\w*|blister\w*|broken out|break\w* out|bump\w*|spotty)\b"
            r"|\b(?:dry patch\w*|breakouts?|broken out|blisters?|swelling|inflammation|peeling|flaking)\b",
            re.I,
        ),
        ["unsupported_question"],
    ),
    # Attempts to change the assistant's rules.
    (
        re.compile(
            r"\b(ignore (?:all |your |the |previous |prior |these )*(?:rules|instructions|registry|prompt)|"
            r"system prompt|jailbreak|pretend (?:to be|you are)|you are now|developer mode|write your own|"
            r"disregard)\b",
            re.I,
        ),
        ["unsupported_question"],
    ),
    # What caused a change.
    (
        re.compile(
            r"\b(caus\w*|because of|thanks to|due to|responsible for|is it the (?:product|cream|serum|moisturi[sz]er))\b",
            re.I,
        ),
        ["measurement_limits"],
    ),
    # Predictions.
    (
        re.compile(
            r"\b(will (?:it|i|my|this|the)|going to (?:get|be|look|improve|work|change|keep|stay|clear|fade|happen)|"
            r"predict\w*|forecast|in (?:a|one|two|three|few|\d+) "
            r"(?:days?|weeks?|months?)|eventually|how long until (?:it|i see))\b",
            re.I,
        ),
        ["measurement_limits", "waiting_rule"],
    ),
    # Buying, switching or stopping a product.
    (
        re.compile(
            r"\b(buy\w*|purchas\w*|bigger size|full[- ]size|switch\w*|stop using|keep using|worth (?:it|buying)|"
            r"another (?:product|brand|cream|serum)|other (?:products?|brands?)|recommend\w*|better (?:product|"
            r"moisturi[sz]er|cream|serum)|refund)\b",
            re.I,
        ),
        ["next_step", "measurement_limits"],
    ),
    # Whether the product works: the result can't say, and the limits text says why.
    (
        re.compile(
            r"\b(useless|pointless|does (?:it|this|the \w+) (?:actually |even |really )?work|"
            r"(?:is|are) (?:it|this|they) (?:actually |even |really )?working|prove[sd]?|proof)\b",
            re.I,
        ),
        ["measurement_limits"],
    ),
    # Whether the score itself can be trusted: what the band is (and isn't), and what a result can show.
    (re.compile(r"\b(accura\w*|trust\w*)\b", re.I), ["variation_band", "measurement_limits"]),
    # Plain questions about one rule.
    (re.compile(r"\b(what(?:'s| is| does)? (?:the |my )?band\b|band mean)", re.I), ["variation_band"]),
    (re.compile(r"\b(why (?:do|must|should) i (?:have to )?wait|why wait)\b", re.I), ["waiting_rule", "early_checkin"]),
    (
        re.compile(r"\bband\b.*\binstrument check\b|\binstrument check\b.*\bband\b", re.I),
        ["variation_band", "instrument_check"],
    ),
    (re.compile(r"\binstrument check\b", re.I), ["instrument_check"]),
    (re.compile(r"\binconclusive\b", re.I), ["photo_comparability", "insufficient_data"]),
]


def route_question(message: str) -> list[str] | None:
    """Candidate explanation IDs when a fixed rule matches; None when the question needs Gemini."""
    for pattern, ids in ROUTES:
        if pattern.search(message):
            return list(ids)
    return None


def routed_ids(message: str, eligible: list[str]) -> list[str]:
    """The fixed-rule selection, limited to topics eligible for the trial. Empty means: ask Gemini."""
    return [i for i in route_question(message) or [] if i in eligible]


# Where the result is (revision 4). The plan's answer already states it, so the explanation depends on the trial:
# with no result yet, why there is no conclusion; once there is one, the plan's next step.
RESULT_LOCATION = re.compile(
    r"\b(?:where(?:'s| is| are)?|find|see|come through|arrived|got|get|is there|any|show)\b[^.?!]{0,30}"
    r"\b(?:result|verdict|outcome)s?\b|\b(?:result|verdict|outcome)s?\b[^.?!]{0,20}\b(?:yet|anywhere|ready)\b",
    re.I,
)
RESULT_LOCATION_IDS = ["insufficient_data", "next_step"]

# A question of three words or fewer with none of these stems is too vague to route (revision 4): the safe fixed
# answer is better than a confident guess.
_TOPIC_STEMS = (
    "band",
    "wait",
    "check",
    "photo",
    "pic",
    "selfie",
    "light",
    "result",
    "verdict",
    "outcome",
    "score",
    "work",
    "cream",
    "serum",
    "product",
    "moistur",
    "plan",
    "day",
    "week",
    "early",
    "instrument",
    "drop",
    "worse",
    "better",
    "declin",
    "improv",
    "skin",
    "trust",
    "accura",
    "prove",
    "proof",
    "camera",
    "test",
    "trial",
    "change",
    "number",
    "read",
)
_WORD = re.compile(r"[a-z0-9']+")


def is_vague(message: str) -> bool:
    words = _WORD.findall(message.lower())
    return len(words) <= 3 and not any(w.isdigit() or w.startswith(_TOPIC_STEMS) for w in words)


def route_decision(message: str, eligible: list[str]) -> list[str] | None:
    """The fixed rules' answer for this trial, or None when the question goes to Gemini.

    Order: the topic rules (safety first), then result location, then vague questions.
    """
    ids = routed_ids(message, eligible)
    if ids:
        return ids
    if route_question(message) is None:
        if RESULT_LOCATION.search(message):
            return [next(i for i in RESULT_LOCATION_IDS if i in eligible)]
        if is_vague(message):
            return ["unsupported_question"]
    return None
