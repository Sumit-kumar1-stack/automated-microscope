from __future__ import annotations

import hashlib
import json
import random
from collections import Counter, defaultdict
from pathlib import Path, PurePosixPath
from typing import Any

from remotezip import RemoteZip


ARCHIVE_URL = (
    "https://data.broadinstitute.org/bbbc/"
    "BBBC041/malaria.zip"
)

BASE_DIR = Path(__file__).resolve().parent

TRAINING_JSON = (
    BASE_DIR
    / "data"
    / "metadata"
    / "malaria"
    / "training.json"
)

OUTPUT_DIR = BASE_DIR / "outputs"

SAMPLE_DIR = (
    BASE_DIR
    / "data"
    / "verified-sample"
)

MANIFEST_PATH = (
    OUTPUT_DIR
    / "verified_sample_manifest.json"
)

TARGET_CLASSES = [
    "ring",
    "trophozoite",
    "schizont",
    "gametocyte",
    "leukocyte",
]

RANDOM_SEED = 41

IMAGES_PER_TARGET_CLASS = 3

MAX_IMAGE_BYTES = (
    30 * 1024 * 1024
)


def load_json(
    path: Path,
) -> Any:
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


def categories_for_record(
    record: dict[str, Any],
) -> set[str]:
    categories: set[str] = set()

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
            categories.add(
                category
            )

    return categories


def archive_image_path(
    filename: str,
) -> str:
    return (
        f"malaria/images/"
        f"{filename}"
    )


def md5_bytes(
    payload: bytes,
) -> str:
    return hashlib.md5(
        payload
    ).hexdigest()


def select_records(
    records: list[
        dict[str, Any]
    ],
) -> list[
    dict[str, Any]
]:
    rng = random.Random(
        RANDOM_SEED
    )

    by_class: dict[
        str,
        list[
            dict[str, Any]
        ],
    ] = defaultdict(list)

    for record in records:
        categories = (
            categories_for_record(
                record
            )
        )

        for category in (
            TARGET_CLASSES
        ):
            if category in categories:
                by_class[
                    category
                ].append(
                    record
                )

    selected_by_name: dict[
        str,
        dict[str, Any],
    ] = {}

    print(
        "=== TARGET-CLASS "
        "IMAGE AVAILABILITY ==="
    )

    for category in (
        TARGET_CLASSES
    ):
        candidates = by_class[
            category
        ]

        print(
            f"{category:<20} "
            f"{len(candidates)} images"
        )

        if not candidates:
            continue

        count = min(
            IMAGES_PER_TARGET_CLASS,
            len(candidates),
        )

        chosen = rng.sample(
            candidates,
            count,
        )

        for record in chosen:
            selected_by_name[
                image_filename(
                    record
                )
            ] = record

    return list(
        selected_by_name.values()
    )


def validate_boxes(
    record: dict[str, Any],
) -> list[str]:
    errors: list[str] = []

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

    for index, obj in enumerate(
        record.get(
            "objects",
            [],
        )
    ):
        box = obj.get(
            "bounding_box"
        )

        if not isinstance(
            box,
            dict,
        ):
            errors.append(
                f"object {index}: "
                "missing bounding box"
            )
            continue

        minimum = box.get(
            "minimum",
            {},
        )

        maximum = box.get(
            "maximum",
            {},
        )

        r1 = minimum.get("r")
        c1 = minimum.get("c")
        r2 = maximum.get("r")
        c2 = maximum.get("c")

        values = (
            r1,
            c1,
            r2,
            c2,
        )

        if not all(
            isinstance(
                value,
                int,
            )
            for value in values
        ):
            errors.append(
                f"object {index}: "
                "invalid coordinates"
            )
            continue

        if not (
            0 <= r1 < r2 <= height
        ):
            errors.append(
                f"object {index}: "
                "row coordinates "
                "outside image"
            )

        if not (
            0 <= c1 < c2 <= width
        ):
            errors.append(
                f"object {index}: "
                "column coordinates "
                "outside image"
            )

    return errors


def main() -> None:
    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    SAMPLE_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    records = load_json(
        TRAINING_JSON
    )

    if not isinstance(
        records,
        list,
    ):
        raise TypeError(
            "training.json must "
            "contain a list"
        )

    selected = select_records(
        records
    )

    print()
    print(
        "=== CONTROLLED SAMPLE ==="
    )

    print(
        f"Unique images selected: "
        f"{len(selected)}"
    )

    manifest_records = []

    class_counter = Counter()

    print()
    print(
        "Connecting to remote "
        "BBBC041 archive..."
    )

    with RemoteZip(
        ARCHIVE_URL
    ) as archive:
        for index, record in enumerate(
            selected,
            start=1,
        ):
            filename = image_filename(
                record
            )

            member = (
                archive_image_path(
                    filename
                )
            )

            print()
            print(
                f"[{index:02d}/"
                f"{len(selected):02d}] "
                f"{filename}"
            )

            info = archive.getinfo(
                member
            )

            if (
                info.file_size
                > MAX_IMAGE_BYTES
            ):
                raise ValueError(
                    "Unexpectedly large "
                    f"image: {member}"
                )

            payload = archive.read(
                member
            )

            target = (
                SAMPLE_DIR
                / filename
            )

            target.write_bytes(
                payload
            )

            expected_checksum = (
                record[
                    "image"
                ].get(
                    "checksum"
                )
            )

            actual_checksum = (
                md5_bytes(
                    payload
                )
            )

            checksum_match = (
                expected_checksum
                == actual_checksum
            )

            box_errors = (
                validate_boxes(
                    record
                )
            )

            categories = sorted(
                categories_for_record(
                    record
                )
            )

            object_counts = Counter(
                obj.get(
                    "category",
                    "unknown",
                )
                for obj in record.get(
                    "objects",
                    [],
                )
            )

            class_counter.update(
                object_counts
            )

            print(
                "  categories:",
                ", ".join(
                    categories
                ),
            )

            print(
                "  objects:",
                len(
                    record.get(
                        "objects",
                        [],
                    )
                ),
            )

            print(
                "  checksum:",
                (
                    "PASS"
                    if checksum_match
                    else "FAIL"
                ),
            )

            print(
                "  boxes:",
                (
                    "PASS"
                    if not box_errors
                    else "FAIL"
                ),
            )

            manifest_records.append(
                {
                    "filename":
                        filename,
                    "archiveMember":
                        member,
                    "expectedMd5":
                        expected_checksum,
                    "actualMd5":
                        actual_checksum,
                    "checksumValid":
                        checksum_match,
                    "shape":
                        record[
                            "image"
                        ][
                            "shape"
                        ],
                    "categories":
                        categories,
                    "objectCounts":
                        dict(
                            object_counts
                        ),
                    "boundingBoxErrors":
                        box_errors,
                }
            )

    checksum_failures = [
        item
        for item in manifest_records
        if not item[
            "checksumValid"
        ]
    ]

    box_failures = [
        item
        for item in manifest_records
        if item[
            "boundingBoxErrors"
        ]
    ]

    manifest = {
        "schemaVersion": 1,
        "dataset": "BBBC041",
        "split": "training",
        "samplingStrategy":
            "annotation-aware",
        "seed": RANDOM_SEED,
        "targetClasses":
            TARGET_CLASSES,
        "imagesPerTargetClass":
            IMAGES_PER_TARGET_CLASS,
        "uniqueImages":
            len(
                manifest_records
            ),
        "checksumFailures":
            len(
                checksum_failures
            ),
        "boundingBoxFailures":
            len(
                box_failures
            ),
        "sampleObjectCounts":
            dict(
                class_counter
            ),
        "images":
            manifest_records,
    }

    MANIFEST_PATH.write_text(
        json.dumps(
            manifest,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print()
    print(
        "=== SAMPLE VALIDATION "
        "SUMMARY ==="
    )

    print(
        f"Images: "
        f"{len(manifest_records)}"
    )

    print(
        f"Checksum failures: "
        f"{len(checksum_failures)}"
    )

    print(
        f"Bounding-box failures: "
        f"{len(box_failures)}"
    )

    print()
    print(
        "Objects in controlled "
        "sample:"
    )

    for category, count in (
        class_counter.most_common()
    ):
        print(
            f"  {category:<20} "
            f"{count}"
        )

    print()
    print(
        "Manifest:"
    )

    print(
        f"  {MANIFEST_PATH}"
    )

    if (
        checksum_failures
        or box_failures
    ):
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