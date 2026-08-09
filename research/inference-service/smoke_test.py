from __future__ import annotations

import argparse
import json
import mimetypes
import sys
import urllib.error
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


def get_json(url: str, timeout: float = 10.0) -> dict[str, Any]:
    request = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def post_image(
    url: str,
    image_path: Path,
    timeout: float = 120.0,
) -> dict[str, Any]:
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

    request = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Content-Length": str(len(body)),
        },
    )

    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def fail(message: str) -> int:
    print(f"FAIL: {message}", file=sys.stderr)
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Regression smoke test for the frozen microscopy inference service."
    )
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:8000",
        help="Inference service base URL.",
    )
    parser.add_argument(
        "--image",
        type=Path,
        default=default_image(),
        help="Known-positive BBBC041 development image.",
    )
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    image_path: Path = args.image

    if not image_path.is_file():
        return fail(f"test image not found: {image_path}")

    try:
        health = get_json(f"{base_url}/health")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        return fail(f"health request failed: {error}")

    if health.get("status") != "healthy":
        return fail(f"unexpected health response: {health}")

    if health.get("models_loaded") is not True:
        return fail(f"models are not loaded: {health}")

    try:
        result = post_image(f"{base_url}/infer", image_path)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        return fail(f"inference request failed: {error}")

    image = result.get("image") or {}
    candidates = result.get("candidates") or []

    if image.get("width") != 1600 or image.get("height") != 1200:
        return fail(f"unexpected image dimensions: {image}")

    if len(candidates) != 2:
        return fail(f"expected 2 candidates, received {len(candidates)}")

    stages = {str(candidate.get("stage", "")).lower() for candidate in candidates}
    required_stages = {"ring", "trophozoite"}

    if not required_stages.issubset(stages):
        return fail(
            "expected ring and trophozoite candidates; "
            f"received stages={sorted(stages)}"
        )

    print("PASS: frozen inference regression smoke test")
    print(f"service: {base_url}")
    print(f"image: {image_path.name}")
    print("dimensions: 1600x1200")
    print("candidates: 2")
    print(f"stages: {', '.join(sorted(stages))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
