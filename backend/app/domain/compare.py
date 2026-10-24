"""Baseline-versus-check-in comparison with an explicit noise band.

A change is only called a change when it exceeds the scan-to-scan variation
ProofLoop measured for that metric (see docs/youcam-integration.md, "Repeatability").
Direction follows YouCam's documented semantics: a higher score means the
concern looks less visible. ProofLoop never attributes a change to a product.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field, replace
from datetime import datetime
from typing import Literal

from app.domain.metrics import METRICS

# Points of ui_score movement treated as normal scan-to-scan variation.
# Evidence: 10 successful live analyses of one face on 2026-10-11 (see
# docs/youcam-integration.md, "Repeatability"): identical bytes -> identical
# scores; framing 65-80% / small shifts / 18% darker -> range <= 2; the same photo
# framed in the browser (canvas resample + re-encode) moved pore +5, texture +3,
# moisture +3. Band = observed range across all 10 + 2 points margin, floor 3.
# acne / oiliness / redness were saturated at 99-100 on the test face, so their
# variability is NOT characterised. Until it is, they get the widest band measured
# for any concern (7) rather than an optimistic guess: an unmeasured instrument
# must clear the strictest bar we have evidence for, and is labelled "assumed".
CHARACTERISED = frozenset({"moisture", "texture", "pore", "radiance", "dark_circle"})
MEASURED_BANDS: dict[str, int] = {
    "moisture": 5,  # observed range 3
    "texture": 7,  # observed range 5
    "pore": 7,  # observed range 5
    "radiance": 3,  # observed range 1
    "dark_circle": 3,  # observed range 1
}
CONSERVATIVE_BAND = max(MEASURED_BANDS.values())
NOISE_BANDS: dict[str, int] = {
    "moisture": MEASURED_BANDS["moisture"],
    "oiliness": CONSERVATIVE_BAND,  # saturated, uncharacterised
    "redness": CONSERVATIVE_BAND,  # saturated, uncharacterised
    "texture": MEASURED_BANDS["texture"],
    "pore": MEASURED_BANDS["pore"],
    "acne": CONSERVATIVE_BAND,  # saturated, uncharacterised
    "radiance": MEASURED_BANDS["radiance"],
    "dark_circle": MEASURED_BANDS["dark_circle"],
}

# "personal": widened by this user's own instrument check (see personal_band).
BandEvidence = Literal["measured", "assumed", "personal"]
Detectable = Literal["both", "decline_only", "improve_only", "neither"]
NextAction = Literal[
    "retake", "pause_and_review", "finish_the_test", "keep_going", "consider_switching", "nothing_to_gain"
]

# Instrument check: a second capture taken before the first check-in. The focus
# band becomes max(table band, |repeat - baseline| + margin), the same margin the
# table was built with. One pair can show noise is larger than assumed but never
# that it is smaller (a single difference usually understates the spread), so the
# rule only ever widens. Same-session, so it is still a lower bound on real noise.
PERSONAL_MARGIN = 2

# The trial protocol plans one check-in this long after the baseline. Checking
# in earlier is allowed, but the verdict is labelled an early look.
PLANNED_CHECKIN_DAYS = 28


def band_evidence(metric: str) -> BandEvidence:
    return "measured" if metric in CHARACTERISED else "assumed"


LUMINANCE_FAIR = 12.0  # mean luminance difference (0-255) that weakens a comparison
LUMINANCE_POOR = 25.0  # difference large enough that we won't call a change

Verdict = Literal["better", "worse", "within_variation", "missing"]
Comparability = Literal["good", "fair", "poor"]
FocusOutcome = Literal[
    "measured_improvement", "measured_decline", "no_clear_change", "inconclusive", "insufficient_data"
]


@dataclass(frozen=True)
class CaptureInfo:
    luminance_mean: float | None
    source: str | None
    captured_at: datetime


@dataclass(frozen=True)
class MetricChange:
    metric: str
    baseline: int | None
    current: int | None
    delta: int | None
    noise_band: int
    verdict: Verdict
    band_evidence: BandEvidence = "measured"


@dataclass(frozen=True)
class Detectability:
    """What a later scan would have to read for ProofLoop to call a change.

    Scores are integers 0-100 and a change must exceed the band, so from a
    baseline b with band n an increase counts at b + n + 1 and a decrease at
    b - n - 1. Near the top of the scale an increase is impossible to detect:
    that trial can only ever show a decline (or nothing).
    """

    metric: str
    baseline: int
    noise_band: int
    band_evidence: BandEvidence
    improve_at: int | None
    decline_at: int | None
    detectable: Detectable


def detectability(metric: str, baseline: int, band: int | None = None) -> Detectability:
    n = NOISE_BANDS.get(metric, CONSERVATIVE_BAND) if band is None else band
    up = baseline + n + 1
    down = baseline - n - 1
    improve_at = up if up <= 100 else None
    decline_at = down if down >= 0 else None
    if improve_at is not None and decline_at is not None:
        kind: Detectable = "both"
    elif decline_at is not None:
        kind = "decline_only"
    elif improve_at is not None:
        kind = "improve_only"
    else:
        kind = "neither"
    return Detectability(metric, baseline, n, band_evidence(metric), improve_at, decline_at, kind)


def personal_band(table_band: int, spread: int | None) -> int:
    return table_band if spread is None else max(table_band, spread + PERSONAL_MARGIN)


@dataclass(frozen=True)
class InstrumentCheck:
    focus_metric: str
    table_band: int
    spread: int | None  # |repeat - baseline| on the focus; None if either lacks a reading
    personal_band: int
    widened: bool
    changes: list[MetricChange]  # every concern, against the current table, as context


def instrument_check(
    baseline_scores: Mapping[str, int], repeat_scores: Mapping[str, int], focus_metric: str, table_band: int
) -> InstrumentCheck:
    changes = [
        compare_metric(
            m.key,
            baseline_scores.get(m.key),
            repeat_scores.get(m.key),
            table_band if m.key == focus_metric else None,
        )
        for m in METRICS
    ]
    focus = next(c for c in changes if c.metric == focus_metric)
    spread = abs(focus.delta) if focus.delta is not None else None
    band = personal_band(table_band, spread)
    return InstrumentCheck(focus_metric, table_band, spread, band, band > table_band, changes)


def next_step(outcome: FocusOutcome, early: bool, detectable: Detectable) -> NextAction:
    """One action that follows from the pre-registered plan. Never a claim about the product."""
    if outcome in ("insufficient_data", "inconclusive"):
        return "retake"
    if outcome == "measured_decline":
        return "pause_and_review"
    if early:
        return "finish_the_test"
    if outcome == "measured_improvement":
        return "keep_going"
    return "consider_switching" if detectable in ("both", "improve_only") else "nothing_to_gain"


@dataclass
class ComparabilityReport:
    level: Comparability
    issues: list[str] = field(default_factory=list)
    days_apart: float = 0.0


@dataclass
class Comparison:
    changes: list[MetricChange]
    comparability: ComparabilityReport
    focus_metric: str | None
    focus_outcome: FocusOutcome | None


def compare_metric(metric: str, baseline: int | None, current: int | None, band: int | None = None) -> MetricChange:
    band = NOISE_BANDS.get(metric, CONSERVATIVE_BAND) if band is None else band
    evidence = band_evidence(metric)
    if baseline is None or current is None:
        return MetricChange(metric, baseline, current, None, band, "missing", evidence)
    delta = current - baseline
    if abs(delta) <= band:
        verdict: Verdict = "within_variation"
    else:
        verdict = "better" if delta > 0 else "worse"
    return MetricChange(metric, baseline, current, delta, band, verdict, evidence)


def assess_comparability(
    baseline: CaptureInfo, current: CaptureInfo, *, expect_interval: bool = True
) -> ComparabilityReport:
    """expect_interval=False for an instrument check, whose second photo is meant to be minutes later."""
    issues: list[str] = []
    level: Comparability = "good"
    days = (current.captured_at - baseline.captured_at).total_seconds() / 86400

    if baseline.luminance_mean is not None and current.luminance_mean is not None:
        diff = abs(current.luminance_mean - baseline.luminance_mean)
        if diff >= LUMINANCE_POOR:
            level = "poor"
            issues.append("The lighting in the two photos differs a lot, which can move scores on its own.")
        elif diff >= LUMINANCE_FAIR:
            level = "fair"
            issues.append("The lighting in the two photos differs somewhat; treat small changes with caution.")
    else:
        level = "fair"
        issues.append("Lighting information is missing for one of the photos.")

    if baseline.source and current.source and baseline.source != current.source:
        if level == "good":
            level = "fair"
        issues.append("One photo came from the camera and the other was uploaded, so conditions may differ.")

    if expect_interval and days < 7:
        issues.append(
            "These scans are less than a week apart. Most skincare is used for several weeks before changes would be expected."
        )

    return ComparabilityReport(level=level, issues=issues, days_apart=round(days, 1))


def compare(
    baseline_scores: Mapping[str, int],
    current_scores: Mapping[str, int],
    baseline_capture: CaptureInfo,
    current_capture: CaptureInfo,
    focus_metric: str | None = None,
    focus_band: int | None = None,
    focus_evidence: BandEvidence | None = None,
) -> Comparison:
    """Compare two scans. `focus_band` is the band registered when the trial started
    (widened by an instrument check, if one was taken); it overrides the current table
    for the focus metric so a later recalibration never silently moves the goalposts
    of a running trial. `focus_evidence` relabels the focus band when it is personal."""
    changes = [
        compare_metric(
            m.key,
            baseline_scores.get(m.key),
            current_scores.get(m.key),
            focus_band if m.key == focus_metric else None,
        )
        for m in METRICS
    ]
    if focus_evidence is not None:
        changes = [replace(c, band_evidence=focus_evidence) if c.metric == focus_metric else c for c in changes]
    comparability = assess_comparability(baseline_capture, current_capture)
    outcome: FocusOutcome | None = None
    if focus_metric is not None:
        focus = next(c for c in changes if c.metric == focus_metric)
        if focus.verdict == "missing":
            outcome = "insufficient_data"
        elif comparability.level == "poor":
            outcome = "inconclusive"
        elif focus.verdict == "within_variation":
            outcome = "no_clear_change"
        elif focus.verdict == "better":
            outcome = "measured_improvement"
        else:
            outcome = "measured_decline"
    return Comparison(changes, comparability, focus_metric, outcome)
