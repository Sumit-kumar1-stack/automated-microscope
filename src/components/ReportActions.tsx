import type {
  AnalysisSnapshot,
} from "@/lib/analysis-snapshot";

import type {
  TestProfile,
} from "@/knowledge/test-profiles";

import {
  downloadAnalysisImage,
} from "@/lib/reports/capture-analysis-image";

import {
  generatePdfReport,
} from "@/lib/reports/generate-pdf-report";

type Props = {
  snapshot:
    AnalysisSnapshot | null;

  profile:
    TestProfile;
};

export function ReportActions({
  snapshot,
  profile,
}: Props) {
  function downloadImage() {
    if (!snapshot) {
      return;
    }

    downloadAnalysisImage(
      snapshot.imageDataUrl,
      createImageFilename(
        snapshot,
        profile,
      ),
    );
  }

  function downloadPdf() {
    if (!snapshot) {
      return;
    }

    generatePdfReport(
      snapshot,
      profile,
    );
  }

  return (
    <div className="card reportCard">
      <div className="cardHeader">
        <div>
          EXPORT REPORT
        </div>

        <span>
          PDF + PNG
        </span>
      </div>

      <div className="reportBody">
        <div className="reportReady">
          <span
            className={
              snapshot
                ? "reportReadyDot"
                : "reportReadyDot off"
            }
          />

          <span>
            {snapshot
              ? "Latest analysis ready to export"
              : "Analyze a field to create a report"}
          </span>
        </div>

        <div className="reportActions">
          <button
            className="primary"
            disabled={!snapshot}
            onClick={downloadPdf}
          >
            DOWNLOAD PDF
          </button>

          <button
            disabled={!snapshot}
            onClick={downloadImage}
          >
            SAVE IMAGE
          </button>
        </div>

        <p className="reportHint">
          Reports include the frozen analyzed
          image, active protocol, focus
          measurements and configured research
          measurements.
        </p>
      </div>
    </div>
  );
}

function createImageFilename(
  snapshot:
    AnalysisSnapshot,

  profile:
    TestProfile,
): string {
  const safeName =
    profile.shortName
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      );

  const date =
    snapshot.createdAt
      .replace(
        /[:.]/g,
        "-",
      );

  return `${safeName}-${date}.png`;
}