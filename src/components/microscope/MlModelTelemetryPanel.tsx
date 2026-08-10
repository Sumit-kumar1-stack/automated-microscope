"use client";

import type {
  MlModelInfo,
} from "@/hooks/useMlServiceTelemetry";


type MlModelTelemetryPanelProps = {
  serviceStatus:
    string;

  modelInfo:
    MlModelInfo | null;

  loading:
    boolean;

  error:
    string | null;

  lastCheckedAt:
    number | null;

  onRefresh:
    () =>
      void |
      Promise<void>;
};


function percentage(
  value:
    number | undefined,
): string {
  return typeof value ===
    "number"
    ? `${(
        value *
        100
      ).toFixed(
        1,
      )}%`
    : "—";
}


export function MlModelTelemetryPanel({
  serviceStatus,
  modelInfo,
  loading,
  error,
  lastCheckedAt,
  onRefresh,
}: MlModelTelemetryPanelProps) {
  const external =
    modelInfo?.validation
      ?.external;

  const development =
    modelInfo?.validation
      ?.development;


  return (
    <div className="card researchCard">
      <div className="cardHeader">
        <div>
          ML MODEL TELEMETRY
        </div>

        <span>
          {loading
            ? "CHECKING"
            : serviceStatus.toUpperCase()}
        </span>
      </div>

      <div className="resultRow">
        <span>
          Detector
        </span>

        <strong>
          {modelInfo
            ?.detector
            ?.name ??
            "—"}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          Classifier
        </span>

        <strong>
          {modelInfo
            ?.classifier
            ?.name ??
            "—"}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          Detector threshold
        </span>

        <strong>
          {modelInfo
            ?.detector
            ?.confidence_threshold
            ?.toFixed(
              2,
            ) ??
            "—"}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          Development detector F1
        </span>

        <strong>
          {percentage(
            development
              ?.detector_f1,
          )}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          External detector recall
        </span>

        <strong>
          {percentage(
            external
              ?.detector_recall,
          )}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          External end-to-end macro-F1
        </span>

        <strong>
          {percentage(
            external
              ?.end_to_end_macro_f1,
          )}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          Validation benchmark
        </span>

        <strong>
          {external
            ?.benchmark ??
            "—"}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          Research only
        </span>

        <strong>
          {modelInfo
            ?.research_only ===
          false
            ? "NO"
            : "YES"}
        </strong>
      </div>

      <div className="resultRow">
        <span>
          Clinically validated
        </span>

        <strong>
          {modelInfo
            ?.clinically_validated
            ? "YES"
            : "NO"}
        </strong>
      </div>

      <button
        type="button"
        onClick={() =>
          void onRefresh()
        }
        disabled={
          loading
        }
      >
        REFRESH MODEL TELEMETRY
      </button>

      {lastCheckedAt && (
        <p className="tiny">
          Last checked:{" "}
          {
            new Date(
              lastCheckedAt,
            ).toLocaleTimeString()
          }
        </p>
      )}

      {error && (
        <p
          className="tiny"
          role="alert"
        >
          {error}
        </p>
      )}

      <p className="tiny">
        Experimental research model.
        External validation performance is
        surfaced intentionally so development
        performance is not mistaken for
        deployment generalization.
      </p>
    </div>
  );
}
