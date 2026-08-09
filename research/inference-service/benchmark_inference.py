from __future__ import annotations

import argparse
import json
import mimetypes
import statistics
import time
import urllib.request
import uuid
from pathlib import Path
from typing import Any


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def default_image() -> Path:
    return (
        repo_root()
        / "research"
        / "malaria-validation"
        / "data"
        / "yolo-binary-full"
        / "images"
        / "val"
        / "005e60b6-77b8-458c-b57c-bfe0c7e7df78.png"
    )


def build_multipart(image_path: Path) -> tuple[bytes, str]:
    boundary = f"----microscope-{uuid.uuid4().hex}"
    mime_type = mimetypes.guess_type(image_path.name)[0] or "application/octet-stream"
    image_bytes = image_path.read_bytes()

    body = b"".join(
        [
            f"--{boundary}\r\n".encode(),
            (
                f'Content-Disposition: form-data; name="file"; '
                f'filename="{image_path.name}"\r\n'
            ).encode(),
            f"Content-Type: {mime_type}\r\n\r\n".encode(),
            image_bytes,
            b"\r\n",
            f"--{boundary}--\r\n".encode(),
        ]
    )

    return body, boundary


def infer(base_url: str, image_path: Path, timeout: float) -> tuple[float, dict[str, Any]]:
    body, boundary = build_multipart(image_path)
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/infer",
        data=body,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )

    started = time.perf_counter()
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    return elapsed_ms, payload


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, round((len(ordered) - 1) * fraction)))
    return ordered[index]


def main() -> int:
    parser = argparse.ArgumentParser(description="CPU inference latency benchmark.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--image", type=Path, default=default_image())
    parser.add_argument("--runs", type=int, default=10)
    parser.add_argument("--warmup", type=int, default=1)
    parser.add_argument("--timeout", type=float, default=120.0)
    args = parser.parse_args()

    if args.runs <= 0:
        raise SystemExit("--runs must be greater than zero")
    if args.warmup < 0:
        raise SystemExit("--warmup must be zero or greater")
    if not args.image.is_file():
        raise SystemExit(f"image not found: {args.image}")

    for _ in range(args.warmup):
        infer(args.base_url, args.image, args.timeout)

    durations: list[float] = []
    candidate_counts: list[int] = []

    for run_index in range(1, args.runs + 1):
        elapsed_ms, payload = infer(args.base_url, args.image, args.timeout)
        candidates = payload.get("candidates") or []
        durations.append(elapsed_ms)
        candidate_counts.append(len(candidates))
        print(
            f"run={run_index:02d} latency_ms={elapsed_ms:.2f} "
            f"candidates={len(candidates)}"
        )

    print("\nSUMMARY")
    print(f"runs={len(durations)}")
    print(f"min_ms={min(durations):.2f}")
    print(f"mean_ms={statistics.fmean(durations):.2f}")
    print(f"median_ms={statistics.median(durations):.2f}")
    print(f"p95_ms={percentile(durations, 0.95):.2f}")
    print(f"max_ms={max(durations):.2f}")
    print(f"candidate_counts={candidate_counts}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
