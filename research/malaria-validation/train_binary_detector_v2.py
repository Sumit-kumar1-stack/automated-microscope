from __future__ import annotations

import json
from pathlib import Path

from ultralytics import YOLO


# ============================================================
# CONFIG
# ============================================================

ROOT = Path(
    "research/malaria-validation"
)

CLEAN_DATASET = (
    ROOT
    / "data"
    / "yolo-binary-full"
    / "dataset.yaml"
)

STRESS_DATASET = (
    ROOT
    / "data"
    / "yolo-binary-stress"
    / "dataset.yaml"
)

RUNS_ROOT = (
    ROOT
    / "outputs"
    / "binary-detector-v2"
)

TRAIN_RUN_NAME = (
    "train-full-clean"
)

CLEAN_EVAL_NAME = (
    "eval-clean-val"
)

STRESS_EVAL_NAME = (
    "eval-stress-val"
)

SEED = 41

EPOCHS = 10
IMAGE_SIZE = 512
BATCH_SIZE = 4


# ============================================================
# HELPERS
# ============================================================

def metric_summary(
    metrics,
) -> dict[str, float]:
    return {
        "precision": float(
            metrics.box.mp
        ),
        "recall": float(
            metrics.box.mr
        ),
        "map50": float(
            metrics.box.map50
        ),
        "map50_95": float(
            metrics.box.map
        ),
    }


# ============================================================
# MAIN
# ============================================================

def main() -> None:
    print(
        "=== BINARY PARASITE DETECTOR V2 ==="
    )

    print()
    print(
        f"Clean dataset: "
        f"{CLEAN_DATASET.resolve()}"
    )

    print(
        f"Stress dataset: "
        f"{STRESS_DATASET.resolve()}"
    )

    print(
        f"Epochs: {EPOCHS}"
    )

    print(
        f"Image size: {IMAGE_SIZE}"
    )

    print(
        f"Batch size: {BATCH_SIZE}"
    )

    print(
        "Device: CPU"
    )

    print()

    if not CLEAN_DATASET.exists():
        raise FileNotFoundError(
            CLEAN_DATASET
        )

    if not STRESS_DATASET.exists():
        raise FileNotFoundError(
            STRESS_DATASET
        )

    RUNS_ROOT.mkdir(
        parents=True,
        exist_ok=True,
    )

    # --------------------------------------------------------
    # MODEL
    # --------------------------------------------------------

    model = YOLO(
        "yolo11n.pt"
    )

    # --------------------------------------------------------
    # TRAIN
    # --------------------------------------------------------

    print(
        "=== TRAINING V2 ==="
    )

    model.train(
        data=str(
            CLEAN_DATASET.resolve()
        ),

        epochs=EPOCHS,

        imgsz=IMAGE_SIZE,

        batch=BATCH_SIZE,

        device="cpu",

        workers=0,

        seed=SEED,

        deterministic=True,

        pretrained=True,

        optimizer="auto",

        patience=5,

        amp=False,

        cache=False,

        plots=True,

        save=True,

        project=str(
            RUNS_ROOT.resolve()
        ),

        name=TRAIN_RUN_NAME,

        exist_ok=True,

        # ----------------------------------------------
        # Generic development augmentation.
        # These are NOT tuned against the official
        # BBBC041 test split.
        # ----------------------------------------------

        hsv_h=0.015,

        hsv_s=0.50,

        hsv_v=0.40,

        degrees=3.0,

        translate=0.05,

        scale=0.15,

        shear=0.0,

        perspective=0.0,

        flipud=0.5,

        fliplr=0.5,

        mosaic=0.5,

        mixup=0.0,
    )

    best_model_path = (
        RUNS_ROOT
        / TRAIN_RUN_NAME
        / "weights"
        / "best.pt"
    )

    last_model_path = (
        RUNS_ROOT
        / TRAIN_RUN_NAME
        / "weights"
        / "last.pt"
    )

    if not best_model_path.exists():
        raise FileNotFoundError(
            "Training completed but "
            f"best.pt was not found: "
            f"{best_model_path}"
        )

    print()
    print(
        f"Best model: "
        f"{best_model_path.resolve()}"
    )

    # --------------------------------------------------------
    # LOAD FROZEN DEVELOPMENT MODEL
    # --------------------------------------------------------

    best_model = YOLO(
        str(
            best_model_path.resolve()
        )
    )

    # --------------------------------------------------------
    # CLEAN VALIDATION
    # --------------------------------------------------------

    print()
    print(
        "=== CLEAN VALIDATION ==="
    )

    clean_metrics = (
        best_model.val(
            data=str(
                CLEAN_DATASET.resolve()
            ),

            split="val",

            imgsz=IMAGE_SIZE,

            batch=BATCH_SIZE,

            device="cpu",

            workers=0,

            plots=True,

            project=str(
                RUNS_ROOT.resolve()
            ),

            name=CLEAN_EVAL_NAME,

            exist_ok=True,
        )
    )

    clean_summary = (
        metric_summary(
            clean_metrics
        )
    )

    # --------------------------------------------------------
    # STRESS VALIDATION
    # --------------------------------------------------------

    print()
    print(
        "=== STRESS VALIDATION ==="
    )

    stress_metrics = (
        best_model.val(
            data=str(
                STRESS_DATASET.resolve()
            ),

            split="val",

            imgsz=IMAGE_SIZE,

            batch=BATCH_SIZE,

            device="cpu",

            workers=0,

            plots=True,

            project=str(
                RUNS_ROOT.resolve()
            ),

            name=STRESS_EVAL_NAME,

            exist_ok=True,
        )
    )

    stress_summary = (
        metric_summary(
            stress_metrics
        )
    )

    # --------------------------------------------------------
    # ROBUSTNESS GAP
    # --------------------------------------------------------

    robustness_gap = {
        "precision_drop":
            clean_summary[
                "precision"
            ]
            - stress_summary[
                "precision"
            ],

        "recall_drop":
            clean_summary[
                "recall"
            ]
            - stress_summary[
                "recall"
            ],

        "map50_drop":
            clean_summary[
                "map50"
            ]
            - stress_summary[
                "map50"
            ],

        "map50_95_drop":
            clean_summary[
                "map50_95"
            ]
            - stress_summary[
                "map50_95"
            ],
    }

    # --------------------------------------------------------
    # SAVE SUMMARY
    # --------------------------------------------------------

    summary = {
        "experiment":
            "binary-parasite-detector-v2",

        "seed":
            SEED,

        "device":
            "cpu",

        "model":
            "yolo11n.pt",

        "epochs":
            EPOCHS,

        "image_size":
            IMAGE_SIZE,

        "batch_size":
            BATCH_SIZE,

        "training_dataset": {
            "images": 966,
            "parasite_objects": 1563,
            "positive_images": 664,
            "negative_images": 302,
        },

        "clean_validation": {
            "images": 242,
            "parasite_objects": 586,
            **clean_summary,
        },

        "stress_validation": {
            "images": 242,
            "parasite_objects": 586,
            **stress_summary,
        },

        "robustness_gap":
            robustness_gap,

        "official_test_used":
            False,

        "best_model":
            str(
                best_model_path.resolve()
            ),

        "last_model":
            str(
                last_model_path.resolve()
            ),
    }

    summary_path = (
        RUNS_ROOT
        / "v2_development_metrics.json"
    )

    summary_path.write_text(
        json.dumps(
            summary,
            indent=2,
        ),
        encoding="utf-8",
    )

    # --------------------------------------------------------
    # REPORT
    # --------------------------------------------------------

    print()
    print(
        "========================================"
    )

    print(
        "BINARY DETECTOR V2 DEVELOPMENT RESULTS"
    )

    print(
        "========================================"
    )

    print()
    print(
        "CLEAN VALIDATION"
    )

    for key, value in (
        clean_summary.items()
    ):
        print(
            f" {key:12s}: "
            f"{value:.4f}"
        )

    print()
    print(
        "STRESS VALIDATION"
    )

    for key, value in (
        stress_summary.items()
    ):
        print(
            f" {key:12s}: "
            f"{value:.4f}"
        )

    print()
    print(
        "ROBUSTNESS GAP"
    )

    for key, value in (
        robustness_gap.items()
    ):
        print(
            f" {key:16s}: "
            f"{value:.4f}"
        )

    print()
    print(
        f"Summary: "
        f"{summary_path.resolve()}"
    )

    print()
    print(
        "OFFICIAL TEST USED: NO"
    )

    print()
    print(
        "V2 DEVELOPMENT TRAINING COMPLETE"
    )


if __name__ == "__main__":
    main()