"use client";

import type {
  ScanSlideSummary,
} from "@/lib/scan";


type SlideScanSummaryPanelProps = {
  summary:
    ScanSlideSummary | null;
};


function pct(
  value:
    number | null,
): string {
  return value ===
    null
    ? "—"
    : `${(
        value *
        100
      ).toFixed(
        1,
      )}%`;
}


export function SlideScanSummaryPanel({
  summary,
}: SlideScanSummaryPanelProps) {
  return (
    <div className="card researchCard">
      <div className="cardHeader">
        <div>
          WHOLE-SLIDE RESEARCH SUMMARY
        </div>

        <span>
          {summary
            ? "AGGREGATED"
            : "WAITING"}
        </span>
      </div>

      {!summary ? (
        <div className="trendPlaceholder">
          Run a slide-scan workflow to
          aggregate field-level ML outputs.
        </div>
      ) : (
        <>
          <div className="resultRow">
            <span>
              Fields analyzed
            </span>

            <strong>
              {summary.analyzedFields}
              /
              {summary.totalFields}
            </strong>
          </div>

          <div className="resultRow">
            <span>
              Fields with candidates
            </span>

            <strong>
              {
                summary.positiveFields
              }
            </strong>
          </div>

          <div className="resultRow">
            <span>
              Fields with no candidates
            </span>

            <strong>
              {
                summary.negativeFields
              }
            </strong>
          </div>

          <div className="resultRow">
            <span>
              Unanalyzed fields
            </span>

            <strong>
              {
                summary.unanalyzedFields
              }
            </strong>
          </div>

          <div className="resultRow">
            <span>
              Research candidates
            </span>

            <strong>
              {
                summary.totalCandidates
              }
            </strong>
          </div>

          <div className="resultRow">
            <span>
              Candidate density
            </span>

            <strong>
              {summary
                .candidateDensityPerAnalyzedField
                .toFixed(
                  2,
                )}
              {" / field"}
            </strong>
          </div>

          {summary
            .stageSummaries
            .map(
              (
                stage,
              ) => (
                <div
                  key={
                    stage.stage
                  }
                  className="resultRow"
                >
                  <span>
                    {stage.stage.toUpperCase()}
                  </span>

                  <strong>
                    {stage.count}
                    {" • D "}
                    {pct(
                      stage
                        .meanDetectorConfidence,
                    )}
                    {" • S "}
                    {pct(
                      stage
                        .meanStageConfidence,
                    )}
                  </strong>
                </div>
              ),
            )}

          <p className="tiny">
            Research candidate aggregation
            only. Candidate counts are not a
            diagnosis, parasite burden estimate,
            or clinically validated slide result.
          </p>
        </>
      )}
    </div>
  );
}
