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
    / "yolo-pilot"
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
    / "baseline_training_summary.json"
)

DEFAULT_MODEL = "yolo11n.pt"
DEFAULT_EPOCHS = 15
DEFAULT_IMAGE_SIZE = 640
DEFAULT_BATCH = 8
DEFAULT_SEED = 41


def utc_now() -> str:
    return datetime.now(
        timezone.utc
    ).isoformat()


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Train a research-only "
            "BBBC041 YOLO baseline."
        )
    )

    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
    )

    parser.add_argument(
        "--epochs",
        type=int,
        default=DEFAULT_EPOCHS,
    )

    parser.add_argument(
        "--imgsz",
        type=int,
        default=DEFAULT_IMAGE_SIZE,
    )

    parser.add_argument(
        "--batch",
        type=int,
        default=DEFAULT_BATCH,
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not DATASET_YAML.exists():
        raise FileNotFoundError(
            f"Dataset YAML missing: "
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
        "=== BBBC041 YOLO BASELINE ==="
    )

    print(
        f"Dataset: {DATASET_YAML}"
    )

    print(
        f"Model: {args.model}"
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

    if torch.cuda.is_available():
        print(
            "GPU:",
            torch.cuda.get_device_name(
                0
            ),
        )
    else:
        print(
            "WARNING: CUDA GPU not "
            "detected. Training will "
            "run on CPU."
        )

    model = YOLO(
        args.model
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
        seed=DEFAULT_SEED,
        deterministic=True,
        patience=8,
        pretrained=True,

        project=str(
            RUNS_DIR
        ),

        name="bbbc041-baseline",

        exist_ok=True,

        # Useful training augmentations,
        # deliberately kept moderate for
        # microscopy.
        degrees=5.0,
        translate=0.05,
        scale=0.20,
        fliplr=0.5,
        flipud=0.5,
        mosaic=0.5,

        # Preserve experiment artifacts.
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

    last_model = (
        run_directory
        / "weights"
        / "last.pt"
    )

    summary = {
        "schemaVersion": 1,
        "dataset": "BBBC041",
        "datasetType": (
            "rare-class-enriched "
            "engineering pilot"
        ),
        "clinicalValidation": False,
        "startedWithModel":
            args.model,
        "epochs":
            args.epochs,
        "imageSize":
            args.imgsz,
        "batchSize":
            args.batch,
        "seed":
            DEFAULT_SEED,
        "device":
            str(device),
        "cudaAvailable":
            torch.cuda.is_available(),
        "gpu": (
            torch.cuda.get_device_name(
                0
            )
            if torch.cuda.is_available()
            else None
        ),
        "runDirectory":
            str(run_directory),
        "bestModel":
            str(best_model),
        "lastModel":
            str(last_model),
        "completedAt":
            utc_now(),
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

    print(
        "Summary:"
    )

    print(
        f"  {SUMMARY_PATH}"
    )

    print()
    print(
        "IMPORTANT:"
    )

    print(
        "This is an engineering "
        "research baseline only."
    )

    print(
        "It is not a clinically "
        "validated diagnostic model."
    )


if __name__ == "__main__":
    main()