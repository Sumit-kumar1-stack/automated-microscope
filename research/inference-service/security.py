from __future__ import annotations


# ============================================================
# SUPPORTED IMAGE INPUTS
# ============================================================

SUPPORTED_CONTENT_TYPES = frozenset(
    {
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/tiff",
        "image/bmp",
    }
)


SUPPORTED_PIL_FORMATS = frozenset(
    {
        "PNG",
        "JPEG",
        "WEBP",
        "TIFF",
        "BMP",
    }
)


# ============================================================
# IMAGE SAFETY ENVELOPE
# ============================================================

MAX_IMAGE_WIDTH = 12_000

MAX_IMAGE_HEIGHT = 12_000

MAX_IMAGE_PIXELS = 40_000_000


# ============================================================
# SECURITY VALIDATION ERROR
# ============================================================

class UploadSecurityError(
    ValueError
):
    """
    Raised when an uploaded image violates
    the inference-service security envelope.
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 400,
    ) -> None:
        super().__init__(
            message
        )

        self.status_code = (
            status_code
        )


# ============================================================
# CONTENT-TYPE VALIDATION
# ============================================================

def validate_content_type(
    content_type: str | None,
) -> None:
    """
    Validate the media type declared by the
    HTTP multipart upload.

    This does not replace actual image decoding.
    """

    if content_type is None:
        raise UploadSecurityError(
            "Uploaded file must declare an image content type.",
            status_code=415,
        )


    normalized = (
        content_type
        .split(
            ";",
            1,
        )[0]
        .strip()
        .lower()
    )


    if (
        normalized
        not in
        SUPPORTED_CONTENT_TYPES
    ):
        raise UploadSecurityError(
            (
                "Unsupported image content type: "
                f"{normalized or 'empty'}."
            ),
            status_code=415,
        )


# ============================================================
# ACTUAL FORMAT VALIDATION
# ============================================================

def validate_image_format(
    image_format: str | None,
) -> None:
    """
    Validate the format detected by Pillow,
    rather than trusting the filename or
    multipart content-type alone.
    """

    if image_format is None:
        raise UploadSecurityError(
            "Unable to determine uploaded image format.",
            status_code=400,
        )


    normalized = (
        image_format
        .strip()
        .upper()
    )


    if (
        normalized
        not in
        SUPPORTED_PIL_FORMATS
    ):
        raise UploadSecurityError(
            (
                "Unsupported decoded image format: "
                f"{normalized}."
            ),
            status_code=415,
        )


# ============================================================
# DIMENSION VALIDATION
# ============================================================

def validate_image_dimensions(
    width: int,
    height: int,
) -> None:
    """
    Reject zero-sized, unreasonable or
    decompression-bomb-style image dimensions
    before allocating the full RGB image.
    """

    if (
        width <= 0
        or
        height <= 0
    ):
        raise UploadSecurityError(
            "Uploaded image has invalid dimensions.",
            status_code=400,
        )


    if (
        width > MAX_IMAGE_WIDTH
    ):
        raise UploadSecurityError(
            (
                "Uploaded image width exceeds "
                "the supported safety limit."
            ),
            status_code=413,
        )


    if (
        height > MAX_IMAGE_HEIGHT
    ):
        raise UploadSecurityError(
            (
                "Uploaded image height exceeds "
                "the supported safety limit."
            ),
            status_code=413,
        )


    pixel_count = (
        width
        *
        height
    )


    if (
        pixel_count
        >
        MAX_IMAGE_PIXELS
    ):
        raise UploadSecurityError(
            (
                "Uploaded image exceeds "
                "the supported pixel safety limit."
            ),
            status_code=413,
        )