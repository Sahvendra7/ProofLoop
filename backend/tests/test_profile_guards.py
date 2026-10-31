"""Copy guard: the profile's user-facing wording never makes the claims the research ruled out."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.domain.profile import forbidden_claims

FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "src"
PROFILE_COPY = [
    FRONTEND / "app" / "results" / "skin-profile.tsx",
    FRONTEND / "app" / "trial" / "profile-block.tsx",
]
_STRING = re.compile(r'"((?:[^"\\\n]|\\.){12,})"|>([^<>{}\n]{12,})<')


def _strings(text: str) -> list[str]:
    return [a or b for a, b in _STRING.findall(text)]


def _format_profile_section() -> str:
    text = (FRONTEND / "lib" / "format.ts").read_text()
    return text[text.index("// --- Checked skin profile") :]


@pytest.mark.skipif(not FRONTEND.exists(), reason="frontend not checked out")
@pytest.mark.parametrize("source", ["format.ts", *[p.name for p in PROFILE_COPY]])
def test_profile_copy_has_no_forbidden_claims(source):
    text = (
        _format_profile_section()
        if source == "format.ts"
        else (FRONTEND / "app" / ("results" if "skin" in source else "trial") / source).read_text()
    )
    strings = _strings(text)
    assert strings, "the guard found no copy to check"
    found = {s: forbidden_claims(s) for s in strings if forbidden_claims(s)}
    assert found == {}


def test_guard_catches_a_bad_line():
    assert _strings('const x = "This serum suits your skin type perfectly";')
    assert forbidden_claims("This serum suits your skin type perfectly")
