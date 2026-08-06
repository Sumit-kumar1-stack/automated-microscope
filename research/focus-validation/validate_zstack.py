from __future__ import annotations

import csv
import json
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

# We deliberately sample the stack instead of
# downloading every plane.
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

# This field has visible nuclei according to
# the BBBC006 example metadata.
FIELD_TOKEN = "_a02_s1_w1"


@dataclass
class ZMeasurement:
    z: int
    focus_score: float
    member_name: str
    local_path: str


def archive_url(
    z: int,
) -> str:
    return (
        f"{BASE_URL}/"
        f"BBBC006_v1_images_z_{z:02d}.zip"
    )


def find_matching_member(
    remote_zip: RemoteZip,
) -> str:
    token = FIELD_TOKEN.lower()

    matches = [
        item.filename
        for item
        in remote_zip.infolist()
        if token
        in item.filename.lower()
        and item.filename.lower().endswith(
            (".tif", ".tiff")
        )
    ]

    if not matches:
        raise FileNotFoundError(
            "Could not locate microscope field "
            f"matching {FIELD_TOKEN}"
        )

    return matches[0]


def download_plane(
    z: int,
    cache_dir: Path,
) -> tuple[Path, str]:
    cache_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    cached_path = (
        cache_dir
        / f"bbbc006_a02_s1_w1_z{z:02d}.tif"
    )

    metadata_path = (
        cache_dir
        / f"bbbc006_a02_s1_w1_z{z:02d}.json"
    )

    if (
        cached_path.exists()
        and cached_path.stat().st_size > 0
        and metadata_path.exists()
    ):
        metadata = json.loads(
            metadata_path.read_text(
                encoding="utf-8",
            )
        )

        return (
            cached_path,
            metadata["memberName"],
        )

    url = archive_url(z)

    print(
        f"Accessing z={z:02d} "
        f"remote archive..."
    )

    try:
        with RemoteZip(
            url,
            timeout=90,
        ) as remote_zip:
            member_name = (
                find_matching_member(
                    remote_zip,
                )
            )

            print(
                "  extracting:",
                member_name,
            )

            with remote_zip.open(
                member_name,
            ) as source:
                payload = source.read()

    except Exception as error:
        raise RuntimeError(
            f"Unable to access z={z:02d} "
            "through the remote ZIP. "
            "The server may not support the "
            "required HTTP Range request, or "
            "the connection may have failed."
        ) from error

    if not payload:
        raise RuntimeError(
            f"Downloaded z={z:02d} "
            "image is empty."
        )

    cached_path.write_bytes(
        payload,
    )

    metadata_path.write_text(
        json.dumps(
            {
                "z": z,
                "archiveUrl": url,
                "memberName": member_name,
                "bytes": len(payload),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    return (
        cached_path,
        member_name,
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


def normalize_stack(
    images: list[np.ndarray],
) -> list[np.ndarray]:
    """
    Use one shared intensity window for the
    complete sampled stack.

    This avoids independently stretching every
    Z plane and accidentally changing the focus
    comparison.
    """

    combined = np.concatenate(
        [
            image.reshape(-1).astype(
                np.float32,
            )
            for image in images
        ]
    )

    lower = float(
        np.percentile(
            combined,
            0.5,
        )
    )

    upper = float(
        np.percentile(
            combined,
            99.5,
        )
    )

    if upper <= lower:
        raise RuntimeError(
            "Invalid intensity range."
        )

    normalized_images = []

    for image in images:
        image_float = (
            image.astype(
                np.float32,
            )
        )

        normalized = (
            image_float - lower
        ) / (
            upper - lower
        )

        normalized = np.clip(
            normalized,
            0.0,
            1.0,
        )

        normalized_images.append(
            (
                normalized
                * 255.0
            ).astype(
                np.uint8,
            )
        )

    return normalized_images


def laplacian_variance(
    image: np.ndarray,
) -> float:
    # ksize=1 matches the discrete 4-neighbour
    # Laplacian used by the TypeScript app.
    laplacian = cv2.Laplacian(
        image,
        cv2.CV_64F,
        ksize=1,
    )

    return float(
        laplacian.var()
    )


def curve_direction_accuracy(
    measurements: list[
        ZMeasurement
    ],
) -> float:
    """
    A good autofocus curve should generally rise
    toward the optimum and fall after it.

    We do not demand perfect monotonicity because
    real biological images contain texture and
    noise.
    """

    ordered = sorted(
        measurements,
        key=lambda item: item.z,
    )

    correct = 0
    comparisons = 0

    for (
        current,
        following,
    ) in zip(
        ordered,
        ordered[1:],
    ):
        comparisons += 1

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

    if comparisons == 0:
        return 0.0

    return (
        correct / comparisons
    ) * 100.0


def write_csv(
    path: Path,
    measurements: list[
        ZMeasurement
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
                "z",
                "focus_score",
                "member_name",
                "local_path",
            ],
        )

        writer.writeheader()

        for measurement in measurements:
            writer.writerow(
                asdict(
                    measurement,
                )
            )


def main() -> None:
    base_dir = Path(__file__).parent

    cache_dir = (
        base_dir
        / "data"
        / "zstack-sample"
    )

    output_dir = (
        base_dir
        / "outputs"
    )

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    print(
        "=== BBBC006 Z-STACK VALIDATION ==="
    )

    print(
        "Field:",
        FIELD_TOKEN,
    )

    print(
        "Selected Z planes:",
        Z_PLANES,
    )

    print()

    raw_images: list[
        np.ndarray
    ] = []

    downloaded: list[
        tuple[int, Path, str]
    ] = []

    for z in Z_PLANES:
        path, member_name = (
            download_plane(
                z,
                cache_dir,
            )
        )

        raw_images.append(
            load_image(
                path,
            )
        )

        downloaded.append(
            (
                z,
                path,
                member_name,
            )
        )

    print()
    print(
        "Normalizing sampled Z-stack..."
    )

    images = normalize_stack(
        raw_images,
    )

    measurements: list[
        ZMeasurement
    ] = []

    for (
        image,
        metadata,
    ) in zip(
        images,
        downloaded,
    ):
        z, path, member_name = (
            metadata
        )

        measurement = ZMeasurement(
            z=z,
            focus_score=(
                laplacian_variance(
                    image,
                )
            ),
            member_name=member_name,
            local_path=str(path),
        )

        measurements.append(
            measurement
        )

    measurements.sort(
        key=lambda item: item.z,
    )

    best = max(
        measurements,
        key=lambda item: (
            item.focus_score
        ),
    )

    error_planes = abs(
        best.z - OPTIMAL_Z
    )

    error_microns = (
        error_planes
        * MICRONS_PER_PLANE
    )

    inside_focus_band = (
        GROUND_TRUTH_MIN_Z
        <= best.z
        <= GROUND_TRUTH_MAX_Z
    )

    exact_optimal_match = (
        best.z == OPTIMAL_Z
    )

    direction_accuracy = (
        curve_direction_accuracy(
            measurements,
        )
    )

    print()
    print(
        "=== FOCUS CURVE ==="
    )

    for measurement in measurements:
        marker = (
            " <== predicted best"
            if measurement.z == best.z
            else ""
        )

        laser = (
            " [laser optimum]"
            if measurement.z == OPTIMAL_Z
            else ""
        )

        print(
            f"z={measurement.z:02d}"
            f"  score="
            f"{measurement.focus_score:10.2f}"
            f"{laser}"
            f"{marker}"
        )

    print()
    print(
        "=== VALIDATION SUMMARY ==="
    )

    print(
        "Predicted best Z:",
        best.z,
    )

    print(
        "Laser autofocus optimum:",
        OPTIMAL_Z,
    )

    print(
        "Absolute error:",
        f"{error_planes} plane(s)",
    )

    print(
        "Estimated Z error:",
        f"{error_microns:.1f} µm",
    )

    print(
        "Inside expert focus band:",
        (
            "YES"
            if inside_focus_band
            else "NO"
        ),
    )

    print(
        "Exact optimal-plane match:",
        (
            "YES"
            if exact_optimal_match
            else "NO"
        ),
    )

    print(
        "Focus-curve direction accuracy:",
        f"{direction_accuracy:.2f}%",
    )

    status = (
        "PASS"
        if inside_focus_band
        else "REVIEW"
    )

    print(
        "Validation status:",
        status,
    )

    csv_path = (
        output_dir
        / "zstack_measurements.csv"
    )

    json_path = (
        output_dir
        / "zstack_benchmark.json"
    )

    write_csv(
        csv_path,
        measurements,
    )

    payload = {
        "benchmark": {
            "name": (
                "BBBC006 Sampled "
                "Z-Stack Validation"
            ),
            "version": "0.2.0",
            "generatedAt": (
                datetime.now(
                    timezone.utc
                ).isoformat()
            ),
            "field": FIELD_TOKEN,
            "selectedPlanes": Z_PLANES,
            "algorithm": (
                "Laplacian Variance"
            ),
            "laplacianKernelSize": 1,
        },
        "groundTruth": {
            "laserAutofocusOptimalZ": (
                OPTIMAL_Z
            ),
            "expertInFocusRange": [
                GROUND_TRUTH_MIN_Z,
                GROUND_TRUTH_MAX_Z,
            ],
            "micronsPerPlane": (
                MICRONS_PER_PLANE
            ),
        },
        "summary": {
            "predictedBestZ": best.z,
            "predictedBestScore": (
                best.focus_score
            ),
            "exactOptimalPlaneMatch": (
                exact_optimal_match
            ),
            "insideExpertFocusBand": (
                inside_focus_band
            ),
            "absoluteErrorPlanes": (
                error_planes
            ),
            "estimatedErrorMicrons": (
                error_microns
            ),
            "curveDirectionAccuracyPercent": (
                round(
                    direction_accuracy,
                    2,
                )
            ),
            "status": status,
        },
        "measurements": [
            asdict(
                measurement
            )
            for measurement
            in measurements
        ],
        "limitations": [
            (
                "This benchmark samples "
                "selected Z planes rather "
                "than every available plane."
            ),
            (
                "Only one microscope field "
                "is evaluated in this step."
            ),
            (
                "Clinical validity is not "
                "assessed."
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
        "CSV:",
        csv_path,
    )

    print(
        "JSON:",
        json_path,
    )


if __name__ == "__main__":
    main()