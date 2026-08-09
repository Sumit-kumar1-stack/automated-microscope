from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
import sys


# ============================================================
# LOAD CONFIG MODULE
# ============================================================

CONFIG_PATH = (
    Path(__file__)
    .resolve()
    .parents[1]
    / "config.py"
)


SPEC = (
    importlib.util
    .spec_from_file_location(
        "inference_config",
        CONFIG_PATH,
    )
)


if (
    SPEC is None
    or
    SPEC.loader is None
):
    raise RuntimeError(
        "Unable to load inference config module."
    )


CONFIG_MODULE = (
    importlib.util
    .module_from_spec(
        SPEC
    )
)


# Dataclasses inspect sys.modules while the
# decorated class is being created. Register
# the dynamically loaded module before exec.
sys.modules[
    SPEC.name
] = CONFIG_MODULE


SPEC.loader.exec_module(
    CONFIG_MODULE
)


ConfigurationError = (
    CONFIG_MODULE
    .ConfigurationError
)


load_runtime_config = (
    CONFIG_MODULE
    .load_runtime_config
)


# ============================================================
# DEFAULT CONFIGURATION
# ============================================================

def test_safe_defaults() -> None:
    config = (
        load_runtime_config(
            {}
        )
    )


    assert (
        config.environment
        == "development"
    )


    assert (
        config.host
        == "0.0.0.0"
    )


    assert (
        config.port
        == 8000
    )


    assert (
        config.log_level
        == "info"
    )


    assert (
        config.limit_concurrency
        == 8
    )


    assert (
        config.max_upload_mb
        == 20
    )


    assert (
        config.max_upload_bytes
        ==
        20
        * 1024
        * 1024
    )


    assert (
        config.cors_origins
        ==
        (
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        )
    )


# ============================================================
# PRODUCTION CONFIGURATION
# ============================================================

def test_valid_production_configuration() -> None:
    config = (
        load_runtime_config(
            {
                "INFERENCE_ENV":
                    "production",

                "INFERENCE_HOST":
                    "0.0.0.0",

                "INFERENCE_PORT":
                    "8080",

                "INFERENCE_LOG_LEVEL":
                    "warning",

                "INFERENCE_LIMIT_CONCURRENCY":
                    "4",

                "INFERENCE_MAX_UPLOAD_MB":
                    "25",

                "INFERENCE_CORS_ORIGINS":
                    (
                        "https://microscope.example.com,"
                        "https://research.example.com"
                    ),
            }
        )
    )


    assert (
        config.is_production
        is True
    )


    assert (
        config.port
        == 8080
    )


    assert (
        config.limit_concurrency
        == 4
    )


    assert (
        config.max_upload_mb
        == 25
    )


    assert (
        config.cors_origins
        ==
        (
            "https://microscope.example.com",
            "https://research.example.com",
        )
    )


# ============================================================
# PORT VALIDATION
# ============================================================

@pytest.mark.parametrize(
    "value",
    [
        "0",
        "-1",
        "65536",
        "abc",
        "8000.5",
    ],
)
def test_invalid_port_rejected(
    value: str,
) -> None:
    with pytest.raises(
        ConfigurationError
    ):
        load_runtime_config(
            {
                "INFERENCE_PORT":
                    value,
            }
        )


# ============================================================
# CONCURRENCY VALIDATION
# ============================================================

@pytest.mark.parametrize(
    "value",
    [
        "0",
        "-1",
        "65",
        "lots",
    ],
)
def test_invalid_concurrency_rejected(
    value: str,
) -> None:
    with pytest.raises(
        ConfigurationError
    ):
        load_runtime_config(
            {
                "INFERENCE_LIMIT_CONCURRENCY":
                    value,
            }
        )


# ============================================================
# UPLOAD LIMIT VALIDATION
# ============================================================

@pytest.mark.parametrize(
    "value",
    [
        "0",
        "-5",
        "101",
        "huge",
    ],
)
def test_invalid_upload_limit_rejected(
    value: str,
) -> None:
    with pytest.raises(
        ConfigurationError
    ):
        load_runtime_config(
            {
                "INFERENCE_MAX_UPLOAD_MB":
                    value,
            }
        )


# ============================================================
# LOG LEVEL VALIDATION
# ============================================================

def test_invalid_log_level_rejected() -> None:
    with pytest.raises(
        ConfigurationError
    ):
        load_runtime_config(
            {
                "INFERENCE_LOG_LEVEL":
                    "verbose",
            }
        )


# ============================================================
# ENVIRONMENT VALIDATION
# ============================================================

def test_invalid_environment_rejected() -> None:
    with pytest.raises(
        ConfigurationError
    ):
        load_runtime_config(
            {
                "INFERENCE_ENV":
                    "clinical-production",
            }
        )


# ============================================================
# CORS VALIDATION
# ============================================================

def test_wildcard_cors_rejected() -> None:
    with pytest.raises(
        ConfigurationError
    ):
        load_runtime_config(
            {
                "INFERENCE_CORS_ORIGINS":
                    "*",
            }
        )


def test_invalid_cors_scheme_rejected() -> None:
    with pytest.raises(
        ConfigurationError
    ):
        load_runtime_config(
            {
                "INFERENCE_CORS_ORIGINS":
                    "microscope.example.com",
            }
        )


def test_empty_cors_rejected() -> None:
    with pytest.raises(
        ConfigurationError
    ):
        load_runtime_config(
            {
                "INFERENCE_CORS_ORIGINS":
                    " ",
            }
        )


# ============================================================
# SAFE SUMMARY
# ============================================================

def test_safe_summary() -> None:
    config = (
        load_runtime_config(
            {
                "INFERENCE_ENV":
                    "test",
            }
        )
    )


    summary = (
        config.safe_summary()
    )


    assert (
        summary[
            "environment"
        ]
        == "test"
    )


    assert (
        summary[
            "port"
        ]
        == 8000
    )


    assert (
        "password"
        not in summary
    )


    assert (
        "token"
        not in summary
    )