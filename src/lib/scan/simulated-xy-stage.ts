import type {
  ScanBounds,
  ScanCoordinate,
} from "./scan-types";

import type {
  XYStageController,
  XYStageMoveOptions,
} from "./xy-stage";


/* =========================================================
   CONFIG
   ========================================================= */

export type SimulatedXYStageConfig = {
  bounds:
    ScanBounds;

  home:
    ScanCoordinate;

  /**
   * Simulated XY travel speed.
   */
  speedUmPerSecond?:
    number;

  /**
   * Prevent extremely short moves from
   * resolving instantly.
   */
  minimumMoveDurationMs?:
    number;
};


const DEFAULT_SPEED_UM_PER_SECOND =
  5000;

const DEFAULT_MINIMUM_MOVE_MS =
  20;

const ABORT_CHECK_INTERVAL_MS =
  20;


/* =========================================================
   HELPERS
   ========================================================= */

function assertFinite(
  value:
    number,

  label:
    string,
): void {
  if (
    !Number.isFinite(
      value,
    )
  ) {
    throw new Error(
      `${label} must be a finite number.`,
    );
  }
}


function assertPositive(
  value:
    number,

  label:
    string,
): void {
  assertFinite(
    value,
    label,
  );

  if (
    value <=
    0
  ) {
    throw new Error(
      `${label} must be greater than zero.`,
    );
  }
}


function validateBounds(
  bounds:
    ScanBounds,
): void {
  assertFinite(
    bounds.minXUm,
    "bounds.minXUm",
  );

  assertFinite(
    bounds.maxXUm,
    "bounds.maxXUm",
  );

  assertFinite(
    bounds.minYUm,
    "bounds.minYUm",
  );

  assertFinite(
    bounds.maxYUm,
    "bounds.maxYUm",
  );


  if (
    bounds.minXUm >
    bounds.maxXUm
  ) {
    throw new Error(
      "Invalid XY stage bounds: minXUm > maxXUm.",
    );
  }


  if (
    bounds.minYUm >
    bounds.maxYUm
  ) {
    throw new Error(
      "Invalid XY stage bounds: minYUm > maxYUm.",
    );
  }
}


function validateCoordinate(
  coordinate:
    ScanCoordinate,

  bounds:
    ScanBounds,

  label:
    string,
): void {
  assertFinite(
    coordinate.xUm,
    `${label}.xUm`,
  );

  assertFinite(
    coordinate.yUm,
    `${label}.yUm`,
  );


  if (
    coordinate.xUm <
      bounds.minXUm ||
    coordinate.xUm >
      bounds.maxXUm ||
    coordinate.yUm <
      bounds.minYUm ||
    coordinate.yUm >
      bounds.maxYUm
  ) {
    throw new Error(
      [
        `${label} exceeds XY stage travel limits.`,
        `Requested=(${coordinate.xUm}, ${coordinate.yUm}) µm.`,
        `X=${bounds.minXUm}..${bounds.maxXUm} µm.`,
        `Y=${bounds.minYUm}..${bounds.maxYUm} µm.`,
      ].join(
        " ",
      ),
    );
  }
}


function createAbortError(
  message:
    string,
): Error {
  if (
    typeof DOMException !==
    "undefined"
  ) {
    return new DOMException(
      message,
      "AbortError",
    );
  }


  const error =
    new Error(
      message,
    );

  error.name =
    "AbortError";

  return error;
}


function delay(
  durationMs:
    number,
): Promise<void> {
  return new Promise(
    (
      resolve,
    ) => {
      setTimeout(
        resolve,
        durationMs,
      );
    },
  );
}


/* =========================================================
   SIMULATED XY STAGE
   ========================================================= */

export class SimulatedXYStage
implements XYStageController {
  readonly kind =
    "simulated" as const;


  private readonly bounds:
    ScanBounds;

  private readonly homePosition:
    ScanCoordinate;

  private readonly speedUmPerSecond:
    number;

  private readonly minimumMoveDurationMs:
    number;


  private connected =
    false;

  private moving =
    false;

  private position:
    ScanCoordinate;

  /**
   * Incrementing this value invalidates
   * any currently running move.
   */
  private operationGeneration =
    0;


  constructor(
    config:
      SimulatedXYStageConfig,
  ) {
    validateBounds(
      config.bounds,
    );

    validateCoordinate(
      config.home,
      config.bounds,
      "home",
    );


    const speed =
      config.speedUmPerSecond ??
      DEFAULT_SPEED_UM_PER_SECOND;

    const minimumMoveDurationMs =
      config.minimumMoveDurationMs ??
      DEFAULT_MINIMUM_MOVE_MS;


    assertPositive(
      speed,
      "speedUmPerSecond",
    );

    if (
      !Number.isFinite(
        minimumMoveDurationMs,
      ) ||
      minimumMoveDurationMs <
        0
    ) {
      throw new Error(
        "minimumMoveDurationMs must be zero or greater.",
      );
    }


    this.bounds = {
      ...config.bounds,
    };

    this.homePosition = {
      ...config.home,
    };

    this.position = {
      ...config.home,
    };

    this.speedUmPerSecond =
      speed;

    this.minimumMoveDurationMs =
      minimumMoveDurationMs;
  }


  /* =======================================================
     CONNECTION
     ======================================================= */

  async connect():
    Promise<void> {
    this.connected =
      true;
  }


  async disconnect():
    Promise<void> {
    await this.stop();

    this.connected =
      false;
  }


  isConnected():
    boolean {
    return this.connected;
  }


  isMoving():
    boolean {
    return this.moving;
  }


  /* =======================================================
     TELEMETRY
     ======================================================= */

  getPosition():
    ScanCoordinate {
    return {
      ...this.position,
    };
  }


  getBounds():
    ScanBounds {
    return {
      ...this.bounds,
    };
  }


  /* =======================================================
     MOVEMENT
     ======================================================= */

  async moveTo(
    target:
      ScanCoordinate,

    options:
      XYStageMoveOptions =
      {},
  ): Promise<ScanCoordinate> {
    this.assertConnected();


    validateCoordinate(
      target,
      this.bounds,
      "XY target",
    );


    if (
      options.signal
        ?.aborted
    ) {
      throw createAbortError(
        "XY movement aborted before start.",
      );
    }


    const start =
      this.getPosition();


    const deltaX =
      target.xUm -
      start.xUm;

    const deltaY =
      target.yUm -
      start.yUm;


    const distanceUm =
      Math.hypot(
        deltaX,
        deltaY,
      );


    if (
      distanceUm ===
      0
    ) {
      return this.getPosition();
    }


    const calculatedDurationMs =
      (
        distanceUm /
        this.speedUmPerSecond
      ) *
      1000;


    const moveDurationMs =
      Math.max(
        this.minimumMoveDurationMs,
        calculatedDurationMs,
      );


    const generation =
      ++this.operationGeneration;


    this.moving =
      true;


    const startedAt =
      Date.now();


    try {
      while (
        true
      ) {
        if (
          options.signal
            ?.aborted
        ) {
          throw createAbortError(
            "XY movement aborted.",
          );
        }


        if (
          generation !==
          this.operationGeneration
        ) {
          throw createAbortError(
            "XY movement stopped.",
          );
        }


        const elapsed =
          Date.now() -
          startedAt;


        if (
          elapsed >=
          moveDurationMs
        ) {
          break;
        }


        const remaining =
          moveDurationMs -
          elapsed;


        await delay(
          Math.min(
            ABORT_CHECK_INTERVAL_MS,
            remaining,
          ),
        );
      }


      if (
        generation !==
        this.operationGeneration
      ) {
        throw createAbortError(
          "XY movement stopped.",
        );
      }


      this.position = {
        xUm:
          target.xUm,

        yUm:
          target.yUm,
      };


      return this.getPosition();
    } finally {
      if (
        generation ===
        this.operationGeneration
      ) {
        this.moving =
          false;
      }
    }
  }


  /* =======================================================
     HOME
     ======================================================= */

  async home(
    options:
      XYStageMoveOptions =
      {},
  ): Promise<ScanCoordinate> {
    return this.moveTo(
      this.homePosition,
      options,
    );
  }


  /* =======================================================
     STOP
     ======================================================= */

  async stop():
    Promise<void> {
    this.operationGeneration +=
      1;

    this.moving =
      false;
  }


  /* =======================================================
     PRIVATE
     ======================================================= */

  private assertConnected():
    void {
    if (
      !this.connected
    ) {
      throw new Error(
        "XY stage is not connected.",
      );
    }
  }
}