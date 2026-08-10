"use client";

import {
  type ScanMachineSnapshot,
} from "@/lib/scan";


type ScanExecutionControlsProps = {
  snapshot:
    ScanMachineSnapshot | null;

  starting:
    boolean;

  canStart:
    boolean;

  canPause:
    boolean;

  canResume:
    boolean;

  canAbort:
    boolean;

  modeMessage?:
    string | null;

  onStart:
    () =>
      void |
      Promise<void>;

  onPause:
    () => void;

  onResume:
    () => void;

  onAbort:
    () =>
      void |
      Promise<void>;

  onReset:
    () => void;
};


export function ScanExecutionControls({
  snapshot,
  starting,
  canStart,
  canPause,
  canResume,
  canAbort,
  modeMessage = null,
  onStart,
  onPause,
  onResume,
  onAbort,
  onReset,
}: ScanExecutionControlsProps) {
  const finalStatus =
    snapshot?.runStatus ??
    "idle";

  const canReset =
    !canAbort &&
    snapshot !==
      null;


  return (
    <div className="card controlCard">
      <div className="cardHeader">
        <div>
          SLIDE SCAN EXECUTION
        </div>

        <span>
          SIMULATED XY + REAL PIPELINE
        </span>
      </div>

      <div className="resultRow">
        <span>
          Runner
        </span>

        <strong>
          {starting
            ? "STARTING"
            : finalStatus.toUpperCase()}
        </strong>
      </div>

      <div className="buttonGrid">
        <button
          className="primary"
          disabled={
            !canStart
          }
          onClick={() =>
            void onStart()
          }
        >
          {starting
            ? "STARTING..."
            : "START SCAN"}
        </button>

        <button
          disabled={
            !canPause
          }
          onClick={
            onPause
          }
        >
          PAUSE
        </button>

        <button
          disabled={
            !canResume
          }
          onClick={
            onResume
          }
        >
          RESUME
        </button>

        <button
          className="danger"
          disabled={
            !canAbort
          }
          onClick={() =>
            void onAbort()
          }
        >
          ABORT
        </button>
      </div>

      <button
        disabled={
          !canReset
        }
        onClick={
          onReset
        }
      >
        RESET EXECUTION STATE
      </button>

      {modeMessage && (
        <p
          className="tiny"
          role="status"
        >
          {modeMessage}
        </p>
      )}

      <p className="tiny">
        XY coordinates are simulated in this
        workstation mode. Autofocus, frame
        capture, inference, field result storage
        and slide aggregation execute through
        the research application pipeline.
      </p>
    </div>
  );
}
