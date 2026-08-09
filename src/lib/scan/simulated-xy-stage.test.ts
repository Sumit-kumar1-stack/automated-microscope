import {
  SimulatedXYStage,
} from "./simulated-xy-stage";


async function run():
  Promise<void> {
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


  console.log(
    "CONNECTED",
    stage.isConnected(),
  );


  console.log(
    "START",
    stage.getPosition(),
  );


  const first =
    await stage.moveTo(
      {
        xUm: 1500,
        yUm: 400,
      },
    );


  console.log(
    "MOVE 1",
    first,
  );


  const second =
    await stage.moveTo(
      {
        xUm: 500,
        yUm: 800,
      },
    );


  console.log(
    "MOVE 2",
    second,
  );


  const home =
    await stage.home();


  console.log(
    "HOME",
    home,
  );


  try {
    await stage.moveTo(
      {
        xUm: 6000,
        yUm: 100,
      },
    );

    throw new Error(
      "Expected travel-limit rejection.",
    );
  } catch (
    error
  ) {
    console.log(
      "LIMIT TEST",
      error instanceof Error
        ? error.message
        : error,
    );
  }


  await stage.disconnect();


  console.log(
    "DISCONNECTED",
    !stage.isConnected(),
  );
}


void run();