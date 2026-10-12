"""Opt-in live verification of ProofLoop's YouCam client. SPENDS API UNITS.

Runs the production client (app/providers/youcam/client.py) against the live
API and records sanitised evidence:

  1. credit balance before/after (measures real unit cost)
  2. skin analysis on framing/lighting variants of one face (repeatability)
  3. one deliberately under-framed photo (verifies the documented error path)
  4. optionally one skin simulation (--simulate)

Usage (from backend/):
  YOUCAM_LIVE=1 ./venv/bin/python -m scripts.youcam_live_probe --image ../test-face.jpg \
      --face-box 220,330,530,640 [--simulate]

--face-box is x0,y0,x1,y1 of the face in the source image, used to build crops
whose face width is a known fraction of the frame. Output JSON (scores only,
URLs redacted, no image data) goes to tests/fixtures/youcam/ and docs evidence.
"""

from __future__ import annotations

import argparse
import asyncio
import io
import json
import os
import re
import sys
from datetime import UTC, datetime
from pathlib import Path

import httpx
from PIL import Image, ImageEnhance

from app.core.config import get_settings
from app.domain.metrics import REQUESTED_PROVIDER_ACTIONS
from app.domain.normalize import normalize_outputs
from app.providers.youcam.client import PollPolicy, YouCamClient
from app.providers.youcam.errors import ProviderError
from app.services.imaging import prepare_image

FIXTURES = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "youcam"
URL_RE = re.compile(r"https://[^\"'\s]+")


def redact(obj):
    if isinstance(obj, str):
        if obj.startswith("http"):
            tail = re.sub(r"\?.*$", "", obj).rsplit("/", 1)[-1]
            tail = re.sub(r"^[0-9a-f-]{20,}_", "", tail)
            return f"https://example.invalid/redacted/{tail}"
        return obj
    if isinstance(obj, list):
        return [redact(x) for x in obj]
    if isinstance(obj, dict):
        return {k: redact(v) for k, v in obj.items()}
    return obj


def crop_variant(
    src: Image.Image,
    face: tuple[int, int, int, int],
    face_fraction: float,
    brightness: float = 1.0,
    shift: tuple[float, float] = (0.0, 0.0),
) -> bytes:
    """shift moves the crop centre by a fraction of the face width (x, y)."""
    x0, y0, x1, y1 = face
    face_w = x1 - x0
    cx, cy = (x0 + x1) / 2 + shift[0] * face_w, (y0 + y1) / 2 + shift[1] * face_w
    frame_w = face_w / face_fraction
    frame_h = frame_w * 4 / 3
    left = max(0, int(cx - frame_w / 2))
    top = max(0, int(cy - frame_h * 0.45))
    right = min(src.width, int(left + frame_w))
    bottom = min(src.height, int(top + frame_h))
    img = src.crop((left, top, right, bottom))
    scale = max(1.0, 720 / min(img.size))
    if scale > 1:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.Resampling.LANCZOS)
    if brightness != 1.0:
        img = ImageEnhance.Brightness(img).enhance(brightness)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=93)
    return buf.getvalue()


async def main() -> int:
    if os.environ.get("YOUCAM_LIVE") != "1":
        print("Refusing to spend units: set YOUCAM_LIVE=1 to run.", file=sys.stderr)
        return 2
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--face-box", required=True)
    parser.add_argument("--simulate", action="store_true")
    parser.add_argument("--skip-analysis", action="store_true")
    parser.add_argument(
        "--repeatability",
        action="store_true",
        help="run only the extended framing variants (4 analyses, 48 units)",
    )
    args = parser.parse_args()

    settings = get_settings()
    if not settings.provider_configured:
        print("YOUCAM_API_KEY is not configured.", file=sys.stderr)
        return 2

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

    http = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0), event_hooks={"response": [hook]})
    client = YouCamClient(
        api_key=settings.youcam_api_key.get_secret_value(),
        base_url=settings.youcam_api_url,
        file_path_template=settings.youcam_file_path,
        http=http,
        poll=PollPolicy(initial_s=2.0, max_s=5.0, timeout_s=120.0),
    )
    src = Image.open(args.image).convert("RGB")
    face = tuple(int(v) for v in args.face_box.split(","))
    report: dict = {
        "run_at": datetime.now(UTC).isoformat(),
        "file_path_template": settings.youcam_file_path,
        "runs": [],
    }

    before = await client.credit_balance()
    report["credit_before"] = before
    print(f"credit before: {before}")

    variants = [
        ("A_face75", crop_variant(src, face, 0.75)),
        ("A_face75_repeat", crop_variant(src, face, 0.75)),
        ("B_face65", crop_variant(src, face, 0.65)),
        ("C_face75_darker", crop_variant(src, face, 0.75, brightness=0.82)),
    ]
    under_framed = io.BytesIO()
    src.save(under_framed, format="JPEG", quality=93)
    variants.append(("E_uncropped_face_too_small", under_framed.getvalue()))
    if args.repeatability:
        report["mode"] = "repeatability"
        variants = [
            ("F_face70", crop_variant(src, face, 0.70)),
            ("G_face80", crop_variant(src, face, 0.80)),
            ("H_face75_shift_left", crop_variant(src, face, 0.75, shift=(-0.08, 0.0))),
            ("I_face75_shift_up", crop_variant(src, face, 0.75, shift=(0.0, -0.08))),
        ]

    if not args.skip_analysis:
        for name, raw in variants:
            prepared = prepare_image(raw)
            stages: list[str] = []

            async def on_stage(stage: str, _s=stages) -> None:
                _s.append(stage)

            entry: dict = {
                "variant": name,
                "width": prepared.width,
                "height": prepared.height,
                "luminance_mean": prepared.luminance_mean,
            }
            captured.clear()
            try:
                result = await client.analyze_skin(
                    prepared.data, prepared.content_type, REQUESTED_PROVIDER_ACTIONS, on_stage
                )
                norm = normalize_outputs(result.outputs, result.requested_actions)
                entry.update(
                    status="success",
                    duration_s=result.duration_s,
                    stages=stages,
                    scores={r.metric: r.ui_score for r in norm.readings},
                    raw_scores={r.metric: r.raw_score for r in norm.readings},
                    missing=norm.missing,
                    ignored_types=norm.ignored_types,
                    masks_returned=sum(1 for r in norm.readings if r.mask_url),
                )
                if name == "A_face75" and captured:
                    (FIXTURES / "analysis-success-live.json").write_text(json.dumps(redact(captured[-1]), indent=2))
            except ProviderError as exc:
                entry.update(
                    status="error",
                    code=exc.code.value,
                    provider_code=exc.provider_code,
                    detail=exc.detail,
                    stages=stages,
                )
                if captured:
                    (FIXTURES / f"analysis-error-{exc.provider_code or 'unknown'}-live.json").write_text(
                        json.dumps(redact(captured[-1]), indent=2)
                    )
            print(json.dumps(entry))
            report["runs"].append(entry)

    if args.simulate:
        prepared = prepare_image(crop_variant(src, face, 0.75))
        captured.clear()
        try:
            sim = await client.simulate_skin(prepared.data, prepared.content_type, {"redness": 0.4, "texture": 0.4})
            report["simulation"] = {
                "status": "success",
                "duration_s": sim.duration_s,
                "intensities": sim.intensities,
                "url_host": httpx.URL(sim.image_url).host,
            }
            if captured:
                (FIXTURES / "simulation-success-live.json").write_text(json.dumps(redact(captured[-1]), indent=2))
        except ProviderError as exc:
            report["simulation"] = {
                "status": "error",
                "code": exc.code.value,
                "provider_code": exc.provider_code,
                "detail": exc.detail,
                "http_status": exc.http_status,
            }
            if captured:
                (FIXTURES / "simulation-error-live.json").write_text(json.dumps(redact(captured[-1]), indent=2))
        print(json.dumps(report["simulation"]))

    after = await client.credit_balance()
    report["credit_after"] = after
    report["units_spent"] = before - after
    print(f"credit after: {after}  spent: {before - after}")
    out = FIXTURES / f"probe-report-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}.json"
    out.write_text(json.dumps(redact(report), indent=2))
    print(f"report: {out}")
    await http.aclose()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
