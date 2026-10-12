"""Provider failures normalised into stable codes the rest of the app understands."""

from __future__ import annotations

import re
from enum import Enum


class ProviderErrorCode(str, Enum):
    not_configured = "provider_not_configured"
    auth = "provider_auth_failed"
    credits = "provider_out_of_units"
    rate_limited = "provider_rate_limited"
    unavailable = "provider_unavailable"
    timeout = "provider_timeout"
    malformed = "provider_malformed_response"
    rejected = "provider_rejected"
    face_too_small = "face_too_small"
    face_out_of_frame = "face_out_of_frame"
    too_dark = "too_dark"
    image_too_small = "image_too_small"
    image_too_large = "image_too_large"
    upload_failed = "provider_upload_failed"


# Task-level error codes documented for skin analysis / simulation.
_TASK_ERROR_MAP = {
    "error_src_face_too_small": ProviderErrorCode.face_too_small,
    "error_src_face_out_of_bound": ProviderErrorCode.face_out_of_frame,
    "error_lighting_dark": ProviderErrorCode.too_dark,
    "error_below_min_image_size": ProviderErrorCode.image_too_small,
    "error_exceed_max_image_size": ProviderErrorCode.image_too_large,
}

USER_GUIDANCE = {
    ProviderErrorCode.face_too_small: "Move closer so your face fills most of the frame (about two-thirds of its width).",
    ProviderErrorCode.face_out_of_frame: "Keep your whole face, including forehead and chin, inside the frame.",
    ProviderErrorCode.too_dark: "Find even, brighter light — facing a window works well — and try again.",
    ProviderErrorCode.image_too_small: "Use a larger photo; the shorter side must be at least 480 pixels.",
    ProviderErrorCode.image_too_large: "Use a smaller photo.",
    ProviderErrorCode.timeout: "The analysis took longer than expected. No result was saved; you can try again.",
    ProviderErrorCode.unavailable: "The analysis service is unavailable right now. Try again in a moment.",
    ProviderErrorCode.rate_limited: "The analysis service is busy. Wait a moment and try again.",
    ProviderErrorCode.credits: "This deployment has used its analysis allowance. Sample data is still available.",
    ProviderErrorCode.auth: "The analysis service rejected this deployment's credentials.",
    ProviderErrorCode.not_configured: "Live analysis isn't configured on this server. You can explore with sample data.",
    ProviderErrorCode.malformed: "The analysis returned data we couldn't read safely, so nothing was saved.",
    ProviderErrorCode.rejected: "The analysis couldn't process this photo. Try a clear, front-facing photo in even light.",
    ProviderErrorCode.upload_failed: "Uploading the photo for analysis failed. Try again.",
}

_TUPLE = re.compile(r"^\(\s*'(?P<message>.*?)'\s*,\s*'(?P<code>[a-zA-Z0-9_]+)'\s*\)$")


class ProviderError(Exception):
    def __init__(
        self,
        code: ProviderErrorCode,
        detail: str = "",
        *,
        provider_code: str | None = None,
        http_status: int | None = None,
        billed: bool = False,
    ):
        super().__init__(f"{code.value}: {detail}" if detail else code.value)
        self.code = code
        self.detail = detail
        self.provider_code = provider_code
        self.http_status = http_status
        self.billed = billed  # documented: failed tasks consume no units

    @property
    def guidance(self) -> str:
        return USER_GUIDANCE.get(self.code, USER_GUIDANCE[ProviderErrorCode.rejected])


def parse_task_error(raw: object) -> tuple[str, str]:
    """Task errors arrive as a stringified tuple: "('message', 'error_code')".

    Returns (provider_code, message). Plain strings are accepted too.
    """
    text = str(raw or "").strip()
    match = _TUPLE.match(text)
    if match:
        return match.group("code"), match.group("message")
    if re.fullmatch(r"[a-z0-9_]+", text):
        return text, text
    return "unknown_error", text[:200]


def from_task_error(raw: object, message_field: str | None = None) -> ProviderError:
    provider_code, message = parse_task_error(raw)
    if message_field:
        message = message_field[:300]
    code = _TASK_ERROR_MAP.get(provider_code, ProviderErrorCode.rejected)
    return ProviderError(code, message, provider_code=provider_code)


def from_http_status(status: int, body_text: str) -> ProviderError:
    if status == 401 or status == 403:
        return ProviderError(ProviderErrorCode.auth, "authentication rejected", http_status=status)
    if status == 429:
        return ProviderError(ProviderErrorCode.rate_limited, "rate limited", http_status=status)
    if status == 400 and "CreditInsufficiency" in body_text:
        return ProviderError(ProviderErrorCode.credits, "insufficient units", http_status=status)
    if status >= 500:
        return ProviderError(ProviderErrorCode.unavailable, f"HTTP {status}", http_status=status)
    return ProviderError(ProviderErrorCode.rejected, f"HTTP {status}: {body_text[:200]}", http_status=status)
