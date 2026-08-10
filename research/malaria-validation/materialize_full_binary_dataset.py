from __future__ import annotations

import argparse
import json
import shutil
from collections import Counter
from pathlib import Path

from remotezip import RemoteZip


BASE_DIR = Path(__file__).resolve().parent

ARCHIVE_URL = (
    "https://data.broadinstitute.org/"
    "bbbc/BBBC041/malaria.zip"
)

SOURCE_ROOT = (
    BASE_DIR
    / "data"
    / "yolo"
)

TARGET_ROOT = (
    BASE_DIR
    / "data"
    / "yolo-binary-full"
)

OUTPUT_PATH = (
    BASE_DIR
    / "outputs"
    / "full_binary_dataset_summary.json"
)

SPLITS = [
    "train",
    "val",
]

# Original full YOLO class IDs:
#
# 0 red blood cell
# 1 leukocyte
# 2 ring
# 3 trophozoite
# 4 schizont
# 5 gametocyte
# 6 difficult
#
# Binary detector keeps only
# parasite stages 2, 3, 4, 5.
PARASITE_CLASS_IDS = {
    2,
    3,
    4,
    5,
}

IMAGE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
}


def parse_args():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--force",
        action="store_true",
        help=(
            "Redownload images that "
            "already exist."
        ),
    )

    return parser.parse_args()


def read_split(
    split: str,
):
    path = (
        SOURCE_ROOT
        / "splits"
        / f"{split}.txt"
    )

    if not path.exists():
        raise FileNotFoundError(
            f"Missing split manifest: "
            f"{path}"
        )

    entries = []

    for line in path.read_text(
        encoding="utf-8"
    ).splitlines():

        line = line.strip()

        if not line:
            continue

        entries.append(
            Path(line).name
        )

    return entries


def build_archive_index(
    remote_zip: RemoteZip,
):
    index = {}

    for member in remote_zip.namelist():

        normalized = (
            member
            .replace("\\", "/")
        )

        if "__MACOSX" in normalized:
            continue

        suffix = (
            Path(normalized)
            .suffix
            .lower()
        )

        if suffix not in IMAGE_EXTENSIONS:
            continue

        basename = (
            Path(normalized).name
        )

        # Real BBBC041 image files
        # are under malaria/, while
        # __MACOSX duplicates are ignored.
        index[basename] = normalized

    return index


def convert_label(
    source_path: Path,
    destination_path: Path,
):
    destination_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    kept = 0
    original_objects = 0

    output_lines = []

    if source_path.exists():

        for line in source_path.read_text(
            encoding="utf-8"
        ).splitlines():

            line = line.strip()

            if not line:
                continue

            parts = line.split()

            if len(parts) != 5:
                raise ValueError(
                    f"Invalid YOLO label: "
                    f"{source_path}"
                )

            original_objects += 1

            class_id = int(
                parts[0]
            )

            if (
                class_id
                not in PARASITE_CLASS_IDS
            ):
                continue

            # Binary class 0 = parasite.
            output_lines.append(
                "0 "
                + " ".join(
                    parts[1:]
                )
            )

            kept += 1

    destination_path.write_text(
        (
            "\n".join(
                output_lines
            )
            + (
                "\n"
                if output_lines
                else ""
            )
        ),
        encoding="utf-8",
    )

    return (
        original_objects,
        kept,
    )


def download_member(
    remote_zip: RemoteZip,
    member: str,
    destination: Path,
):
    destination.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    temporary = (
        destination
        .with_suffix(
            destination.suffix
            + ".part"
        )
    )

    if temporary.exists():
        temporary.unlink()

    with remote_zip.open(
        member
    ) as source:

        with temporary.open(
            "wb"
        ) as target:

            shutil.copyfileobj(
                source,
                target,
                length=1024 * 1024,
            )

    temporary.replace(
        destination
    )


def prepare_split(
    split: str,
    remote_zip: RemoteZip,
    archive_index: dict[str, str],
    force: bool,
):
    filenames = read_split(
        split
    )

    source_label_dir = (
        SOURCE_ROOT
        / "labels"
        / split
    )

    target_image_dir = (
        TARGET_ROOT
        / "images"
        / split
    )

    target_label_dir = (
        TARGET_ROOT
        / "labels"
        / split
    )

    target_image_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    target_label_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    downloaded = 0
    reused = 0

    parasite_objects = 0
    original_objects = 0

    positive_images = 0
    negative_images = 0

    extensions = Counter()

    missing = []

    for index, filename in enumerate(
        filenames,
        start=1,
    ):
        basename = (
            Path(filename).name
        )

        member = archive_index.get(
            basename
        )

        if member is None:
            missing.append(
                basename
            )
            continue

        destination = (
            target_image_dir
            / basename
        )

        if (
            destination.exists()
            and destination.stat().st_size > 0
            and not force
        ):
            reused += 1

        else:
            download_member(
                remote_zip,
                member,
                destination,
            )

            downloaded += 1

        extensions[
            destination.suffix.lower()
        ] += 1

        source_label = (
            source_label_dir
            / f"{Path(basename).stem}.txt"
        )

        destination_label = (
            target_label_dir
            / f"{Path(basename).stem}.txt"
        )

        (
            source_count,
            parasite_count,
        ) = convert_label(
            source_label,
            destination_label,
        )

        original_objects += (
            source_count
        )

        parasite_objects += (
            parasite_count
        )

        if parasite_count > 0:
            positive_images += 1
        else:
            negative_images += 1

        if (
            index % 25 == 0
            or index == len(filenames)
        ):
            print(
                f"{split}: "
                f"{index}/"
                f"{len(filenames)} "
                f"downloaded="
                f"{downloaded} "
                f"reused={reused}"
            )

    if missing:
        print()
        print(
            f"ERROR: {len(missing)} "
            f"{split} images missing "
            f"from archive index."
        )

        for filename in (
            missing[:20]
        ):
            print(
                f"  {filename}"
            )

        raise RuntimeError(
            "Dataset materialization "
            "incomplete."
        )

    return {
        "images":
            len(filenames),

        "downloaded":
            downloaded,

        "reused":
            reused,

        "formats":
            dict(extensions),

        "originalObjects":
            original_objects,

        "parasiteObjects":
            parasite_objects,

        "positiveImages":
            positive_images,

        "negativeImages":
            negative_images,
    }


def write_dataset_yaml():
    yaml_path = (
        TARGET_ROOT
        / "dataset.yaml"
    )

    content = (
        f"path: "
        f"{TARGET_ROOT.resolve()}\n"
        f"train: images/train\n"
        f"val: images/val\n"
        f"names:\n"
        f"  0: parasite\n"
    )

    yaml_path.write_text(
        content,
        encoding="utf-8",
    )

    return yaml_path


def count_files(
    directory: Path,
    extensions: set[str],
):
    return len(
        [
            path
            for path
            in directory.iterdir()
            if (
                path.is_file()
                and path.suffix.lower()
                in extensions
            )
        ]
    )


def validate(results):
    expected = {
        "train": 966,
        "val": 242,
    }

    print()
    print(
        "=== VALIDATION ==="
    )

    passed = True

    for split in SPLITS:

        expected_count = (
            expected[split]
        )

        image_count = count_files(
            TARGET_ROOT
            / "images"
            / split,
            IMAGE_EXTENSIONS,
        )

        label_count = count_files(
            TARGET_ROOT
            / "labels"
            / split,
            {".txt"},
        )

        print()
        print(
            split.upper()
        )

        print(
            f" Expected images: "
            f"{expected_count}"
        )

        print(
            f" Actual images:   "
            f"{image_count}"
        )

        print(
            f" Label files:     "
            f"{label_count}"
        )

        if (
            image_count
            != expected_count
        ):
            passed = False

        if (
            label_count
            != expected_count
        ):
            passed = False

    return passed


def main():
    args = parse_args()

    OUTPUT_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    TARGET_ROOT.mkdir(
        parents=True,
        exist_ok=True,
    )

    print(
        "=== BBBC041 FULL "
        "BINARY DATASET ==="
    )

    print()
    print(
        f"Remote archive:"
    )

    print(
        ARCHIVE_URL
    )

    print()
    print(
        "Opening remote ZIP..."
    )

    results = {}

    with RemoteZip(
        ARCHIVE_URL
    ) as remote_zip:

        archive_index = (
            build_archive_index(
                remote_zip
            )
        )

        print(
            f"Indexed real image "
            f"files: "
            f"{len(archive_index)}"
        )

        for split in SPLITS:
            print()
            print(
                f"=== "
                f"{split.upper()} ==="
            )

            results[
                split
            ] = prepare_split(
                split,
                remote_zip,
                archive_index,
                args.force,
            )

    dataset_yaml = (
        write_dataset_yaml()
    )

    passed = validate(
        results
    )

    summary = {
        "schemaVersion": 1,
        "dataset":
            "BBBC041",
        "task":
            "binary parasite detection",
        "datasetVariant":
            "full development split",
        "sourceArchive":
            ARCHIVE_URL,
        "classes": {
            "0":
                "parasite",
        },
        "sourceParasiteClasses": [
            2,
            3,
            4,
            5,
        ],
        "splits":
            results,
        "officialTestIncluded":
            False,
        "datasetYaml":
            str(
                dataset_yaml
            ),
        "status":
            (
                "PASS"
                if passed
                else "FAIL"
            ),
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
            f" Images: "
            f"{result['images']}"
        )

        print(
            f" Parasite objects: "
            f"{result['parasiteObjects']}"
        )

        print(
            f" Positive images: "
            f"{result['positiveImages']}"
        )

        print(
            f" Negative images: "
            f"{result['negativeImages']}"
        )

        print(
            f" Formats: "
            f"{result['formats']}"
        )

    print()
    print(
        f"Dataset YAML: "
        f"{dataset_yaml}"
    )

    print(
        f"Summary: "
        f"{OUTPUT_PATH}"
    )

    print()

    if passed:
        print(
            "MATERIALIZATION "
            "STATUS: PASS"
        )
    else:
        print(
            "MATERIALIZATION "
            "STATUS: FAIL"
        )

        raise SystemExit(1)


if __name__ == "__main__":
    main()