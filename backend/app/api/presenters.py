"""Map database rows and domain objects to API schemas."""

from __future__ import annotations

import json
from datetime import UTC, datetime

from app.api import schemas as s
from app.db.models import ScanRow
from app.domain.catalog import Product
from app.domain.compare import CaptureInfo, Comparison, MetricChange, detectability
from app.domain.metrics import BAND_LABELS, METRICS, METRICS_BY_KEY, Goal, band_for
from app.domain.recommend import RecommendationResult
from app.providers.youcam import endpoints as ep
from app.services.demo import fixture_note

# Goals the Skin Simulation API can visualise. Oil balance is excluded: the
# documented `oiliness` field description is ambiguous about direction.
SIMULATION_CONCERN_FOR_GOAL = {
    "calm_redness": "redness",
    "smooth_texture": "texture",
    "refine_pores": "pores",
    "clearer_look": "acne",
    "radiance": "radiance",
    "brighter_eyes": "dark_circle",
}

_METRIC_ORDER = {m.key: i for i, m in enumerate(METRICS)}


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def provenance(kind: str, synthetic: bool = False, trial: bool = False) -> s.ProvenanceOut:
    if kind == "youcam":
        return s.ProvenanceOut(
            kind="youcam",
            label="YouCam analysis",
            detail="Measured by the YouCam AI Skin Analysis API from your photo.",
        )
    detail = fixture_note()
    if trial:
        detail = (
            "Sample-data trial. The baseline replays a recorded YouCam analysis; the follow-up is synthetic "
            "(fixed changes, dated 21 days later). No provider calls and no photos are involved."
        )
    if synthetic:
        detail = "Synthetic demo follow-up: fixed changes applied to the sample scan, dated 21 days later. Not a measurement."
    return s.ProvenanceOut(kind="demo", label="Sample data" if not synthetic else "Synthetic demo", detail=detail)


def goal_out(goal: Goal) -> s.GoalOut:
    return s.GoalOut(
        key=goal.key,
        label=goal.label,
        metric=goal.metric,
        metric_label=METRICS_BY_KEY[goal.metric].label,
        summary=goal.summary,
        simulation_available=goal.key in SIMULATION_CONCERN_FOR_GOAL,
    )


def product_out(p: Product) -> s.ProductOut:
    return s.ProductOut.model_validate(p.model_dump())


def scores_of(scan: ScanRow) -> dict[str, int]:
    return {r.metric: r.ui_score for r in scan.readings}


def capture_of(scan: ScanRow) -> CaptureInfo:
    return CaptureInfo(luminance_mean=scan.luminance_mean, source=scan.source, captured_at=_aware(scan.observed_at))


def scan_out(scan: ScanRow, now: datetime) -> s.ScanOut:
    masks_live = scan.provenance == "youcam" and scan.masks_expire_at is not None and _aware(scan.masks_expire_at) > now
    metrics = []
    for r in sorted(scan.readings, key=lambda r: _METRIC_ORDER.get(r.metric, 99)):
        meta = METRICS_BY_KEY.get(r.metric)
        if meta is None:
            continue
        band = band_for(r.ui_score)
        detect = detectability(r.metric, r.ui_score)
        metrics.append(
            s.MetricOut(
                key=r.metric,
                label=meta.label,
                plain=meta.plain,
                ui_score=r.ui_score,
                raw_score=round(r.raw_score, 2) if r.raw_score is not None else None,
                band=band.value,
                band_label=BAND_LABELS[band],
                mask_url=r.mask_url if masks_live else None,
                noise_band=detect.noise_band,
                band_evidence=detect.band_evidence,
                improve_at=detect.improve_at,
                decline_at=detect.decline_at,
                detectable=detect.detectable,
            )
        )
    provider_run = None
    if scan.provenance == "youcam":
        provider_run = s.ProviderRunOut(
            name="YouCam AI Skin Analysis",
            endpoint=f"POST {ep.ANALYSIS_TASK_PATH}",
            concerns_requested=json.loads(scan.requested_metrics or "[]"),
            units=scan.units_estimated,
            duration_s=scan.provider_duration_s,
        )
    failure = None
    if scan.status == "failed":
        failure = s.FailureOut(
            code=scan.failure_code or "failed", message=scan.failure_message or "", hint=scan.failure_hint
        )
    return s.ScanOut(
        id=scan.id,
        status=scan.status,
        stage=scan.stage,
        provenance=provenance(scan.provenance, scan.synthetic_timeline),
        trial_id=scan.trial_id,
        created_at=_aware(scan.created_at),
        observed_at=_aware(scan.observed_at),
        completed_at=_aware(scan.completed_at),
        synthetic_timeline=scan.synthetic_timeline,
        capture=capture_out(scan),
        metrics=metrics,
        missing_metrics=json.loads(scan.missing_metrics or "[]"),
        masks_available=masks_live and any(m.mask_url for m in metrics),
        provider_run=provider_run,
        failure=failure,
    )


def recommendation_out(scan: ScanRow, goal: Goal, result: RecommendationResult, disclaimer: str) -> s.RecommendationOut:
    return s.RecommendationOut(
        scan_id=scan.id,
        provenance=provenance(scan.provenance, scan.synthetic_timeline),
        goal=goal_out(goal),
        measurement=result.measurement,
        band=result.band.value if result.band else None,
        status=result.status,
        notes=result.notes,
        ranking_explanation=result.ranking_explanation,
        matches=[
            s.MatchOut(
                rank=m.rank,
                tier=m.tier.value,
                relation=m.relation,
                product=product_out(m.product),
                reasons=[s.ReasonOut(kind=r.kind, text=r.text) for r in m.reasons],
                also_addresses=m.also_addresses,
            )
            for m in result.matches
        ],
        excluded=[
            s.ExcludedOut(product_id=e.product_id, product_name=e.product_name, reason=e.reason)
            for e in result.excluded
        ],
        catalog_disclaimer=disclaimer,
    )


def capture_out(scan: ScanRow) -> s.CaptureOut:
    return s.CaptureOut(source=scan.source, width=scan.width, height=scan.height, luminance_mean=scan.luminance_mean)


def change_out(c: MetricChange) -> s.ChangeOut:
    return s.ChangeOut(
        metric=c.metric,
        label=METRICS_BY_KEY[c.metric].label,
        baseline=c.baseline,
        current=c.current,
        delta=c.delta,
        noise_band=c.noise_band,
        verdict=c.verdict,
        band_evidence=c.band_evidence,
    )


def comparison_out(
    current: ScanRow, comparison: Comparison, planned_checkin_days: int, next_step: s.NextStepOut
) -> s.ComparisonOut:
    return s.ComparisonOut(
        current_scan_id=current.id,
        focus_metric=comparison.focus_metric or "",
        focus_outcome=comparison.focus_outcome or "insufficient_data",
        comparability=s.ComparabilityOut(
            level=comparison.comparability.level,
            issues=comparison.comparability.issues,
            days_apart=comparison.comparability.days_apart,
        ),
        changes=[change_out(c) for c in comparison.changes],
        early=comparison.comparability.days_apart < planned_checkin_days,
        next_step=next_step,
    )
