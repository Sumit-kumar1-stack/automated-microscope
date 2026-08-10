from __future__ import annotations

import argparse
from pathlib import Path

import torch
from ultralytics import YOLO


BASE_DIR = Path(__file__).resolve().parent

DATASET = (
    BASE_DIR
    / "data"
    / "yolo-binary-parasite-pilot"
    / "dataset.yaml"
)

RUNS = (
    BASE_DIR
    / "outputs"
    / "ml-runs"
)


def parse_args():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--epochs",
        type=int,
        default=8,
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


def main():
    args = parse_args()

    if not DATASET.exists():
        raise FileNotFoundError(
            f"Dataset missing: "
            f"{DATASET}"
        )

    device = (
        0
        if torch.cuda.is_available()
        else "cpu"
    )

    print(
        "=== BBBC041 BINARY "
        "PARASITE DETECTOR ==="
    )

    print(
        f"Epochs: {args.epochs}"
    )

    print(
        f"Image size: {args.imgsz}"
    )

    print(
        f"Device: {device}"
    )

    model = YOLO(
        "yolo11n.pt"
    )

    result = model.train(
        data=str(DATASET),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,

        device=device,
        workers=2,

        seed=41,
        deterministic=True,

        pretrained=True,

        patience=6,

        project=str(RUNS),

        name=(
            "bbbc041-binary-parasite"
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

    best_model = (
        Path(result.save_dir)
        / "weights"
        / "best.pt"
    )

    print()
    print(
        "=== TRAINING COMPLETE ==="
    )

    print(
        "Best model:"
    )

    print(
        best_model
    )


if __name__ == "__main__":
    main()