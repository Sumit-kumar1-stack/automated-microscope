from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

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

DATASET_YAML = (
    BASE_DIR
    / "data"
    / "yolo-parasite-pilot"
    / "dataset.yaml"
)

OUTPUT_PATH = (
    BASE_DIR
    / "outputs"
    / "parasite_validation_detailed.json"
)


def main() -> None:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Missing model: {MODEL_PATH}"
        )

    device = (
        0
        if torch.cuda.is_available()
        else "cpu"
    )

    model = YOLO(
        str(MODEL_PATH)
    )

    print(
        "=== PARASITE MODEL "
        "DETAILED VALIDATION ==="
    )

    metrics = model.val(
        data=str(DATASET_YAML),
        split="val",
        imgsz=512,
        batch=4,
        device=device,
        workers=2,
        plots=True,
        verbose=True,
    )

    box = metrics.box

    names = metrics.names

    class_results = {}

    for class_id, name in names.items():

        result = box.class_result(
            class_id
        )

        precision = float(
            result[0]
        )

        recall = float(
            result[1]
        )

        map50 = float(
            result[2]
        )

        map5095 = float(
            result[3]
        )

        class_results[
            name
        ] = {
            "precision":
                precision,
            "recall":
                recall,
            "mAP50":
                map50,
            "mAP50_95":
                map5095,
        }

    payload = {
        "schemaVersion": 1,
        "dataset": "BBBC041",
        "split": "pilot-validation",
        "model":
            "YOLO11n parasite baseline",
        "aggregate": {
            "precision":
                float(box.mp),
            "recall":
                float(box.mr),
            "mAP50":
                float(box.map50),
            "mAP50_95":
                float(box.map),
        },
        "classes":
            class_results,
        "evaluatedAt":
            datetime.now(
                timezone.utc
            ).isoformat(),
        "clinicalValidation":
            False,
    }

    OUTPUT_PATH.write_text(
        json.dumps(
            payload,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print()
    print(
        "=== PER-CLASS RESULTS ==="
    )

    for name, result in (
        class_results.items()
    ):
        print()
        print(name)

        print(
            f"  Precision: "
            f"{result['precision']:.4f}"
        )

        print(
            f"  Recall: "
            f"{result['recall']:.4f}"
        )

        print(
            f"  mAP50: "
            f"{result['mAP50']:.4f}"
        )

        print(
            f"  mAP50-95: "
            f"{result['mAP50_95']:.4f}"
        )

    print()
    print(
        f"Saved: {OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()