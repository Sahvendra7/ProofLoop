"""Checked skin profile: parsing YouCam's skin_type entries and the deterministic profile rules."""

from __future__ import annotations

import pytest

from app.domain import profile as pf
from app.domain.metrics import GOALS
from app.providers.youcam.models import AnalysisPollResponse, SkinOutput
from tests.conftest import load_fixture


def entry(region: str, label, **extra) -> SkinOutput:
    return SkinOutput.model_validate(
        {"type": "skin_type", "region": region, "skin_type": label, "mask_urls": [], **extra}
    )


def reading(whole="Normal", t_zone="Normal", u_zone="Normal") -> pf.SkinTypeReading:
    return pf.SkinTypeReading(whole=whole, t_zone=t_zone, u_zone=u_zone)


# --- parsing ------------------------------------------------------------------------------


def test_parses_the_live_recorded_response():
    parsed = AnalysisPollResponse.model_validate(load_fixture("skin-type-success-live.json"))
    got = pf.parse_skin_type(parsed.data.results.output)
    assert got == pf.SkinTypeReading(whole="Dry", t_zone="Normal", u_zone="Dry", unrecognised=0)


@pytest.mark.parametrize("label", pf.LABELS)
@pytest.mark.parametrize("region", pf.REGIONS)
def test_every_documented_label_in_every_region(label, region):
    got = pf.parse_skin_type([entry(region, label)])
    assert got is not None and got.regions()[region] == label
    assert got.unrecognised == 0


def test_no_skin_type_entries_is_none():
    parsed = AnalysisPollResponse.model_validate(load_fixture("analysis-success-live.json"))
    assert pf.parse_skin_type(parsed.data.results.output) is None


@pytest.mark.parametrize("bad", ["Very Oily", "oily", "", None, 3, ["Oily"]])
def test_unsupported_or_malformed_label_is_never_coerced(bad):
    got = pf.parse_skin_type([entry("whole", bad), entry("t_zone", "Oily")])
    assert got is not None
    assert got.whole is None and got.t_zone == "Oily"
    assert got.unrecognised == 1


def test_unknown_region_counts_as_unrecognised():
    got = pf.parse_skin_type([entry("forehead", "Oily")])
    assert got == pf.SkinTypeReading(whole=None, t_zone=None, u_zone=None, unrecognised=1)


def test_first_entry_per_region_wins():
    got = pf.parse_skin_type([entry("whole", "Dry"), entry("whole", "Oily")])
    assert got is not None and got.whole == "Dry"


def test_status_and_json_round_trip():
    full, partial = reading(), pf.SkinTypeReading(whole="Oily", t_zone=None, u_zone=None)
    assert pf.reading_status(full, requested=True) == "complete"
    assert pf.reading_status(partial, requested=True) == "partial"
    assert pf.reading_status(None, requested=True) == "missing"
    assert pf.reading_status(pf.SkinTypeReading(None, None, None, 1), requested=True) == "missing"
    assert pf.reading_status(None, requested=False) == "not_requested"
    assert pf.reading_from_json(pf.reading_to_json(partial)) == partial
    assert pf.reading_from_json(None) is None
    assert pf.reading_from_json("not json") is None


# --- stability across the instrument-check pair ----------------------------------------------


def test_stability_states():
    assert pf.stability(reading(), reading(), repeat_complete=True) == "held"
    assert pf.stability(reading(), reading(u_zone="Dry"), repeat_complete=True) == "changed"
    assert pf.stability(reading(), pf.SkinTypeReading("Normal", "Normal", None), repeat_complete=True) == "partial"
    assert pf.stability(reading(), None, repeat_complete=True) == "partial"
    assert pf.stability(reading(), None, repeat_complete=False) == "not_checked"
    assert pf.stability(None, reading(), repeat_complete=True) == "no_reading"


# --- focus ordering ----------------------------------------------------------------------------

SCORES = {
    "moisture": 72,
    "oiliness": 99,
    "redness": 90,
    "texture": 85,
    "pore": 77,
    "acne": 83,
    "radiance": 80,
    "dark_circle": 68,
}


def keys(plan: pf.FocusPlan) -> list[str]:
    return [item.goal for item in plan.order]


def test_without_answers_the_order_matches_todays_picker():
    # Today's client rule: measured and able to show a gain first, lowest score first; ceiling next; unmeasured last.
    scores = dict(SCORES)
    del scores["texture"]
    plan = pf.focus_plan(scores, None, None)
    assert keys(plan) == [
        "brighter_eyes",
        "hydration",
        "refine_pores",
        "radiance",
        "clearer_look",
        "calm_redness",
        "oil_balance",
        "smooth_texture",
    ]
    assert plan.order[0].badges == ("most_room",)
    assert "cant_show_gains" in plan.order[-2].badges
    assert plan.order[-1].badges == ("not_measured",)
    assert plan.priority_note is None


def test_a_picked_focus_moves_up_only_among_testable_ones():
    plan = pf.focus_plan(SCORES, None, pf.SelfReport(priorities=("radiance", "oil_balance")))
    order = keys(plan)
    assert order[0] == "radiance"
    assert order.index("oil_balance") > order.index("hydration")  # ceiling stays below every testable focus
    picked = {i.goal for i in plan.order if "picked" in i.badges}
    assert picked == {"radiance", "oil_balance"}


def test_picking_an_untestable_focus_explains_and_points_to_room():
    plan = pf.focus_plan(SCORES, None, pf.SelfReport(priorities=("oil_balance",)))
    assert plan.priority_note is not None
    assert "Balance shine" in plan.priority_note.text and "99" in plan.priority_note.text
    assert "Brighter under-eyes has the most room" in plan.priority_note.text


def test_the_ai_label_never_changes_the_order():
    base = keys(pf.focus_plan(SCORES, None, None))
    for label in pf.LABELS:
        assert keys(pf.focus_plan(SCORES, reading(label, label, label), None)) == base


@pytest.mark.parametrize(
    "priorities", [("nope",), ("hydration", "hydration"), ("hydration", "radiance", "oil_balance")]
)
def test_invalid_priorities_are_rejected(priorities):
    with pytest.raises(ValueError):
        pf.SelfReport(priorities=priorities)


# --- rules C1-C5 -------------------------------------------------------------------------------


def notes(plan: pf.FocusPlan) -> dict[str, str]:
    return {n.rule_id: n.text for n in plan.profile_notes}


def goal_notes(plan: pf.FocusPlan, goal: str) -> dict[str, str]:
    return {n.rule_id: n.text for n in next(i for i in plan.order if i.goal == goal).notes}


def test_c1_shine_agreement():
    plan = pf.focus_plan(SCORES, reading(t_zone="Oily"), pf.SelfReport(shine="often"))
    assert notes(plan)["C1"] == "You and the camera both point to shine (T-zone: oily)."


def test_c1_dryness_agreement():
    plan = pf.focus_plan(SCORES, reading(whole="Dry", u_zone="Dry & Redness"), pf.SelfReport(tightness="often"))
    assert "both point to dryness (whole face: dry; cheeks (U-zone): dry & redness)" in notes(plan)["C1"]


@pytest.mark.parametrize(
    ("label", "report"),
    [
        ("Normal", pf.SelfReport(shine="often")),
        ("Oily", pf.SelfReport(shine="rarely")),
        ("Normal", pf.SelfReport(tightness="often")),
        ("Dry", pf.SelfReport(tightness="rarely")),
    ],
)
def test_c2_disagreement(label, report):
    plan = pf.focus_plan(SCORES, reading(label, label, label), report)
    assert "C2" in notes(plan) and "C1" not in notes(plan)
    assert "uses your words" in notes(plan)["C2"]


@pytest.mark.parametrize("report", [pf.SelfReport(shine="sometimes"), pf.SelfReport(shine="unsure"), pf.SelfReport()])
def test_no_agreement_claim_from_vague_answers(report):
    plan = pf.focus_plan(SCORES, reading("Oily", "Oily", "Oily"), report)
    assert not {"C1", "C2"} & set(notes(plan))


def test_c3_label_versus_score_on_the_matching_focus():
    plan = pf.focus_plan(SCORES, reading(t_zone="Oily & Redness"), None)
    assert "Your test uses the score" in goal_notes(plan, "oil_balance")["C3"]
    assert "redness" in goal_notes(plan, "calm_redness")["C3"]
    assert goal_notes(plan, "hydration") == {}


@pytest.mark.parametrize(("score", "expected"), [(79, False), (80, True)])
def test_c3_threshold_is_the_strength_band(score, expected):
    plan = pf.focus_plan({**SCORES, "moisture": score}, reading(whole="Dry"), None)
    assert ("C3" in goal_notes(plan, "hydration")) is expected


@pytest.mark.parametrize("label", [lbl for lbl in pf.LABELS if "Redness" in lbl])
def test_c4_redness_is_never_called_sensitive(label):
    plan = pf.focus_plan(SCORES, reading(whole=label), None)
    text = notes(plan)["C4"]
    assert text.startswith("Redness here means how the photo looks.")
    assert "isn't the same as sensitive skin" in text


def test_redness_score_alone_never_produces_a_sensitivity_note():
    plan = pf.focus_plan({**SCORES, "redness": 20}, reading(), pf.SelfReport())
    assert "C4" not in notes(plan)
    assert all("sensitive" not in n.text for i in plan.order for n in i.notes)


@pytest.mark.parametrize(("reactive", "shown"), [("yes", True), ("no", False), ("unsure", False), (None, False)])
def test_c5_one_change_at_a_time(reactive, shown):
    plan = pf.focus_plan(SCORES, None, pf.SelfReport(reactive=reactive))
    assert ("C5" in notes(plan)) is shown


def test_rejected_or_missing_reading_produces_no_camera_rules():
    plan = pf.focus_plan(SCORES, None, pf.SelfReport(shine="often", reactive="yes"))
    assert set(notes(plan)) == {"C5"}
    assert all(not i.notes for i in plan.order)


def test_rule_text_avoids_forbidden_claims():
    texts = [pf.C4_TEXT, pf.C2_TEXT, pf.C5_TEXT]
    plan = pf.focus_plan(
        SCORES,
        reading("Oily & Redness", "Dry", "Combination & Redness"),
        pf.SelfReport(shine="often", tightness="often", priorities=("oil_balance",)),
    )
    texts += [n.text for n in plan.profile_notes] + [n.text for i in plan.order for n in i.notes]
    texts += [plan.priority_note.text, plan.ranking_explanation]
    for text in texts:
        assert pf.forbidden_claims(text) == [], text


def test_forbidden_claims_detector():
    assert pf.forbidden_claims("Your skin type is oily") == ["your skin type is"]
    assert pf.forbidden_claims("This suits your skin type") == ["suits your skin"]
    assert pf.forbidden_claims("We diagnose rosacea") == ["diagnos"]
    assert pf.forbidden_claims("It isn't a diagnosis.") == []
    assert pf.forbidden_claims("Never a diagnosis.") == []
    assert pf.forbidden_claims("Fitzpatrick type III") == ["fitzpatrick"]


def test_goals_cover_the_rule_targets():
    assert {"oil_balance", "hydration", "calm_redness"} <= {g.key for g in GOALS}


def test_removed_marker_holds_no_label_and_reads_as_no_reading():
    assert pf.is_removed(pf.REMOVED_JSON)
    assert pf.reading_from_json(pf.REMOVED_JSON) is None
    assert not pf.is_removed(pf.reading_to_json(reading()))
    assert not pf.is_removed(None) and not pf.is_removed("not json")
    assert not any(label in pf.REMOVED_JSON for label in pf.LABELS)
