from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent

TRAINING_JSON = (
    BASE_DIR
    / "data"
    / "metadata"
    / "malaria"
    / "training.json"
)

TEST_JSON = (
    BASE_DIR
    / "data"
    / "metadata"
    / "malaria"
    / "test.json"
)


def load_json(path: Path) -> Any:
    if not path.exists():
        raise FileNotFoundError(
            f"Missing annotation file: {path}"
        )

    with path.open(
        "r",
        encoding="utf-8",
    ) as handle:
        return json.load(handle)


def describe_value(
    name: str,
    value: Any,
) -> None:
    print()
    print(f"=== {name} ===")
    print(
        f"Python type: "
        f"{type(value).__name__}"
    )

    if isinstance(value, list):
        print(
            f"Top-level records: "
            f"{len(value)}"
        )

        if value:
            first = value[0]

            print(
                "First record type:",
                type(first).__name__,
            )

            if isinstance(
                first,
                dict,
            ):
                print(
                    "First record keys:"
                )

                for key in first:
                    print(
                        f"  - {key}"
                    )

                print()
                print(
                    "First record preview:"
                )

                print(
                    json.dumps(
                        first,
                        indent=2,
                    )[:4000]
                )

    elif isinstance(value, dict):
        print(
            f"Top-level keys: "
            f"{len(value)}"
        )

        print(
            "Keys:"
        )

        for key in list(
            value.keys()
        )[:50]:
            print(
                f"  - {key}"
            )

        print()
        print(
            "Preview:"
        )

        print(
            json.dumps(
                value,
                indent=2,
            )[:4000]
        )


def inspect_possible_labels(
    data: Any,
) -> None:
    if not isinstance(
        data,
        list,
    ):
        return

    label_counter = Counter()

    for record in data:
        if not isinstance(
            record,
            dict,
        ):
            continue

        objects = (
            record.get("objects")
            or record.get("annotations")
            or record.get("labels")
            or []
        )

        if not isinstance(
            objects,
            list,
        ):
            continue

        for item in objects:
            if not isinstance(
                item,
                dict,
            ):
                continue

            label = (
                item.get("category")
                or item.get("label")
                or item.get("class")
                or item.get("name")
            )

            if isinstance(
                label,
                str,
            ):
                label_counter[
                    label
                ] += 1

    if label_counter:
        print()
        print(
            "=== POSSIBLE LABEL COUNTS ==="
        )

        for label, count in (
            label_counter.most_common()
        ):
            print(
                f"{label:<30} {count}"
            )


def main() -> None:
    training = load_json(
        TRAINING_JSON
    )

    test = load_json(
        TEST_JSON
    )

    describe_value(
        "TRAINING.JSON",
        training,
    )

    describe_value(
        "TEST.JSON",
        test,
    )

    inspect_possible_labels(
        training
    )


if __name__ == "__main__":
    main()