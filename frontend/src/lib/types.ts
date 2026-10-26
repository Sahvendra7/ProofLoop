// Mirrors backend/app/api/schemas.py (API v1). Keep the two in sync.

export type ProvenanceKind = "youcam" | "demo";
export type Band = "attention" | "moderate" | "strength";
export type Tier = "strong" | "good" | "possible";
export type Verdict = "better" | "worse" | "within_variation" | "missing";
/** "personal": widened by this user's own instrument check (trials only). */
export type BandEvidence = "measured" | "assumed" | "personal";
export type NextAction = "retake" | "pause_and_review" | "finish_the_test" | "keep_going" | "consider_switching" | "nothing_to_gain";
export type Detectable = "both" | "decline_only" | "improve_only" | "neither";
export type FocusOutcome =
  | "measured_improvement"
  | "measured_decline"
  | "no_clear_change"
  | "inconclusive"
  | "insufficient_data";

export interface Provenance {
  kind: ProvenanceKind;
  label: string;
  detail: string;
}

export interface Metric {
  key: string;
  label: string;
  plain: string;
  ui_score: number;
  raw_score: number | null;
  band: Band;
  band_label: string;
  mask_url: string | null;
  /** What a later scan would need to read for ProofLoop to call a change. null = can't be detected. */
  noise_band: number;
  band_evidence: BandEvidence;
  improve_at: number | null;
  decline_at: number | null;
  detectable: Detectable;
}

export interface Scan {
  id: string;
  status: "processing" | "complete" | "failed";
  stage: string;
  provenance: Provenance;
  trial_id: string | null;
  created_at: string;
  observed_at: string;
  completed_at: string | null;
  synthetic_timeline: boolean;
  capture: Capture;
  metrics: Metric[];
  missing_metrics: string[];
  masks_available: boolean;
  provider_run: {
    name: string;
    endpoint: string;
    concerns_requested: string[];
    units: number;
    duration_s: number | null;
  } | null;
  failure: { code: string; message: string; hint: string | null } | null;
}

export interface Goal {
  key: string;
  label: string;
  metric: string;
  metric_label: string;
  summary: string;
  simulation_available: boolean;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  routine_step: string;
  price: number;
  size_ml: number;
  texture: string;
  finish: "light" | "rich";
  fragrance_free: boolean;
  description: string;
  key_ingredients: { name: string; role: string }[];
  primary_targets: string[];
  secondary_targets: string[];
  cautions: { when_low: string; note: string }[];
  palette: [string, string] | string[];
}

export interface Reason {
  kind: "goal" | "also" | "preference" | "constraint" | "caution" | "limitation" | string;
  text: string;
}

export interface Match {
  rank: number;
  tier: Tier;
  relation: "primary" | "secondary";
  product: Product;
  reasons: Reason[];
  also_addresses: string[];
}

export interface Recommendations {
  scan_id: string;
  provenance: Provenance;
  goal: Goal;
  measurement: number | null;
  band: Band | null;
  status: "ok" | "no_measurement" | "no_matches";
  notes: string[];
  ranking_explanation: string;
  matches: Match[];
  excluded: { product_id: string; product_name: string; reason: string }[];
  catalog_disclaimer: string;
}

export interface Change {
  metric: string;
  label: string;
  baseline: number | null;
  current: number | null;
  delta: number | null;
  noise_band: number;
  verdict: Verdict;
  band_evidence: BandEvidence;
}

export interface Comparison {
  current_scan_id: string;
  focus_metric: string;
  focus_outcome: FocusOutcome;
  comparability: { level: "good" | "fair" | "poor"; issues: string[]; issue_codes: string[]; days_apart: number };
  changes: Change[];
  /** The check-in came before the protocol's planned date. */
  early: boolean;
  next_step: NextStep;
}

/** The one action that follows from the pre-registered plan (computed by the API). */
export interface NextStep {
  action: NextAction;
  goal: string;
  baseline_scan_id: string;
}

/** An optional second baseline capture that can only widen the focus band. */
export interface InstrumentCheck {
  status: "available" | "processing" | "complete" | "failed" | "unavailable";
  unavailable_reason: "sealed" | null;
  scan_id: string | null;
  sample: boolean;
  note: string | null;
  units: number;
  table_band: number;
  spread: number | null;
  personal_band: number | null;
  widened: boolean;
  sealed: boolean;
  changes: Change[];
}

export interface Capture {
  source: string;
  width: number | null;
  height: number | null;
  luminance_mean: number | null;
}

/** The fair-test plan fixed when the trial started. */
export interface Protocol {
  registered: boolean;
  focus_metric: string;
  baseline_score: number | null;
  noise_band: number;
  band_evidence: BandEvidence;
  improve_at: number | null;
  decline_at: number | null;
  detectable: Detectable;
  planned_checkin_days: number;
  planned_checkin_at: string;
  baseline_capture: Capture;
  instrument_check: InstrumentCheck;
}

export interface Preflight {
  level: "good" | "fair" | "poor";
  issues: string[];
  days_since_baseline: number;
  early: boolean;
  planned_checkin_at: string;
  baseline_capture: Capture;
  candidate_capture: Capture;
  /** The exact same photo as the baseline: the scan would be refused. */
  same_photo: boolean;
  units_spent: number;
}

export interface Trial {
  id: string;
  provenance: Provenance;
  goal: Goal;
  product: Product;
  created_at: string;
  baseline: Scan;
  checkins: Scan[];
  history: { scan_id: string; observed_at: string; focus_score: number | null; synthetic: boolean; is_baseline: boolean }[];
  comparison: Comparison | null;
  focus_noise_band: number;
  protocol: Protocol;
}

export interface TrialSummary {
  id: string;
  baseline_scan_id: string;
  provenance: Provenance;
  goal: Goal;
  product_name: string;
  created_at: string;
  checkin_count: number;
}

export interface Simulation {
  image_url: string;
  goal: string;
  concern: string;
  intensity: number;
  provider: string;
  endpoint: string;
  units: number;
  expires_note: string;
}

export interface SystemStatus {
  provider_configured: boolean;
  provider_name: string;
  analysis_endpoint: string;
  simulation_endpoint: string;
  concerns: string[];
  budget: { limit: number; committed: number; remaining: number };
  noise_bands: Record<string, number>;
  demo_note: string;
  catalog_disclaimer: string;
}

export interface RecommendationFilters {
  budget_max?: number;
  fragrance_free?: boolean;
  finish?: "light" | "rich";
}

export type AssistantIntent = "is_it_working" | "when_check_in" | "should_switch";
export type AssistantAction = "open_checkin" | "open_instrument_check" | "open_matches" | "run_sample_checkin" | "none";
export type AssistantMode = "deterministic" | "gemini" | "deterministic_fallback";
export type AssistantFallback =
  | "disabled"
  | "rate_limited"
  | "timeout"
  | "provider_error"
  | "malformed"
  | "inconsistent_data";

export interface AssistantConfig {
  free_text_available: boolean;
  consent_version: string;
  quick_intents: AssistantIntent[];
  max_message_chars: number;
  /** Typed questions need the prototype owner's key, checked by the server. */
  owner_access_required: boolean;
}

export interface AssistantConsent {
  version: string;
  adult: true;
  region_ok: true;
}

/** The plan's verdict, derived on the server. Never written by the model. */
export interface AssistantVerdict {
  code:
    | "no_checkin_yet"
    | "checkin_processing"
    | "measured_improvement"
    | "measured_decline"
    | "no_clear_change"
    | "inconclusive"
    | "insufficient_data"
    | "unavailable";
  next_step: string;
  early: boolean;
  statement: string;
}

/** One approved explanation, rendered by the server from its registry. Never model-written. */
export interface AssistantExplanation {
  id: string;
  title: string;
  text: string;
}

/**
 * One answer from the read-only trial assistant. Every text field is server-written: `reply` is the plan's fixed
 * wording, `explanations` are approved registry texts. In mode "gemini" Gemini only chose which explanations to show.
 * units_spent is always 0.
 */
export interface AssistantReply {
  mode: AssistantMode;
  fallback_reason: AssistantFallback | null;
  verdict: AssistantVerdict;
  reply: string;
  explanations: AssistantExplanation[];
  action: { code: AssistantAction; available: boolean } | null;
  trace: { tool: string; args: Record<string, string>; ok: boolean }[];
  sources: string[];
  units_spent: 0;
}
