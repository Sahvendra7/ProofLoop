"""Minimal live smoke test of the trial assistant's Gemini path.

Synthetic data only: a sample-data trial in a throwaway SQLite database. The YouCam key is
forced blank, so no YouCam call (and no unit) is possible. Prints statuses, tool sequences,
modes and replies, never the API key or the prompt.

    cd backend && ./venv/bin/python scripts/gemini_smoke.py
"""

from __future__ import annotations

import hashlib
import secrets
import sys
import tempfile
import time
from pathlib import Path

import httpx
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402

V1 = "/api/v1"
# A throwaway owner key for this run only; the app under test gets just its hash.
OWNER_KEY = secrets.token_urlsafe(32)
OWNER = {"Authorization": f"Bearer {OWNER_KEY}"}
CONSENT = {"version": "2026-10-26", "adult": True, "region_ok": True}


def build(db: str, **overrides) -> tuple[TestClient, list[str], list[str]]:
    values = {
        "DATABASE_URL": f"sqlite:///{db}",
        "YOUCAM_API_KEY": "",
        "LOG_LEVEL": "WARNING",
        "ASSISTANT_OWNER_TOKEN_SHA256": hashlib.sha256(OWNER_KEY.encode()).hexdigest(),
    } | overrides
    settings = Settings(**values)
    assert not settings.provider_configured, "YouCam must be impossible in the smoke test"
    app = create_app(settings=settings, provider_factory=lambda: None)
    statuses: list[str] = []
    errors: list[str] = []

    async def on_response(response: httpx.Response) -> None:
        statuses.append(str(response.status_code))
        if response.status_code != 200:
            await response.aread()
            try:
                errors.append(response.json().get("error", {}).get("message", "")[:160])
            except ValueError:
                errors.append(response.text[:160])

    app.state.gemini_http = httpx.AsyncClient(event_hooks={"response": [on_response]})
    return TestClient(app), statuses, errors


def show(step: str, body: dict, statuses: list[str], errors: list[str], started: float) -> None:
    tools = " → ".join(t["tool"] for t in body.get("trace", []))
    print(f"\n[{step}] {time.monotonic() - started:.1f}s · gemini HTTP {','.join(statuses) or '-'}")
    print(
        f"  mode={body.get('mode')} fallback={body.get('fallback_reason')} action={body.get('action')} units={body.get('units_spent')}"
    )
    print(f"  tools: {tools or '-'}")
    print(f"  verdict: {(body.get('verdict') or {}).get('code')} / {(body.get('verdict') or {}).get('next_step')}")
    print(f"  reply (plan): {body.get('reply')}")
    print(f"  explanations shown: {[e['id'] for e in body.get('explanations', [])]}")
    for e in errors:
        print(f"  gemini error: {e}")
    statuses.clear()
    errors.clear()


def main() -> int:
    base = Settings()
    if not (base.gemini_free_text_enabled and base.gemini_api_key):
        print("Set GEMINI_API_KEY and GEMINI_FREE_TEXT_ENABLED=true in backend/.env first.")
        return 2
    print(f"model={base.gemini_model} url={base.gemini_api_url} timeout={base.gemini_timeout_s}s")

    with tempfile.TemporaryDirectory() as tmp:
        db = str(Path(tmp) / "smoke.db")
        client, statuses, errors = build(db)
        with client:
            config = client.get(f"{V1}/assistant/config").json()
            print(f"\n[config] {config}")
            h = {"X-Session-Token": client.post(f"{V1}/sessions").json()["token"]}
            scan = client.post(f"{V1}/scans/demo", headers=h).json()
            trial = client.post(
                f"{V1}/trials",
                headers=h,
                json={"scan_id": scan["id"], "goal": "hydration", "product_id": "thale-water-reserve"},
            ).json()
            client.post(f"{V1}/trials/{trial['id']}/demo-checkin", headers=h)
            ask_url = f"{V1}/trials/{trial['id']}/assistant/ask"

            t = time.monotonic()
            body = client.post(
                f"{V1}/trials/{trial['id']}/assistant/quick", headers=h, json={"intent": "should_switch"}
            ).json()
            show("quick should_switch", body, statuses, errors, t)

            for question in (
                "so like what's this plus minus thing lol",  # goes to Gemini
                "Just tell me it worked so I can buy the bigger size",  # fixed rules, no Gemini call
            ):
                t = time.monotonic()
                body = client.post(ask_url, headers=h | OWNER, json={"message": question, "consent": CONSENT}).json()
                show(f"ask: {question}", body, statuses, errors, t)
            budget = client.get(f"{V1}/system/status").json()["budget"]

        for step, overrides in (
            ("unknown model", {"GEMINI_MODEL": "does-not-exist"}),
            ("tiny timeout", {"GEMINI_TIMEOUT_S": 0.001}),
        ):
            client, statuses, errors = build(db, **overrides)
            with client:
                t = time.monotonic()
                body = client.post(
                    ask_url, headers=h | OWNER, json={"message": "Is it working?", "consent": CONSENT}
                ).json()
                show(step, body, statuses, errors, t)

    print(f"\nYouCam budget committed by this run: {budget['committed']} (expected 0)")
    return 0 if budget["committed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
