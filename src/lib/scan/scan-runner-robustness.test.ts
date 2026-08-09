import {
  buildScanPlan,
  ScanRunner,
  SimulatedXYStage,
} from "./index";

import type {
  ScanPlan,
} from "./scan-types";


/* =========================================================
   HELPERS
   ========================================================= */

function createAbortError(
  message:
    string,
): Error {
  const error =
    new Error(
      message,
    );

  error.name =
    "AbortError";

  return error;
}


function abortableDelay(
  ms:
    number,

  signal:
    AbortSignal,
): Promise<void> {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      if (
        signal.aborted
      ) {
        reject(
          createAbortError(
            "Test operation aborted.",
          ),
        );

        return;
      }


      const timer =
        globalThis.setTimeout(
          () => {
            signal.removeEventListener(
              "abort",
              onAbort,
            );

            resolve();
          },
          ms,
        );


      const onAbort =
        () => {
          globalThis.clearTimeout(
            timer,
          );

          signal.removeEventListener(
            "abort",
            onAbort,
          );

          reject(
            createAbortError(
              "Test operation aborted.",
            ),
          );
        };


      signal.addEventListener(
        "abort",
        onAbort,
        {
          once:
            true,
        },
      );
    },
  );
}


function delay(
  ms:
    number,
): Promise<void> {
  return new Promise(
    (
      resolve,
    ) => {
      globalThis.setTimeout(
        resolve,
        ms,
      );
    },
  );
}


async function waitUntil(
  predicate:
    () => boolean,

  timeoutMs =
    2000,
): Promise<void> {
  const startedAt =
    Date.now();


  while (
    !predicate()
  ) {
    if (
      Date.now() -
      startedAt >
      timeoutMs
    ) {
      throw new Error(
        `Condition was not reached within ${timeoutMs} ms.`,
      );
    }


    await delay(
      5,
    );
  }
}


function createPlan(
  columns:
    number =
    3,

  originXUm:
    number =
    0,
): ScanPlan {
  return buildScanPlan(
    {
      rows:
        1,

      columns,

      originXUm,

      originYUm:
        0,

      stepXUm:
        500,

      stepYUm:
        400,

      serpentine:
        true,

      bounds: {
        minXUm:
          0,

        maxXUm:
          5000,

        minYUm:
          0,

        maxYUm:
          5000,
      },
    },
  );
}


function createFastStage():
  SimulatedXYStage {
  return new SimulatedXYStage(
    {
      bounds: {
        minXUm:
          0,

        maxXUm:
          5000,

        minYUm:
          0,

        maxYUm:
          5000,
      },

      home: {
        xUm:
          0,

        yUm:
          0,
      },

      speedUmPerSecond:
        100000,

      minimumMoveDurationMs:
        1,
    },
  );
}


/* =========================================================
   TEST 1
   PAUSE + RESUME
   ========================================================= */

async function testPauseResume():
  Promise<void> {
  console.log(
    "",
  );

  console.log(
    "TEST 1: PAUSE / RESUME",
  );


  const plan =
    createPlan(
      3,
    );


  const stage =
    createFastStage();


  await stage.connect();


  let pauseIssued =
    false;


  const runner =
    new ScanRunner(
      plan,
      stage,
      {
        autofocus:
          async (
            _field,
            signal,
          ) => {
            await abortableDelay(
              2,
              signal,
            );
          },

        capture:
          async (
            _field,
            signal,
          ) => {
            await abortableDelay(
              2,
              signal,
            );
          },

        analyze:
          async (
            _field,
            signal,
          ) => {
            await abortableDelay(
              2,
              signal,
            );
          },

        onStateChange:
          (
            snapshot,
          ) => {
            console.log(
              "STATE",
              snapshot.runStatus,
              snapshot.phase,
              snapshot.currentField
                ?.id ??
                "-",
            );


            /*
             * Pause just before F0001
             * capture begins.
             *
             * ScanRunner pause is
             * boundary-safe: the current
             * operation completes before
             * the machine enters PAUSED.
             */
            if (
              !pauseIssued &&
              snapshot.phase ===
                "capturing" &&
              snapshot.currentField
                ?.id ===
                "F0001"
            ) {
              pauseIssued =
                true;

              runner.pause();
            }
          },
      },
      {
        settleMs:
          1,
      },
    );


  const runPromise =
    runner.run();


  await waitUntil(
    () =>
      runner
        .getSnapshot()
        .runStatus ===
      "paused",
  );


  const paused =
    runner.getSnapshot();


  console.log(
    "PAUSED",
    {
      field:
        paused.currentField
          ?.id,

      resumePhase:
        paused.resumePhase,
    },
  );


  if (
    paused.runStatus !==
    "paused"
  ) {
    throw new Error(
      "Expected paused scan state.",
    );
  }


  if (
    paused.currentField
      ?.id !==
    "F0001"
  ) {
    throw new Error(
      "Expected F0001 to remain the current field while paused.",
    );
  }


  if (
    paused.resumePhase !==
    "capturing"
  ) {
    throw new Error(
      `Expected capturing resume phase, got "${paused.resumePhase}".`,
    );
  }


  const resumed =
    runner.resume();


  console.log(
    "RESUMED",
    resumed.phase,
  );


  const final =
    await runPromise;


  if (
    final.runStatus !==
    "completed"
  ) {
    throw new Error(
      `Pause/resume scan did not complete. status=${final.runStatus}`,
    );
  }


  if (
    final.completedFields !==
    3 ||
    final.failedFields !==
    0
  ) {
    throw new Error(
      "Pause/resume scan field totals are incorrect.",
    );
  }


  await stage.disconnect();


  console.log(
    "PASS: pause/resume",
  );
}


/* =========================================================
   TEST 2
   ABORT WHILE PAUSED
   ========================================================= */

async function testAbortWhilePaused():
  Promise<void> {
  console.log(
    "",
  );

  console.log(
    "TEST 2: ABORT WHILE PAUSED",
  );


  const plan =
    createPlan(
      3,
    );


  const stage =
    createFastStage();


  await stage.connect();


  let pauseIssued =
    false;


  const runner =
    new ScanRunner(
      plan,
      stage,
      {
        autofocus:
          async (
            _field,
            signal,
          ) => {
            await abortableDelay(
              2,
              signal,
            );
          },

        capture:
          async (
            _field,
            signal,
          ) => {
            await abortableDelay(
              2,
              signal,
            );
          },

        analyze:
          async (
            _field,
            signal,
          ) => {
            await abortableDelay(
              2,
              signal,
            );
          },

        onStateChange:
          (
            snapshot,
          ) => {
            if (
              !pauseIssued &&
              snapshot.phase ===
                "capturing" &&
              snapshot.currentField
                ?.id ===
                "F0001"
            ) {
              pauseIssued =
                true;

              runner.pause();
            }
          },
      },
      {
        settleMs:
          1,
      },
    );


  const runPromise =
    runner.run();


  await waitUntil(
    () =>
      runner
        .getSnapshot()
        .runStatus ===
      "paused",
  );


  console.log(
    "SCAN PAUSED",
  );


  await runner.abort();


  const final =
    await runPromise;


  console.log(
    "ABORT RESULT",
    {
      status:
        final.runStatus,

      completed:
        final.completedFields,

      failed:
        final.failedFields,

      skipped:
        final.skippedFields,
    },
  );


  if (
    final.runStatus !==
    "aborted"
  ) {
    throw new Error(
      `Expected aborted status, got "${final.runStatus}".`,
    );
  }


  if (
    final.skippedFields !==
    1
  ) {
    throw new Error(
      `Expected current field to be skipped on abort. skipped=${final.skippedFields}`,
    );
  }


  await stage.disconnect();


  console.log(
    "PASS: abort while paused",
  );
}


/* =========================================================
   TEST 3
   FIELD FAILURE + CONTINUE
   ========================================================= */

async function testFieldFailureContinue():
  Promise<void> {
  console.log(
    "",
  );

  console.log(
    "TEST 3: FIELD FAILURE / CONTINUE",
  );


  const plan =
    createPlan(
      4,
    );


  const stage =
    createFastStage();


  await stage.connect();


  const fieldErrors:
    string[] =
      [];


  const runner =
    new ScanRunner(
      plan,
      stage,
      {
        autofocus:
          async (
            _field,
            signal,
          ) => {
            await abortableDelay(
              1,
              signal,
            );
          },

        capture:
          async (
            _field,
            signal,
          ) => {
            await abortableDelay(
              1,
              signal,
            );
          },

        analyze:
          async (
            field,
            signal,
          ) => {
            await abortableDelay(
              1,
              signal,
            );


            if (
              field.id ===
              "F0002"
            ) {
              throw new Error(
                "Synthetic analysis failure.",
              );
            }
          },

        onFieldError:
          (
            field,
            error,
          ) => {
            const message =
              error instanceof
                Error
                ? error.message
                : String(
                    error,
                  );


            fieldErrors.push(
              `${field.id}:${message}`,
            );


            console.log(
              "EXPECTED FIELD ERROR",
              field.id,
              message,
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
    "CONTINUE RESULT",
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


  if (
    final.runStatus !==
    "completed"
  ) {
    throw new Error(
      "Continue-on-error scan should finish as completed.",
    );
  }


  if (
    final.completedFields !==
    3
  ) {
    throw new Error(
      `Expected 3 completed fields, got ${final.completedFields}.`,
    );
  }


  if (
    final.failedFields !==
    1
  ) {
    throw new Error(
      `Expected 1 failed field, got ${final.failedFields}.`,
    );
  }


  if (
    final.progressPercent !==
    100
  ) {
    throw new Error(
      `Expected 100% processed progress, got ${final.progressPercent}.`,
    );
  }


  const failedField =
    final.fields.find(
      (
        field,
      ) =>
        field.id ===
        "F0002",
    );


  if (
    failedField?.status !==
    "failed"
  ) {
    throw new Error(
      "F0002 should be marked failed.",
    );
  }


  if (
    fieldErrors.length !==
    1
  ) {
    throw new Error(
      `Expected one field error callback, got ${fieldErrors.length}.`,
    );
  }


  await stage.disconnect();


  console.log(
    "PASS: field failure continues scan",
  );
}


/* =========================================================
   TEST 4
   FIELD FAILURE + FAIL FAST
   ========================================================= */

async function testFailFast():
  Promise<void> {
  console.log(
    "",
  );

  console.log(
    "TEST 4: FIELD FAILURE / FAIL FAST",
  );


  const plan =
    createPlan(
      4,
    );


  const stage =
    createFastStage();


  await stage.connect();


  const runner =
    new ScanRunner(
      plan,
      stage,
      {
        autofocus:
          async (
            _field,
            signal,
          ) => {
            await abortableDelay(
              1,
              signal,
            );
          },

        capture:
          async (
            field,
            signal,
          ) => {
            await abortableDelay(
              1,
              signal,
            );


            if (
              field.id ===
              "F0002"
            ) {
              throw new Error(
                "Synthetic camera failure.",
              );
            }
          },

        analyze:
          async (
            _field,
            signal,
          ) => {
            await abortableDelay(
              1,
              signal,
            );
          },

        onFieldError:
          (
            field,
            error,
          ) => {
            console.log(
              "EXPECTED FAIL-FAST ERROR",
              field.id,
              error instanceof
                Error
                ? error.message
                : error,
            );
          },
      },
      {
        settleMs:
          1,

        continueOnFieldError:
          false,
      },
    );


  const final =
    await runner.run();


  console.log(
    "FAIL-FAST RESULT",
    {
      status:
        final.runStatus,

      completed:
        final.completedFields,

      failed:
        final.failedFields,

      processed:
        final.processedFields,

      progress:
        final.progressPercent,
    },
  );


  if (
    final.runStatus !==
    "failed"
  ) {
    throw new Error(
      `Expected failed run, got "${final.runStatus}".`,
    );
  }


  if (
    final.completedFields !==
    1
  ) {
    throw new Error(
      `Expected F0001 only to complete, got ${final.completedFields} completed fields.`,
    );
  }


  if (
    final.failedFields !==
    1
  ) {
    throw new Error(
      `Expected one failed field, got ${final.failedFields}.`,
    );
  }


  if (
    final.processedFields !==
    2
  ) {
    throw new Error(
      `Expected two processed fields, got ${final.processedFields}.`,
    );
  }


  if (
    Math.abs(
      final.progressPercent -
      50,
    ) >
    0.001
  ) {
    throw new Error(
      `Expected 50% progress, got ${final.progressPercent}.`,
    );
  }


  await stage.disconnect();


  console.log(
    "PASS: fail-fast behavior",
  );
}


/* =========================================================
   TEST 5
   ABORT DURING XY MOVEMENT
   ========================================================= */

async function testAbortDuringMovement():
  Promise<void> {
  console.log(
    "",
  );

  console.log(
    "TEST 5: ABORT DURING XY MOVEMENT",
  );


  /*
   * First field starts 1000 µm away
   * from home.
   *
   * At 1000 µm/sec this move would
   * take roughly one second, giving
   * the test time to abort it.
   */
  const plan =
    createPlan(
      2,
      1000,
    );


  const stage =
    new SimulatedXYStage(
      {
        bounds: {
          minXUm:
            0,

          maxXUm:
            5000,

          minYUm:
            0,

          maxYUm:
            5000,
        },

        home: {
          xUm:
            0,

          yUm:
            0,
        },

        speedUmPerSecond:
          1000,

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
            _field,
            signal,
          ) => {
            await abortableDelay(
              1,
              signal,
            );
          },

        capture:
          async (
            _field,
            signal,
          ) => {
            await abortableDelay(
              1,
              signal,
            );
          },

        analyze:
          async (
            _field,
            signal,
          ) => {
            await abortableDelay(
              1,
              signal,
            );
          },
      },
      {
        settleMs:
          1,
      },
    );


  const runPromise =
    runner.run();


  await waitUntil(
    () =>
      stage.isMoving(),
  );


  console.log(
    "STAGE MOVING",
    stage.getPosition(),
  );


  await delay(
    50,
  );


  await runner.abort();


  const final =
    await runPromise;


  console.log(
    "MOVEMENT ABORT RESULT",
    {
      status:
        final.runStatus,

      stageMoving:
        stage.isMoving(),

      position:
        stage.getPosition(),
    },
  );


  if (
    final.runStatus !==
    "aborted"
  ) {
    throw new Error(
      `Expected aborted scan, got "${final.runStatus}".`,
    );
  }


  if (
    stage.isMoving()
  ) {
    throw new Error(
      "Stage should not remain moving after abort.",
    );
  }


  await stage.disconnect();


  console.log(
    "PASS: abort during XY movement",
  );
}


/* =========================================================
   MAIN
   ========================================================= */

async function run():
  Promise<void> {
  console.log(
    "PHASE 6I - SCAN ROBUSTNESS TESTS",
  );


  await testPauseResume();

  await testAbortWhilePaused();

  await testFieldFailureContinue();

  await testFailFast();

  await testAbortDuringMovement();


  console.log(
    "",
  );

  console.log(
    "========================================",
  );

  console.log(
    "PASS: all scan robustness tests passed.",
  );

  console.log(
    "========================================",
  );
}


void run();