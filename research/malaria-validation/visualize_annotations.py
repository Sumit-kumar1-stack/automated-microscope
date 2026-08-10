from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path, PurePosixPath
from typing import Any

from PIL import Image, ImageDraw, ImageFont


BASE_DIR = Path(__file__).resolve().parent

TRAINING_JSON = (
    BASE_DIR
    / "data"
    / "metadata"
    / "malaria"
    / "training.json"
)

SAMPLE_DIR = (
    BASE_DIR
    / "data"
    / "verified-sample"
)

MANIFEST_PATH = (
    BASE_DIR
    / "outputs"
    / "verified_sample_manifest.json"
)

PREVIEW_DIR = (
    BASE_DIR
    / "outputs"
    / "annotated-previews"
)

SUMMARY_PATH = (
    BASE_DIR
    / "outputs"
    / "annotation_preview_summary.json"
)


TARGET_CLASSES = {
    "ring",
    "trophozoite",
    "schizont",
    "gametocyte",
    "leukocyte",
}

ALL_KNOWN_CLASSES = {
    "red blood cell",
    "trophozoite",
    "difficult",
    "ring",
    "schizont",
    "gametocyte",
    "leukocyte",
}


CLASS_COLORS = {
    "red blood cell": (90, 170, 255),
    "trophozoite": (255, 170, 60),
    "difficult": (180, 180, 180),
    "ring": (255, 80, 110),
    "schizont": (190, 90, 255),
    "gametocyte": (90, 230, 160),
    "leukocyte": (255, 230, 80),
}

DEFAULT_COLOR = (
    255,
    255,
    255,
)


def load_json(
    path: Path,
) -> Any:
    if not path.exists():
        raise FileNotFoundError(
            f"Missing required file: {path}"
        )

    with path.open(
        "r",
        encoding="utf-8",
    ) as handle:
        return json.load(handle)


def get_filename(
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


def build_annotation_index(
    records: list[
        dict[str, Any]
    ],
) -> dict[
    str,
    dict[str, Any]
]:
    index: dict[
        str,
        dict[str, Any]
    ] = {}

    for record in records:
        filename = get_filename(
            record
        )

        if filename in index:
            raise ValueError(
                "Duplicate annotation "
                f"record: {filename}"
            )

        index[
            filename
        ] = record

    return index


def get_font(
    size: int,
):
    candidates = [
        "arial.ttf",
        "DejaVuSans.ttf",
    ]

    for candidate in candidates:
        try:
            return ImageFont.truetype(
                candidate,
                size=size,
            )
        except OSError:
            continue

    return ImageFont.load_default()


def should_draw(
    category: str,
    mode: str,
) -> bool:
    if mode == "all":
        return True

    return (
        category
        in TARGET_CLASSES
    )


def draw_label(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    text: str,
    color: tuple[int, int, int],
    font,
) -> None:
    bbox = draw.textbbox(
        (x, y),
        text,
        font=font,
    )

    width = (
        bbox[2]
        - bbox[0]
    )

    height = (
        bbox[3]
        - bbox[1]
    )

    padding = 4

    label_top = max(
        0,
        y
        - height
        - padding * 2,
    )

    draw.rectangle(
        (
            x,
            label_top,
            x
            + width
            + padding * 2,
            label_top
            + height
            + padding * 2,
        ),
        fill=color,
    )

    draw.text(
        (
            x + padding,
            label_top + padding,
        ),
        text,
        fill=(0, 0, 0),
        font=font,
    )


def draw_annotations(
    image: Image.Image,
    record: dict[str, Any],
    mode: str,
) -> tuple[
    Image.Image,
    Counter,
]:
    annotated = image.convert(
        "RGB"
    )

    draw = ImageDraw.Draw(
        annotated
    )

    width, height = (
        annotated.size
    )

    font_size = max(
        14,
        round(
            min(
                width,
                height,
            )
            * 0.018
        ),
    )

    font = get_font(
        font_size
    )

    line_width = max(
        2,
        round(
            min(
                width,
                height,
            )
            * 0.003
        ),
    )

    drawn_counts = Counter()

    for obj in record.get(
        "objects",
        [],
    ):
        category = str(
            obj.get(
                "category",
                "unknown",
            )
        )

        if not should_draw(
            category,
            mode,
        ):
            continue

        box = obj.get(
            "bounding_box"
        )

        if not isinstance(
            box,
            dict,
        ):
            continue

        minimum = box.get(
            "minimum",
            {},
        )

        maximum = box.get(
            "maximum",
            {},
        )

        # BBBC041:
        #
        # r = row    = y
        # c = column = x

        y1 = int(
            minimum["r"]
        )

        x1 = int(
            minimum["c"]
        )

        y2 = int(
            maximum["r"]
        )

        x2 = int(
            maximum["c"]
        )

        # Defensive clipping.
        x1 = max(
            0,
            min(
                width - 1,
                x1,
            ),
        )

        y1 = max(
            0,
            min(
                height - 1,
                y1,
            ),
        )

        x2 = max(
            0,
            min(
                width - 1,
                x2,
            ),
        )

        y2 = max(
            0,
            min(
                height - 1,
                y2,
            ),
        )

        if (
            x2 <= x1
            or y2 <= y1
        ):
            continue

        color = CLASS_COLORS.get(
            category,
            DEFAULT_COLOR,
        )

        draw.rectangle(
            (
                x1,
                y1,
                x2,
                y2,
            ),
            outline=color,
            width=line_width,
        )

        draw_label(
            draw=draw,
            x=x1,
            y=y1,
            text=category,
            color=color,
            font=font,
        )

        drawn_counts[
            category
        ] += 1

    return (
        annotated,
        drawn_counts,
    )


def validate_dimensions(
    image: Image.Image,
    record: dict[str, Any],
) -> bool:
    shape = record[
        "image"
    ][
        "shape"
    ]

    expected_height = int(
        shape["r"]
    )

    expected_width = int(
        shape["c"]
    )

    actual_width, actual_height = (
        image.size
    )

    return (
        actual_width
        == expected_width
        and actual_height
        == expected_height
    )


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Draw BBBC041 expert "
            "ground-truth annotations."
        )
    )

    parser.add_argument(
        "--mode",
        choices=[
            "targets",
            "all",
        ],
        default="targets",
        help=(
            "targets = parasite/"
            "leukocyte classes only; "
            "all = include RBCs and "
            "difficult annotations."
        ),
    )

    parser.add_argument(
        "--max-images",
        type=int,
        default=None,
        help=(
            "Optional maximum number "
            "of images to visualize."
        ),
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()

    PREVIEW_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    training = load_json(
        TRAINING_JSON
    )

    manifest = load_json(
        MANIFEST_PATH
    )

    if not isinstance(
        training,
        list,
    ):
        raise TypeError(
            "training.json must "
            "contain a list"
        )

    annotation_index = (
        build_annotation_index(
            training
        )
    )

    manifest_images = (
        manifest.get(
            "images",
            []
        )
    )

    if args.max_images is not None:
        if args.max_images <= 0:
            raise ValueError(
                "--max-images must "
                "be greater than zero"
            )

        manifest_images = (
            manifest_images[
                : args.max_images
            ]
        )

    overall_counts = Counter()

    results = []

    missing_images = 0
    missing_annotations = 0
    dimension_failures = 0

    print(
        "=== BBBC041 GROUND-TRUTH "
        "VISUALIZATION ==="
    )

    print(
        f"Mode: {args.mode}"
    )

    print(
        f"Images requested: "
        f"{len(manifest_images)}"
    )

    for index, manifest_item in (
        enumerate(
            manifest_images,
            start=1,
        )
    ):
        filename = manifest_item[
            "filename"
        ]

        image_path = (
            SAMPLE_DIR
            / filename
        )

        if not image_path.exists():
            print(
                f"[{index:02d}] "
                f"MISSING IMAGE "
                f"{filename}"
            )

            missing_images += 1
            continue

        record = (
            annotation_index.get(
                filename
            )
        )

        if record is None:
            print(
                f"[{index:02d}] "
                f"MISSING ANNOTATION "
                f"{filename}"
            )

            missing_annotations += 1
            continue

        with Image.open(
            image_path
        ) as source:
            source.load()

            dimensions_valid = (
                validate_dimensions(
                    source,
                    record,
                )
            )

            if not dimensions_valid:
                dimension_failures += 1

                print(
                    f"[{index:02d}] "
                    f"DIMENSION FAIL "
                    f"{filename}"
                )

                continue

            annotated, counts = (
                draw_annotations(
                    image=source,
                    record=record,
                    mode=args.mode,
                )
            )

            stem = Path(
                filename
            ).stem

            output_path = (
                PREVIEW_DIR
                / (
                    f"{stem}"
                    f"_annotated.jpg"
                )
            )

            annotated.save(
                output_path,
                "JPEG",
                quality=95,
            )

        overall_counts.update(
            counts
        )

        print(
            f"[{index:02d}/"
            f"{len(manifest_images):02d}] "
            f"{filename}"
        )

        print(
            "     boxes:",
            sum(
                counts.values()
            ),
        )

        if counts:
            print(
                "     labels:",
                ", ".join(
                    f"{name}={count}"
                    for name, count
                    in counts.items()
                ),
            )

        results.append(
            {
                "filename":
                    filename,
                "preview":
                    output_path.name,
                "dimensionsValid":
                    True,
                "drawnObjectCount":
                    sum(
                        counts.values()
                    ),
                "drawnClasses":
                    dict(
                        counts
                    ),
            }
        )

    summary = {
        "schemaVersion": 1,
        "dataset": "BBBC041",
        "split": "training",
        "mode": args.mode,
        "imagesRequested":
            len(
                manifest_images
            ),
        "imagesRendered":
            len(
                results
            ),
        "missingImages":
            missing_images,
        "missingAnnotations":
            missing_annotations,
        "dimensionFailures":
            dimension_failures,
        "drawnObjectCounts":
            dict(
                overall_counts
            ),
        "previews":
            results,
        "coordinateMapping": {
            "minimum.c": "x1",
            "minimum.r": "y1",
            "maximum.c": "x2",
            "maximum.r": "y2",
        },
        "validationPurpose": (
            "Visual engineering "
            "verification of BBBC041 "
            "expert annotations."
        ),
        "clinicalValidation": False,
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
        "=== VISUALIZATION SUMMARY ==="
    )

    print(
        f"Rendered: "
        f"{len(results)}"
    )

    print(
        f"Missing images: "
        f"{missing_images}"
    )

    print(
        "Missing annotations: "
        f"{missing_annotations}"
    )

    print(
        f"Dimension failures: "
        f"{dimension_failures}"
    )

    print()
    print(
        "Ground-truth boxes drawn:"
    )

    for category, count in (
        overall_counts.most_common()
    ):
        print(
            f"  {category:<20} "
            f"{count}"
        )

    print()
    print(
        "Previews:"
    )

    print(
        f"  {PREVIEW_DIR}"
    )

    print(
        "Summary:"
    )

    print(
        f"  {SUMMARY_PATH}"
    )

    if (
        missing_images
        or missing_annotations
        or dimension_failures
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