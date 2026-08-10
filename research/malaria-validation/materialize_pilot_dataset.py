from __future__ import annotations

import argparse
import hashlib
import json
import random
import shutil
from collections import Counter, defaultdict
from pathlib import Path, PurePosixPath
from typing import Any

from remotezip import RemoteZip


BASE_DIR = Path(__file__).resolve().parent

ARCHIVE_URL = (
    "https://data.broadinstitute.org/bbbc/"
    "BBBC041/malaria.zip"
)

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

SOURCE_YOLO_DIR = (
    BASE_DIR
    / "data"
    / "yolo"
)

PILOT_DIR = (
    BASE_DIR
    / "data"
    / "yolo-pilot"
)

OUTPUT_DIR = (
    BASE_DIR
    / "outputs"
)

MANIFEST_PATH = (
    OUTPUT_DIR
    / "pilot_dataset_manifest.json"
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

TARGET_CLASSES = [
    "leukocyte",
    "gametocyte",
    "schizont",
    "ring",
    "trophozoite",
]

DEFAULT_TRAIN_SIZE = 300
DEFAULT_VAL_SIZE = 100

TRAIN_TARGET_PER_CLASS = 30
VAL_TARGET_PER_CLASS = 15

RANDOM_SEED = 41

MAX_IMAGE_BYTES = (
    30 * 1024 * 1024
)


def load_json(
    path: Path,
) -> Any:
    if not path.exists():
        raise FileNotFoundError(
            f"Missing file: {path}"
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


def image_categories(
    record: dict[str, Any],
) -> set[str]:
    result: set[str] = set()

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
            result.add(
                category
            )

    return result


def build_index(
    records: list[
        dict[str, Any]
    ],
) -> dict[
    str,
    dict[str, Any]
]:
    return {
        image_filename(record):
            record
        for record in records
    }


def read_split_names(
    split: str,
) -> list[str]:
    path = (
        SOURCE_YOLO_DIR
        / "splits"
        / f"{split}.txt"
    )

    if not path.exists():
        raise FileNotFoundError(
            f"Missing split file: {path}"
        )

    names = []

    for line in path.read_text(
        encoding="utf-8",
    ).splitlines():
        line = line.strip()

        if not line:
            continue

        names.append(
            PurePosixPath(
                line
            ).name
        )

    return names


def select_annotation_aware(
    names: list[str],
    annotation_index: dict[
        str,
        dict[str, Any]
    ],
    desired_size: int,
    target_per_class: int,
    seed: int,
) -> list[str]:
    if desired_size > len(names):
        raise ValueError(
            "Requested sample exceeds "
            "available split size."
        )

    rng = random.Random(
        seed
    )

    allowed = set(
        names
    )

    by_class: dict[
        str,
        list[str],
    ] = defaultdict(list)

    for filename in names:
        record = annotation_index.get(
            filename
        )

        if record is None:
            raise KeyError(
                "Missing annotation for "
                f"{filename}"
            )

        present = image_categories(
            record
        )

        for category in TARGET_CLASSES:
            if category in present:
                by_class[
                    category
                ].append(
                    filename
                )

    selected: set[str] = set()

    # Rarest classes first.
    ordered_classes = sorted(
        TARGET_CLASSES,
        key=lambda category: len(
            by_class[
                category
            ]
        ),
    )

    print(
        "Rare-class selection:"
    )

    for category in ordered_classes:
        candidates = list(
            by_class[
                category
            ]
        )

        rng.shuffle(
            candidates
        )

        desired = min(
            target_per_class,
            len(candidates),
        )

        already = sum(
            1
            for filename in candidates
            if filename in selected
        )

        required = max(
            0,
            desired - already,
        )

        for filename in candidates:
            if required <= 0:
                break

            if filename in selected:
                continue

            selected.add(
                filename
            )

            required -= 1

        final_count = sum(
            1
            for filename in selected
            if filename in allowed
            and category
            in image_categories(
                annotation_index[
                    filename
                ]
            )
        )

        print(
            f"  {category:<20} "
            f"available={len(candidates):3d} "
            f"selected={final_count:3d}"
        )

    remaining = [
        filename
        for filename in names
        if filename not in selected
    ]

    rng.shuffle(
        remaining
    )

    slots = (
        desired_size
        - len(selected)
    )

    if slots < 0:
        raise RuntimeError(
            "Rare-class selection "
            "exceeded desired size."
        )

    selected.update(
        remaining[
            :slots
        ]
    )

    if len(selected) != desired_size:
        raise RuntimeError(
            "Could not construct "
            "requested pilot sample."
        )

    # Deterministic filesystem order.
    return sorted(
        selected
    )


def md5_bytes(
    payload: bytes,
) -> str:
    return hashlib.md5(
        payload
    ).hexdigest()


def md5_file(
    path: Path,
) -> str:
    digest = hashlib.md5()

    with path.open(
        "rb",
    ) as handle:
        while True:
            chunk = handle.read(
                1024 * 1024
            )

            if not chunk:
                break

            digest.update(
                chunk
            )

    return digest.hexdigest()


def verify_checksum(
    path: Path,
    expected: str,
) -> bool:
    return (
        md5_file(path)
        == expected
    )


def download_image(
    archive: RemoteZip,
    filename: str,
    record: dict[str, Any],
    target_dir: Path,
    force: bool,
) -> dict[str, Any]:
    member = (
        f"malaria/images/"
        f"{filename}"
    )

    target = (
        target_dir
        / filename
    )

    target.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    expected_checksum = str(
        record[
            "image"
        ][
            "checksum"
        ]
    )

    if (
        target.exists()
        and not force
        and verify_checksum(
            target,
            expected_checksum,
        )
    ):
        return {
            "filename": filename,
            "downloaded": False,
            "checksumValid": True,
            "bytes":
                target.stat().st_size,
        }

    info = archive.getinfo(
        member
    )

    if info.file_size > MAX_IMAGE_BYTES:
        raise ValueError(
            "Image exceeds safety "
            f"limit: {member}"
        )

    payload = archive.read(
        member
    )

    actual_checksum = md5_bytes(
        payload
    )

    if (
        actual_checksum
        != expected_checksum
    ):
        raise RuntimeError(
            "Checksum mismatch: "
            f"{filename}"
        )

    temporary = target.with_suffix(
        target.suffix + ".part"
    )

    temporary.write_bytes(
        payload
    )

    temporary.replace(
        target
    )

    return {
        "filename": filename,
        "downloaded": True,
        "checksumValid": True,
        "bytes": len(payload),
    }


def copy_label(
    filename: str,
    source_split: str,
    destination_split: str,
) -> None:
    stem = Path(
        filename
    ).stem

    source = (
        SOURCE_YOLO_DIR
        / "labels"
        / source_split
        / f"{stem}.txt"
    )

    if not source.exists():
        raise FileNotFoundError(
            f"Missing YOLO label: {source}"
        )

    destination_dir = (
        PILOT_DIR
        / "labels"
        / destination_split
    )

    destination_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    destination = (
        destination_dir
        / source.name
    )

    shutil.copy2(
        source,
        destination,
    )


def class_counts(
    filenames: list[str],
    annotation_index: dict[
        str,
        dict[str, Any]
    ],
) -> dict[str, int]:
    counter = Counter()

    for filename in filenames:
        record = annotation_index[
            filename
        ]

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
                counter[
                    category
                ] += 1

    return dict(
        counter
    )


def class_image_presence(
    filenames: list[str],
    annotation_index: dict[
        str,
        dict[str, Any]
    ],
) -> dict[str, int]:
    counter = Counter()

    for filename in filenames:
        record = annotation_index[
            filename
        ]

        counter.update(
            image_categories(
                record
            )
        )

    return dict(
        counter
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

    # Local generated dataset:
    # absolute path avoids ambiguity
    # when Ultralytics is run from
    # project root.
    dataset_root = (
        PILOT_DIR
        .resolve()
        .as_posix()
    )

    content = f"""# Generated BBBC041 pilot dataset.
# Engineering research only.
# Not clinical validation.

path: {dataset_root}

train: images/train
val: images/val

names:
{names}
"""

    (
        PILOT_DIR
        / "dataset.yaml"
    ).write_text(
        content,
        encoding="utf-8",
    )


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Materialize a controlled "
            "BBBC041 YOLO pilot dataset."
        )
    )

    parser.add_argument(
        "--train-size",
        type=int,
        default=DEFAULT_TRAIN_SIZE,
    )

    parser.add_argument(
        "--val-size",
        type=int,
        default=DEFAULT_VAL_SIZE,
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help=(
            "Redownload existing "
            "images."
        ),
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.train_size <= 0:
        raise ValueError(
            "--train-size must "
            "be positive."
        )

    if args.val_size <= 0:
        raise ValueError(
            "--val-size must "
            "be positive."
        )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    training_records = load_json(
        TRAINING_JSON
    )

    test_records = load_json(
        TEST_JSON
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

    annotation_index = (
        build_index(
            training_records
            + test_records
        )
    )

    train_names = (
        read_split_names(
            "train"
        )
    )

    val_names = (
        read_split_names(
            "val"
        )
    )

    print(
        "=== BBBC041 PILOT "
        "MATERIALIZATION ==="
    )

    print()
    print(
        f"Available train images: "
        f"{len(train_names)}"
    )

    print(
        f"Available validation images: "
        f"{len(val_names)}"
    )

    print()
    print(
        "Selecting training pilot..."
    )

    pilot_train = (
        select_annotation_aware(
            names=train_names,
            annotation_index=
                annotation_index,
            desired_size=
                args.train_size,
            target_per_class=
                TRAIN_TARGET_PER_CLASS,
            seed=RANDOM_SEED,
        )
    )

    print()
    print(
        "Selecting validation pilot..."
    )

    pilot_val = (
        select_annotation_aware(
            names=val_names,
            annotation_index=
                annotation_index,
            desired_size=
                args.val_size,
            target_per_class=
                VAL_TARGET_PER_CLASS,
            seed=RANDOM_SEED + 1,
        )
    )

    overlap = (
        set(pilot_train)
        & set(pilot_val)
    )

    if overlap:
        raise RuntimeError(
            "Pilot train/validation "
            "leakage detected."
        )

    splits = {
        "train": pilot_train,
        "val": pilot_val,
    }

    results: dict[
        str,
        list[dict[str, Any]],
    ] = {
        "train": [],
        "val": [],
    }

    print()
    print(
        "Connecting to BBBC041 "
        "remote archive..."
    )

    with RemoteZip(
        ARCHIVE_URL
    ) as archive:
        for split_name, filenames in (
            splits.items()
        ):
            image_dir = (
                PILOT_DIR
                / "images"
                / split_name
            )

            image_dir.mkdir(
                parents=True,
                exist_ok=True,
            )

            print()
            print(
                f"=== {split_name.upper()} "
                "DOWNLOAD ==="
            )

            for index, filename in (
                enumerate(
                    filenames,
                    start=1,
                )
            ):
                result = download_image(
                    archive=archive,
                    filename=filename,
                    record=
                        annotation_index[
                            filename
                        ],
                    target_dir=
                        image_dir,
                    force=args.force,
                )

                copy_label(
                    filename=filename,
                    source_split=
                        split_name,
                    destination_split=
                        split_name,
                )

                results[
                    split_name
                ].append(
                    result
                )

                status = (
                    "downloaded"
                    if result[
                        "downloaded"
                    ]
                    else "cached"
                )

                print(
                    f"[{index:03d}/"
                    f"{len(filenames):03d}] "
                    f"{filename} "
                    f"{status} "
                    "checksum=PASS"
                )

    write_dataset_yaml()

    manifest = {
        "schemaVersion": 1,
        "dataset": "BBBC041",
        "purpose": (
            "Engineering ML pipeline "
            "pilot only"
        ),
        "randomSeed":
            RANDOM_SEED,
        "selectionStrategy": (
            "deterministic "
            "annotation-aware "
            "rare-class-enriched"
        ),
        "finalBenchmarkDataset":
            False,
        "clinicalValidation":
            False,
        "splits": {},
        "leakage": {
            "trainValidationOverlap":
                0,
        },
    }

    for split_name, filenames in (
        splits.items()
    ):
        downloaded_count = sum(
            1
            for item in results[
                split_name
            ]
            if item[
                "downloaded"
            ]
        )

        total_bytes = sum(
            item[
                "bytes"
            ]
            for item in results[
                split_name
            ]
        )

        manifest[
            "splits"
        ][
            split_name
        ] = {
            "images":
                len(filenames),
            "downloadedThisRun":
                downloaded_count,
            "bytes":
                total_bytes,
            "classObjectCounts":
                class_counts(
                    filenames,
                    annotation_index,
                ),
            "classImagePresence":
                class_image_presence(
                    filenames,
                    annotation_index,
                ),
            "filenames":
                filenames,
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
        "=== PILOT DATASET SUMMARY ==="
    )

    for split_name, filenames in (
        splits.items()
    ):
        print()
        print(
            split_name.upper()
        )

        print(
            f"  Images: "
            f"{len(filenames)}"
        )

        presence = (
            class_image_presence(
                filenames,
                annotation_index,
            )
        )

        for category in (
            TARGET_CLASSES
        ):
            print(
                f"  "
                f"{category:<18} "
                f"{presence.get(category, 0)} "
                "images"
            )

    print()
    print(
        "Train/validation overlap: 0"
    )

    print(
        "Checksum failures: 0"
    )

    print()
    print(
        "Dataset:"
    )

    print(
        f"  {PILOT_DIR}"
    )

    print(
        "Manifest:"
    )

    print(
        f"  {MANIFEST_PATH}"
    )

    print()
    print(
        "MATERIALIZATION STATUS: PASS"
    )


if __name__ == "__main__":
    main()