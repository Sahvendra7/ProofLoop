"""Fixed-wording answers to the quick questions, built only from the tools.

These answers need no LLM and send nothing to a third party. They are also the
fallback whenever a Gemini turn is disabled, fails or breaks a validation rule.
The verdict and next-step sentences come from the canonical verdict (verdict.py),
so every answer states the same result as the trial page.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from app.services.assistant.tools import ActionCheck, LatestResult, ToolBox, TrialStatus
from app.services.assistant.verdict import when_sentence

QuickIntent = Literal["is_it_working", "when_check_in", "should_switch"]
QUICK_INTENTS: tuple[str, ...] = QuickIntent.__args__  # type: ignore[attr-defined]

_SOURCES = {"get_trial_status": "trial_plan", "get_latest_result": "latest_comparison"}


@dataclass
class TraceStep:
    tool: str
    args: dict[str, Any]
    ok: bool


@dataclass
class Composed:
    reply: str
    action: ActionCheck | None
    trace: list[TraceStep] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)


class _Run:
    """Calls tools through ToolBox.call so the trace and the seen numbers match a Gemini turn."""

    def __init__(self, tools: ToolBox) -> None:
        self.tools = tools
        self.trace: list[TraceStep] = []
        self.sources: list[str] = []

    def __call__(self, name: str, **args: Any) -> Any:
        out = self.tools.call(name, args)
        self.trace.append(TraceStep(name, dict(args), True))
        source = _SOURCES.get(name) or (f"rule:{args['topic']}" if name == "explain_rule" else None)
        if source and source not in self.sources:
            self.sources.append(source)
        return out


def compose(intent: QuickIntent | Literal["status"], tools: ToolBox) -> Composed:
    run = _Run(tools)
    status: TrialStatus = run("get_trial_status")
    latest: LatestResult = run("get_latest_result")
    v = tools.verdict

    if intent == "when_check_in":
        parts = [when_sentence(status.planned_days, status.days_until_checkin)]
        if status.provenance == "sample":
            parts.append("This is a sample trial, so its check-in is synthetic.")
        action = _checkin_action(status, latest)
    elif intent == "should_switch":
        if v.code == "unavailable":
            parts = [v.statement]
        elif latest.has_result:
            rule = run("explain_rule", topic="inconclusive" if v.code == "inconclusive" else "band")
            parts = [v.next_step_text]
            if v.next_step in ("consider_switching", "retake"):
                parts.append(rule.text)
        else:
            rule = run("explain_rule", topic="why_wait")
            pending = v.next_step_text if v.code == "checkin_processing" else None
            parts = [
                pending or "There's no check-in to judge yet, so there's no measured reason to switch.",
                rule.text,
                when_sentence(status.planned_days, status.days_until_checkin),
            ]
        action = v.action
    else:  # is_it_working, or the free-text fallback "status"
        parts = [v.statement]
        if not latest.has_result or intent == "status":
            parts.append(v.next_step_text)
        action = v.action

    checked = run("propose_action", action=action) if action != "none" else None
    return Composed(
        reply=" ".join(p for p in parts if p),
        action=checked if checked and checked.available else None,
        trace=run.trace,
        sources=run.sources,
    )


# --- actions -------------------------------------------------------------------


def _checkin_action(s: TrialStatus, r: LatestResult) -> str:
    if r.checkin_processing:
        return "none"
    if s.provenance == "sample":
        return "none" if r.has_result else "run_sample_checkin"
    return "open_checkin"
