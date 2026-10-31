"""The measured metrics ProofLoop requests from YouCam, and the goals built on them.

Score semantics (docs.perfectcorp.com, AI Skin Analysis): each concern returns a
`ui_score` integer 1-100 and a `raw_score` float. The overall `all` score is
documented as "higher is better", and `ui_score` is described as a raw score
adjusted "to be more favorable for user motivation". ProofLoop therefore treats
every concern score as an *appearance score where higher means the concern is
less visible*. A low redness score means more visible redness, not less.

The display bands below are ProofLoop's own presentation choice, not YouCam's.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


@dataclass(frozen=True)
class Metric:
    key: str  # ProofLoop key (stable, used in DB and API)
    provider_type: str  # YouCam dst_action and output `type`
    label: str
    plain: str  # what a higher score means, in plain words


METRICS: tuple[Metric, ...] = (
    Metric("moisture", "moisture", "Hydration", "skin looks more hydrated"),
    Metric("oiliness", "oiliness", "Oil balance", "less visible shine"),
    Metric("redness", "redness", "Redness", "less visible redness"),
    Metric("texture", "texture", "Texture", "skin looks smoother"),
    Metric("pore", "pore", "Pores", "pores look less visible"),
    Metric("acne", "acne", "Blemishes", "fewer visible blemishes"),
    Metric("radiance", "radiance", "Radiance", "skin looks more radiant"),
    Metric("dark_circle", "dark_circle_v2", "Under-eye", "less visible darkness under the eyes"),
)

METRICS_BY_KEY = {m.key: m for m in METRICS}
METRICS_BY_PROVIDER_TYPE = {m.provider_type: m for m in METRICS}

# Eight SD concerns = one task in the documented 5-8 concern tier (12 units).
REQUESTED_PROVIDER_ACTIONS: tuple[str, ...] = tuple(m.provider_type for m in METRICS)
# YouCam's skin-type reading (whole / t_zone / u_zone labels) from the same task as the scores. The paired
# gate on 2026-10-26 found the eight scores identical with and without it; see domain/profile.py.
SKIN_TYPE_ACTION = "skin_type"


def baseline_actions(skin_type: bool) -> tuple[str, ...]:
    """What a new baseline requests. A trial's later scans reuse their baseline's stored set instead."""
    return (*REQUESTED_PROVIDER_ACTIONS, SKIN_TYPE_ACTION) if skin_type else REQUESTED_PROVIDER_ACTIONS


class Band(str, Enum):
    attention = "attention"  # < 60
    moderate = "moderate"  # 60-79
    strength = "strength"  # >= 80


BAND_LABELS = {
    Band.attention: "Worth focusing on",
    Band.moderate: "Room to improve",
    Band.strength: "Looking strong",
}


def band_for(score: int) -> Band:
    if score < 60:
        return Band.attention
    if score < 80:
        return Band.moderate
    return Band.strength


@dataclass(frozen=True)
class Goal:
    key: str
    label: str
    metric: str
    summary: str


GOALS: tuple[Goal, ...] = (
    Goal("hydration", "Look more hydrated", "moisture", "Products that hold water in the skin's surface layers."),
    Goal("oil_balance", "Balance shine", "oiliness", "Lightweight, mattifying textures that manage visible shine."),
    Goal(
        "calm_redness", "Calm visible redness", "redness", "Soothing, low-irritation formulas for skin that looks red."
    ),
    Goal(
        "smooth_texture",
        "Smoother texture",
        "texture",
        "Gentle exfoliation and resurfacing for uneven-looking texture.",
    ),
    Goal("refine_pores", "Refine pores", "pore", "Ingredients commonly used to make pores look less visible."),
    Goal("clearer_look", "Fewer visible blemishes", "acne", "Clarifying products for blemish-prone-looking skin."),
    Goal("radiance", "More radiance", "radiance", "Brightening and glow-focused products for dull-looking skin."),
    Goal("brighter_eyes", "Brighter under-eyes", "dark_circle", "Eye-area products for the look of dark circles."),
)

GOALS_BY_KEY = {g.key: g for g in GOALS}
