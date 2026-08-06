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
    | AnalysisSnapshot
    | null;

  profile:
    TestProfile;
};

export function ReportActions({
  snapshot,
  profile,
}: Props) {
  function downloadImage() {
    if (
      !snapshot
    ) {
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
    if (
      !snapshot
    ) {
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
          ANALYSIS REPORT
        </div>

        <span>
          PNG + PDF
        </span>
      </div>

      <button
        className="primary"
        disabled={
          !snapshot
        }
        onClick={
          downloadPdf
        }
      >
        DOWNLOAD PDF REPORT
      </button>

      <button
        disabled={
          !snapshot
        }
        onClick={
          downloadImage
        }
      >
        DOWNLOAD ANALYZED IMAGE
      </button>

      <p className="tiny">
        The PDF contains the active test
        protocol, focus measurements,
        configured analysis measurements
        and the frozen analyzed image.
      </p>
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