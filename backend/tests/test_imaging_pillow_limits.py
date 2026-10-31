"""Pillow's decompression-bomb limit, pinned across Pillow upgrades.

Sizes are derived from MAX_PIXELS, so these hold whatever the configured limit is. The inputs are
crafted PNG headers with a tiny, truncated pixel stream: nothing large is ever allocated.
"""

from __future__ import annotations

import struct
import zlib

import pytest
from PIL import Image

from app.core.errors import AppError
from app.services.imaging import MAX_PIXELS, prepare_image


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


def test_the_app_sets_pillows_limit():
    assert Image.MAX_IMAGE_PIXELS == MAX_PIXELS


@pytest.mark.parametrize("factor", [2, 3, 100])
def test_far_above_the_limit_is_refused_as_too_large(factor):
    width = 4000
    with pytest.raises(AppError) as info:
        prepare_image(header_png(width, MAX_PIXELS * factor // width + 1))
    assert (info.value.code, info.value.status_code) == ("image_too_large", 413)


def test_at_the_limit_is_not_refused_as_too_large():
    # The truncated stream can't decode, so it fails as unreadable: proof it got past the size limit.
    with pytest.raises(AppError) as info:
        prepare_image(header_png(4000, MAX_PIXELS // 4000))
    assert info.value.code == "unreadable_image"
