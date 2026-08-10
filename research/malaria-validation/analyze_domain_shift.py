from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import cv2
import numpy as np


BASE_DIR = Path(__file__).resolve().parent

SPLITS = {
    "train": {
        "images": (
            BASE_DIR
            / "data"
            / "yolo-parasite-pilot"
            / "images"
            / "train"
        ),
        "labels": (
            BASE_DIR
            / "data"
            / "yolo-parasite-pilot"
            / "labels"
            / "train"
        ),
    },
    "val": {
        "images": (
            BASE_DIR
            / "data"
            / "yolo-parasite-pilot"
            / "images"
            / "val"
        ),
        "labels": (
            BASE_DIR
            / "data"
            / "yolo-parasite-pilot"
            / "labels"
            / "val"
        ),
    },
    "official_test": {
        "images": (
            BASE_DIR
            / "data"
            / "yolo-parasite-official-test"
            / "images"
            / "test"
        ),
        "labels": (
            BASE_DIR
            / "data"
            / "yolo-parasite-official-test"
            / "labels"
            / "test"
        ),
    },
}

OUTPUT_PATH = (
    BASE_DIR
    / "outputs"
    / "domain_shift_analysis.json"
)

IMAGE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
}


def summarize(values):
    if not values:
        return {
            "mean": 0.0,
            "median": 0.0,
            "min": 0.0,
            "max": 0.0,
        }

    array = np.asarray(
        values,
        dtype=np.float64,
    )

    return {
        "mean": float(
            np.mean(array)
        ),
        "median": float(
            np.median(array)
        ),
        "min": float(
            np.min(array)
        ),
        "max": float(
            np.max(array)
        ),
    }


def analyze_split(
    name: str,
    image_dir: Path,
    label_dir: Path,
):
    images = sorted(
        path
        for path in image_dir.iterdir()
        if (
            path.is_file()
            and path.suffix.lower()
            in IMAGE_EXTENSIONS
        )
    )

    formats = Counter()
    resolutions = Counter()

    brightness = []
    contrast = []
    saturation = []
    sharpness = []

    normalized_box_widths = []
    normalized_box_heights = []
    normalized_box_areas = []

    pixel_box_widths = []
    pixel_box_heights = []

    objects = 0

    for index, path in enumerate(
        images,
        start=1,
    ):
        image = cv2.imread(
            str(path)
        )

        if image is None:
            raise RuntimeError(
                f"Could not read {path}"
            )

        height, width = (
            image.shape[:2]
        )

        formats[
            path.suffix.lower()
        ] += 1

        resolutions[
            f"{width}x{height}"
        ] += 1

        gray = cv2.cvtColor(
            image,
            cv2.COLOR_BGR2GRAY,
        )

        hsv = cv2.cvtColor(
            image,
            cv2.COLOR_BGR2HSV,
        )

        brightness.append(
            float(
                np.mean(gray)
            )
        )

        contrast.append(
            float(
                np.std(gray)
            )
        )

        saturation.append(
            float(
                np.mean(
                    hsv[:, :, 1]
                )
            )
        )

        sharpness.append(
            float(
                cv2.Laplacian(
                    gray,
                    cv2.CV_64F,
                ).var()
            )
        )

        label_path = (
            label_dir
            / f"{path.stem}.txt"
        )

        if label_path.exists():
            for line in (
                label_path
                .read_text(
                    encoding="utf-8"
                )
                .splitlines()
            ):
                parts = (
                    line.strip()
                    .split()
                )

                if len(parts) != 5:
                    continue

                box_width = float(
                    parts[3]
                )

                box_height = float(
                    parts[4]
                )

                normalized_box_widths.append(
                    box_width
                )

                normalized_box_heights.append(
                    box_height
                )

                normalized_box_areas.append(
                    box_width
                    * box_height
                )

                pixel_box_widths.append(
                    box_width
                    * width
                )

                pixel_box_heights.append(
                    box_height
                    * height
                )

                objects += 1

        if (
            index % 25 == 0
            or index == len(images)
        ):
            print(
                f"{name}: "
                f"{index}/{len(images)}"
            )

    return {
        "images":
            len(images),

        "formats":
            dict(formats),

        "resolutions":
            dict(resolutions),

        "objects":
            objects,

        "brightness":
            summarize(
                brightness
            ),

        "contrast":
            summarize(
                contrast
            ),

        "saturation":
            summarize(
                saturation
            ),

        "sharpness":
            summarize(
                sharpness
            ),

        "normalizedBoxWidth":
            summarize(
                normalized_box_widths
            ),

        "normalizedBoxHeight":
            summarize(
                normalized_box_heights
            ),

        "normalizedBoxArea":
            summarize(
                normalized_box_areas
            ),

        "pixelBoxWidth":
            summarize(
                pixel_box_widths
            ),

        "pixelBoxHeight":
            summarize(
                pixel_box_heights
            ),
    }


def main():
    OUTPUT_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    print(
        "=== BBBC041 DOMAIN "
        "SHIFT ANALYSIS ==="
    )

    results = {}

    for name, paths in (
        SPLITS.items()
    ):
        print()
        print(
            f"=== {name.upper()} ==="
        )

        results[name] = (
            analyze_split(
                name=name,
                image_dir=
                    paths["images"],
                label_dir=
                    paths["labels"],
            )
        )

    OUTPUT_PATH.write_text(
        json.dumps(
            results,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print()
    print(
        "=== SUMMARY ==="
    )

    for name, result in (
        results.items()
    ):
        print()
        print(name.upper())

        print(
            " Images:",
            result["images"],
        )

        print(
            " Formats:",
            result["formats"],
        )

        print(
            " Resolutions:",
            result["resolutions"],
        )

        print(
            " Objects:",
            result["objects"],
        )

        print(
            " Mean brightness:",
            f"{result['brightness']['mean']:.2f}",
        )

        print(
            " Mean contrast:",
            f"{result['contrast']['mean']:.2f}",
        )

        print(
            " Mean saturation:",
            f"{result['saturation']['mean']:.2f}",
        )

        print(
            " Mean sharpness:",
            f"{result['sharpness']['mean']:.2f}",
        )

        print(
            " Mean normalized box area:",
            f"{result['normalizedBoxArea']['mean']:.6f}",
        )

        print(
            " Mean box width px:",
            f"{result['pixelBoxWidth']['mean']:.2f}",
        )

        print(
            " Mean box height px:",
            f"{result['pixelBoxHeight']['mean']:.2f}",
        )

    print()
    print(
        f"Saved: {OUTPUT_PATH}"
    )

    print()
    print(
        "ANALYSIS STATUS: PASS"
    )


if __name__ == "__main__":
    main()