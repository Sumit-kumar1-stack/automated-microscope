import {
  buildScanPlan,
  buildScanSlideSummary,
} from "./index";

import type {
  ScanMlFieldResult,
} from "./scan-ml-analyzer";


/* =========================================================
   TEST FIXTURE HELPERS
   ========================================================= */

type TestCandidate =
  ScanMlFieldResult[
    "inference"
  ]["candidates"][number];


function makeCandidate(
  candidate:
    TestCandidate,
): TestCandidate {
  return candidate;
}


function makeInference(
  filename:
    string,

  candidates:
    TestCandidate[],
): ScanMlFieldResult["inference"] {
  return {
    status:
      "complete",

    analysis_type:
      "experimental parasite candidate detection",

    research_only:
      true,

    clinically_validated:
      false,

    model_version:
      "v2-frozen",

    image: {
      filename,

      width:
        1600,

      height:
        1200,
    },

    configuration: {
      detector_confidence:
        0.25,

      detector_image_size:
        512,

      classifier_image_size:
        160,

      context_scale:
        1.8,
    },

    candidate_count:
      candidates.length,

    candidates,

    timing_ms: {
      inference:
        100,

      total:
        150,
    },
  };
}


/* =========================================================
   TEST
   ========================================================= */

async function run():
  Promise<void> {
  const plan =
    buildScanPlan(
      {
        rows:
          2,

        columns:
          2,

        originXUm:
          0,

        originYUm:
          0,

        stepXUm:
          500,

        stepYUm:
          400,

        serpentine:
          true,
      },
    );


  /* =======================================================
     F0001
     Two candidates:
     - ring
     - trophozoite
     ======================================================= */

  const f0001Candidates:
    TestCandidate[] =
      [
        makeCandidate(
          {
            candidate_id:
              1,

            bbox: {
              x1:
                100,

              y1:
                200,

              x2:
                180,

              y2:
                280,
            },

            detector_confidence:
              0.82,

            stage:
              "ring",

            stage_confidence:
              0.97,
          },
        ),

        makeCandidate(
          {
            candidate_id:
              2,

            bbox: {
              x1:
                800,

              y1:
                500,

              x2:
                900,

              y2:
                600,
            },

            detector_confidence:
              0.61,

            stage:
              "trophozoite",

            stage_confidence:
              0.94,
          },
        ),
      ];


  /* =======================================================
     F0002
     Analyzed negative field
     ======================================================= */

  const f0002Candidates:
    TestCandidate[] =
      [];


  /* =======================================================
     F0003
     One ring candidate
     ======================================================= */

  const f0003Candidates:
    TestCandidate[] =
      [
        makeCandidate(
          {
            candidate_id:
              1,

            bbox: {
              x1:
                300,

              y1:
                350,

              x2:
                390,

              y2:
                440,
            },

            detector_confidence:
              0.76,

            stage:
              "ring",

            stage_confidence:
              0.91,
          },
        ),
      ];


  /* =======================================================
     FIELD ML RESULTS

     F0004 intentionally has no result.
     This verifies that "unanalyzed" is
     different from "negative".
     ======================================================= */

  const results:
    ScanMlFieldResult[] =
      [
        {
          fieldId:
            "F0001",

          filename:
            "F0001.png",

          analyzedAtMs:
            Date.now(),

          durationMs:
            180,

          inference:
            makeInference(
              "F0001.png",
              f0001Candidates,
            ),
        },

        {
          fieldId:
            "F0002",

          filename:
            "F0002.png",

          analyzedAtMs:
            Date.now(),

          durationMs:
            175,

          inference:
            makeInference(
              "F0002.png",
              f0002Candidates,
            ),
        },

        {
          fieldId:
            "F0003",

          filename:
            "F0003.png",

          analyzedAtMs:
            Date.now(),

          durationMs:
            190,

          inference:
            makeInference(
              "F0003.png",
              f0003Candidates,
            ),
        },
      ];


  /* =======================================================
     BUILD SLIDE SUMMARY
     ======================================================= */

  const summary =
    buildScanSlideSummary(
      plan,
      results,
    );


  /* =======================================================
     PRINT OVERALL SUMMARY
     ======================================================= */

  console.log(
    "SLIDE SUMMARY",
    {
      totalFields:
        summary.totalFields,

      analyzedFields:
        summary.analyzedFields,

      positiveFields:
        summary.positiveFields,

      negativeFields:
        summary.negativeFields,

      unanalyzedFields:
        summary.unanalyzedFields,

      totalCandidates:
        summary.totalCandidates,

      density:
        summary
          .candidateDensityPerAnalyzedField
          .toFixed(
            3,
          ),
    },
  );


  console.log(
    "",
  );


  /* =======================================================
     PRINT STAGE STATISTICS
     ======================================================= */

  for (
    const stage
    of summary.stageSummaries
  ) {
    console.log(
      "STAGE",
      {
        stage:
          stage.stage,

        count:
          stage.count,

        detectorMean:
          stage
            .meanDetectorConfidence
            ?.toFixed(
              3,
            ) ??
          null,

        classifierMean:
          stage
            .meanStageConfidence
            ?.toFixed(
              3,
            ) ??
          null,
      },
    );
  }


  console.log(
    "",
  );


  /* =======================================================
     PRINT CANDIDATE PROVENANCE
     ======================================================= */

  for (
    const candidate
    of summary.candidates
  ) {
    console.log(
      "CANDIDATE",
      {
        id:
          candidate.id,

        stage:
          candidate.stage,

        field:
          candidate.location
            .fieldId,

        grid:
          [
            candidate.location
              .row,

            candidate.location
              .column,
          ],

        stageXY:
          [
            candidate.location
              .stageXUm,

            candidate.location
              .stageYUm,
          ],

        centerPx:
          [
            candidate.location
              .centerXPx,

            candidate.location
              .centerYPx,
          ],

        detectorConfidence:
          candidate
            .detectorConfidence,

        stageConfidence:
          candidate
            .stageConfidence,
      },
    );
  }


  console.log(
    "",
  );


  /* =======================================================
     OVERALL VALIDATION
     ======================================================= */

  if (
    summary.totalFields !==
    4
  ) {
    throw new Error(
      `Expected 4 fields, got ${summary.totalFields}.`,
    );
  }


  if (
    summary.analyzedFields !==
    3
  ) {
    throw new Error(
      `Expected 3 analyzed fields, got ${summary.analyzedFields}.`,
    );
  }


  if (
    summary.positiveFields !==
    2
  ) {
    throw new Error(
      `Expected 2 positive fields, got ${summary.positiveFields}.`,
    );
  }


  if (
    summary.negativeFields !==
    1
  ) {
    throw new Error(
      `Expected 1 negative field, got ${summary.negativeFields}.`,
    );
  }


  if (
    summary.unanalyzedFields !==
    1
  ) {
    throw new Error(
      `Expected 1 unanalyzed field, got ${summary.unanalyzedFields}.`,
    );
  }


  if (
    summary.totalCandidates !==
    3
  ) {
    throw new Error(
      `Expected 3 candidates, got ${summary.totalCandidates}.`,
    );
  }


  if (
    Math.abs(
      summary
        .candidateDensityPerAnalyzedField -
      1,
    ) >
    0.0001
  ) {
    throw new Error(
      `Expected candidate density 1.0, got ${summary.candidateDensityPerAnalyzedField}.`,
    );
  }


  /* =======================================================
     STAGE AGGREGATION VALIDATION
     ======================================================= */

  const ringSummary =
    summary.stageSummaries.find(
      (
        item,
      ) =>
        item.stage ===
        "ring",
    );


  if (
    !ringSummary
  ) {
    throw new Error(
      "Ring summary is missing.",
    );
  }


  if (
    ringSummary.count !==
    2
  ) {
    throw new Error(
      `Expected 2 ring candidates, got ${ringSummary.count}.`,
    );
  }


  const expectedRingDetectorMean =
    (
      0.82 +
      0.76
    ) /
    2;


  if (
    ringSummary
      .meanDetectorConfidence ===
      null ||
    Math.abs(
      ringSummary
        .meanDetectorConfidence -
      expectedRingDetectorMean,
    ) >
      0.0001
  ) {
    throw new Error(
      "Ring detector-confidence mean is incorrect.",
    );
  }


  const expectedRingStageMean =
    (
      0.97 +
      0.91
    ) /
    2;


  if (
    ringSummary
      .meanStageConfidence ===
      null ||
    Math.abs(
      ringSummary
        .meanStageConfidence -
      expectedRingStageMean,
    ) >
      0.0001
  ) {
    throw new Error(
      "Ring stage-confidence mean is incorrect.",
    );
  }


  const trophSummary =
    summary.stageSummaries.find(
      (
        item,
      ) =>
        item.stage ===
        "trophozoite",
    );


  if (
    !trophSummary
  ) {
    throw new Error(
      "Trophozoite summary is missing.",
    );
  }


  if (
    trophSummary.count !==
    1
  ) {
    throw new Error(
      `Expected 1 trophozoite candidate, got ${trophSummary.count}.`,
    );
  }


  /* =======================================================
     FIELD VALIDATION
     ======================================================= */

  const field1 =
    summary.fields.find(
      (
        field,
      ) =>
        field.fieldId ===
        "F0001",
    );


  if (
    !field1
  ) {
    throw new Error(
      "F0001 summary is missing.",
    );
  }


  if (
    !field1.analyzed ||
    field1.candidateCount !==
      2
  ) {
    throw new Error(
      "F0001 should contain two candidates.",
    );
  }


  if (
    field1.stages.ring !==
      1 ||
    field1.stages
      .trophozoite !==
      1
  ) {
    throw new Error(
      "F0001 stage counts are incorrect.",
    );
  }


  const field2 =
    summary.fields.find(
      (
        field,
      ) =>
        field.fieldId ===
        "F0002",
    );


  if (
    !field2
  ) {
    throw new Error(
      "F0002 summary is missing.",
    );
  }


  if (
    !field2.analyzed ||
    field2.candidateCount !==
      0
  ) {
    throw new Error(
      "F0002 should be an analyzed negative field.",
    );
  }


  const field4 =
    summary.fields.find(
      (
        field,
      ) =>
        field.fieldId ===
        "F0004",
    );


  if (
    !field4
  ) {
    throw new Error(
      "F0004 summary is missing.",
    );
  }


  if (
    field4.analyzed
  ) {
    throw new Error(
      "F0004 should remain unanalyzed.",
    );
  }


  /* =======================================================
     PIXEL LOCATION VALIDATION
     ======================================================= */

  const firstCandidate =
    summary.candidates[
      0
    ];


  if (
    !firstCandidate
  ) {
    throw new Error(
      "First candidate is missing.",
    );
  }


  if (
    firstCandidate.id !==
    "F0001-C001"
  ) {
    throw new Error(
      `Unexpected candidate ID "${firstCandidate.id}".`,
    );
  }


  /*
   * bbox:
   *
   * x1=100
   * x2=180
   *
   * center X = 140
   *
   * y1=200
   * y2=280
   *
   * center Y = 240
   */

  if (
    firstCandidate.location
      .centerXPx !==
      140 ||
    firstCandidate.location
      .centerYPx !==
      240
  ) {
    throw new Error(
      "Candidate pixel-center calculation is incorrect.",
    );
  }


  if (
    firstCandidate.location
      .imageWidthPx !==
      1600 ||
    firstCandidate.location
      .imageHeightPx !==
      1200
  ) {
    throw new Error(
      "Candidate image dimensions are incorrect.",
    );
  }


  /* =======================================================
     STAGE POSITION VALIDATION
     ======================================================= */

  if (
    firstCandidate.location
      .stageXUm !==
      0 ||
    firstCandidate.location
      .stageYUm !==
      0
  ) {
    throw new Error(
      "F0001 stage position is incorrect.",
    );
  }


  /*
   * 2 × 2 serpentine plan:
   *
   * F0001 → F0002
   *             ↓
   * F0004 ← F0003
   *
   * Therefore:
   *
   * F0001 = row0 col0 = 0,0
   * F0002 = row0 col1 = 500,0
   * F0003 = row1 col1 = 500,400
   * F0004 = row1 col0 = 0,400
   */

  const field3Candidate =
    summary.candidates.find(
      (
        candidate,
      ) =>
        candidate.location
          .fieldId ===
        "F0003",
    );


  if (
    !field3Candidate
  ) {
    throw new Error(
      "F0003 candidate is missing.",
    );
  }


  if (
    field3Candidate.location
      .stageXUm !==
      500 ||
    field3Candidate.location
      .stageYUm !==
      400
  ) {
    throw new Error(
      [
        "F0003 stage coordinates are incorrect.",
        `Received (${field3Candidate.location.stageXUm},`,
        `${field3Candidate.location.stageYUm}) µm.`,
      ].join(
        " ",
      ),
    );
  }


  /*
   * Pixel coordinates and microscope-stage
   * coordinates are deliberately NOT merged.
   *
   * A calibrated pixel-to-micron transformation
   * will be needed before that is scientifically
   * justified.
   */


  /* =======================================================
     SUCCESS
     ======================================================= */

  console.log(
    "",
  );

  console.log(
    "PASS: slide-level ML candidate aggregation works.",
  );
}


void run();