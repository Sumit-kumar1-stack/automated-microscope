from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request

from pathlib import Path
from typing import Any


# ============================================================
# PATHS
# ============================================================

THIS_FILE = (
    Path(__file__)
    .resolve()
)


REPOSITORY_ROOT = (
    THIS_FILE.parents[2]
)


TEST_DIRECTORY = (
    REPOSITORY_ROOT
    / "research"
    / "inference-service"
    / "tests"
)


SMOKE_TEST_PATH = (
    REPOSITORY_ROOT
    / "research"
    / "inference-service"
    / "smoke_test.py"
)


# ============================================================
# OUTPUT
# ============================================================

def section(
    title: str,
) -> None:

    print()
    print(
        "=" * 72
    )
    print(
        title
    )
    print(
        "=" * 72
    )


def pass_message(
    message: str,
) -> None:

    print(
        f"[PASS] {message}"
    )


def fail(
    message: str,
) -> None:

    print(
        f"[FAIL] {message}",
        file=sys.stderr,
    )

    raise SystemExit(
        1
    )


# ============================================================
# HTTP
# ============================================================

def fetch_json(
    base_url: str,
    path: str,
    *,
    timeout_seconds: float = 10.0,
) -> tuple[
    int,
    dict[
        str,
        Any,
    ],
]:

    url = (
        f"{base_url.rstrip('/')}"
        f"{path}"
    )


    request = urllib.request.Request(
        url,
        method="GET",
    )


    try:

        with urllib.request.urlopen(
            request,
            timeout=timeout_seconds,
        ) as response:

            status_code = (
                response.status
            )


            raw_body = (
                response.read()
            )


    except urllib.error.HTTPError as error:

        status_code = (
            error.code
        )


        raw_body = (
            error.read()
        )


    except (
        urllib.error.URLError,
        TimeoutError,
    ) as error:

        raise RuntimeError(
            (
                "Unable to reach "
                f"{url}: {error}"
            )
        ) from error


    try:

        payload = json.loads(
            raw_body.decode(
                "utf-8"
            )
        )


    except (
        UnicodeDecodeError,
        json.JSONDecodeError,
    ) as error:

        raise RuntimeError(
            (
                f"{url} did not return "
                "valid JSON."
            )
        ) from error


    if not isinstance(
        payload,
        dict,
    ):
        raise RuntimeError(
            (
                f"{url} returned a "
                "non-object JSON response."
            )
        )


    return (
        status_code,
        payload,
    )


# ============================================================
# SERVICE READINESS
# ============================================================

def wait_for_readiness(
    base_url: str,
    *,
    timeout_seconds: float,
) -> None:

    deadline = (
        time.monotonic()
        +
        timeout_seconds
    )


    last_error: str | None = (
        None
    )


    while (
        time.monotonic()
        <
        deadline
    ):

        try:

            status_code, payload = (
                fetch_json(
                    base_url,
                    "/ready",
                    timeout_seconds=5.0,
                )
            )


            if (
                status_code == 200
                and
                payload.get(
                    "status"
                )
                == "ready"
                and
                payload.get(
                    "models_loaded"
                )
                is True
            ):
                pass_message(
                    (
                        "Inference service "
                        "is ready."
                    )
                )

                return


            last_error = (
                "Readiness response: "
                f"HTTP {status_code} "
                f"{payload}"
            )


        except RuntimeError as error:

            last_error = str(
                error
            )


        time.sleep(
            1.0
        )


    fail(
        (
            "Inference service did not "
            "become ready within "
            f"{timeout_seconds:.0f}s. "
            f"Last result: {last_error}"
        )
    )


# ============================================================
# SERVICE CONTRACT
# ============================================================

def verify_service_contract(
    base_url: str,
) -> None:

    section(
        "SERVICE CONTRACT"
    )


    status_code, live = (
        fetch_json(
            base_url,
            "/live",
        )
    )


    if (
        status_code != 200
        or
        live.get(
            "status"
        )
        != "alive"
    ):
        fail(
            (
                "/live contract failed: "
                f"HTTP {status_code} "
                f"{live}"
            )
        )


    pass_message(
        "/live"
    )


    status_code, ready = (
        fetch_json(
            base_url,
            "/ready",
        )
    )


    if (
        status_code != 200
        or
        ready.get(
            "status"
        )
        != "ready"
        or
        ready.get(
            "models_loaded"
        )
        is not True
        or
        ready.get(
            "model_version"
        )
        != "v2-frozen"
    ):
        fail(
            (
                "/ready contract failed: "
                f"HTTP {status_code} "
                f"{ready}"
            )
        )


    pass_message(
        "/ready"
    )


    status_code, health = (
        fetch_json(
            base_url,
            "/health",
        )
    )


    if (
        status_code != 200
        or
        health.get(
            "status"
        )
        != "healthy"
        or
        health.get(
            "models_loaded"
        )
        is not True
    ):
        fail(
            (
                "/health contract failed: "
                f"HTTP {status_code} "
                f"{health}"
            )
        )


    pass_message(
        "/health"
    )


# ============================================================
# DOCKER
# ============================================================

def run_docker_command(
    arguments: list[
        str
    ],
) -> str:

    result = subprocess.run(
        [
            "docker",
            *arguments,
        ],

        cwd=(
            REPOSITORY_ROOT
        ),

        capture_output=True,

        text=True,

        check=False,
    )


    if (
        result.returncode
        != 0
    ):
        raise RuntimeError(
            (
                result.stderr.strip()
                or
                result.stdout.strip()
                or
                "Docker command failed."
            )
        )


    return (
        result.stdout
        .strip()
    )


def verify_docker(
    container_name: str,
) -> None:

    section(
        "DOCKER RUNTIME"
    )


    if (
        shutil.which(
            "docker"
        )
        is None
    ):
        fail(
            (
                "Docker executable was "
                "not found."
            )
        )


    try:

        running_state = (
            run_docker_command(
                [
                    "inspect",
                    "--format",
                    "{{.State.Running}}",
                    container_name,
                ]
            )
        )


    except RuntimeError as error:

        fail(
            (
                "Unable to inspect Docker "
                f"container: {error}"
            )
        )


    if (
        running_state.lower()
        != "true"
    ):
        fail(
            (
                f"Container {container_name!r} "
                "is not running."
            )
        )


    pass_message(
        (
            f"Container {container_name!r} "
            "is running."
        )
    )


    health_state = (
        run_docker_command(
            [
                "inspect",
                "--format",
                "{{if .State.Health}}"
                "{{.State.Health.Status}}"
                "{{else}}none{{end}}",
                container_name,
            ]
        )
    )


    if (
        health_state
        != "healthy"
    ):
        fail(
            (
                "Docker health state is "
                f"{health_state!r}, "
                "expected 'healthy'."
            )
        )


    pass_message(
        "Docker health = healthy"
    )


# ============================================================
# SUBPROCESS
# ============================================================

def run_command(
    title: str,
    command: list[
        str
    ],
    *,
    environment: dict[
        str,
        str,
    ] | None = None,
) -> None:

    section(
        title
    )


    print(
        " ".join(
            command
        )
    )


    result = subprocess.run(
        command,

        cwd=(
            REPOSITORY_ROOT
        ),

        env=environment,

        check=False,
    )


    if (
        result.returncode
        != 0
    ):
        fail(
            (
                f"{title} failed with "
                f"exit code "
                f"{result.returncode}."
            )
        )


    pass_message(
        title
    )


# ============================================================
# PYTEST
# ============================================================

def run_full_test_suite(
    base_url: str,
) -> None:

    environment = (
        os.environ.copy()
    )


    environment[
        "INFERENCE_BASE_URL"
    ] = base_url


    run_command(
        "FULL INFERENCE TEST SUITE",

        [
            sys.executable,
            "-m",
            "pytest",
            str(
                TEST_DIRECTORY
            ),
            "-v",
        ],

        environment=(
            environment
        ),
    )


# ============================================================
# FROZEN MODEL SMOKE TEST
# ============================================================

def run_smoke_test(
    base_url: str,
) -> None:

    run_command(
        "FROZEN MODEL SMOKE TEST",

        [
            sys.executable,
            str(
                SMOKE_TEST_PATH
            ),
            "--base-url",
            base_url,
        ],
    )


# ============================================================
# MAIN
# ============================================================

def main() -> None:

    parser = (
        argparse.ArgumentParser(
            description=(
                "Run the automated microscope "
                "production regression suite."
            )
        )
    )


    parser.add_argument(
        "--base-url",

        default=(
            "http://127.0.0.1:8000"
        ),
    )


    parser.add_argument(
        "--container",

        default=(
            "microscope-inference"
        ),
    )


    parser.add_argument(
        "--readiness-timeout",

        type=float,

        default=(
            90.0
        ),
    )


    arguments = (
        parser.parse_args()
    )


    base_url = (
        arguments.base_url
        .rstrip("/")
    )


    section(
        "AUTOMATED MICROSCOPE PRODUCTION REGRESSION"
    )


    print(
        f"Base URL: {base_url}"
    )


    print(
        (
            "Container: "
            f"{arguments.container}"
        )
    )


    verify_docker(
        arguments.container
    )


    section(
        "WAIT FOR READINESS"
    )


    wait_for_readiness(
        base_url,

        timeout_seconds=(
            arguments
            .readiness_timeout
        ),
    )


    verify_service_contract(
        base_url
    )


    run_full_test_suite(
        base_url
    )


    run_smoke_test(
        base_url
    )


    section(
        "PRODUCTION REGRESSION RESULT"
    )


    print(
        "PRODUCTION REGRESSION PASS"
    )


    print(
        (
            "Research-only frozen V2 "
            "inference service passed "
            "runtime, API, security and "
            "known-positive regression checks."
        )
    )


if __name__ == "__main__":
    main()