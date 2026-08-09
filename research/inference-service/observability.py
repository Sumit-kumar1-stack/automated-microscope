from __future__ import annotations

import json
import logging
import sys
import traceback

from datetime import (
    datetime,
    timezone,
)

from pathlib import Path
from typing import (
    Any,
    TextIO,
)


# ============================================================
# CONSTANTS
# ============================================================

DEFAULT_SERVICE_NAME = (
    "microscope-inference"
)


ALLOWED_LOG_LEVELS = {
    "critical":
        logging.CRITICAL,

    "error":
        logging.ERROR,

    "warning":
        logging.WARNING,

    "info":
        logging.INFO,

    "debug":
        logging.DEBUG,
}


# ============================================================
# TIME
# ============================================================

def utc_timestamp() -> str:
    """
    Return an RFC3339-style UTC timestamp.
    """

    return (
        datetime.now(
            timezone.utc
        )
        .isoformat(
            timespec="milliseconds"
        )
        .replace(
            "+00:00",
            "Z",
        )
    )


# ============================================================
# SAFE JSON NORMALIZATION
# ============================================================

def normalize_json_value(
    value: Any,
) -> Any:
    """
    Convert common Python objects into
    JSON-safe representations.
    """

    if value is None:
        return None


    if isinstance(
        value,
        (
            str,
            int,
            float,
            bool,
        ),
    ):
        return value


    if isinstance(
        value,
        Path,
    ):
        return str(
            value
        )


    if isinstance(
        value,
        bytes,
    ):
        return {
            "type":
                "bytes",

            "length":
                len(
                    value
                ),
        }


    if isinstance(
        value,
        dict,
    ):
        return {
            str(
                key
            ):
                normalize_json_value(
                    item
                )

            for (
                key,
                item,
            )
            in value.items()
        }


    if isinstance(
        value,
        (
            list,
            tuple,
            set,
        ),
    ):
        return [
            normalize_json_value(
                item
            )
            for item
            in value
        ]


    return str(
        value
    )


# ============================================================
# JSON FORMATTER
# ============================================================

class JsonLogFormatter(
    logging.Formatter
):
    """
    One JSON object per log line.

    Intended for container logs and future
    log aggregation systems.
    """

    def __init__(
        self,
        service_name: str,
    ) -> None:
        super().__init__()


        self.service_name = (
            service_name
        )


    def format(
        self,
        record: logging.LogRecord,
    ) -> str:

        payload: dict[
            str,
            Any,
        ] = {
            "timestamp":
                utc_timestamp(),

            "level":
                record.levelname.lower(),

            "service":
                self.service_name,

            "logger":
                record.name,

            "message":
                record.getMessage(),
        }


        event = getattr(
            record,
            "event",
            None,
        )


        if event:
            payload[
                "event"
            ] = str(
                event
            )


        context = getattr(
            record,
            "context",
            None,
        )


        if isinstance(
            context,
            dict,
        ):
            payload[
                "context"
            ] = (
                normalize_json_value(
                    context
                )
            )


        if (
            record.exc_info
            is not None
        ):
            (
                exception_type,
                exception_value,
                _traceback,
            ) = record.exc_info


            payload[
                "exception"
            ] = {
                "type":
                    (
                        exception_type
                        .__name__
                        if exception_type
                        is not None
                        else
                        "Exception"
                    ),

                "message":
                    str(
                        exception_value
                    ),

                "stack":
                    "".join(
                        traceback.format_exception(
                            *record.exc_info
                        )
                    ),
            }


        return json.dumps(
            payload,
            ensure_ascii=False,
            separators=(
                ",",
                ":",
            ),
        )


# ============================================================
# LOG LEVEL
# ============================================================

def resolve_log_level(
    level: str,
) -> int:

    normalized = (
        level
        .strip()
        .lower()
    )


    if (
        normalized
        not in ALLOWED_LOG_LEVELS
    ):
        raise ValueError(
            (
                "Unsupported log level: "
                f"{level!r}"
            )
        )


    return (
        ALLOWED_LOG_LEVELS[
            normalized
        ]
    )


# ============================================================
# CONFIGURE LOGGER
# ============================================================

def configure_service_logger(
    name: str,
    *,
    level: str = "info",
    service_name: str = DEFAULT_SERVICE_NAME,
    stream: TextIO | None = None,
) -> logging.Logger:
    """
    Configure an isolated service logger.

    Existing handlers are removed so repeated
    initialization does not duplicate log lines.
    """

    logger = logging.getLogger(
        name
    )


    logger.handlers.clear()


    handler = logging.StreamHandler(
        stream
        if stream is not None
        else sys.stdout
    )


    handler.setFormatter(
        JsonLogFormatter(
            service_name
        )
    )


    logger.addHandler(
        handler
    )


    logger.setLevel(
        resolve_log_level(
            level
        )
    )


    logger.propagate = (
        False
    )


    return logger


# ============================================================
# STRUCTURED EVENT
# ============================================================

def log_event(
    logger: logging.Logger,
    level: int,
    event: str,
    message: str,
    **context: Any,
) -> None:
    """
    Write one structured operational event.
    """

    logger.log(
        level,
        message,

        extra={
            "event":
                event,

            "context":
                context,
        },
    )


# ============================================================
# CONVENIENCE METHODS
# ============================================================

def log_info(
    logger: logging.Logger,
    event: str,
    message: str,
    **context: Any,
) -> None:

    log_event(
        logger,
        logging.INFO,
        event,
        message,
        **context,
    )


def log_warning(
    logger: logging.Logger,
    event: str,
    message: str,
    **context: Any,
) -> None:

    log_event(
        logger,
        logging.WARNING,
        event,
        message,
        **context,
    )


def log_error(
    logger: logging.Logger,
    event: str,
    message: str,
    **context: Any,
) -> None:

    log_event(
        logger,
        logging.ERROR,
        event,
        message,
        **context,
    )