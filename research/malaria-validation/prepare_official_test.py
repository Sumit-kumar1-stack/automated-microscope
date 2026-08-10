from __future__ import annotations

import hashlib
import json
from pathlib import Path, PurePosixPath

from remotezip import RemoteZip


BASE_DIR = Path(__file__).resolve().parent

ARCHIVE_URL = (
    "https://data.broadinstitute.org/bbbc/"
    "BBBC041/malaria.zip"
)

TEST_JSON = (
    BASE_DIR
    / "data"
    / "metadata"
    / "malaria"
    / "test.json"
)

SOURCE_LABEL_DIR = (
    BASE_DIR
    / "data"
    / "yolo"
    / "labels"
    / "test"
)

TARGET_ROOT = (
    BASE_DIR
    / "data"
    / "yolo-parasite-official-test"
)

IMAGE_DIR = (
    TARGET_ROOT
    / "images"
    / "test"
)

LABEL_DIR = (
    TARGET_ROOT
    / "labels"
    / "test"
)

OUTPUT_DIR = (
    BASE_DIR
    / "outputs"
)

SUMMARY_PATH = (
    OUTPUT_DIR
    / "official_test_preparation.json"
)


# Original:
# 0 RBC
# 1 leukocyte
# 2 ring
# 3 trophozoite
# 4 schizont
# 5 gametocyte
# 6 difficult
#
# Parasite-only:
# 0 ring
# 1 trophozoite
# 2 schizont
# 3 gametocyte

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


def load_json(path: Path):
    with path.open(
        "r",
        encoding="utf-8",
    ) as handle:
        return json.load(handle)


def filename_for(record) -> str:
    return PurePosixPath(
        record["image"]["pathname"]
    ).name


def md5_bytes(payload: bytes) -> str:
    return hashlib.md5(
        payload
    ).hexdigest()


def convert_label(
    source: Path,
    destination: Path,
) -> int:
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
                    f"Invalid YOLO label: {source}"
                )

            old_class = int(
                parts[0]
            )

            if old_class not in OLD_TO_NEW:
                continue

            new_class = OLD_TO_NEW[
                old_class
            ]

            output.append(
                " ".join(
                    [
                        str(new_class),
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


def main() -> None:
    IMAGE_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    LABEL_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    records = load_json(
        TEST_JSON
    )

    print(
        "=== BBBC041 OFFICIAL "
        "PARASITE TEST SET ==="
    )

    print(
        f"Official test images: "
        f"{len(records)}"
    )

    target_objects = 0

    checksum_failures = 0

    with RemoteZip(
        ARCHIVE_URL
    ) as archive:

        for index, record in enumerate(
            records,
            start=1,
        ):
            filename = filename_for(
                record
            )

            member = (
                f"malaria/images/"
                f"{filename}"
            )

            target_image = (
                IMAGE_DIR
                / filename
            )

            expected_md5 = (
                record[
                    "image"
                ][
                    "checksum"
                ]
            )

            if not target_image.exists():

                payload = archive.read(
                    member
                )

                actual_md5 = md5_bytes(
                    payload
                )

                if actual_md5 != expected_md5:
                    checksum_failures += 1

                    raise RuntimeError(
                        "Checksum failure: "
                        f"{filename}"
                    )

                target_image.write_bytes(
                    payload
                )

                status = "downloaded"

            else:
                payload = (
                    target_image
                    .read_bytes()
                )

                actual_md5 = md5_bytes(
                    payload
                )

                if actual_md5 != expected_md5:
                    checksum_failures += 1

                    raise RuntimeError(
                        "Cached checksum "
                        f"failure: {filename}"
                    )

                status = "cached"

            source_label = (
                SOURCE_LABEL_DIR
                / (
                    Path(filename).stem
                    + ".txt"
                )
            )

            target_label = (
                LABEL_DIR
                / (
                    Path(filename).stem
                    + ".txt"
                )
            )

            objects = convert_label(
                source_label,
                target_label,
            )

            target_objects += (
                objects
            )

            print(
                f"[{index:03d}/"
                f"{len(records):03d}] "
                f"{filename} "
                f"{status} "
                f"targets={objects} "
                "checksum=PASS"
            )

    pilot_root = (
        BASE_DIR
        / "data"
        / "yolo-parasite-pilot"
    ).resolve().as_posix()

    test_images = (
        IMAGE_DIR
        .resolve()
        .as_posix()
    )

    yaml = f"""# BBBC041 parasite detector evaluation.
# Engineering research only.
# Official BBBC041 test split preserved.
# Not clinical validation.

path: {pilot_root}

train: images/train
val: images/val
test: {test_images}

names:
  0: 'ring'
  1: 'trophozoite'
  2: 'schizont'
  3: 'gametocyte'
"""

    dataset_yaml = (
        TARGET_ROOT
        / "dataset.yaml"
    )

    dataset_yaml.write_text(
        yaml,
        encoding="utf-8",
    )

    summary = {
        "dataset": "BBBC041",
        "split": "official-test",
        "images": len(records),
        "parasiteObjects":
            target_objects,
        "checksumFailures":
            checksum_failures,
        "classes":
            CLASS_NAMES,
        "trainingExposure":
            False,
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
        "=== TEST PREPARATION "
        "SUMMARY ==="
    )

    print(
        f"Images: {len(records)}"
    )

    print(
        f"Parasite objects: "
        f"{target_objects}"
    )

    print(
        f"Checksum failures: "
        f"{checksum_failures}"
    )

    print()
    print(
        "Dataset YAML:"
    )

    print(
        f"  {dataset_yaml}"
    )

    print()
    print(
        "PREPARATION STATUS: PASS"
    )


if __name__ == "__main__":
    main()