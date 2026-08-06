from __future__ import annotations

import argparse
import csv

import json
import statistics
import urllib.request

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from remotezip import RemoteZip


BASE_URL = (
    "https://data.broadinstitute.org/"
    "bbbc/BBBC006"
)

COUNTS_URL = (
    f"{BASE_URL}/"
    "BBBC006_v1_counts.csv"
)

Z_PLANES = [
    0,
    4,
    8,
    12,
    16,
    20,
    24,
    28,
    32,
]

OPTIMAL_Z = 16

GROUND_TRUTH_MIN_Z = 11
GROUND_TRUTH_MAX_Z = 23

MICRONS_PER_PLANE = 2.0


@dataclass
class FieldDefinition:
    well: str
    site: int
    nuclei_count: int

    @property
    def token(self) -> str:
        return (
            f"_{self.well}_"
            f"s{self.site}_w1"
        )


@dataclass
class PlaneMeasurement:
    field: str
    z: int
    focus_score: float


@dataclass
class FieldResult:
    field: str
    well: str
    site: int
    nuclei_count: int
    predicted_best_z: int
    best_score: float
    exact_optimal_match: bool
    inside_focus_band: bool
    absolute_error_planes: int
    estimated_error_microns: float
    direction_accuracy_percent: float


def archive_url(
    z: int,
) -> str:
    return (
        f"{BASE_URL}/"
        f"BBBC006_v1_images_z_{z:02d}.zip"
    )


def download_counts_csv(
    cache_dir: Path,
) -> Path:
    cache_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    csv_path = (
        cache_dir
        / "BBBC006_v1_counts.csv"
    )

    if (
        csv_path.exists()
        and csv_path.stat().st_size > 0
    ):
        print(
            "Using cached BBBC006 counts."
        )

        return csv_path

    print(
        "Downloading BBBC006 field counts..."
    )

    request = urllib.request.Request(
        COUNTS_URL,
        headers={
            "User-Agent":
                "automated-microscope-research/0.3"
        },
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=60,
        ) as response:
            payload = response.read()

    except Exception as error:
        raise RuntimeError(
            "Unable to download BBBC006 "
            "counts CSV."
        ) from error

    if not payload:
        raise RuntimeError(
            "Downloaded BBBC006 counts "
            "file is empty."
        )

    csv_path.write_bytes(
        payload
    )

    print(
        "Counts downloaded:",
        csv_path,
    )

    return csv_path


def load_candidate_fields(
    counts_path: Path,
) -> list[FieldDefinition]:
    fields: list[
        FieldDefinition
    ] = []

    with counts_path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as file:
        reader = csv.DictReader(
            file
        )

        for row in reader:
            try:
                nuclei_count = int(
                    row[
                        "Image_Count_Nuclei"
                    ]
                )

                well = (
                    row[
                        "Image_Metadata_Well"
                    ]
                    .strip()
                    .lower()
                )

                site = int(
                    row[
                        "Image_Metadata_Site"
                    ]
                )
            except (
                KeyError,
                TypeError,
                ValueError,
            ):
                continue

            # Skip fields with almost no
            # biological content.
            if nuclei_count < 20:
                continue

            fields.append(
                FieldDefinition(
                    well=well,
                    site=site,
                    nuclei_count=(
                        nuclei_count
                    ),
                )
            )

    if not fields:
        raise RuntimeError(
            "No suitable fields were found "
            "in the BBBC006 counts file."
        )

    return fields


def select_spread_fields(
    candidates: list[
        FieldDefinition
    ],
    sample_size: int,
) -> list[FieldDefinition]:
    """
    Select fields spread across the available
    candidate list rather than taking only the
    first N records.

    This reduces obvious ordering bias.
    """

    if sample_size <= 0:
        raise ValueError(
            "sample_size must be > 0"
        )

    if sample_size >= len(
        candidates
    ):
        return candidates

    indexes = np.linspace(
        0,
        len(candidates) - 1,
        sample_size,
        dtype=int,
    )

    selected = [
        candidates[index]
        for index in indexes
    ]

    return selected


def find_member(
    archive: RemoteZip,
    field: FieldDefinition,
) -> str:
    token = field.token.lower()

    matches = [
        item.filename
        for item
        in archive.infolist()
        if token
        in item.filename.lower()
        and item.filename.lower().endswith(
            (".tif", ".tiff")
        )
    ]

    if not matches:
        raise FileNotFoundError(
            "Unable to locate field "
            f"{field.well}/site "
            f"{field.site}"
        )

    return matches[0]


def cached_image_path(
    cache_dir: Path,
    field: FieldDefinition,
    z: int,
) -> Path:
    return (
        cache_dir
        / (
            f"{field.well}_"
            f"s{field.site}_"
            f"w1_z{z:02d}.tif"
        )
    )


def download_selected_fields(
    fields: list[
        FieldDefinition
    ],
    cache_dir: Path,
) -> None:
    cache_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    for z in Z_PLANES:
        missing = [
            field
            for field in fields
            if not cached_image_path(
                cache_dir,
                field,
                z,
            ).exists()
        ]

        if not missing:
            print(
                f"z={z:02d}: "
                "all selected fields cached"
            )

            continue

        print(
            f"z={z:02d}: accessing "
            f"{len(missing)} field(s)..."
        )

        url = archive_url(z)

        with RemoteZip(
            url,
            timeout=90,
        ) as archive:
            for field in missing:
                member = find_member(
                    archive,
                    field,
                )

                with archive.open(
                    member,
                ) as source:
                    payload = (
                        source.read()
                    )

                if not payload:
                    raise RuntimeError(
                        "Empty image payload "
                        f"for {field.token}, "
                        f"z={z}"
                    )

                target = (
                    cached_image_path(
                        cache_dir,
                        field,
                        z,
                    )
                )

                target.write_bytes(
                    payload
                )

                print(
                    "  cached",
                    field.well,
                    f"site={field.site}",
                    f"z={z:02d}",
                )


def load_image(
    path: Path,
) -> np.ndarray:
    image = cv2.imread(
        str(path),
        cv2.IMREAD_UNCHANGED,
    )

    if image is None:
        raise RuntimeError(
            f"Unable to decode {path}"
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

    return image


def normalize_field_stack(
    images: list[
        np.ndarray
    ],
) -> list[np.ndarray]:
    """
    Each field is normalized using one shared
    intensity window across all sampled Z planes.

    We do not independently normalize each plane.
    """

    flattened = np.concatenate(
        [
            image
            .astype(
                np.float32
            )
            .reshape(-1)
            for image in images
        ]
    )

    lower = float(
        np.percentile(
            flattened,
            0.5,
        )
    )

    upper = float(
        np.percentile(
            flattened,
            99.5,
        )
    )

    if upper <= lower:
        raise RuntimeError(
            "Invalid intensity range."
        )

    result: list[
        np.ndarray
    ] = []

    for image in images:
        normalized = (
            image.astype(
                np.float32
            )
            - lower
        ) / (
            upper - lower
        )

        normalized = np.clip(
            normalized,
            0.0,
            1.0,
        )

        result.append(
            (
                normalized
                * 255.0
            ).astype(
                np.uint8
            )
        )

    return result


def laplacian_variance(
    image: np.ndarray,
) -> float:
    laplacian = cv2.Laplacian(
        image,
        cv2.CV_64F,
        ksize=1,
    )

    return float(
        laplacian.var()
    )


def direction_accuracy(
    measurements: list[
        PlaneMeasurement
    ],
) -> float:
    ordered = sorted(
        measurements,
        key=lambda item: item.z,
    )

    correct = 0
    total = 0

    for (
        current,
        following,
    ) in zip(
        ordered,
        ordered[1:],
    ):
        total += 1

        if following.z <= OPTIMAL_Z:
            expected = (
                following.focus_score
                >= current.focus_score
            )

        elif current.z >= OPTIMAL_Z:
            expected = (
                following.focus_score
                <= current.focus_score
            )

        else:
            expected = True

        if expected:
            correct += 1

    if total == 0:
        return 0.0

    return (
        correct / total
    ) * 100.0


def evaluate_field(
    field: FieldDefinition,
    cache_dir: Path,
) -> tuple[
    FieldResult,
    list[PlaneMeasurement],
]:
    raw_images = [
        load_image(
            cached_image_path(
                cache_dir,
                field,
                z,
            )
        )
        for z in Z_PLANES
    ]

    normalized_images = (
        normalize_field_stack(
            raw_images
        )
    )

    measurements = [
        PlaneMeasurement(
            field=(
                f"{field.well}_"
                f"s{field.site}"
            ),
            z=z,
            focus_score=(
                laplacian_variance(
                    image
                )
            ),
        )
        for z, image
        in zip(
            Z_PLANES,
            normalized_images,
        )
    ]

    best = max(
        measurements,
        key=lambda item: (
            item.focus_score
        ),
    )

    error_planes = abs(
        best.z - OPTIMAL_Z
    )

    inside_band = (
        GROUND_TRUTH_MIN_Z
        <= best.z
        <= GROUND_TRUTH_MAX_Z
    )

    result = FieldResult(
        field=(
            f"{field.well}_"
            f"s{field.site}"
        ),
        well=field.well,
        site=field.site,
        nuclei_count=(
            field.nuclei_count
        ),
        predicted_best_z=best.z,
        best_score=(
            best.focus_score
        ),
        exact_optimal_match=(
            best.z == OPTIMAL_Z
        ),
        inside_focus_band=(
            inside_band
        ),
        absolute_error_planes=(
            error_planes
        ),
        estimated_error_microns=(
            error_planes
            * MICRONS_PER_PLANE
        ),
        direction_accuracy_percent=(
            direction_accuracy(
                measurements
            )
        ),
    )

    return (
        result,
        measurements,
    )


def write_results_csv(
    path: Path,
    results: list[
        FieldResult
    ],
) -> None:
    with path.open(
        "w",
        newline="",
        encoding="utf-8",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=[
                "field",
                "well",
                "site",
                "nuclei_count",
                "predicted_best_z",
                "best_score",
                "exact_optimal_match",
                "inside_focus_band",
                "absolute_error_planes",
                "estimated_error_microns",
                "direction_accuracy_percent",
            ],
        )

        writer.writeheader()

        for result in results:
            writer.writerow(
                asdict(result)
            )


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--fields",
        type=int,
        default=12,
        help=(
            "Number of real microscopy "
            "fields to evaluate."
        ),
    )

    args = parser.parse_args()

    base_dir = Path(__file__).parent

    cache_dir = (
        base_dir
        / "data"
        / "multi-field"
    )

    output_dir = (
        base_dir
        / "outputs"
    )

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    counts_path = (
        download_counts_csv(
            cache_dir
        )
    )

    candidates = (
        load_candidate_fields(
            counts_path
        )
    )

    fields = select_spread_fields(
        candidates,
        args.fields,
    )

    print()
    print(
        "=== BBBC006 MULTI-FIELD "
        "FOCUS VALIDATION ==="
    )

    print(
        "Selected fields:",
        len(fields),
    )

    print(
        "Sampled planes:",
        Z_PLANES,
    )

    print(
        "Reference optimum:",
        OPTIMAL_Z,
    )

    print()

    for field in fields:
        print(
            f"{field.well} "
            f"site={field.site} "
            f"nuclei="
            f"{field.nuclei_count}"
        )

    print()

    download_selected_fields(
        fields,
        cache_dir,
    )

    results: list[
        FieldResult
    ] = []

    all_measurements: list[
        PlaneMeasurement
    ] = []

    print()
    print(
        "=== FIELD RESULTS ==="
    )

    for field in fields:
        (
            result,
            measurements,
        ) = evaluate_field(
            field,
            cache_dir,
        )

        results.append(
            result
        )

        all_measurements.extend(
            measurements
        )

        status = (
            "PASS"
            if result.inside_focus_band
            else "REVIEW"
        )

        exact = (
            "EXACT"
            if result.exact_optimal_match
            else ""
        )

        print(
            f"{result.field:<10}"
            f" bestZ="
            f"{result.predicted_best_z:02d}"
            f" error="
            f"{result.absolute_error_planes:>2}"
            f" plane(s)"
            f" nuclei="
            f"{result.nuclei_count:<4}"
            f" {status:<6}"
            f" {exact}"
        )

    total = len(
        results
    )

    inside_count = sum(
        1
        for result in results
        if result.inside_focus_band
    )

    exact_count = sum(
        1
        for result in results
        if result.exact_optimal_match
    )

    errors = [
        result.absolute_error_planes
        for result in results
    ]

    direction_scores = [
        result.direction_accuracy_percent
        for result in results
    ]

    pass_rate = (
        inside_count / total
    ) * 100.0

    exact_rate = (
        exact_count / total
    ) * 100.0

    mean_error = statistics.mean(
        errors
    )

    median_error = statistics.median(
        errors
    )

    max_error = max(
        errors
    )

    mean_direction = (
        statistics.mean(
            direction_scores
        )
    )

    print()
    print(
        "=== AGGREGATE VALIDATION ==="
    )

    print(
        "Fields evaluated:",
        total,
    )

    print(
        "Inside expert focus band:",
        f"{inside_count}/{total}",
        f"({pass_rate:.2f}%)",
    )

    print(
        "Exact z=16 matches:",
        f"{exact_count}/{total}",
        f"({exact_rate:.2f}%)",
    )

    print(
        "Mean absolute Z error:",
        f"{mean_error:.2f} planes",
    )

    print(
        "Median absolute Z error:",
        f"{median_error:.2f} planes",
    )

    print(
        "Maximum Z error:",
        f"{max_error} planes",
    )

    print(
        "Mean estimated Z error:",
        (
            f"{mean_error * MICRONS_PER_PLANE:.2f} µm"
        ),
    )

    print(
        "Mean curve direction accuracy:",
        f"{mean_direction:.2f}%",
    )

    status = (
        "PASS"
        if pass_rate >= 90.0
        else "REVIEW"
    )

    print(
        "Benchmark status:",
        status,
    )

    field_csv = (
        output_dir
        / "multi_field_results.csv"
    )

    write_results_csv(
        field_csv,
        results,
    )

    measurement_csv = (
        output_dir
        / "multi_field_measurements.csv"
    )

    with measurement_csv.open(
        "w",
        newline="",
        encoding="utf-8",
    ) as file:
        writer = csv.DictWriter(
            file,
            fieldnames=[
                "field",
                "z",
                "focus_score",
            ],
        )

        writer.writeheader()

        for measurement in (
            all_measurements
        ):
            writer.writerow(
                asdict(
                    measurement
                )
            )

    json_path = (
        output_dir
        / "multi_field_benchmark.json"
    )

    payload = {
        "benchmark": {
            "name": (
                "BBBC006 Multi-Field "
                "Focus Validation"
            ),
            "version": "0.3.0",
            "generatedAt": (
                datetime.now(
                    timezone.utc
                ).isoformat()
            ),
            "fieldsEvaluated": total,
            "sampledPlanes": Z_PLANES,
            "focusMetric": (
                "Laplacian Variance"
            ),
            "laplacianKernelSize": 1,
        },
        "groundTruth": {
            "laserOptimalZ": OPTIMAL_Z,
            "expertFocusBand": [
                GROUND_TRUTH_MIN_Z,
                GROUND_TRUTH_MAX_Z,
            ],
            "micronsPerPlane": (
                MICRONS_PER_PLANE
            ),
        },
        "summary": {
            "insideFocusBandCount": (
                inside_count
            ),
            "insideFocusBandRatePercent": (
                round(
                    pass_rate,
                    2,
                )
            ),
            "exactOptimalCount": (
                exact_count
            ),
            "exactOptimalRatePercent": (
                round(
                    exact_rate,
                    2,
                )
            ),
            "meanAbsoluteErrorPlanes": (
                round(
                    mean_error,
                    3,
                )
            ),
            "medianAbsoluteErrorPlanes": (
                round(
                    median_error,
                    3,
                )
            ),
            "maximumAbsoluteErrorPlanes": (
                max_error
            ),
            "meanEstimatedErrorMicrons": (
                round(
                    mean_error
                    * MICRONS_PER_PLANE,
                    3,
                )
            ),
            "meanCurveDirectionAccuracyPercent": (
                round(
                    mean_direction,
                    2,
                )
            ),
            "status": status,
        },
        "fields": [
            asdict(
                result
            )
            for result in results
        ],
        "limitations": [
            (
                "A subset of BBBC006 fields "
                "is evaluated."
            ),
            (
                "Only selected Z planes are "
                "sampled rather than every "
                "available plane."
            ),
            (
                "Fields with very low nuclei "
                "counts are excluded from this "
                "initial benchmark."
            ),
            (
                "Results measure engineering "
                "focus performance and do not "
                "constitute clinical validation."
            ),
        ],
    }

    json_path.write_text(
        json.dumps(
            payload,
            indent=2,
        ),
        encoding="utf-8",
    )

    print()
    print(
        "Results CSV:",
        field_csv,
    )

    print(
        "Measurements CSV:",
        measurement_csv,
    )

    print(
        "JSON:",
        json_path,
    )


if __name__ == "__main__":
    main()