import {
  buildScanPlan,
  CallbackScanFrameSource,
  ScanAcquisitionManager,
} from "./index";


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


  const source =
    new CallbackScanFrameSource(
      "test",

      async (
        field,
        signal,
      ) => {
        if (
          signal.aborted
        ) {
          throw new Error(
            "Unexpected abort.",
          );
        }


        /*
         * We are testing the acquisition
         * contract here, not image decoding.
         *
         * Phase 6G will send real image
         * blobs into the ML analyzer.
         */
        const payload =
          [
            `field=${field.id}`,
            `x=${field.xUm}`,
            `y=${field.yUm}`,
          ].join(
            "\n",
          );


        const blob =
          new Blob(
            [
              payload,
            ],
            {
              type:
                "text/plain",
            },
          );


        return {
          fieldId:
            field.id,

          filename:
            `${field.id}.txt`,

          blob,

          mimeType:
            blob.type,

          width:
            900,

          height:
            560,

          capturedAtMs:
            Date.now(),

          sourceKind:
            "test",

          metadata: {
            xUm:
              field.xUm,

            yUm:
              field.yUm,

            sequence:
              field.sequence,
          },
        };
      },
    );


  const manager =
    new ScanAcquisitionManager(
      source,
    );


  const controller =
    new AbortController();


  for (
    const field
    of plan.fields
  ) {
    const frame =
      await manager.captureField(
        field,
        controller.signal,
      );


    console.log(
      "CAPTURED",
      frame.fieldId,
      frame.filename,
      `${frame.width}x${frame.height}`,
      `bytes=${frame.blob.size}`,
    );
  }


  console.log(
    "",
  );


  console.log(
    "FRAME COUNT",
    manager.getCapturedFieldCount(),
  );


  const third =
    manager.requireFrame(
      "F0003",
    );


  console.log(
    "F0003",
    {
      filename:
        third.filename,

      source:
        third.sourceKind,

      width:
        third.width,

      height:
        third.height,

      metadata:
        third.metadata,
    },
  );


  if (
    manager.getCapturedFieldCount() !==
    4
  ) {
    throw new Error(
      `Expected 4 captured frames, got ${manager.getCapturedFieldCount()}.`,
    );
  }


  if (
    !manager.hasFrame(
      "F0001",
    ) ||
    !manager.hasFrame(
      "F0004",
    )
  ) {
    throw new Error(
      "Expected captured scan fields are missing.",
    );
  }


  if (
    third.fieldId !==
    "F0003"
  ) {
    throw new Error(
      "Frame lookup returned the wrong field.",
    );
  }


  manager.clear();


  if (
    manager.getCapturedFieldCount() !==
    0
  ) {
    throw new Error(
      "Frame store did not clear.",
    );
  }


  console.log(
    "PASS: scan acquisition abstraction works.",
  );
}


void run();