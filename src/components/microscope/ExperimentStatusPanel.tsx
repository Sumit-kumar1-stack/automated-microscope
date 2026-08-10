"use client";

import type {
  MicroscopeMode,
} from "@/lib/microscope-config";

import type {
  ScanMachineSnapshot,
} from "@/lib/scan";


type ExperimentStatusPanelProps = {
  mode:
    MicroscopeMode;

  profileName:
    string;

  scanSnapshot:
    ScanMachineSnapshot | null;

  analyzedFieldCount:
    number;

  capturedFieldCount:
    number;

  candidateCount:
    number;

  mlServiceStatus:
    string;
};


export function ExperimentStatusPanel({
  mode,
  profileName,
  scanSnapshot,
  analyzedFieldCount,
  capturedFieldCount,
  candidateCount,
  mlServiceStatus,
}: ExperimentStatusPanelProps) {
  return (
    <div className="card researchCard">
      <div className="cardHeader">
        <div>
          EXPERIMENT STATUS
        </div>

        <span>
          RESEARCH ONLY
        </span>
      </div>

      <div className="resultRow">
        <span>
          Acquisition mode
        </span>

        <strong>
          {mode.toUpperCase()}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          Test profile
        </span>

        <strong>
          {profileName}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          Scan status
        </span>

        <strong>
          {scanSnapshot
            ?.runStatus
            .toUpperCase() ??
            "IDLE"}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          Captured fields
        </span>

        <strong>
          {
            capturedFieldCount
          }
        </strong>
      </div>

      <div className="resultRow">
        <span>
          ML-analyzed fields
        </span>

        <strong>
          {
            analyzedFieldCount
          }
        </strong>
      </div>

      <div className="resultRow">
        <span>
          Research candidates
        </span>

        <strong>
          {candidateCount}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          ML service
        </span>

        <strong>
          {mlServiceStatus
            .toUpperCase()}
        </strong>
      </div>

      <p className="tiny">
        Engineering validation status only.
        The platform is not a clinically
        validated diagnostic instrument.
      </p>
    </div>
  );
}
