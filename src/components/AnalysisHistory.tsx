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

  onDelete:
    (
      id:
        string,
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
          ANALYSIS HISTORY
        </div>

        <span>
          LOCAL INDEXEDDB
        </span>
      </div>

      {items.length ===
      0 ? (
        <div className="historyEmpty">
          No analysis records yet.
        </div>
      ) : (
        <div className="historyGrid">
          {items.map(
            (
              snapshot,
            ) => {
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
                  <img
                    src={
                      snapshot.imageDataUrl
                    }
                    alt="Analyzed microscope field"
                  />

                  <div className="historyContent">
                    <div className="historyTop">
                      <div>
                        <strong>
                          {
                            snapshot.profileName
                          }
                        </strong>

                        <small>
                          {
                            formatDate(
                              snapshot.createdAt,
                            )
                          }
                        </small>
                      </div>

                      <span>
                        {
                          snapshot.focusScore.toFixed(
                            1,
                          )
                        }
                      </span>
                    </div>

                    <div className="historyStats">
                      <small>
                        Focus{" "}
                        {
                          snapshot.relativeDetail
                        }
                        %
                      </small>

                      <small>
                        Candidates{" "}
                        {
                          snapshot.analysis
                            ?.total ??
                          "—"
                        }
                      </small>

                      <small>
                        {
                          snapshot.acquisitionMode
                        }
                      </small>
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
                      >
                        DELETE
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
  value:
    string,
): string {
  return new Date(
    value,
  ).toLocaleString();
}