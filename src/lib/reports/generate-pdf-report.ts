import jsPDF from "jspdf";

import type {
  AnalysisSnapshot,
} from "@/lib/analysis-snapshot";

import type {
  TestProfile,
} from "@/knowledge/test-profiles";

import {
  buildReportMeasurements,
} from "@/lib/reports/report-measurements";

export function generatePdfReport(
  snapshot:
    AnalysisSnapshot,

  profile:
    TestProfile,
): void {
  const pdf =
    new jsPDF({
      orientation:
        "portrait",

      unit:
        "mm",

      format:
        "a4",
    });

  const pageWidth =
    pdf.internal.pageSize.getWidth();

  const pageHeight =
    pdf.internal.pageSize.getHeight();

  const margin =
    15;

  const contentWidth =
    pageWidth -
    margin * 2;

  let y =
    16;

  /*
   * ------------------------------------------------
   * HEADER
   * ------------------------------------------------
   */
  pdf.setFont(
    "helvetica",
    "bold",
  );

  pdf.setFontSize(
    17,
  );

  pdf.text(
    "AUTOMATED MICROSCOPY",
    margin,
    y,
  );

  y +=
    7;

  pdf.setFontSize(
    12,
  );

  pdf.text(
    "Research Analysis Report",
    margin,
    y,
  );

  y +=
    8;

  pdf.setFont(
    "helvetica",
    "normal",
  );

  pdf.setFontSize(
    8.5,
  );

  pdf.text(
    "Research prototype • Not a diagnostic medical device",
    margin,
    y,
  );

  y +=
    10;

  pdf.line(
    margin,
    y,
    pageWidth -
      margin,
    y,
  );

  y +=
    8;

  /*
   * ------------------------------------------------
   * TEST METADATA
   * ------------------------------------------------
   */
  y =
    addSectionTitle(
      pdf,
      "TEST CONFIGURATION",
      margin,
      y,
    );

  y =
    addKeyValue(
      pdf,
      "Test profile",
      profile.name,
      margin,
      y,
    );

  y =
    addKeyValue(
      pdf,
      "Profile version",
      profile.version,
      margin,
      y,
    );

  y =
    addKeyValue(
      pdf,
      "Specimen",
      profile.specimenType,
      margin,
      y,
    );

  y =
    addKeyValue(
      pdf,
      "Detector",
      profile.detector.label,
      margin,
      y,
    );

  y =
    addKeyValue(
      pdf,
      "Focus method",
      profile.focus.method,
      margin,
      y,
    );

  y +=
    4;

  /*
   * ------------------------------------------------
   * ANALYSIS METADATA
   * ------------------------------------------------
   */

  y =
    addSectionTitle(
      pdf,
      "ANALYSIS RECORD",
      margin,
      y,
    );

  y =
    addKeyValue(
      pdf,
      "Analysis ID",
      snapshot.id,
      margin,
      y,
    );

  y =
    addKeyValue(
      pdf,
      "Captured",
      formatDate(
        snapshot.createdAt,
      ),
      margin,
      y,
    );

  y =
    addKeyValue(
      pdf,
      "Acquisition",
      snapshot.acquisitionMode,
      margin,
      y,
    );

  y =
    addKeyValue(
      pdf,
      "Focus state",
      snapshot.focusStatus,
      margin,
      y,
    );

  y +=
    5;

  /*
   * ------------------------------------------------
   * MEASUREMENTS
   * ------------------------------------------------
   */

  y =
    addSectionTitle(
      pdf,
      "MEASUREMENTS",
      margin,
      y,
    );

  const measurements =
    buildReportMeasurements(
      snapshot,
      profile,
    );

  for (
    const measurement
    of measurements
  ) {
    if (
      y >
      pageHeight -
        30
    ) {
      pdf.addPage();

      y =
        margin;
    }

    pdf.setFont(
      "helvetica",
      "normal",
    );

    pdf.setFontSize(
      9,
    );

    pdf.text(
      measurement.label,
      margin,
      y,
    );

    pdf.setFont(
      "helvetica",
      "bold",
    );

    pdf.text(
      measurement.value,
      pageWidth -
        margin,
      y,
      {
        align:
          "right",
      },
    );

    y +=
      6;
  }

  y +=
    5;

  /*
   * ------------------------------------------------
   * ANALYZED IMAGE
   * ------------------------------------------------
   */

  if (
    profile.report
      .includeAnalyzedImage &&
    snapshot.imageDataUrl
  ) {
    if (
      y >
      155
    ) {
      pdf.addPage();

      y =
        margin;
    }

    y =
      addSectionTitle(
        pdf,
        "ANALYZED IMAGE",
        margin,
        y,
      );

    const imageWidth =
      contentWidth;

    /*
     * Original microscope display:
     * 900 × 560.
     */
    const imageHeight =
      imageWidth *
      (
        560 /
        900
      );

    pdf.addImage(
      snapshot.imageDataUrl,
      "PNG",
      margin,
      y,
      imageWidth,
      imageHeight,
      undefined,
      "FAST",
    );

    y +=
      imageHeight +
      8;
  }

  /*
   * ------------------------------------------------
   * KNOWLEDGE CONFIGURATION
   * ------------------------------------------------
   */

  if (
    y >
    pageHeight -
      65
  ) {
    pdf.addPage();

    y =
      margin;
  }

  y =
    addSectionTitle(
      pdf,
      "KNOWLEDGE CONFIGURATION",
      margin,
      y,
    );

  pdf.setFont(
    "helvetica",
    "normal",
  );

  pdf.setFontSize(
    8.5,
  );

  const knowledgeText =
    [
      `Detector: ${profile.detector.description}`,

      `Targets: ${
        profile.targetClasses.length >
        0
          ? profile.targetClasses.join(
              ", ",
            )
          : "No biological target classification"
      }`,
    ];

  for (
    const text
    of knowledgeText
  ) {
    const lines =
      pdf.splitTextToSize(
        text,
        contentWidth,
      );

    pdf.text(
      lines,
      margin,
      y,
    );

    y +=
      lines.length *
        4.5 +
      2;
  }

  /*
   * ------------------------------------------------
   * DISCLAIMER
   * ------------------------------------------------
   */

  if (
    profile.report
      .includeDisclaimer
  ) {
    y +=
      4;

    if (
      y >
      pageHeight -
        45
    ) {
      pdf.addPage();

      y =
        margin;
    }

    y =
      addSectionTitle(
        pdf,
        "RESEARCH DISCLAIMER",
        margin,
        y,
      );

    pdf.setFont(
      "helvetica",
      "normal",
    );

    pdf.setFontSize(
      8,
    );

    const disclaimer =
      pdf.splitTextToSize(
        profile.disclaimer,
        contentWidth,
      );

    pdf.text(
      disclaimer,
      margin,
      y,
    );
  }

  /*
   * Footer on every page.
   */
  const totalPages =
    pdf.getNumberOfPages();

  for (
    let page = 1;
    page <=
    totalPages;
    page += 1
  ) {
    pdf.setPage(
      page,
    );

    pdf.setFontSize(
      7,
    );

    pdf.setFont(
      "helvetica",
      "normal",
    );

    pdf.text(
      `Generated by Automated Microscopy Research Prototype • Page ${page}/${totalPages}`,
      margin,
      pageHeight -
        8,
    );
  }

  pdf.save(
    createReportFilename(
      profile,
      snapshot,
    ),
  );
}

function addSectionTitle(
  pdf:
    jsPDF,

  title:
    string,

  x:
    number,

  y:
    number,
): number {
  pdf.setFont(
    "helvetica",
    "bold",
  );

  pdf.setFontSize(
    10,
  );

  pdf.text(
    title,
    x,
    y,
  );

  return y +
    7;
}

function addKeyValue(
  pdf:
    jsPDF,

  label:
    string,

  value:
    string,

  x:
    number,

  y:
    number,
): number {
  const width =
    pdf.internal.pageSize.getWidth();

  pdf.setFont(
    "helvetica",
    "normal",
  );

  pdf.setFontSize(
    8.5,
  );

  pdf.text(
    label,
    x,
    y,
  );

  pdf.setFont(
    "helvetica",
    "bold",
  );

  pdf.text(
    value,
    width -
      x,
    y,
    {
      align:
        "right",
    },
  );

  return y +
    5.5;
}

function formatDate(
  isoDate:
    string,
): string {
  return new Date(
    isoDate,
  ).toLocaleString();
}

function createReportFilename(
  profile:
    TestProfile,

  snapshot:
    AnalysisSnapshot,
): string {
  const date =
    snapshot.createdAt
      .replace(
        /[:.]/g,
        "-",
      );

  const safeName =
    profile.shortName
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      );

  return `${safeName}-${date}.pdf`;
}