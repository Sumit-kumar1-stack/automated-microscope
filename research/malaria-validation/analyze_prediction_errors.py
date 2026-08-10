from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import torch
from ultralytics import YOLO


BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = (
    BASE_DIR
    / "outputs"
    / "ml-runs"
    / "bbbc041-parasite-baseline"
    / "weights"
    / "best.pt"
)

DATASET_DIR = (
    BASE_DIR
    / "data"
    / "yolo-parasite-pilot"
)

VAL_IMAGE_DIR = (
    DATASET_DIR
    / "images"
    / "val"
)

VAL_LABEL_DIR = (
    DATASET_DIR
    / "labels"
    / "val"
)

OUTPUT_DIR = (
    BASE_DIR
    / "outputs"
    / "error-analysis"
)

PREVIEW_DIR = (
    OUTPUT_DIR
    / "previews"
)

SUMMARY_PATH = (
    OUTPUT_DIR
    / "prediction_error_summary.json"
)


CLASS_NAMES = [
    "ring",
    "trophozoite",
    "schizont",
    "gametocyte",
]


IMAGE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
}


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Analyze BBBC041 parasite "
            "detector false positives, "
            "false negatives and "
            "class confusions."
        )
    )

    parser.add_argument(
        "--conf",
        type=float,
        default=0.25,
        help=(
            "Prediction confidence "
            "threshold."
        ),
    )

    parser.add_argument(
        "--match-iou",
        type=float,
        default=0.50,
        help=(
            "IoU required to match "
            "prediction to ground truth."
        ),
    )

    parser.add_argument(
        "--nms-iou",
        type=float,
        default=0.70,
        help=(
            "YOLO NMS IoU threshold."
        ),
    )

    parser.add_argument(
        "--imgsz",
        type=int,
        default=512,
    )

    parser.add_argument(
        "--max-previews",
        type=int,
        default=20,
    )

    return parser.parse_args()


def safe_divide(
    numerator: int,
    denominator: int,
) -> float:
    if denominator == 0:
        return 0.0

    return (
        numerator
        / denominator
    )


def box_iou(
    first: list[float],
    second: list[float],
) -> float:
    ax1, ay1, ax2, ay2 = first
    bx1, by1, bx2, by2 = second

    intersection_x1 = max(
        ax1,
        bx1,
    )

    intersection_y1 = max(
        ay1,
        by1,
    )

    intersection_x2 = min(
        ax2,
        bx2,
    )

    intersection_y2 = min(
        ay2,
        by2,
    )

    intersection_width = max(
        0.0,
        intersection_x2
        - intersection_x1,
    )

    intersection_height = max(
        0.0,
        intersection_y2
        - intersection_y1,
    )

    intersection_area = (
        intersection_width
        * intersection_height
    )

    first_area = max(
        0.0,
        ax2 - ax1,
    ) * max(
        0.0,
        ay2 - ay1,
    )

    second_area = max(
        0.0,
        bx2 - bx1,
    ) * max(
        0.0,
        by2 - by1,
    )

    union = (
        first_area
        + second_area
        - intersection_area
    )

    if union <= 0:
        return 0.0

    return (
        intersection_area
        / union
    )


def load_ground_truth(
    label_path: Path,
    image_width: int,
    image_height: int,
) -> list[dict[str, Any]]:
    objects = []

    if not label_path.exists():
        return objects

    for line in label_path.read_text(
        encoding="utf-8",
    ).splitlines():
        line = line.strip()

        if not line:
            continue

        parts = line.split()

        if len(parts) != 5:
            raise ValueError(
                "Invalid YOLO annotation "
                f"in {label_path}: {line}"
            )

        class_id = int(
            parts[0]
        )

        center_x = float(
            parts[1]
        )

        center_y = float(
            parts[2]
        )

        box_width = float(
            parts[3]
        )

        box_height = float(
            parts[4]
        )

        x1 = (
            center_x
            - box_width / 2
        ) * image_width

        y1 = (
            center_y
            - box_height / 2
        ) * image_height

        x2 = (
            center_x
            + box_width / 2
        ) * image_width

        y2 = (
            center_y
            + box_height / 2
        ) * image_height

        objects.append(
            {
                "classId":
                    class_id,
                "className":
                    CLASS_NAMES[
                        class_id
                    ],
                "box": [
                    x1,
                    y1,
                    x2,
                    y2,
                ],
            }
        )

    return objects


def predict_image(
    model: YOLO,
    image_path: Path,
    device,
    confidence: float,
    nms_iou: float,
    image_size: int,
) -> list[dict[str, Any]]:
    result = model.predict(
        source=str(
            image_path
        ),
        imgsz=image_size,
        conf=confidence,
        iou=nms_iou,
        device=device,
        verbose=False,
    )[0]

    predictions = []

    boxes = result.boxes

    if boxes is None:
        return predictions

    xyxy_values = (
        boxes.xyxy
        .cpu()
        .tolist()
    )

    class_values = (
        boxes.cls
        .cpu()
        .tolist()
    )

    confidence_values = (
        boxes.conf
        .cpu()
        .tolist()
    )

    for (
        box,
        class_value,
        confidence_value,
    ) in zip(
        xyxy_values,
        class_values,
        confidence_values,
    ):
        class_id = int(
            class_value
        )

        predictions.append(
            {
                "classId":
                    class_id,
                "className":
                    CLASS_NAMES[
                        class_id
                    ],
                "confidence":
                    float(
                        confidence_value
                    ),
                "box": [
                    float(value)
                    for value in box
                ],
            }
        )

    predictions.sort(
        key=lambda item:
            item[
                "confidence"
            ],
        reverse=True,
    )

    return predictions


def match_detections(
    ground_truth,
    predictions,
    match_iou: float,
):
    matched_gt = set()
    matched_predictions = set()

    true_positive_pairs = []

    # First perform correct-class
    # matching.
    for prediction_index, prediction in (
        enumerate(
            predictions
        )
    ):
        best_gt_index = None
        best_iou = 0.0

        for gt_index, gt in enumerate(
            ground_truth
        ):
            if gt_index in matched_gt:
                continue

            if (
                gt["classId"]
                != prediction[
                    "classId"
                ]
            ):
                continue

            overlap = box_iou(
                gt["box"],
                prediction["box"],
            )

            if overlap > best_iou:
                best_iou = overlap
                best_gt_index = (
                    gt_index
                )

        if (
            best_gt_index
            is not None
            and best_iou
            >= match_iou
        ):
            matched_gt.add(
                best_gt_index
            )

            matched_predictions.add(
                prediction_index
            )

            true_positive_pairs.append(
                {
                    "groundTruthIndex":
                        best_gt_index,
                    "predictionIndex":
                        prediction_index,
                    "iou":
                        best_iou,
                }
            )

    unmatched_gt = [
        index
        for index in range(
            len(ground_truth)
        )
        if index not in matched_gt
    ]

    unmatched_predictions = [
        index
        for index in range(
            len(predictions)
        )
        if index
        not in matched_predictions
    ]

    # Look for wrong-class predictions
    # overlapping an unmatched GT.
    confusion_pairs = []

    confusion_gt_used = set()
    confusion_pred_used = set()

    for prediction_index in (
        unmatched_predictions
    ):
        prediction = predictions[
            prediction_index
        ]

        best_gt_index = None
        best_iou = 0.0

        for gt_index in unmatched_gt:
            if (
                gt_index
                in confusion_gt_used
            ):
                continue

            gt = ground_truth[
                gt_index
            ]

            if (
                gt["classId"]
                == prediction[
                    "classId"
                ]
            ):
                continue

            overlap = box_iou(
                gt["box"],
                prediction["box"],
            )

            if overlap > best_iou:
                best_iou = overlap
                best_gt_index = (
                    gt_index
                )

        if (
            best_gt_index
            is not None
            and best_iou
            >= match_iou
        ):
            confusion_gt_used.add(
                best_gt_index
            )

            confusion_pred_used.add(
                prediction_index
            )

            gt = ground_truth[
                best_gt_index
            ]

            confusion_pairs.append(
                {
                    "groundTruthIndex":
                        best_gt_index,
                    "predictionIndex":
                        prediction_index,
                    "trueClass":
                        gt[
                            "className"
                        ],
                    "predictedClass":
                        prediction[
                            "className"
                        ],
                    "iou":
                        best_iou,
                }
            )

    return {
        "matchedGroundTruth":
            matched_gt,
        "matchedPredictions":
            matched_predictions,
        "truePositivePairs":
            true_positive_pairs,
        "unmatchedGroundTruth":
            unmatched_gt,
        "unmatchedPredictions":
            unmatched_predictions,
        "confusionPairs":
            confusion_pairs,
    }


def add_class_statistics(
    statistics,
    ground_truth,
    predictions,
    matching,
):
    for gt_index, gt in enumerate(
        ground_truth
    ):
        class_name = gt[
            "className"
        ]

        statistics[
            class_name
        ][
            "groundTruth"
        ] += 1

        if (
            gt_index
            in matching[
                "matchedGroundTruth"
            ]
        ):
            statistics[
                class_name
            ][
                "tp"
            ] += 1
        else:
            statistics[
                class_name
            ][
                "fn"
            ] += 1

    for prediction_index, prediction in (
        enumerate(
            predictions
        )
    ):
        class_name = prediction[
            "className"
        ]

        statistics[
            class_name
        ][
            "predictions"
        ] += 1

        if (
            prediction_index
            not in matching[
                "matchedPredictions"
            ]
        ):
            statistics[
                class_name
            ][
                "fp"
            ] += 1


def draw_box(
    image,
    box,
    text: str,
    color,
):
    x1, y1, x2, y2 = [
        int(round(value))
        for value in box
    ]

    cv2.rectangle(
        image,
        (x1, y1),
        (x2, y2),
        color,
        3,
    )

    font = (
        cv2.FONT_HERSHEY_SIMPLEX
    )

    font_scale = 0.55

    thickness = 1

    (
        text_width,
        text_height,
    ), _ = cv2.getTextSize(
        text,
        font,
        font_scale,
        thickness,
    )

    label_y = max(
        text_height + 8,
        y1,
    )

    cv2.rectangle(
        image,
        (
            x1,
            label_y
            - text_height
            - 8,
        ),
        (
            x1
            + text_width
            + 8,
            label_y,
        ),
        color,
        -1,
    )

    cv2.putText(
        image,
        text,
        (
            x1 + 4,
            label_y - 4,
        ),
        font,
        font_scale,
        (0, 0, 0),
        thickness,
        cv2.LINE_AA,
    )


def render_preview(
    image_path: Path,
    ground_truth,
    predictions,
    matching,
    destination: Path,
):
    source = cv2.imread(
        str(image_path)
    )

    if source is None:
        raise RuntimeError(
            f"Could not read "
            f"{image_path}"
        )

    ground_truth_view = (
        source.copy()
    )

    prediction_view = (
        source.copy()
    )

    matched_gt = matching[
        "matchedGroundTruth"
    ]

    matched_predictions = matching[
        "matchedPredictions"
    ]

    confusion_predictions = {
        item[
            "predictionIndex"
        ]
        for item in matching[
            "confusionPairs"
        ]
    }

    for index, gt in enumerate(
        ground_truth
    ):
        if index in matched_gt:
            color = (
                0,
                190,
                0,
            )

            prefix = "MATCH"
        else:
            color = (
                0,
                0,
                255,
            )

            prefix = "MISS"

        draw_box(
            ground_truth_view,
            gt["box"],
            (
                f"{prefix} GT "
                f"{gt['className']}"
            ),
            color,
        )

    for index, prediction in enumerate(
        predictions
    ):
        if (
            index
            in matched_predictions
        ):
            color = (
                0,
                190,
                0,
            )

            prefix = "TP"

        elif (
            index
            in confusion_predictions
        ):
            color = (
                255,
                0,
                255,
            )

            prefix = "WRONG"

        else:
            color = (
                0,
                165,
                255,
            )

            prefix = "FP"

        draw_box(
            prediction_view,
            prediction["box"],
            (
                f"{prefix} "
                f"{prediction['className']} "
                f"{prediction['confidence']:.2f}"
            ),
            color,
        )

    cv2.putText(
        ground_truth_view,
        "GROUND TRUTH",
        (20, 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.0,
        (255, 255, 255),
        3,
        cv2.LINE_AA,
    )

    cv2.putText(
        prediction_view,
        "MODEL PREDICTIONS",
        (20, 35),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.0,
        (255, 255, 255),
        3,
        cv2.LINE_AA,
    )

    combined = cv2.hconcat(
        [
            ground_truth_view,
            prediction_view,
        ]
    )

    max_width = 2400

    if (
        combined.shape[1]
        > max_width
    ):
        scale = (
            max_width
            / combined.shape[1]
        )

        combined = cv2.resize(
            combined,
            None,
            fx=scale,
            fy=scale,
            interpolation=
                cv2.INTER_AREA,
        )

    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    cv2.imwrite(
        str(destination),
        combined,
    )


def main() -> None:
    args = parse_args()

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Missing model: "
            f"{MODEL_PATH}"
        )

    if not VAL_IMAGE_DIR.exists():
        raise FileNotFoundError(
            f"Missing validation "
            f"images: {VAL_IMAGE_DIR}"
        )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    PREVIEW_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    device = (
        0
        if torch.cuda.is_available()
        else "cpu"
    )

    print(
        "=== BBBC041 PREDICTION "
        "ERROR ANALYSIS ==="
    )

    print(
        f"Confidence threshold: "
        f"{args.conf}"
    )

    print(
        f"Matching IoU: "
        f"{args.match_iou}"
    )

    print(
        f"Device: {device}"
    )

    model = YOLO(
        str(MODEL_PATH)
    )

    image_paths = sorted(
        path
        for path
        in VAL_IMAGE_DIR.iterdir()
        if (
            path.is_file()
            and path.suffix.lower()
            in IMAGE_EXTENSIONS
        )
    )

    statistics = defaultdict(
        lambda: {
            "groundTruth": 0,
            "predictions": 0,
            "tp": 0,
            "fp": 0,
            "fn": 0,
        }
    )

    confusion_counter = Counter()

    image_results = []

    preview_cache = {}

    for index, image_path in (
        enumerate(
            image_paths,
            start=1,
        )
    ):
        source = cv2.imread(
            str(image_path)
        )

        if source is None:
            raise RuntimeError(
                f"Could not read "
                f"{image_path}"
            )

        height, width = (
            source.shape[:2]
        )

        label_path = (
            VAL_LABEL_DIR
            / (
                image_path.stem
                + ".txt"
            )
        )

        ground_truth = (
            load_ground_truth(
                label_path,
                width,
                height,
            )
        )

        predictions = (
            predict_image(
                model=model,
                image_path=
                    image_path,
                device=device,
                confidence=
                    args.conf,
                nms_iou=
                    args.nms_iou,
                image_size=
                    args.imgsz,
            )
        )

        matching = (
            match_detections(
                ground_truth,
                predictions,
                args.match_iou,
            )
        )

        add_class_statistics(
            statistics,
            ground_truth,
            predictions,
            matching,
        )

        for confusion in (
            matching[
                "confusionPairs"
            ]
        ):
            key = (
                confusion[
                    "trueClass"
                ],
                confusion[
                    "predictedClass"
                ],
            )

            confusion_counter[
                key
            ] += 1

        tp = len(
            matching[
                "matchedPredictions"
            ]
        )

        fp = (
            len(predictions)
            - tp
        )

        fn = (
            len(ground_truth)
            - len(
                matching[
                    "matchedGroundTruth"
                ]
            )
        )

        error_score = (
            fp + fn
        )

        image_results.append(
            {
                "filename":
                    image_path.name,
                "groundTruth":
                    len(
                        ground_truth
                    ),
                "predictions":
                    len(
                        predictions
                    ),
                "tp":
                    tp,
                "fp":
                    fp,
                "fn":
                    fn,
                "confusions":
                    len(
                        matching[
                            "confusionPairs"
                        ]
                    ),
                "errorScore":
                    error_score,
            }
        )

        preview_cache[
            image_path.name
        ] = {
            "path":
                image_path,
            "groundTruth":
                ground_truth,
            "predictions":
                predictions,
            "matching":
                matching,
        }

        print(
            f"[{index:03d}/"
            f"{len(image_paths):03d}] "
            f"{image_path.name} "
            f"TP={tp} "
            f"FP={fp} "
            f"FN={fn}"
        )

    per_class = {}

    total_tp = 0
    total_fp = 0
    total_fn = 0

    for class_name in CLASS_NAMES:
        values = statistics[
            class_name
        ]

        precision = safe_divide(
            values["tp"],
            values["tp"]
            + values["fp"],
        )

        recall = safe_divide(
            values["tp"],
            values["tp"]
            + values["fn"],
        )

        f1 = safe_divide(
            2
            * precision
            * recall,
            precision + recall,
        )

        per_class[
            class_name
        ] = {
            **values,
            "precision":
                precision,
            "recall":
                recall,
            "f1":
                f1,
        }

        total_tp += values[
            "tp"
        ]

        total_fp += values[
            "fp"
        ]

        total_fn += values[
            "fn"
        ]

    aggregate_precision = (
        safe_divide(
            total_tp,
            total_tp
            + total_fp,
        )
    )

    aggregate_recall = (
        safe_divide(
            total_tp,
            total_tp
            + total_fn,
        )
    )

    aggregate_f1 = safe_divide(
        2
        * aggregate_precision
        * aggregate_recall,
        aggregate_precision
        + aggregate_recall,
    )

    worst_images = sorted(
        image_results,
        key=lambda item: (
            item[
                "errorScore"
            ],
            item[
                "fn"
            ],
            item[
                "fp"
            ],
        ),
        reverse=True,
    )

    preview_count = min(
        args.max_previews,
        len(worst_images),
    )

    print()
    print(
        "Generating error previews..."
    )

    for preview_index in range(
        preview_count
    ):
        result = worst_images[
            preview_index
        ]

        filename = result[
            "filename"
        ]

        cached = preview_cache[
            filename
        ]

        destination = (
            PREVIEW_DIR
            / (
                Path(
                    filename
                ).stem
                + "_comparison.jpg"
            )
        )

        render_preview(
            image_path=
                cached["path"],
            ground_truth=
                cached[
                    "groundTruth"
                ],
            predictions=
                cached[
                    "predictions"
                ],
            matching=
                cached[
                    "matching"
                ],
            destination=
                destination,
        )

    confusion_payload = []

    for (
        true_class,
        predicted_class,
    ), count in (
        confusion_counter
        .most_common()
    ):
        confusion_payload.append(
            {
                "trueClass":
                    true_class,
                "predictedClass":
                    predicted_class,
                "count":
                    count,
            }
        )

    payload = {
        "schemaVersion": 1,
        "dataset": "BBBC041",
        "split": (
            "pilot-validation"
        ),
        "model": (
            "YOLO11n parasite "
            "baseline"
        ),
        "thresholds": {
            "confidence":
                args.conf,
            "matchingIoU":
                args.match_iou,
            "nmsIoU":
                args.nms_iou,
            "imageSize":
                args.imgsz,
        },
        "imagesAnalyzed":
            len(image_paths),
        "aggregateFixedThreshold": {
            "tp":
                total_tp,
            "fp":
                total_fp,
            "fn":
                total_fn,
            "precision":
                aggregate_precision,
            "recall":
                aggregate_recall,
            "f1":
                aggregate_f1,
        },
        "classes":
            per_class,
        "classConfusions":
            confusion_payload,
        "worstImages":
            worst_images[:20],
        "note": (
            "Fixed-threshold TP/FP/FN "
            "metrics are diagnostic and "
            "are not directly equivalent "
            "to Ultralytics mAP metrics."
        ),
        "clinicalValidation":
            False,
        "generatedAt":
            datetime.now(
                timezone.utc
            ).isoformat(),
    }

    SUMMARY_PATH.write_text(
        json.dumps(
            payload,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print()
    print(
        "=== FIXED-THRESHOLD "
        "ERROR SUMMARY ==="
    )

    print(
        f"TP: {total_tp}"
    )

    print(
        f"FP: {total_fp}"
    )

    print(
        f"FN: {total_fn}"
    )

    print(
        f"Precision: "
        f"{aggregate_precision:.4f}"
    )

    print(
        f"Recall: "
        f"{aggregate_recall:.4f}"
    )

    print(
        f"F1: "
        f"{aggregate_f1:.4f}"
    )

    print()
    print(
        "=== PER CLASS ==="
    )

    for class_name in (
        CLASS_NAMES
    ):
        values = per_class[
            class_name
        ]

        print()
        print(
            class_name
        )

        print(
            f"  TP: "
            f"{values['tp']}"
        )

        print(
            f"  FP: "
            f"{values['fp']}"
        )

        print(
            f"  FN: "
            f"{values['fn']}"
        )

        print(
            f"  Precision: "
            f"{values['precision']:.4f}"
        )

        print(
            f"  Recall: "
            f"{values['recall']:.4f}"
        )

        print(
            f"  F1: "
            f"{values['f1']:.4f}"
        )

    print()
    print(
        "=== CLASS CONFUSIONS ==="
    )

    if not confusion_payload:
        print(
            "No IoU-matched "
            "wrong-class pairs."
        )
    else:
        for item in (
            confusion_payload
        ):
            print(
                f"{item['trueClass']} "
                f"-> "
                f"{item['predictedClass']}: "
                f"{item['count']}"
            )

    print()
    print(
        "Summary:"
    )

    print(
        f"  {SUMMARY_PATH}"
    )

    print(
        "Visual comparisons:"
    )

    print(
        f"  {PREVIEW_DIR}"
    )

    print()
    print(
        "ANALYSIS STATUS: PASS"
    )


if __name__ == "__main__":
    main()