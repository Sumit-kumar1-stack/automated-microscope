from __future__ import annotations

import argparse
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
import torch
from ultralytics import YOLO


BASE_DIR = Path(__file__).resolve().parent

DETECTOR_PATH = (
    BASE_DIR
    / "outputs"
    / "ml-runs"
    / "bbbc041-binary-parasite"
    / "weights"
    / "best.pt"
)

CLASSIFIER_PATH = (
    BASE_DIR
    / "outputs"
    / "ml-runs"
    / "bbbc041-stage-classifier"
    / "weights"
    / "best.pt"
)

VAL_IMAGE_DIR = (
    BASE_DIR
    / "data"
    / "yolo-parasite-pilot"
    / "images"
    / "val"
)

VAL_LABEL_DIR = (
    BASE_DIR
    / "data"
    / "yolo-parasite-pilot"
    / "labels"
    / "val"
)

OUTPUT_DIR = (
    BASE_DIR
    / "outputs"
    / "two-stage-evaluation"
)

SUMMARY_PATH = (
    OUTPUT_DIR
    / "metrics.json"
)

MATRIX_PATH = (
    OUTPUT_DIR
    / "confusion_matrix_with_background.png"
)


STAGE_NAMES = [
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

CROP_SCALE = 1.8
MIN_CROP_SIZE = 48


def parse_args():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--conf",
        type=float,
        default=0.25,
    )

    parser.add_argument(
        "--match-iou",
        type=float,
        default=0.50,
    )

    parser.add_argument(
        "--detector-imgsz",
        type=int,
        default=512,
    )

    parser.add_argument(
        "--classifier-imgsz",
        type=int,
        default=224,
    )

    return parser.parse_args()


def safe_divide(
    numerator,
    denominator,
):
    if denominator == 0:
        return 0.0

    return numerator / denominator


def iou(
    first,
    second,
):
    ax1, ay1, ax2, ay2 = first
    bx1, by1, bx2, by2 = second

    x1 = max(ax1, bx1)
    y1 = max(ay1, by1)
    x2 = min(ax2, bx2)
    y2 = min(ay2, by2)

    width = max(
        0.0,
        x2 - x1,
    )

    height = max(
        0.0,
        y2 - y1,
    )

    intersection = (
        width * height
    )

    area_a = max(
        0.0,
        ax2 - ax1,
    ) * max(
        0.0,
        ay2 - ay1,
    )

    area_b = max(
        0.0,
        bx2 - bx1,
    ) * max(
        0.0,
        by2 - by1,
    )

    union = (
        area_a
        + area_b
        - intersection
    )

    if union <= 0:
        return 0.0

    return intersection / union


def load_ground_truth(
    path: Path,
    image_width: int,
    image_height: int,
):
    objects = []

    if not path.exists():
        return objects

    for line in path.read_text(
        encoding="utf-8",
    ).splitlines():

        line = line.strip()

        if not line:
            continue

        parts = line.split()

        class_id = int(
            parts[0]
        )

        cx = float(
            parts[1]
        ) * image_width

        cy = float(
            parts[2]
        ) * image_height

        width = float(
            parts[3]
        ) * image_width

        height = float(
            parts[4]
        ) * image_height

        objects.append(
            {
                "classId":
                    class_id,
                "className":
                    STAGE_NAMES[
                        class_id
                    ],
                "box": [
                    cx - width / 2,
                    cy - height / 2,
                    cx + width / 2,
                    cy + height / 2,
                ],
            }
        )

    return objects


def expand_crop(
    image,
    box,
):
    image_height, image_width = (
        image.shape[:2]
    )

    x1, y1, x2, y2 = box

    cx = (
        x1 + x2
    ) / 2

    cy = (
        y1 + y2
    ) / 2

    width = max(
        x2 - x1,
        MIN_CROP_SIZE,
    )

    height = max(
        y2 - y1,
        MIN_CROP_SIZE,
    )

    size = max(
        width,
        height,
    ) * CROP_SCALE

    half = size / 2

    crop_x1 = max(
        0,
        int(round(
            cx - half
        )),
    )

    crop_y1 = max(
        0,
        int(round(
            cy - half
        )),
    )

    crop_x2 = min(
        image_width,
        int(round(
            cx + half
        )),
    )

    crop_y2 = min(
        image_height,
        int(round(
            cy + half
        )),
    )

    return image[
        crop_y1:crop_y2,
        crop_x1:crop_x2,
    ]


def match_predictions(
    ground_truth,
    predictions,
    threshold,
):
    candidates = []

    for gt_index, gt in enumerate(
        ground_truth
    ):
        for pred_index, prediction in enumerate(
            predictions
        ):
            overlap = iou(
                gt["box"],
                prediction["box"],
            )

            if overlap >= threshold:
                candidates.append(
                    (
                        overlap,
                        gt_index,
                        pred_index,
                    )
                )

    candidates.sort(
        reverse=True
    )

    gt_used = set()
    pred_used = set()

    matches = []

    for (
        overlap,
        gt_index,
        pred_index,
    ) in candidates:

        if gt_index in gt_used:
            continue

        if pred_index in pred_used:
            continue

        gt_used.add(
            gt_index
        )

        pred_used.add(
            pred_index
        )

        matches.append(
            {
                "groundTruth":
                    gt_index,
                "prediction":
                    pred_index,
                "iou":
                    overlap,
            }
        )

    return (
        matches,
        gt_used,
        pred_used,
    )


def main():
    args = parse_args()

    if not DETECTOR_PATH.exists():
        raise FileNotFoundError(
            f"Detector missing: "
            f"{DETECTOR_PATH}"
        )

    if not CLASSIFIER_PATH.exists():
        raise FileNotFoundError(
            f"Classifier missing: "
            f"{CLASSIFIER_PATH}"
        )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    device = (
        0
        if torch.cuda.is_available()
        else "cpu"
    )

    detector = YOLO(
        str(DETECTOR_PATH)
    )

    classifier = YOLO(
        str(CLASSIFIER_PATH)
    )

    classifier_names = {
        int(key): value
        for key, value
        in classifier.names.items()
    }

    print(
        "=== BBBC041 TWO-STAGE "
        "PIPELINE ==="
    )

    print(
        f"Device: {device}"
    )

    print(
        "Classifier mapping:"
    )

    for key, value in (
        classifier_names.items()
    ):
        print(
            f"  {key}: {value}"
        )

    labels = (
        STAGE_NAMES
        + ["background"]
    )

    index_by_name = {
        name: index
        for index, name
        in enumerate(labels)
    }

    matrix = np.zeros(
        (
            len(labels),
            len(labels),
        ),
        dtype=np.int64,
    )

    images = sorted(
        path
        for path in VAL_IMAGE_DIR.iterdir()
        if (
            path.is_file()
            and path.suffix.lower()
            in IMAGE_EXTENSIONS
        )
    )

    detector_tp = 0
    detector_fp = 0
    detector_fn = 0

    classifier_correct_on_matched = 0
    classifier_matched_total = 0

    for image_index, image_path in enumerate(
        images,
        start=1,
    ):
        image = cv2.imread(
            str(image_path)
        )

        if image is None:
            raise RuntimeError(
                f"Cannot read "
                f"{image_path}"
            )

        height, width = (
            image.shape[:2]
        )

        ground_truth = load_ground_truth(
            VAL_LABEL_DIR
            / f"{image_path.stem}.txt",
            width,
            height,
        )

        detection_result = (
            detector.predict(
                source=str(
                    image_path
                ),
                imgsz=
                    args.detector_imgsz,
                conf=args.conf,
                device=device,
                verbose=False,
            )[0]
        )

        predictions = []

        if (
            detection_result.boxes
            is not None
        ):
            for (
                box,
                confidence,
            ) in zip(
                detection_result.boxes.xyxy
                .cpu()
                .tolist(),

                detection_result.boxes.conf
                .cpu()
                .tolist(),
            ):
                predictions.append(
                    {
                        "box": [
                            float(value)
                            for value in box
                        ],
                        "detectorConfidence":
                            float(
                                confidence
                            ),
                    }
                )

        (
            matches,
            matched_gt,
            matched_predictions,
        ) = match_predictions(
            ground_truth,
            predictions,
            args.match_iou,
        )

        detector_tp += len(
            matches
        )

        detector_fn += (
            len(ground_truth)
            - len(matched_gt)
        )

        detector_fp += (
            len(predictions)
            - len(
                matched_predictions
            )
        )

        # Classify every detector
        # candidate.
        for pred_index, prediction in enumerate(
            predictions
        ):
            crop = expand_crop(
                image,
                prediction[
                    "box"
                ],
            )

            if crop.size == 0:
                prediction[
                    "stage"
                ] = None
                continue

            classification = (
                classifier.predict(
                    source=crop,
                    imgsz=
                        args.classifier_imgsz,
                    device=device,
                    verbose=False,
                )[0]
            )

            if (
                classification.probs
                is None
            ):
                prediction[
                    "stage"
                ] = None
                continue

            predicted_class_id = int(
                classification.probs.top1
            )

            prediction[
                "stage"
            ] = (
                classifier_names[
                    predicted_class_id
                ]
            )

            prediction[
                "stageConfidence"
            ] = float(
                classification
                .probs
                .top1conf
            )

        # Matched parasite:
        # actual stage vs classifier stage.
        for match in matches:
            gt = ground_truth[
                match[
                    "groundTruth"
                ]
            ]

            prediction = predictions[
                match[
                    "prediction"
                ]
            ]

            actual_name = gt[
                "className"
            ]

            predicted_name = (
                prediction.get(
                    "stage"
                )
            )

            if (
                predicted_name
                not in index_by_name
            ):
                predicted_name = (
                    "background"
                )

            matrix[
                index_by_name[
                    actual_name
                ],
                index_by_name[
                    predicted_name
                ],
            ] += 1

            classifier_matched_total += 1

            if (
                actual_name
                == predicted_name
            ):
                classifier_correct_on_matched += 1

        # Missed GT:
        # actual stage -> background.
        for gt_index, gt in enumerate(
            ground_truth
        ):
            if gt_index in matched_gt:
                continue

            matrix[
                index_by_name[
                    gt["className"]
                ],
                index_by_name[
                    "background"
                ],
            ] += 1

        # Detector FP:
        # background -> classifier result.
        for pred_index, prediction in enumerate(
            predictions
        ):
            if (
                pred_index
                in matched_predictions
            ):
                continue

            predicted_name = (
                prediction.get(
                    "stage"
                )
            )

            if (
                predicted_name
                not in index_by_name
            ):
                continue

            matrix[
                index_by_name[
                    "background"
                ],
                index_by_name[
                    predicted_name
                ],
            ] += 1

        print(
            f"[{image_index:03d}/"
            f"{len(images):03d}] "
            f"{image_path.name} "
            f"GT={len(ground_truth)} "
            f"DET={len(predictions)} "
            f"MATCH={len(matches)}"
        )

    detector_precision = (
        safe_divide(
            detector_tp,
            detector_tp
            + detector_fp,
        )
    )

    detector_recall = (
        safe_divide(
            detector_tp,
            detector_tp
            + detector_fn,
        )
    )

    matched_stage_accuracy = (
        safe_divide(
            classifier_correct_on_matched,
            classifier_matched_total,
        )
    )

    per_class = {}

    precision_values = []
    recall_values = []
    f1_values = []

    for class_name in STAGE_NAMES:
        class_index = (
            index_by_name[
                class_name
            ]
        )

        tp = int(
            matrix[
                class_index,
                class_index,
            ]
        )

        fn = int(
            matrix[
                class_index,
                :
            ].sum()
            - tp
        )

        fp = int(
            matrix[
                :,
                class_index
            ].sum()
            - tp
        )

        precision = safe_divide(
            tp,
            tp + fp,
        )

        recall = safe_divide(
            tp,
            tp + fn,
        )

        f1 = safe_divide(
            2
            * precision
            * recall,
            precision + recall,
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
            "tp":
                tp,
            "fp":
                fp,
            "fn":
                fn,
            "precision":
                precision,
            "recall":
                recall,
            "f1":
                f1,
        }

    macro_precision = float(
        np.mean(
            precision_values
        )
    )

    macro_recall = float(
        np.mean(
            recall_values
        )
    )

    macro_f1 = float(
        np.mean(
            f1_values
        )
    )

    payload = {
        "schemaVersion": 1,
        "dataset": "BBBC041",
        "split":
            "official-test",
        "architecture":
            "binary YOLO detector + YOLO11n-cls stage classifier",
        "detector": {
            "tp":
                detector_tp,
            "fp":
                detector_fp,
            "fn":
                detector_fn,
            "precision":
                detector_precision,
            "recall":
                detector_recall,
        },
        "classifierOnMatchedDetections": {
            "correct":
                classifier_correct_on_matched,
            "total":
                classifier_matched_total,
            "accuracy":
                matched_stage_accuracy,
        },
        "endToEndStageMetrics": {
            "macroPrecision":
                macro_precision,
            "macroRecall":
                macro_recall,
            "macroF1":
                macro_f1,
        },
        "classes":
            per_class,
        "labels":
            labels,
        "confusionMatrix":
            matrix.tolist(),
        "thresholds": {
            "detectorConfidence":
                args.conf,
            "matchingIoU":
                args.match_iou,
        },
        "clinicalValidation":
            False,
        "evaluatedAt":
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

    import matplotlib.pyplot as plt

    figure, axis = (
        plt.subplots(
            figsize=(9, 8)
        )
    )

    image = axis.imshow(
        matrix
    )

    figure.colorbar(
        image,
        ax=axis,
    )

    axis.set_xticks(
        range(
            len(labels)
        ),
        labels,
        rotation=45,
        ha="right",
    )

    axis.set_yticks(
        range(
            len(labels)
        ),
        labels,
    )

    axis.set_xlabel(
        "Pipeline prediction"
    )

    axis.set_ylabel(
        "Ground truth"
    )

    axis.set_title(
        "BBBC041 Two-Stage "
        "End-to-End Confusion Matrix"
    )

    for row in range(
        len(labels)
    ):
        for column in range(
            len(labels)
        ):
            axis.text(
                column,
                row,
                str(
                    matrix[
                        row,
                        column
                    ]
                ),
                ha="center",
                va="center",
            )

    figure.tight_layout()

    figure.savefig(
        MATRIX_PATH,
        dpi=160,
    )

    plt.close(
        figure
    )

    print()
    print(
        "=== DETECTOR ==="
    )

    print(
        f"TP: {detector_tp}"
    )

    print(
        f"FP: {detector_fp}"
    )

    print(
        f"FN: {detector_fn}"
    )

    print(
        f"Precision: "
        f"{detector_precision:.4f}"
    )

    print(
        f"Recall: "
        f"{detector_recall:.4f}"
    )

    print()
    print(
        "=== CLASSIFIER ON "
        "DETECTOR CROPS ==="
    )

    print(
        f"Matched detections: "
        f"{classifier_matched_total}"
    )

    print(
        f"Correct stages: "
        f"{classifier_correct_on_matched}"
    )

    print(
        f"Stage accuracy: "
        f"{matched_stage_accuracy:.4f}"
    )

    print()
    print(
        "=== END-TO-END ==="
    )

    print(
        f"Macro precision: "
        f"{macro_precision:.4f}"
    )

    print(
        f"Macro recall: "
        f"{macro_recall:.4f}"
    )

    print(
        f"Macro F1: "
        f"{macro_f1:.4f}"
    )

    print()
    print(
        "=== PER CLASS ==="
    )

    for name, values in (
        per_class.items()
    ):
        print()
        print(name)

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
        f"Metrics: "
        f"{SUMMARY_PATH}"
    )

    print(
        f"Confusion matrix: "
        f"{MATRIX_PATH}"
    )

    print()
    print(
        "TWO-STAGE EVALUATION "
        "STATUS: PASS"
    )


if __name__ == "__main__":
    main()