"""Pixel-count guard: oversized images are refused before any pixel is decoded.

The inputs are crafted PNG headers that claim a size but carry a tiny, truncated pixel stream,
so no test here allocates a large image. A file like this is how a decompression bomb looks:
a few hundred bytes on the wire that would decode to hundreds of megabytes.
"""

from __future__ import annotations

import io
import struct
import warnings
import zlib

import pytest
from PIL import Image

from app.core.errors import AppError
from app.services import imaging
from app.services.imaging import MAX_PIXELS, prepare_image
from tests.conftest import new_session, wait_for_scan
from tests.test_api import V1


def _chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


def header_png(width: int, height: int) -> bytes:
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", ihdr)
        + _chunk(b"IDAT", zlib.compress(b"\x00" * 64))
        + _chunk(b"IEND", b"")
    )


def refuse(data: bytes) -> AppError:
    with pytest.raises(AppError) as info, warnings.catch_warnings():
        warnings.simplefilter("error")  # no DecompressionBombWarning may leak out
        prepare_image(data)
    return info.value


def test_the_limit_covers_every_photo_the_app_sends_and_a_standard_phone_photo():
    assert MAX_PIXELS == 12_000_000
    assert 1080 * 1440 <= MAX_PIXELS  # the in-browser framer's largest output (frontend/src/app/scan/framer.tsx)
    assert 4000 * 3000 <= MAX_PIXELS  # a full-resolution 12 MP phone photo sent straight to the API


def test_exactly_at_the_limit_passes_the_pixel_guard():
    # Passes the guard, then fails to decode the truncated stream: "unreadable", not "too large".
    assert refuse(header_png(4000, MAX_PIXELS // 4000)).code == "unreadable_image"


@pytest.mark.parametrize(
    ("width", "height"),
    [
        (4000, 3001),  # one row over the limit
        (5000, 4000),  # 20 MP: Pillow itself would only warn here (between 1x and 2x its limit)
        (8000, 5000),  # 40 MP: the previous limit, which Pillow also only warned about
        (8000, 10002),  # 80 MP: above Pillow's own hard error
        (60000, 60000),  # 3.6 GP
    ],
)
def test_over_the_limit_is_refused_as_too_large(width, height):
    err = refuse(header_png(width, height))
    assert (err.code, err.status_code) == ("image_too_large", 413)
    assert "12 MP" in err.message


def test_refused_before_any_pixel_is_decoded(monkeypatch):
    def no_decoding(*_a, **_k):
        raise AssertionError("pixels were decoded before the size check")

    monkeypatch.setattr(Image.Image, "load", no_decoding)
    monkeypatch.setattr(Image.Image, "verify", no_decoding)
    monkeypatch.setattr(imaging.ImageOps, "exif_transpose", no_decoding)
    assert refuse(header_png(5000, 4000)).code == "image_too_large"


def test_pillows_own_bomb_check_stays_as_a_backstop():
    assert Image.MAX_IMAGE_PIXELS == MAX_PIXELS


def test_oversized_upload_is_refused_without_reserving_units(api, fake_youcam):
    with api() as client:
        h = new_session(client)
        r = client.post(
            f"{V1}/scans",
            headers=h,
            data={"consent": "true", "source": "upload"},
            files={"image": ("big.png", header_png(8000, 5000), "image/png")},
        )
        assert r.status_code == 413 and r.json()["error"]["code"] == "image_too_large"
        assert client.get(f"{V1}/system/status").json()["budget"]["committed"] == 0
        assert not fake_youcam.requests


def _framer_jpeg() -> bytes:
    """What the in-browser framer uploads at most: a 1080x1440 JPEG (frontend/src/app/scan/framer.tsx)."""
    buf = io.BytesIO()
    Image.new("RGB", (1080, 1440), (190, 150, 130)).save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def test_the_framers_largest_photo_is_processed_unchanged():
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        out = prepare_image(_framer_jpeg())
    assert (out.width, out.height) == (1080, 1440)  # under the 2048 resize, so untouched
    assert out.content_type == "image/jpeg"


def test_the_framers_largest_photo_goes_through_the_live_scan_path(api, fake_youcam):
    with api() as client:
        h = new_session(client)
        r = client.post(
            f"{V1}/scans",
            headers=h,
            data={"consent": "true", "source": "camera"},
            files={"image": ("me.jpg", _framer_jpeg(), "image/jpeg")},
        )
        assert r.status_code == 202, r.text
        assert r.json()["capture"]["width"] == 1080 and r.json()["capture"]["height"] == 1440
        scan = wait_for_scan(client, h, r.json()["id"])
        assert scan["status"] == "complete" and len(scan["metrics"]) == 8
        assert len(fake_youcam.bodies("POST", "/s2s/v2.0/task/skin-analysis")) == 1
