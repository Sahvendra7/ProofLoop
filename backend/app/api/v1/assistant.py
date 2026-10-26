"""Trial assistant: read-only answers about one trial, from the trial's own numbers.

Quick intents never touch an LLM. Free text runs the bounded Gemini loop only when
GEMINI_FREE_TEXT_ENABLED and a key are both set and the caller sent current
consent; every failure falls back to the fixed wording with its reason.

Every answer carries the canonical verdict and the fixed wording. A typed
question can add approved explanations beside them: fixed rules pick the topics
when they can (route.py), otherwise Gemini picks among the topics that apply to
this trial. Either way the text shown is the registry's (explanations.py). When the
stored result disagrees with its own numbers, no verdict is stated and Gemini is
not called.
"""

from __future__ import annotations

import hashlib
import hmac
import time

from fastapi import APIRouter, Depends, Header, Request, Response
from sqlalchemy.orm import Session

from app.api import schemas as s
from app.api.deps import current_session, owned_trial, settings_dep
from app.api.v1.trials import _trial_out
from app.core.config import Settings
from app.core.errors import AppError
from app.core.logging import get_logger
from app.db.models import SessionRow, utcnow
from app.db.session import get_db
from app.services.assistant.compose import QUICK_INTENTS, Composed, TraceStep, compose
from app.services.assistant.explanations import SelectionError, eligible_ids, render
from app.services.assistant.gemini import GeminiFailure, select_explanations
from app.services.assistant.route import route_decision
from app.services.assistant.tools import ToolBox

router = APIRouter(tags=["assistant"])
log = get_logger("proofloop.assistant")


@router.get("/assistant/config", response_model=s.AssistantConfigOut)
def assistant_config(settings: Settings = Depends(settings_dep)) -> s.AssistantConfigOut:
    return s.AssistantConfigOut(
        free_text_available=settings.free_text_available,
        consent_version=s.ASSISTANT_CONSENT_VERSION,
        quick_intents=list(QUICK_INTENTS),
        max_message_chars=s.ASSISTANT_MAX_MESSAGE_CHARS,
    )


def _require_owner(authorization: str | None, settings: Settings) -> None:
    """Typed questions call Gemini, which this prototype limits to its owner. Checked on the server, before anything
    else, against the SHA-256 of the owner key in ASSISTANT_OWNER_TOKEN_SHA256. The key itself is never stored or
    logged."""
    expected = settings.owner_hash
    scheme, _, key = (authorization or "").partition(" ")
    presented = hashlib.sha256(key.encode()).hexdigest() if scheme.lower() == "bearer" and key else ""
    if expected is None or not hmac.compare_digest(presented, expected):
        raise AppError("owner_auth_required", "Typed questions are limited to the prototype owner.", 401)


@router.post("/assistant/owner", status_code=204)
def assistant_owner_check(
    authorization: str | None = Header(default=None), settings: Settings = Depends(settings_dep)
) -> Response:
    """Lets the owner's browser check its key before showing the free-text box. 404 when free text is off."""
    if not settings.free_text_available:
        raise AppError("not_found", "Not Found", 404)
    _require_owner(authorization, settings)
    return Response(status_code=204)


@router.post("/trials/{trial_id}/assistant/quick", response_model=s.AssistantReplyOut)
def assistant_quick(
    trial_id: str,
    body: s.AssistantQuickIn,
    session: SessionRow = Depends(current_session),
    db: Session = Depends(get_db),
) -> s.AssistantReplyOut:
    started = time.monotonic()
    tools = _toolbox(db, session, trial_id)
    out = _composed(compose(body.intent, tools), tools, "deterministic", None)
    _log(trial_id, out, started)
    return out


@router.post("/trials/{trial_id}/assistant/ask", response_model=s.AssistantReplyOut)
async def assistant_ask(
    trial_id: str,
    body: s.AssistantAskIn,
    request: Request,
    session: SessionRow = Depends(current_session),
    db: Session = Depends(get_db),
    settings: Settings = Depends(settings_dep),
    authorization: str | None = Header(default=None),
) -> s.AssistantReplyOut:
    started = time.monotonic()
    tools = _toolbox(db, session, trial_id)
    # Everything the tools need is now in memory: end the read transaction before any network wait.
    db.rollback()

    summary = compose("status", tools)
    if not settings.free_text_available:
        out = _composed(summary, tools, "deterministic_fallback", "disabled")
    else:
        _require_owner(authorization, settings)
        if body.consent is None or body.consent.version != s.ASSISTANT_CONSENT_VERSION:
            raise AppError(
                "consent_required",
                "Confirm the notice about sending your question to Google's Gemini API first.",
                422,
            )
        eligible = eligible_ids(tools.trial, tools.verdict)
        routed = route_decision(body.message, eligible)
        if tools.verdict.code == "unavailable":
            out = _composed(summary, tools, "deterministic_fallback", "inconsistent_data")
            log.info(
                "assistant_inconsistent_data",
                extra={"trial_id": trial_id, "checks": list(tools.verdict.inconsistencies)},
            )
        elif routed:
            out = _explained(summary, tools, "deterministic", routed, "match_question")
        elif not request.app.state.ask_limiter.allow(session.id):
            out = _composed(summary, tools, "deterministic_fallback", "rate_limited")
        else:
            try:
                ids = await select_explanations(body.message, eligible, settings, request.app.state.gemini_http)
                out = _explained(summary, tools, "gemini", ids, "select_explanations")
            except (GeminiFailure, SelectionError) as failure:
                reason = failure.reason if isinstance(failure, GeminiFailure) else "malformed"
                out = _composed(summary, tools, "deterministic_fallback", reason)
    _log(trial_id, out, started)
    return out


def _toolbox(db: Session, session: SessionRow, trial_id: str) -> ToolBox:
    return ToolBox(_trial_out(db, owned_trial(db, session, trial_id)), utcnow())


def _composed(c: Composed, tools: ToolBox, mode: str, reason: str | None) -> s.AssistantReplyOut:
    v = tools.verdict
    return s.AssistantReplyOut(
        mode=mode,  # type: ignore[arg-type]
        fallback_reason=reason,  # type: ignore[arg-type]
        verdict=s.AssistantVerdictOut(code=v.code, next_step=v.next_step, early=v.early, statement=v.statement),
        reply=c.reply,
        action=s.AssistantActionOut(code=c.action.action, available=c.action.available) if c.action else None,
        trace=_trace(c.trace),
        sources=c.sources,
    )


def _explained(summary: Composed, tools: ToolBox, mode: str, ids: list[str], step: str) -> s.AssistantReplyOut:
    """The plan's answer plus the approved text for validated IDs. Raises SelectionError for anything else."""
    shown = render(ids, tools.trial, tools.verdict)
    out = _composed(summary, tools, mode, None)
    return out.model_copy(
        update={
            "explanations": [s.AssistantExplanationOut(id=e.id, title=e.title, text=e.text) for e in shown],
            "trace": out.trace + _trace([TraceStep(step, {"ids": ",".join(ids)}, True)]),
            "sources": out.sources + [f"explanation:{i}" for i in ids],
        }
    )


def _trace(steps: list[TraceStep]) -> list[s.AssistantTraceOut]:
    return [s.AssistantTraceOut(tool=t.tool, args={k: str(v) for k, v in t.args.items()}, ok=t.ok) for t in steps]


def _log(trial_id: str, out: s.AssistantReplyOut, started: float) -> None:
    log.info(
        "assistant_turn",
        extra={
            "trial_id": trial_id,
            "mode": out.mode,
            "tools": [t.tool for t in out.trace],
            "fallback_reason": out.fallback_reason,
            "explanations": [e.id for e in out.explanations],
            "latency_ms": round((time.monotonic() - started) * 1000),
        },
    )
