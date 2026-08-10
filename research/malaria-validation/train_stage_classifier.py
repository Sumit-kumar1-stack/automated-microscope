from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import torch
from ultralytics import YOLO


BASE_DIR = Path(__file__).resolve().parent

DATASET_ROOT = (
    BASE_DIR
    / "data"
    / "stage-classifier-balanced"
)

RUNS_DIR = (
    BASE_DIR
    / "outputs"
    / "ml-runs"
)

SUMMARY_PATH = (
    BASE_DIR
    / "outputs"
    / "stage_classifier_training_summary.json"
)


def parse_args():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--epochs",
        type=int,
        default=10,
    )

    parser.add_argument(
        "--imgsz",
        type=int,
        default=224,
    )

    parser.add_argument(
        "--batch",
        type=int,
        default=16,
    )

    parser.add_argument(
        "--name",
        type=str,
        default="bbbc041-stage-classifier",
    )

    return parser.parse_args()


def main():
    args = parse_args()

    train_dir = (
        DATASET_ROOT
        / "train"
    )

    val_dir = (
        DATASET_ROOT
        / "val"
    )

    if not train_dir.exists():
        raise FileNotFoundError(
            f"Missing training data: "
            f"{train_dir}"
        )

    if not val_dir.exists():
        raise FileNotFoundError(
            f"Missing validation data: "
            f"{val_dir}"
        )

    RUNS_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    device = (
        0
        if torch.cuda.is_available()
        else "cpu"
    )

    print(
        "=== BBBC041 PARASITE "
        "STAGE CLASSIFIER ==="
    )

    print(
        f"Dataset: {DATASET_ROOT}"
    )

    print(
        f"Epochs: {args.epochs}"
    )

    print(
        f"Image size: {args.imgsz}"
    )

    print(
        f"Batch: {args.batch}"
    )

    print(
        f"Device: {device}"
    )

    model = YOLO(
        "yolo11n-cls.pt"
    )

    results = model.train(
        data=str(
            DATASET_ROOT
        ),

        epochs=args.epochs,

        imgsz=args.imgsz,

        batch=args.batch,

        device=device,

        workers=2,

        seed=41,

        deterministic=True,

        pretrained=True,

        patience=5,

        project=str(
            RUNS_DIR
        ),

        name=args.name,

        exist_ok=True,

        plots=True,

        save=True,

        verbose=True,
    )

    run_dir = Path(
        results.save_dir
    )

    best_model = (
        run_dir
        / "weights"
        / "best.pt"
    )

    summary = {
        "schemaVersion": 1,
        "dataset": "BBBC041",
        "task": (
            "parasite-stage "
            "classification"
        ),
        "architecture":
            "YOLO11n-cls",
        "epochs":
            args.epochs,
        "imageSize":
            args.imgsz,
        "batch":
            args.batch,
        "device":
            str(device),
        "bestModel":
            str(best_model),
        "completedAt":
            datetime.now(
                timezone.utc
            ).isoformat(),
        "clinicalValidation":
            False,
    }

    SUMMARY_PATH.write_text(
        json.dumps(
            summary,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print()
    print(
        "=== TRAINING COMPLETE ==="
    )

    print(
        "Best model:"
    )

    print(
        f"  {best_model}"
    )


if __name__ == "__main__":
    main()