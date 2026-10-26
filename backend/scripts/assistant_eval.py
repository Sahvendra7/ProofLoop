"""Evaluate the assistant's explanation selection, offline or against the real model.

    cd backend && ./venv/bin/python scripts/assistant_eval.py                  # offline: integrity + routing
    cd backend && ./venv/bin/python scripts/assistant_eval.py --live --out FILE [--states a,b] [--pace 4]

Offline replays tests/assistant_eval/corpus.json (v2): the protocol cases and every
v1 free-text case against the real selection code (content integrity), and the
fixed-rule routes (exact). It needs no network.

Live asks every model-routed corpus question about synthetic sample trials in the
chosen states, sends it to the configured Gemini model, and scores the selected
topics against the corpus labels: correct, partial, incorrect, fallback (invalid
output) or API failure, with latency. It needs GEMINI_FREE_TEXT_ENABLED and
GEMINI_API_KEY in backend/.env, uses the free tier, and forces YouCam off. Model
output is only ever a list of IDs; the terminal shows counts, --out holds per-turn
rows. The key is never printed.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import tempfile
import time
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path

import anyio
import httpx
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api.schemas import TrialOut  # noqa: E402
from app.core.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.services.assistant.explanations import EXPLANATION_IDS, eligible_ids  # noqa: E402
from app.services.assistant.gemini import GeminiFailure, select_explanations  # noqa: E402
from app.services.assistant.route import route_decision, route_question  # noqa: E402
from app.services.assistant.verdict import canonical_verdict  # noqa: E402
from tests.assistant_eval.replay import (  # noqa: E402
    FORMS,
    legacy_response,
    legacy_texts,
    load_corpus,
    load_holdout,
    protocol_transport,
    run_protocol,
    score,
    score_holdout,
)
from tests.assistant_fixtures import make_state  # noqa: E402

V1 = "/api/v1"
ELIGIBLE_AFTER_RESULT = [i for i in EXPLANATION_IDS if i not in ("insufficient_data", "early_checkin")]


def sample_trials(db: str) -> tuple[dict, dict]:
    """A fresh and a checked-in sample trial, from a throwaway database with YouCam impossible."""
    settings = Settings(DATABASE_URL=f"sqlite:///{db}", YOUCAM_API_KEY="", LOG_LEVEL="WARNING")
    assert not settings.provider_configured
    with TestClient(create_app(settings=settings, provider_factory=lambda: None)) as client:
        h = {"X-Session-Token": client.post(f"{V1}/sessions").json()["token"]}

        def trial() -> dict:
            scan = client.post(f"{V1}/scans/demo", headers=h).json()
            body = {"scan_id": scan["id"], "goal": "hydration", "product_id": "thale-water-reserve"}
            return client.post(f"{V1}/trials", headers=h, json=body).json()

        fresh = trial()
        done = client.post(f"{V1}/trials/{trial()['id']}/demo-checkin", headers=h).json()
        assert client.get(f"{V1}/system/status").json()["budget"]["committed"] == 0
    return fresh, done


async def offline() -> bool:
    settings = Settings(
        GEMINI_FREE_TEXT_ENABLED=True, GEMINI_API_KEY="offline", GEMINI_API_URL="https://gemini.invalid"
    )
    corpus = load_corpus()
    by_cat: dict[str, Counter] = {}
    bad = []
    for case in corpus["protocol"]:
        r = await run_protocol(case, ELIGIBLE_AFTER_RESULT, settings)
        by_cat.setdefault(case["category"], Counter())[f"{r.expect}{'' if r.ok else ' CHANGED'}"] += 1
        if not r.ok:
            bad.append(f"protocol {case['id']}: expected {r.expect}, got {r.got}")
    rendered = 0
    for form in FORMS:
        for case_id, text in legacy_texts():
            transport = protocol_transport(
                {"response": legacy_response(text, form)["candidates"][0]["content"]["parts"][0]}
            )
            try:
                async with transport as http:
                    await select_explanations("x", ELIGIBLE_AFTER_RESULT, settings, http)
                rendered += 1
                bad.append(f"legacy {case_id} ({form}) was accepted")
            except GeminiFailure:
                pass
    routes = Counter()
    for q in corpus["questions"]:
        got = route_question(q["question"])
        ok = got == (q["route_ids"] if q["route"] == "rules" else None)
        routes[f"{q['route']}{'' if ok else ' CHANGED'}"] += 1
        if not ok:
            bad.append(f"route {q['id']}: got {got}")
    print("Content integrity (model output -> what may render)")
    for cat, counts in sorted(by_cat.items()):
        print(f"  {cat:22} " + ", ".join(f"{k} {v}" for k, v in sorted(counts.items())))
    total = len(FORMS) * len(legacy_texts())
    print(f"  v1 free-text cases x {len(FORMS)} forms: {total - rendered}/{total} rejected, {rendered} rendered")
    print(f"Routing: {dict(routes)}")
    for line in bad:
        print("  " + line)
    return not bad


async def live(
    fresh: dict, done: dict, questions: list[dict], states: list[str], pace: float, holdout: bool, out: Path
):
    """The full pipeline per question: fixed rules first, Gemini only when no rule matches (as the endpoint does).

    Failures are classified, not scored: invalid_reply (output failed validation), timeout, rate_limited (HTTP 429),
    overloaded (HTTP 5xx) or provider_error (anything else). The run stops at the first rate limit or at two
    overloads/timeouts in a row, so a quota problem never burns through the set. Each row is written as it completes.
    """
    settings = Settings()
    if not settings.free_text_available:
        raise SystemExit("Set GEMINI_API_KEY and GEMINI_FREE_TEXT_ENABLED=true in backend/.env first.")
    grade = score_holdout if holdout else score
    statuses: list[int] = []

    async def record(response: httpx.Response) -> None:
        statuses.append(response.status_code)

    rows: list[dict] = []
    streak = 0
    with out.open("w") as fh:
        async with httpx.AsyncClient(event_hooks={"response": [record]}) as http:
            for state in states:
                trial = TrialOut.model_validate(make_state(fresh, done, state))
                eligible = eligible_ids(trial, canonical_verdict(trial, datetime.now(UTC)))
                for q in questions:
                    row = {"state": state, "id": q["id"], "category": q["category"]}
                    started = time.monotonic()
                    decision = route_decision(q["question"], eligible)
                    if decision is not None:
                        row |= {"route": "rules", "ids": decision, "result": grade(decision, q, eligible)}
                    else:
                        row["route"] = "gemini"
                        before = len(statuses)
                        try:
                            ids = await select_explanations(q["question"], eligible, settings, http)
                            row |= {"ids": ids, "result": grade(ids, q, eligible)}
                        except GeminiFailure as failure:
                            code = statuses[-1] if len(statuses) > before else None
                            row["result"] = (
                                "invalid_reply"
                                if failure.reason == "malformed"
                                else "timeout"
                                if failure.reason == "timeout"
                                else "rate_limited"
                                if code == 429
                                else "overloaded"
                                if code and code >= 500
                                else "provider_error"
                            )
                        row["http"] = statuses[before:]
                    row["latency_ms"] = round((time.monotonic() - started) * 1000)
                    rows.append(row)
                    fh.write(json.dumps(row) + "\n")
                    fh.flush()
                    print(
                        f"  {state:16} {q['id']:22} {row['route']:6} {row['result']:13} {','.join(row.get('ids', []))}"
                    )
                    if row["result"] == "rate_limited":
                        print("STOP: rate limit (429). Not retrying.")
                        return rows
                    streak = streak + 1 if row["result"] in ("overloaded", "timeout") else 0
                    if streak >= 2:
                        print("STOP: two overloads/timeouts in a row. Not retrying.")
                        return rows
                    if row["route"] == "gemini":
                        await anyio.sleep(pace)
    return rows


def summarise(rows: list[dict]) -> None:
    for route in ("rules", "gemini"):
        part = [r for r in rows if r["route"] == route]
        if not part:
            continue
        print(f"\n{route}: {len(part)} answers: {dict(Counter(r['result'] for r in part))}")
        if route == "gemini":
            lat = sorted(r["latency_ms"] for r in part if "ids" in r)
            if lat:
                print(
                    f"  latency ms (request only, excludes pacing): median {statistics.median(lat):.0f}, "
                    f"p90 {lat[int(0.9 * (len(lat) - 1))]}, max {lat[-1]}"
                )
    print("\nby category:")
    for cat in dict.fromkeys(r["category"] for r in rows):
        print(f"  {cat:26} {dict(Counter(r['result'] for r in rows if r['category'] == cat))}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true")
    ap.add_argument(
        "--holdout", action="store_true", help="live: run the frozen holdout_v1 instead of the regression set"
    )
    ap.add_argument("--set", type=Path, help="live: a holdout-format file (dev_v4.json, holdout_v2.json, ...)")
    ap.add_argument("--category", help="live: only regression questions in this category")
    ap.add_argument("--out", type=Path)
    ap.add_argument("--states", help="comma-separated trial states (default: the corpus's own)")
    ap.add_argument("--pace", type=float, default=4.0, help="seconds between Gemini requests (free-tier limits)")
    args = ap.parse_args()
    if not args.live:
        return 0 if anyio.run(offline) else 1
    if not args.out:
        raise SystemExit("--live writes per-turn rows to a file: pass --out FILE.")
    if args.holdout or args.set:
        corpus = json.loads(args.set.read_text()) if args.set else load_holdout()
        questions, states = corpus["questions"], corpus["states"]
    else:
        questions = [q for q in load_corpus()["questions"] if not args.category or q["category"] == args.category]
        states = ["improvement_early", "inside_band_full", "no_checkin"]
    states = args.states.split(",") if args.states else states
    with tempfile.TemporaryDirectory() as tmp:
        fresh, done = sample_trials(str(Path(tmp) / "eval.db"))
    rows = anyio.run(live, fresh, done, questions, states, args.pace, bool(args.holdout or args.set), args.out)
    summarise(rows)
    print(f"model {Settings().gemini_model}; {len(rows)} rows written to {args.out} (one JSON object per line)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
