from __future__ import annotations

import json
import random
import shutil
from collections import Counter
from pathlib import Path

from PIL import (
    Image,
    ImageDraw,
    ImageFont,
)


# ============================================================
# CONFIG
# ============================================================

ROOT = Path(
    "research/malaria-validation"
)

IMAGE_ROOT = (
    ROOT
    / "data"
    / "yolo-binary-full"
    / "images"
)

LABEL_ROOT = (
    ROOT
    / "data"
    / "yolo"
    / "labels"
)

OUTPUT_ROOT = (
    ROOT
    / "data"
    / "stage-classifier-v2"
)

REPORT_ROOT = (
    ROOT
    / "outputs"
    / "stage-classifier-v2-materialization"
)

SEED = 41

CONTEXT_SCALE = 1.8

MIN_CROP_SIDE = 24

SUPPORTED_IMAGES = {
    ".png",
    ".jpg",
    ".jpeg",
}

STAGE_CLASSES = {
    2: "ring",
    3: "trophozoite",
    4: "schizont",
    5: "gametocyte",
}

EXPECTED_IMAGES = {
    "train": 966,
    "val": 242,
}

EXPECTED_TOTAL_STAGE_OBJECTS = 2149


# ============================================================
# FONT
# ============================================================

def get_font(
    size: int,
):
    for name in (
        "arial.ttf",
        "DejaVuSans.ttf",
    ):
        try:
            return ImageFont.truetype(
                name,
                size=size,
            )
        except OSError:
            pass

    return ImageFont.load_default()


FONT = get_font(17)


# ============================================================
# DATASET ALIGNMENT
# ============================================================

def get_images(
    split: str,
) -> list[Path]:
    image_dir = (
        IMAGE_ROOT
        / split
    )

    return sorted(
        path
        for path in image_dir.iterdir()
        if (
            path.is_file()
            and path.suffix.lower()
            in SUPPORTED_IMAGES
        )
    )


def get_labels(
    split: str,
) -> list[Path]:
    label_dir = (
        LABEL_ROOT
        / split
    )

    return sorted(
        label_dir.glob(
            "*.txt"
        )
    )


def verify_alignment(
    split: str,
) -> tuple[
    list[Path],
    Path,
]:
    images = get_images(
        split,
    )

    labels = get_labels(
        split,
    )

    expected_images = (
        EXPECTED_IMAGES[
            split
        ]
    )

    if len(images) != expected_images:
        raise RuntimeError(
            f"{split}: expected "
            f"{expected_images} images, "
            f"found {len(images)}"
        )

    if len(labels) != expected_images:
        raise RuntimeError(
            f"{split}: expected "
            f"{expected_images} labels, "
            f"found {len(labels)}"
        )

    image_stems = {
        path.stem
        for path in images
    }

    label_stems = {
        path.stem
        for path in labels
    }

    missing_labels = (
        image_stems
        - label_stems
    )

    missing_images = (
        label_stems
        - image_stems
    )

    if missing_labels:
        raise RuntimeError(
            f"{split}: "
            f"{len(missing_labels)} "
            "images do not have "
            "multiclass labels. "
            f"Examples: "
            f"{sorted(missing_labels)[:10]}"
        )

    if missing_images:
        raise RuntimeError(
            f"{split}: "
            f"{len(missing_images)} "
            "multiclass labels do not "
            "have corresponding images. "
            f"Examples: "
            f"{sorted(missing_images)[:10]}"
        )

    return (
        images,
        LABEL_ROOT / split,
    )


# ============================================================
# YOLO LABELS
# ============================================================

def read_annotations(
    label_path: Path,
) -> list[
    tuple[
        int,
        float,
        float,
        float,
        float,
    ]
]:
    annotations = []

    lines = (
        label_path.read_text(
            encoding="utf-8",
        )
        .splitlines()
    )

    for line_number, line in enumerate(
        lines,
        start=1,
    ):
        line = line.strip()

        if not line:
            continue

        parts = line.split()

        if len(parts) != 5:
            raise ValueError(
                f"{label_path}:"
                f"{line_number}: "
                "expected five YOLO "
                "values"
            )

        class_id = int(
            float(parts[0])
        )

        xc = float(
            parts[1]
        )

        yc = float(
            parts[2]
        )

        width = float(
            parts[3]
        )

        height = float(
            parts[4]
        )

        if not (
            0 <= xc <= 1
            and 0 <= yc <= 1
            and 0 < width <= 1
            and 0 < height <= 1
        ):
            raise ValueError(
                f"{label_path}:"
                f"{line_number}: "
                "invalid normalized "
                "coordinates"
            )

        annotations.append(
            (
                class_id,
                xc,
                yc,
                width,
                height,
            )
        )

    return annotations


# ============================================================
# CONTEXT CROP
# ============================================================

def calculate_crop(
    image_width: int,
    image_height: int,
    xc_norm: float,
    yc_norm: float,
    width_norm: float,
    height_norm: float,
) -> tuple[
    int,
    int,
    int,
    int,
]:
    xc = (
        xc_norm
        * image_width
    )

    yc = (
        yc_norm
        * image_height
    )

    box_width = (
        width_norm
        * image_width
    )

    box_height = (
        height_norm
        * image_height
    )

    requested_side = max(
        box_width,
        box_height,
    ) * CONTEXT_SCALE

    side = max(
        requested_side,
        MIN_CROP_SIDE,
    )

    side = min(
        side,
        image_width,
        image_height,
    )

    side_int = max(
        1,
        round(side),
    )

    left = round(
        xc
        - side_int / 2
    )

    top = round(
        yc
        - side_int / 2
    )

    # Shift square inside image
    # instead of adding synthetic
    # border pixels.
    left = max(
        0,
        min(
            left,
            image_width
            - side_int,
        ),
    )

    top = max(
        0,
        min(
            top,
            image_height
            - side_int,
        ),
    )

    right = (
        left
        + side_int
    )

    bottom = (
        top
        + side_int
    )

    return (
        left,
        top,
        right,
        bottom,
    )


# ============================================================
# OUTPUT
# ============================================================

def prepare_output() -> None:
    if OUTPUT_ROOT.exists():
        shutil.rmtree(
            OUTPUT_ROOT
        )

    if REPORT_ROOT.exists():
        shutil.rmtree(
            REPORT_ROOT
        )

    for split in (
        "train",
        "val",
    ):
        for class_name in (
            STAGE_CLASSES.values()
        ):
            (
                OUTPUT_ROOT
                / split
                / class_name
            ).mkdir(
                parents=True,
                exist_ok=True,
            )

    REPORT_ROOT.mkdir(
        parents=True,
        exist_ok=True,
    )


# ============================================================
# MATERIALIZATION
# ============================================================

def materialize_split(
    split: str,
) -> tuple[
    Counter,
    list[dict],
]:
    images, label_dir = (
        verify_alignment(
            split
        )
    )

    counts = Counter()

    records: list[
        dict
    ] = []

    print()
    print(
        f"=== {split.upper()} ==="
    )

    print(
        f"Source images: "
        f"{len(images)}"
    )

    for image_index, image_path in enumerate(
        images,
        start=1,
    ):
        label_path = (
            label_dir
            / f"{image_path.stem}.txt"
        )

        annotations = (
            read_annotations(
                label_path
            )
        )

        with Image.open(
            image_path,
        ) as source:
            image = source.convert(
                "RGB"
            )

        image_width, image_height = (
            image.size
        )

        for annotation_index, (
            class_id,
            xc,
            yc,
            box_width,
            box_height,
        ) in enumerate(
            annotations,
            start=1,
        ):
            if (
                class_id
                not in STAGE_CLASSES
            ):
                continue

            class_name = (
                STAGE_CLASSES[
                    class_id
                ]
            )

            (
                left,
                top,
                right,
                bottom,
            ) = calculate_crop(
                image_width,
                image_height,
                xc,
                yc,
                box_width,
                box_height,
            )

            crop = image.crop(
                (
                    left,
                    top,
                    right,
                    bottom,
                )
            )

            output_name = (
                f"{image_path.stem}"
                f"__c{class_id}"
                f"__a{annotation_index:04d}"
                ".png"
            )

            output_path = (
                OUTPUT_ROOT
                / split
                / class_name
                / output_name
            )

            crop.save(
                output_path,
                format="PNG",
            )

            counts[
                class_name
            ] += 1

            records.append(
                {
                    "split":
                        split,

                    "source_image":
                        str(
                            image_path
                        ),

                    "source_label":
                        str(
                            label_path
                        ),

                    "source_stem":
                        image_path.stem,

                    "annotation_index":
                        annotation_index,

                    "original_class_id":
                        class_id,

                    "stage":
                        class_name,

                    "original_bbox_yolo": [
                        xc,
                        yc,
                        box_width,
                        box_height,
                    ],

                    "context_scale":
                        CONTEXT_SCALE,

                    "crop_xyxy": [
                        left,
                        top,
                        right,
                        bottom,
                    ],

                    "crop_width":
                        right
                        - left,

                    "crop_height":
                        bottom
                        - top,

                    "output":
                        str(
                            output_path
                        ),
                }
            )

        if (
            image_index % 100 == 0
            or image_index
            == len(images)
        ):
            print(
                f" {image_index}/"
                f"{len(images)}"
            )

    print()

    for class_name in (
        STAGE_CLASSES.values()
    ):
        print(
            f" {class_name:14s}: "
            f"{counts[class_name]}"
        )

    print(
        f" Total crops: "
        f"{sum(counts.values())}"
    )

    return (
        counts,
        records,
    )


# ============================================================
# CONTACT SHEET
# ============================================================

def create_contact_sheet(
    records: list[dict],
) -> Path:
    rng = random.Random(
        SEED
    )

    selected: list[
        dict
    ] = []

    for class_name in (
        STAGE_CLASSES.values()
    ):
        candidates = [
            record
            for record in records
            if (
                record["stage"]
                == class_name
                and record["split"]
                == "val"
            )
        ]

        sample_size = min(
            6,
            len(candidates),
        )

        selected.extend(
            rng.sample(
                candidates,
                sample_size,
            )
        )

    tile_size = 260
    header_height = 42

    columns = 4

    rows = (
        len(selected)
        + columns
        - 1
    ) // columns

    sheet = Image.new(
        "RGB",
        (
            columns
            * tile_size,
            rows
            * (
                tile_size
                + header_height
            ),
        ),
        (
            5,
            10,
            12,
        ),
    )

    for index, record in enumerate(
        selected
    ):
        crop_path = Path(
            record["output"]
        )

        with Image.open(
            crop_path,
        ) as source:
            crop = source.convert(
                "RGB"
            )

        crop.thumbnail(
            (
                tile_size,
                tile_size,
            )
        )

        tile = Image.new(
            "RGB",
            (
                tile_size,
                tile_size
                + header_height,
            ),
            (
                8,
                15,
                18,
            ),
        )

        x = (
            tile_size
            - crop.width
        ) // 2

        y = (
            tile_size
            - crop.height
        ) // 2

        tile.paste(
            crop,
            (
                x,
                header_height
                + y,
            ),
        )

        draw = ImageDraw.Draw(
            tile
        )

        draw.text(
            (
                8,
                10,
            ),
            (
                f"{record['stage']} | "
                f"{record['split']}"
            ),
            fill=(
                235,
                245,
                245,
            ),
            font=FONT,
        )

        column = (
            index
            % columns
        )

        row = (
            index
            // columns
        )

        sheet.paste(
            tile,
            (
                column
                * tile_size,
                row
                * (
                    tile_size
                    + header_height
                ),
            ),
        )

    output_path = (
        REPORT_ROOT
        / "stage_crop_contact_sheet.jpg"
    )

    sheet.save(
        output_path,
        quality=95,
    )

    return output_path


# ============================================================
# MAIN
# ============================================================

def main() -> None:
    print(
        "=== STAGE CLASSIFIER V2 DATASET BUILDER ==="
    )

    print(
        f"Context scale: "
        f"{CONTEXT_SCALE}x"
    )

    print(
        "Official test used: NO"
    )

    prepare_output()

    train_counts, train_records = (
        materialize_split(
            "train"
        )
    )

    val_counts, val_records = (
        materialize_split(
            "val"
        )
    )

    all_records = (
        train_records
        + val_records
    )

    total_counts = Counter()

    total_counts.update(
        train_counts
    )

    total_counts.update(
        val_counts
    )

    total_objects = sum(
        total_counts.values()
    )

    if (
        total_objects
        != EXPECTED_TOTAL_STAGE_OBJECTS
    ):
        raise RuntimeError(
            "Expected "
            f"{EXPECTED_TOTAL_STAGE_OBJECTS} "
            "stage objects but "
            f"materialized "
            f"{total_objects}."
        )

    # Verify no source-image
    # leakage across splits.
    train_sources = {
        record[
            "source_stem"
        ]
        for record in train_records
    }

    val_sources = {
        record[
            "source_stem"
        ]
        for record in val_records
    }

    overlap = (
        train_sources
        & val_sources
    )

    if overlap:
        raise RuntimeError(
            "Train/validation source-image "
            "leakage detected. "
            f"Examples: "
            f"{sorted(overlap)[:10]}"
        )

    contact_sheet = (
        create_contact_sheet(
            all_records
        )
    )

    manifest = {
        "seed":
            SEED,

        "context_scale":
            CONTEXT_SCALE,

        "official_test_used":
            False,

        "image_level_split_preserved":
            True,

        "train_source_images":
            EXPECTED_IMAGES[
                "train"
            ],

        "val_source_images":
            EXPECTED_IMAGES[
                "val"
            ],

        "train_counts":
            dict(
                train_counts
            ),

        "val_counts":
            dict(
                val_counts
            ),

        "total_counts":
            dict(
                total_counts
            ),

        "total_stage_crops":
            total_objects,

        "records":
            all_records,
    }

    manifest_path = (
        REPORT_ROOT
        / "manifest.json"
    )

    manifest_path.write_text(
        json.dumps(
            manifest,
            indent=2,
        ),
        encoding="utf-8",
    )

    summary = {
        "status":
            "PASS",

        "official_test_used":
            False,

        "context_scale":
            CONTEXT_SCALE,

        "train_counts":
            dict(
                train_counts
            ),

        "val_counts":
            dict(
                val_counts
            ),

        "total_counts":
            dict(
                total_counts
            ),

        "total_stage_crops":
            total_objects,

        "train_val_source_overlap":
            len(overlap),

        "contact_sheet":
            str(
                contact_sheet.resolve()
            ),

        "manifest":
            str(
                manifest_path.resolve()
            ),
    }

    summary_path = (
        REPORT_ROOT
        / "summary.json"
    )

    summary_path.write_text(
        json.dumps(
            summary,
            indent=2,
        ),
        encoding="utf-8",
    )

    print()
    print(
        "========================================"
    )

    print(
        "STAGE CLASSIFIER V2 MATERIALIZATION"
    )

    print(
        "========================================"
    )

    print()

    print(
        "TRAIN"
    )

    for name in (
        STAGE_CLASSES.values()
    ):
        print(
            f" {name:14s}: "
            f"{train_counts[name]}"
        )

    print()
    print(
        "VAL"
    )

    for name in (
        STAGE_CLASSES.values()
    ):
        print(
            f" {name:14s}: "
            f"{val_counts[name]}"
        )

    print()
    print(
        "TOTAL"
    )

    for name in (
        STAGE_CLASSES.values()
    ):
        print(
            f" {name:14s}: "
            f"{total_counts[name]}"
        )

    print()

    print(
        f"Total crops: "
        f"{total_objects}"
    )

    print(
        f"Train/val source overlap: "
        f"{len(overlap)}"
    )

    print(
        f"Contact sheet: "
        f"{contact_sheet.resolve()}"
    )

    print(
        f"Summary: "
        f"{summary_path.resolve()}"
    )

    print()
    print(
        "OFFICIAL TEST USED: NO"
    )

    print()
    print(
        "STAGE DATASET MATERIALIZATION: PASS"
    )


if __name__ == "__main__":
    main()