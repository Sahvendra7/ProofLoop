"""Turn provider outputs into ProofLoop metric readings without inventing values.

A metric that was requested but not returned (or returned out of range) is
reported as missing. It is never coerced to 0.
"""

from __future__ import annotations

import math
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field

from app.domain.metrics import METRICS_BY_PROVIDER_TYPE


@dataclass(frozen=True)
class Reading:
    metric: str
    ui_score: int
    raw_score: float | None
    mask_url: str | None


@dataclass
class Normalized:
    readings: list[Reading] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    ignored_types: list[str] = field(default_factory=list)


class _Output:
    """Structural type: anything with type / ui_score / raw_score / mask_urls."""

    type: str
    ui_score: float | None
    raw_score: float | None
    mask_urls: list[str]


def _valid_score(value: float | None) -> bool:
    return value is not None and isinstance(value, int | float) and math.isfinite(value) and 0 <= value <= 100


def normalize_outputs(outputs: Iterable[_Output], requested_provider_types: Sequence[str]) -> Normalized:
    result = Normalized()
    seen: set[str] = set()
    for out in outputs:
        metric = METRICS_BY_PROVIDER_TYPE.get(out.type)
        if metric is None:
            # e.g. "all", "skin_age", "resize_image": not part of ProofLoop's measured set.
            result.ignored_types.append(out.type)
            continue
        if metric.key in seen or not _valid_score(out.ui_score):
            continue
        seen.add(metric.key)
        raw = out.raw_score if _valid_score(out.raw_score) else None
        mask = next((u for u in (out.mask_urls or []) if isinstance(u, str) and u.startswith("https://")), None)
        result.readings.append(Reading(metric.key, int(round(out.ui_score)), raw, mask))
    for provider_type in requested_provider_types:
        metric = METRICS_BY_PROVIDER_TYPE.get(provider_type)
        if metric and metric.key not in seen:
            result.missing.append(metric.key)
    return result
