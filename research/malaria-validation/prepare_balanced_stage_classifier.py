from __future__ import annotations

import json
import random
import shutil
from pathlib import Path

import cv2
import numpy as np


BASE_DIR = Path(__file__).resolve().parent

SOURCE_ROOT = (
    BASE_DIR
    / "data"
    / "stage-classifier-pilot"
)

TARGET_ROOT = (
    BASE_DIR
    / "data"
    / "stage-classifier-balanced"
)

OUTPUT_PATH = (
    BASE_DIR
    / "outputs"
    / "stage_classifier_balancing_summary.json"
)

CLASS_NAMES = [
    "ring",
    "trophozoite",
    "schizont",
    "gametocyte",
]

TARGET_PER_CLASS = 180
SEED = 41

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
}


def image_files(
    directory: Path,
):
    return sorted(
        path
        for path in directory.iterdir()
        if (
            path.is_file()
            and path.suffix.lower()
            in IMAGE_EXTENSIONS
        )
    )


def augment_image(
    image,
    index: int,
):
    result = image.copy()

    # Parasite morphology should be
    # approximately orientation invariant.
    mode = index % 6

    if mode == 0:
        result = cv2.flip(
            result,
            1,
        )

    elif mode == 1:
        result = cv2.flip(
            result,
            0,
        )

    elif mode == 2:
        result = cv2.rotate(
            result,
            cv2.ROTATE_90_CLOCKWISE,
        )

    elif mode == 3:
        result = cv2.rotate(
            result,
            cv2.ROTATE_90_COUNTERCLOCKWISE,
        )

    elif mode == 4:
        result = cv2.flip(
            result,
            -1,
        )

    else:
        height, width = (
            result.shape[:2]
        )

        center = (
            width / 2,
            height / 2,
        )

        angle = (
            -8
            if index % 2 == 0
            else 8
        )

        matrix = cv2.getRotationMatrix2D(
            center,
            angle,
            1.0,
        )

        result = cv2.warpAffine(
            result,
            matrix,
            (
                width,
                height,
            ),
            flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_REFLECT_101,
        )

    # Very mild brightness/contrast change.
    alpha = (
        0.94
        + (
            index % 5
        ) * 0.03
    )

    beta = (
        (index % 5) - 2
    ) * 2

    result = cv2.convertScaleAbs(
        result,
        alpha=alpha,
        beta=beta,
    )

    return result


def prepare_train_class(
    class_name: str,
    class_index: int,
):
    source = (
        SOURCE_ROOT
        / "train"
        / class_name
    )

    destination = (
        TARGET_ROOT
        / "train"
        / class_name
    )

    destination.mkdir(
        parents=True,
        exist_ok=True,
    )

    files = image_files(
        source
    )

    if not files:
        raise RuntimeError(
            f"No training crops for "
            f"{class_name}"
        )

    rng = random.Random(
        SEED + class_index
    )

    original_count = len(
        files
    )

    # Too many:
    # deterministic downsampling.
    if original_count >= TARGET_PER_CLASS:

        selected = rng.sample(
            files,
            TARGET_PER_CLASS,
        )

        for index, source_path in enumerate(
            sorted(selected)
        ):
            destination_path = (
                destination
                / (
                    f"original_"
                    f"{index:04d}.jpg"
                )
            )

            image = cv2.imread(
                str(source_path)
            )

            if image is None:
                raise RuntimeError(
                    f"Cannot read "
                    f"{source_path}"
                )

            cv2.imwrite(
                str(destination_path),
                image,
            )

        augmented = 0

    else:
        # Preserve every real crop.
        for index, source_path in enumerate(
            files
        ):
            image = cv2.imread(
                str(source_path)
            )

            if image is None:
                raise RuntimeError(
                    f"Cannot read "
                    f"{source_path}"
                )

            destination_path = (
                destination
                / (
                    f"original_"
                    f"{index:04d}.jpg"
                )
            )

            cv2.imwrite(
                str(destination_path),
                image,
            )

        required = (
            TARGET_PER_CLASS
            - original_count
        )

        augmented = required

        for index in range(
            required
        ):
            source_path = files[
                index
                % len(files)
            ]

            image = cv2.imread(
                str(source_path)
            )

            if image is None:
                raise RuntimeError(
                    f"Cannot read "
                    f"{source_path}"
                )

            result = augment_image(
                image,
                index,
            )

            destination_path = (
                destination
                / (
                    f"augmented_"
                    f"{index:04d}.jpg"
                )
            )

            if not cv2.imwrite(
                str(destination_path),
                result,
            ):
                raise RuntimeError(
                    f"Cannot write "
                    f"{destination_path}"
                )

    final_count = len(
        image_files(
            destination
        )
    )

    if final_count != TARGET_PER_CLASS:
        raise RuntimeError(
            f"{class_name}: expected "
            f"{TARGET_PER_CLASS}, got "
            f"{final_count}"
        )

    return {
        "source":
            original_count,
        "final":
            final_count,
        "augmented":
            augmented,
    }


def copy_validation():
    results = {}

    for class_name in CLASS_NAMES:

        source = (
            SOURCE_ROOT
            / "val"
            / class_name
        )

        destination = (
            TARGET_ROOT
            / "val"
            / class_name
        )

        destination.mkdir(
            parents=True,
            exist_ok=True,
        )

        files = image_files(
            source
        )

        for source_path in files:
            shutil.copy2(
                source_path,
                destination
                / source_path.name,
            )

        results[
            class_name
        ] = len(files)

    return results


def main():
    if TARGET_ROOT.exists():
        shutil.rmtree(
            TARGET_ROOT
        )

    TARGET_ROOT.mkdir(
        parents=True,
        exist_ok=True,
    )

    OUTPUT_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    print(
        "=== BALANCED STAGE "
        "CLASSIFIER DATASET ==="
    )

    training = {}

    for class_index, class_name in enumerate(
        CLASS_NAMES
    ):
        result = prepare_train_class(
            class_name,
            class_index,
        )

        training[
            class_name
        ] = result

        print()
        print(class_name)

        print(
            f"  Real source: "
            f"{result['source']}"
        )

        print(
            f"  Augmented: "
            f"{result['augmented']}"
        )

        print(
            f"  Final: "
            f"{result['final']}"
        )

    validation = (
        copy_validation()
    )

    summary = {
        "schemaVersion": 1,
        "dataset": "BBBC041",
        "task":
            "balanced parasite-stage classification",
        "seed":
            SEED,
        "targetPerTrainingClass":
            TARGET_PER_CLASS,
        "train":
            training,
        "validation":
            validation,
        "validationAugmented":
            False,
        "clinicalValidation":
            False,
    }

    OUTPUT_PATH.write_text(
        json.dumps(
            summary,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print()
    print(
        "=== FINAL COUNTS ==="
    )

    print()
    print("TRAIN")

    for class_name in CLASS_NAMES:
        count = len(
            image_files(
                TARGET_ROOT
                / "train"
                / class_name
            )
        )

        print(
            f"  {class_name:<15}"
            f"{count}"
        )

    print()
    print("VALIDATION")

    for class_name in CLASS_NAMES:
        print(
            f"  {class_name:<15}"
            f"{validation[class_name]}"
        )

    print()
    print(
        "BALANCING STATUS: PASS"
    )


if __name__ == "__main__":
    main()