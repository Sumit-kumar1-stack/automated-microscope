from __future__ import annotations

import os

from dataclasses import dataclass
from typing import Mapping


# ============================================================
# ALLOWED VALUES
# ============================================================

ALLOWED_ENVIRONMENTS = {
    "development",
    "test",
    "production",
}


ALLOWED_LOG_LEVELS = {
    "critical",
    "error",
    "warning",
    "info",
    "debug",
}


DEFAULT_CORS_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
)


# ============================================================
# CONFIGURATION ERROR
# ============================================================

class ConfigurationError(
    ValueError
):
    """
    Raised when runtime configuration is
    missing, malformed or outside the
    supported safety envelope.
    """


# ============================================================
# HELPERS
# ============================================================

def get_string(
    environ: Mapping[str, str],
    name: str,
    default: str,
) -> str:
    value = (
        environ.get(
            name,
            default,
        )
        .strip()
    )


    if not value:
        raise ConfigurationError(
            f"{name} must not be empty."
        )


    if (
        "\n" in value
        or
        "\r" in value
    ):
        raise ConfigurationError(
            f"{name} contains invalid newline characters."
        )


    return value


def get_integer(
    environ: Mapping[str, str],
    name: str,
    default: int,
    minimum: int,
    maximum: int,
) -> int:
    raw_value = (
        environ.get(
            name,
            str(
                default
            ),
        )
        .strip()
    )


    try:
        value = int(
            raw_value
        )

    except ValueError as error:
        raise ConfigurationError(
            (
                f"{name} must be an integer; "
                f"received {raw_value!r}."
            )
        ) from error


    if (
        value < minimum
        or
        value > maximum
    ):
        raise ConfigurationError(
            (
                f"{name} must be between "
                f"{minimum} and {maximum}; "
                f"received {value}."
            )
        )


    return value


def get_choice(
    environ: Mapping[str, str],
    name: str,
    default: str,
    allowed: set[str],
) -> str:
    value = get_string(
        environ,
        name,
        default,
    ).lower()


    if (
        value
        not in allowed
    ):
        allowed_text = (
            ", ".join(
                sorted(
                    allowed
                )
            )
        )


        raise ConfigurationError(
            (
                f"{name} must be one of: "
                f"{allowed_text}; "
                f"received {value!r}."
            )
        )


    return value


def get_cors_origins(
    environ: Mapping[str, str],
) -> tuple[str, ...]:
    raw_value = (
        environ.get(
            "INFERENCE_CORS_ORIGINS",
            ",".join(
                DEFAULT_CORS_ORIGINS
            ),
        )
        .strip()
    )


    if not raw_value:
        raise ConfigurationError(
            (
                "INFERENCE_CORS_ORIGINS "
                "must contain at least one origin."
            )
        )


    origins = tuple(
        item.strip()
        for item
        in raw_value.split(",")
        if item.strip()
    )


    if not origins:
        raise ConfigurationError(
            (
                "INFERENCE_CORS_ORIGINS "
                "must contain at least one valid origin."
            )
        )


    for origin in origins:

        if origin == "*":
            raise ConfigurationError(
                (
                    "Wildcard CORS origin '*' "
                    "is not allowed."
                )
            )


        if not (
            origin.startswith(
                "http://"
            )
            or
            origin.startswith(
                "https://"
            )
        ):
            raise ConfigurationError(
                (
                    "CORS origins must start "
                    "with http:// or https://; "
                    f"received {origin!r}."
                )
            )


        if (
            "\n" in origin
            or
            "\r" in origin
        ):
            raise ConfigurationError(
                (
                    "CORS origin contains "
                    "invalid newline characters."
                )
            )


    return origins


# ============================================================
# RUNTIME CONFIGURATION
# ============================================================

@dataclass(
    frozen=True
)
class RuntimeConfig:
    environment: str

    host: str

    port: int

    log_level: str

    limit_concurrency: int

    max_upload_mb: int

    cors_origins: tuple[
        str,
        ...
    ]


    @property
    def max_upload_bytes(
        self,
    ) -> int:
        return (
            self.max_upload_mb
            * 1024
            * 1024
        )


    @property
    def is_production(
        self,
    ) -> bool:
        return (
            self.environment
            == "production"
        )


    def safe_summary(
        self,
    ) -> dict[
        str,
        object,
    ]:
        """
        Return non-secret configuration that
        is safe to include in startup logs.
        """

        return {
            "environment":
                self.environment,

            "host":
                self.host,

            "port":
                self.port,

            "log_level":
                self.log_level,

            "limit_concurrency":
                self.limit_concurrency,

            "max_upload_mb":
                self.max_upload_mb,

            "cors_origins":
                list(
                    self.cors_origins
                ),
        }


# ============================================================
# LOAD CONFIGURATION
# ============================================================

def load_runtime_config(
    environ: Mapping[
        str,
        str,
    ]
    | None = None,
) -> RuntimeConfig:
    source = (
        os.environ
        if environ is None
        else environ
    )


    environment = get_choice(
        source,
        "INFERENCE_ENV",
        "development",
        ALLOWED_ENVIRONMENTS,
    )


    host = get_string(
        source,
        "INFERENCE_HOST",
        "0.0.0.0",
    )


    port = get_integer(
        source,
        "INFERENCE_PORT",
        8000,
        1,
        65535,
    )


    log_level = get_choice(
        source,
        "INFERENCE_LOG_LEVEL",
        "info",
        ALLOWED_LOG_LEVELS,
    )


    limit_concurrency = (
        get_integer(
            source,
            "INFERENCE_LIMIT_CONCURRENCY",
            8,
            1,
            64,
        )
    )


    max_upload_mb = (
        get_integer(
            source,
            "INFERENCE_MAX_UPLOAD_MB",
            20,
            1,
            100,
        )
    )


    cors_origins = (
        get_cors_origins(
            source
        )
    )


    return RuntimeConfig(
        environment=environment,

        host=host,

        port=port,

        log_level=log_level,

        limit_concurrency=(
            limit_concurrency
        ),

        max_upload_mb=(
            max_upload_mb
        ),

        cors_origins=(
            cors_origins
        ),
    )