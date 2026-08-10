"use client";

import {
  type MicroscopeMode,
} from "@/lib/microscope-config";

type ZAxisControlPanelProps = {
  mode: MicroscopeMode;
  z: number;
  minZ: number;
  maxZ: number;
  running: boolean;
  hardwareReady: boolean;
  progress: number;
  onMoveZ: (
    nextZ: number,
  ) => void | Promise<void>;
  onRunAutofocus:
    () => void | Promise<void>;
  onCancelAutofocus:
    () => void;
};

export function ZAxisControlPanel({
  mode,
  z,
  minZ,
  maxZ,
  running,
  hardwareReady,
  progress,
  onMoveZ,
  onRunAutofocus,
  onCancelAutofocus,
}: ZAxisControlPanelProps) {
  const controlsDisabled =
    running ||
    (
      mode === "hardware" &&
      !hardwareReady
    );

  return (
    <div className="card controlCard">
      <div className="cardHeader">
        <div>
          Z-AXIS CONTROL
        </div>

        <span>
          {mode === "hardware"
            ? hardwareReady
              ? "ARMED"
              : "INTERLOCKED"
            : `SIMULATED ${minZ}-${maxZ}`}
        </span>
      </div>

      <div className="zReadout">
        {z}

        <small>
          {mode === "hardware"
            ? " session-relative units"
            : " virtual units"}
        </small>
      </div>

      <input
        aria-label="Z position"
        type="range"
        min={
          minZ
        }
        max={
          maxZ
        }
        value={
          z
        }
        disabled={
          controlsDisabled
        }
        onChange={(
          event,
        ) =>
          void onMoveZ(
            Number(
              event.target.value,
            ),
          )
        }
      />

      <div className="buttonGrid">
        <button
          onClick={() =>
            void onMoveZ(
              z - 5,
            )
          }
          disabled={
            controlsDisabled
          }
        >
          Z - 5
        </button>

        <button
          onClick={() =>
            void onMoveZ(
              z - 1,
            )
          }
          disabled={
            controlsDisabled
          }
        >
          Z - 1
        </button>

        <button
          onClick={() =>
            void onMoveZ(
              z + 1,
            )
          }
          disabled={
            controlsDisabled
          }
        >
          Z + 1
        </button>

        <button
          onClick={() =>
            void onMoveZ(
              z + 5,
            )
          }
          disabled={
            controlsDisabled
          }
        >
          Z + 5
        </button>
      </div>

      <button
        className="primary"
        onClick={() =>
          void onRunAutofocus()
        }
        disabled={
          controlsDisabled
        }
      >
        {running
          ? "AUTOFOCUS RUNNING..."
          : "RUN AUTOFOCUS"}
      </button>

      {running && (
        <button
          onClick={
            onCancelAutofocus
          }
        >
          CANCEL AUTOFOCUS
        </button>
      )}

      <div className="progress">
        <span
          style={{
            width:
              `${progress}%`,
          }}
        />
      </div>
    </div>
  );
}
