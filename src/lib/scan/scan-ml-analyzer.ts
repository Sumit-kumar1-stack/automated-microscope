import type {
  MlInferenceResult,
} from "../ml-inference";

import type {
  ScanAcquiredFrame,
} from "./scan-acquisition";


export type ScanMlFieldResult = {
  fieldId: string;

  filename: string;

  analyzedAtMs: number;

  durationMs: number;

  inference:
    MlInferenceResult;
};


export interface ScanMlAnalyzer {
  analyze(
    frame:
      ScanAcquiredFrame,

    signal:
      AbortSignal,
  ): Promise<ScanMlFieldResult>;
}


export type HttpScanMlAnalyzerConfig = {
  /**
   * Direct FastAPI service URL.
   *
   * Example:
   * http://127.0.0.1:8000
   */
  baseUrl: string;

  timeoutMs?: number;
};


const DEFAULT_TIMEOUT_MS =
  30_000;


function createAbortError(
  message: string,
): Error {
  if (
    typeof DOMException !==
    "undefined"
  ) {
    return new DOMException(
      message,
      "AbortError",
    );
  }

  const error =
    new Error(
      message,
    );

  error.name =
    "AbortError";

  return error;
}


function normalizeBaseUrl(
  value: string,
): string {
  return value.replace(
    /\/+$/,
    "",
  );
}


export class HttpScanMlAnalyzer
implements ScanMlAnalyzer {
  private readonly baseUrl:
    string;

  private readonly timeoutMs:
    number;


  constructor(
    config:
      HttpScanMlAnalyzerConfig,
  ) {
    if (
      !config.baseUrl.trim()
    ) {
      throw new Error(
        "ML inference baseUrl cannot be empty.",
      );
    }


    this.baseUrl =
      normalizeBaseUrl(
        config.baseUrl,
      );


    this.timeoutMs =
      config.timeoutMs ??
      DEFAULT_TIMEOUT_MS;


    if (
      !Number.isFinite(
        this.timeoutMs,
      ) ||
      this.timeoutMs <=
        0
    ) {
      throw new Error(
        "ML inference timeoutMs must be greater than zero.",
      );
    }
  }


  async analyze(
    frame:
      ScanAcquiredFrame,

    signal:
      AbortSignal,
  ): Promise<ScanMlFieldResult> {
    if (
      signal.aborted
    ) {
      throw createAbortError(
        "ML field analysis aborted before start.",
      );
    }


    const startedAt =
      Date.now();


    const timeoutController =
      new AbortController();


    const timer =
      globalThis.setTimeout(
        () => {
          timeoutController.abort();
        },
        this.timeoutMs,
      );


    const abortFromParent =
      () => {
        timeoutController.abort();
      };


    signal.addEventListener(
      "abort",
      abortFromParent,
      {
        once: true,
      },
    );


    try {
      const form =
        new FormData();


      form.append(
        "file",
        frame.blob,
        frame.filename,
      );


      const response =
        await fetch(
          `${this.baseUrl}/infer`,
          {
            method:
              "POST",

            body:
              form,

            signal:
              timeoutController.signal,
          },
        );


      if (
        !response.ok
      ) {
        let details =
          "";

        try {
          details =
            await response.text();
        } catch {
          // Ignore body parsing failure.
        }


        throw new Error(
          [
            `ML inference failed with HTTP ${response.status}.`,
            details,
          ]
            .filter(
              Boolean,
            )
            .join(
              " ",
            ),
        );
      }


      const inference =
        (
          await response.json()
        ) as MlInferenceResult;


      validateInferenceResult(
        inference,
      );


      return {
        fieldId:
          frame.fieldId,

        filename:
          frame.filename,

        analyzedAtMs:
          Date.now(),

        durationMs:
          Date.now() -
          startedAt,

        inference,
      };
    } catch (
      error
    ) {
      if (
        signal.aborted
      ) {
        throw createAbortError(
          "ML field analysis aborted.",
        );
      }


      if (
        timeoutController
          .signal
          .aborted
      ) {
        throw new Error(
          `ML field analysis exceeded ${this.timeoutMs} ms timeout.`,
        );
      }


      throw error;
    } finally {
      globalThis.clearTimeout(
        timer,
      );


      signal.removeEventListener(
        "abort",
        abortFromParent,
      );
    }
  }
}


function validateInferenceResult(
  result:
    MlInferenceResult,
): void {
  if (
    !result ||
    typeof result !==
      "object"
  ) {
    throw new Error(
      "ML service returned an invalid result.",
    );
  }


  if (
    !Array.isArray(
      result.candidates,
    )
  ) {
    throw new Error(
      "ML result does not contain a candidate array.",
    );
  }


  if (
    !result.image ||
    !Number.isFinite(
      result.image.width,
    ) ||
    !Number.isFinite(
      result.image.height,
    )
  ) {
    throw new Error(
      "ML result contains invalid image dimensions.",
    );
  }
}