import type {
  AnalysisSnapshot,
} from "@/lib/analysis-snapshot";

import {
  getTestProfile,
} from "@/knowledge/test-profiles";

import {
  generatePdfReport,
} from "@/lib/reports/generate-pdf-report";

import {
  downloadAnalysisImage,
} from "@/lib/reports/capture-analysis-image";

type Props = {
  items:
    AnalysisSnapshot[];

  onDelete: (
    id: string,
  ) => void;
};

export function AnalysisHistory({
  items,
  onDelete,
}: Props) {
  return (
    <section className="card historyCard">
      <div className="cardHeader">
        <div>
          RECENT ANALYSES
        </div>

        <span className="historyHeaderCount">
          {items.length}
          {" "}
          RECORDS
        </span>
      </div>

      {items.length === 0 ? (
        <div className="historyEmpty">
          No analysis records yet.
          Run an analysis to create your first
          report snapshot.
        </div>
      ) : (
        <div className="historyGrid">
          {items.map(
            (snapshot) => {
              const profile =
                getTestProfile(
                  snapshot.profileId,
                );

              return (
                <article
                  key={
                    snapshot.id
                  }
                  className="historyItem"
                >
                  <div className="historyImageWrap">
                    <img
                      src={
                        snapshot.imageDataUrl
                      }
                      alt="Analyzed microscope field"
                    />

                    <span className="historyMode">
                      {
                        snapshot.acquisitionMode
                      }
                    </span>
                  </div>

                  <div className="historyContent">
                    <div className="historyTop">
                      <div>
                        <strong>
                          {
                            snapshot.profileName
                          }
                        </strong>

                        <small>
                          {formatDate(
                            snapshot.createdAt,
                          )}
                        </small>
                      </div>

                      <span className="historyFocus">
                        {
                          snapshot.relativeDetail
                        }
                        %
                      </span>
                    </div>

                    <div className="historyStats">
                      <div>
                        <span>
                          Focus score
                        </span>

                        <strong>
                          {snapshot.focusScore.toFixed(
                            1,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Candidates
                        </span>

                        <strong>
                          {
                            snapshot.analysis
                              ?.total ??
                            "—"
                          }
                        </strong>
                      </div>
                    </div>

                    <div className="historyActions">
                      <button
                        onClick={() =>
                          generatePdfReport(
                            snapshot,
                            profile,
                          )
                        }
                      >
                        PDF
                      </button>

                      <button
                        onClick={() =>
                          downloadAnalysisImage(
                            snapshot.imageDataUrl,
                            `analysis-${snapshot.id}.png`,
                          )
                        }
                      >
                        IMAGE
                      </button>

                      <button
                        className="danger"
                        onClick={() =>
                          onDelete(
                            snapshot.id,
                          )
                        }
                        aria-label="Delete analysis"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </article>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}

function formatDate(
  value: string,
): string {
  return new Date(
    value,
  ).toLocaleString(
    [],
    {
      dateStyle:
        "medium",

      timeStyle:
        "short",
    },
  );
}