from __future__ import annotations

import argparse
import hashlib
import json
import random
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

from remotezip import RemoteZip


DATASET_ID = "BBBC041"
ARCHIVE_URL = (
    "https://data.broadinstitute.org/bbbc/"
    "BBBC041/malaria.zip"
)

IMAGE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
}

ANNOTATION_NAMES = {
    "training.json",
    "testing.json",
    "train.json",
    "test.json",
    "validation.json",
    "val.json",
}

DEFAULT_SAMPLE_SIZE = 24
DEFAULT_RANDOM_SEED = 41

# Protect the prototype against unexpectedly huge
# individual archive members.
MAX_MEMBER_BYTES = 100 * 1024 * 1024

SCRIPT_DIR = Path(__file__).resolve().parent

DATA_DIR = SCRIPT_DIR / "data"
SAMPLE_DIR = DATA_DIR / "sample"
METADATA_DIR = DATA_DIR / "metadata"
OUTPUT_DIR = SCRIPT_DIR / "outputs"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_directories() -> None:
    DATA_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    SAMPLE_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    METADATA_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()

    with path.open("rb") as handle:
        while True:
            chunk = handle.read(
                1024 * 1024,
            )

            if not chunk:
                break

            digest.update(chunk)

    return digest.hexdigest()


def safe_target_path(
    base_directory: Path,
    member_name: str,
) -> Path:
    member_path = PurePosixPath(
        member_name,
    )

    if member_path.is_absolute():
        raise ValueError(
            f"Unsafe absolute archive path: "
            f"{member_name}"
        )

    if ".." in member_path.parts:
        raise ValueError(
            f"Unsafe parent traversal path: "
            f"{member_name}"
        )

    target = base_directory.joinpath(
        *member_path.parts
    )

    base_resolved = (
        base_directory.resolve()
    )

    target_resolved = target.resolve()

    if (
        target_resolved
        != base_resolved
        and base_resolved
        not in target_resolved.parents
    ):
        raise ValueError(
            f"Archive member escapes output "
            f"directory: {member_name}"
        )

    return target


def write_json(
    path: Path,
    payload: dict[str, Any],
) -> None:
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    path.write_text(
        json.dumps(
            payload,
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )


def is_image_member(
    filename: str,
) -> bool:
    suffix = PurePosixPath(
        filename
    ).suffix.lower()

    return suffix in IMAGE_EXTENSIONS


def is_json_member(
    filename: str,
) -> bool:
    return (
        PurePosixPath(
            filename
        ).suffix.lower()
        == ".json"
    )


def find_annotation_candidates(
    filenames: list[str],
) -> list[str]:
    json_files = [
        filename
        for filename in filenames
        if is_json_member(filename)
    ]

    preferred = [
        filename
        for filename in json_files
        if PurePosixPath(
            filename
        ).name.lower()
        in ANNOTATION_NAMES
    ]

    if preferred:
        return sorted(preferred)

    # Fallback: if names differ from what we
    # expect, return every JSON file so we can
    # inspect the real archive structure.
    return sorted(json_files)


def build_inventory(
    archive_entries,
) -> dict[str, Any]:
    files = [
        entry
        for entry in archive_entries
        if not entry.is_dir()
    ]

    filenames = [
        entry.filename
        for entry in files
    ]

    image_entries = [
        entry
        for entry in files
        if is_image_member(
            entry.filename
        )
    ]

    json_entries = [
        entry
        for entry in files
        if is_json_member(
            entry.filename
        )
    ]

    extension_counts = Counter()

    top_level_counts = Counter()

    for entry in files:
        path = PurePosixPath(
            entry.filename
        )

        suffix = (
            path.suffix.lower()
            or "(none)"
        )

        extension_counts[suffix] += 1

        if path.parts:
            top_level_counts[
                path.parts[0]
            ] += 1

    return {
        "schemaVersion": 1,
        "datasetId": DATASET_ID,
        "sourceArchive": ARCHIVE_URL,
        "generatedAt": utc_now(),
        "archive": {
            "fileCount": len(files),
            "imageCount": len(
                image_entries
            ),
            "jsonCount": len(
                json_entries
            ),
            "totalUncompressedBytes": sum(
                entry.file_size
                for entry in files
            ),
        },
        "extensionCounts": dict(
            sorted(
                extension_counts.items()
            )
        ),
        "topLevelEntries": dict(
            sorted(
                top_level_counts.items()
            )
        ),
        "annotationCandidates":
            find_annotation_candidates(
                filenames
            ),
    }


def extract_member(
    archive: RemoteZip,
    member_name: str,
    destination_root: Path,
    force: bool,
) -> dict[str, Any]:
    info = archive.getinfo(
        member_name
    )

    if info.is_dir():
        raise ValueError(
            f"Cannot extract directory: "
            f"{member_name}"
        )

    if info.file_size > MAX_MEMBER_BYTES:
        raise ValueError(
            f"Archive member is larger than "
            f"safety limit: {member_name} "
            f"({info.file_size} bytes)"
        )

    target = safe_target_path(
        destination_root,
        member_name,
    )

    target.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    if target.exists() and not force:
        return {
            "member": member_name,
            "localPath": str(
                target.relative_to(
                    SCRIPT_DIR
                )
            ),
            "bytes": target.stat().st_size,
            "sha256": sha256_file(
                target
            ),
            "downloaded": False,
        }

    payload = archive.read(
        member_name
    )

    target.write_bytes(
        payload
    )

    return {
        "member": member_name,
        "localPath": str(
            target.relative_to(
                SCRIPT_DIR
            )
        ),
        "bytes": len(payload),
        "sha256": sha256_bytes(
            payload
        ),
        "downloaded": True,
    }


def deterministic_sample(
    image_names: list[str],
    sample_size: int,
    seed: int,
) -> list[str]:
    if sample_size <= 0:
        return []

    ordered = sorted(
        image_names
    )

    if sample_size >= len(ordered):
        return ordered

    rng = random.Random(
        seed
    )

    selected = rng.sample(
        ordered,
        sample_size,
    )

    return sorted(selected)


def print_inventory(
    inventory: dict[str, Any],
) -> None:
    archive = inventory[
        "archive"
    ]

    print()
    print(
        "=== BBBC041 REMOTE ARCHIVE "
        "INVENTORY ==="
    )

    print(
        f"Archive files: "
        f"{archive['fileCount']}"
    )

    print(
        f"Image files: "
        f"{archive['imageCount']}"
    )

    print(
        f"JSON files: "
        f"{archive['jsonCount']}"
    )

    size_gb = (
        archive[
            "totalUncompressedBytes"
        ]
        / (1024 ** 3)
    )

    print(
        f"Uncompressed size: "
        f"{size_gb:.2f} GB"
    )

    print()
    print(
        "File extensions:"
    )

    for extension, count in (
        inventory[
            "extensionCounts"
        ].items()
    ):
        print(
            f"  {extension:<12} "
            f"{count}"
        )

    print()
    print(
        "Top-level archive entries:"
    )

    for name, count in (
        inventory[
            "topLevelEntries"
        ].items()
    ):
        print(
            f"  {name:<30} "
            f"{count}"
        )

    print()
    print(
        "Annotation candidates:"
    )

    candidates = inventory[
        "annotationCandidates"
    ]

    if not candidates:
        print(
            "  No JSON annotation "
            "files detected."
        )
    else:
        for candidate in candidates:
            print(
                f"  {candidate}"
            )


def run(
    list_only: bool,
    sample_size: int,
    seed: int,
    force: bool,
) -> None:
    ensure_directories()

    print(
        f"Connecting to {DATASET_ID}..."
    )

    print(
        "Using remote ZIP range access; "
        "the complete 2.26 GB archive "
        "will not be downloaded."
    )

    with RemoteZip(
        ARCHIVE_URL
    ) as archive:
        entries = archive.infolist()

        inventory = build_inventory(
            entries
        )

        inventory_path = (
            OUTPUT_DIR
            / "archive_inventory.json"
        )

        write_json(
            inventory_path,
            inventory,
        )

        print_inventory(
            inventory
        )

        print()
        print(
            "Inventory written to:"
        )
        print(
            f"  {inventory_path}"
        )

        if list_only:
            print()
            print(
                "LIST-ONLY COMPLETE"
            )
            print(
                "No microscopy images "
                "were extracted."
            )
            return

        filenames = [
            entry.filename
            for entry in entries
            if not entry.is_dir()
        ]

        annotations = (
            find_annotation_candidates(
                filenames
            )
        )

        annotation_results = []

        print()
        print(
            "=== ANNOTATION INGESTION ==="
        )

        for member_name in annotations:
            print(
                f"Retrieving "
                f"{member_name}"
            )

            result = extract_member(
                archive,
                member_name,
                METADATA_DIR,
                force,
            )

            annotation_results.append(
                result
            )

        image_names = [
            filename
            for filename in filenames
            if is_image_member(
                filename
            )
        ]

        selected_images = (
            deterministic_sample(
                image_names,
                sample_size,
                seed,
            )
        )

        sample_results = []

        print()
        print(
            "=== CONTROLLED IMAGE SAMPLE ==="
        )

        print(
            f"Sample size: "
            f"{len(selected_images)}"
        )

        print(
            f"Random seed: {seed}"
        )

        for index, member_name in (
            enumerate(
                selected_images,
                start=1,
            )
        ):
            print(
                f"[{index:02d}/"
                f"{len(selected_images):02d}] "
                f"{member_name}"
            )

            result = extract_member(
                archive,
                member_name,
                SAMPLE_DIR,
                force,
            )

            sample_results.append(
                result
            )

        manifest = {
            "schemaVersion": 1,
            "datasetId": DATASET_ID,
            "sourceArchive":
                ARCHIVE_URL,
            "createdAt": utc_now(),
            "sampling": {
                "strategy":
                    "deterministic-random",
                "seed": seed,
                "requestedSampleSize":
                    sample_size,
                "actualSampleSize":
                    len(
                        sample_results
                    ),
            },
            "annotations":
                annotation_results,
            "images":
                sample_results,
        }

        manifest_path = (
            OUTPUT_DIR
            / "sample_manifest.json"
        )

        write_json(
            manifest_path,
            manifest,
        )

        print()
        print(
            "=== INGESTION COMPLETE ==="
        )

        print(
            f"Annotations retrieved: "
            f"{len(annotation_results)}"
        )

        print(
            f"Sample images retrieved: "
            f"{len(sample_results)}"
        )

        print(
            f"Manifest: "
            f"{manifest_path}"
        )


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Controlled BBBC041 "
            "research dataset ingestion."
        )
    )

    parser.add_argument(
        "--list-only",
        action="store_true",
        help=(
            "Inspect the remote archive "
            "without extracting images."
        ),
    )

    parser.add_argument(
        "--sample-size",
        type=int,
        default=DEFAULT_SAMPLE_SIZE,
        help=(
            "Number of microscopy "
            "images to retrieve."
        ),
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_RANDOM_SEED,
        help=(
            "Deterministic sample seed."
        ),
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help=(
            "Overwrite existing "
            "sample files."
        ),
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.sample_size < 0:
        print(
            "ERROR: --sample-size "
            "cannot be negative.",
            file=sys.stderr,
        )

        return 2

    try:
        run(
            list_only=args.list_only,
            sample_size=args.sample_size,
            seed=args.seed,
            force=args.force,
        )

        return 0

    except KeyboardInterrupt:
        print()
        print(
            "Interrupted by user."
        )

        return 130

    except Exception as error:
        print()
        print(
            "BBBC041 ingestion failed:",
            file=sys.stderr,
        )

        print(
            f"{type(error).__name__}: "
            f"{error}",
            file=sys.stderr,
        )

        return 1


if __name__ == "__main__":
    raise SystemExit(
        main()
    )