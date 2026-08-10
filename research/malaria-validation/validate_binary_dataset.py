from pathlib import Path

ROOT = Path(
    "research/malaria-validation/data/yolo-binary-full"
)

errors: list[str] = []

total_images = 0
total_labels = 0
total_objects = 0
positive_images = 0
negative_images = 0


for split in ("train", "val"):
    image_dir = ROOT / "images" / split
    label_dir = ROOT / "labels" / split

    images = sorted(
        file
        for file in image_dir.iterdir()
        if file.suffix.lower()
        in {".png", ".jpg", ".jpeg"}
    )

    labels = sorted(
        label_dir.glob("*.txt")
    )

    image_stems = {
        file.stem
        for file in images
    }

    label_stems = {
        file.stem
        for file in labels
    }

    missing_labels = (
        image_stems - label_stems
    )

    missing_images = (
        label_stems - image_stems
    )

    for stem in sorted(
        missing_labels
    ):
        errors.append(
            f"{split}: missing label for {stem}"
        )

    for stem in sorted(
        missing_images
    ):
        errors.append(
            f"{split}: label has no image: {stem}"
        )

    split_objects = 0
    split_positive = 0
    split_negative = 0

    for image in images:
        label_path = (
            label_dir
            / f"{image.stem}.txt"
        )

        if not label_path.exists():
            continue

        lines = [
            line.strip()
            for line
            in label_path.read_text(
                encoding="utf-8",
            ).splitlines()
            if line.strip()
        ]

        if lines:
            split_positive += 1
        else:
            split_negative += 1

        for line_number, line in enumerate(
            lines,
            start=1,
        ):
            parts = line.split()

            if len(parts) != 5:
                errors.append(
                    f"{label_path}:"
                    f"{line_number}: "
                    f"expected 5 fields, "
                    f"got {len(parts)}"
                )
                continue

            try:
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

            except ValueError:
                errors.append(
                    f"{label_path}:"
                    f"{line_number}: "
                    "non-numeric YOLO label"
                )
                continue

            if class_id != 0:
                errors.append(
                    f"{label_path}:"
                    f"{line_number}: "
                    f"unexpected class "
                    f"{class_id}"
                )

            if not (
                0 <= x_center <= 1
                and 0 <= y_center <= 1
                and 0 < width <= 1
                and 0 < height <= 1
            ):
                errors.append(
                    f"{label_path}:"
                    f"{line_number}: "
                    "coordinates outside "
                    "[0,1]"
                )

            x1 = (
                x_center
                - width / 2
            )

            y1 = (
                y_center
                - height / 2
            )

            x2 = (
                x_center
                + width / 2
            )

            y2 = (
                y_center
                + height / 2
            )

            tolerance = 1e-6

            if (
                x1 < -tolerance
                or y1 < -tolerance
                or x2 > 1 + tolerance
                or y2 > 1 + tolerance
            ):
                errors.append(
                    f"{label_path}:"
                    f"{line_number}: "
                    "bounding box exceeds "
                    "image boundary"
                )

            split_objects += 1

    total_images += len(
        images
    )

    total_labels += len(
        labels
    )

    total_objects += (
        split_objects
    )

    positive_images += (
        split_positive
    )

    negative_images += (
        split_negative
    )

    print()
    print(split.upper())
    print(
        f" Images:    "
        f"{len(images)}"
    )
    print(
        f" Labels:    "
        f"{len(labels)}"
    )
    print(
        f" Objects:   "
        f"{split_objects}"
    )
    print(
        f" Positive:  "
        f"{split_positive}"
    )
    print(
        f" Negative:  "
        f"{split_negative}"
    )


print()
print(
    "=== FINAL INTEGRITY ==="
)

print(
    f"Images:           "
    f"{total_images}"
)

print(
    f"Labels:           "
    f"{total_labels}"
)

print(
    f"Parasite objects: "
    f"{total_objects}"
)

print(
    f"Positive images:  "
    f"{positive_images}"
)

print(
    f"Negative images:  "
    f"{negative_images}"
)

print(
    f"Errors:           "
    f"{len(errors)}"
)


if errors:
    print()
    print("FIRST ERRORS:")

    for error in errors[:50]:
        print(
            f" - {error}"
        )

    raise SystemExit(1)


expected = {
    "images": 1208,
    "labels": 1208,
    "objects": 2149,
}


if (
    total_images
    != expected["images"]
    or total_labels
    != expected["labels"]
    or total_objects
    != expected["objects"]
):
    print()
    print(
        "INTEGRITY STATUS: FAIL"
    )

    raise SystemExit(1)


print()
print(
    "INTEGRITY STATUS: PASS"
)