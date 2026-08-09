import {
  ScanAutofocusAdapter,
} from "./scan-autofocus";

import type {
  ScanField,
} from "./scan-types";


const testField:
  ScanField = {
    id:
      "F0001",

    sequence:
      0,

    row:
      0,

    column:
      0,

    xUm:
      0,

    yUm:
      0,

    direction:
      "forward",
  };


async function run():
  Promise<void> {
  let currentZ =
    20;


  const optimalZ =
    47;


  const autofocus =
    new ScanAutofocusAdapter(
      {
        minZ:
          0,

        maxZ:
          100,

        coarseStartZ:
          10,

        coarseEndZ:
          90,

        coarseStepZ:
          10,

        fineRadiusZ:
          8,

        settleMs:
          0,

        initialZ:
          currentZ,

        moveToZ:
          async (
            z,
          ) => {
            currentZ =
              z;
          },

        measureFocus:
          async (
            z,
          ) => {
            /*
             * Deterministic synthetic
             * focus curve.
             *
             * Maximum score occurs near
             * optimalZ.
             */
            const error =
              z -
              optimalZ;

            return Math.max(
              0,
              1000 -
                error *
                  error,
            );
          },

        onSample:
          (
            field,
            sample,
          ) => {
            console.log(
              "SAMPLE",
              field.id,
              sample.phase,
              `Z=${sample.z}`,
              `score=${sample.score.toFixed(
                1,
              )}`,
            );
          },
      },
    );


  const controller =
    new AbortController();


  const result =
    await autofocus.autofocusField(
      testField,
      controller.signal,
    );


  console.log(
    "",
  );

  console.log(
    "RESULT",
    {
      field:
        result.fieldId,

      bestZ:
        result.bestZ,

      bestScore:
        result.bestScore,

      sampleCount:
        result.samples.length,

      durationMs:
        result.durationMs,
    },
  );


  if (
    Math.abs(
      result.bestZ -
        optimalZ,
    ) >
    2
  ) {
    throw new Error(
      `Autofocus missed expected optimum. bestZ=${result.bestZ}, expected≈${optimalZ}.`,
    );
  }


  if (
    autofocus.getCurrentZ() !==
    result.bestZ
  ) {
    throw new Error(
      "Autofocus adapter did not retain the final best Z position.",
    );
  }


  console.log(
    "PASS: scan autofocus adapter found the synthetic focus peak.",
  );
}


void run();