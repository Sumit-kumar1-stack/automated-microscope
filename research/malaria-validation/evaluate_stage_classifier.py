from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import torch
from ultralytics import YOLO


BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = (
    BASE_DIR
    / "outputs"
    / "ml-runs"
    / "bbbc041-stage-classifier"
    / "weights"
    / "best.pt"
)

VAL_ROOT = (
    BASE_DIR
    / "data"
    / "stage-classifier-balanced"
    / "val"
)

OUTPUT_DIR = (
    BASE_DIR
    / "outputs"
    / "stage-classifier-evaluation"
)

JSON_PATH = (
    OUTPUT_DIR
    / "metrics.json"
)

MATRIX_PATH = (
    OUTPUT_DIR
    / "confusion_matrix.png"
)

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
}


def safe_divide(
    numerator: int,
    denominator: int,
) -> float:
    if denominator == 0:
        return 0.0

    return numerator / denominator


def main():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Missing model: {MODEL_PATH}"
        )

    if not VAL_ROOT.exists():
        raise FileNotFoundError(
            f"Missing validation set: {VAL_ROOT}"
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

    model = YOLO(
        str(MODEL_PATH)
    )

    names = {
        int(class_id): name
        for class_id, name
        in model.names.items()
    }

    name_to_id = {
        name: class_id
        for class_id, name
        in names.items()
    }

    print(
        "=== STAGE CLASSIFIER "
        "DETAILED EVALUATION ==="
    )

    print(
        "Class mapping:"
    )

    for class_id, name in names.items():
        print(
            f"  {class_id}: {name}"
        )

    class_count = len(names)

    confusion = np.zeros(
        (
            class_count,
            class_count,
        ),
        dtype=np.int64,
    )

    total = 0
    correct = 0

    confidence_sum = 0.0

    for class_dir in sorted(
        VAL_ROOT.iterdir()
    ):
        if not class_dir.is_dir():
            continue

        actual_name = (
            class_dir.name
        )

        if (
            actual_name
            not in name_to_id
        ):
            raise ValueError(
                f"Unknown validation "
                f"class: {actual_name}"
            )

        actual_id = (
            name_to_id[
                actual_name
            ]
        )

        image_paths = sorted(
            path
            for path
            in class_dir.iterdir()
            if (
                path.is_file()
                and path.suffix.lower()
                in IMAGE_EXTENSIONS
            )
        )

        print()
        print(
            f"Evaluating "
            f"{actual_name}: "
            f"{len(image_paths)} crops"
        )

        results = model.predict(
            source=[
                str(path)
                for path
                in image_paths
            ],
            imgsz=224,
            batch=16,
            device=device,
            verbose=False,
        )

        for image_path, result in zip(
            image_paths,
            results,
        ):
            if result.probs is None:
                raise RuntimeError(
                    "Classification "
                    "probabilities missing."
                )

            predicted_id = int(
                result.probs.top1
            )

            confidence = float(
                result.probs.top1conf
            )

            confusion[
                actual_id,
                predicted_id,
            ] += 1

            total += 1

            confidence_sum += (
                confidence
            )

            if (
                predicted_id
                == actual_id
            ):
                correct += 1

    overall_accuracy = (
        safe_divide(
            correct,
            total,
        )
    )

    per_class = {}

    precisions = []
    recalls = []
    f1_scores = []

    for class_id in range(
        class_count
    ):
        class_name = names[
            class_id
        ]

        tp = int(
            confusion[
                class_id,
                class_id,
            ]
        )

        fn = int(
            confusion[
                class_id,
                :
            ].sum()
            - tp
        )

        fp = int(
            confusion[
                :,
                class_id
            ].sum()
            - tp
        )

        support = int(
            confusion[
                class_id,
                :
            ].sum()
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
            precision
            + recall,
        )

        precisions.append(
            precision
        )

        recalls.append(
            recall
        )

        f1_scores.append(
            f1
        )

        per_class[
            class_name
        ] = {
            "support": support,
            "tp": tp,
            "fp": fp,
            "fn": fn,
            "precision": precision,
            "recall": recall,
            "f1": f1,
        }

    macro_precision = float(
        np.mean(
            precisions
        )
    )

    macro_recall = float(
        np.mean(
            recalls
        )
    )

    macro_f1 = float(
        np.mean(
            f1_scores
        )
    )

    payload = {
        "dataset": "BBBC041",
        "split": "pilot-validation",
        "model":
            "YOLO11n-cls stage classifier",
        "images": total,
        "accuracy":
            overall_accuracy,
        "macroPrecision":
            macro_precision,
        "macroRecall":
            macro_recall,
        "macroF1":
            macro_f1,
        "averageTop1Confidence":
            safe_divide(
                confidence_sum,
                total,
            ),
        "classes":
            per_class,
        "classMapping":
            names,
        "confusionMatrix":
            confusion.tolist(),
        "clinicalValidation":
            False,
    }

    JSON_PATH.write_text(
        json.dumps(
            payload,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    labels = [
        names[index]
        for index in range(
            class_count
        )
    ]

    figure, axis = (
        plt.subplots(
            figsize=(8, 7)
        )
    )

    image = axis.imshow(
        confusion,
    )

    figure.colorbar(
        image,
        ax=axis,
    )

    axis.set_xticks(
        range(
            class_count
        ),
        labels,
        rotation=45,
        ha="right",
    )

    axis.set_yticks(
        range(
            class_count
        ),
        labels,
    )

    axis.set_xlabel(
        "Predicted class"
    )

    axis.set_ylabel(
        "Ground-truth class"
    )

    axis.set_title(
        "BBBC041 Stage Classifier "
        "Confusion Matrix"
    )

    for row in range(
        class_count
    ):
        for column in range(
            class_count
        ):
            axis.text(
                column,
                row,
                str(
                    confusion[
                        row,
                        column,
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
        "=== OVERALL ==="
    )

    print(
        f"Accuracy: "
        f"{overall_accuracy:.4f}"
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

    for (
        class_name,
        values,
    ) in per_class.items():

        print()
        print(
            class_name
        )

        print(
            f"  Support: "
            f"{values['support']}"
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
        f"Metrics: {JSON_PATH}"
    )

    print(
        f"Confusion matrix: "
        f"{MATRIX_PATH}"
    )

    print()
    print(
        "EVALUATION STATUS: PASS"
    )


if __name__ == "__main__":
    main()