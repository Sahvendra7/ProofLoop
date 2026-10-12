from __future__ import annotations

import io

import pytest
from PIL import Image

from app.core.errors import AppError
from app.services.imaging import prepare_image


def jpeg(size=(720, 960), color=(190, 150, 130), exif: Image.Exif | None = None) -> bytes:
    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif.tobytes() if exif else b"")
    return buf.getvalue()


def test_metadata_is_stripped_and_orientation_applied():
    exif = Image.Exif()
    exif[0x0112] = 6  # rotate 90 CW
    exif[0x010F] = "SecretCam"  # Make
    exif[0x8825] = {2: (51.0, 30.0, 0.0)}  # GPS IFD
    out = prepare_image(jpeg(size=(960, 720), exif=exif))
    assert (out.width, out.height) == (720, 960)  # rotated to portrait
    cleaned = Image.open(io.BytesIO(out.data))
    assert len(cleaned.getexif()) == 0
    assert b"SecretCam" not in out.data


def test_large_images_are_resized():
    out = prepare_image(jpeg(size=(3000, 4000)))
    assert max(out.width, out.height) == 2048


def test_too_small_is_rejected_with_guidance():
    with pytest.raises(AppError) as info:
        prepare_image(jpeg(size=(400, 600)))
    assert info.value.code == "image_too_small"
    assert info.value.hint


def test_non_image_is_rejected():
    with pytest.raises(AppError) as info:
        prepare_image(b"%PDF-1.4 definitely not a photo")
    assert info.value.code == "unreadable_image"


def test_gif_is_rejected():
    buf = io.BytesIO()
    Image.new("RGB", (600, 800)).save(buf, format="GIF")
    with pytest.raises(AppError) as info:
        prepare_image(buf.getvalue())
    assert info.value.code == "unsupported_image"


def test_very_dark_photo_rejected_before_spending_units():
    with pytest.raises(AppError) as info:
        prepare_image(jpeg(color=(8, 8, 8)))
    assert info.value.code == "too_dark"


def test_luminance_is_measured():
    out = prepare_image(jpeg(color=(128, 128, 128)))
    assert 120 < out.luminance_mean < 136
