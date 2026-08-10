from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

from PIL import Image
from ultralytics import YOLO


# ============================================================
# CONFIG
# ============================================================

ROOT = Path(
    "research/malaria-validation"
)

MODEL_PATH = (
    ROOT
    / "outputs"
    / "binary-detector-v2"
    / "train-full-clean"
    / "weights"
    / "best.pt"
)

CLEAN_IMAGE_DIR = (
    ROOT
    / "data"
    / "yolo-binary-full"
    / "images"
    / "val"
)

CLEAN_LABEL_DIR = (
    ROOT
    / "data"
    / "yolo-binary-full"
    / "labels"
    / "val"
)

STRESS_IMAGE_DIR = (
    ROOT
    / "data"
    / "yolo-binary-stress"
    / "images"
    / "val"
)

STRESS_LABEL_DIR = (
    ROOT
    / "data"
    / "yolo-binary-stress"
    / "labels"
    / "val"
)

STRESS_MANIFEST = (
    ROOT
    / "outputs"
    / "domain-stress-validation"
    / "manifest.json"
)

OUTPUT_DIR = (
    ROOT
    / "outputs"
    / "binary-detector-v2"
    / "fixed-threshold-analysis"
)

CONF_THRESHOLD = 0.25
IOU_THRESHOLD = 0.50
IMAGE_SIZE = 512

SUPPORTED_IMAGES = {
    ".png",
    ".jpg",
    ".jpeg",
}


# ============================================================
# BOX HELPERS
# ============================================================

def read_ground_truth(
    label_path: Path,
    width: int,
    height: int,
) -> list[list[float]]:
    boxes: list[list[float]] = []

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

        _, xc, yc, bw, bh = map(
            float,
            parts,
        )

        xc *= width
        yc *= height
        bw *= width
        bh *= height

        x1 = xc - bw / 2
        y1 = yc - bh / 2
        x2 = xc + bw / 2
        y2 = yc + bh / 2

        boxes.append(
            [
                x1,
                y1,
                x2,
                y2,
            ]
        )

    return boxes


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


# ============================================================
# MATCHING
# ============================================================

def match_predictions(
    ground_truth: list[list[float]],
    predictions: list[
        tuple[list[float], float]
    ],
) -> tuple[
    int,
    int,
    int,
]:
    matched_gt: set[int] = set()

    true_positive = 0
    false_positive = 0

    predictions = sorted(
        predictions,
        key=lambda item: item[1],
        reverse=True,
    )

    for prediction_box, _confidence in predictions:
        best_iou = 0.0
        best_gt_index: int | None = None

        for gt_index, gt_box in enumerate(
            ground_truth
        ):
            if gt_index in matched_gt:
                continue

            iou = box_iou(
                prediction_box,
                gt_box,
            )

            if iou > best_iou:
                best_iou = iou
                best_gt_index = gt_index

        if (
            best_gt_index is not None
            and best_iou >= IOU_THRESHOLD
        ):
            true_positive += 1

            matched_gt.add(
                best_gt_index
            )

        else:
            false_positive += 1

    false_negative = (
        len(ground_truth)
        - len(matched_gt)
    )

    return (
        true_positive,
        false_positive,
        false_negative,
    )


# ============================================================
# METRICS
# ============================================================

def calculate_metrics(
    tp: int,
    fp: int,
    fn: int,
) -> dict[str, float | int]:
    precision = (
        tp / (tp + fp)
        if tp + fp > 0
        else 0.0
    )

    recall = (
        tp / (tp + fn)
        if tp + fn > 0
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
        if precision + recall > 0
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


# ============================================================
# STRESS LOOKUP
# ============================================================

def load_stress_lookup() -> dict[str, str]:
    data = json.loads(
        STRESS_MANIFEST.read_text(
            encoding="utf-8",
        )
    )

    lookup: dict[str, str] = {}

    for sample in data[
        "samples"
    ]:
        output_path = Path(
            sample[
                "output_image"
            ]
        )

        lookup[
            output_path.stem
        ] = sample[
            "stress_type"
        ]

    return lookup


# ============================================================
# EVALUATION
# ============================================================

def evaluate_directory(
    model: YOLO,
    image_dir: Path,
    label_dir: Path,
    stress_lookup: dict[str, str] | None = None,
) -> tuple[
    dict,
    dict[str, dict],
    list[dict],
]:
    aggregate = {
        "tp": 0,
        "fp": 0,
        "fn": 0,
    }

    group_counts = defaultdict(
        lambda: {
            "tp": 0,
            "fp": 0,
            "fn": 0,
            "images": 0,
        }
    )

    error_records: list[dict] = []

    images = sorted(
        path
        for path
        in image_dir.iterdir()
        if (
            path.is_file()
            and path.suffix.lower()
            in SUPPORTED_IMAGES
        )
    )

    for index, image_path in enumerate(
        images,
        start=1,
    ):
        label_path = (
            label_dir
            / f"{image_path.stem}.txt"
        )

        with Image.open(
            image_path,
        ) as image:
            width, height = (
                image.size
            )

        gt_boxes = read_ground_truth(
            label_path,
            width,
            height,
        )

        results = model.predict(
            source=str(
                image_path
            ),
            imgsz=IMAGE_SIZE,
            conf=CONF_THRESHOLD,
            device="cpu",
            verbose=False,
        )

        result = results[0]

        predictions: list[
            tuple[
                list[float],
                float,
            ]
        ] = []

        if result.boxes is not None:
            xyxy = (
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
                xyxy,
                confidences,
            ):
                predictions.append(
                    (
                        [
                            float(box[0]),
                            float(box[1]),
                            float(box[2]),
                            float(box[3]),
                        ],
                        float(
                            confidence
                        ),
                    )
                )

        tp, fp, fn = (
            match_predictions(
                gt_boxes,
                predictions,
            )
        )

        aggregate["tp"] += tp
        aggregate["fp"] += fp
        aggregate["fn"] += fn

        group = (
            stress_lookup.get(
                image_path.stem,
                "unknown",
            )
            if stress_lookup
            else "clean"
        )

        group_counts[
            group
        ]["tp"] += tp

        group_counts[
            group
        ]["fp"] += fp

        group_counts[
            group
        ]["fn"] += fn

        group_counts[
            group
        ]["images"] += 1

        if fp > 0 or fn > 0:
            error_records.append(
                {
                    "image":
                        str(
                            image_path
                        ),
                    "group":
                        group,
                    "ground_truth":
                        len(
                            gt_boxes
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
                }
            )

        if (
            index % 25 == 0
            or index
            == len(images)
        ):
            print(
                f" {index}/"
                f"{len(images)}"
            )

    overall = (
        calculate_metrics(
            aggregate["tp"],
            aggregate["fp"],
            aggregate["fn"],
        )
    )

    groups: dict[
        str,
        dict,
    ] = {}

    for name, values in (
        group_counts.items()
    ):
        groups[name] = {
            "images":
                values[
                    "images"
                ],
            **calculate_metrics(
                values["tp"],
                values["fp"],
                values["fn"],
            ),
        }

    return (
        overall,
        groups,
        error_records,
    )


# ============================================================
# MAIN
# ============================================================

def main() -> None:
    print(
        "=== BINARY DETECTOR V2 FIXED-THRESHOLD ANALYSIS ==="
    )

    print(
        f"Confidence threshold: "
        f"{CONF_THRESHOLD}"
    )

    print(
        f"IoU threshold: "
        f"{IOU_THRESHOLD}"
    )

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            MODEL_PATH
        )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    model = YOLO(
        str(
            MODEL_PATH.resolve()
        )
    )

    # --------------------------------------------------------
    # CLEAN
    # --------------------------------------------------------

    print()
    print(
        "=== CLEAN VALIDATION ==="
    )

    (
        clean_metrics,
        _clean_groups,
        clean_errors,
    ) = evaluate_directory(
        model,
        CLEAN_IMAGE_DIR,
        CLEAN_LABEL_DIR,
    )

    # --------------------------------------------------------
    # STRESS
    # --------------------------------------------------------

    print()
    print(
        "=== STRESS VALIDATION ==="
    )

    stress_lookup = (
        load_stress_lookup()
    )

    (
        stress_metrics,
        stress_groups,
        stress_errors,
    ) = evaluate_directory(
        model,
        STRESS_IMAGE_DIR,
        STRESS_LABEL_DIR,
        stress_lookup,
    )

    # --------------------------------------------------------
    # SAVE
    # --------------------------------------------------------

    result = {
        "model":
            str(
                MODEL_PATH.resolve()
            ),

        "confidence_threshold":
            CONF_THRESHOLD,

        "iou_threshold":
            IOU_THRESHOLD,

        "official_test_used":
            False,

        "clean_validation":
            clean_metrics,

        "stress_validation":
            stress_metrics,

        "stress_breakdown":
            stress_groups,

        "clean_error_images":
            len(
                clean_errors
            ),

        "stress_error_images":
            len(
                stress_errors
            ),
    }

    metrics_path = (
        OUTPUT_DIR
        / "metrics.json"
    )

    metrics_path.write_text(
        json.dumps(
            result,
            indent=2,
        ),
        encoding="utf-8",
    )

    errors_path = (
        OUTPUT_DIR
        / "error_images.json"
    )

    errors_path.write_text(
        json.dumps(
            {
                "clean":
                    clean_errors,
                "stress":
                    stress_errors,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    # --------------------------------------------------------
    # DISPLAY
    # --------------------------------------------------------

    print()
    print(
        "========================================"
    )

    print(
        "FIXED-THRESHOLD RESULTS"
    )

    print(
        "========================================"
    )

    print()
    print(
        "CLEAN"
    )

    for key, value in (
        clean_metrics.items()
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
        "STRESS"
    )

    for key, value in (
        stress_metrics.items()
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
        "STRESS BREAKDOWN"
    )

    for name in sorted(
        stress_groups
    ):
        metrics = (
            stress_groups[
                name
            ]
        )

        print()
        print(
            f" {name}"
        )

        print(
            f"   images: "
            f"{metrics['images']}"
        )

        print(
            f"   TP: "
            f"{metrics['tp']}"
        )

        print(
            f"   FP: "
            f"{metrics['fp']}"
        )

        print(
            f"   FN: "
            f"{metrics['fn']}"
        )

        print(
            f"   P:  "
            f"{metrics['precision']:.4f}"
        )

        print(
            f"   R:  "
            f"{metrics['recall']:.4f}"
        )

        print(
            f"   F1: "
            f"{metrics['f1']:.4f}"
        )

    print()
    print(
        f"Metrics: "
        f"{metrics_path.resolve()}"
    )

    print(
        f"Errors: "
        f"{errors_path.resolve()}"
    )

    print()
    print(
        "OFFICIAL TEST USED: NO"
    )


if __name__ == "__main__":
    main()