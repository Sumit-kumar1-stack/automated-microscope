from __future__ import annotations

import io
import os
import string

import requests

from PIL import Image


# ============================================================
# TEST CONFIGURATION
# ============================================================

BASE_URL = (
    os.environ.get(
        "INFERENCE_BASE_URL",
        "http://127.0.0.1:8000",
    )
    .rstrip("/")
)


REQUEST_TIMEOUT_SECONDS = float(
    os.environ.get(
        "INFERENCE_TEST_TIMEOUT_SECONDS",
        "30",
    )
)


MAX_UPLOAD_MB = int(
    os.environ.get(
        "INFERENCE_TEST_MAX_UPLOAD_MB",
        "20",
    )
)


# ============================================================
# HELPERS
# ============================================================

def is_generated_request_id(
    value: str,
) -> bool:
    """
    Generated IDs currently use uuid4().hex:
    32 lowercase hexadecimal characters.
    """

    return (
        len(value) == 32
        and
        all(
            character
            in string.hexdigits
            for character
            in value
        )
    )


def create_png(
    width: int,
    height: int,
) -> bytes:
    """
    Create a real PNG entirely in memory.

    Used to verify that image safety checks
    operate on actual decoded dimensions,
    not merely filename or MIME metadata.
    """

    image = Image.new(
        "RGB",
        (
            width,
            height,
        ),
        (
            0,
            0,
            0,
        ),
    )


    buffer = (
        io.BytesIO()
    )


    image.save(
        buffer,
        format="PNG",
    )


    return (
        buffer.getvalue()
    )


# ============================================================
# UNSUPPORTED MEDIA TYPE
# ============================================================

def test_text_upload_rejected_before_inference() -> None:
    response = requests.post(
        f"{BASE_URL}/infer",

        files={
            "file": (
                "payload.txt",
                b"this is not microscopy image data",
                "text/plain",
            ),
        },

        timeout=(
            REQUEST_TIMEOUT_SECONDS
        ),
    )


    assert (
        response.status_code
        == 415
    )


    payload = (
        response.json()
    )


    assert (
        "detail"
        in payload
    )


# ============================================================
# MIME TYPE MUST NOT BE TRUSTED
# ============================================================

def test_fake_png_bytes_rejected() -> None:
    response = requests.post(
        f"{BASE_URL}/infer",

        files={
            "file": (
                "fake.png",
                b"this-is-not-a-real-png",
                "image/png",
            ),
        },

        timeout=(
            REQUEST_TIMEOUT_SECONDS
        ),
    )


    assert (
        response.status_code
        == 400
    )


    payload = (
        response.json()
    )


    assert (
        payload[
            "detail"
        ]
        ==
        (
            "Uploaded file is not a valid "
            "supported image."
        )
    )


# ============================================================
# BYTE-SIZE BOUNDARY
# ============================================================

def test_oversized_upload_rejected() -> None:
    maximum_bytes = (
        MAX_UPLOAD_MB
        * 1024
        * 1024
    )


    oversized_payload = (
        b"x"
        *
        (
            maximum_bytes
            + 1
        )
    )


    response = requests.post(
        f"{BASE_URL}/infer",

        files={
            "file": (
                "oversized.png",
                oversized_payload,
                "image/png",
            ),
        },

        timeout=(
            REQUEST_TIMEOUT_SECONDS
        ),
    )


    assert (
        response.status_code
        == 413
    )


    payload = (
        response.json()
    )


    assert (
        "size limit"
        in payload[
            "detail"
        ].lower()
    )


# ============================================================
# IMAGE-DIMENSION BOUNDARY
# ============================================================

def test_excessive_width_rejected_before_model_inference() -> None:
    image_bytes = (
        create_png(
            width=12_001,
            height=1,
        )
    )


    response = requests.post(
        f"{BASE_URL}/infer",

        files={
            "file": (
                "too-wide.png",
                image_bytes,
                "image/png",
            ),
        },

        timeout=(
            REQUEST_TIMEOUT_SECONDS
        ),
    )


    assert (
        response.status_code
        == 413
    )


    payload = (
        response.json()
    )


    assert (
        "width"
        in payload[
            "detail"
        ].lower()
    )


# ============================================================
# SAFE REQUEST-ID PRESERVATION
# ============================================================

def test_safe_request_id_is_preserved() -> None:
    request_id = (
        "microscope-boundary-001"
    )


    response = requests.get(
        f"{BASE_URL}/live",

        headers={
            "X-Request-ID":
                request_id,
        },

        timeout=(
            REQUEST_TIMEOUT_SECONDS
        ),
    )


    assert (
        response.status_code
        == 200
    )


    assert (
        response.headers.get(
            "X-Request-ID"
        )
        ==
        request_id
    )


# ============================================================
# HOSTILE REQUEST-ID REPLACEMENT
# ============================================================

def test_invalid_request_id_is_replaced() -> None:
    supplied_request_id = (
        "bad/request/id"
    )


    response = requests.get(
        f"{BASE_URL}/live",

        headers={
            "X-Request-ID":
                supplied_request_id,
        },

        timeout=(
            REQUEST_TIMEOUT_SECONDS
        ),
    )


    assert (
        response.status_code
        == 200
    )


    returned_request_id = (
        response.headers.get(
            "X-Request-ID"
        )
    )


    assert (
        returned_request_id
        is not None
    )


    assert (
        returned_request_id
        !=
        supplied_request_id
    )


    assert (
        is_generated_request_id(
            returned_request_id
        )
    )


# ============================================================
# EXCESSIVELY LONG REQUEST-ID
# ============================================================

def test_excessively_long_request_id_is_replaced() -> None:
    supplied_request_id = (
        "a"
        * 129
    )


    response = requests.get(
        f"{BASE_URL}/live",

        headers={
            "X-Request-ID":
                supplied_request_id,
        },

        timeout=(
            REQUEST_TIMEOUT_SECONDS
        ),
    )


    assert (
        response.status_code
        == 200
    )


    returned_request_id = (
        response.headers.get(
            "X-Request-ID"
        )
    )


    assert (
        returned_request_id
        is not None
    )


    assert (
        returned_request_id
        !=
        supplied_request_id
    )


    assert (
        is_generated_request_id(
            returned_request_id
        )
    )


# ============================================================
# SERVICE SURVIVES REJECTED INPUTS
# ============================================================

def test_service_remains_ready_after_rejected_requests() -> None:
    """
    Security failures must remain isolated to
    the offending request and must not poison
    model/service readiness.
    """

    response = requests.get(
        f"{BASE_URL}/ready",

        timeout=(
            REQUEST_TIMEOUT_SECONDS
        ),
    )


    assert (
        response.status_code
        == 200
    )


    payload = (
        response.json()
    )


    assert (
        payload[
            "status"
        ]
        ==
        "ready"
    )


    assert (
        payload[
            "models_loaded"
        ]
        is True
    )


    assert (
        payload[
            "model_version"
        ]
        ==
        "v2-frozen"
    )