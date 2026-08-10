from __future__ import annotations

import json
import random
from pathlib import Path

from PIL import (
    Image,
    ImageDraw,
    ImageFont,
)


# ============================================================
# CONFIG
# ============================================================

SEED = 41

DATASET_ROOT = Path(
    "research/malaria-validation/data/yolo-binary-full"
)

OUTPUT_ROOT = Path(
    "research/malaria-validation/outputs/visual-gt-qa"
)

SAMPLE_PLAN = {
    "train": {
        "positive": 6,
        "negative": 2,
    },
    "val": {
        "positive": 3,
        "negative": 1,
    },
}

SUPPORTED_IMAGES = {
    ".png",
    ".jpg",
    ".jpeg",
}


# ============================================================
# HELPERS
# ============================================================

def get_font(size: int):
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
            pass

    return ImageFont.load_default()


LABEL_FONT = get_font(20)
SMALL_FONT = get_font(16)


def read_yolo_boxes(
    label_path: Path,
) -> list[tuple[int, float, float, float, float]]:
    if not label_path.exists():
        raise FileNotFoundError(
            f"Missing label file: {label_path}"
        )

    lines = [
        line.strip()
        for line in label_path.read_text(
            encoding="utf-8",
        ).splitlines()
        if line.strip()
    ]

    boxes: list[
        tuple[
            int,
            float,
            float,
            float,
            float,
        ]
    ] = []

    for index, line in enumerate(
        lines,
        start=1,
    ):
        parts = line.split()

        if len(parts) != 5:
            raise ValueError(
                f"{label_path}:{index}: "
                f"expected 5 values, "
                f"got {len(parts)}"
            )

        class_id = int(
            float(parts[0])
        )

        x_center = float(
            parts[1]
        )

        y_center = float(
            parts[2]
        )

        width = float(
            parts[3]
        )

        height = float(
            parts[4]
        )

        boxes.append(
            (
                class_id,
                x_center,
                y_center,
                width,
                height,
            )
        )

    return boxes


def list_samples(
    split: str,
) -> tuple[
    list[Path],
    list[Path],
]:
    image_dir = (
        DATASET_ROOT
        / "images"
        / split
    )

    label_dir = (
        DATASET_ROOT
        / "labels"
        / split
    )

    if not image_dir.exists():
        raise FileNotFoundError(
            f"Missing image directory: {image_dir}"
        )

    if not label_dir.exists():
        raise FileNotFoundError(
            f"Missing label directory: {label_dir}"
        )

    positives: list[Path] = []
    negatives: list[Path] = []

    images = sorted(
        path
        for path in image_dir.iterdir()
        if (
            path.is_file()
            and path.suffix.lower()
            in SUPPORTED_IMAGES
        )
    )

    for image_path in images:
        label_path = (
            label_dir
            / f"{image_path.stem}.txt"
        )

        boxes = read_yolo_boxes(
            label_path,
        )

        if boxes:
            positives.append(
                image_path,
            )
        else:
            negatives.append(
                image_path,
            )

    return (
        positives,
        negatives,
    )


def yolo_to_pixels(
    box: tuple[
        int,
        float,
        float,
        float,
        float,
    ],
    image_width: int,
    image_height: int,
) -> tuple[
    int,
    int,
    int,
    int,
]:
    (
        _class_id,
        x_center,
        y_center,
        width,
        height,
    ) = box

    x1 = (
        x_center
        - width / 2
    ) * image_width

    y1 = (
        y_center
        - height / 2
    ) * image_height

    x2 = (
        x_center
        + width / 2
    ) * image_width

    y2 = (
        y_center
        + height / 2
    ) * image_height

    return (
        max(
            0,
            round(x1),
        ),
        max(
            0,
            round(y1),
        ),
        min(
            image_width - 1,
            round(x2),
        ),
        min(
            image_height - 1,
            round(y2),
        ),
    )


def draw_sample(
    image_path: Path,
    split: str,
    sample_type: str,
    output_path: Path,
) -> dict:
    label_path = (
        DATASET_ROOT
        / "labels"
        / split
        / f"{image_path.stem}.txt"
    )

    boxes = read_yolo_boxes(
        label_path,
    )

    with Image.open(
        image_path,
    ) as source:
        image = source.convert(
            "RGB",
        )

    draw = ImageDraw.Draw(
        image,
    )

    image_width, image_height = (
        image.size
    )

    line_width = max(
        3,
        round(
            min(
                image_width,
                image_height,
            )
            / 300
        ),
    )

    for box_index, box in enumerate(
        boxes,
        start=1,
    ):
        (
            x1,
            y1,
            x2,
            y2,
        ) = yolo_to_pixels(
            box,
            image_width,
            image_height,
        )

        # Bright outline so ground truth
        # remains obvious against RBCs.
        outline = (
            0,
            255,
            170,
        )

        draw.rectangle(
            (
                x1,
                y1,
                x2,
                y2,
            ),
            outline=outline,
            width=line_width,
        )

        label = (
            f"GT parasite #{box_index}"
        )

        text_bbox = draw.textbbox(
            (
                x1,
                y1,
            ),
            label,
            font=LABEL_FONT,
        )

        text_width = (
            text_bbox[2]
            - text_bbox[0]
        )

        text_height = (
            text_bbox[3]
            - text_bbox[1]
        )

        label_y = max(
            0,
            y1
            - text_height
            - 10,
        )

        draw.rectangle(
            (
                x1,
                label_y,
                x1
                + text_width
                + 10,
                label_y
                + text_height
                + 8,
            ),
            fill=(
                0,
                80,
                60,
            ),
        )

        draw.text(
            (
                x1 + 5,
                label_y + 3,
            ),
            label,
            fill=(
                255,
                255,
                255,
            ),
            font=LABEL_FONT,
        )

    # --------------------------------------------------------
    # QA header
    # --------------------------------------------------------

    header_height = 44

    draw.rectangle(
        (
            0,
            0,
            image_width,
            header_height,
        ),
        fill=(
            5,
            15,
            18,
        ),
    )

    header = (
        f"{split.upper()} | "
        f"{sample_type.upper()} | "
        f"GT objects: {len(boxes)} | "
        f"{image_path.name}"
    )

    draw.text(
        (
            12,
            10,
        ),
        header,
        fill=(
            255,
            255,
            255,
        ),
        font=SMALL_FONT,
    )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    image.save(
        output_path,
        quality=95,
    )

    return {
        "split": split,
        "sample_type": sample_type,
        "image": str(
            image_path,
        ),
        "label": str(
            label_path,
        ),
        "output": str(
            output_path,
        ),
        "width": image_width,
        "height": image_height,
        "objects": len(
            boxes,
        ),
    }


def make_thumbnail(
    image_path: Path,
    width: int = 480,
    height: int = 360,
) -> Image.Image:
    with Image.open(
        image_path,
    ) as source:
        image = source.convert(
            "RGB",
        )

    image.thumbnail(
        (
            width,
            height,
        ),
    )

    canvas = Image.new(
        "RGB",
        (
            width,
            height,
        ),
        (
            7,
            13,
            16,
        ),
    )

    x = (
        width
        - image.width
    ) // 2

    y = (
        height
        - image.height
    ) // 2

    canvas.paste(
        image,
        (
            x,
            y,
        ),
    )

    return canvas


def build_contact_sheet(
    records: list[dict],
) -> Path:
    columns = 3

    tile_width = 480
    tile_height = 360

    rows = (
        len(records)
        + columns
        - 1
    ) // columns

    sheet = Image.new(
        "RGB",
        (
            columns
            * tile_width,
            rows
            * tile_height,
        ),
        (
            3,
            8,
            10,
        ),
    )

    for index, record in enumerate(
        records,
    ):
        thumbnail = make_thumbnail(
            Path(
                record["output"],
            ),
            width=tile_width,
            height=tile_height,
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
            thumbnail,
            (
                column
                * tile_width,
                row
                * tile_height,
            ),
        )

    output_path = (
        OUTPUT_ROOT
        / "contact_sheet.jpg"
    )

    sheet.save(
        output_path,
        quality=94,
    )

    return output_path


# ============================================================
# MAIN
# ============================================================

def main() -> None:
    print(
        "=== BBBC041 BINARY VISUAL GT QA ==="
    )

    print(
        f"Dataset: {DATASET_ROOT.resolve()}"
    )

    print(
        f"Seed: {SEED}"
    )

    rng = random.Random(
        SEED,
    )

    OUTPUT_ROOT.mkdir(
        parents=True,
        exist_ok=True,
    )

    records: list[dict] = []

    for split, plan in (
        SAMPLE_PLAN.items()
    ):
        (
            positives,
            negatives,
        ) = list_samples(
            split,
        )

        print()
        print(
            split.upper(),
        )

        print(
            f" Available positive: "
            f"{len(positives)}"
        )

        print(
            f" Available negative: "
            f"{len(negatives)}"
        )

        requested_positive = (
            plan["positive"]
        )

        requested_negative = (
            plan["negative"]
        )

        if (
            len(positives)
            < requested_positive
        ):
            raise RuntimeError(
                f"Not enough positive "
                f"{split} samples."
            )

        if (
            len(negatives)
            < requested_negative
        ):
            raise RuntimeError(
                f"Not enough negative "
                f"{split} samples."
            )

        selected_positive = (
            rng.sample(
                positives,
                requested_positive,
            )
        )

        selected_negative = (
            rng.sample(
                negatives,
                requested_negative,
            )
        )

        selections = [
            (
                "positive",
                path,
            )
            for path
            in selected_positive
        ] + [
            (
                "negative",
                path,
            )
            for path
            in selected_negative
        ]

        for sample_index, (
            sample_type,
            image_path,
        ) in enumerate(
            selections,
            start=1,
        ):
            output_name = (
                f"{split}_"
                f"{sample_type}_"
                f"{sample_index:02d}_"
                f"{image_path.stem}.jpg"
            )

            output_path = (
                OUTPUT_ROOT
                / output_name
            )

            record = draw_sample(
                image_path=image_path,
                split=split,
                sample_type=sample_type,
                output_path=output_path,
            )

            records.append(
                record,
            )

            print(
                f" {output_name}: "
                f"{record['objects']} "
                f"GT objects"
            )

    manifest_path = (
        OUTPUT_ROOT
        / "manifest.json"
    )

    manifest = {
        "seed": SEED,
        "dataset": str(
            DATASET_ROOT.resolve(),
        ),
        "purpose": (
            "Visual engineering QA of "
            "binary parasite ground-truth "
            "annotations. Research only."
        ),
        "sample_plan": (
            SAMPLE_PLAN
        ),
        "samples": records,
    }

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

    notes_path = (
        OUTPUT_ROOT
        / "QA_CHECKLIST.txt"
    )

    notes_path.write_text(
        """
BBBC041 BINARY PARASITE VISUAL GT QA
===================================

For every POSITIVE image verify:

[ ] Bounding box is centered on the intended parasite.
[ ] Box covers the parasite without excessive surrounding tissue.
[ ] Box is not obviously shifted.
[ ] No obviously annotated parasite is missing from the displayed GT.
[ ] No RBC-only object is incorrectly boxed as a parasite.

For every NEGATIVE image verify:

[ ] No ground-truth boxes are displayed.
[ ] Image appears to be a plausible parasite-negative field.

General checks:

[ ] Image orientation appears correct.
[ ] Image is not corrupted.
[ ] Bounding boxes use correct image coordinates.
[ ] Annotation sizes are visually plausible.

Decision:

[ ] PASS
[ ] REVIEW REQUIRED

Notes:
____________________________________________
____________________________________________
____________________________________________

Research engineering QA only.
Not a clinical validation procedure.
""".strip()
        + "\n",
        encoding="utf-8",
    )

    print()
    print(
        "=== VISUAL QA MATERIALIZATION COMPLETE ==="
    )

    print(
        f"Images generated: "
        f"{len(records)}"
    )

    print(
        f"Manifest: "
        f"{manifest_path.resolve()}"
    )

    print(
        f"Checklist: "
        f"{notes_path.resolve()}"
    )

    print(
        f"Contact sheet: "
        f"{contact_sheet.resolve()}"
    )

    print()
    print(
        "NEXT: inspect contact_sheet.jpg "
        "and individual images."
    )


if __name__ == "__main__":
    main()