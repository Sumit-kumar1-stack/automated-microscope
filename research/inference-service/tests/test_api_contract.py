from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import pytest
import requests


# ============================================================
# CONFIGURATION
# ============================================================

BASE_URL = os.environ.get(
    "INFERENCE_BASE_URL",
    "http://127.0.0.1:8000",
).rstrip("/")


KNOWN_POSITIVE_IMAGE = Path(
    os.environ.get(
        "INFERENCE_TEST_IMAGE",
        (
            "research/"
            "malaria-validation/"
            "data/"
            "yolo-binary-full/"
            "images/"
            "val/"
            "005e60b6-77b8-458c-b57c-bfe0c7e7df78.png"
        ),
    )
)


REQUEST_TIMEOUT_SECONDS = float(
    os.environ.get(
        "INFERENCE_TEST_TIMEOUT_SECONDS",
        "30",
    )
)


# ============================================================
# HELPERS
# ============================================================

def get_json(
    path: str,
) -> tuple[
    requests.Response,
    dict[str, Any],
]:
    response = requests.get(
        f"{BASE_URL}{path}",
        timeout=REQUEST_TIMEOUT_SECONDS,
    )

    response.raise_for_status()

    data = response.json()

    assert isinstance(
        data,
        dict,
    )

    return response, data


def assert_research_only(
    data: dict[str, Any],
) -> None:
    assert data.get(
        "research_only"
    ) is True


def assert_not_clinically_validated(
    data: dict[str, Any],
) -> None:
    """
    Different service endpoints may use either
    clinically_validated or clinical_validation.

    Both represent the same research-safety
    assertion for this prototype.
    """

    if "clinically_validated" in data:
        assert (
            data["clinically_validated"]
            is False
        )

        return


    if "clinical_validation" in data:
        assert (
            data["clinical_validation"]
            is False
        )

        return


    pytest.fail(
        "Response does not expose a clinical-validation safety flag."
    )


# ============================================================
# SESSION PRECONDITION
# ============================================================

@pytest.fixture(
    scope="session",
    autouse=True,
)
def inference_service_available() -> None:
    """
    Fail immediately with a useful message when
    the inference service is not running.
    """

    try:
        response = requests.get(
            f"{BASE_URL}/health",
            timeout=5,
        )
    except requests.RequestException as error:
        pytest.fail(
            (
                "Inference service is unavailable at "
                f"{BASE_URL}. Start Docker/FastAPI "
                f"before running integration tests. "
                f"Original error: {error}"
            ),
            pytrace=False,
        )


    if response.status_code != 200:
        pytest.fail(
            (
                "Inference service health endpoint "
                f"returned HTTP {response.status_code}."
            ),
            pytrace=False,
        )


# ============================================================
# TEST 1
# HEALTH CONTRACT
# ============================================================

def test_health_contract() -> None:
    response, data = get_json(
        "/health"
    )


    assert response.status_code == 200

    assert (
        data.get("status")
        == "healthy"
    )

    assert (
        data.get("models_loaded")
        is True
    )


    assert_research_only(
        data
    )


    assert_not_clinically_validated(
        data
    )


# ============================================================
# TEST 2
# MODEL INFORMATION CONTRACT
# ============================================================

def test_model_info_contract() -> None:
    response, data = get_json(
        "/model-info"
    )


    assert response.status_code == 200


    assert (
        data.get("status")
        == "experimental"
    )


    assert_research_only(
        data
    )


    assert_not_clinically_validated(
        data
    )


    detector = data.get(
        "detector"
    )

    classifier = data.get(
        "classifier"
    )


    assert isinstance(
        detector,
        dict,
    )

    assert isinstance(
        classifier,
        dict,
    )


    assert (
        detector.get("name")
        == "binary-parasite-detector-v2"
    )


    assert (
        classifier.get("name")
        == "stage-classifier-v2"
    )


    assert (
        classifier.get("architecture")
        == "MobileNetV3-Small"
    )


    classes = classifier.get(
        "classes"
    )


    assert isinstance(
        classes,
        list,
    )


    assert set(
        classes
    ) == {
        "ring",
        "trophozoite",
        "schizont",
        "gametocyte",
    }


    validation = data.get(
        "validation"
    )


    assert isinstance(
        validation,
        dict,
    )


    assert "development" in validation

    assert "external" in validation


# ============================================================
# TEST 3
# MISSING UPLOAD MUST BE REJECTED
# ============================================================

def test_infer_rejects_missing_file() -> None:
    response = requests.post(
        f"{BASE_URL}/infer",
        timeout=REQUEST_TIMEOUT_SECONDS,
    )


    # FastAPI required UploadFile validation.
    assert (
        response.status_code
        == 422
    )


    body = response.json()


    assert isinstance(
        body,
        dict,
    )

    assert "detail" in body


# ============================================================
# TEST 4
# MALFORMED IMAGE MUST NOT CAUSE SERVER 500
# ============================================================

def test_infer_rejects_invalid_image() -> None:
    response = requests.post(
        f"{BASE_URL}/infer",
        files={
            "file": (
                "invalid.png",
                b"this-is-not-a-real-image",
                "image/png",
            ),
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )


    """
    The exact client-error status can evolve
    as API validation is hardened.

    What must NEVER happen for malformed
    user input is an unhandled 5xx response.
    """

    assert (
        400
        <= response.status_code
        < 500
    )


# ============================================================
# TEST 5
# KNOWN-POSITIVE FROZEN MODEL REGRESSION
# ============================================================

def test_known_positive_frozen_v2_regression() -> None:
    if not KNOWN_POSITIVE_IMAGE.exists():
        pytest.skip(
            (
                "Known-positive BBBC041 image "
                f"is not available: {KNOWN_POSITIVE_IMAGE}"
            )
        )


    with KNOWN_POSITIVE_IMAGE.open(
        "rb"
    ) as image_file:
        response = requests.post(
            f"{BASE_URL}/infer",
            files={
                "file": (
                    KNOWN_POSITIVE_IMAGE.name,
                    image_file,
                    "image/png",
                ),
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )


    assert (
        response.status_code
        == 200
    )


    data = response.json()


    assert isinstance(
        data,
        dict,
    )


    # --------------------------------------------------------
    # Research safety contract
    # --------------------------------------------------------

    assert (
        data.get("status")
        == "complete"
    )


    assert_research_only(
        data
    )


    assert_not_clinically_validated(
        data
    )


    assert (
        data.get("analysis_type")
        == (
            "experimental parasite "
            "candidate detection"
        )
    )


    assert (
        data.get("model_version")
        == "v2-frozen"
    )


    # --------------------------------------------------------
    # Image contract
    # --------------------------------------------------------

    image = data.get(
        "image"
    )


    assert isinstance(
        image,
        dict,
    )


    assert (
        image.get("filename")
        == KNOWN_POSITIVE_IMAGE.name
    )


    assert (
        image.get("width")
        == 1600
    )


    assert (
        image.get("height")
        == 1200
    )


    # --------------------------------------------------------
    # Candidate contract
    # --------------------------------------------------------

    candidates = data.get(
        "candidates"
    )


    assert isinstance(
        candidates,
        list,
    )


    assert (
        data.get("candidate_count")
        == len(candidates)
    )


    assert (
        len(candidates)
        == 2
    )


    stages = {
        candidate.get(
            "stage"
        )
        for candidate in candidates
    }


    assert "ring" in stages

    assert "trophozoite" in stages


    # --------------------------------------------------------
    # Candidate schema validation
    # --------------------------------------------------------

    for candidate in candidates:
        assert isinstance(
            candidate,
            dict,
        )


        candidate_id = candidate.get(
            "candidate_id"
        )

        assert isinstance(
            candidate_id,
            int,
        )


        detector_confidence = (
            candidate.get(
                "detector_confidence"
            )
        )

        stage_confidence = (
            candidate.get(
                "stage_confidence"
            )
        )


        assert isinstance(
            detector_confidence,
            (int, float),
        )

        assert isinstance(
            stage_confidence,
            (int, float),
        )


        assert (
            0.0
            <= detector_confidence
            <= 1.0
        )

        assert (
            0.0
            <= stage_confidence
            <= 1.0
        )


        bbox = candidate.get(
            "bbox"
        )


        assert isinstance(
            bbox,
            dict,
        )


        x1 = bbox.get("x1")
        y1 = bbox.get("y1")
        x2 = bbox.get("x2")
        y2 = bbox.get("y2")


        for coordinate in (
            x1,
            y1,
            x2,
            y2,
        ):
            assert isinstance(
                coordinate,
                (int, float),
            )


        assert 0 <= x1 < x2 <= 1600
        assert 0 <= y1 < y2 <= 1200


    # --------------------------------------------------------
    # Timing contract
    # --------------------------------------------------------

    timing = data.get(
        "timing_ms"
    )


    assert isinstance(
        timing,
        dict,
    )


    inference_ms = timing.get(
        "inference"
    )

    total_ms = timing.get(
        "total"
    )


    assert isinstance(
        inference_ms,
        (int, float),
    )

    assert isinstance(
        total_ms,
        (int, float),
    )


    assert inference_ms > 0

    assert total_ms > 0

    assert (
        total_ms
        >= inference_ms
    )


# ============================================================
# TEST 6
# FROZEN CONFIGURATION CONTRACT
# ============================================================

def test_known_positive_uses_frozen_configuration() -> None:
    if not KNOWN_POSITIVE_IMAGE.exists():
        pytest.skip(
            "Known-positive BBBC041 image is unavailable."
        )


    with KNOWN_POSITIVE_IMAGE.open(
        "rb"
    ) as image_file:
        response = requests.post(
            f"{BASE_URL}/infer",
            files={
                "file": (
                    KNOWN_POSITIVE_IMAGE.name,
                    image_file,
                    "image/png",
                ),
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )


    assert response.status_code == 200


    data = response.json()


    configuration = data.get(
        "configuration"
    )


    assert isinstance(
        configuration,
        dict,
    )


    assert (
        configuration.get(
            "detector_confidence"
        )
        == pytest.approx(
            0.25
        )
    )


    assert (
        configuration.get(
            "detector_image_size"
        )
        == 512
    )


    assert (
        configuration.get(
            "classifier_image_size"
        )
        == 160
    )


    assert (
        configuration.get(
            "context_scale"
        )
        == pytest.approx(
            1.8
        )
    )

# ============================================================
# LIVENESS CONTRACT
# ============================================================

def test_liveness_contract() -> None:
    response = requests.get(
        f"{BASE_URL}/live",
        timeout=REQUEST_TIMEOUT_SECONDS,
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
        "alive"
    )


    assert (
        payload[
            "service"
        ]
        ==
        "microscope-inference"
    )


    assert (
        payload[
            "research_only"
        ]
        is True
    )


    assert (
        payload[
            "clinically_validated"
        ]
        is False
    )


# ============================================================
# READINESS CONTRACT
# ============================================================

def test_readiness_contract() -> None:
    response = requests.get(
        f"{BASE_URL}/ready",
        timeout=REQUEST_TIMEOUT_SECONDS,
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


    assert (
        payload[
            "research_only"
        ]
        is True
    )


    assert (
        payload[
            "clinically_validated"
        ]
        is False
    )