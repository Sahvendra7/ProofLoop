"""Paired cost gate for adding `skin_type` to the analysis request. SPENDS UP TO 26 UNITS. Opt-in.

Two analyses of the *same* prepared bytes through the production client:
  A  the 8 actions ProofLoop requests today          (documented 5-8 tier: 12 units)
  B  the same 8 + `skin_type`                         (12 if untiered, 14 if it counts as a concern)

It measures what each call cost (credit balance read before and after, both free),
whether the 8 shared scores are identical, and what `skin_type` returns. Spending
goes through the backend's own ledger (services/usage.reserve/settle) on an isolated
in-memory database whose budget is the gate cap, so no call is made unless its
worst-case price still fits. A task error is retried once only if the balance shows
it was not billed; a timeout after task creation may have been billed, so the gate
stops. Nothing here touches the deployment's database.

Usage (from backend/; the face box is the face in the source image):
  YOUCAM_LIVE=1 ./venv/bin/python -m scripts.skin_type_gate --image ../test-face.jpg \
      --face-box 220,330,530,640 --face-fraction 0.72
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import sys
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from pathlib import Path

import httpx
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.db.models import Base, ProviderCallRow, SessionRow
from app.domain.metrics import METRICS_BY_PROVIDER_TYPE, REQUESTED_PROVIDER_ACTIONS
from app.providers.youcam import endpoints as ep
from app.providers.youcam.client import PollPolicy, YouCamClient
from app.providers.youcam.errors import ProviderError, ProviderErrorCode
from app.services import usage
from app.services.imaging import prepare_image
from scripts.youcam_live_probe import crop_variant, redact

GATE_CAP_UNITS = 26
BASELINE_ACTIONS = tuple(REQUESTED_PROVIDER_ACTIONS)
WITH_SKIN_TYPE = (*BASELINE_ACTIONS, "skin_type")
DOCUMENTED_LABELS = frozenset(
    {"Normal", "Oily", "Dry", "Combination", "Redness", "Dry & Redness", "Oily & Redness", "Combination & Redness"}
)
REGIONS = ("whole", "t_zone", "u_zone")
MAX_ATTEMPTS_PER_ARM = 2
SETTLE_READS = 6  # the balance may lag a finished task by a few seconds
SETTLE_WAIT_S = 3.0
# Errors YouCam documents as unbilled: a task that ended in `error` (it carries a provider code), or a
# request that never created a task. Anything else (e.g. a malformed success) may be billed late.
_UNBILLED = frozenset({ProviderErrorCode.upload_failed, ProviderErrorCode.rate_limited})
FIXTURES = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "youcam"

Sleep = Callable[[float], Awaitable[None]]


class _Stop(Exception):
    def __init__(self, reason: str, arm: dict | None = None):
        super().__init__(reason)
        self.reason = reason
        self.arm = arm  # the arm in progress, so its spend is still reported


def _ledger() -> tuple[Session, Settings]:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    db = Session(engine)
    db.add(SessionRow(id="skin-type-gate", token_hash="0" * 64))
    db.flush()
    return db, Settings(_env_file=None, PROVIDER_UNIT_BUDGET=GATE_CAP_UNITS)


async def _balance_after(client: YouCamClient, before: float, sleep: Sleep, *, expect_change: bool) -> float:
    """Read until the balance moves (after a success) or twice, spaced (after an error)."""
    reads = SETTLE_READS if expect_change else 2
    value = before
    for i in range(reads):
        if i:
            await sleep(SETTLE_WAIT_S)
        value = await client.credit_balance()
        if expect_change and value != before:
            break
    return value


def _units(delta: float) -> float | int:
    return int(round(delta)) if abs(delta - round(delta)) < 1e-9 else round(delta, 3)


async def _arm(
    name: str,
    actions: tuple[str, ...],
    client: YouCamClient,
    image: bytes,
    content_type: str,
    db: Session,
    settings: Settings,
    captured: list[dict],
    sleep: Sleep,
) -> dict:
    arm: dict = {
        "name": name,
        "request": {
            "endpoint": f"POST {ep.ANALYSIS_TASK_PATH}",
            "body": {"src_file_id": "<per attempt>", "dst_actions": list(actions), "format": "json"},
        },
        "units_reserved_worst_case": ep.analysis_units(len(actions)),
        "attempts": [],
        "units_charged": 0,
    }
    for _ in range(MAX_ATTEMPTS_PER_ARM):
        try:
            call = usage.reserve(
                db, settings, session_id="skin-type-gate", kind="skin_analysis", units=arm["units_reserved_worst_case"]
            )
        except AppError as exc:
            raise _Stop("cap_would_be_exceeded", arm) from exc
        before = await client.credit_balance()
        captured.clear()
        try:
            result = await client.analyze_skin(image, content_type, actions)
        except ProviderError as exc:
            after = await _balance_after(client, before, sleep, expect_change=False)
            charged = _units(before - after)
            billed = exc.code is ProviderErrorCode.timeout or charged != 0
            # A timeout keeps the whole reservation counted (it may yet be billed); otherwise the measured charge.
            usage.settle(db, call.id, success=False, error_code=exc.code.value, possibly_billed=billed)
            if exc.code is not ProviderErrorCode.timeout:
                db.get(ProviderCallRow, call.id).units_charged = int(round(charged))
            arm["attempts"].append(
                {
                    "status": "error",
                    "provider_code": exc.provider_code or exc.code.value,
                    "units_charged": charged,
                    "balance_before": before,
                    "balance_after": after,
                }
            )
            arm["units_charged"] += charged
            if exc.code is ProviderErrorCode.timeout:
                raise _Stop("possibly_billed_timeout", arm) from exc
            if charged != 0:
                raise _Stop("error_was_billed", arm) from exc
            if exc.provider_code is None and exc.code not in _UNBILLED:
                raise _Stop("possibly_billed_error", arm) from exc
            continue
        after = await _balance_after(client, before, sleep, expect_change=True)
        charged = _units(before - after)
        usage.settle(db, call.id, success=True, duration_s=result.duration_s)
        db.get(ProviderCallRow, call.id).units_charged = int(round(charged))
        arm["attempts"].append(
            {
                "status": "success",
                "units_charged": charged,
                "duration_s": result.duration_s,
                "balance_before": before,
                "balance_after": after,
            }
        )
        arm["units_charged"] += charged
        arm["outputs"] = captured[-1]["data"]["results"]["output"] if captured else []
        arm["raw_response"] = captured[-1] if captured else None
        if charged <= 0:
            raise _Stop("balance_did_not_move", arm)
        if charged > arm["units_reserved_worst_case"]:
            raise _Stop("charged_more_than_reserved", arm)
        return arm
    raise _Stop(f"{name}_attempts_exhausted", arm)


def _scores(outputs: list[dict]) -> dict[str, tuple]:
    return {o["type"]: (o.get("ui_score"), o.get("raw_score")) for o in outputs if o.get("type") in BASELINE_ACTIONS}


def compare_scores(a: list[dict], b: list[dict]) -> dict:
    sa, sb = _scores(a), _scores(b)
    differences = [
        METRICS_BY_PROVIDER_TYPE[t].key for t in BASELINE_ACTIONS if t not in sa or t not in sb or sa[t] != sb[t]
    ]
    extras = {
        t: [next((o.get("score") for o in arm if o.get("type") == t), None) for arm in (a, b)]
        for t in ("all", "skin_age")
    }
    return {"identical": not differences, "differences": differences, "context_scores_a_b": extras}


def inspect_skin_type(outputs: list[dict]) -> dict:
    entries = [o for o in outputs if o.get("type") == "skin_type"]
    labels = {e.get("region"): e.get("skin_type") for e in entries}
    keys = sorted({k for e in entries for k in e})
    problems = []
    if not entries or sorted(labels) != sorted(REGIONS) or len(entries) != len(REGIONS):
        problems.append("skin_type_missing")
    if any(not isinstance(v, str) or v not in DOCUMENTED_LABELS for v in labels.values()):
        problems.append("skin_type_unrecognised")
    numeric = sorted({k for e in entries for k in ("ui_score", "raw_score", "score") if k in e})
    return {"labels": labels, "entry_keys": keys, "numeric_fields": numeric, "problems": problems}


async def run_gate(client: YouCamClient, image: bytes, content_type: str, sleep: Sleep = asyncio.sleep) -> dict:
    captured: list[dict] = []

    async def hook(response: httpx.Response) -> None:
        if response.request.method == "GET" and "/task/" in response.request.url.path:
            await response.aread()
            try:
                body = response.json()
            except ValueError:
                return
            if body.get("data", {}).get("task_status") in ("success", "error"):
                captured.append(body)

    assert client.http is not None
    hooks = client.http.event_hooks
    hooks["response"] = [*hooks.get("response", []), hook]
    client.http.event_hooks = hooks

    db, settings = _ledger()
    report: dict = {
        "run_at": datetime.now(UTC).isoformat(),
        "cap_units": GATE_CAP_UNITS,
        "image": {"bytes": len(image), "sha256": hashlib.sha256(image).hexdigest(), "content_type": content_type},
        "file_registration": f"POST {client.file_path_template}",
        "arms": [],
        "failures": [],
    }
    report["balance_start"] = await client.credit_balance()
    outcome = None
    try:
        a = await _arm("baseline", BASELINE_ACTIONS, client, image, content_type, db, settings, captured, sleep)
        report["arms"].append(a)
        if a["units_charged"] != ep.analysis_units(len(BASELINE_ACTIONS)):
            raise _Stop("baseline_cost_unexpected")
        b = await _arm("with_skin_type", WITH_SKIN_TYPE, client, image, content_type, db, settings, captured, sleep)
        report["arms"].append(b)
    except _Stop as stop:
        report["failures"].append(stop.reason)
        outcome = "stopped"
        if stop.arm is not None and stop.arm not in report["arms"]:
            report["arms"].append(stop.arm)
    except Exception as exc:  # never spend again after something unexplained; still report what happened
        report["failures"].append(f"unexpected_error:{type(exc).__name__}")
        outcome = "stopped"
    report["total_units"] = _units(sum(arm["units_charged"] for arm in report["arms"]))
    report["ledger_units_committed"] = usage.units_committed(db)
    report["balance_end"] = await client.credit_balance()
    report["balance_delta"] = _units(report["balance_start"] - report["balance_end"])
    # Any change in the account balance between our own calls means someone else spent units meanwhile.
    reads = [report["balance_start"]]
    for arm in report["arms"]:
        for attempt in arm["attempts"]:
            reads += [attempt["balance_before"], attempt["balance_after"]]
    reads.append(report["balance_end"])
    report["unexplained_balance_moves"] = [
        {"from": reads[i], "to": reads[i + 1]} for i in range(0, len(reads) - 1, 2) if reads[i] != reads[i + 1]
    ]
    if report["unexplained_balance_moves"] and outcome is None:
        report["failures"].append("balance_moved_between_calls")

    if outcome is None:
        a, b = report["arms"]
        report["skin_type_counts_as_concern"] = b["units_charged"] == ep.analysis_units(len(WITH_SKIN_TYPE))
        if b["units_charged"] not in (12, 14):
            report["failures"].append("skin_type_cost_unexpected")
        report["scores"] = compare_scores(a["outputs"], b["outputs"])
        if not report["scores"]["identical"]:
            report["failures"].append("scores_differ")
        report["skin_type"] = inspect_skin_type(b["outputs"])
        report["failures"].extend(report["skin_type"]["problems"])
        if report["total_units"] > GATE_CAP_UNITS:
            report["failures"].append("over_cap")
        outcome = "A4" if not report["failures"] else "A0"
    report["outcome"] = outcome
    for arm in report["arms"]:
        arm.pop("outputs", None)
    return report


def main(argv: list[str] | None = None) -> int:
    if os.environ.get("YOUCAM_LIVE") != "1":
        print(f"Refusing to spend units: set YOUCAM_LIVE=1 to run (cap {GATE_CAP_UNITS} units).", file=sys.stderr)
        return 2
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--face-box", required=True)
    parser.add_argument("--face-fraction", type=float, default=0.72)
    args = parser.parse_args(argv)

    settings = get_settings()
    if not settings.provider_configured:
        print("YOUCAM_API_KEY is not configured.", file=sys.stderr)
        return 2
    face = tuple(int(v) for v in args.face_box.split(","))
    prepared = prepare_image(crop_variant(Image.open(args.image).convert("RGB"), face, args.face_fraction))

    async def go() -> dict:
        http = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))
        client = YouCamClient(
            api_key=settings.youcam_api_key.get_secret_value(),
            base_url=settings.youcam_api_url,
            file_path_template=settings.youcam_file_path,
            http=http,
            poll=PollPolicy(initial_s=2.0, max_s=5.0, timeout_s=120.0),
        )
        try:
            return await run_gate(client, prepared.data, prepared.content_type)
        finally:
            await http.aclose()

    report = redact(asyncio.run(go()))
    report["image"].update(width=prepared.width, height=prepared.height, luminance_mean=prepared.luminance_mean)
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    raw_b = next((a.get("raw_response") for a in report["arms"] if a["name"] == "with_skin_type"), None)
    if raw_b:
        (FIXTURES / "skin-type-success-live.json").write_text(json.dumps(raw_b, indent=2) + "\n")
    for arm in report["arms"]:
        arm.pop("raw_response", None)
    out = FIXTURES / f"skin-type-gate-report-{stamp}.json"
    out.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({k: report[k] for k in ("outcome", "failures", "total_units", "balance_delta")}))
    print(f"report: {out}")
    return 0 if report["outcome"] == "A4" else 1


if __name__ == "__main__":
    raise SystemExit(main())
