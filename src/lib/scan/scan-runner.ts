import {
  ScanStateMachine,
  type ScanMachineSnapshot,
} from "./scan-state-machine";

import type {
  ScanField,
  ScanPlan,
} from "./scan-types";

import type {
  XYStageController,
} from "./xy-stage";


export type ScanRunnerHooks = {
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

  onStateChange?:
    (
      snapshot:
        ScanMachineSnapshot,
    ) => void;

  onFieldError?:
    (
      field:
        ScanField,

      error:
        unknown,
    ) => void;
};


export type ScanRunnerConfig = {
  settleMs?:
    number;

  continueOnFieldError?:
    boolean;
};


const DEFAULT_SETTLE_MS =
  50;


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


function isAbortError(
  error:
    unknown,
): boolean {
  return (
    error instanceof Error &&
    error.name ===
      "AbortError"
  );
}


function wait(
  durationMs:
    number,

  signal:
    AbortSignal,
): Promise<void> {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      if (
        signal.aborted
      ) {
        reject(
          createAbortError(
            "Scan wait aborted.",
          ),
        );

        return;
      }


      const timeout =
        setTimeout(
          () => {
            signal.removeEventListener(
              "abort",
              onAbort,
            );

            resolve();
          },
          durationMs,
        );


      const onAbort =
        () => {
          clearTimeout(
            timeout,
          );

          reject(
            createAbortError(
              "Scan wait aborted.",
            ),
          );
        };


      signal.addEventListener(
        "abort",
        onAbort,
        {
          once:
            true,
        },
      );
    },
  );
}


export class ScanRunner {
  private readonly machine:
    ScanStateMachine;

  private readonly settleMs:
    number;

  private readonly continueOnFieldError:
    boolean;


  private abortController:
    AbortController | null =
      null;

  private running =
    false;

  private pauseRequested =
    false;


  constructor(
    private readonly plan:
      ScanPlan,

    private readonly stage:
      XYStageController,

    private readonly hooks:
      ScanRunnerHooks,

    config:
      ScanRunnerConfig =
      {},
  ) {
    this.machine =
      new ScanStateMachine(
        plan,
      );


    this.settleMs =
      config.settleMs ??
      DEFAULT_SETTLE_MS;


    this.continueOnFieldError =
      config.continueOnFieldError ??
      true;


    if (
      !Number.isFinite(
        this.settleMs,
      ) ||
      this.settleMs <
        0
    ) {
      throw new Error(
        "settleMs must be zero or greater.",
      );
    }
  }


  getSnapshot():
    ScanMachineSnapshot {
    return this.machine.getSnapshot();
  }


  isRunning():
    boolean {
    return this.running;
  }


  async run():
    Promise<ScanMachineSnapshot> {
    if (
      this.running
    ) {
      throw new Error(
        "Scan runner is already active.",
      );
    }


    if (
      !this.stage.isConnected()
    ) {
      throw new Error(
        "Cannot start scan: XY stage is not connected.",
      );
    }


    this.running =
      true;

    this.pauseRequested =
      false;

    this.abortController =
      new AbortController();


    const signal =
      this.abortController.signal;


    try {
      let snapshot =
        this.machine.start();

      this.publish(
        snapshot,
      );


      while (
        snapshot.runStatus ===
        "running" ||
        snapshot.runStatus ===
        "paused"
      ) {
        if (
          signal.aborted
        ) {
          snapshot =
            this.machine.abort(
              "Scan aborted.",
            );

          this.publish(
            snapshot,
          );

          break;
        }


       if (
  snapshot.runStatus ===
  "paused"
) {
  try {
    await wait(
      25,
      signal,
    );
  } catch (
    error
  ) {
    if (
      isAbortError(
        error,
      ) ||
      signal.aborted
    ) {
      snapshot =
        this.machine.abort(
          "Scan aborted while paused.",
        );

      this.publish(
        snapshot,
      );

      break;
    }

    throw error;
  }


  snapshot =
    this.machine.getSnapshot();

  continue;
}


        if (
          this.pauseRequested
        ) {
          snapshot =
            this.machine.pause();

          this.publish(
            snapshot,
          );

          continue;
        }


        const field =
          snapshot.currentField;


        if (
          !field
        ) {
          throw new Error(
            "Running scan has no active field.",
          );
        }


        try {
          if (
            snapshot.phase ===
            "moving"
          ) {
            await this.stage.moveTo(
              {
                xUm:
                  field.xUm,

                yUm:
                  field.yUm,
              },
              {
                signal,
              },
            );


            snapshot =
              this.machine
                .movementCompleted();

            this.publish(
              snapshot,
            );

            continue;
          }


          if (
            snapshot.phase ===
            "settling"
          ) {
            await wait(
              this.settleMs,
              signal,
            );


            snapshot =
              this.machine
                .settlingCompleted();

            this.publish(
              snapshot,
            );

            continue;
          }


          if (
            snapshot.phase ===
            "autofocusing"
          ) {
            await this.hooks.autofocus(
              field,
              signal,
            );


            snapshot =
              this.machine
                .autofocusCompleted();

            this.publish(
              snapshot,
            );

            continue;
          }


          if (
            snapshot.phase ===
            "capturing"
          ) {
            await this.hooks.capture(
              field,
              signal,
            );


            snapshot =
              this.machine
                .captureCompleted();

            this.publish(
              snapshot,
            );

            continue;
          }


          if (
            snapshot.phase ===
            "analyzing"
          ) {
            await this.hooks.analyze(
              field,
              signal,
            );


            snapshot =
              this.machine
                .analysisCompleted();

            this.publish(
              snapshot,
            );

            continue;
          }


          throw new Error(
            `Unhandled scan phase "${snapshot.phase}".`,
          );
        } catch (
          error
        ) {
          if (
            isAbortError(
              error,
            ) ||
            signal.aborted
          ) {
            snapshot =
              this.machine.abort(
                "Scan aborted.",
              );

            this.publish(
              snapshot,
            );

            break;
          }


          this.hooks.onFieldError?.(
            field,
            error,
          );


          snapshot =
            this.machine.failCurrentField(
              error instanceof Error
                ? error.message
                : "Unknown field execution error.",

              {
                continueScan:
                  this.continueOnFieldError,
              },
            );


          this.publish(
            snapshot,
          );


          if (
            snapshot.runStatus ===
            "failed"
          ) {
            break;
          }
        }
      }


      return this.machine.getSnapshot();
    } finally {
      this.running =
        false;

      this.pauseRequested =
        false;

      this.abortController =
        null;
    }
  }


  pause():
    void {
    if (
      !this.running
    ) {
      throw new Error(
        "Cannot pause: scan runner is not active.",
      );
    }


    this.pauseRequested =
      true;
  }


  resume():
    ScanMachineSnapshot {
    const snapshot =
      this.machine.getSnapshot();


    if (
      snapshot.runStatus !==
      "paused"
    ) {
      throw new Error(
        "Cannot resume: scan is not paused.",
      );
    }


    this.pauseRequested =
      false;


    const resumed =
      this.machine.resume();


    this.publish(
      resumed,
    );


    return resumed;
  }


  async abort():
    Promise<void> {
    this.pauseRequested =
      false;

    this.abortController
      ?.abort();


    if (
      this.stage.isMoving()
    ) {
      await this.stage.stop();
    }
  }


  private publish(
    snapshot:
      ScanMachineSnapshot,
  ): void {
    this.hooks.onStateChange?.(
      snapshot,
    );
  }
}