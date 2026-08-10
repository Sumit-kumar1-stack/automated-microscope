"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ScanRunner,
  SimulatedXYStage,
  type ScanCoordinate,
  type ScanField,
  type ScanMachineSnapshot,
  type ScanPlan,
} from "@/lib/scan";


export type SlideScanExecutionCallbacks = {
  autofocus:
    (
      field:
        ScanField,

      signal:
        AbortSignal,
    ) => Promise<void>;

  capture:
    (
      field:
        ScanField,

      signal:
        AbortSignal,
    ) => Promise<void>;

  analyze:
    (
      field:
        ScanField,

      signal:
        AbortSignal,
    ) => Promise<void>;

  beforeAbort?:
    () =>
      void |
      Promise<void>;

  onLog?:
    (
      message:
        string,

      level?:
        "info" |
        "success" |
        "warning" |
        "error",
    ) => void;
};


type UseSlideScanExecutionOptions = {
  plan:
    ScanPlan | null;

  callbacks:
    SlideScanExecutionCallbacks;

  settleMs?:
    number;
};


function describeError(
  error:
    unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Unexpected slide-scan execution error.";
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


export function useSlideScanExecution({
  plan,
  callbacks,
  settleMs = 50,
}: UseSlideScanExecutionOptions) {
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


        const stage =
          createStage(
            plan,
          );

        stageRef.current =
          stage;


        try {
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
                  callbacks.autofocus,

                capture:
                  callbacks.capture,

                analyze:
                  callbacks.analyze,

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
                    callbacks.onLog?.(
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

          callbacks.onLog?.(
            `Slide scan started with ${plan.totalFields} planned fields using the simulated XY stage.`,
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


          if (
            finalSnapshot.runStatus ===
            "completed"
          ) {
            callbacks.onLog?.(
              `Slide scan completed: ${finalSnapshot.completedFields}/${finalSnapshot.totalFields} fields completed.`,
              "success",
            );
          } else if (
            finalSnapshot.runStatus ===
            "aborted"
          ) {
            callbacks.onLog?.(
              "Slide scan aborted.",
              "warning",
            );
          } else if (
            finalSnapshot.runStatus ===
            "failed"
          ) {
            callbacks.onLog?.(
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

          callbacks.onLog?.(
            message,
            "error",
          );
        } finally {
          runnerRef.current =
            null;

          if (
            stage.isConnected()
          ) {
            try {
              await stage.disconnect();
            } catch (
              disconnectError
            ) {
              callbacks.onLog?.(
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

          callbacks.onLog?.(
            "Slide scan pause requested. The runner will pause at the next safe phase boundary.",
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

          callbacks.onLog?.(
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

          callbacks.onLog?.(
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

          callbacks.onLog?.(
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
          await callbacks.beforeAbort?.();

          await runner.abort();

          callbacks.onLog?.(
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

          callbacks.onLog?.(
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

  const canPause =
    runStatus ===
      "running";

  const canResume =
    runStatus ===
      "paused";

  const canAbort =
    isActive;


  return {
    snapshot,

    stagePosition,

    starting,

    error,

    isActive,

    canPause,

    canResume,

    canAbort,

    start,

    pause,

    resume,

    abort,

    reset,
  };
}
