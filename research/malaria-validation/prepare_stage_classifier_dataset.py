from __future__ import annotations

import json
import shutil
from collections import Counter
from pathlib import Path

import cv2


BASE_DIR = Path(__file__).resolve().parent

SOURCE_ROOT = (
    BASE_DIR
    / "data"
    / "yolo-parasite-pilot"
)

TARGET_ROOT = (
    BASE_DIR
    / "data"
    / "stage-classifier-pilot"
)

OUTPUT_PATH = (
    BASE_DIR
    / "outputs"
    / "stage_classifier_dataset_summary.json"
)

CLASS_NAMES = [
    "ring",
    "trophozoite",
    "schizont",
    "gametocyte",
]

IMAGE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
}

CROP_SCALE = 1.8
MIN_CROP_SIZE = 48


def read_labels(path: Path):
    objects = []

    if not path.exists():
        return objects

    for line in path.read_text(
        encoding="utf-8"
    ).splitlines():

        line = line.strip()

        if not line:
            continue

        parts = line.split()

        if len(parts) != 5:
            raise ValueError(
                f"Invalid YOLO label: {path}"
            )

        objects.append(
            (
                int(parts[0]),
                float(parts[1]),
                float(parts[2]),
                float(parts[3]),
                float(parts[4]),
            )
        )

    return objects


def make_square_crop(
    image,
    cx,
    cy,
    width,
    height,
):
    image_height, image_width = (
        image.shape[:2]
    )

    box_size = max(
        width,
        height,
        MIN_CROP_SIZE,
    )

    box_size *= CROP_SCALE

    half = box_size / 2

    x1 = int(
        round(cx - half)
    )
    y1 = int(
        round(cy - half)
    )
    x2 = int(
        round(cx + half)
    )
    y2 = int(
        round(cy + half)
    )

    x1 = max(0, x1)
    y1 = max(0, y1)

    x2 = min(
        image_width,
        x2,
    )

    y2 = min(
        image_height,
        y2,
    )

    if x2 <= x1 or y2 <= y1:
        return None

    return image[
        y1:y2,
        x1:x2
    ]


def prepare_split(split: str):
    image_dir = (
        SOURCE_ROOT
        / "images"
        / split
    )

    label_dir = (
        SOURCE_ROOT
        / "labels"
        / split
    )

    counts = Counter()

    image_paths = sorted(
        path
        for path in image_dir.iterdir()
        if (
            path.is_file()
            and path.suffix.lower()
            in IMAGE_EXTENSIONS
        )
    )

    crop_index = 0

    for image_index, image_path in enumerate(
        image_paths,
        start=1,
    ):
        image = cv2.imread(
            str(image_path)
        )

        if image is None:
            raise RuntimeError(
                f"Cannot read {image_path}"
            )

        height, width = (
            image.shape[:2]
        )

        label_path = (
            label_dir
            / f"{image_path.stem}.txt"
        )

        objects = read_labels(
            label_path
        )

        for object_index, (
            class_id,
            center_x,
            center_y,
            box_width,
            box_height,
        ) in enumerate(objects):

            if not (
                0 <= class_id
                < len(CLASS_NAMES)
            ):
                raise ValueError(
                    f"Unknown class {class_id}"
                )

            pixel_cx = (
                center_x * width
            )

            pixel_cy = (
                center_y * height
            )

            pixel_width = (
                box_width * width
            )

            pixel_height = (
                box_height * height
            )

            crop = make_square_crop(
                image,
                pixel_cx,
                pixel_cy,
                pixel_width,
                pixel_height,
            )

            if crop is None:
                continue

            class_name = (
                CLASS_NAMES[
                    class_id
                ]
            )

            class_dir = (
                TARGET_ROOT
                / split
                / class_name
            )

            class_dir.mkdir(
                parents=True,
                exist_ok=True,
            )

            crop_index += 1

            filename = (
                f"{image_path.stem}"
                f"_obj{object_index:03d}"
                f".jpg"
            )

            destination = (
                class_dir
                / filename
            )

            if not cv2.imwrite(
                str(destination),
                crop,
            ):
                raise RuntimeError(
                    "Could not write crop: "
                    f"{destination}"
                )

            counts[
                class_name
            ] += 1

        print(
            f"[{image_index:03d}/"
            f"{len(image_paths):03d}] "
            f"{split} "
            f"{image_path.name} "
            f"objects={len(objects)}"
        )

    return {
        "images":
            len(image_paths),
        "crops":
            sum(counts.values()),
        "classes":
            dict(counts),
    }


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
        "=== BBBC041 STAGE "
        "CLASSIFIER DATASET ==="
    )

    results = {}

    for split in [
        "train",
        "val",
    ]:
        print()
        print(
            f"=== {split.upper()} ==="
        )

        results[
            split
        ] = prepare_split(
            split
        )

    summary = {
        "schemaVersion": 1,
        "dataset": "BBBC041",
        "task": (
            "parasite-stage "
            "classification"
        ),
        "classes":
            CLASS_NAMES,
        "cropScale":
            CROP_SCALE,
        "splits":
            results,
        "testUsed":
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
        "=== DATASET SUMMARY ==="
    )

    for split, result in (
        results.items()
    ):
        print()
        print(
            split.upper()
        )

        print(
            f"Total crops: "
            f"{result['crops']}"
        )

        for name in CLASS_NAMES:
            print(
                f"  {name:<15} "
                f"{result['classes'].get(name, 0)}"
            )

    print()
    print(
        "PREPARATION STATUS: PASS"
    )


if __name__ == "__main__":
    main()