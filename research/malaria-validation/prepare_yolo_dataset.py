from __future__ import annotations

import json
import random
from collections import Counter
from pathlib import Path, PurePosixPath
from typing import Any


BASE_DIR = Path(__file__).resolve().parent

TRAINING_JSON = (
    BASE_DIR
    / "data"
    / "metadata"
    / "malaria"
    / "training.json"
)

TEST_JSON = (
    BASE_DIR
    / "data"
    / "metadata"
    / "malaria"
    / "test.json"
)

YOLO_DIR = (
    BASE_DIR
    / "data"
    / "yolo"
)

LABELS_DIR = (
    YOLO_DIR
    / "labels"
)

SPLITS_DIR = (
    YOLO_DIR
    / "splits"
)

OUTPUT_DIR = (
    BASE_DIR
    / "outputs"
)

SUMMARY_PATH = (
    OUTPUT_DIR
    / "yolo_preparation_summary.json"
)

DATASET_YAML_PATH = (
    YOLO_DIR
    / "dataset.yaml"
)


CLASS_NAMES = [
    "red blood cell",
    "leukocyte",
    "ring",
    "trophozoite",
    "schizont",
    "gametocyte",
    "difficult",
]

CLASS_TO_ID = {
    name: index
    for index, name
    in enumerate(CLASS_NAMES)
}


# We intentionally stratify using
# biologically important rare classes.
STRATIFY_CLASSES = [
    "leukocyte",
    "ring",
    "trophozoite",
    "schizont",
    "gametocyte",
]


VALIDATION_FRACTION = 0.20
RANDOM_SEED = 41


def load_json(
    path: Path,
) -> Any:
    if not path.exists():
        raise FileNotFoundError(
            f"Missing annotation file: {path}"
        )

    with path.open(
        "r",
        encoding="utf-8",
    ) as handle:
        return json.load(handle)


def image_filename(
    record: dict[str, Any],
) -> str:
    pathname = record[
        "image"
    ][
        "pathname"
    ]

    return PurePosixPath(
        pathname
    ).name


def image_classes(
    record: dict[str, Any],
) -> set[str]:
    classes: set[str] = set()

    for obj in record.get(
        "objects",
        [],
    ):
        category = obj.get(
            "category"
        )

        if isinstance(
            category,
            str,
        ):
            classes.add(
                category
            )

    return classes


def make_validation_split(
    records: list[
        dict[str, Any]
    ],
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    rng = random.Random(
        RANDOM_SEED
    )

    validation_size = round(
        len(records)
        * VALIDATION_FRACTION
    )

    selected_names: set[str] = set()

    records_by_class: dict[
        str,
        list[dict[str, Any]],
    ] = {
        category: []
        for category
        in STRATIFY_CLASSES
    }

    for record in records:
        present = image_classes(
            record
        )

        for category in (
            STRATIFY_CLASSES
        ):
            if category in present:
                records_by_class[
                    category
                ].append(
                    record
                )

    print(
        "=== STRATIFICATION INPUT ==="
    )

    # Start with rarest biological
    # classes first.
    ordered_classes = sorted(
        STRATIFY_CLASSES,
        key=lambda category: len(
            records_by_class[
                category
            ]
        ),
    )

    for category in ordered_classes:
        candidates = list(
            records_by_class[
                category
            ]
        )

        rng.shuffle(
            candidates
        )

        desired = max(
            1,
            round(
                len(candidates)
                * VALIDATION_FRACTION
            ),
        )

        already_selected = sum(
            1
            for record in candidates
            if image_filename(record)
            in selected_names
        )

        required = max(
            0,
            desired
            - already_selected
        )

        for record in candidates:
            if required <= 0:
                break

            filename = image_filename(
                record
            )

            if filename in selected_names:
                continue

            selected_names.add(
                filename
            )

            required -= 1

        print(
            f"{category:<20} "
            f"images={len(candidates):4d} "
            f"target-val={desired:3d}"
        )

    # Fill the remainder deterministically
    # from all other training records.
    remaining = [
        record
        for record in records
        if image_filename(record)
        not in selected_names
    ]

    rng.shuffle(
        remaining
    )

    slots = (
        validation_size
        - len(selected_names)
    )

    if slots < 0:
        raise RuntimeError(
            "Rare-class stratification "
            "exceeded validation size."
        )

    for record in remaining[
        :slots
    ]:
        selected_names.add(
            image_filename(
                record
            )
        )

    training_records = []
    validation_records = []

    for record in records:
        if (
            image_filename(record)
            in selected_names
        ):
            validation_records.append(
                record
            )
        else:
            training_records.append(
                record
            )

    return (
        training_records,
        validation_records,
    )


def yolo_box(
    obj: dict[str, Any],
    image_width: int,
    image_height: int,
) -> tuple[
    float,
    float,
    float,
    float,
]:
    box = obj[
        "bounding_box"
    ]

    minimum = box[
        "minimum"
    ]

    maximum = box[
        "maximum"
    ]

    # BBBC041:
    # c = column = X
    # r = row    = Y

    x1 = float(
        minimum["c"]
    )

    y1 = float(
        minimum["r"]
    )

    x2 = float(
        maximum["c"]
    )

    y2 = float(
        maximum["r"]
    )

    if not (
        0 <= x1 < x2 <= image_width
    ):
        raise ValueError(
            f"Invalid X box: "
            f"{x1}, {x2}, "
            f"width={image_width}"
        )

    if not (
        0 <= y1 < y2 <= image_height
    ):
        raise ValueError(
            f"Invalid Y box: "
            f"{y1}, {y2}, "
            f"height={image_height}"
        )

    center_x = (
        (x1 + x2) / 2.0
    ) / image_width

    center_y = (
        (y1 + y2) / 2.0
    ) / image_height

    width = (
        x2 - x1
    ) / image_width

    height = (
        y2 - y1
    ) / image_height

    values = (
        center_x,
        center_y,
        width,
        height,
    )

    if not all(
        0.0 <= value <= 1.0
        for value in values
    ):
        raise ValueError(
            "Normalized YOLO box "
            f"outside [0,1]: {values}"
        )

    return values


def write_labels(
    records: list[
        dict[str, Any]
    ],
    split_name: str,
) -> dict[str, Any]:
    split_label_dir = (
        LABELS_DIR
        / split_name
    )

    split_label_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    object_counts = Counter()

    unknown_categories = Counter()

    label_files = 0
    object_count = 0

    for record in records:
        filename = image_filename(
            record
        )

        stem = Path(
            filename
        ).stem

        shape = record[
            "image"
        ][
            "shape"
        ]

        height = int(
            shape["r"]
        )

        width = int(
            shape["c"]
        )

        lines = []

        for obj in record.get(
            "objects",
            [],
        ):
            category = obj.get(
                "category"
            )

            if category not in (
                CLASS_TO_ID
            ):
                unknown_categories[
                    str(category)
                ] += 1

                continue

            (
                center_x,
                center_y,
                box_width,
                box_height,
            ) = yolo_box(
                obj,
                width,
                height,
            )

            class_id = (
                CLASS_TO_ID[
                    category
                ]
            )

            lines.append(
                (
                    f"{class_id} "
                    f"{center_x:.8f} "
                    f"{center_y:.8f} "
                    f"{box_width:.8f} "
                    f"{box_height:.8f}"
                )
            )

            object_counts[
                category
            ] += 1

            object_count += 1

        label_path = (
            split_label_dir
            / f"{stem}.txt"
        )

        label_path.write_text(
            "\n".join(lines)
            + (
                "\n"
                if lines
                else ""
            ),
            encoding="utf-8",
        )

        label_files += 1

    return {
        "images": len(records),
        "labelFiles": label_files,
        "objects": object_count,
        "classCounts": dict(
            object_counts
        ),
        "unknownCategories": dict(
            unknown_categories
        ),
    }


def write_split_manifest(
    records: list[
        dict[str, Any]
    ],
    split_name: str,
) -> None:
    SPLITS_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    lines = []

    for record in records:
        filename = image_filename(
            record
        )

        # These are archive-relative
        # source paths for the next
        # materialization phase.
        lines.append(
            f"malaria/images/{filename}"
        )

    path = (
        SPLITS_DIR
        / f"{split_name}.txt"
    )

    path.write_text(
        "\n".join(lines)
        + "\n",
        encoding="utf-8",
    )


def count_image_presence(
    records: list[
        dict[str, Any]
    ],
) -> dict[str, int]:
    counts = Counter()

    for record in records:
        for category in (
            image_classes(record)
        ):
            counts[
                category
            ] += 1

    return dict(
        counts
    )


def validate_no_leakage(
    train_records,
    val_records,
    test_records,
) -> None:
    train = {
        image_filename(record)
        for record
        in train_records
    }

    val = {
        image_filename(record)
        for record
        in val_records
    }

    test = {
        image_filename(record)
        for record
        in test_records
    }

    checks = {
        "train_vs_val":
            train & val,
        "train_vs_test":
            train & test,
        "val_vs_test":
            val & test,
    }

    for name, overlap in (
        checks.items()
    ):
        if overlap:
            raise RuntimeError(
                f"DATA LEAKAGE: {name} "
                f"contains "
                f"{len(overlap)} "
                "overlapping image(s)."
            )


def write_dataset_yaml() -> None:
    names = "\n".join(
        f"  {index}: "
        f"'{name}'"
        for index, name
        in enumerate(
            CLASS_NAMES
        )
    )

    content = f"""# Generated BBBC041 YOLO dataset configuration
# Engineering research only - not clinical validation.

path: .

train: images/train
val: images/val
test: images/test

names:
{names}
"""

    DATASET_YAML_PATH.write_text(
        content,
        encoding="utf-8",
    )


def main() -> None:
    YOLO_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    training_records = (
        load_json(
            TRAINING_JSON
        )
    )

    test_records = (
        load_json(
            TEST_JSON
        )
    )

    if not isinstance(
        training_records,
        list,
    ):
        raise TypeError(
            "training.json must "
            "contain a list."
        )

    if not isinstance(
        test_records,
        list,
    ):
        raise TypeError(
            "test.json must "
            "contain a list."
        )

    print(
        "=== BBBC041 ML DATASET "
        "PREPARATION ==="
    )

    print(
        f"Official training records: "
        f"{len(training_records)}"
    )

    print(
        f"Official test records: "
        f"{len(test_records)}"
    )

    (
        train_records,
        val_records,
    ) = make_validation_split(
        training_records
    )

    validate_no_leakage(
        train_records,
        val_records,
        test_records,
    )

    print()
    print(
        "=== IMAGE SPLITS ==="
    )

    print(
        f"Train: "
        f"{len(train_records)}"
    )

    print(
        f"Validation: "
        f"{len(val_records)}"
    )

    print(
        f"Test: "
        f"{len(test_records)}"
    )

    split_records = {
        "train":
            train_records,
        "val":
            val_records,
        "test":
            test_records,
    }

    summaries = {}

    for split_name, records in (
        split_records.items()
    ):
        print()
        print(
            f"Writing {split_name} "
            "YOLO labels..."
        )

        summaries[
            split_name
        ] = write_labels(
            records,
            split_name,
        )

        write_split_manifest(
            records,
            split_name,
        )

    write_dataset_yaml()

    print()
    print(
        "=== CLASS PRESENCE "
        "BY IMAGE ==="
    )

    presence = {}

    for split_name, records in (
        split_records.items()
    ):
        presence[
            split_name
        ] = count_image_presence(
            records
        )

        print()
        print(
            split_name.upper()
        )

        for category in (
            CLASS_NAMES
        ):
            count = presence[
                split_name
            ].get(
                category,
                0,
            )

            print(
                f"  {category:<20} "
                f"{count}"
            )

    summary = {
        "schemaVersion": 1,
        "dataset": "BBBC041",
        "randomSeed":
            RANDOM_SEED,
        "validationFraction":
            VALIDATION_FRACTION,
        "splitStrategy": (
            "official test preserved; "
            "deterministic rare-class-aware "
            "validation split from official "
            "training set"
        ),
        "classMapping": {
            str(index): name
            for index, name
            in enumerate(
                CLASS_NAMES
            )
        },
        "splits": summaries,
        "classPresenceByImage":
            presence,
        "leakageChecks": {
            "trainVsValidation": 0,
            "trainVsTest": 0,
            "validationVsTest": 0,
        },
        "coordinateConversion": {
            "source": (
                "BBBC041 "
                "row-column XYXY"
            ),
            "target": (
                "YOLO normalized "
                "x_center y_center "
                "width height"
            ),
        },
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
        "=== DATASET VALIDATION ==="
    )

    print(
        "Train/validation overlap: 0"
    )

    print(
        "Train/test overlap: 0"
    )

    print(
        "Validation/test overlap: 0"
    )

    unknown_total = sum(
        sum(
            split[
                "unknownCategories"
            ].values()
        )
        for split in (
            summaries.values()
        )
    )

    print(
        f"Unknown labels: "
        f"{unknown_total}"
    )

    print()
    print(
        "YOLO metadata:"
    )

    print(
        f"  {YOLO_DIR}"
    )

    print(
        "Summary:"
    )

    print(
        f"  {SUMMARY_PATH}"
    )

    if unknown_total:
        print()
        print(
            "VALIDATION STATUS: FAIL"
        )

        raise SystemExit(1)

    print()
    print(
        "VALIDATION STATUS: PASS"
    )


if __name__ == "__main__":
    main()