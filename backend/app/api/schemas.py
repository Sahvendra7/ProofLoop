"""Public API contracts (v1). The frontend mirrors these in src/lib/types.ts."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Provenance = Literal["youcam", "demo"]


class SessionOut(BaseModel):
    session_id: str
    token: str
    created_at: datetime


class ProvenanceOut(BaseModel):
    kind: Provenance
    label: str
    detail: str


class MetricOut(BaseModel):
    key: str
    label: str
    plain: str
    ui_score: int
    raw_score: float | None
    band: Literal["attention", "moderate", "strength"]
    band_label: str
    mask_url: str | None = None
    # What a later scan would need to read for ProofLoop to call a change from
    # this score (see app.domain.compare.detectability). None = undetectable.
    noise_band: int
    band_evidence: Literal["measured", "assumed"]
    improve_at: int | None
    decline_at: int | None
    detectable: Literal["both", "decline_only", "improve_only", "neither"]


class FailureOut(BaseModel):
    code: str
    message: str
    hint: str | None


class CaptureOut(BaseModel):
    source: str
    width: int | None
    height: int | None
    luminance_mean: float | None


class ProviderRunOut(BaseModel):
    name: str
    endpoint: str
    concerns_requested: list[str]
    units: int
    duration_s: float | None


class ScanOut(BaseModel):
    id: str
    status: Literal["processing", "complete", "failed"]
    stage: str
    provenance: ProvenanceOut
    trial_id: str | None
    created_at: datetime
    observed_at: datetime
    completed_at: datetime | None
    synthetic_timeline: bool
    capture: CaptureOut
    metrics: list[MetricOut]
    missing_metrics: list[str]
    masks_available: bool
    provider_run: ProviderRunOut | None
    failure: FailureOut | None


class GoalOut(BaseModel):
    key: str
    label: str
    metric: str
    metric_label: str
    summary: str
    simulation_available: bool


class IngredientOut(BaseModel):
    name: str
    role: str


class CautionOut(BaseModel):
    when_low: str
    note: str


class ProductOut(BaseModel):
    id: str
    name: str
    brand: str
    category: str
    routine_step: str
    price: float
    size_ml: int
    texture: str
    finish: Literal["light", "rich"]
    fragrance_free: bool
    description: str
    key_ingredients: list[IngredientOut]
    primary_targets: list[str]
    secondary_targets: list[str]
    cautions: list[CautionOut]
    palette: list[str]


class CatalogOut(BaseModel):
    disclaimer: str
    products: list[ProductOut]


class ReasonOut(BaseModel):
    kind: str
    text: str


class MatchOut(BaseModel):
    rank: int
    tier: Literal["strong", "good", "possible"]
    relation: Literal["primary", "secondary"]
    product: ProductOut
    reasons: list[ReasonOut]
    also_addresses: list[str]


class ExcludedOut(BaseModel):
    product_id: str
    product_name: str
    reason: str


class RecommendationOut(BaseModel):
    scan_id: str
    provenance: ProvenanceOut
    goal: GoalOut
    measurement: int | None
    band: Literal["attention", "moderate", "strength"] | None
    status: Literal["ok", "no_measurement", "no_matches"]
    notes: list[str]
    ranking_explanation: str
    matches: list[MatchOut]
    excluded: list[ExcludedOut]
    catalog_disclaimer: str


class TrialCreateIn(BaseModel):
    scan_id: str = Field(min_length=1, max_length=64)
    goal: str = Field(min_length=1, max_length=32)
    product_id: str = Field(min_length=1, max_length=64)


class ChangeOut(BaseModel):
    metric: str
    label: str
    baseline: int | None
    current: int | None
    delta: int | None
    noise_band: int
    verdict: Literal["better", "worse", "within_variation", "missing"]
    band_evidence: Literal["measured", "assumed"]


class ComparabilityOut(BaseModel):
    level: Literal["good", "fair", "poor"]
    issues: list[str]
    days_apart: float


class ComparisonOut(BaseModel):
    current_scan_id: str
    focus_metric: str
    focus_outcome: Literal[
        "measured_improvement", "measured_decline", "no_clear_change", "inconclusive", "insufficient_data"
    ]
    comparability: ComparabilityOut
    changes: list[ChangeOut]
    # True when the check-in came before the protocol's planned check-in date.
    early: bool


class HistoryPointOut(BaseModel):
    scan_id: str
    observed_at: datetime
    focus_score: int | None
    synthetic: bool
    is_baseline: bool


class ProtocolOut(BaseModel):
    """The fair-test plan fixed when the trial started."""

    registered: bool  # False for trials created before protocols were stored
    focus_metric: str
    baseline_score: int | None
    noise_band: int
    band_evidence: Literal["measured", "assumed"]
    improve_at: int | None
    decline_at: int | None
    detectable: Literal["both", "decline_only", "improve_only", "neither"]
    planned_checkin_days: int
    planned_checkin_at: datetime
    baseline_capture: CaptureOut


class PreflightOut(BaseModel):
    """Free, local check of a check-in photo against the baseline, before any units are spent."""

    level: Literal["good", "fair", "poor"]
    issues: list[str]
    days_since_baseline: float
    early: bool
    planned_checkin_at: datetime
    baseline_capture: CaptureOut
    candidate_capture: CaptureOut
    units_spent: int = 0


class TrialOut(BaseModel):
    id: str
    provenance: ProvenanceOut
    goal: GoalOut
    product: ProductOut
    created_at: datetime
    baseline: ScanOut
    checkins: list[ScanOut]
    history: list[HistoryPointOut]
    comparison: ComparisonOut | None
    focus_noise_band: int
    protocol: ProtocolOut


class TrialSummaryOut(BaseModel):
    id: str
    baseline_scan_id: str
    provenance: ProvenanceOut
    goal: GoalOut
    product_name: str
    created_at: datetime
    checkin_count: int


class SimulationOut(BaseModel):
    image_url: str
    goal: str
    concern: str
    intensity: float
    provider: str
    endpoint: str
    units: int
    expires_note: str


class BudgetOut(BaseModel):
    limit: int
    committed: int
    remaining: int


class SystemStatusOut(BaseModel):
    provider_configured: bool
    provider_name: str
    analysis_endpoint: str
    simulation_endpoint: str
    concerns: list[str]
    budget: BudgetOut
    noise_bands: dict[str, int]
    demo_note: str
    catalog_disclaimer: str
