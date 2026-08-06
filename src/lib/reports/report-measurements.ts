import type {
  AnalysisSnapshot,
} from "@/lib/analysis-snapshot";

import type {
  MeasurementDefinition,
  MeasurementKey,
  TestProfile,
} from "@/knowledge/test-profiles";

export type ReportMeasurement = {
  label: string;

  value: string;

  description: string;
};

export function buildReportMeasurements(
  snapshot:
    AnalysisSnapshot,

  profile:
    TestProfile,
): ReportMeasurement[] {
  return profile.measurements.map(
    (
      measurement,
    ) => ({
      label:
        measurement.label,

      value:
        resolveMeasurementValue(
          snapshot,
          measurement,
        ),

      description:
        measurement.description,
    }),
  );
}

function resolveMeasurementValue(
  snapshot:
    AnalysisSnapshot,

  measurement:
    MeasurementDefinition,
): string {
  const raw =
    resolveRawValue(
      snapshot,
      measurement.key,
    );

  if (
    raw === null
  ) {
    return "—";
  }

  if (
    measurement.unit
  ) {
    return `${raw} ${measurement.unit}`;
  }

  return String(
    raw,
  );
}

function resolveRawValue(
  snapshot:
    AnalysisSnapshot,

  key:
    MeasurementKey,
):
  | string
  | number
  | null {
  const analysis =
    snapshot.analysis;

  switch (
    key
  ) {
    case "focusScore":
      return snapshot
        .focusScore
        .toFixed(
          1,
        );

    case "relativeDetail":
      return snapshot
        .relativeDetail
        .toFixed(
          0,
        );

    case "zPosition":
      return snapshot
        .zPosition;

    case "rbcCount":
      return analysis
        ?.counts
        .rbc ??
        null;

    case "wbcCount":
      return analysis
        ?.counts
        .wbc ??
        null;

    case "plateletCount":
      return analysis
        ?.counts
        .platelet ??
        null;

    case "totalCandidates":
      return analysis
        ?.total ??
        null;

    case "foregroundCoverage":
      return analysis
        ? analysis
            .foregroundCoverage
            .toFixed(
              1,
            )
        : null;

    case "processingTime":
      return analysis
        ? analysis
            .processingMs
            .toFixed(
              1,
            )
        : null;

    default:
      return null;
  }
}