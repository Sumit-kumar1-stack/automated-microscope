import {
  buildScanPlan,
  ScanRunner,
  SimulatedXYStage,
} from "./index";


function delay(
  ms:
    number,
): Promise<void> {
  return new Promise(
    (
      resolve,
    ) => {
      setTimeout(
        resolve,
        ms,
      );
    },
  );
}


async function run():
  Promise<void> {
  const plan =
    buildScanPlan(
      {
        rows: 3,

        columns: 4,

        originXUm: 0,
        originYUm: 0,

        stepXUm: 500,
        stepYUm: 400,

        serpentine:
          true,

        bounds: {
          minXUm: 0,
          maxXUm: 5000,

          minYUm: 0,
          maxYUm: 5000,
        },
      },
    );


  const stage =
    new SimulatedXYStage(
      {
        bounds: {
          minXUm: 0,
          maxXUm: 5000,

          minYUm: 0,
          maxYUm: 5000,
        },

        home: {
          xUm: 0,
          yUm: 0,
        },

        speedUmPerSecond:
          100000,

        minimumMoveDurationMs:
          1,
      },
    );


  await stage.connect();


  const runner =
    new ScanRunner(
      plan,
      stage,
      {
        autofocus:
          async (
            field,
          ) => {
            console.log(
              "AUTOFOCUS",
              field.id,
            );

            await delay(
              1,
            );
          },

        capture:
          async (
            field,
          ) => {
            console.log(
              "CAPTURE",
              field.id,
            );

            await delay(
              1,
            );
          },

        analyze:
          async (
            field,
          ) => {
            console.log(
              "ANALYZE",
              field.id,
            );

            await delay(
              1,
            );
          },

        onStateChange:
          (
            snapshot,
          ) => {
            const field =
              snapshot.currentField;

            console.log(
              [
                `STATUS=${snapshot.runStatus}`,
                `PHASE=${snapshot.phase}`,
                `FIELD=${field?.id ?? "-"}`,
                `PROGRESS=${snapshot.progressPercent.toFixed(
                  1,
                )}%`,
              ].join(
                " ",
              ),
            );
          },

        onFieldError:
          (
            field,
            error,
          ) => {
            console.error(
              "FIELD ERROR",
              field.id,
              error,
            );
          },
      },
      {
        settleMs:
          1,

        continueOnFieldError:
          true,
      },
    );


  const final =
    await runner.run();


  console.log(
    "",
  );

  console.log(
    "FINAL",
    {
      status:
        final.runStatus,

      total:
        final.totalFields,

      completed:
        final.completedFields,

      failed:
        final.failedFields,

      progress:
        final.progressPercent,
    },
  );


  console.log(
    "FINAL POSITION",
    stage.getPosition(),
  );


  await stage.disconnect();


  if (
    final.runStatus !==
    "completed"
  ) {
    throw new Error(
      "Expected completed scan.",
    );
  }


  if (
    final.completedFields !==
    12
  ) {
    throw new Error(
      `Expected 12 completed fields, got ${final.completedFields}.`,
    );
  }


  if (
    final.failedFields !==
    0
  ) {
    throw new Error(
      `Expected zero failed fields, got ${final.failedFields}.`,
    );
  }


  console.log(
    "PASS: simulated slide scan completed.",
  );
}


void run();