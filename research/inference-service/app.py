from __future__ import annotations

import io
import threading
import time

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from config import (
    load_runtime_config,
)
from uuid import uuid4

import torch

from fastapi import (
    FastAPI,
    File,
    HTTPException,
    Request,
    UploadFile,
)

from security import (
    UploadSecurityError,
    validate_content_type,
    validate_image_dimensions,
    validate_image_format,
)


from fastapi.middleware.cors import (
    CORSMiddleware,
)

from PIL import (
    Image,
    UnidentifiedImageError,
)

from observability import (
    configure_service_logger,
    log_info,
    log_warning,
)

# ============================================================
# PRESERVE ORIGINAL PIL IMAGE DECODER
# ============================================================
#
# Ultralytics monkey-patches PIL.Image.open() when imported.
# Its wrapper may attempt runtime dependency installation for
# formats such as HEIF. User-upload validation must not trigger
# package installation or other Ultralytics side effects.
#
# Preserve Pillow's original decoder before importing YOLO.
# ============================================================

PIL_IMAGE_OPEN = (
    Image.open
)


from torch import nn

from torchvision import transforms

from torchvision.models import (
    MobileNet_V3_Small_Weights,
    mobilenet_v3_small,
)

from ultralytics import YOLO

# ============================================================
# VALIDATED RUNTIME CONFIGURATION
# ============================================================

RUNTIME_CONFIG = (
    load_runtime_config()
)


# ============================================================
# STRUCTURED SERVICE LOGGER
# ============================================================

LOGGER = (
    configure_service_logger(
        "microscope-inference",
        level=(
            RUNTIME_CONFIG
            .log_level
        ),
        service_name=(
            "microscope-inference"
        ),
    )
)


# ============================================================
# REPOSITORY PATHS
# ============================================================

THIS_FILE = Path(
    __file__
).resolve()


REPOSITORY_ROOT = (
    THIS_FILE.parents[2]
)


FROZEN_MODEL_DIR = (
    REPOSITORY_ROOT
    / "research"
    / "malaria-validation"
    / "outputs"
    / "frozen-models"
)


DETECTOR_PATH = (
    FROZEN_MODEL_DIR
    / "binary-parasite-detector-v2.pt"
)


CLASSIFIER_PATH = (
    FROZEN_MODEL_DIR
    / "stage-classifier-v2.pt"
)


# ============================================================
# FROZEN MODEL CONFIGURATION
# ============================================================

MODEL_VERSION = (
    "v2-frozen"
)


ANALYSIS_TYPE = (
    "experimental parasite candidate detection"
)


DETECTOR_CONFIDENCE = (
    0.25
)


DETECTOR_IMAGE_SIZE = (
    512
)


CLASSIFIER_IMAGE_SIZE = (
    160
)


CONTEXT_SCALE = (
    1.8
)


MIN_CROP_SIDE = (
    24
)


MAX_UPLOAD_BYTES = (
    RUNTIME_CONFIG
    .max_upload_bytes
)


CLASS_NAMES = (
    "ring",
    "trophozoite",
    "schizont",
    "gametocyte",
)


# ============================================================
# VALIDATION METADATA
# ============================================================

DEVELOPMENT_VALIDATION = {
    "detector_precision":
        0.8098068350668648,

    "detector_recall":
        0.9300341296928327,

    "detector_f1":
        0.8657664813343924,

    "end_to_end_macro_f1":
        0.6998029897364362,
}


EXTERNAL_VALIDATION = {
    "benchmark":
        "BBBC041 official frozen test",

    "images":
        120,

    "ground_truth_objects":
        303,

    "detector_precision":
        0.898989898989899,

    "detector_recall":
        0.29372937293729373,

    "detector_f1":
        0.44278606965174133,

    "end_to_end_macro_f1":
        0.1606483847158349,
}


# ============================================================
# GLOBAL MODEL STATE
# ============================================================

DETECTOR: Any | None = (
    None
)


CLASSIFIER: nn.Module | None = (
    None
)


CLASSIFIER_TRANSFORM: Any | None = (
    None
)


MODEL_LOCK = (
    threading.Lock()
)


# ============================================================
# CLASSIFIER LOADING
# ============================================================

def load_classifier() -> tuple[
    nn.Module,
    Any,
]:
    """
    Load the frozen MobileNetV3-Small
    parasite-stage classifier.
    """

    weights = (
        MobileNet_V3_Small_Weights.DEFAULT
    )


    model = (
        mobilenet_v3_small(
            weights=None
        )
    )


    input_features = (
        model.classifier[
            3
        ].in_features
    )


    model.classifier[
        3
    ] = nn.Linear(
        input_features,
        len(
            CLASS_NAMES
        ),
    )


    checkpoint = torch.load(
        CLASSIFIER_PATH,
        map_location="cpu",
        weights_only=False,
    )


    if (
        not isinstance(
            checkpoint,
            dict,
        )
    ):
        raise RuntimeError(
            (
                "Stage classifier checkpoint "
                "must be a dictionary."
            )
        )


    if (
        "model_state_dict"
        not in checkpoint
    ):
        raise RuntimeError(
            (
                "Stage classifier checkpoint "
                "does not contain "
                "'model_state_dict'."
            )
        )


    model.load_state_dict(
        checkpoint[
            "model_state_dict"
        ]
    )


    model.eval()


    transform = transforms.Compose(
        [
            transforms.Resize(
                (
                    CLASSIFIER_IMAGE_SIZE,
                    CLASSIFIER_IMAGE_SIZE,
                )
            ),

            transforms.ToTensor(),

            transforms.Normalize(
                mean=(
                    weights
                    .transforms()
                    .mean
                ),

                std=(
                    weights
                    .transforms()
                    .std
                ),
            ),
        ]
    )


    return (
        model,
        transform,
    )


# ============================================================
# LOAD FROZEN MODELS
# ============================================================

def load_models() -> None:
    """
    Load both frozen V2 models once
    during application startup.
    """

    global DETECTOR
    global CLASSIFIER
    global CLASSIFIER_TRANSFORM


    if (
        not DETECTOR_PATH.is_file()
    ):
        raise FileNotFoundError(
            (
                "Frozen detector model "
                f"not found: {DETECTOR_PATH}"
            )
        )


    if (
        not CLASSIFIER_PATH.is_file()
    ):
        raise FileNotFoundError(
            (
                "Frozen classifier model "
                f"not found: {CLASSIFIER_PATH}"
            )
        )


    log_info(
        LOGGER,
        "model.detector.loading",
        "Loading frozen detector",

        model=(
            "binary-parasite-detector-v2"
        ),
    )


    detector = YOLO(
        str(
            DETECTOR_PATH
        )
    )


    log_info(
        LOGGER,
        "model.classifier.loading",
        "Loading frozen classifier",

        model=(
            "stage-classifier-v2"
        ),
    )


    (
        classifier,
        classifier_transform,
    ) = load_classifier()


    DETECTOR = detector

    CLASSIFIER = (
        classifier
    )

    CLASSIFIER_TRANSFORM = (
        classifier_transform
    )


    log_info(
        LOGGER,
        "model.bundle.loaded",
        "Frozen inference models loaded",

        model_version=(
            MODEL_VERSION
        ),

        detector_confidence=(
            DETECTOR_CONFIDENCE
        ),

        detector_image_size=(
            DETECTOR_IMAGE_SIZE
        ),

        classifier_image_size=(
            CLASSIFIER_IMAGE_SIZE
        ),

        context_scale=(
            CONTEXT_SCALE
        ),
    )


# ============================================================
# APPLICATION LIFESPAN
# ============================================================

@asynccontextmanager
async def lifespan(
    _app: FastAPI,
):
    log_info(
        LOGGER,
        "service.startup",
        "Inference service starting",

        **RUNTIME_CONFIG.safe_summary(),
    )


    load_models()


    log_info(
        LOGGER,
        "service.ready",
        "Inference service ready",

        model_version=(
            MODEL_VERSION
        ),

        detector=(
            "binary-parasite-detector-v2"
        ),

        classifier=(
            "stage-classifier-v2"
        ),
    )


    try:
        yield


    finally:
        log_info(
            LOGGER,
            "service.shutdown",
            "Inference service shutting down",
        )

# ============================================================
# REQUEST CORRELATION
# ============================================================

REQUEST_ID_HEADER = (
    "X-Request-ID"
)


MAX_REQUEST_ID_LENGTH = (
    128
)


def create_request_id() -> str:
    return uuid4().hex


def normalize_request_id(
    value: str | None,
) -> str:
    """
    Accept a safe upstream correlation ID
    when present; otherwise create one.

    Arbitrary header content is not trusted
    directly for operational logs.
    """

    if value is None:
        return create_request_id()


    candidate = (
        value.strip()
    )


    if (
        not candidate
        or
        len(
            candidate
        )
        >
        MAX_REQUEST_ID_LENGTH
    ):
        return create_request_id()


    allowed = set(
        "abcdefghijklmnopqrstuvwxyz"
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "0123456789"
        "-_."
    )


    if any(
        character
        not in allowed
        for character
        in candidate
    ):
        return create_request_id()


    return candidate


def get_request_id(
    request: Request,
) -> str:
    value = getattr(
        request.state,
        "request_id",
        None,
    )


    if isinstance(
        value,
        str,
    ):
        return value


    return create_request_id()

# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title=(
        "Automated Microscope "
        "Research Inference Service"
    ),

    description=(
        "Research-only frozen V2 "
        "parasite candidate detection "
        "and stage classification service."
    ),

    version=MODEL_VERSION,

    lifespan=lifespan,
)

# ============================================================
# HTTP OBSERVABILITY MIDDLEWARE
# ============================================================

@app.middleware(
    "http"
)
async def request_observability(
    request: Request,
    call_next,
):
    started_at = (
        time.perf_counter()
    )


    request_id = (
        normalize_request_id(
            request.headers.get(
                REQUEST_ID_HEADER
            )
        )
    )


    request.state.request_id = (
        request_id
    )


    try:
        response = await call_next(
            request
        )


    except Exception as error:
        duration_ms = (
            (
                time.perf_counter()
                -
                started_at
            )
            *
            1000.0
        )


        LOGGER.exception(
            "Unhandled HTTP request failure",

            extra={
                "event":
                    "http.request.failed",

                "context": {
                    "request_id":
                        request_id,

                    "method":
                        request.method,

                    "path":
                        request.url.path,

                    "duration_ms":
                        round(
                            duration_ms,
                            2,
                        ),

                    "error_type":
                        type(
                            error
                        ).__name__,
                },
            },
        )


        raise


    duration_ms = (
        (
            time.perf_counter()
            -
            started_at
        )
        *
        1000.0
    )


    response.headers[
        REQUEST_ID_HEADER
    ] = request_id


    log_info(
        LOGGER,
        "http.request.complete",
        "HTTP request completed",

        request_id=request_id,

        method=request.method,

        path=request.url.path,

        status_code=(
            response.status_code
        ),

        duration_ms=round(
            duration_ms,
            2,
        ),
    )


    return response


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=list(
        RUNTIME_CONFIG
        .cors_origins
    ),

    allow_credentials=True,

    allow_methods=[
        "GET",
        "POST",
        "OPTIONS",
    ],

    allow_headers=[
        "*",
    ],
)


# ============================================================
# MODEL READINESS
# ============================================================

def models_loaded() -> bool:
    return (
        DETECTOR is not None
        and
        CLASSIFIER is not None
        and
        CLASSIFIER_TRANSFORM is not None
    )


def require_models() -> tuple[
    Any,
    nn.Module,
    Any,
]:
    if (
        DETECTOR is None
        or
        CLASSIFIER is None
        or
        CLASSIFIER_TRANSFORM is None
    ):
        raise HTTPException(
            status_code=503,

            detail=(
                "Inference models are "
                "not ready."
            ),
        )


    return (
        DETECTOR,
        CLASSIFIER,
        CLASSIFIER_TRANSFORM,
    )


# ============================================================
# SAFE IMAGE DECODING
# ============================================================

def decode_uploaded_image(
    raw_bytes: bytes,
    *,
    request_id: str | None = None,
) -> Image.Image:
    """
    Decode uploaded bytes into a normalized
    RGB Pillow image.

    Invalid or malformed client data must
    result in HTTP 400 rather than HTTP 500.

    Pillow's original decoder is used directly
    so Ultralytics image-loading patches cannot
    trigger runtime dependency installation for
    malformed uploads.
    """

    if not raw_bytes:
        log_warning(
            LOGGER,
            "upload.empty_image",
            "Empty image upload rejected",

            request_id=request_id,
        )


        raise HTTPException(
            status_code=400,

            detail=(
                "Uploaded image is empty."
            ),
        )


    try:
        with PIL_IMAGE_OPEN(
            io.BytesIO(
                raw_bytes
            )
        ) as source_image:

            # Validate the actual decoded format and image
            # dimensions before fully decoding pixels.
            validate_image_format(
                source_image.format
            )

            validate_image_dimensions(
                source_image.width,
                source_image.height,
            )

            # Force Pillow to decode the actual pixel payload
            # while the BytesIO object remains open.
            source_image.load()


            image = (
                source_image
                .convert(
                    "RGB"
                )
            )


    except UploadSecurityError as error:

        log_warning(
            LOGGER,
            "upload.security_rejected",
            "Uploaded image rejected by security policy",

            request_id=request_id,

            status_code=(
                error.status_code
            ),
        )


        raise HTTPException(
            status_code=(
                error.status_code
            ),

            detail=str(
                error
            ),
        ) from error


    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
    ) as error:

        log_warning(
            LOGGER,
            "upload.invalid_image",
            "Malformed image upload rejected",

            request_id=request_id,

            error_type=(
                type(
                    error
                ).__name__
            ),
        )


        raise HTTPException(
            status_code=400,

            detail=(
                "Uploaded file is not a valid "
                "supported image."
            ),
        ) from error


    if (
        image.width <= 0
        or
        image.height <= 0
    ):
        log_warning(
            LOGGER,
            "upload.invalid_dimensions",
            "Image upload with invalid dimensions rejected",

            request_id=request_id,

            width=image.width,

            height=image.height,
        )


        raise HTTPException(
            status_code=400,

            detail=(
                "Uploaded image has "
                "invalid dimensions."
            ),
        )


    return image


# ============================================================
# CROP DETECTED REGION
# ============================================================

def predicted_box_crop(
    image: Image.Image,
    box: list[float],
) -> Image.Image:
    """
    Expand the detector bounding box by the
    frozen 1.8x context scale before sending
    it to the stage classifier.
    """

    image_width, image_height = (
        image.size
    )


    x1, y1, x2, y2 = (
        box
    )


    box_width = max(
        1.0,
        x2 - x1,
    )


    box_height = max(
        1.0,
        y2 - y1,
    )


    center_x = (
        x1 + x2
    ) / 2.0


    center_y = (
        y1 + y2
    ) / 2.0


    crop_side = (
        max(
            box_width,
            box_height,
        )
        * CONTEXT_SCALE
    )


    crop_side = max(
        crop_side,
        float(
            MIN_CROP_SIDE
        ),
    )


    crop_side = min(
        crop_side,
        float(
            image_width
        ),
        float(
            image_height
        ),
    )


    crop_side_int = max(
        1,
        int(
            round(
                crop_side
            )
        ),
    )


    left = int(
        round(
            center_x
            -
            crop_side_int
            / 2.0
        )
    )


    top = int(
        round(
            center_y
            -
            crop_side_int
            / 2.0
        )
    )


    left = max(
        0,
        min(
            left,
            image_width
            -
            crop_side_int,
        ),
    )


    top = max(
        0,
        min(
            top,
            image_height
            -
            crop_side_int,
        ),
    )


    right = (
        left
        +
        crop_side_int
    )


    bottom = (
        top
        +
        crop_side_int
    )


    return image.crop(
        (
            left,
            top,
            right,
            bottom,
        )
    )


# ============================================================
# CLASSIFY CROPS
# ============================================================

def classify_crops(
    model: nn.Module,
    transform: Any,
    crops: list[
        Image.Image
    ],
) -> list[
    tuple[
        int,
        float,
    ]
]:
    """
    Classify all detected parasite candidate
    crops in one batch.
    """

    if not crops:
        return []


    transformed = [
        transform(
            crop
        )
        for crop
        in crops
    ]


    batch = torch.stack(
        transformed,
        dim=0,
    )


    with torch.inference_mode():

        logits = model(
            batch
        )


        probabilities = (
            torch.softmax(
                logits,
                dim=1,
            )
        )


        (
            confidences,
            class_indexes,
        ) = probabilities.max(
            dim=1
        )


    results: list[
        tuple[
            int,
            float,
        ]
    ] = []


    for (
        class_index,
        confidence,
    ) in zip(
        class_indexes,
        confidences,
    ):

        results.append(
            (
                int(
                    class_index.item()
                ),

                float(
                    confidence.item()
                ),
            )
        )


    return results


# ============================================================
# FROZEN TWO-STAGE INFERENCE
# ============================================================

def run_inference(
    image: Image.Image,
) -> list[
    dict[
        str,
        Any,
    ]
]:
    """
    Run frozen detector V2 and then classify
    every detected candidate using the frozen
    MobileNetV3 stage classifier V2.
    """

    (
        detector,
        classifier,
        classifier_transform,
    ) = require_models()


    detector_results = (
        detector.predict(
            source=image,

            imgsz=(
                DETECTOR_IMAGE_SIZE
            ),

            conf=(
                DETECTOR_CONFIDENCE
            ),

            device="cpu",

            verbose=False,
        )
    )


    if not detector_results:
        return []


    result = (
        detector_results[
            0
        ]
    )


    if (
        result.boxes is None
        or
        len(
            result.boxes
        ) == 0
    ):
        return []


    boxes = (
        result.boxes
        .xyxy
        .cpu()
        .tolist()
    )


    detector_confidences = (
        result.boxes
        .conf
        .cpu()
        .tolist()
    )


    normalized_boxes: list[
        list[
            float
        ]
    ] = []


    for box in boxes:

        normalized_boxes.append(
            [
                float(
                    box[
                        0
                    ]
                ),

                float(
                    box[
                        1
                    ]
                ),

                float(
                    box[
                        2
                    ]
                ),

                float(
                    box[
                        3
                    ]
                ),
            ]
        )


    crops = [
        predicted_box_crop(
            image,
            box,
        )
        for box
        in normalized_boxes
    ]


    stage_results = (
        classify_crops(
            classifier,
            classifier_transform,
            crops,
        )
    )


    if (
        len(
            stage_results
        )
        !=
        len(
            normalized_boxes
        )
    ):
        raise RuntimeError(
            (
                "Classifier result count "
                "does not match detector "
                "candidate count."
            )
        )


    candidates: list[
        dict[
            str,
            Any,
        ]
    ] = []


    for candidate_index, (
        box,
        detector_confidence,
        stage_result,
    ) in enumerate(
        zip(
            normalized_boxes,
            detector_confidences,
            stage_results,
        ),
        start=1,
    ):

        (
            stage_index,
            stage_confidence,
        ) = stage_result


        if (
            stage_index < 0
            or
            stage_index
            >=
            len(
                CLASS_NAMES
            )
        ):
            raise RuntimeError(
                (
                    "Classifier returned "
                    "invalid stage index "
                    f"{stage_index}."
                )
            )


        candidates.append(
            {
                "candidate_id":
                    candidate_index,

                "bbox": {
                    "x1":
                        round(
                            box[
                                0
                            ],
                            2,
                        ),

                    "y1":
                        round(
                            box[
                                1
                            ],
                            2,
                        ),

                    "x2":
                        round(
                            box[
                                2
                            ],
                            2,
                        ),

                    "y2":
                        round(
                            box[
                                3
                            ],
                            2,
                        ),
                },

                "detector_confidence":
                    round(
                        float(
                            detector_confidence
                        ),
                        6,
                    ),

                "stage":
                    CLASS_NAMES[
                        stage_index
                    ],

                "stage_confidence":
                    round(
                        float(
                            stage_confidence
                        ),
                        6,
                    ),
            }
        )


    return candidates


# ============================================================
# HEALTH ENDPOINT
# ============================================================

@app.get(
    "/health"
)
async def health() -> dict[
    str,
    Any,
]:
    """
    Backward-compatible overall service
    health endpoint.
    """

    ready_state = (
        models_loaded()
    )


    return {
        "status":
            (
                "healthy"
                if ready_state
                else
                "degraded"
            ),

        "service":
            "microscope-inference",

        "research_only":
            True,

        "clinical_validation":
            False,

        "models_loaded":
            ready_state,

        "ready":
            ready_state,

        "model_version":
            (
                MODEL_VERSION
                if ready_state
                else None
            ),
    }


# ============================================================
# LIVENESS ENDPOINT
# ============================================================

@app.get(
    "/live"
)
async def live() -> dict[
    str,
    Any,
]:
    """
    Process liveness probe.

    A successful response means the API process
    is running; it does not guarantee that the
    frozen ML models are ready.
    """

    return {
        "status":
            "alive",

        "service":
            "microscope-inference",

        "research_only":
            True,

        "clinically_validated":
            False,
    }


# ============================================================
# READINESS ENDPOINT
# ============================================================

@app.get(
    "/ready"
)
async def ready() -> dict[
    str,
    Any,
]:
    """
    Dependency/readiness probe. HTTP 200 means
    the frozen models are loaded and inference
    can be served.
    """

    if not models_loaded():
        raise HTTPException(
            status_code=503,

            detail=(
                "Inference service is not ready: "
                "frozen models are unavailable."
            ),
        )


    return {
        "status":
            "ready",

        "service":
            "microscope-inference",

        "research_only":
            True,

        "clinically_validated":
            False,

        "models_loaded":
            True,

        "model_version":
            MODEL_VERSION,
    }


# ============================================================
# MODEL INFORMATION ENDPOINT
# ============================================================

@app.get(
    "/model-info"
)
async def model_info() -> dict[
    str,
    Any,
]:
    """
    Expose frozen model identity,
    configuration and validation metadata.
    """

    return {
        "status":
            "experimental",

        "research_only":
            True,

        "clinically_validated":
            False,

        "detector": {
            "name":
                "binary-parasite-detector-v2",

            "confidence_threshold":
                DETECTOR_CONFIDENCE,

            "image_size":
                DETECTOR_IMAGE_SIZE,
        },

        "classifier": {
            "name":
                "stage-classifier-v2",

            "architecture":
                "MobileNetV3-Small",

            "image_size":
                CLASSIFIER_IMAGE_SIZE,

            "classes":
                list(
                    CLASS_NAMES
                ),
        },

        "crop_context_scale":
            CONTEXT_SCALE,

        "validation": {
            "development":
                DEVELOPMENT_VALIDATION,

            "external":
                EXTERNAL_VALIDATION,
        },
    }


# ============================================================
# INFERENCE ENDPOINT
# ============================================================

@app.post(
    "/infer"
)
async def infer(
    request: Request,

    file: UploadFile = File(
        ...
    ),
) -> dict[
    str,
    Any,
]:
    """
    Perform research-only frozen V2
    inference on one uploaded image.
    """

    total_started_at = (
        time.perf_counter()
    )


    request_id = (
        get_request_id(
            request
        )
    )


    filename = (
        file.filename
        or
        "uploaded-image"
    )


    try:

        # ----------------------------------------------------
        # Ensure the models are ready.
        # ----------------------------------------------------

        require_models()


        # ----------------------------------------------------
        # Validate the declared multipart media type before
        # reading/decoding the upload. Actual decoded image
        # validation still happens below, so MIME is not trusted
        # as the only security boundary.
        # ----------------------------------------------------

        try:
            validate_content_type(
                file.content_type
            )

        except UploadSecurityError as error:

            log_warning(
                LOGGER,
                "upload.content_type_rejected",
                "Upload content type rejected",

                request_id=request_id,

                status_code=(
                    error.status_code
                ),

                content_type=(
                    file.content_type
                ),
            )


            raise HTTPException(
                status_code=(
                    error.status_code
                ),

                detail=str(
                    error
                ),
            ) from error


        # ----------------------------------------------------
        # Read only up to the configured limit + 1 byte.
        # This avoids loading arbitrarily large uploads.
        # ----------------------------------------------------

        raw_bytes = await file.read(
            MAX_UPLOAD_BYTES
            + 1
        )


        if (
            len(
                raw_bytes
            )
            >
            MAX_UPLOAD_BYTES
        ):
            log_warning(
                LOGGER,
                "upload.too_large",
                (
                    "Image upload rejected because "
                    "it exceeded the configured limit"
                ),

                request_id=request_id,

                received_bytes=(
                    len(
                        raw_bytes
                    )
                ),

                maximum_bytes=(
                    MAX_UPLOAD_BYTES
                ),
            )


            raise HTTPException(
                status_code=413,

                detail=(
                    "Uploaded image exceeds "
                    f"the configured "
                    f"{RUNTIME_CONFIG.max_upload_mb} MB "
                    "size limit."
                ),
            )


        # ----------------------------------------------------
        # Decode and validate client input.
        # ----------------------------------------------------

        image = (
            decode_uploaded_image(
                raw_bytes,
                request_id=request_id,
            )
        )


        image_width = (
            image.width
        )


        image_height = (
            image.height
        )


        # ----------------------------------------------------
        # Run frozen V2 inference.
        #
        # Execution is serialized because this research
        # service owns one CPU copy of each frozen model.
        # ----------------------------------------------------

        inference_started_at = (
            time.perf_counter()
        )


        with MODEL_LOCK:

            candidates = (
                run_inference(
                    image
                )
            )


        inference_ms = (
            (
                time.perf_counter()
                -
                inference_started_at
            )
            *
            1000.0
        )


        total_ms = (
            (
                time.perf_counter()
                -
                total_started_at
            )
            *
            1000.0
        )


        # ----------------------------------------------------
        # Structured inference telemetry.
        #
        # Filename/image bytes are intentionally not logged.
        # ----------------------------------------------------

        log_info(
            LOGGER,
            "inference.complete",
            "Microscopy inference completed",

            request_id=request_id,

            model_version=(
                MODEL_VERSION
            ),

            image_width=(
                image_width
            ),

            image_height=(
                image_height
            ),

            candidate_count=(
                len(
                    candidates
                )
            ),

            inference_ms=round(
                inference_ms,
                2,
            ),

            total_ms=round(
                total_ms,
                2,
            ),
        )


        # ----------------------------------------------------
        # API RESPONSE
        # ----------------------------------------------------

        return {
            "status":
                "complete",

            "analysis_type":
                ANALYSIS_TYPE,

            "research_only":
                True,

            "clinically_validated":
                False,

            "model_version":
                MODEL_VERSION,

            "image": {
                "filename":
                    filename,

                "width":
                    image_width,

                "height":
                    image_height,
            },

            "configuration": {
                "detector_confidence":
                    DETECTOR_CONFIDENCE,

                "detector_image_size":
                    DETECTOR_IMAGE_SIZE,

                "classifier_image_size":
                    CLASSIFIER_IMAGE_SIZE,

                "context_scale":
                    CONTEXT_SCALE,
            },

            "candidate_count":
                len(
                    candidates
                ),

            "candidates":
                candidates,

            "timing_ms": {
                "inference":
                    round(
                        inference_ms,
                        2,
                    ),

                "total":
                    round(
                        total_ms,
                        2,
                    ),
            },
        }


    # --------------------------------------------------------
    # Preserve deliberate API responses such as:
    #
    # 400 invalid image
    # 413 oversized upload
    # 503 models unavailable
    # --------------------------------------------------------

    except HTTPException:
        raise


    # --------------------------------------------------------
    # Unexpected server/model failure
    # --------------------------------------------------------

    except Exception as error:

        LOGGER.exception(
            "Unexpected inference service failure",

            extra={
                "event":
                    "inference.failed",

                "context": {
                    "request_id":
                        request_id,

                    "model_version":
                        MODEL_VERSION,

                    "error_type":
                        type(
                            error
                        ).__name__,
                },
            },
        )


        raise HTTPException(
            status_code=500,

            detail=(
                "Unexpected inference "
                "service failure."
            ),
        ) from error


    finally:

        await file.close()

