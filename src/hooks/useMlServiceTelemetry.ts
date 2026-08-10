"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";


export type MlModelInfo = {
  status?: string;

  research_only?: boolean;

  clinically_validated?: boolean;

  detector?: {
    name?: string;

    confidence_threshold?: number;

    image_size?: number;
  };

  classifier?: {
    name?: string;

    architecture?: string;

    image_size?: number;

    classes?: string[];
  };

  crop_context_scale?: number;

  validation?: {
    development?: {
      detector_precision?: number;

      detector_recall?: number;

      detector_f1?: number;

      end_to_end_macro_f1?: number;
    };

    external?: {
      benchmark?: string;

      images?: number;

      ground_truth_objects?: number;

      detector_precision?: number;

      detector_recall?: number;

      detector_f1?: number;

      end_to_end_macro_f1?: number;
    };
  };
};


function readStatus(
  payload: unknown,
): string {
  if (
    payload &&
    typeof payload === "object" &&
    "status" in payload
  ) {
    const status =
      (
        payload as {
          status?: unknown;
        }
      ).status;

    if (
      typeof status === "string"
    ) {
      return status;
    }
  }

  return "available";
}


export function useMlServiceTelemetry() {
  const [
    modelInfo,
    setModelInfo,
  ] =
    useState<MlModelInfo | null>(
      null,
    );

  const [
    serviceStatus,
    setServiceStatus,
  ] =
    useState(
      "unknown",
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    lastCheckedAt,
    setLastCheckedAt,
  ] =
    useState<number | null>(
      null,
    );


  const refresh =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        setError(
          null,
        );

        try {
          const [
            healthResponse,
            modelResponse,
          ] =
            await Promise.all(
              [
                fetch(
                  "/api/ml/health",
                  {
                    cache:
                      "no-store",
                  },
                ),

                fetch(
                  "/api/ml/model-info",
                  {
                    cache:
                      "no-store",
                  },
                ),
              ],
            );


          if (
            !healthResponse.ok
          ) {
            throw new Error(
              `ML health request failed with HTTP ${healthResponse.status}.`,
            );
          }


          if (
            !modelResponse.ok
          ) {
            throw new Error(
              `ML model-info request failed with HTTP ${modelResponse.status}.`,
            );
          }


          const health =
            await healthResponse.json();

          const model =
            (
              await modelResponse.json()
            ) as MlModelInfo;


          setServiceStatus(
            readStatus(
              health,
            ),
          );

          setModelInfo(
            model,
          );

          setLastCheckedAt(
            Date.now(),
          );
        } catch (
          telemetryError
        ) {
          setServiceStatus(
            "unavailable",
          );

          setError(
            telemetryError instanceof
              Error
              ? telemetryError.message
              : "Unable to read ML service telemetry.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );


useEffect(
  () => {
    const initialTimer =
      globalThis.setTimeout(
        () => {
          void refresh();
        },
        0,
      );

    const interval =
      globalThis.setInterval(
        () => {
          void refresh();
        },
        15_000,
      );

    return () => {
      globalThis.clearTimeout(
        initialTimer,
      );

      globalThis.clearInterval(
        interval,
      );
    };
  },
  [
    refresh,
  ],
);


  return {
    modelInfo,

    serviceStatus,

    loading,

    error,

    lastCheckedAt,

    refresh,
  };
}