"use client";

import {
  type ScanCoordinate,
  type ScanMachineSnapshot,
} from "@/lib/scan";


type ScanProgressPanelProps = {
  snapshot:
    ScanMachineSnapshot | null;

  stagePosition:
    ScanCoordinate | null;

  error?:
    string | null;
};


export function ScanProgressPanel({
  snapshot,
  stagePosition,
  error = null,
}: ScanProgressPanelProps) {
  const progress =
    snapshot?.progressPercent ??
    0;

  const currentField =
    snapshot?.currentField ??
    null;


  return (
    <div className="card researchCard">
      <div className="cardHeader">
        <div>
          SCAN EXECUTION TELEMETRY
        </div>

        <span>
          {snapshot
            ? snapshot.runStatus.toUpperCase()
            : "IDLE"}
        </span>
      </div>

      <div className="progress">
        <span
          style={{
            width:
              `${Math.max(
                0,
                Math.min(
                  100,
                  progress,
                ),
              )}%`,
          }}
        />
      </div>

      <div className="resultRow">
        <span>
          Progress
        </span>

        <strong>
          {progress.toFixed(
            1,
          )}%
        </strong>
      </div>

      <div className="resultRow">
        <span>
          Phase
        </span>

        <strong>
          {snapshot
            ? snapshot.phase.toUpperCase()
            : "IDLE"}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          Current field
        </span>

        <strong>
          {currentField
            ? `${currentField.id} • R${currentField.row + 1} C${currentField.column + 1}`
            : "—"}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          Target XY
        </span>

        <strong>
          {currentField
            ? `${currentField.xUm}, ${currentField.yUm} µm`
            : "—"}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          Stage XY
        </span>

        <strong>
          {stagePosition
            ? `${stagePosition.xUm}, ${stagePosition.yUm} µm`
            : "—"}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          Processed
        </span>

        <strong>
          {snapshot
            ? `${snapshot.processedFields}/${snapshot.totalFields}`
            : "0/0"}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          Completed
        </span>

        <strong>
          {snapshot
            ? `${snapshot.completedFields}/${snapshot.totalFields}`
            : "0/0"}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          Failed / skipped
        </span>

        <strong>
          {snapshot
            ? `${snapshot.failedFields} / ${snapshot.skippedFields}`
            : "0 / 0"}
        </strong>
      </div>

      {(error ||
        snapshot?.lastError) && (
        <p
          className="tiny"
          role="alert"
        >
          {error ??
            snapshot?.lastError}
        </p>
      )}
    </div>
  );
}
