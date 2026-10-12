"""Deterministic, explainable product matching.

Why tiers instead of a percentage: there is no calibration data linking a
catalogue attribute to a measured outcome, so any "87% match" would be false
precision. Instead each product gets a categorical tier from explicit rules,
and products are ordered by a lexicographic key that is shown to the user.

Tier rules for a goal backed by metric M:
  strong    M is a primary target, no caution is triggered, finish preference met
  good      M is a primary target but a caution or finish mismatch applies,
            or M is a secondary target with no caution and no mismatch
  possible  M is a secondary target with a caution or finish mismatch
Hard filters (excluded, with the reason reported): budget, fragrance-free.
Ranking within the result: (tier, -other attention areas addressed,
  -other moderate areas addressed, price, product id).
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import Enum
from typing import Literal

from app.domain.catalog import Catalog, Product
from app.domain.metrics import BAND_LABELS, GOALS_BY_KEY, METRICS_BY_KEY, Band, band_for


class Tier(str, Enum):
    strong = "strong"
    good = "good"
    possible = "possible"


_TIER_ORDER = {Tier.strong: 0, Tier.good: 1, Tier.possible: 2}

RANKING_EXPLANATION = (
    "Ordered by match tier, then by how many of your other lower-scoring areas the product also "
    "targets, then by price (lowest first). Ties are broken alphabetically by product id."
)

ReasonKind = Literal["goal", "also", "preference", "constraint", "caution", "limitation"]


@dataclass(frozen=True)
class Preferences:
    budget_max: float | None = None
    fragrance_free: bool = False
    finish: Literal["light", "rich"] | None = None


@dataclass(frozen=True)
class Reason:
    kind: ReasonKind
    text: str


@dataclass
class Match:
    product: Product
    tier: Tier
    relation: Literal["primary", "secondary"]
    reasons: list[Reason]
    also_addresses: list[str]
    rank: int = 0


@dataclass(frozen=True)
class Excluded:
    product_id: str
    product_name: str
    reason: str


@dataclass
class RecommendationResult:
    goal: str
    metric: str
    measurement: int | None
    band: Band | None
    status: Literal["ok", "no_measurement", "no_matches"]
    matches: list[Match] = field(default_factory=list)
    excluded: list[Excluded] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    ranking_explanation: str = RANKING_EXPLANATION


class UnknownGoal(ValueError):
    pass


def _fmt_metric(key: str, scores: Mapping[str, int]) -> str:
    label = METRICS_BY_KEY[key].label
    score = scores.get(key)
    if score is None:
        return label
    return f"{label} ({score}, {BAND_LABELS[band_for(score)].lower()})"


def recommend(
    scores: Mapping[str, int],
    goal_key: str,
    catalog: Catalog,
    prefs: Preferences | None = None,
) -> RecommendationResult:
    goal = GOALS_BY_KEY.get(goal_key)
    if goal is None:
        raise UnknownGoal(goal_key)
    prefs = prefs or Preferences()
    metric = METRICS_BY_KEY[goal.metric]
    measured = scores.get(metric.key)
    result = RecommendationResult(
        goal=goal.key,
        metric=metric.key,
        measurement=measured,
        band=band_for(measured) if measured is not None else None,
        status="ok",
    )

    if measured is None:
        result.status = "no_measurement"
        result.notes.append(
            f"This scan didn't return a {metric.label.lower()} measurement, so ProofLoop won't match products to it. "
            "Choose another focus or scan again."
        )
        return result

    result.notes.append(
        f"Your {metric.label.lower()} score is {measured}/100 — {BAND_LABELS[band_for(measured)].lower()}."
    )
    if band_for(measured) is Band.strength:
        result.notes.append(
            f"Your {metric.label.lower()} already looks strong. A product may not move this measurement much; "
            "a focus with a lower score could be a better test."
        )

    candidates: list[Match] = []
    for product in catalog.products:
        if metric.key in product.primary_targets:
            relation: Literal["primary", "secondary"] = "primary"
        elif metric.key in product.secondary_targets:
            relation = "secondary"
        else:
            continue

        if prefs.budget_max is not None and product.price > prefs.budget_max:
            result.excluded.append(
                Excluded(product.id, product.name, f"Over your ${prefs.budget_max:.0f} budget (${product.price:.2f}).")
            )
            continue
        if prefs.fragrance_free and not product.fragrance_free:
            result.excluded.append(
                Excluded(product.id, product.name, "Contains fragrance; you asked for fragrance-free.")
            )
            continue

        reasons: list[Reason] = []
        if relation == "primary":
            reasons.append(
                Reason("goal", f"{metric.label} is one of its primary targets, so it's built for this focus.")
            )
        else:
            reasons.append(
                Reason(
                    "goal",
                    f"Lists {metric.label.lower()} as a secondary target: it supports this focus but isn't built around it.",
                )
            )

        others = [k for k in (*product.primary_targets, *product.secondary_targets) if k != metric.key]
        also = [k for k in others if k in scores and band_for(scores[k]) is not Band.strength]
        if also:
            reasons.append(Reason("also", "Also targets " + ", ".join(_fmt_metric(k, scores) for k in also) + "."))

        triggered = [
            c for c in product.cautions if c.when_low in scores and band_for(scores[c.when_low]) is Band.attention
        ]
        for caution in triggered:
            reasons.append(Reason("caution", f"{caution.note} (Your {_fmt_metric(caution.when_low, scores)}.)"))

        finish_mismatch = prefs.finish is not None and product.finish != prefs.finish
        if prefs.finish is not None:
            if finish_mismatch:
                reasons.append(
                    Reason("preference", f"{product.finish.capitalize()} finish — you preferred {prefs.finish}.")
                )
            else:
                reasons.append(Reason("preference", f"{product.finish.capitalize()} finish, as you preferred."))
        if prefs.fragrance_free:
            reasons.append(Reason("preference", "Fragrance-free, as you asked."))
        if prefs.budget_max is not None:
            reasons.append(Reason("constraint", f"Within your ${prefs.budget_max:.0f} budget."))

        penalised = bool(triggered) or finish_mismatch
        if relation == "primary":
            tier = Tier.good if penalised else Tier.strong
        else:
            tier = Tier.possible if penalised else Tier.good

        candidates.append(Match(product, tier, relation, reasons, also))

    def key(m: Match) -> tuple:
        attention = sum(1 for k in m.also_addresses if band_for(scores[k]) is Band.attention)
        moderate = sum(1 for k in m.also_addresses if band_for(scores[k]) is Band.moderate)
        return (_TIER_ORDER[m.tier], -attention, -moderate, m.product.price, m.product.id)

    candidates.sort(key=key)
    for index, match in enumerate(candidates, start=1):
        match.rank = index
    result.matches = candidates
    if not candidates:
        result.status = "no_matches"
        result.notes.append("No catalogue product fits this focus with your current filters.")
    return result
