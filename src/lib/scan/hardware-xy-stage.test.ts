import {
  HardwareXYStage,
  MockXYCommandTransport,
} from "./index";


async function run():
  Promise<void> {
  console.log(
    "PHASE 6J - HARDWARE XY ADAPTER TEST",
  );


  const transport =
    new MockXYCommandTransport(
      {
        maxXUm:
          5000,

        maxYUm:
          5000,
      },
    );


  const stage =
    new HardwareXYStage(
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

        transport,

        requireHoming:
          true,

        requireEnabled:
          true,

        positionToleranceUm:
          5,
      },
    );


  /* =======================================================
     CONNECT
     ======================================================= */

  await stage.connect();


  console.log(
    "CONNECTED",
    stage.isConnected(),
  );


  if (
    !stage.isConnected()
  ) {
    throw new Error(
      "Hardware stage should be connected.",
    );
  }


  /* =======================================================
     MOVEMENT BEFORE HOMING MUST FAIL
     ======================================================= */

  let unhomedRejected =
    false;


  try {
    await stage.moveTo(
      {
        xUm:
          500,

        yUm:
          500,
      },
    );
  } catch (
    error
  ) {
    unhomedRejected =
      true;


    console.log(
      "EXPECTED UNHOMED REJECTION",
      error instanceof
        Error
        ? error.message
        : error,
    );
  }


  if (
    !unhomedRejected
  ) {
    throw new Error(
      "Movement before homing should have been rejected.",
    );
  }


  /* =======================================================
     ENABLE
     ======================================================= */

  await stage.enable();


  console.log(
    "ENABLED",
    stage
      .getHardwareState()
      ?.enabled,
  );


  /* =======================================================
     HOME
     ======================================================= */

  const home =
    await stage.home();


  console.log(
    "HOME",
    home,
  );


  if (
    home.xUm !==
      0 ||
    home.yUm !==
      0
  ) {
    throw new Error(
      "Home position should be 0,0.",
    );
  }


  if (
    !stage
      .getHardwareState()
      ?.homed
  ) {
    throw new Error(
      "Controller should report homed state.",
    );
  }


  /* =======================================================
     MOVE
     ======================================================= */

  const first =
    await stage.moveTo(
      {
        xUm:
          1500,

        yUm:
          800,
      },
    );


  console.log(
    "MOVE 1",
    first,
  );


  if (
    first.xUm !==
      1500 ||
    first.yUm !==
      800
  ) {
    throw new Error(
      "First hardware movement returned wrong coordinates.",
    );
  }


  const second =
    await stage.moveTo(
      {
        xUm:
          500,

        yUm:
          1200,
      },
    );


  console.log(
    "MOVE 2",
    second,
  );


  /* =======================================================
     SOFTWARE LIMIT
     ======================================================= */

  let limitRejected =
    false;


  try {
    await stage.moveTo(
      {
        xUm:
          6000,

        yUm:
          100,
      },
    );
  } catch (
    error
  ) {
    limitRejected =
      true;


    console.log(
      "EXPECTED SOFTWARE LIMIT",
      error instanceof
        Error
        ? error.message
        : error,
    );
  }


  if (
    !limitRejected
  ) {
    throw new Error(
      "Out-of-range XY movement should have been rejected.",
    );
  }


  /* =======================================================
     EMERGENCY STOP
     ======================================================= */

  transport
    .setEmergencyStop(
      true,
    );


  let estopRejected =
    false;


  try {
    await stage.moveTo(
      {
        xUm:
          1000,

        yUm:
          1000,
      },
    );
  } catch (
    error
  ) {
    estopRejected =
      true;


    console.log(
      "EXPECTED ESTOP REJECTION",
      error instanceof
        Error
        ? error.message
        : error,
    );
  }


  if (
    !estopRejected
  ) {
    throw new Error(
      "Movement should be rejected while emergency stop is active.",
    );
  }


  transport
    .setEmergencyStop(
      false,
    );


  await stage
    .refreshStatus();


  /* =======================================================
     DISABLE
     ======================================================= */

  await stage.disable();


  console.log(
    "DISABLED",
    !stage
      .getHardwareState()
      ?.enabled,
  );


  let disabledRejected =
    false;


  try {
    await stage.moveTo(
      {
        xUm:
          1000,

        yUm:
          1000,
      },
    );
  } catch (
    error
  ) {
    disabledRejected =
      true;


    console.log(
      "EXPECTED DRIVER-DISABLED REJECTION",
      error instanceof
        Error
        ? error.message
        : error,
    );
  }


  if (
    !disabledRejected
  ) {
    throw new Error(
      "Movement should be rejected while drivers are disabled.",
    );
  }


  /* =======================================================
     DISCONNECT
     ======================================================= */

  await stage.disconnect();


  console.log(
    "DISCONNECTED",
    !stage.isConnected(),
  );


  if (
    stage.isConnected()
  ) {
    throw new Error(
      "Hardware stage should be disconnected.",
    );
  }


  console.log(
    "",
  );


  console.log(
    "========================================",
  );

  console.log(
    "PASS: hardware XY stage adapter works.",
  );

  console.log(
    "========================================",
  );
}


void run();