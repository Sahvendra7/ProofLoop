"""Normalisation, recommendation and comparison rules."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

import pytest

from app.domain.catalog import load_catalog
from app.domain.compare import CaptureInfo, compare, compare_metric
from app.domain.metrics import REQUESTED_PROVIDER_ACTIONS
from app.domain.normalize import normalize_outputs
from app.domain.recommend import Preferences, Tier, UnknownGoal, recommend
from app.providers.youcam.models import AnalysisPollResponse
from tests.conftest import load_fixture

CATALOG = load_catalog()
ALL_GOOD = {k: 85 for k in ("moisture", "oiliness", "redness", "texture", "pore", "acne", "radiance", "dark_circle")}


@dataclass
class Out:
    type: str
    ui_score: float | None = None
    raw_score: float | None = None
    mask_urls: list[str] = field(default_factory=list)


# ---------------------------------------------------------------- normalise --
def test_live_fixture_normalises_all_eight_metrics():
    parsed = AnalysisPollResponse.model_validate(load_fixture("analysis-success-live.json"))
    result = normalize_outputs(parsed.data.results.output, REQUESTED_PROVIDER_ACTIONS)
    scores = {r.metric: r.ui_score for r in result.readings}
    assert scores == {
        "dark_circle": 68,
        "acne": 99,
        "texture": 88,
        "redness": 99,
        "oiliness": 99,
        "pore": 79,
        "radiance": 82,
        "moisture": 69,
    }
    assert result.missing == []
    assert set(result.ignored_types) == {"all", "skin_age", "resize_image"}


def test_missing_and_invalid_scores_are_missing_never_zero():
    outputs = [Out("moisture", 55), Out("redness", None), Out("oiliness", 150), Out("texture", float("nan"))]
    result = normalize_outputs(outputs, ["moisture", "redness", "oiliness", "texture", "pore"])
    assert [(r.metric, r.ui_score) for r in result.readings] == [("moisture", 55)]
    assert set(result.missing) == {"redness", "oiliness", "texture", "pore"}


def test_duplicate_types_keep_first_and_non_https_masks_dropped():
    outputs = [Out("pore", 70, mask_urls=["http://insecure"]), Out("pore", 10)]
    result = normalize_outputs(outputs, ["pore"])
    assert result.readings[0].ui_score == 70
    assert result.readings[0].mask_url is None


# ---------------------------------------------------------------- recommend --
def ids(result) -> list[str]:
    return [m.product.id for m in result.matches]


def test_low_hydration_puts_primary_hydrators_first():
    scores = {**ALL_GOOD, "moisture": 42}
    result = recommend(scores, "hydration", CATALOG)
    assert result.status == "ok"
    top = result.matches[0]
    assert top.tier is Tier.strong and top.relation == "primary"
    assert {m.product.id for m in result.matches if m.relation == "primary"} == {
        "thale-water-reserve",
        "thale-barrier-rich",
        "numa-milk-essence",
    }
    assert "42/100" in result.notes[0]


def test_low_oil_balance_score_matches_oil_control_with_dehydration_caution():
    # Low oiliness score = more visible shine (higher score = less visible concern).
    scores = {**ALL_GOOD, "oiliness": 40, "moisture": 50}
    result = recommend(scores, "oil_balance", CATALOG)
    by_id = {m.product.id: m for m in result.matches}
    assert by_id["velra-shine-control"].tier is Tier.strong
    clay = by_id["velra-clay-cleanser"]
    assert clay.tier is Tier.good  # primary target, but drying caution triggered by low hydration
    assert any(r.kind == "caution" and "drying" in r.text for r in clay.reasons)


def test_visible_redness_flags_acids_but_ranks_soothers():
    scores = {**ALL_GOOD, "redness": 45}
    result = recommend(scores, "calm_redness", CATALOG)
    assert ids(result)[0] == "ostin-calm-serum"
    azelaic = next(m for m in result.matches if m.product.id == "ostin-azelaic-fluid")
    assert azelaic.tier is Tier.good and any(r.kind == "caution" for r in azelaic.reasons)


def test_high_redness_score_is_not_treated_as_a_problem():
    # A redness score of 95 means redness is NOT very visible.
    result = recommend({**ALL_GOOD, "redness": 95}, "calm_redness", CATALOG)
    assert any("already looks strong" in n for n in result.notes)


def test_mixed_measurements_rank_products_covering_more_low_areas_higher():
    scores = {**ALL_GOOD, "texture": 50, "pore": 52, "radiance": 75}
    result = recommend(scores, "smooth_texture", CATALOG)
    # Both are strong primary matches; the retinal serum also targets pores, which
    # are in the attention band, so it outranks lactic acid (which also targets
    # radiance, only in the moderate band).
    assert ids(result)[:2] == ["thale-retinal-serum", "numa-lactic-night"]
    assert result.matches[0].also_addresses == ["pore"]
    assert result.matches[1].also_addresses == ["radiance"]


def test_missing_goal_measurement_returns_no_recommendations():
    scores = {k: v for k, v in ALL_GOOD.items() if k != "acne"}
    result = recommend(scores, "clearer_look", CATALOG)
    assert result.status == "no_measurement"
    assert result.matches == []


def test_unknown_goal_raises():
    with pytest.raises(UnknownGoal):
        recommend(ALL_GOOD, "overall_skin_appearance", CATALOG)


def test_budget_excludes_with_reasons():
    result = recommend({**ALL_GOOD, "moisture": 40}, "hydration", CATALOG, Preferences(budget_max=25))
    assert ids(result) == ["numa-milk-essence"]
    excluded = {e.product_id: e.reason for e in result.excluded}
    assert "Over your $25 budget" in excluded["thale-barrier-rich"]
    assert all(any(r.kind == "constraint" for r in m.reasons) for m in result.matches)


def test_preference_conflict_lowers_tier_not_eligibility():
    scores = {**ALL_GOOD, "moisture": 40}
    result = recommend(scores, "hydration", CATALOG, Preferences(finish="rich"))
    by_id = {m.product.id: m for m in result.matches}
    assert by_id["thale-barrier-rich"].tier is Tier.strong
    assert by_id["thale-water-reserve"].tier is Tier.good
    assert any("you preferred rich" in r.text for r in by_id["thale-water-reserve"].reasons)


def test_no_matching_products_after_filters():
    result = recommend(ALL_GOOD, "brighter_eyes", CATALOG, Preferences(budget_max=10))
    assert result.status == "no_matches"
    assert len(result.excluded) == 2


def test_fragrance_free_filter():
    result = recommend({**ALL_GOOD, "radiance": 50}, "radiance", CATALOG, Preferences(fragrance_free=True))
    assert "numa-vitc-drops" not in ids(result)
    assert any(e.product_id == "numa-vitc-drops" for e in result.excluded)


def test_ties_break_on_price_then_id():
    result = recommend(ALL_GOOD, "brighter_eyes", CATALOG)
    assert ids(result) == ["ostin-caffeine-eye", "thale-eye-cream"]  # same tier, cheaper first
    assert [m.rank for m in result.matches] == [1, 2]


def test_output_is_deterministic():
    scores = {**ALL_GOOD, "texture": 50, "redness": 55, "moisture": 58}
    runs = [
        [(m.product.id, m.tier, [r.text for r in m.reasons]) for m in recommend(scores, g, CATALOG).matches]
        for g in ("smooth_texture", "smooth_texture")
    ]
    assert runs[0] == runs[1]


def test_every_catalogue_product_reachable_from_some_goal():
    reachable = set()
    for goal in (
        "hydration",
        "oil_balance",
        "calm_redness",
        "smooth_texture",
        "refine_pores",
        "clearer_look",
        "radiance",
        "brighter_eyes",
    ):
        reachable |= set(ids(recommend(ALL_GOOD, goal, CATALOG)))
    assert reachable == {p.id for p in CATALOG.products}


# ------------------------------------------------------------------ compare --
T0 = datetime(2026, 10, 1, tzinfo=UTC)


def cap(lum=85.0, source="camera", days=0) -> CaptureInfo:
    return CaptureInfo(luminance_mean=lum, source=source, captured_at=T0 + timedelta(days=days))


def test_change_within_noise_band_is_not_a_change():
    assert compare_metric("redness", 70, 73).verdict == "within_variation"
    assert compare_metric("moisture", 70, 75).verdict == "within_variation"  # moisture band is 5
    assert compare_metric("pore", 70, 77).verdict == "within_variation"  # pore band is 7
    assert compare_metric("pore", 70, 78).verdict == "better"


def test_direction_follows_higher_is_better():
    assert compare_metric("redness", 60, 70).verdict == "better"
    assert compare_metric("oiliness", 70, 60).verdict == "worse"


def test_missing_metric_is_reported_missing():
    assert compare_metric("acne", None, 70).verdict == "missing"


def test_focus_outcomes():
    base = {"moisture": 60}
    assert compare(base, {"moisture": 70}, cap(), cap(days=21), "moisture").focus_outcome == "measured_improvement"
    assert compare(base, {"moisture": 52}, cap(), cap(days=21), "moisture").focus_outcome == "measured_decline"
    assert compare(base, {"moisture": 62}, cap(), cap(days=21), "moisture").focus_outcome == "no_clear_change"
    assert compare(base, {}, cap(), cap(days=21), "moisture").focus_outcome == "insufficient_data"


def test_poor_lighting_match_makes_result_inconclusive():
    result = compare({"moisture": 60}, {"moisture": 75}, cap(lum=60), cap(lum=110, days=21), "moisture")
    assert result.comparability.level == "poor"
    assert result.focus_outcome == "inconclusive"


def test_source_mismatch_and_short_gap_are_disclosed():
    result = compare({"moisture": 60}, {"moisture": 61}, cap(source="camera"), cap(source="upload", days=2), "moisture")
    assert result.comparability.level == "fair"
    assert any("camera" in i for i in result.comparability.issues)
    assert any("less than a week" in i for i in result.comparability.issues)
