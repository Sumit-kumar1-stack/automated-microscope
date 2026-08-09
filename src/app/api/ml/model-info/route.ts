import {
  NextResponse,
} from "next/server";

import {
  getMlInferenceUrl,
} from "@/lib/server/ml-service";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";


export async function GET() {
  try {
    const baseUrl =
      getMlInferenceUrl();

    const response =
      await fetch(
        `${baseUrl}/model-info`,
        {
          method: "GET",
          cache: "no-store",

          signal:
            AbortSignal.timeout(
              5000,
            ),
        },
      );

    const body =
      await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            "Unable to obtain " +
            "ML model information.",

          upstream_status:
            response.status,
        },
        {
          status: 502,
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
      "[ML MODEL INFO]",
      error,
    );

    return NextResponse.json(
      {
        error:
          "ML inference service " +
          "is unavailable.",
      },
      {
        status: 503,
      },
    );
  }
}