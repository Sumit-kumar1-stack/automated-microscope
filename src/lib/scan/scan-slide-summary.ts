import type {
  MlBoundingBox,
  MlParasiteStage,
} from "../ml-inference";

import type {
  ScanField,
  ScanPlan,
} from "./scan-types";

import type {
  ScanMlFieldResult,
} from "./scan-ml-analyzer";


/* =========================================================
   TYPES
   ========================================================= */

export type SlideCandidateLocation = {
  fieldId:
    string;

  fieldSequence:
    number;

  row:
    number;

  column:
    number;

  /**
   * Microscope-stage position of the
   * field of view.
   */
  stageXUm:
    number;

  stageYUm:
    number;

  /**
   * Candidate location inside the
   * acquired image.
   *
   * Pixel coordinates remain separate
   * from stage microns until a real
   * optical calibration is available.
   */
  bboxPx:
    MlBoundingBox;

  centerXPx:
    number;

  centerYPx:
    number;

  imageWidthPx:
    number;

  imageHeightPx:
    number;
};


export type SlideCandidate = {
  id:
    string;

  stage:
    MlParasiteStage;

  detectorConfidence:
    number;

  stageConfidence:
    number;

  location:
    SlideCandidateLocation;
};


export type StageCandidateSummary = {
  stage:
    MlParasiteStage;

  count:
    number;

  meanDetectorConfidence:
    number | null;

  meanStageConfidence:
    number | null;
};


export type SlideFieldSummary = {
  fieldId:
    string;

  sequence:
    number;

  row:
    number;

  column:
    number;

  xUm:
    number;

  yUm:
    number;

  analyzed:
    boolean;

  candidateCount:
    number;

  stages:
    Partial<
      Record<
        MlParasiteStage,
        number
      >
    >;
};


export type ScanSlideSummary = {
  totalFields:
    number;

  analyzedFields:
    number;

  positiveFields:
    number;

  negativeFields:
    number;

  unanalyzedFields:
    number;

  totalCandidates:
    number;

  candidateDensityPerAnalyzedField:
    number;

  stageSummaries:
    StageCandidateSummary[];

  fields:
    SlideFieldSummary[];

  candidates:
    SlideCandidate[];

  generatedAtMs:
    number;
};


/* =========================================================
   HELPERS
   ========================================================= */

function mean(
  values:
    number[],
): number | null {
  if (
    values.length ===
    0
  ) {
    return null;
  }


  const total =
    values.reduce(
      (
        sum,
        value,
      ) =>
        sum +
        value,
      0,
    );


  return (
    total /
    values.length
  );
}


function getFieldResultMap(
  results:
    ScanMlFieldResult[],
): Map<
  string,
  ScanMlFieldResult
> {
  const map =
    new Map<
      string,
      ScanMlFieldResult
    >();


  for (
    const result
    of results
  ) {
    if (
      map.has(
        result.fieldId,
      )
    ) {
      throw new Error(
        `Duplicate ML result for scan field "${result.fieldId}".`,
      );
    }


    map.set(
      result.fieldId,
      result,
    );
  }


  return map;
}


function buildFieldSummary(
  field:
    ScanField,

  result:
    ScanMlFieldResult | undefined,
): SlideFieldSummary {
  if (
    !result
  ) {
    return {
      fieldId:
        field.id,

      sequence:
        field.sequence,

      row:
        field.row,

      column:
        field.column,

      xUm:
        field.xUm,

      yUm:
        field.yUm,

      analyzed:
        false,

      candidateCount:
        0,

      stages:
        {},
    };
  }


  const stages:
    Partial<
      Record<
        MlParasiteStage,
        number
      >
    > =
      {};


  for (
    const candidate
    of result.inference
      .candidates
  ) {
    stages[
      candidate.stage
    ] =
      (
        stages[
          candidate.stage
        ] ??
        0
      ) +
      1;
  }


  return {
    fieldId:
      field.id,

    sequence:
      field.sequence,

    row:
      field.row,

    column:
      field.column,

    xUm:
      field.xUm,

    yUm:
      field.yUm,

    analyzed:
      true,

    candidateCount:
      result.inference
        .candidates.length,

    stages,
  };
}


/* =========================================================
   AGGREGATION
   ========================================================= */

export function buildScanSlideSummary(
  plan:
    ScanPlan,

  results:
    ScanMlFieldResult[],
): ScanSlideSummary {
  const resultMap =
    getFieldResultMap(
      results,
    );


  /*
   * Reject results that do not belong
   * to this scan plan.
   */
  const validFieldIds =
    new Set(
      plan.fields.map(
        (
          field,
        ) =>
          field.id,
      ),
    );


  for (
    const result
    of results
  ) {
    if (
      !validFieldIds.has(
        result.fieldId,
      )
    ) {
      throw new Error(
        `ML result references unknown scan field "${result.fieldId}".`,
      );
    }
  }


  const fields =
    plan.fields.map(
      (
        field,
      ) =>
        buildFieldSummary(
          field,
          resultMap.get(
            field.id,
          ),
        ),
    );


  const candidates:
    SlideCandidate[] =
      [];


  for (
    const field
    of plan.fields
  ) {
    const result =
      resultMap.get(
        field.id,
      );


    if (
      !result
    ) {
      continue;
    }


    result.inference
      .candidates
      .forEach(
        (
          candidate,
          candidateIndex,
        ) => {
          const bbox =
            candidate.bbox;


          const centerXPx =
            (
              bbox.x1 +
              bbox.x2
            ) /
            2;

          const centerYPx =
            (
              bbox.y1 +
              bbox.y2
            ) /
            2;


          candidates.push(
            {
              id:
                `${field.id}-C${String(
                  candidateIndex +
                    1,
                ).padStart(
                  3,
                  "0",
                )}`,

              stage:
                candidate.stage,

              detectorConfidence:
                candidate
                  .detector_confidence,

              stageConfidence:
                candidate
                  .stage_confidence,

              location: {
                fieldId:
                  field.id,

                fieldSequence:
                  field.sequence,

                row:
                  field.row,

                column:
                  field.column,

                stageXUm:
                  field.xUm,

                stageYUm:
                  field.yUm,

                bboxPx: {
                  ...bbox,
                },

                centerXPx,

                centerYPx,

                imageWidthPx:
                  result.inference
                    .image.width,

                imageHeightPx:
                  result.inference
                    .image.height,
              },
            },
          );
        },
      );
  }


  const stageNames =
    [
      ...new Set(
        candidates.map(
          (
            candidate,
          ) =>
            candidate.stage,
        ),
      ),
    ];


  const stageSummaries =
    stageNames.map(
      (
        stage,
      ): StageCandidateSummary => {
        const matching =
          candidates.filter(
            (
              candidate,
            ) =>
              candidate.stage ===
              stage,
          );


        return {
          stage,

          count:
            matching.length,

          meanDetectorConfidence:
            mean(
              matching.map(
                (
                  candidate,
                ) =>
                  candidate
                    .detectorConfidence,
              ),
            ),

          meanStageConfidence:
            mean(
              matching.map(
                (
                  candidate,
                ) =>
                  candidate
                    .stageConfidence,
              ),
            ),
        };
      },
    );


  const analyzedFields =
    fields.filter(
      (
        field,
      ) =>
        field.analyzed,
    ).length;


  const positiveFields =
    fields.filter(
      (
        field,
      ) =>
        field.analyzed &&
        field.candidateCount >
          0,
    ).length;


  const negativeFields =
    fields.filter(
      (
        field,
      ) =>
        field.analyzed &&
        field.candidateCount ===
          0,
    ).length;


  const unanalyzedFields =
    fields.length -
    analyzedFields;


  return {
    totalFields:
      fields.length,

    analyzedFields,

    positiveFields,

    negativeFields,

    unanalyzedFields,

    totalCandidates:
      candidates.length,

    candidateDensityPerAnalyzedField:
      analyzedFields >
      0
        ? candidates.length /
          analyzedFields
        : 0,

    stageSummaries,

    fields,

    candidates,

    generatedAtMs:
      Date.now(),
  };
}