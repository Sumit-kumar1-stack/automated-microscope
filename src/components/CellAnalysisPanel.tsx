import type {
  CellAnalysisResult,
} from "@/lib/cell-analysis";

type CellAnalysisPanelProps = {
  result:
    | CellAnalysisResult
    | null;

  analyzing:
    boolean;

  canAnalyze:
    boolean;

  onAnalyze:
    () => void;

  onClear:
    () => void;
};

export function CellAnalysisPanel({
  result,
  analyzing,
  canAnalyze,
  onAnalyze,
  onClear,
}: CellAnalysisPanelProps) {
  return (
    <div className="card analysisCard">
      <div className="cardHeader">
        <div>
          FIELD ANALYSIS
        </div>

        <span>
          HEURISTIC CV • RESEARCH ONLY
        </span>
      </div>

      <div className="analysisActions">
        <button
          className="primary"
          onClick={
            onAnalyze
          }
          disabled={
            !canAnalyze ||
            analyzing
          }
        >
          {analyzing
            ? "ANALYZING…"
            : "ANALYZE CURRENT FIELD"}
        </button>

        <button
          onClick={
            onClear
          }
          disabled={
            !result ||
            analyzing
          }
        >
          CLEAR DETECTIONS
        </button>
      </div>

      {!result ? (
        <p className="tiny analysisNote">
          Run analysis after the field is focused.
          Detection currently uses explainable
          color and connected-component heuristics.
          It reports research candidates only and
          is not a clinical classification model.
        </p>
      ) : (
        <>
          <div className="analysisCounts">
            <AnalysisMetric
              label="RBC-like"
              value={
                result
                  .counts
                  .rbc
              }
            />

            <AnalysisMetric
              label="WBC-like"
              value={
                result
                  .counts
                  .wbc
              }
            />

            <AnalysisMetric
              label="Platelet-like"
              value={
                result
                  .counts
                  .platelet
              }
            />
          </div>

          <div className="resultRow">
            <span>
              Total candidates
            </span>

            <strong>
              {
                result.total
              }
            </strong>
          </div>

          <div className="resultRow">
            <span>
              Foreground coverage
            </span>

            <strong>
              {result
                .foregroundCoverage
                .toFixed(
                  1,
                )}
              %
            </strong>
          </div>

          <div className="resultRow">
            <span>
              Processing
            </span>

            <strong>
              {result
                .processingMs
                .toFixed(
                  1,
                )}
              {" "}
              ms
            </strong>
          </div>

          <p className="tiny analysisNote">
            Bounding boxes represent candidate
            structures from the current snapshot.
            A production diagnostic system would
            require validated labelled microscopy
            data and a validated detection model.
          </p>
        </>
      )}
    </div>
  );
}

function AnalysisMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="analysisMetric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}