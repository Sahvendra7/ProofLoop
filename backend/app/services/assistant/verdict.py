"""The trial's authoritative verdict and next step, as the assistant states them.

Derived on the server from the stored trial with the domain's own rules
(compare_metric, focus_outcome, next_step) and rendered only through the fixed
templates below. Gemini never chooses or rewrites these values: a Gemini turn
may add an explanation next to the verdict, never instead of it.

The stored comparison is re-derived from its own numbers (score change, band,
photo comparability, timing, detectability). If the stored values and the
re-derivation disagree, the verdict is "unavailable" and no number is stated,
rather than picking one of the two.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

from app.api.schemas import TrialOut
from app.domain.compare import compare_metric, focus_outcome, next_step

VerdictCode = Literal[
    "no_checkin_yet",
    "checkin_processing",
    "measured_improvement",
    "measured_decline",
    "no_clear_change",
    "inconclusive",
    "insufficient_data",
    "unavailable",
]
NextStepCode = Literal[
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
VERDICT_CODES: tuple[str, ...] = VerdictCode.__args__  # type: ignore[attr-defined]
NEXT_STEP_CODES: tuple[str, ...] = NextStepCode.__args__  # type: ignore[attr-defined]

UNAVAILABLE_STATEMENT = (
    "The assistant can't summarise this check-in: its stored result and its numbers don't agree, "
    "so it won't state a verdict."
)


@dataclass(frozen=True)
class CanonicalVerdict:
    code: VerdictCode
    next_step: NextStepCode
    early: bool
    # The one button that follows from next_step (an ActionCode); "none" when there is nothing to click.
    action: str
    statement: str
    next_step_text: str
    # Every number the two sentences use, by name. Explanations are held to the same numbers.
    facts: dict[str, int] = field(default_factory=dict)
    # Why the verdict is "unavailable": stable codes for the log, never shown.
    inconsistencies: tuple[str, ...] = ()


def trial_days(trial: TrialOut, now: datetime) -> tuple[int, int]:
    """(day of the trial, days until the planned check-in), both at least 0."""
    day = max(0, int((now - trial.baseline.observed_at).total_seconds() // 86400))
    until = (trial.protocol.planned_checkin_at - now).total_seconds() / 86400
    return day, max(0, math.ceil(until))


def canonical_verdict(trial: TrialOut, now: datetime) -> CanonicalVerdict:
    p = trial.protocol
    day, until = trial_days(trial, now)
    facts = {
        "planned_days": p.planned_checkin_days,
        "days_until_checkin": until,
        "day_of_trial": day,
        "band": trial.focus_noise_band,
    }
    sample = trial.provenance.kind == "demo"
    c = trial.comparison

    if c is None:
        if any(s.status == "processing" for s in trial.checkins):
            return CanonicalVerdict(
                "checkin_processing",
                "wait_for_analysis",
                False,
                "none",
                "Your check-in is still being analysed, so there's no result to judge yet.",
                "Ask again when it finishes.",
                facts,
            )
        return CanonicalVerdict(
            "no_checkin_yet",
            "check_in",
            False,
            "run_sample_checkin" if sample else "open_checkin",
            "There's no check-in yet, so there's nothing to compare.",
            when_sentence(p.planned_checkin_days, until),
            facts,
        )

    problems = _inconsistencies(trial)
    if problems:
        return CanonicalVerdict("unavailable", "none", False, "none", UNAVAILABLE_STATEMENT, "", {}, problems)

    focus = next(ch for ch in c.changes if ch.metric == c.focus_metric)
    code: VerdictCode = c.focus_outcome
    step: NextStepCode = c.next_step.action
    if focus.baseline is not None:
        facts["baseline"] = focus.baseline
    if focus.current is not None and focus.delta is not None:
        facts |= {"current": focus.current, "delta": focus.delta}
    label = trial.goal.metric_label.lower()
    return CanonicalVerdict(
        code,
        step,
        c.early,
        _action(step, sample),
        _statement(code, c.early, label, facts),
        _next_step_text(step, label, facts),
        facts,
    )


def when_sentence(planned_days: int, until: int) -> str:
    if until > 0:
        return (
            f"Your plan's check-in is on day {planned_days}, in {until} days. "
            "You can check in earlier, but the result will be marked early."
        )
    return "Your planned check-in date has arrived. Use the same light and camera as your baseline photo."


# --- re-derivation ---------------------------------------------------------------


def _inconsistencies(trial: TrialOut) -> tuple[str, ...]:
    """Every way the stored comparison disagrees with what its own numbers imply."""
    c = trial.comparison
    assert c is not None
    p = trial.protocol
    if c.focus_metric != p.focus_metric or c.focus_metric != trial.goal.metric:
        return ("focus_metric",)
    focus = next((ch for ch in c.changes if ch.metric == c.focus_metric), None)
    if focus is None:
        return ("focus_change_missing",)
    out: list[str] = []
    if focus.noise_band != trial.focus_noise_band:
        out.append("band")
    if focus.baseline is not None and focus.current is not None and focus.delta != focus.current - focus.baseline:
        out.append("delta")
    verdict = compare_metric(focus.metric, focus.baseline, focus.current, trial.focus_noise_band).verdict
    if verdict != focus.verdict:
        out.append("metric_verdict")
    outcome = focus_outcome(verdict, c.comparability.level)
    if outcome != c.focus_outcome:
        out.append("outcome")
    early = c.comparability.days_apart < p.planned_checkin_days
    if early != c.early:
        out.append("early")
    if next_step(outcome, early, p.detectable) != c.next_step.action:
        out.append("next_step")
    return tuple(out)


def _action(step: NextStepCode, sample: bool) -> str:
    if step in ("check_in", "retake"):
        return "run_sample_checkin" if sample else "open_checkin"
    return "open_matches" if step == "consider_switching" else "none"


# --- templates -------------------------------------------------------------------


def _statement(code: VerdictCode, early: bool, label: str, f: dict[str, int]) -> str:
    scores = f"Your {label} score went from {f.get('baseline')} to {f.get('current')}"
    band = f"±{f['band']}"
    sentence = {
        "measured_improvement": (
            f"{scores}, beyond your {band} band, so it counts as a measured improvement. "
            "That is a change in the score, not proof of what caused it."
        ),
        "measured_decline": f"{scores}, a drop beyond your {band} band.",
        "no_clear_change": (
            f"{scores}. That is inside your {band} band, so it can't be told apart from normal photo variation."
        ),
        "inconclusive": "This check-in can't be judged fairly: the two photos were taken in conditions too different to compare.",
        "insufficient_data": f"The check-in didn't return a {label} score, so there's nothing to compare.",
    }[code]
    if early:
        sentence += f" It is an early check-in, so the plan still runs to day {f['planned_days']}."
    return sentence


def _next_step_text(step: NextStepCode, label: str, f: dict[str, int]) -> str:
    return {
        "keep_going": "The plan's next step is to keep going if you like it: the change cleared the line you set before you started.",
        "finish_the_test": (
            "The plan's next step is to finish the test before deciding. "
            f"Keep your routine steady and check in on day {f['planned_days']}."
        ),
        "consider_switching": (
            f"After the full planned time, your {label} score hasn't moved beyond your ±{f['band']} band. "
            "If that result was why you bought it, another product for the same goal may suit you."
        ),
        "pause_and_review": (
            "The score dropped beyond your band. If your skin feels irritated, stop using it; otherwise look at what else "
            "changed and check in again in similar light."
        ),
        "retake": "This comparison can't support a decision. Retake the check-in in light that matches your baseline photo.",
        "nothing_to_gain": (
            "Your baseline was already near the top of the scale, so this test could only watch for a drop, and there "
            "wasn't one. Keeping it is down to how you like it."
        ),
    }[step]
