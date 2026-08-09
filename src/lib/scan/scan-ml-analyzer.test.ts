import {
  readFile,
} from "node:fs/promises";

import {
  basename,
} from "node:path";

import {
  HttpScanMlAnalyzer,
  ScanMlResultStore,
} from "./index";

import type {
  ScanAcquiredFrame,
} from "./scan-acquisition";


async function run():
  Promise<void> {
  const imagePath =
    "research/malaria-validation/data/yolo-binary-full/images/val/005e60b6-77b8-458c-b57c-bfe0c7e7df78.png";


  const bytes =
    await readFile(
      imagePath,
    );


  const blob =
    new Blob(
      [
        bytes,
      ],
      {
        type:
          "image/png",
      },
    );


  const frame:
    ScanAcquiredFrame = {
      fieldId:
        "F0001",

      filename:
        basename(
          imagePath,
        ),

      blob,

      mimeType:
        "image/png",

      width:
        1600,

      height:
        1200,

      capturedAtMs:
        Date.now(),

      sourceKind:
        "test",

      metadata: {
        dataset:
          "BBBC041",

        purpose:
          "known-positive regression",
      },
    };


  const analyzer =
    new HttpScanMlAnalyzer(
      {
        baseUrl:
          "http://127.0.0.1:8000",

        timeoutMs:
          30_000,
      },
    );


  const store =
    new ScanMlResultStore();


  const controller =
    new AbortController();


  console.log(
    "ANALYZING",
    frame.fieldId,
    frame.filename,
  );


  const result =
    await analyzer.analyze(
      frame,
      controller.signal,
    );


  store.set(
    result,
  );


  console.log(
    "",
  );


  console.log(
    "RESULT",
    {
      field:
        result.fieldId,

      image:
        `${result.inference.image.width}x${result.inference.image.height}`,

      candidates:
        result.inference
          .candidates.length,

      durationMs:
        result.durationMs,
    },
  );


  for (
    const candidate
    of result.inference
      .candidates
  ) {
    console.log(
      "CANDIDATE",
      {
        stage:
          candidate.stage,

        detector:
          Number(
            candidate
              .detector_confidence
              .toFixed(
                4,
              ),
          ),

        classifier:
          Number(
            candidate
              .stage_confidence
              .toFixed(
                4,
              ),
          ),

        bbox:
          candidate.bbox,
      },
    );
  }


  const stages =
    result.inference
      .candidates
      .map(
        (
          candidate,
        ) =>
          candidate.stage,
      );


  if (
    result.inference.image
      .width !==
      1600 ||
    result.inference.image
      .height !==
      1200
  ) {
    throw new Error(
      "Expected original BBBC041 image dimensions 1600x1200.",
    );
  }


  if (
    result.inference
      .candidates.length !==
    2
  ) {
    throw new Error(
      `Expected 2 known-positive candidates, received ${result.inference.candidates.length}.`,
    );
  }


  if (
    !stages.includes(
      "ring",
    )
  ) {
    throw new Error(
      "Expected ring candidate was not detected.",
    );
  }


  if (
    !stages.includes(
      "trophozoite",
    )
  ) {
    throw new Error(
      "Expected trophozoite candidate was not detected.",
    );
  }


  if (
    store.getFieldCount() !==
    1
  ) {
    throw new Error(
      "Expected one analyzed scan field.",
    );
  }


  if (
    store.getCandidateCount() !==
    2
  ) {
    throw new Error(
      "Expected two aggregated ML candidates.",
    );
  }


  console.log(
    "",
  );

  console.log(
    "STORE",
    {
      fields:
        store.getFieldCount(),

      candidates:
        store.getCandidateCount(),
    },
  );


  console.log(
    "PASS: scan field ML inference works against the frozen Docker service.",
  );
}


void run();