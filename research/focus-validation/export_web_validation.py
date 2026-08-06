from __future__ import annotations

import json
from pathlib import Path


def main() -> None:
    project_root = (
        Path(__file__)
        .resolve()
        .parents[2]
    )

    research_dir = (
        project_root
        / "research"
        / "focus-validation"
    )

    outputs_dir = (
        research_dir
        / "outputs"
    )

    multi_field_path = (
        outputs_dir
        / "multi_field_benchmark.json"
    )

    zstack_path = (
        outputs_dir
        / "zstack_benchmark.json"
    )

    if not multi_field_path.exists():
        raise FileNotFoundError(
            "multi_field_benchmark.json "
            "was not found. Run "
            "validate_multi_field.py first."
        )

    multi_field = json.loads(
        multi_field_path.read_text(
            encoding="utf-8",
        )
    )

    sample_curve = []

    if zstack_path.exists():
        zstack = json.loads(
            zstack_path.read_text(
                encoding="utf-8",
            )
        )

        sample_curve = [
            {
                "z": item["z"],
                "focusScore": round(
                    item["focus_score"],
                    2,
                ),
            }
            for item
            in zstack.get(
                "measurements",
                [],
            )
        ]

    summary = multi_field[
        "summary"
    ]

    benchmark = multi_field[
        "benchmark"
    ]

    ground_truth = multi_field[
        "groundTruth"
    ]

    payload = {
        "schemaVersion": 1,
        "title": (
            "Real Microscopy "
            "Focus Validation"
        ),
        "dataset": "BBBC006",
        "datasetProvider": (
            "Broad Bioimage "
            "Benchmark Collection"
        ),
        "algorithm": benchmark[
            "focusMetric"
        ],
        "benchmarkVersion": benchmark[
            "version"
        ],
        "generatedAt": benchmark[
            "generatedAt"
        ],
        "status": summary[
            "status"
        ],
        "metrics": {
            "fieldsEvaluated": benchmark[
                "fieldsEvaluated"
            ],
            "focusBandSuccessPercent": (
                summary[
                    "insideFocusBandRatePercent"
                ]
            ),
            "exactOptimumPercent": (
                summary[
                    "exactOptimalRatePercent"
                ]
            ),
            "meanErrorMicrons": (
                summary[
                    "meanEstimatedErrorMicrons"
                ]
            ),
            "medianErrorPlanes": (
                summary[
                    "medianAbsoluteErrorPlanes"
                ]
            ),
            "maximumErrorPlanes": (
                summary[
                    "maximumAbsoluteErrorPlanes"
                ]
            ),
            "curveDirectionPercent": (
                summary[
                    "meanCurveDirectionAccuracyPercent"
                ]
            ),
        },
        "groundTruth": {
            "laserOptimalZ": (
                ground_truth[
                    "laserOptimalZ"
                ]
            ),
            "expertFocusBand": (
                ground_truth[
                    "expertFocusBand"
                ]
            ),
            "micronsPerPlane": (
                ground_truth[
                    "micronsPerPlane"
                ]
            ),
        },
        "sampling": {
            "zPlanes": benchmark[
                "sampledPlanes"
            ],
            "fieldCount": benchmark[
                "fieldsEvaluated"
            ],
        },
        "sampleCurve": sample_curve,
        "limitations": multi_field[
            "limitations"
        ],
        "disclaimer": (
            "Engineering research "
            "validation only. "
            "Not clinical validation."
        ),
    }

    destination_dir = (
        project_root
        / "public"
        / "research"
    )

    destination_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    destination = (
        destination_dir
        / "focus-validation.json"
    )

    destination.write_text(
        json.dumps(
            payload,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(
        "Exported web validation:"
    )

    print(
        destination
    )


if __name__ == "__main__":
    main()