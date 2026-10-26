"""The assistant's tools. Read-only by construction.

A ToolBox is built from the TrialOut the trial endpoint already computes for this
session, so the assistant can only repeat numbers the trial page shows. No tool
takes an id or free text: the model cannot point a tool at another trial.

The verdict and next step the tools report are the canonical ones (verdict.py).
These tools serve the fixed wording (compose.py) only: Gemini has no tools and
never sees their output.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, ValidationError

from app.api.schemas import TrialOut
from app.services.assistant.verdict import (
    CanonicalVerdict,
    NextStepCode,
    VerdictCode,
    canonical_verdict,
    trial_days,
)

RuleTopic = Literal["band", "inconclusive", "why_wait", "instrument_check", "early_checkin", "detectability"]
ActionCode = Literal["open_checkin", "open_instrument_check", "open_matches", "run_sample_checkin", "none"]
ACTION_CODES: tuple[str, ...] = ActionCode.__args__  # type: ignore[attr-defined]
RULE_TOPICS: tuple[str, ...] = RuleTopic.__args__  # type: ignore[attr-defined]

# Vetted wording, no numbers: the numbers always come from the trial itself.
RULE_TEXTS: dict[str, str] = {
    "band": (
        "Your band is how far this score can move between two photos of unchanged skin. "
        "A change inside the band can't be told apart from photo variation, so it doesn't count as a change."
    ),
    "inconclusive": (
        "Inconclusive means the two photos were taken in conditions too different to judge fairly, "
        "such as very different light. The fix is a retake in matching conditions, not a different product."
    ),
    "why_wait": (
        "Most skincare is used for several weeks before a change would be expected, "
        "so the plan fixed a check-in date before the trial started."
    ),
    "instrument_check": (
        "The instrument check is an optional second photo taken minutes after the baseline. "
        "If the two readings disagree, your band widens to cover that disagreement. It never narrows."
    ),
    "early_checkin": (
        "A check-in before the planned date is allowed, but it is marked early, "
        "and the plan still asks you to finish the test on the planned date."
    ),
    "detectability": (
        "When a baseline score is already near the top or bottom of the scale, a change in that direction "
        "may be impossible to measure. The plan says in advance which directions can register."
    ),
}


class ToolError(Exception):
    """An unknown tool or invalid arguments. The caller treats the turn as malformed."""


class _Out(BaseModel):
    model_config = ConfigDict(frozen=True)


class TrialStatus(_Out):
    focus_metric: str
    focus_label: str
    product_name: str
    provenance: Literal["sample", "live"]
    day_of_trial: int
    planned_days: int
    days_until_checkin: int
    baseline_score: int | None
    band: int
    band_evidence: Literal["measured", "assumed", "personal"]
    improve_at: int | None
    decline_at: int | None
    sealed: bool
    checkins_count: int
    instrument_check: Literal["none", "taken"]


class LatestResult(_Out):
    has_result: bool
    checkin_processing: bool
    # The canonical verdict and next step (verdict.py). A reply must repeat these, never choose them.
    verdict: VerdictCode
    next_step: NextStepCode
    outcome: (
        Literal["measured_improvement", "measured_decline", "no_clear_change", "inconclusive", "insufficient_data"]
        | None
    ) = None
    baseline_score: int | None = None
    current_score: int | None = None
    delta: int | None = None
    band: int | None = None
    comparability: Literal["good", "fair", "poor"] | None = None
    comparability_issues: list[str] = []
    early: bool | None = None


class RuleText(_Out):
    topic: RuleTopic
    text: str


class ActionCheck(_Out):
    action: ActionCode
    available: bool
    unavailable_reason: str | None = None


class _NoArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")


class _RuleArgs(_NoArgs):
    topic: RuleTopic


class _ActionArgs(_NoArgs):
    action: ActionCode


class ToolBox:
    def __init__(self, trial: TrialOut, now: datetime) -> None:
        self._trial = trial
        self._now = now
        self._numbers: set[str] = set()
        self.verdict: CanonicalVerdict = canonical_verdict(trial, now)

    @property
    def trial(self) -> TrialOut:
        return self._trial

    # --- tools ---------------------------------------------------------------

    def get_trial_status(self) -> TrialStatus:
        t = self._trial
        p = t.protocol
        day, until = trial_days(t, self._now)
        return self._seen(
            TrialStatus(
                focus_metric=t.goal.metric,
                focus_label=t.goal.metric_label,
                product_name=t.product.name,
                provenance=self._provenance(),
                day_of_trial=day,
                planned_days=p.planned_checkin_days,
                days_until_checkin=until,
                baseline_score=p.baseline_score,
                band=t.focus_noise_band,
                band_evidence=p.band_evidence,
                improve_at=p.improve_at,
                decline_at=p.decline_at,
                sealed=p.instrument_check.sealed,
                checkins_count=sum(1 for c in t.checkins if c.status == "complete"),
                instrument_check="taken" if p.instrument_check.status == "complete" else "none",
            )
        )

    def get_latest_result(self) -> LatestResult:
        t = self._trial
        processing = any(c.status == "processing" for c in t.checkins)
        v = self.verdict
        c = t.comparison
        if c is None:
            return self._seen(
                LatestResult(has_result=False, checkin_processing=processing, verdict=v.code, next_step=v.next_step)
            )
        focus = next((ch for ch in c.changes if ch.metric == c.focus_metric), None)
        return self._seen(
            LatestResult(
                has_result=True,
                checkin_processing=processing,
                verdict=v.code,
                next_step=v.next_step,
                outcome=c.focus_outcome,
                baseline_score=focus.baseline if focus else None,
                current_score=focus.current if focus else None,
                delta=focus.delta if focus else None,
                band=t.focus_noise_band,
                comparability=c.comparability.level,
                comparability_issues=list(c.comparability.issue_codes),
                early=c.early,
            )
        )

    def explain_rule(self, topic: RuleTopic) -> RuleText:
        return self._seen(RuleText(topic=topic, text=RULE_TEXTS[topic]))

    def propose_action(self, action: ActionCode) -> ActionCheck:
        sample = self._provenance() == "sample"
        reason: str | None = None
        if action == "run_sample_checkin" and not sample:
            reason = "Only sample-data trials have a synthetic check-in."
        elif action == "open_checkin" and sample:
            reason = "Sample-data trials use the synthetic check-in instead of a photo."
        elif action == "open_instrument_check" and self._trial.protocol.instrument_check.status != "available":
            reason = "The instrument check is no longer available for this trial."
        elif action == "open_matches" and self.verdict.next_step != "consider_switching":
            reason = "The plan's next step is not to look at other products."
        return self._seen(ActionCheck(action=action, available=reason is None, unavailable_reason=reason))

    # --- dispatch --------------------------------------------------------------

    def call(self, name: str, args: dict[str, Any] | None) -> BaseModel:
        args = args or {}
        try:
            if name in ("get_trial_status", "get_latest_result"):
                _NoArgs.model_validate(args)
                return getattr(self, name)()
            if name == "explain_rule":
                return self.explain_rule(_RuleArgs.model_validate(args).topic)
            if name == "propose_action":
                return self.propose_action(_ActionArgs.model_validate(args).action)
        except ValidationError as exc:
            raise ToolError(f"invalid arguments for {name}") from exc
        raise ToolError(f"unknown tool {name}")

    def numbers_seen(self) -> set[str]:
        return set(self._numbers)

    # --- internals ---------------------------------------------------------------

    def _provenance(self) -> Literal["sample", "live"]:
        return "sample" if self._trial.provenance.kind == "demo" else "live"

    def _seen(self, out: BaseModel) -> Any:
        _collect_numbers(out.model_dump(), self._numbers)
        return out


_NUMBER = re.compile(r"\d+(?:\.\d+)?")


def _collect_numbers(value: Any, into: set[str]) -> None:
    if isinstance(value, bool) or value is None:
        return
    if isinstance(value, int | float):
        for n in (value, abs(value)):
            into.add(format(n, "g") if isinstance(n, float) else str(n))
    elif isinstance(value, str):
        into.update(_NUMBER.findall(value))
    elif isinstance(value, dict):
        for v in value.values():
            _collect_numbers(v, into)
    elif isinstance(value, list | tuple):
        for v in value:
            _collect_numbers(v, into)
