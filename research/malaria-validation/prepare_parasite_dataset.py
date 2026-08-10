from __future__ import annotations

import json
import os
import shutil
from collections import Counter
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent

SOURCE_DIR = (
    BASE_DIR
    / "data"
    / "yolo-pilot"
)

TARGET_DIR = (
    BASE_DIR
    / "data"
    / "yolo-parasite-pilot"
)

OUTPUT_DIR = (
    BASE_DIR
    / "outputs"
)

SUMMARY_PATH = (
    OUTPUT_DIR
    / "parasite_dataset_summary.json"
)


# Original 7-class mapping:
#
# 0 RBC
# 1 leukocyte
# 2 ring
# 3 trophozoite
# 4 schizont
# 5 gametocyte
# 6 difficult
#
# New parasite-only mapping:

OLD_TO_NEW = {
    2: 0,
    3: 1,
    4: 2,
    5: 3,
}

CLASS_NAMES = [
    "ring",
    "trophozoite",
    "schizont",
    "gametocyte",
]


def hardlink_or_copy(
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
) -> Counter:
    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    counts = Counter()

    output_lines = []

    if source.exists():
        lines = source.read_text(
            encoding="utf-8",
        ).splitlines()

        for line in lines:
            line = line.strip()

            if not line:
                continue

            parts = line.split()

            if len(parts) != 5:
                raise ValueError(
                    f"Invalid YOLO label: "
                    f"{source}: {line}"
                )

            old_class = int(
                parts[0]
            )

            if old_class not in OLD_TO_NEW:
                continue

            new_class = (
                OLD_TO_NEW[
                    old_class
                ]
            )

            output_lines.append(
                " ".join(
                    [
                        str(new_class),
                        *parts[1:],
                    ]
                )
            )

            counts[
                CLASS_NAMES[
                    new_class
                ]
            ] += 1

    destination.write_text(
        "\n".join(
            output_lines
        )
        + (
            "\n"
            if output_lines
            else ""
        ),
        encoding="utf-8",
    )

    return counts


def prepare_split(
    split: str,
) -> dict:
    source_images = (
        SOURCE_DIR
        / "images"
        / split
    )

    source_labels = (
        SOURCE_DIR
        / "labels"
        / split
    )

    target_images = (
        TARGET_DIR
        / "images"
        / split
    )

    target_labels = (
        TARGET_DIR
        / "labels"
        / split
    )

    if not source_images.exists():
        raise FileNotFoundError(
            f"Missing image directory: "
            f"{source_images}"
        )

    image_paths = sorted(
        path
        for path in source_images.iterdir()
        if path.is_file()
    )

    total_counts = Counter()

    target_positive_images = 0
    background_images = 0

    link_modes = Counter()

    for index, image_path in enumerate(
        image_paths,
        start=1,
    ):
        label_path = (
            source_labels
            / (
                image_path.stem
                + ".txt"
            )
        )

        destination_image = (
            target_images
            / image_path.name
        )

        destination_label = (
            target_labels
            / (
                image_path.stem
                + ".txt"
            )
        )

        mode = hardlink_or_copy(
            image_path,
            destination_image,
        )

        link_modes[
            mode
        ] += 1

        counts = convert_label(
            label_path,
            destination_label,
        )

        target_objects = sum(
            counts.values()
        )

        if target_objects:
            target_positive_images += 1
        else:
            background_images += 1

        total_counts.update(
            counts
        )

        print(
            f"[{index:03d}/"
            f"{len(image_paths):03d}] "
            f"{split} "
            f"{image_path.name} "
            f"targets={target_objects}"
        )

    return {
        "images":
            len(image_paths),
        "positiveImages":
            target_positive_images,
        "backgroundImages":
            background_images,
        "objects":
            sum(
                total_counts.values()
            ),
        "classCounts":
            dict(
                total_counts
            ),
        "imageMaterialization":
            dict(
                link_modes
            ),
    }


def write_dataset_yaml() -> None:
    root = (
        TARGET_DIR
        .resolve()
        .as_posix()
    )

    yaml = f"""# BBBC041 malaria parasite-stage detector.
# Engineering research only.
# Not clinically validated.

path: {root}

train: images/train
val: images/val

names:
  0: 'ring'
  1: 'trophozoite'
  2: 'schizont'
  3: 'gametocyte'
"""

    (
        TARGET_DIR
        / "dataset.yaml"
    ).write_text(
        yaml,
        encoding="utf-8",
    )


def main() -> None:
    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    TARGET_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    print(
        "=== BBBC041 PARASITE "
        "DATASET PREPARATION ==="
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

    write_dataset_yaml()

    summary = {
        "schemaVersion": 1,
        "dataset": "BBBC041",
        "task": (
            "malaria parasite-stage "
            "object detection"
        ),
        "classes":
            CLASS_NAMES,
        "excludedAnnotations": [
            "red blood cell",
            "leukocyte",
            "difficult",
        ],
        "reason": (
            "Target-focused baseline "
            "to reduce dominant RBC "
            "class imbalance."
        ),
        "splits":
            results,
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
        "=== PARASITE DATASET "
        "SUMMARY ==="
    )

    for split, result in (
        results.items()
    ):
        print()
        print(
            split.upper()
        )

        print(
            f"  Images: "
            f"{result['images']}"
        )

        print(
            "  Positive images: "
            f"{result['positiveImages']}"
        )

        print(
            "  Background images: "
            f"{result['backgroundImages']}"
        )

        print(
            "  Target objects: "
            f"{result['objects']}"
        )

        for name in CLASS_NAMES:
            print(
                f"  {name:<18} "
                f"{result['classCounts'].get(name, 0)}"
            )

    print()
    print(
        "Dataset YAML:"
    )

    print(
        f"  {TARGET_DIR / 'dataset.yaml'}"
    )

    print()
    print(
        "PREPARATION STATUS: PASS"
    )


if __name__ == "__main__":
    main()