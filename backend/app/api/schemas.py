"""Public API contracts (v1). The frontend mirrors these in src/lib/types.ts."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

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
    band_evidence: Literal["measured", "assumed", "personal"]


class ComparabilityOut(BaseModel):
    level: Literal["good", "fair", "poor"]
    issues: list[str]
    # Stable codes, one per issue: lighting_differs_a_lot, lighting_differs, lighting_missing, source_differs, under_a_week.
    issue_codes: list[str] = []
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
    next_step: NextStepOut


class NextStepOut(BaseModel):
    """The one action that follows from the pre-registered plan (domain.compare.next_step)."""

    action: Literal[
        "retake", "pause_and_review", "finish_the_test", "keep_going", "consider_switching", "nothing_to_gain"
    ]
    goal: str
    baseline_scan_id: str


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
    band_evidence: Literal["measured", "assumed", "personal"]
    improve_at: int | None
    decline_at: int | None
    detectable: Literal["both", "decline_only", "improve_only", "neither"]
    planned_checkin_days: int
    planned_checkin_at: datetime
    baseline_capture: CaptureOut
    instrument_check: InstrumentCheckOut


class InstrumentCheckOut(BaseModel):
    """An optional second baseline capture that can only widen the focus band."""

    status: Literal["available", "processing", "complete", "failed", "unavailable"]
    unavailable_reason: Literal["sealed"] | None
    scan_id: str | None
    sample: bool
    note: str | None  # provenance of the recorded replay, for sample trials
    units: int  # what running it costs
    table_band: int
    spread: int | None
    personal_band: int | None
    widened: bool
    sealed: bool
    changes: list[ChangeOut]


class PreflightOut(BaseModel):
    """Free, local check of a check-in photo against the baseline, before any units are spent."""

    level: Literal["good", "fair", "poor"]
    issues: list[str]
    days_since_baseline: float
    early: bool
    planned_checkin_at: datetime
    baseline_capture: CaptureOut
    candidate_capture: CaptureOut
    # The exact same photo as the baseline: its scores would be identical, so the scan is refused.
    same_photo: bool = False
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


# --- Trial assistant (read-only) -----------------------------------------------

AssistantIntent = Literal["is_it_working", "when_check_in", "should_switch"]
AssistantAction = Literal["open_checkin", "open_instrument_check", "open_matches", "run_sample_checkin", "none"]
ASSISTANT_CONSENT_VERSION = "2026-10-26"
ASSISTANT_MAX_MESSAGE_CHARS = 500


class AssistantConfigOut(BaseModel):
    free_text_available: bool
    consent_version: str
    quick_intents: list[AssistantIntent]
    max_message_chars: int
    # Typed questions are limited to the prototype owner: the client must present the owner key.
    owner_access_required: bool = True


class AssistantQuickIn(BaseModel):
    intent: AssistantIntent


class AssistantConsentIn(BaseModel):
    version: str = Field(max_length=32)
    adult: Literal[True]
    region_ok: Literal[True]


class AssistantAskIn(BaseModel):
    message: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=ASSISTANT_MAX_MESSAGE_CHARS)
    ]
    consent: AssistantConsentIn | None = None


class AssistantActionOut(BaseModel):
    code: AssistantAction
    available: bool


class AssistantTraceOut(BaseModel):
    tool: str
    args: dict[str, str]
    ok: bool


class AssistantVerdictOut(BaseModel):
    """The plan's verdict and next step, derived on the server (services/assistant/verdict.py). Never model-written."""

    code: Literal[
        "no_checkin_yet",
        "checkin_processing",
        "measured_improvement",
        "measured_decline",
        "no_clear_change",
        "inconclusive",
        "insufficient_data",
        "unavailable",
    ]
    next_step: Literal[
        "check_in",
        "wait_for_analysis",
        "retake",
        "pause_and_review",
        "finish_the_test",
        "keep_going",
        "consider_switching",
        "nothing_to_gain",
        "none",
    ]
    early: bool
    statement: str


class AssistantExplanationOut(BaseModel):
    """One approved explanation (services/assistant/explanations.py), rendered by the server. Never model-written."""

    id: str
    title: str
    text: str


class AssistantReplyOut(BaseModel):
    """One answer. Every text field is server-written: `reply` and `verdict` are the plan's fixed wording, and
    `explanations` are approved registry texts. In mode "gemini", Gemini chose which explanations to show; it never
    writes any of them. units_spent is always 0: the assistant cannot call YouCam."""

    mode: Literal["deterministic", "gemini", "deterministic_fallback"]
    fallback_reason: (
        Literal[
            "disabled",
            "rate_limited",
            "timeout",
            "provider_error",
            "malformed",
            "inconsistent_data",
        ]
        | None
    ) = None
    verdict: AssistantVerdictOut
    reply: str
    explanations: list[AssistantExplanationOut] = []
    action: AssistantActionOut | None
    trace: list[AssistantTraceOut]
    sources: list[str]
    units_spent: Literal[0] = 0
