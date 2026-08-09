from __future__ import annotations

import importlib.util
import io
import json
import logging
import sys

from pathlib import Path

import pytest


# ============================================================
# LOAD MODULE
# ============================================================

MODULE_PATH = (
    Path(__file__)
    .resolve()
    .parents[1]
    / "observability.py"
)


SPEC = (
    importlib.util
    .spec_from_file_location(
        "inference_observability",
        MODULE_PATH,
    )
)


if (
    SPEC is None
    or
    SPEC.loader is None
):
    raise RuntimeError(
        "Unable to load observability module."
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


configure_service_logger = (
    MODULE
    .configure_service_logger
)


log_info = (
    MODULE
    .log_info
)


log_warning = (
    MODULE
    .log_warning
)


normalize_json_value = (
    MODULE
    .normalize_json_value
)


resolve_log_level = (
    MODULE
    .resolve_log_level
)


# ============================================================
# JSON LOG FORMAT
# ============================================================

def test_json_log_format() -> None:
    stream = io.StringIO()


    logger = (
        configure_service_logger(
            "test-json-format",
            level="info",
            stream=stream,
        )
    )


    logger.info(
        "service started"
    )


    payload = json.loads(
        stream
        .getvalue()
        .strip()
    )


    assert (
        payload[
            "level"
        ]
        == "info"
    )


    assert (
        payload[
            "service"
        ]
        == "microscope-inference"
    )


    assert (
        payload[
            "logger"
        ]
        == "test-json-format"
    )


    assert (
        payload[
            "message"
        ]
        == "service started"
    )


    assert (
        payload[
            "timestamp"
        ]
        .endswith(
            "Z"
        )
    )


# ============================================================
# STRUCTURED EVENT
# ============================================================

def test_structured_event_context() -> None:
    stream = io.StringIO()


    logger = (
        configure_service_logger(
            "test-event",
            stream=stream,
        )
    )


    log_info(
        logger,
        "inference.complete",
        "Inference completed",
        candidate_count=2,
        inference_ms=181.5,
        model_version="v2-frozen",
    )


    payload = json.loads(
        stream
        .getvalue()
        .strip()
    )


    assert (
        payload[
            "event"
        ]
        ==
        "inference.complete"
    )


    assert (
        payload[
            "context"
        ][
            "candidate_count"
        ]
        == 2
    )


    assert (
        payload[
            "context"
        ][
            "model_version"
        ]
        ==
        "v2-frozen"
    )


# ============================================================
# WARNING LEVEL
# ============================================================

def test_warning_event() -> None:
    stream = io.StringIO()


    logger = (
        configure_service_logger(
            "test-warning",
            stream=stream,
        )
    )


    log_warning(
        logger,
        "upload.invalid_image",
        "Malformed image rejected",
        filename="invalid.png",
    )


    payload = json.loads(
        stream
        .getvalue()
        .strip()
    )


    assert (
        payload[
            "level"
        ]
        ==
        "warning"
    )


    assert (
        payload[
            "event"
        ]
        ==
        "upload.invalid_image"
    )


# ============================================================
# EXCEPTION SERIALIZATION
# ============================================================

def test_exception_serialization() -> None:
    stream = io.StringIO()


    logger = (
        configure_service_logger(
            "test-exception",
            stream=stream,
        )
    )


    try:
        raise RuntimeError(
            "simulated failure"
        )

    except RuntimeError:
        logger.exception(
            "Inference failed"
        )


    payload = json.loads(
        stream
        .getvalue()
        .strip()
    )


    assert (
        payload[
            "level"
        ]
        ==
        "error"
    )


    assert (
        payload[
            "exception"
        ][
            "type"
        ]
        ==
        "RuntimeError"
    )


    assert (
        payload[
            "exception"
        ][
            "message"
        ]
        ==
        "simulated failure"
    )


    assert (
        "RuntimeError"
        in
        payload[
            "exception"
        ][
            "stack"
        ]
    )


# ============================================================
# JSON NORMALIZATION
# ============================================================

def test_json_normalization() -> None:
    result = (
        normalize_json_value(
            {
                "path":
                    Path(
                        "model.pt"
                    ),

                "blob":
                    b"12345",

                "items":
                    (
                        1,
                        2,
                    ),
            }
        )
    )


    assert (
        result[
            "path"
        ]
        ==
        "model.pt"
    )


    assert (
        result[
            "blob"
        ]
        ==
        {
            "type":
                "bytes",

            "length":
                5,
        }
    )


    assert (
        result[
            "items"
        ]
        ==
        [
            1,
            2,
        ]
    )


# ============================================================
# LEVEL VALIDATION
# ============================================================

@pytest.mark.parametrize(
    (
        "name",
        "expected",
    ),
    [
        (
            "critical",
            logging.CRITICAL,
        ),

        (
            "error",
            logging.ERROR,
        ),

        (
            "warning",
            logging.WARNING,
        ),

        (
            "info",
            logging.INFO,
        ),

        (
            "debug",
            logging.DEBUG,
        ),
    ],
)
def test_valid_log_levels(
    name: str,
    expected: int,
) -> None:

    assert (
        resolve_log_level(
            name
        )
        ==
        expected
    )


def test_invalid_log_level_rejected() -> None:

    with pytest.raises(
        ValueError
    ):
        resolve_log_level(
            "verbose"
        )


# ============================================================
# DUPLICATE HANDLER PROTECTION
# ============================================================

def test_reconfiguration_does_not_duplicate_handlers() -> None:
    first_stream = (
        io.StringIO()
    )


    second_stream = (
        io.StringIO()
    )


    logger = (
        configure_service_logger(
            "test-reconfigure",
            stream=first_stream,
        )
    )


    logger.info(
        "first"
    )


    logger = (
        configure_service_logger(
            "test-reconfigure",
            stream=second_stream,
        )
    )


    logger.info(
        "second"
    )


    first_lines = (
        first_stream
        .getvalue()
        .strip()
        .splitlines()
    )


    second_lines = (
        second_stream
        .getvalue()
        .strip()
        .splitlines()
    )


    assert (
        len(
            first_lines
        )
        == 1
    )


    assert (
        len(
            second_lines
        )
        == 1
    )


    assert (
        json.loads(
            second_lines[
                0
            ]
        )[
            "message"
        ]
        ==
        "second"
    )