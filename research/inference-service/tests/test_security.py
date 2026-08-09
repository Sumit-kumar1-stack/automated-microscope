from __future__ import annotations

import importlib.util
import sys

from pathlib import Path

import pytest


# ============================================================
# LOAD SECURITY MODULE
# ============================================================

MODULE_PATH = (
    Path(__file__)
    .resolve()
    .parents[1]
    / "security.py"
)


SPEC = (
    importlib.util
    .spec_from_file_location(
        "inference_security",
        MODULE_PATH,
    )
)


if (
    SPEC is None
    or
    SPEC.loader is None
):
    raise RuntimeError(
        "Unable to load security module."
    )


MODULE = (
    importlib.util
    .module_from_spec(
        SPEC
    )
)


sys.modules[
    SPEC.name
] = MODULE


SPEC.loader.exec_module(
    MODULE
)


UploadSecurityError = (
    MODULE.UploadSecurityError
)


validate_content_type = (
    MODULE.validate_content_type
)


validate_image_format = (
    MODULE.validate_image_format
)


validate_image_dimensions = (
    MODULE.validate_image_dimensions
)


# ============================================================
# CONTENT TYPE
# ============================================================

@pytest.mark.parametrize(
    "content_type",
    [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/tiff",
        "image/bmp",
        "image/png; charset=binary",
    ],
)
def test_supported_content_types(
    content_type: str,
) -> None:
    validate_content_type(
        content_type
    )


@pytest.mark.parametrize(
    "content_type",
    [
        None,
        "",
        "text/plain",
        "application/json",
        "application/pdf",
        "application/octet-stream",
    ],
)
def test_unsupported_content_types_rejected(
    content_type: str | None,
) -> None:
    with pytest.raises(
        UploadSecurityError
    ):
        validate_content_type(
            content_type
        )


# ============================================================
# IMAGE FORMAT
# ============================================================

@pytest.mark.parametrize(
    "image_format",
    [
        "PNG",
        "JPEG",
        "WEBP",
        "TIFF",
        "BMP",
        "png",
    ],
)
def test_supported_decoded_formats(
    image_format: str,
) -> None:
    validate_image_format(
        image_format
    )


@pytest.mark.parametrize(
    "image_format",
    [
        None,
        "",
        "PDF",
        "SVG",
        "ICO",
        "HEIF",
    ],
)
def test_unsupported_decoded_formats_rejected(
    image_format: str | None,
) -> None:
    with pytest.raises(
        UploadSecurityError
    ):
        validate_image_format(
            image_format
        )


# ============================================================
# IMAGE DIMENSIONS
# ============================================================

def test_normal_microscopy_dimensions_allowed() -> None:
    validate_image_dimensions(
        1600,
        1200,
    )


def test_zero_width_rejected() -> None:
    with pytest.raises(
        UploadSecurityError
    ):
        validate_image_dimensions(
            0,
            1200,
        )


def test_zero_height_rejected() -> None:
    with pytest.raises(
        UploadSecurityError
    ):
        validate_image_dimensions(
            1600,
            0,
        )


def test_excessive_width_rejected() -> None:
    with pytest.raises(
        UploadSecurityError
    ) as error:
        validate_image_dimensions(
            12_001,
            100,
        )


    assert (
        error.value.status_code
        == 413
    )


def test_excessive_height_rejected() -> None:
    with pytest.raises(
        UploadSecurityError
    ) as error:
        validate_image_dimensions(
            100,
            12_001,
        )


    assert (
        error.value.status_code
        == 413
    )


def test_excessive_pixel_count_rejected() -> None:
    with pytest.raises(
        UploadSecurityError
    ) as error:
        validate_image_dimensions(
            10_000,
            10_000,
        )


    assert (
        error.value.status_code
        == 413
    )