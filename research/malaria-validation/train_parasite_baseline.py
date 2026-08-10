from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import torch
from ultralytics import YOLO


BASE_DIR = Path(__file__).resolve().parent

DATASET_YAML = (
    BASE_DIR
    / "data"
    / "yolo-parasite-pilot"
    / "dataset.yaml"
)

RUNS_DIR = (
    BASE_DIR
    / "outputs"
    / "ml-runs"
)

SUMMARY_PATH = (
    BASE_DIR
    / "outputs"
    / "parasite_baseline_summary.json"
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
        default=512,
    )

    parser.add_argument(
        "--batch",
        type=int,
        default=4,
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not DATASET_YAML.exists():
        raise FileNotFoundError(
            f"Missing dataset: "
            f"{DATASET_YAML}"
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
        "DETECTOR BASELINE ==="
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
        "yolo11n.pt"
    )

    results = model.train(
        data=str(
            DATASET_YAML
        ),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=device,
        workers=2,
        seed=41,
        deterministic=True,
        pretrained=True,
        patience=6,

        project=str(
            RUNS_DIR
        ),

        name=(
            "bbbc041-parasite-baseline"
        ),

        exist_ok=True,

        degrees=5.0,
        translate=0.05,
        scale=0.20,

        fliplr=0.5,
        flipud=0.5,

        mosaic=0.5,

        plots=True,
        save=True,
        verbose=True,
    )

    run_directory = Path(
        results.save_dir
    )

    best_model = (
        run_directory
        / "weights"
        / "best.pt"
    )

    summary = {
        "schemaVersion": 1,
        "dataset": "BBBC041",
        "task": (
            "four-class malaria "
            "parasite-stage detection"
        ),
        "classes": [
            "ring",
            "trophozoite",
            "schizont",
            "gametocyte",
        ],
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
        "Best weights:"
    )

    print(
        f"  {best_model}"
    )


if __name__ == "__main__":
    main()