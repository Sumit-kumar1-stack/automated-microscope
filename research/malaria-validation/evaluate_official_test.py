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
    / "yolo-parasite-official-test"
    / "dataset.yaml"
)

RUN_DIR = (
    BASE_DIR
    / "outputs"
    / "ml-runs"
)

OUTPUT_JSON = (
    BASE_DIR
    / "outputs"
    / "official_test_metrics.json"
)


def main() -> None:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model missing: "
            f"{MODEL_PATH}"
        )

    if not DATASET_YAML.exists():
        raise FileNotFoundError(
            f"Dataset missing: "
            f"{DATASET_YAML}"
        )

    device = (
        0
        if torch.cuda.is_available()
        else "cpu"
    )

    print(
        "=== BBBC041 OFFICIAL TEST "
        "EVALUATION ==="
    )

    print(
        f"Model: {MODEL_PATH}"
    )

    print(
        f"Device: {device}"
    )

    model = YOLO(
        str(MODEL_PATH)
    )

    metrics = model.val(
        data=str(
            DATASET_YAML
        ),
        split="test",
        imgsz=512,
        batch=4,
        device=device,
        workers=2,
        plots=True,

        project=str(
            RUN_DIR
        ),

        name=(
            "bbbc041-parasite-"
            "official-test"
        ),

        exist_ok=True,
        verbose=True,
    )

    box = metrics.box

    result = {
        "schemaVersion": 1,
        "dataset": "BBBC041",
        "split":
            "official-test",
        "model":
            "YOLO11n parasite baseline",
        "precision":
            float(box.mp),
        "recall":
            float(box.mr),
        "mAP50":
            float(box.map50),
        "mAP50_95":
            float(box.map),
        "imageSize":
            512,
        "evaluatedAt":
            datetime.now(
                timezone.utc
            ).isoformat(),
        "clinicalValidation":
            False,
    }

    OUTPUT_JSON.write_text(
        json.dumps(
            result,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print()
    print(
        "=== OFFICIAL TEST METRICS ==="
    )

    print(
        f"Precision: "
        f"{box.mp:.4f}"
    )

    print(
        f"Recall: "
        f"{box.mr:.4f}"
    )

    print(
        f"mAP50: "
        f"{box.map50:.4f}"
    )

    print(
        f"mAP50-95: "
        f"{box.map:.4f}"
    )

    print()
    print(
        "IMPORTANT:"
    )

    print(
        "This is an engineering "
        "research benchmark, not "
        "clinical validation."
    )


if __name__ == "__main__":
    main()