"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  AutofocusSample,
} from "@/lib/autofocus-engine";

import {
  runMlInference,
  type MlInferenceResult,
} from "@/lib/ml-inference";

import {
  buildScanSlideSummary,
  CallbackScanFrameSource,
  ScanAcquisitionManager,
  ScanAutofocusAdapter,
  ScanMlResultStore,
  ScanRunner,
  SimulatedXYStage,
  type ScanAcquiredFrame,
  type ScanAutofocusResult,
  type ScanCoordinate,
  type ScanField,
  type ScanMachineSnapshot,
  type ScanPlan,
  type ScanSlideSummary,
} from "@/lib/scan";


export type SlideScanAutofocusConfig = {
  minZ:
    number;

  maxZ:
    number;

  coarseStartZ:
    number;

  coarseEndZ:
    number;

  coarseStepZ:
    number;

  fineRadiusZ:
    number;

  settleMs:
    number;

  initialZ:
    number;
};


export type SlideScanWorkflowCallbacks = {
  moveToZ:
    (
      z:
        number,

      signal:
        AbortSignal,
    ) => Promise<void>;

  measureFocus:
    (
      z:
        number,

      field:
        ScanField,
    ) => Promise<number>;

  captureFrame:
    (
      field:
        ScanField,

      signal:
        AbortSignal,
    ) => Promise<ScanAcquiredFrame>;

  beforeStart?:
    () =>
      void |
      Promise<void>;

  beforeAbort?:
    () =>
      void |
      Promise<void>;

  onAutofocusSample?:
    (
      field:
        ScanField,

      sample:
        AutofocusSample,
    ) => void;

  onAutofocusResult?:
    (
      result:
        ScanAutofocusResult,
    ) => void;

  onMlResult?:
    (
      field:
        ScanField,

      result:
        MlInferenceResult,
    ) => void;

  onLog?:
    (
      message:
        string,

      level?:
        | "info"
        | "success"
        | "warning"
        | "error",
    ) => void;
};


type UseSlideScanWorkflowOptions = {
  plan:
    ScanPlan | null;

  autofocus:
    SlideScanAutofocusConfig;

  callbacks:
    SlideScanWorkflowCallbacks;

  settleMs?:
    number;
};


function describeError(
  error:
    unknown,
): string {
  return error instanceof
    Error
    ? error.message
    : "Unexpected slide-scan workflow error.";
}


function createAbortError(
  message:
    string,
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


function createStage(
  plan:
    ScanPlan,
): SimulatedXYStage {
  const firstField =
    plan.fields[0];


  if (
    !firstField
  ) {
    throw new Error(
      "Cannot create an XY stage for an empty scan plan.",
    );
  }


  return new SimulatedXYStage(
    {
      bounds: {
        minXUm:
          plan.extent.minXUm,

        maxXUm:
          plan.extent.maxXUm,

        minYUm:
          plan.extent.minYUm,

        maxYUm:
          plan.extent.maxYUm,
      },

      home: {
        xUm:
          firstField.xUm,

        yUm:
          firstField.yUm,
      },

      speedUmPerSecond:
        5000,

      minimumMoveDurationMs:
        20,
    },
  );
}


export function useSlideScanWorkflow({
  plan,
  autofocus,
  callbacks,
  settleMs = 50,
}: UseSlideScanWorkflowOptions) {
  const runnerRef =
    useRef<ScanRunner | null>(
      null,
    );

  const stageRef =
    useRef<SimulatedXYStage | null>(
      null,
    );


  const [
    snapshot,
    setSnapshot,
  ] =
    useState<ScanMachineSnapshot | null>(
      null,
    );


  const [
    stagePosition,
    setStagePosition,
  ] =
    useState<ScanCoordinate | null>(
      null,
    );


  const [
    summary,
    setSummary,
  ] =
    useState<ScanSlideSummary | null>(
      null,
    );


  const [
    lastAutofocus,
    setLastAutofocus,
  ] =
    useState<ScanAutofocusResult | null>(
      null,
    );


  const [
    capturedFieldCount,
    setCapturedFieldCount,
  ] =
    useState(
      0,
    );


  const [
    analyzedFieldCount,
    setAnalyzedFieldCount,
  ] =
    useState(
      0,
    );


  const [
    candidateCount,
    setCandidateCount,
  ] =
    useState(
      0,
    );


  const [
    starting,
    setStarting,
  ] =
    useState(
      false,
    );


  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );


  const publishStagePosition =
    useCallback(
      (
        stage:
          SimulatedXYStage,
      ) => {
        setStagePosition(
          stage.getPosition(),
        );
      },
      [],
    );


  const start =
    useCallback(
      async () => {
        if (
          starting ||
          runnerRef.current
            ?.isRunning()
        ) {
          return;
        }


        if (
          !plan
        ) {
          setError(
            "A valid scan plan is required before execution.",
          );

          return;
        }


        setStarting(
          true,
        );

        setError(
          null,
        );

        setSnapshot(
          null,
        );

        setSummary(
          null,
        );

        setLastAutofocus(
          null,
        );

        setCapturedFieldCount(
          0,
        );

        setAnalyzedFieldCount(
          0,
        );

        setCandidateCount(
          0,
        );


        try {
          await callbacks
            .beforeStart?.();


          const stage =
            createStage(
              plan,
            );

          stageRef.current =
            stage;


          const frameSource =
            new CallbackScanFrameSource(
              "simulation",
              callbacks.captureFrame,
            );


          const acquisition =
            new ScanAcquisitionManager(
              frameSource,
            );


          const mlResults =
            new ScanMlResultStore();


          const autofocusAdapter =
            new ScanAutofocusAdapter(
              {
                ...autofocus,

                moveToZ:
                  callbacks.moveToZ,

                measureFocus:
                  callbacks.measureFocus,

                onSample:
                  (
                    field,
                    sample,
                  ) => {
                    callbacks
                      .onAutofocusSample?.(
                        field,
                        sample,
                      );
                  },
              },
            );


          await stage.connect();


          publishStagePosition(
            stage,
          );


          const runner =
            new ScanRunner(
              plan,
              stage,
              {
                autofocus:
                  async (
                    field,
                    signal,
                  ) => {
                    const result =
                      await autofocusAdapter
                        .autofocusField(
                          field,
                          signal,
                        );


                    setLastAutofocus(
                      result,
                    );


                    callbacks
                      .onAutofocusResult?.(
                        result,
                      );
                  },


                capture:
                  async (
                    field,
                    signal,
                  ) => {
                    await acquisition
                      .captureField(
                        field,
                        signal,
                      );


                    setCapturedFieldCount(
                      acquisition
                        .getCapturedFieldCount(),
                    );
                  },


                analyze:
                  async (
                    field,
                    signal,
                  ) => {
                    if (
                      signal.aborted
                    ) {
                      throw createAbortError(
                        "Scan ML analysis aborted before start.",
                      );
                    }


                    const frame =
                      acquisition.requireFrame(
                        field.id,
                      );


                    const startedAt =
                      Date.now();


                    const inference =
                      await runMlInference(
                        frame.blob,
                        frame.filename,
                      );


                    if (
                      signal.aborted
                    ) {
                      throw createAbortError(
                        "Scan ML analysis aborted.",
                      );
                    }


                    const fieldResult = {
                      fieldId:
                        field.id,

                      filename:
                        frame.filename,

                      analyzedAtMs:
                        Date.now(),

                      durationMs:
                        Date.now() -
                        startedAt,

                      inference,
                    };


                    mlResults.set(
                      fieldResult,
                    );


                    const nextSummary =
                      buildScanSlideSummary(
                        plan,
                        mlResults.list(),
                      );


                    setSummary(
                      nextSummary,
                    );


                    setAnalyzedFieldCount(
                      mlResults
                        .getFieldCount(),
                    );


                    setCandidateCount(
                      mlResults
                        .getCandidateCount(),
                    );


                    callbacks
                      .onMlResult?.(
                        field,
                        inference,
                      );
                  },


                onStateChange:
                  (
                    nextSnapshot,
                  ) => {
                    setSnapshot(
                      nextSnapshot,
                    );


                    publishStagePosition(
                      stage,
                    );
                  },


                onFieldError:
                  (
                    field,
                    fieldError,
                  ) => {
                    callbacks
                      .onLog?.(
                        `Scan field ${field.id} failed: ${describeError(
                          fieldError,
                        )}`,
                        "error",
                      );
                  },
              },
              {
                settleMs,

                continueOnFieldError:
                  true,
              },
            );


          runnerRef.current =
            runner;


          callbacks
            .onLog?.(
              `Automated slide-scan research workflow started with ${plan.totalFields} fields. XY movement is simulated.`,
              "info",
            );


          const finalSnapshot =
            await runner.run();


          setSnapshot(
            finalSnapshot,
          );


          publishStagePosition(
            stage,
          );


          setSummary(
            buildScanSlideSummary(
              plan,
              mlResults.list(),
            ),
          );


          if (
            finalSnapshot.runStatus ===
            "completed"
          ) {
            callbacks
              .onLog?.(
                `Slide scan completed: ${finalSnapshot.completedFields}/${finalSnapshot.totalFields} fields completed, ${mlResults.getCandidateCount()} research candidates aggregated.`,
                "success",
              );
          } else if (
            finalSnapshot.runStatus ===
            "aborted"
          ) {
            callbacks
              .onLog?.(
                "Slide scan aborted by the operator.",
                "warning",
              );
          } else if (
            finalSnapshot.runStatus ===
            "failed"
          ) {
            callbacks
              .onLog?.(
                finalSnapshot.lastError ??
                  "Slide scan failed.",
                "error",
              );
          }
        } catch (
          executionError
        ) {
          const message =
            describeError(
              executionError,
            );


          setError(
            message,
          );


          callbacks
            .onLog?.(
              message,
              "error",
            );
        } finally {
          runnerRef.current =
            null;


          const stage =
            stageRef.current;


          if (
            stage?.isConnected()
          ) {
            try {
              await stage.disconnect();
            } catch (
              disconnectError
            ) {
              callbacks
                .onLog?.(
                  `XY stage cleanup warning: ${describeError(
                    disconnectError,
                  )}`,
                  "warning",
                );
            }
          }


          stageRef.current =
            null;


          setStarting(
            false,
          );
        }
      },
      [
        autofocus,
        callbacks,
        plan,
        publishStagePosition,
        settleMs,
        starting,
      ],
    );


  const pause =
    useCallback(
      () => {
        const runner =
          runnerRef.current;


        if (
          !runner ||
          !runner.isRunning()
        ) {
          return;
        }


        try {
          runner.pause();


          callbacks
            .onLog?.(
              "Slide scan pause requested. Pause occurs at the next safe runner boundary.",
              "info",
            );
        } catch (
          pauseError
        ) {
          const message =
            describeError(
              pauseError,
            );


          setError(
            message,
          );


          callbacks
            .onLog?.(
              message,
              "error",
            );
        }
      },
      [
        callbacks,
      ],
    );


  const resume =
    useCallback(
      () => {
        const runner =
          runnerRef.current;


        if (
          !runner
        ) {
          return;
        }


        try {
          const resumed =
            runner.resume();


          setSnapshot(
            resumed,
          );


          callbacks
            .onLog?.(
              "Slide scan resumed.",
              "info",
            );
        } catch (
          resumeError
        ) {
          const message =
            describeError(
              resumeError,
            );


          setError(
            message,
          );


          callbacks
            .onLog?.(
              message,
              "error",
            );
        }
      },
      [
        callbacks,
      ],
    );


  const abort =
    useCallback(
      async () => {
        const runner =
          runnerRef.current;


        if (
          !runner
        ) {
          return;
        }


        try {
          await callbacks
            .beforeAbort?.();


          await runner.abort();


          callbacks
            .onLog?.(
              "Slide scan abort requested.",
              "warning",
            );
        } catch (
          abortError
        ) {
          const message =
            describeError(
              abortError,
            );


          setError(
            message,
          );


          callbacks
            .onLog?.(
              message,
              "error",
            );
        }
      },
      [
        callbacks,
      ],
    );


  const reset =
    useCallback(
      () => {
        if (
          runnerRef.current
            ?.isRunning()
        ) {
          return;
        }


        setSnapshot(
          null,
        );

        setStagePosition(
          null,
        );

        setSummary(
          null,
        );

        setLastAutofocus(
          null,
        );

        setCapturedFieldCount(
          0,
        );

        setAnalyzedFieldCount(
          0,
        );

        setCandidateCount(
          0,
        );

        setError(
          null,
        );
      },
      [],
    );


  useEffect(
    () => {
      return () => {
        const runner =
          runnerRef.current;

        const stage =
          stageRef.current;


        if (
          runner
        ) {
          void runner.abort();
        }


        if (
          stage?.isConnected()
        ) {
          void stage.disconnect();
        }
      };
    },
    [],
  );


  const runStatus =
    snapshot?.runStatus ??
      "idle";


  const isActive =
    starting ||
    runStatus ===
      "running" ||
    runStatus ===
      "paused";


  return {
    snapshot,

    stagePosition,

    summary,

    lastAutofocus,

    capturedFieldCount,

    analyzedFieldCount,

    candidateCount,

    starting,

    error,

    isActive,

    canPause:
      runStatus ===
      "running",

    canResume:
      runStatus ===
      "paused",

    canAbort:
      isActive,

    start,

    pause,

    resume,

    abort,

    reset,
  };
}