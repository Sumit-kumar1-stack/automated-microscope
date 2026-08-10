from __future__ import annotations

import csv
import json
import logging
from collections import Counter, defaultdict
from pathlib import Path

import torch
from PIL import Image
from torch import nn
from torchvision import transforms
from torchvision.models import (
    MobileNet_V3_Small_Weights,
    mobilenet_v3_small,
)
from ultralytics import YOLO


# ============================================================
# CONFIG
# ============================================================

ROOT = Path(
    "research/malaria-validation"
)

IMAGE_DIR = (
    ROOT
    / "data"
    / "yolo-parasite-official-test"
    / "images"
    / "test"
)

LABEL_DIR = (
    ROOT
    / "data"
    / "yolo-parasite-official-test"
    / "labels"
    / "test"
)

DETECTOR_PATH = (
    ROOT
    / "outputs"
    / "frozen-models"
    / "binary-parasite-detector-v2.pt"
)

CLASSIFIER_PATH = (
    ROOT
    / "outputs"
    / "frozen-models"
    / "stage-classifier-v2.pt"
)

OUTPUT_DIR = (
    ROOT
    / "outputs"
    / "two-stage-v2-official"
)

METRICS_PATH = (
    OUTPUT_DIR
    / "metrics.json"
)

CONFUSION_PATH = (
    OUTPUT_DIR
    / "end_to_end_confusion_matrix.csv"
)

ERRORS_PATH = (
    OUTPUT_DIR
    / "errors.json"
)


RUN_LOG_PATH = (
    OUTPUT_DIR
    / "evaluation.log"
)

ERROR_EVENT_LOG_PATH = (
    OUTPUT_DIR
    / "error_events.jsonl"
)

EXPECTED_TEST_IMAGES = 120
EXPECTED_GT_PARASITES = 303


DETECTOR_CONF = 0.25
MATCH_IOU = 0.50

DETECTOR_IMAGE_SIZE = 512
CLASSIFIER_IMAGE_SIZE = 160

CONTEXT_SCALE = 1.8
MIN_CROP_SIDE = 24


STAGE_CLASS_IDS = {
    0: 0,  # ring
    1: 1,  # trophozoite
    2: 2,  # schizont
    3: 3,  # gametocyte
}

CLASS_NAMES = (
    "ring",
    "trophozoite",
    "schizont",
    "gametocyte",
)

SUPPORTED_IMAGES = {
    ".png",
    ".jpg",
    ".jpeg",
}


# ============================================================
# LOGGING / PREFLIGHT
# ============================================================

LOGGER = logging.getLogger(
    "two_stage_v2_official"
)


def setup_logging() -> None:
    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    LOGGER.setLevel(
        logging.INFO
    )

    LOGGER.handlers.clear()

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(message)s"
    )

    file_handler = logging.FileHandler(
        RUN_LOG_PATH,
        mode="w",
        encoding="utf-8",
    )

    file_handler.setLevel(
        logging.INFO
    )

    file_handler.setFormatter(
        formatter
    )

    console_handler = logging.StreamHandler()

    # Keep the terminal readable:
    # detailed INFO goes to evaluation.log,
    # warnings/errors also appear in terminal.
    console_handler.setLevel(
        logging.WARNING
    )

    console_handler.setFormatter(
        formatter
    )

    LOGGER.addHandler(
        file_handler
    )

    LOGGER.addHandler(
        console_handler
    )

    LOGGER.propagate = False


def write_error_event(
    image_name: str,
    event: dict,
) -> None:
    record = {
        "image": image_name,
        **event,
    }

    with ERROR_EVENT_LOG_PATH.open(
        "a",
        encoding="utf-8",
    ) as file:
        file.write(
            json.dumps(
                record,
                ensure_ascii=False,
            )
            + "\n"
        )

    event_type = event.get(
        "type",
        "unknown",
    )

    if event_type == "wrong_stage":
        LOGGER.warning(
            "WRONG_STAGE | image=%s | true=%s | predicted=%s "
            "| classifier_conf=%.4f | detector_conf=%.4f | iou=%.4f",
            image_name,
            event.get("true"),
            event.get("predicted"),
            float(
                event.get(
                    "classifier_confidence",
                    0.0,
                )
            ),
            float(
                event.get(
                    "detector_confidence",
                    0.0,
                )
            ),
            float(
                event.get(
                    "iou",
                    0.0,
                )
            ),
        )

    elif event_type == "detector_miss":
        LOGGER.warning(
            "DETECTOR_MISS | image=%s | true=%s",
            image_name,
            event.get("true"),
        )

    elif event_type == "detector_false_positive":
        LOGGER.warning(
            "DETECTOR_FP | image=%s | predicted_stage=%s "
            "| classifier_conf=%.4f | detector_conf=%.4f",
            image_name,
            event.get("predicted"),
            float(
                event.get(
                    "classifier_confidence",
                    0.0,
                )
            ),
            float(
                event.get(
                    "detector_confidence",
                    0.0,
                )
            ),
        )

    else:
        LOGGER.warning(
            "EVALUATION_EVENT | image=%s | event=%s",
            image_name,
            record,
        )


def validate_official_dataset() -> dict:
    if not IMAGE_DIR.exists():
        raise FileNotFoundError(
            f"Official image directory missing: {IMAGE_DIR}"
        )

    if not LABEL_DIR.exists():
        raise FileNotFoundError(
            f"Official label directory missing: {LABEL_DIR}"
        )

    images = sorted(
        path
        for path in IMAGE_DIR.iterdir()
        if (
            path.is_file()
            and path.suffix.lower()
            in SUPPORTED_IMAGES
        )
    )

    labels = sorted(
        LABEL_DIR.glob("*.txt")
    )

    if len(images) != EXPECTED_TEST_IMAGES:
        raise RuntimeError(
            "Official image-count mismatch: "
            f"expected {EXPECTED_TEST_IMAGES}, "
            f"found {len(images)}"
        )

    if len(labels) != EXPECTED_TEST_IMAGES:
        raise RuntimeError(
            "Official label-count mismatch: "
            f"expected {EXPECTED_TEST_IMAGES}, "
            f"found {len(labels)}"
        )

    image_stems = {
        path.stem
        for path in images
    }

    label_stems = {
        path.stem
        for path in labels
    }

    missing_labels = sorted(
        image_stems
        - label_stems
    )

    missing_images = sorted(
        label_stems
        - image_stems
    )

    if missing_labels:
        raise RuntimeError(
            "Official images without labels: "
            f"{missing_labels[:10]}"
        )

    if missing_images:
        raise RuntimeError(
            "Official labels without images: "
            f"{missing_images[:10]}"
        )

    class_counts = Counter()
    object_count = 0

    for label_path in labels:
        for line_number, raw_line in enumerate(
            label_path.read_text(
                encoding="utf-8",
            ).splitlines(),
            start=1,
        ):
            line = raw_line.strip()

            if not line:
                continue

            parts = line.split()

            if len(parts) != 5:
                raise RuntimeError(
                    f"{label_path}:{line_number}: "
                    f"expected 5 YOLO fields, got {len(parts)}"
                )

            try:
                class_id = int(
                    float(
                        parts[0]
                    )
                )

                xc = float(
                    parts[1]
                )

                yc = float(
                    parts[2]
                )

                width = float(
                    parts[3]
                )

                height = float(
                    parts[4]
                )

            except ValueError as exc:
                raise RuntimeError(
                    f"{label_path}:{line_number}: "
                    "non-numeric YOLO annotation"
                ) from exc

            if class_id not in STAGE_CLASS_IDS:
                raise RuntimeError(
                    f"{label_path}:{line_number}: "
                    f"unexpected official class id {class_id}"
                )

            if not (
                0 <= xc <= 1
                and 0 <= yc <= 1
                and 0 < width <= 1
                and 0 < height <= 1
            ):
                raise RuntimeError(
                    f"{label_path}:{line_number}: "
                    "YOLO coordinates outside valid range"
                )

            class_counts[
                class_id
            ] += 1

            object_count += 1

    if object_count != EXPECTED_GT_PARASITES:
        raise RuntimeError(
            "Official ground-truth count mismatch: "
            f"expected {EXPECTED_GT_PARASITES}, "
            f"found {object_count}"
        )

    result = {
        "images":
            len(images),

        "labels":
            len(labels),

        "objects":
            object_count,

        "class_distribution":
            {
                CLASS_NAMES[
                    STAGE_CLASS_IDS[
                        class_id
                    ]
                ]:
                    class_counts[
                        class_id
                    ]
                for class_id in sorted(
                    STAGE_CLASS_IDS
                )
            },
    }

    LOGGER.info(
        "PREFLIGHT PASS | images=%d | labels=%d | objects=%d | classes=%s",
        result["images"],
        result["labels"],
        result["objects"],
        result["class_distribution"],
    )

    return result


# ============================================================
# GROUND TRUTH
# ============================================================

def read_stage_ground_truth(
    label_path: Path,
    image_width: int,
    image_height: int,
) -> list[dict]:
    objects: list[dict] = []

    lines = [
        line.strip()
        for line
        in label_path.read_text(
            encoding="utf-8",
        ).splitlines()
        if line.strip()
    ]

    for line in lines:
        parts = line.split()

        if len(parts) != 5:
            raise ValueError(
                f"Invalid label: {label_path}"
            )

        source_class = int(
            float(parts[0])
        )

        if (
            source_class
            not in STAGE_CLASS_IDS
        ):
            continue

        xc = float(parts[1])
        yc = float(parts[2])
        width = float(parts[3])
        height = float(parts[4])

        xc_px = (
            xc
            * image_width
        )

        yc_px = (
            yc
            * image_height
        )

        width_px = (
            width
            * image_width
        )

        height_px = (
            height
            * image_height
        )

        box = [
            xc_px
            - width_px / 2,

            yc_px
            - height_px / 2,

            xc_px
            + width_px / 2,

            yc_px
            + height_px / 2,
        ]

        objects.append(
            {
                "box": box,
                "class_index":
                    STAGE_CLASS_IDS[
                        source_class
                    ],
            }
        )

    return objects


# ============================================================
# BOX / MATCHING
# ============================================================

def box_iou(
    a: list[float],
    b: list[float],
) -> float:
    x1 = max(
        a[0],
        b[0],
    )

    y1 = max(
        a[1],
        b[1],
    )

    x2 = min(
        a[2],
        b[2],
    )

    y2 = min(
        a[3],
        b[3],
    )

    intersection_width = max(
        0.0,
        x2 - x1,
    )

    intersection_height = max(
        0.0,
        y2 - y1,
    )

    intersection = (
        intersection_width
        * intersection_height
    )

    area_a = max(
        0.0,
        a[2] - a[0],
    ) * max(
        0.0,
        a[3] - a[1],
    )

    area_b = max(
        0.0,
        b[2] - b[0],
    ) * max(
        0.0,
        b[3] - b[1],
    )

    union = (
        area_a
        + area_b
        - intersection
    )

    if union <= 0:
        return 0.0

    return (
        intersection
        / union
    )


def match_detections(
    ground_truth: list[dict],
    predictions: list[dict],
) -> tuple[
    list[tuple[int, int, float]],
    list[int],
    list[int],
]:
    matched_gt: set[int] = set()

    matches: list[
        tuple[
            int,
            int,
            float,
        ]
    ] = []

    unmatched_predictions: list[int] = []

    prediction_order = sorted(
        range(
            len(predictions)
        ),
        key=lambda index:
            predictions[index][
                "confidence"
            ],
        reverse=True,
    )

    for prediction_index in (
        prediction_order
    ):
        prediction = (
            predictions[
                prediction_index
            ]
        )

        best_iou = 0.0
        best_gt_index = None

        for gt_index, gt in enumerate(
            ground_truth
        ):
            if gt_index in matched_gt:
                continue

            iou = box_iou(
                prediction[
                    "box"
                ],
                gt[
                    "box"
                ],
            )

            if iou > best_iou:
                best_iou = iou
                best_gt_index = (
                    gt_index
                )

        if (
            best_gt_index
            is not None
            and best_iou
            >= MATCH_IOU
        ):
            matched_gt.add(
                best_gt_index
            )

            matches.append(
                (
                    prediction_index,
                    best_gt_index,
                    best_iou,
                )
            )

        else:
            unmatched_predictions.append(
                prediction_index
            )

    unmatched_gt = [
        index
        for index in range(
            len(ground_truth)
        )
        if index not in matched_gt
    ]

    return (
        matches,
        unmatched_predictions,
        unmatched_gt,
    )


# ============================================================
# CLASSIFIER
# ============================================================

def load_classifier():
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
                mean=weights.transforms().mean,
                std=weights.transforms().std,
            ),
        ]
    )

    return (
        model,
        transform,
    )


def predicted_box_crop(
    image: Image.Image,
    box: list[float],
) -> Image.Image:
    image_width, image_height = (
        image.size
    )

    x1, y1, x2, y2 = box

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
    ) / 2

    center_y = (
        y1 + y2
    ) / 2

    side = max(
        box_width,
        box_height,
    ) * CONTEXT_SCALE

    side = max(
        side,
        MIN_CROP_SIDE,
    )

    side = min(
        side,
        image_width,
        image_height,
    )

    side = max(
        1,
        round(side),
    )

    left = round(
        center_x
        - side / 2
    )

    top = round(
        center_y
        - side / 2
    )

    left = max(
        0,
        min(
            left,
            image_width - side,
        ),
    )

    top = max(
        0,
        min(
            top,
            image_height - side,
        ),
    )

    return image.crop(
        (
            left,
            top,
            left + side,
            top + side,
        )
    )


def classify_crop(
    model,
    transform,
    crop: Image.Image,
) -> tuple[int, float]:
    tensor = transform(
        crop
    ).unsqueeze(
        0
    )

    with torch.inference_mode():
        logits = model(
            tensor
        )

        probabilities = (
            torch.softmax(
                logits,
                dim=1,
            )[0]
        )

    confidence, index = (
        probabilities.max(
            dim=0
        )
    )

    return (
        int(
            index.item()
        ),
        float(
            confidence.item()
        ),
    )


# ============================================================
# METRICS
# ============================================================

def calculate_binary_metrics(
    tp: int,
    fp: int,
    fn: int,
) -> dict:
    precision = (
        tp / (tp + fp)
        if tp + fp
        else 0.0
    )

    recall = (
        tp / (tp + fn)
        if tp + fn
        else 0.0
    )

    f1 = (
        2
        * precision
        * recall
        / (
            precision
            + recall
        )
        if precision + recall
        else 0.0
    )

    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def calculate_stage_metrics(
    confusion: list[
        list[int]
    ],
    missed_gt: list[int],
    false_positive_classes: list[int],
) -> dict:
    per_class = {}

    f1_values = []
    precision_values = []
    recall_values = []

    for class_index, class_name in enumerate(
        CLASS_NAMES
    ):
        tp = (
            confusion[
                class_index
            ][
                class_index
            ]
        )

        wrong_as_other = (
            sum(
                confusion[
                    class_index
                ]
            )
            - tp
        )

        predicted_from_other = (
            sum(
                confusion[
                    row
                ][
                    class_index
                ]
                for row in range(
                    len(
                        CLASS_NAMES
                    )
                )
            )
            - tp
        )

        detector_misses = (
            missed_gt[
                class_index
            ]
        )

        detector_false_positive = (
            false_positive_classes[
                class_index
            ]
        )

        fn = (
            wrong_as_other
            + detector_misses
        )

        fp = (
            predicted_from_other
            + detector_false_positive
        )

        precision = (
            tp / (tp + fp)
            if tp + fp
            else 0.0
        )

        recall = (
            tp / (tp + fn)
            if tp + fn
            else 0.0
        )

        f1 = (
            2
            * precision
            * recall
            / (
                precision
                + recall
            )
            if precision + recall
            else 0.0
        )

        precision_values.append(
            precision
        )

        recall_values.append(
            recall
        )

        f1_values.append(
            f1
        )

        per_class[
            class_name
        ] = {
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "precision":
                precision,
            "recall":
                recall,
            "f1":
                f1,
        }

    return {
        "macro_precision":
            sum(
                precision_values
            )
            / len(
                CLASS_NAMES
            ),

        "macro_recall":
            sum(
                recall_values
            )
            / len(
                CLASS_NAMES
            ),

        "macro_f1":
            sum(
                f1_values
            )
            / len(
                CLASS_NAMES
            ),

        "per_class":
            per_class,
    }


# ============================================================
# MAIN
# ============================================================

def main():
    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    setup_logging()

    ERROR_EVENT_LOG_PATH.write_text(
        "",
        encoding="utf-8",
    )

    print(
        "=== TWO-STAGE V2 OFFICIAL TEST EVALUATION ==="
    )

    LOGGER.info(
        "Starting FINAL frozen V2 official-test evaluation."
    )

    print(
        f"Detector conf: "
        f"{DETECTOR_CONF}"
    )

    print(
        f"Match IoU: "
        f"{MATCH_IOU}"
    )

    print(
        "Official test used: YES - FINAL FROZEN BENCHMARK"
    )

    LOGGER.info(
        "Configuration | detector_conf=%.2f | match_iou=%.2f "
        "| detector_imgsz=%d | classifier_imgsz=%d | context_scale=%.2f",
        DETECTOR_CONF,
        MATCH_IOU,
        DETECTOR_IMAGE_SIZE,
        CLASSIFIER_IMAGE_SIZE,
        CONTEXT_SCALE,
    )

    if not DETECTOR_PATH.exists():
        raise FileNotFoundError(
            DETECTOR_PATH
        )

    if not CLASSIFIER_PATH.exists():
        raise FileNotFoundError(
            CLASSIFIER_PATH
        )

    preflight = validate_official_dataset()

    LOGGER.info(
        "Loading frozen detector: %s",
        DETECTOR_PATH.resolve(),
    )

    detector = YOLO(
        str(
            DETECTOR_PATH
        )
    )

    LOGGER.info(
        "Loading frozen classifier: %s",
        CLASSIFIER_PATH.resolve(),
    )

    (
        classifier,
        classifier_transform,
    ) = load_classifier()

    images = sorted(
        path
        for path in IMAGE_DIR.iterdir()
        if (
            path.is_file()
            and path.suffix.lower()
            in SUPPORTED_IMAGES
        )
    )

    if len(images) != EXPECTED_TEST_IMAGES:
        raise RuntimeError(
            f"Expected {EXPECTED_TEST_IMAGES} official test "
            f"images, found {len(images)}"
        )

    detector_tp = 0
    detector_fp = 0
    detector_fn = 0

    matched_total = 0
    matched_correct = 0

    confusion = [
        [
            0
            for _ in CLASS_NAMES
        ]
        for _ in CLASS_NAMES
    ]

    missed_gt = [
        0
        for _ in CLASS_NAMES
    ]

    false_positive_classes = [
        0
        for _ in CLASS_NAMES
    ]

    classifier_confidences = []

    error_records = []

    total_gt = 0

    for image_index, image_path in enumerate(
        images,
        start=1,
    ):
        label_path = (
            LABEL_DIR
            / f"{image_path.stem}.txt"
        )

        with Image.open(
            image_path
        ) as source:
            image = source.convert(
                "RGB"
            )

        width, height = (
            image.size
        )

        gt = read_stage_ground_truth(
            label_path,
            width,
            height,
        )

        total_gt += len(
            gt
        )

        results = detector.predict(
            source=str(
                image_path
            ),
            imgsz=DETECTOR_IMAGE_SIZE,
            conf=DETECTOR_CONF,
            device="cpu",
            verbose=False,
        )

        result = results[0]

        predictions = []

        if result.boxes is not None:
            boxes = (
                result.boxes.xyxy
                .cpu()
                .tolist()
            )

            confidences = (
                result.boxes.conf
                .cpu()
                .tolist()
            )

            for box, confidence in zip(
                boxes,
                confidences,
            ):
                predictions.append(
                    {
                        "box": [
                            float(
                                box[0]
                            ),
                            float(
                                box[1]
                            ),
                            float(
                                box[2]
                            ),
                            float(
                                box[3]
                            ),
                        ],

                        "confidence":
                            float(
                                confidence
                            ),
                    }
                )

        (
            matches,
            unmatched_predictions,
            unmatched_gt,
        ) = match_detections(
            gt,
            predictions,
        )

        detector_tp += len(
            matches
        )

        detector_fp += len(
            unmatched_predictions
        )

        detector_fn += len(
            unmatched_gt
        )

        image_errors = []

        # ----------------------------------------------------
        # MATCHED DETECTIONS
        # ----------------------------------------------------

        for (
            prediction_index,
            gt_index,
            match_iou,
        ) in matches:
            prediction = (
                predictions[
                    prediction_index
                ]
            )

            truth = (
                gt[
                    gt_index
                ]
            )

            crop = predicted_box_crop(
                image,
                prediction[
                    "box"
                ],
            )

            (
                predicted_class,
                classifier_confidence,
            ) = classify_crop(
                classifier,
                classifier_transform,
                crop,
            )

            true_class = (
                truth[
                    "class_index"
                ]
            )

            confusion[
                true_class
            ][
                predicted_class
            ] += 1

            matched_total += 1

            classifier_confidences.append(
                classifier_confidence
            )

            if (
                predicted_class
                == true_class
            ):
                matched_correct += 1

            else:
                event = {
                    "type":
                        "wrong_stage",

                    "true":
                        CLASS_NAMES[
                            true_class
                        ],

                    "predicted":
                        CLASS_NAMES[
                            predicted_class
                        ],

                    "classifier_confidence":
                        classifier_confidence,

                    "detector_confidence":
                        prediction[
                            "confidence"
                        ],

                    "iou":
                        match_iou,
                }

                image_errors.append(
                    event
                )

                write_error_event(
                    image_path.name,
                    event,
                )

        # ----------------------------------------------------
        # MISSED GT
        # ----------------------------------------------------

        for gt_index in (
            unmatched_gt
        ):
            true_class = (
                gt[
                    gt_index
                ][
                    "class_index"
                ]
            )

            missed_gt[
                true_class
            ] += 1

            event = {
                "type":
                    "detector_miss",

                "true":
                    CLASS_NAMES[
                        true_class
                    ],
            }

            image_errors.append(
                event
            )

            write_error_event(
                image_path.name,
                event,
            )

        # ----------------------------------------------------
        # DETECTOR FALSE POSITIVES
        #
        # They still enter the classifier
        # in the real pipeline, therefore
        # they count toward end-to-end
        # stage false positives.
        # ----------------------------------------------------

        for prediction_index in (
            unmatched_predictions
        ):
            prediction = (
                predictions[
                    prediction_index
                ]
            )

            crop = predicted_box_crop(
                image,
                prediction[
                    "box"
                ],
            )

            (
                predicted_class,
                classifier_confidence,
            ) = classify_crop(
                classifier,
                classifier_transform,
                crop,
            )

            false_positive_classes[
                predicted_class
            ] += 1

            event = {
                "type":
                    "detector_false_positive",

                "predicted":
                    CLASS_NAMES[
                        predicted_class
                    ],

                "classifier_confidence":
                    classifier_confidence,

                "detector_confidence":
                    prediction[
                        "confidence"
                    ],
            }

            image_errors.append(
                event
            )

            write_error_event(
                image_path.name,
                event,
            )

        if image_errors:
            error_records.append(
                {
                    "image":
                        image_path.name,

                    "errors":
                        image_errors,
                }
            )

        if (
            image_index % 25 == 0
            or image_index
            == len(images)
        ):
            print(
                f" {image_index}/"
                f"{len(images)}"
            )

            LOGGER.info(
                "Progress %d/%d | cumulative TP=%d FP=%d FN=%d",
                image_index,
                len(images),
                detector_tp,
                detector_fp,
                detector_fn,
            )

    if total_gt != EXPECTED_GT_PARASITES:
        raise RuntimeError(
            "Official ground-truth count mismatch after inference: "
            f"expected {EXPECTED_GT_PARASITES}, "
            f"found {total_gt}"
        )

    LOGGER.info(
        "Inference complete | images=%d | GT=%d | detector TP=%d FP=%d FN=%d",
        len(images),
        total_gt,
        detector_tp,
        detector_fp,
        detector_fn,
    )

    # ========================================================
    # METRICS
    # ========================================================

    detector_metrics = (
        calculate_binary_metrics(
            detector_tp,
            detector_fp,
            detector_fn,
        )
    )

    classifier_accuracy = (
        matched_correct
        / matched_total
        if matched_total
        else 0.0
    )

    end_to_end = (
        calculate_stage_metrics(
            confusion,
            missed_gt,
            false_positive_classes,
        )
    )

    mean_classifier_confidence = (
        sum(
            classifier_confidences
        )
        / len(
            classifier_confidences
        )
        if classifier_confidences
        else 0.0
    )

    summary = {
        "status":
            "COMPLETE",

        "official_test_used":
            True,

        "benchmark":
            "BBBC041 official frozen test",

        "configuration": {
            "detector_confidence":
                DETECTOR_CONF,

            "matching_iou":
                MATCH_IOU,

            "detector_image_size":
                DETECTOR_IMAGE_SIZE,

            "classifier_image_size":
                CLASSIFIER_IMAGE_SIZE,

            "context_scale":
                CONTEXT_SCALE,
        },

        "official_test_images":
            len(images),

        "preflight":
            preflight,

        "ground_truth_parasites":
            total_gt,

        "detector":
            detector_metrics,

        "classifier_on_matched_detections": {
            "matched":
                matched_total,

            "correct":
                matched_correct,

            "accuracy":
                classifier_accuracy,

            "mean_confidence":
                mean_classifier_confidence,
        },

        "end_to_end": {
            **end_to_end,

            "confusion_matrix_matched":
                confusion,

            "detector_missed_by_class":
                {
                    CLASS_NAMES[index]:
                        missed_gt[
                            index
                        ]
                    for index in range(
                        len(
                            CLASS_NAMES
                        )
                    )
                },

            "detector_fp_classified_as":
                {
                    CLASS_NAMES[index]:
                        false_positive_classes[
                            index
                        ]
                    for index in range(
                        len(
                            CLASS_NAMES
                        )
                    )
                },
        },
    }

    METRICS_PATH.write_text(
        json.dumps(
            summary,
            indent=2,
        ),
        encoding="utf-8",
    )

    ERRORS_PATH.write_text(
        json.dumps(
            error_records,
            indent=2,
        ),
        encoding="utf-8",
    )

    with CONFUSION_PATH.open(
        "w",
        newline="",
        encoding="utf-8",
    ) as file:
        writer = csv.writer(
            file
        )

        writer.writerow(
            [
                "actual\\predicted",
                *CLASS_NAMES,
            ]
        )

        for index, class_name in enumerate(
            CLASS_NAMES
        ):
            writer.writerow(
                [
                    class_name,
                    *confusion[
                        index
                    ],
                ]
            )

    # ========================================================
    # DISPLAY
    # ========================================================

    print()
    print(
        "========================================"
    )

    print(
        "TWO-STAGE V2 OFFICIAL TEST RESULTS"
    )

    print(
        "========================================"
    )

    print()
    print(
        "DETECTOR"
    )

    for key, value in (
        detector_metrics.items()
    ):
        if isinstance(
            value,
            float,
        ):
            print(
                f" {key:10s}: "
                f"{value:.4f}"
            )
        else:
            print(
                f" {key:10s}: "
                f"{value}"
            )

    print()
    print(
        "CLASSIFIER ON MATCHED DETECTIONS"
    )

    print(
        f" Matched:  "
        f"{matched_total}"
    )

    print(
        f" Correct:  "
        f"{matched_correct}"
    )

    print(
        f" Accuracy: "
        f"{classifier_accuracy:.4f}"
    )

    print()
    print(
        "END-TO-END"
    )

    print(
        f" Macro P:  "
        f"{end_to_end['macro_precision']:.4f}"
    )

    print(
        f" Macro R:  "
        f"{end_to_end['macro_recall']:.4f}"
    )

    print(
        f" Macro F1: "
        f"{end_to_end['macro_f1']:.4f}"
    )

    print()

    for class_name in (
        CLASS_NAMES
    ):
        metrics = (
            end_to_end[
                "per_class"
            ][
                class_name
            ]
        )

        print(
            f"{class_name}"
        )

        print(
            f" P : "
            f"{metrics['precision']:.4f}"
        )

        print(
            f" R : "
            f"{metrics['recall']:.4f}"
        )

        print(
            f" F1: "
            f"{metrics['f1']:.4f}"
        )

        print()

    print(
        f"Metrics: "
        f"{METRICS_PATH.resolve()}"
    )

    print(
        f"Errors: "
        f"{ERRORS_PATH.resolve()}"
    )

    print()
    print(
        "OFFICIAL TEST USED: YES - FINAL FROZEN BENCHMARK"
    )

    print(
        f"Run log: "
        f"{RUN_LOG_PATH.resolve()}"
    )

    print(
        f"Structured error events: "
        f"{ERROR_EVENT_LOG_PATH.resolve()}"
    )

    LOGGER.info(
        "Evaluation COMPLETE | detector=%s | classifier_accuracy=%.4f "
        "| end_to_end_macro_f1=%.4f",
        detector_metrics,
        classifier_accuracy,
        end_to_end[
            "macro_f1"
        ],
    )


if __name__ == "__main__":
    try:
        main()

    except Exception:
        OUTPUT_DIR.mkdir(
            parents=True,
            exist_ok=True,
        )

        if not LOGGER.handlers:
            setup_logging()

        LOGGER.exception(
            "FATAL EVALUATION ERROR"
        )

        print()
        print(
            "FINAL EVALUATION FAILED."
        )

        print(
            f"Check log: "
            f"{RUN_LOG_PATH.resolve()}"
        )

        raise
