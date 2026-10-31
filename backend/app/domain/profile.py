"""The checked skin profile: YouCam's skin-type reading beside the user's own answers.

Four layers stay separate (docs/superpowers/specs/2026-10-26-skin-profile-design.md):
  L1 what the camera read  - `skin_type` entries from the same Skin Analysis task as the scores
  L2 what the user said     - an optional self-report
  L3 these rules            - deterministic, versioned, explain and order; never measure
  L4 the trial's verdict    - domain.compare, which nothing here can reach

Verified live on 2026-10-26 (tests/fixtures/youcam/skin-type-success-live.json): each region
comes back as {"type": "skin_type", "region": ..., "skin_type": "<label>", "mask_urls": [...]},
with no score and no confidence. A label is a snapshot of one photo: oiliness differs by face
region and season, so nothing here calls it the user's "type" or a diagnosis. A redness label
describes appearance; sensitive skin is about sensation and can look normal, so it is never
inferred from the camera or from the redness score.
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterable, Mapping
from dataclasses import asdict, dataclass, field
from typing import Literal

from app.domain.compare import detectability
from app.domain.metrics import GOALS, GOALS_BY_KEY, Band, band_for

RULES_VERSION = "2026-10-26.1"

LABELS: tuple[str, ...] = (
    "Normal",
    "Oily",
    "Dry",
    "Combination",
    "Redness",
    "Dry & Redness",
    "Oily & Redness",
    "Combination & Redness",
)
REGIONS: tuple[str, ...] = ("whole", "t_zone", "u_zone")
REGION_NAMES = {"whole": "whole face", "t_zone": "T-zone", "u_zone": "cheeks (U-zone)"}

ReadingStatus = Literal["complete", "partial", "missing", "removed", "not_requested"]
# Stored in place of a reading the user removed (with their profile): no label survives, but the page can say
# "you removed this" rather than "the camera didn't return one".
REMOVED_JSON = '{"removed": true}'
Stability = Literal["held", "changed", "partial", "not_checked", "no_reading"]
Frequency = Literal["often", "sometimes", "rarely", "unsure"]
Reactive = Literal["yes", "no", "unsure"]
Badge = Literal["picked", "most_room", "cant_show_gains", "not_measured"]

FREQUENCIES = frozenset({"often", "sometimes", "rarely", "unsure"})
REACTIVE = frozenset({"yes", "no", "unsure"})
MAX_PRIORITIES = 2


# --- L1: the camera's reading ---------------------------------------------------------------


@dataclass(frozen=True)
class SkinTypeReading:
    whole: str | None
    t_zone: str | None
    u_zone: str | None
    unrecognised: int = 0  # region entries whose label or region isn't documented; never coerced

    def regions(self) -> dict[str, str | None]:
        return {"whole": self.whole, "t_zone": self.t_zone, "u_zone": self.u_zone}

    def returned(self) -> dict[str, str]:
        return {r: v for r, v in self.regions().items() if v is not None}


def parse_skin_type(outputs: Iterable) -> SkinTypeReading | None:
    """Region labels from a Skin Analysis output list. None when no skin_type entry came back."""
    found: dict[str, str] = {}
    seen = unrecognised = 0
    for out in outputs:
        if getattr(out, "type", None) != "skin_type":
            continue
        seen += 1
        region, label = getattr(out, "region", None), getattr(out, "skin_type", None)
        if region not in REGIONS or not isinstance(label, str) or label not in LABELS:
            unrecognised += 1
            continue
        found.setdefault(region, label)
    if not seen:
        return None
    return SkinTypeReading(found.get("whole"), found.get("t_zone"), found.get("u_zone"), unrecognised)


def reading_status(reading: SkinTypeReading | None, *, requested: bool) -> ReadingStatus:
    if not requested:
        return "not_requested"
    returned = reading.returned() if reading else {}
    if not returned:
        return "missing"
    return "complete" if len(returned) == len(REGIONS) else "partial"


def reading_to_json(reading: SkinTypeReading) -> str:
    return json.dumps(asdict(reading))


def is_removed(text: str | None) -> bool:
    try:
        return bool(text) and json.loads(text) == {"removed": True}
    except ValueError:
        return False


def reading_from_json(text: str | None) -> SkinTypeReading | None:
    if not text or is_removed(text):
        return None
    try:
        data = json.loads(text)
        return SkinTypeReading(
            data.get("whole"), data.get("t_zone"), data.get("u_zone"), int(data.get("unrecognised", 0))
        )
    except (ValueError, TypeError, AttributeError):
        return None


def stability(start: SkinTypeReading | None, repeat: SkinTypeReading | None, *, repeat_complete: bool) -> Stability:
    """Whether the label held between the two instrument-check photos (minutes apart, same session).

    This is photo-to-photo consistency in one pair, not accuracy and not stability over days.
    """
    if start is None or not start.returned():
        return "no_reading"
    if not repeat_complete:
        return "not_checked"
    if repeat is None or len(start.returned()) < len(REGIONS) or len(repeat.returned()) < len(REGIONS):
        return "partial"
    return "held" if start.regions() == repeat.regions() else "changed"


# --- L2: what the user said -----------------------------------------------------------------


@dataclass(frozen=True)
class SelfReport:
    shine: str | None = None
    tightness: str | None = None
    reactive: str | None = None
    priorities: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        for name in ("shine", "tightness"):
            value = getattr(self, name)
            if value is not None and value not in FREQUENCIES:
                raise ValueError(f"{name} must be one of {sorted(FREQUENCIES)}")
        if self.reactive is not None and self.reactive not in REACTIVE:
            raise ValueError(f"reactive must be one of {sorted(REACTIVE)}")
        if len(self.priorities) > MAX_PRIORITIES or len(set(self.priorities)) != len(self.priorities):
            raise ValueError(f"choose up to {MAX_PRIORITIES} different focuses")
        unknown = [p for p in self.priorities if p not in GOALS_BY_KEY]
        if unknown:
            raise ValueError(f"unknown focus: {unknown[0]}")


# --- L3: rules ------------------------------------------------------------------------------


@dataclass(frozen=True)
class Note:
    rule_id: str
    text: str


@dataclass(frozen=True)
class FocusItem:
    goal: str
    rank: int
    badges: tuple[Badge, ...]
    notes: tuple[Note, ...]


@dataclass(frozen=True)
class FocusPlan:
    order: tuple[FocusItem, ...]
    profile_notes: tuple[Note, ...]
    priority_note: Note | None
    ranking_explanation: str
    rules_version: str = RULES_VERSION


C2_TEXT = (
    "Your answers and the camera's reading differ. Shine and dryness shift with season, washing and light, and "
    "neither is a diagnosis. ProofLoop uses your words when it describes your skin."
)
C4_TEXT = (
    "Redness here means how the photo looks. It isn't the same as sensitive skin, which is about how skin feels "
    "(stinging, burning or itching) and can look completely normal."
)
C5_TEXT = "Change one product at a time, so you can tell what made a difference."
RANKING_WITH_PRIORITIES = (
    "Ordered by whether a change could show up, then what you said matters most, then the lowest score first."
)
RANKING_DEFAULT = "Ordered by whether a change could show up, then the lowest score first."

_OILY = frozenset({"Oily", "Combination", "Oily & Redness", "Combination & Redness"})  # shine somewhere on the face
_STRICT_OILY = frozenset({"Oily", "Oily & Redness"})
_DRY = frozenset({"Dry", "Dry & Redness"})
# C3: a label that names the opposite of what the matching score shows (the score is the trial's instrument).
_LABEL_VS_SCORE = (
    ("oil_balance", "oiliness", _STRICT_OILY, "says oily", "the oil-balance score shows little visible shine"),
    ("hydration", "moisture", _DRY, "says dry", "the hydration score looks strong"),
    (
        "calm_redness",
        "redness",
        frozenset(lbl for lbl in LABELS if "Redness" in lbl),
        "mentions redness",
        "the redness score shows little visible redness",
    ),
)


def _where(reading: SkinTypeReading, labels: frozenset[str]) -> str:
    return "; ".join(f"{REGION_NAMES[r]}: {v.lower()}" for r, v in reading.returned().items() if v in labels)


def _profile_notes(reading: SkinTypeReading | None, report: SelfReport | None) -> tuple[Note, ...]:
    notes: list[Note] = []
    labels = set(reading.returned().values()) if reading else set()
    if reading and labels and report:
        agree: list[str] = []
        differ = False
        if report.shine == "often":
            if labels & _OILY:
                agree.append(f"shine ({_where(reading, _OILY)})")
            else:
                differ = True
        if report.shine == "rarely" and labels & _STRICT_OILY:
            differ = True
        if report.tightness == "often":
            if labels & _DRY:
                agree.append(f"dryness ({_where(reading, _DRY)})")
            else:
                differ = True
        if report.tightness == "rarely" and labels & _DRY:
            differ = True
        if differ:
            notes.append(Note("C2", C2_TEXT))
        elif agree:
            notes.append(Note("C1", f"You and the camera both point to {' and '.join(agree)}."))
    if any("Redness" in lbl for lbl in labels):
        notes.append(Note("C4", C4_TEXT))
    if report and report.reactive == "yes":
        notes.append(Note("C5", C5_TEXT))
    return tuple(notes)


def _goal_notes(goal: str, scores: Mapping[str, int], reading: SkinTypeReading | None) -> tuple[Note, ...]:
    if reading is None:
        return ()
    notes = []
    for key, metric, labels, says, shows in _LABEL_VS_SCORE:
        score = scores.get(metric)
        if (
            goal == key
            and score is not None
            and band_for(score) is Band.strength
            and set(reading.returned().values()) & labels
        ):
            notes.append(
                Note(
                    "C3",
                    f"The skin-type reading {says} ({_where(reading, labels)}), but {shows}. Your test uses the score.",
                )
            )
    return tuple(notes)


def focus_plan(scores: Mapping[str, int], reading: SkinTypeReading | None, report: SelfReport | None) -> FocusPlan:
    """Order the focuses and attach notes. The camera's label never changes the order."""
    priorities = report.priorities if report else ()
    index = {g.key: i for i, g in enumerate(GOALS)}

    def improve_at(metric: str) -> int | None:
        return detectability(metric, scores[metric]).improve_at

    def key(goal) -> tuple:
        measured = goal.metric in scores
        ceiling = measured and improve_at(goal.metric) is None
        return (not measured, ceiling, goal.key not in priorities, scores.get(goal.metric, 999), index[goal.key])

    ordered = sorted(GOALS, key=key)
    items = []
    for rank, goal in enumerate(ordered, start=1):
        badges: list[Badge] = []
        if goal.key in priorities:
            badges.append("picked")
        if goal.metric not in scores:
            badges.append("not_measured")
        elif improve_at(goal.metric) is None:
            badges.append("cant_show_gains")
        elif rank == 1:
            badges.append("most_room")
        items.append(FocusItem(goal.key, rank, tuple(badges), _goal_notes(goal.key, scores, reading)))

    priority_note = None
    stuck = [g for g in ordered if g.key in priorities and g.metric in scores and improve_at(g.metric) is None]
    if stuck:
        g = stuck[0]
        text = (
            f"You picked {g.label}, but at {scores[g.metric]} a later scan can't score high enough to count as an "
            "improvement, so this test could only show a drop."
        )
        room = next((o for o in ordered if o.metric in scores and improve_at(o.metric) is not None), None)
        if room is not None:
            text += f" {room.label} has the most room."
        priority_note = Note("P1", text)

    return FocusPlan(
        order=tuple(items),
        profile_notes=_profile_notes(reading, report),
        priority_note=priority_note,
        ranking_explanation=RANKING_WITH_PRIORITIES if priorities else RANKING_DEFAULT,
    )


# --- copy guard -----------------------------------------------------------------------------

_FORBIDDEN = (
    "your skin type is",
    "suits your skin",
    "for your skin type",
    "fitzpatrick",
    "phototype",
    "ethnic",
    "undertone",
    "you have sensitive",
    "cure",
    "treatment",
)
_DIAGNOSIS = re.compile(r"(?<!isn't a )(?<!neither is a )(?<!not a )(?<!never a )\bdiagnos", re.IGNORECASE)


def forbidden_claims(text: str) -> list[str]:
    """Phrases ProofLoop's profile copy must never use (docs/innovation/18 section 4)."""
    lower = text.lower()
    found = [phrase for phrase in _FORBIDDEN if phrase in lower]
    if _DIAGNOSIS.search(text):
        found.append("diagnos")
    return found
