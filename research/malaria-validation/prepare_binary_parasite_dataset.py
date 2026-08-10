from __future__ import annotations

import json
import os
import shutil
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent

SOURCE_ROOT = (
    BASE_DIR
    / "data"
    / "yolo-parasite-pilot"
)

TARGET_ROOT = (
    BASE_DIR
    / "data"
    / "yolo-binary-parasite-pilot"
)

OUTPUT_PATH = (
    BASE_DIR
    / "outputs"
    / "binary_parasite_dataset_summary.json"
)


def materialize_image(
    source: Path,
    destination: Path,
) -> str:
    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    if destination.exists():
        return "existing"

    try:
        os.link(
            source,
            destination,
        )

        return "hardlink"

    except OSError:
        shutil.copy2(
            source,
            destination,
        )

        return "copy"


def convert_label(
    source: Path,
    destination: Path,
) -> int:
    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    output = []

    if source.exists():
        for line in source.read_text(
            encoding="utf-8",
        ).splitlines():

            line = line.strip()

            if not line:
                continue

            parts = line.split()

            if len(parts) != 5:
                raise ValueError(
                    f"Invalid YOLO label: "
                    f"{source}"
                )

            # All four parasite stages
            # become class 0.
            output.append(
                " ".join(
                    [
                        "0",
                        *parts[1:],
                    ]
                )
            )

    destination.write_text(
        "\n".join(output)
        + (
            "\n"
            if output
            else ""
        ),
        encoding="utf-8",
    )

    return len(output)


def prepare_split(
    split: str,
):
    source_images = (
        SOURCE_ROOT
        / "images"
        / split
    )

    source_labels = (
        SOURCE_ROOT
        / "labels"
        / split
    )

    target_images = (
        TARGET_ROOT
        / "images"
        / split
    )

    target_labels = (
        TARGET_ROOT
        / "labels"
        / split
    )

    images = sorted(
        path
        for path
        in source_images.iterdir()
        if path.is_file()
    )

    positive_images = 0
    background_images = 0
    total_objects = 0

    for index, image in enumerate(
        images,
        start=1,
    ):
        materialize_image(
            image,
            target_images
            / image.name,
        )

        source_label = (
            source_labels
            / f"{image.stem}.txt"
        )

        target_label = (
            target_labels
            / f"{image.stem}.txt"
        )

        objects = convert_label(
            source_label,
            target_label,
        )

        total_objects += objects

        if objects:
            positive_images += 1
        else:
            background_images += 1

        print(
            f"[{index:03d}/"
            f"{len(images):03d}] "
            f"{split} "
            f"{image.name} "
            f"parasites={objects}"
        )

    return {
        "images":
            len(images),
        "positiveImages":
            positive_images,
        "backgroundImages":
            background_images,
        "parasiteObjects":
            total_objects,
    }


def main():
    TARGET_ROOT.mkdir(
        parents=True,
        exist_ok=True,
    )

    OUTPUT_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    print(
        "=== BINARY PARASITE "
        "DATASET ==="
    )

    results = {}

    for split in (
        "train",
        "val",
    ):
        print()
        print(
            f"=== {split.upper()} ==="
        )

        results[split] = (
            prepare_split(
                split
            )
        )

    root = (
        TARGET_ROOT
        .resolve()
        .as_posix()
    )

    yaml = f"""# BBBC041 binary parasite detector
# Engineering research only.
# Not clinical validation.

path: {root}

train: images/train
val: images/val

names:
  0: 'parasite'
"""

    (
        TARGET_ROOT
        / "dataset.yaml"
    ).write_text(
        yaml,
        encoding="utf-8",
    )

    summary = {
        "schemaVersion": 1,
        "dataset": "BBBC041",
        "task":
            "binary parasite detection",
        "sourceClasses": [
            "ring",
            "trophozoite",
            "schizont",
            "gametocyte",
        ],
        "targetClasses": [
            "parasite"
        ],
        "splits":
            results,
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
        "=== SUMMARY ==="
    )

    for split, result in (
        results.items()
    ):
        print()
        print(
            split.upper()
        )

        print(
            "Images:",
            result["images"],
        )

        print(
            "Positive:",
            result[
                "positiveImages"
            ],
        )

        print(
            "Background:",
            result[
                "backgroundImages"
            ],
        )

        print(
            "Parasite objects:",
            result[
                "parasiteObjects"
            ],
        )

    print()
    print(
        "PREPARATION STATUS: PASS"
    )


if __name__ == "__main__":
    main()