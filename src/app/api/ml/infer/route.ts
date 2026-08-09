import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getMlInferenceUrl,
} from "@/lib/server/ml-service";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


const MAX_UPLOAD_BYTES =
  20 * 1024 * 1024;


export async function POST(
  request: NextRequest,
) {
  try {
    const incomingFormData =
      await request.formData();

    const uploadedFile =
      incomingFormData.get(
        "file",
      );

    if (
      !(uploadedFile instanceof File)
    ) {
      return NextResponse.json(
        {
          error:
            "Microscopy image " +
            "is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      uploadedFile.size === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Uploaded microscopy " +
            "image is empty.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      uploadedFile.size >
      MAX_UPLOAD_BYTES
    ) {
      return NextResponse.json(
        {
          error:
            "Microscopy image " +
            "exceeds the 20 MB limit.",
        },
        {
          status: 413,
        },
      );
    }

    const outgoingFormData =
      new FormData();

    outgoingFormData.append(
      "file",
      uploadedFile,
      uploadedFile.name ||
        "microscope-frame.png",
    );

    const baseUrl =
      getMlInferenceUrl();

    const response =
      await fetch(
        `${baseUrl}/infer`,
        {
          method: "POST",
          body:
            outgoingFormData,

          signal:
            AbortSignal.timeout(
              30000,
            ),
        },
      );

    const body =
      await response.text();

    if (!response.ok) {
      console.error(
        "[ML INFER UPSTREAM]",
        response.status,
        body,
      );

      let detail =
        "ML inference failed.";

      try {
        const parsed =
          JSON.parse(
            body,
          );

        if (
          typeof parsed?.detail ===
          "string"
        ) {
          detail =
            parsed.detail;
        }
      } catch {
        // Keep generic message.
      }

      return NextResponse.json(
        {
          error:
            detail,

          upstream_status:
            response.status,
        },
        {
          status:
            response.status >=
              400 &&
            response.status <
              500
              ? response.status
              : 502,
        },
      );
    }

    return new NextResponse(
      body,
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/json",
        },
      },
    );
  } catch (error) {
    console.error(
      "[ML INFER]",
      error,
    );

    return NextResponse.json(
      {
        error:
          "ML inference service " +
          "is unavailable or timed out.",
      },
      {
        status: 503,
      },
    );
  }
}