"""Untrusted image in, clean JPEG out.

Every upload is fully decoded by Pillow (rejecting anything that isn't a real
JPEG/PNG/WebP), bounded in size, rotated per EXIF, stripped of all metadata
(including GPS) by re-encoding, and resized to YouCam's limits. Only the
re-encoded bytes ever leave the server. Nothing is written to disk.
"""

from __future__ import annotations

import hashlib
import io
import warnings
from dataclasses import dataclass

from PIL import Image, ImageOps, ImageStat, UnidentifiedImageError

from app.core.errors import AppError

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "MPO"}
MIN_SHORT_SIDE = 480  # YouCam SD minimum
MAX_LONG_SIDE = 2048  # below YouCam's 2560 auto-resize, keeps masks aligned
# Decompression-bomb guard, checked from the header before any pixel is decoded. Decoding costs about
# 12 bytes of peak memory per pixel here (RGB plus the transpose, conversion and luminance copies): about
# 150 MB at 12 MP, 495 MB at 40 MP and 926 MB at 80 MP, measured 2026-10-26, against a 512 MB instance.
# Pillow alone only warns between 1x and 2x its limit, so the old 40 MP setting let images up to 80 MP
# decode. 12 MP still takes a full 4000x3000 phone photo; the in-browser framer never sends more than
# 1080x1440 (1.6 MP).
MAX_PIXELS = 12_000_000
TOO_DARK_LUMINANCE = 28.0  # only reject when obviously unusable; YouCam judges the rest

Image.MAX_IMAGE_PIXELS = MAX_PIXELS


@dataclass(frozen=True)
class PreparedImage:
    data: bytes
    content_type: str
    width: int
    height: int
    luminance_mean: float
    luminance_std: float
    digest: str  # sha256 of the cleaned bytes; stored on the scan (not the image) to spot a reused photo


def _too_many_pixels(width: int | None, height: int | None) -> AppError:
    size = f" ({width}×{height}, {width * height / 1e6:.0f} MP)" if width and height else ""
    return AppError(
        "image_too_large",
        f"That photo has too many pixels to process{size}. The limit is {MAX_PIXELS // 1_000_000} MP.",
        413,
        hint="Use your phone's standard photo mode, or take the photo in ProofLoop, which frames it for you.",
    )


def prepare_image(raw: bytes) -> PreparedImage:
    if not raw:
        raise AppError("empty_upload", "The photo was empty.", 400)
    try:
        with warnings.catch_warnings():
            # Pillow warns between 1x and 2x MAX_IMAGE_PIXELS; the explicit check below refuses those images.
            warnings.simplefilter("ignore", Image.DecompressionBombWarning)
            probe = Image.open(io.BytesIO(raw))
        with probe:
            fmt = probe.format
            if probe.width * probe.height > MAX_PIXELS:
                raise _too_many_pixels(probe.width, probe.height)
            probe.verify()
        if fmt not in ALLOWED_FORMATS:
            raise AppError("unsupported_image", "Use a JPEG, PNG or WebP photo.", 415)
        with Image.open(io.BytesIO(raw)) as img:
            img.load()
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")
    except AppError:
        raise
    except Image.DecompressionBombError as exc:  # Pillow's own backstop, above 2x MAX_PIXELS
        raise _too_many_pixels(None, None) from exc
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise AppError("unreadable_image", "We couldn't read that file as a photo.", 400) from exc

    width, height = img.size
    if min(width, height) < MIN_SHORT_SIDE:
        raise AppError(
            "image_too_small",
            f"The photo is {width}×{height}px. The shorter side needs to be at least {MIN_SHORT_SIDE}px.",
            422,
            hint="Use your phone's main camera or a larger photo.",
        )
    if max(width, height) > MAX_LONG_SIDE:
        img.thumbnail((MAX_LONG_SIDE, MAX_LONG_SIDE), Image.Resampling.LANCZOS)
        width, height = img.size

    stat = ImageStat.Stat(img.convert("L"))
    luminance_mean = round(float(stat.mean[0]), 1)
    luminance_std = round(float(stat.stddev[0]), 1)
    if luminance_mean < TOO_DARK_LUMINANCE:
        raise AppError(
            "too_dark",
            "This photo is too dark to analyse reliably.",
            422,
            hint="Face a window or a soft light and try again.",
        )

    out = io.BytesIO()
    # No exif/icc arguments: the saved file carries no metadata.
    img.save(out, format="JPEG", quality=92, optimize=True)
    data = out.getvalue()
    return PreparedImage(
        data=data,
        content_type="image/jpeg",
        width=width,
        height=height,
        luminance_mean=luminance_mean,
        luminance_std=luminance_std,
        digest=hashlib.sha256(data).hexdigest(),
    )
