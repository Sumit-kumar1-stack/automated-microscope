"use client";

import type {
  ScanSlideSummary,
} from "@/lib/scan";


type ScanFieldResultsPanelProps = {
  summary:
    ScanSlideSummary | null;
};


function stageText(
  stages:
    ScanSlideSummary["fields"][number]["stages"],
): string {
  const entries =
    Object.entries(
      stages,
    );

  if (
    entries.length ===
    0
  ) {
    return "—";
  }

  return entries
    .map(
      (
        [
          stage,
          count,
        ],
      ) =>
        `${stage}:${count}`,
    )
    .join(
      " • ",
    );
}


export function ScanFieldResultsPanel({
  summary,
}: ScanFieldResultsPanelProps) {
  return (
    <div className="card researchCard">
      <div className="cardHeader">
        <div>
          FIELD RESULTS
        </div>

        <span>
          {summary
            ? `${summary.fields.length} FIELDS`
            : "WAITING"}
        </span>
      </div>

      {!summary ? (
        <div className="trendPlaceholder">
          No scan-field results yet.
        </div>
      ) : (
        <div
          style={{
            display:
              "flex",

            flexDirection:
              "column",

            gap:
              7,

            maxHeight:
              360,

            overflowY:
              "auto",
          }}
        >
          {summary.fields.map(
            (
              field,
            ) => (
              <div
                key={
                  field.fieldId
                }
                className="pipelineBox"
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "90px 1fr auto",

                  alignItems:
                    "center",

                  gap:
                    8,
                }}
              >
                <strong>
                  {field.fieldId}
                </strong>

                <span>
                  R{field.row +
                    1}
                  {" "}
                  C{field.column +
                    1}
                  {" • "}
                  X{field.xUm}
                  {" "}
                  Y{field.yUm}
                  {" µm"}
                </span>

                <span>
                  {field.analyzed
                    ? `${field.candidateCount} • ${stageText(
                        field.stages,
                      )}`
                    : "UNANALYZED"}
                </span>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
