"""Every YouCam path, request body and price, in one file.

Sources (fetched 2026-10-12):
  docs.perfectcorp.com/reference/ai_skin_analysis.md               (v2.0 walkthrough)
  .../ai_skin_analysis/v2.0/paths/~1s2s~1v2.0~1task~1skin-analysis/post.md
  .../ai_skin_simulation/v1.0/paths/~1s2s~1v2.0~1task~1skin-simulation/post.md

  file      POST {file_path}                          -> data.files[0].{file_id, requests[0].{url, headers}}
            PUT  <presigned url> with returned headers
  analysis  POST /s2s/v2.0/task/skin-analysis         {src_file_id, dst_actions, format:"json"} -> data.task_id
            GET  /s2s/v2.0/task/skin-analysis/{id}    -> data.task_status running|success|error
  simulate  POST /s2s/v2.0/task/skin-simulation       {src_file_id, <concern>: 0.0-1.0, ...}   -> data.task_id
            GET  /s2s/v2.0/task/skin-simulation/{id}
  credit    GET  /s2s/v1.0/client/credit              -> results[].amount

If YouCam changes a shape, this file and models.py are the only places to edit.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from urllib.parse import quote

SKIN_ANALYSIS_FEATURE = "skin-analysis"
SKIN_SIMULATION_FEATURE = "skin-simulation"

ANALYSIS_TASK_PATH = "/s2s/v2.0/task/skin-analysis"
SIMULATION_TASK_PATH = "/s2s/v2.0/task/skin-simulation"
CREDIT_PATH = "/s2s/v1.0/client/credit"

# Documented SD price table for skin analysis (units per task, by concern count). `skin_type` counts as a
# concern: 8 actions cost 12 and 8 + skin_type cost 14, measured by the paired gate on 2026-10-26
# (tests/fixtures/youcam/skin-type-gate-report-20261026T094239Z.json).
_ANALYSIS_SD_UNITS = ((4, 9), (8, 12), (12, 14), (16, 16))
# Documented price table for skin simulation.
_SIMULATION_UNITS = ((4, 4), (10, 6))

# Concerns the Skin Simulation API accepts as top-level body fields.
SIMULATION_CONCERNS = frozenset(
    {"wrinkle", "radiance", "oiliness", "acne", "eye_bags", "dark_circle", "spots", "pores", "texture", "redness"}
)


def file_path(template: str, feature: str) -> str:
    return template.format(feature=feature)


def file_body(file_name: str, size: int, content_type: str) -> dict:
    return {"files": [{"content_type": content_type, "file_name": file_name, "file_size": size}]}


def analysis_body(file_id: str, actions: Sequence[str]) -> dict:
    return {"src_file_id": file_id, "dst_actions": list(actions), "format": "json"}


def simulation_body(file_id: str, intensities: Mapping[str, float]) -> dict:
    unknown = set(intensities) - SIMULATION_CONCERNS
    if unknown:
        raise ValueError(f"unsupported simulation concerns: {sorted(unknown)}")
    if not any(v > 0 for v in intensities.values()):
        raise ValueError("at least one simulation intensity must be above 0")
    body: dict = {"src_file_id": file_id}
    body.update({k: round(max(0.0, min(1.0, float(v))), 2) for k, v in intensities.items()})
    return body


def poll_path(task_path: str, task_id: str) -> str:
    return f"{task_path}/{quote(task_id, safe='')}"


def analysis_units(concern_count: int) -> int:
    for ceiling, units in _ANALYSIS_SD_UNITS:
        if concern_count <= ceiling:
            return units
    raise ValueError("at most 16 SD concerns per task")


def simulation_units(concern_count: int) -> int:
    for ceiling, units in _SIMULATION_UNITS:
        if concern_count <= ceiling:
            return units
    raise ValueError("at most 10 simulation concerns per task")
