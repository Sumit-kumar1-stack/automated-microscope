from __future__ import annotations

import argparse
import csv
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np


@dataclass
class FocusMeasurement:
    name: str
    source: str
    blur_sigma: float
    focus_score: float
    width: int
    height: int


def load_grayscale_image(path: Path) -> np.ndarray:
    image = cv2.imread(
        str(path),
        cv2.IMREAD_UNCHANGED,
    )

    if image is None:
        raise FileNotFoundError(
            f"Unable to read image: {path}"
        )

    if image.ndim == 3:
        if image.shape[2] == 4:
            image = cv2.cvtColor(
                image,
                cv2.COLOR_BGRA2GRAY,
            )
        else:
            image = cv2.cvtColor(
                image,
                cv2.COLOR_BGR2GRAY,
            )

    return normalize_to_uint8(image)


def normalize_to_uint8(
    image: np.ndarray,
) -> np.ndarray:
    if image.dtype == np.uint8:
        return image

    image_float = image.astype(
        np.float32,
    )

    minimum = float(
        image_float.min(),
    )

    maximum = float(
        image_float.max(),
    )

    if maximum <= minimum:
        return np.zeros(
            image.shape,
            dtype=np.uint8,
        )

    normalized = (
        image_float - minimum
    ) / (
        maximum - minimum
    )

    return (
        normalized * 255.0
    ).astype(
        np.uint8,
    )


def laplacian_variance(
    image: np.ndarray,
) -> float:
    laplacian = cv2.Laplacian(
        image,
        cv2.CV_64F,
        ksize=3,
    )

    return float(
        laplacian.var(),
    )


def apply_gaussian_blur(
    image: np.ndarray,
    sigma: float,
) -> np.ndarray:
    if sigma <= 0:
        return image.copy()

    return cv2.GaussianBlur(
        image,
        (0, 0),
        sigmaX=sigma,
        sigmaY=sigma,
    )


def measure_image(
    name: str,
    source: str,
    image: np.ndarray,
    blur_sigma: float = 0.0,
) -> FocusMeasurement:
    height, width = image.shape[:2]

    return FocusMeasurement(
        name=name,
        source=source,
        blur_sigma=blur_sigma,
        focus_score=laplacian_variance(
            image,
        ),
        width=width,
        height=height,
    )


def calculate_monotonic_accuracy(
    measurements: list[
        FocusMeasurement
    ],
) -> float:
    if len(measurements) < 2:
        return 100.0

    correct = 0
    comparisons = 0

    for index in range(
        len(measurements) - 1
    ):
        current = measurements[index]
        following = measurements[
            index + 1
        ]

        comparisons += 1

        if (
            current.focus_score
            >
            following.focus_score
        ):
            correct += 1

    if comparisons == 0:
        return 100.0

    return (
        correct / comparisons
    ) * 100.0


def write_csv(
    path: Path,
    measurements: list[
        FocusMeasurement
    ],
) -> None:
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with path.open(
        "w",
        newline="",
        encoding="utf-8",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=[
                "name",
                "source",
                "blur_sigma",
                "focus_score",
                "width",
                "height",
            ],
        )

        writer.writeheader()

        for measurement in measurements:
            writer.writerow(
                asdict(
                    measurement,
                )
            )


def write_json(
    path: Path,
    payload: dict,
) -> None:
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with path.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            payload,
            file,
            indent=2,
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Validate Laplacian-variance "
            "focus scoring on real "
            "microscopy images."
        )
    )

    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path(__file__).parent
        / "data",
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).parent
        / "outputs",
    )

    args = parser.parse_args()

    in_focus_path = (
        args.data_dir
        / "in_focus.png"
    )

    out_focus_path = (
        args.data_dir
        / "out_of_focus.png"
    )

    print(
        "Loading BBBC006 microscopy images..."
    )

    in_focus_image = (
        load_grayscale_image(
            in_focus_path,
        )
    )

    out_focus_image = (
        load_grayscale_image(
            out_focus_path,
        )
    )

    real_measurements = [
        measure_image(
            name="BBBC006 in focus",
            source="real",
            image=in_focus_image,
        ),
        measure_image(
            name="BBBC006 out of focus",
            source="real",
            image=out_focus_image,
        ),
    ]

    blur_sigmas = [
        0.0,
        0.5,
        1.0,
        1.5,
        2.0,
        3.0,
        4.0,
        5.0,
    ]

    blur_measurements: list[
        FocusMeasurement
    ] = []

    for sigma in blur_sigmas:
        blurred = (
            apply_gaussian_blur(
                in_focus_image,
                sigma,
            )
        )

        blur_measurements.append(
            measure_image(
                name=(
                    f"Controlled blur "
                    f"sigma={sigma}"
                ),
                source=(
                    "controlled-blur"
                ),
                image=blurred,
                blur_sigma=sigma,
            )
        )

    real_pair_passed = (
        real_measurements[
            0
        ].focus_score
        >
        real_measurements[
            1
        ].focus_score
    )

    monotonic_accuracy = (
        calculate_monotonic_accuracy(
            blur_measurements,
        )
    )

    all_measurements = (
        real_measurements
        + blur_measurements
    )

    payload = {
        "benchmark": {
            "name": (
                "BBBC006 Focus "
                "Validation"
            ),
            "version": "0.1.0",
            "generatedAt": (
                datetime.now(
                    timezone.utc
                ).isoformat()
            ),
            "dataset": {
                "name": "BBBC006",
                "source": (
                    "Broad Bioimage "
                    "Benchmark Collection"
                ),
                "purpose": (
                    "Research validation "
                    "of image focus metrics"
                ),
            },
            "algorithm": {
                "name": (
                    "Laplacian Variance"
                ),
                "opencvKernelSize": 3,
            },
        },
        "summary": {
            "realPairPassed": (
                real_pair_passed
            ),
            "controlledBlurMonotonicAccuracy": (
                round(
                    monotonic_accuracy,
                    2,
                )
            ),
            "measurementCount": len(
                all_measurements
            ),
        },
        "measurements": [
            asdict(
                measurement
            )
            for measurement
            in all_measurements
        ],
        "limitations": [
            (
                "This initial benchmark "
                "uses the official "
                "BBBC006 example pair."
            ),
            (
                "Controlled Gaussian blur "
                "is used only as an "
                "engineering stress test."
            ),
            (
                "This benchmark does not "
                "constitute clinical "
                "validation."
            ),
        ],
    }

    csv_path = (
        args.output_dir
        / "focus_measurements.csv"
    )

    json_path = (
        args.output_dir
        / "focus_benchmark.json"
    )

    write_csv(
        csv_path,
        all_measurements,
    )

    write_json(
        json_path,
        payload,
    )

    print()
    print(
        "=== REAL MICROSCOPY PAIR ==="
    )

    for measurement in (
        real_measurements
    ):
        print(
            f"{measurement.name:<28}"
            f"{measurement.focus_score:>12.2f}"
        )

    print()
    print(
        "Real pair validation:",
        (
            "PASS"
            if real_pair_passed
            else "FAIL"
        ),
    )

    print()
    print(
        "=== CONTROLLED BLUR SWEEP ==="
    )

    for measurement in (
        blur_measurements
    ):
        print(
            f"sigma="
            f"{measurement.blur_sigma:<5}"
            f" score="
            f"{measurement.focus_score:.2f}"
        )

    print()
    print(
        "Monotonic focus ranking:",
        f"{monotonic_accuracy:.2f}%",
    )

    print()
    print(
        f"CSV:  {csv_path}"
    )

    print(
        f"JSON: {json_path}"
    )

    if not real_pair_passed:
        raise SystemExit(
            "Focus validation failed: "
            "the real in-focus image did "
            "not score above the "
            "out-of-focus image."
        )


if __name__ == "__main__":
    main()