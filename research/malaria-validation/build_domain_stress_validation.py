from __future__ import annotations

import io
import json
import random
import shutil
from collections import Counter
from pathlib import Path

from PIL import (
    Image,
    ImageDraw,
    ImageEnhance,
    ImageFilter,
    ImageFont,
)


# ============================================================
# CONFIG
# ============================================================

SEED = 41

SOURCE_ROOT = Path(
    "research/malaria-validation/data/yolo-binary-full"
)

OUTPUT_ROOT = Path(
    "research/malaria-validation/data/yolo-binary-stress"
)

REPORT_ROOT = Path(
    "research/malaria-validation/outputs/domain-stress-validation"
)

STRESS_TYPES = (
    "brightness_contrast",
    "desaturation",
    "blur",
    "jpeg_resample",
    "combined_mild",
)

SUPPORTED_IMAGES = {
    ".png",
    ".jpg",
    ".jpeg",
}


# ============================================================
# IMAGE HELPERS
# ============================================================

def get_font(
    size: int,
) -> ImageFont.ImageFont:
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


HEADER_FONT = get_font(18)


def jpeg_round_trip(
    image: Image.Image,
    quality: int,
) -> Image.Image:
    buffer = io.BytesIO()

    image.save(
        buffer,
        format="JPEG",
        quality=quality,
        optimize=True,
    )

    buffer.seek(0)

    with Image.open(
        buffer,
    ) as encoded:
        result = encoded.convert(
            "RGB",
        )

    return result


def resize_round_trip(
    image: Image.Image,
    scale: float,
) -> Image.Image:
    original_width, original_height = (
        image.size
    )

    smaller_width = max(
        32,
        round(
            original_width
            * scale
        ),
    )

    smaller_height = max(
        32,
        round(
            original_height
            * scale
        ),
    )

    smaller = image.resize(
        (
            smaller_width,
            smaller_height,
        ),
        Image.Resampling.BILINEAR,
    )

    return smaller.resize(
        (
            original_width,
            original_height,
        ),
        Image.Resampling.BICUBIC,
    )


# ============================================================
# STRESS TRANSFORMS
# ============================================================

def apply_stress(
    image: Image.Image,
    stress_type: str,
    rng: random.Random,
) -> tuple[
    Image.Image,
    dict[str, float | int],
]:
    image = image.convert(
        "RGB",
    )

    parameters: dict[
        str,
        float | int,
    ] = {}

    if (
        stress_type
        == "brightness_contrast"
    ):
        brightness = rng.uniform(
            0.70,
            0.90,
        )

        contrast = rng.uniform(
            0.65,
            0.90,
        )

        image = (
            ImageEnhance.Brightness(
                image,
            ).enhance(
                brightness,
            )
        )

        image = (
            ImageEnhance.Contrast(
                image,
            ).enhance(
                contrast,
            )
        )

        parameters = {
            "brightness_factor":
                round(
                    brightness,
                    4,
                ),
            "contrast_factor":
                round(
                    contrast,
                    4,
                ),
        }

    elif (
        stress_type
        == "desaturation"
    ):
        saturation = rng.uniform(
            0.25,
            0.65,
        )

        image = (
            ImageEnhance.Color(
                image,
            ).enhance(
                saturation,
            )
        )

        parameters = {
            "saturation_factor":
                round(
                    saturation,
                    4,
                ),
        }

    elif (
        stress_type
        == "blur"
    ):
        radius = rng.uniform(
            0.60,
            1.40,
        )

        image = image.filter(
            ImageFilter.GaussianBlur(
                radius=radius,
            )
        )

        parameters = {
            "gaussian_blur_radius":
                round(
                    radius,
                    4,
                ),
        }

    elif (
        stress_type
        == "jpeg_resample"
    ):
        scale = rng.uniform(
            0.70,
            0.90,
        )

        quality = rng.randint(
            55,
            80,
        )

        image = resize_round_trip(
            image,
            scale,
        )

        image = jpeg_round_trip(
            image,
            quality,
        )

        parameters = {
            "resize_scale":
                round(
                    scale,
                    4,
                ),
            "jpeg_quality":
                quality,
        }

    elif (
        stress_type
        == "combined_mild"
    ):
        brightness = rng.uniform(
            0.78,
            0.95,
        )

        contrast = rng.uniform(
            0.72,
            0.95,
        )

        saturation = rng.uniform(
            0.45,
            0.80,
        )

        blur_radius = rng.uniform(
            0.35,
            0.90,
        )

        resize_scale = rng.uniform(
            0.80,
            0.95,
        )

        jpeg_quality = rng.randint(
            65,
            85,
        )

        image = (
            ImageEnhance.Brightness(
                image,
            ).enhance(
                brightness,
            )
        )

        image = (
            ImageEnhance.Contrast(
                image,
            ).enhance(
                contrast,
            )
        )

        image = (
            ImageEnhance.Color(
                image,
            ).enhance(
                saturation,
            )
        )

        image = image.filter(
            ImageFilter.GaussianBlur(
                radius=blur_radius,
            )
        )

        image = resize_round_trip(
            image,
            resize_scale,
        )

        image = jpeg_round_trip(
            image,
            jpeg_quality,
        )

        parameters = {
            "brightness_factor":
                round(
                    brightness,
                    4,
                ),
            "contrast_factor":
                round(
                    contrast,
                    4,
                ),
            "saturation_factor":
                round(
                    saturation,
                    4,
                ),
            "gaussian_blur_radius":
                round(
                    blur_radius,
                    4,
                ),
            "resize_scale":
                round(
                    resize_scale,
                    4,
                ),
            "jpeg_quality":
                jpeg_quality,
        }

    else:
        raise ValueError(
            f"Unknown stress type: "
            f"{stress_type}"
        )

    return (
        image,
        parameters,
    )


# ============================================================
# DATASET HELPERS
# ============================================================

def read_object_count(
    label_path: Path,
) -> int:
    if not label_path.exists():
        raise FileNotFoundError(
            f"Missing label: "
            f"{label_path}"
        )

    return sum(
        1
        for line
        in label_path.read_text(
            encoding="utf-8",
        ).splitlines()
        if line.strip()
    )


def prepare_directories() -> tuple[
    Path,
    Path,
]:
    image_output = (
        OUTPUT_ROOT
        / "images"
        / "val"
    )

    label_output = (
        OUTPUT_ROOT
        / "labels"
        / "val"
    )

    image_output.mkdir(
        parents=True,
        exist_ok=True,
    )

    label_output.mkdir(
        parents=True,
        exist_ok=True,
    )

    REPORT_ROOT.mkdir(
        parents=True,
        exist_ok=True,
    )

    return (
        image_output,
        label_output,
    )


# ============================================================
# CONTACT SHEET
# ============================================================

def build_contact_sheet(
    records: list[dict],
) -> Path:
    samples: list[dict] = []

    for stress_type in STRESS_TYPES:
        matching = [
            record
            for record in records
            if (
                record["stress_type"]
                == stress_type
            )
        ]

        samples.extend(
            matching[:2]
        )

    tile_width = 500
    tile_height = 400

    columns = 2

    rows = (
        len(samples)
        + columns
        - 1
    ) // columns

    sheet = Image.new(
        "RGB",
        (
            tile_width
            * columns,
            tile_height
            * rows,
        ),
        (
            4,
            10,
            12,
        ),
    )

    for index, record in enumerate(
        samples,
    ):
        path = Path(
            record["output_image"],
        )

        with Image.open(
            path,
        ) as source:
            image = source.convert(
                "RGB",
            )

        header_height = 42

        available_height = (
            tile_height
            - header_height
        )

        image.thumbnail(
            (
                tile_width,
                available_height,
            )
        )

        tile = Image.new(
            "RGB",
            (
                tile_width,
                tile_height,
            ),
            (
                7,
                14,
                17,
            ),
        )

        image_x = (
            tile_width
            - image.width
        ) // 2

        image_y = (
            header_height
            + (
                available_height
                - image.height
            )
            // 2
        )

        tile.paste(
            image,
            (
                image_x,
                image_y,
            ),
        )

        draw = ImageDraw.Draw(
            tile,
        )

        text = (
            f"{record['stress_type']} | "
            f"objects={record['objects']}"
        )

        draw.text(
            (
                10,
                10,
            ),
            text,
            fill=(
                230,
                240,
                240,
            ),
            font=HEADER_FONT,
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
                * tile_width,
                row
                * tile_height,
            ),
        )

    path = (
        REPORT_ROOT
        / "stress_contact_sheet.jpg"
    )

    sheet.save(
        path,
        quality=94,
    )

    return path


# ============================================================
# MAIN
# ============================================================

def main() -> None:
    print(
        "=== DOMAIN STRESS VALIDATION BUILDER ==="
    )

    source_images = (
        SOURCE_ROOT
        / "images"
        / "val"
    )

    source_labels = (
        SOURCE_ROOT
        / "labels"
        / "val"
    )

    if not source_images.exists():
        raise FileNotFoundError(
            source_images
        )

    if not source_labels.exists():
        raise FileNotFoundError(
            source_labels
        )

    (
        image_output,
        label_output,
    ) = prepare_directories()

    images = sorted(
        path
        for path in source_images.iterdir()
        if (
            path.is_file()
            and path.suffix.lower()
            in SUPPORTED_IMAGES
        )
    )

    if len(images) != 242:
        raise RuntimeError(
            "Expected 242 validation "
            f"images, found {len(images)}."
        )

    assignment_rng = (
        random.Random(
            SEED,
        )
    )

    shuffled = images.copy()

    assignment_rng.shuffle(
        shuffled,
    )

    records: list[dict] = []

    counts = Counter()

    total_objects = 0

    for index, image_path in enumerate(
        shuffled,
    ):
        stress_type = (
            STRESS_TYPES[
                index
                % len(
                    STRESS_TYPES
                )
            ]
        )

        # Unique deterministic RNG
        # per source image.
        sample_rng = random.Random(
            f"{SEED}:"
            f"{image_path.name}:"
            f"{stress_type}"
        )

        label_path = (
            source_labels
            / f"{image_path.stem}.txt"
        )

        object_count = (
            read_object_count(
                label_path,
            )
        )

        with Image.open(
            image_path,
        ) as source:
            original = (
                source.convert(
                    "RGB",
                )
            )

        original_size = (
            original.size
        )

        stressed, parameters = (
            apply_stress(
                original,
                stress_type,
                sample_rng,
            )
        )

        if (
            stressed.size
            != original_size
        ):
            raise RuntimeError(
                "Stress transform changed "
                "final image dimensions: "
                f"{image_path.name}"
            )

        # Keep the original stem so
        # YOLO image/label matching
        # remains straightforward.
        output_image = (
            image_output
            / f"{image_path.stem}.png"
        )

        output_label = (
            label_output
            / f"{image_path.stem}.txt"
        )

        stressed.save(
            output_image,
            format="PNG",
        )

        shutil.copyfile(
            label_path,
            output_label,
        )

        counts[
            stress_type
        ] += 1

        total_objects += (
            object_count
        )

        records.append(
            {
                "source_image":
                    str(
                        image_path,
                    ),
                "source_label":
                    str(
                        label_path,
                    ),
                "output_image":
                    str(
                        output_image,
                    ),
                "output_label":
                    str(
                        output_label,
                    ),
                "stress_type":
                    stress_type,
                "parameters":
                    parameters,
                "objects":
                    object_count,
                "positive":
                    object_count
                    > 0,
                "width":
                    original_size[0],
                "height":
                    original_size[1],
            }
        )

    # --------------------------------------------------------
    # Dataset YAML
    # --------------------------------------------------------

    original_train = (
        SOURCE_ROOT
        / "images"
        / "train"
    ).resolve().as_posix()

    output_root_absolute = (
        OUTPUT_ROOT
        .resolve()
        .as_posix()
    )

    dataset_yaml = (
        OUTPUT_ROOT
        / "dataset.yaml"
    )

    dataset_yaml.write_text(
        "\n".join(
            [
                f"path: {output_root_absolute}",
                f"train: {original_train}",
                "val: images/val",
                "",
                "names:",
                "  0: parasite",
                "",
            ]
        ),
        encoding="utf-8",
    )

    # --------------------------------------------------------
    # Manifest
    # --------------------------------------------------------

    manifest = {
        "seed": SEED,
        "purpose": (
            "Deterministic synthetic "
            "acquisition-domain stress "
            "validation derived only "
            "from the development "
            "validation split."
        ),
        "official_test_used": False,
        "source_validation_images":
            len(
                images,
            ),
        "stress_images":
            len(
                records,
            ),
        "parasite_objects":
            total_objects,
        "stress_distribution":
            dict(
                counts,
            ),
        "stress_types":
            list(
                STRESS_TYPES,
            ),
        "samples":
            records,
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

    contact_sheet = (
        build_contact_sheet(
            records,
        )
    )

    summary = {
        "status": "PASS",
        "source_images":
            len(
                images,
            ),
        "stress_images":
            len(
                records,
            ),
        "objects":
            total_objects,
        "distribution":
            dict(
                counts,
            ),
        "dataset_yaml":
            str(
                dataset_yaml.resolve(),
            ),
        "manifest":
            str(
                manifest_path.resolve(),
            ),
        "contact_sheet":
            str(
                contact_sheet.resolve(),
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
        "=== STRESS DATASET SUMMARY ==="
    )

    print(
        f"Source val images: "
        f"{len(images)}"
    )

    print(
        f"Stress images:     "
        f"{len(records)}"
    )

    print(
        f"Parasite objects:  "
        f"{total_objects}"
    )

    print()

    for stress_type in (
        STRESS_TYPES
    ):
        print(
            f"{stress_type:22s} "
            f"{counts[stress_type]}"
        )

    print()
    print(
        f"Dataset YAML: "
        f"{dataset_yaml.resolve()}"
    )

    print(
        f"Manifest: "
        f"{manifest_path.resolve()}"
    )

    print(
        f"Contact sheet: "
        f"{contact_sheet.resolve()}"
    )

    print()
    print(
        "DOMAIN STRESS BUILD: PASS"
    )


if __name__ == "__main__":
    main()