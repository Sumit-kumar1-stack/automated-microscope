import type {
  ScanBounds,
  ScanCoordinate,
} from "./scan-types";

import type {
  XYStageController,
  XYStageMoveOptions,
} from "./xy-stage";

import type {
  XYCommandTransport,
} from "./xy-command-transport";

import {
  buildDisableCommand,
  buildEnableCommand,
  buildHelloCommand,
  buildHomeCommand,
  buildMoveAbsoluteCommand,
  buildStatusCommand,
  buildStopCommand,
  parseHardwareResponse,
  type XYHardwareResponse,
  type XYHardwareState,
} from "./xy-hardware-protocol";


/* =========================================================
   CONFIG
   ========================================================= */

export type HardwareXYStageConfig = {
  bounds:
    ScanBounds;

  transport:
    XYCommandTransport;

  /**
   * Require physical controller homing
   * before arbitrary XY movement.
   */
  requireHoming?:
    boolean;

  /**
   * Reject movement whenever controller
   * reports motor drivers disabled.
   */
  requireEnabled?:
    boolean;

  /**
   * Maximum difference allowed between
   * requested and reported coordinates.
   */
  positionToleranceUm?:
    number;
};


const DEFAULT_POSITION_TOLERANCE_UM =
  5;


/* =========================================================
   HARDWARE XY STAGE
   ========================================================= */

export class HardwareXYStage
implements XYStageController {
  readonly kind =
    "hardware" as const;


  private readonly bounds:
    ScanBounds;

  private readonly transport:
    XYCommandTransport;

  private readonly requireHoming:
    boolean;

  private readonly requireEnabled:
    boolean;

  private readonly positionToleranceUm:
    number;


  private moving =
    false;


  private position:
    ScanCoordinate = {
      xUm:
        0,

      yUm:
        0,
    };


  private state:
    XYHardwareState | null =
      null;


  constructor(
    config:
      HardwareXYStageConfig,
  ) {
    validateBounds(
      config.bounds,
    );


    this.bounds = {
      ...config.bounds,
    };


    this.transport =
      config.transport;


    this.requireHoming =
      config.requireHoming ??
      true;


    this.requireEnabled =
      config.requireEnabled ??
      true;


    this.positionToleranceUm =
      config.positionToleranceUm ??
      DEFAULT_POSITION_TOLERANCE_UM;


    if (
      !Number.isFinite(
        this.positionToleranceUm,
      ) ||
      this.positionToleranceUm <
        0
    ) {
      throw new Error(
        "positionToleranceUm must be zero or greater.",
      );
    }
  }


  /* =======================================================
     CONNECTION
     ======================================================= */

  async connect():
    Promise<void> {
    if (
      this.transport
        .isConnected()
    ) {
      return;
    }


    await this.transport
      .connect();


    try {
      const hello =
        await this.send(
          buildHelloCommand(),
        );


      this.applyState(
        hello,
      );


      await this.refreshStatus();
    } catch (
      error
    ) {
      await this.transport
        .disconnect();

      throw error;
    }
  }


  async disconnect():
    Promise<void> {
    if (
      !this.transport
        .isConnected()
    ) {
      return;
    }


    try {
      await this.stop();
    } catch {
      /*
       * Continue disconnect even if
       * STOP communication fails.
       */
    }


    await this.transport
      .disconnect();


    this.moving =
      false;
  }


  isConnected():
    boolean {
    return this.transport
      .isConnected();
  }


  isMoving():
    boolean {
    return (
      this.moving ||
      this.state
        ?.moving ===
        true
    );
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


  getHardwareState():
    XYHardwareState | null {
    if (
      !this.state
    ) {
      return null;
    }


    return {
      ...this.state,
    };
  }


  async refreshStatus(
    signal?:
      AbortSignal,
  ): Promise<XYHardwareState> {
    this.assertConnected();


    const response =
      await this.send(
        buildStatusCommand(),
        signal,
      );


    this.applyState(
      response,
    );


    return {
      ...response.state,
    };
  }


  /* =======================================================
     ENABLE / DISABLE
     ======================================================= */

  async enable(
    signal?:
      AbortSignal,
  ): Promise<void> {
    this.assertConnected();


    const response =
      await this.send(
        buildEnableCommand(),
        signal,
      );


    this.applyState(
      response,
    );


    if (
      !response.state
        .enabled
    ) {
      throw new Error(
        "XY controller did not enable motor drivers.",
      );
    }
  }


  async disable(
    signal?:
      AbortSignal,
  ): Promise<void> {
    this.assertConnected();


    const response =
      await this.send(
        buildDisableCommand(),
        signal,
      );


    this.applyState(
      response,
    );
  }


  /* =======================================================
     MOVE
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
        "XY hardware movement aborted before start.",
      );
    }


    const currentState =
      await this.refreshStatus(
        options.signal,
      );


    this.assertSafeToMove(
      currentState,
    );


    this.moving =
      true;


    try {
      const response =
        await this.send(
          buildMoveAbsoluteCommand(
            target,
          ),
          options.signal,
        );


      this.applyState(
        response,
      );


      this.assertSafeState(
        response.state,
      );


      const deltaX =
        Math.abs(
          response.state.xUm -
          target.xUm,
        );


      const deltaY =
        Math.abs(
          response.state.yUm -
          target.yUm,
        );


      if (
        deltaX >
          this.positionToleranceUm ||
        deltaY >
          this.positionToleranceUm
      ) {
        throw new Error(
          [
            "XY controller position verification failed.",
            `Requested=(${target.xUm}, ${target.yUm}) µm.`,
            `Reported=(${response.state.xUm}, ${response.state.yUm}) µm.`,
          ].join(
            " ",
          ),
        );
      }


      return this.getPosition();
    } catch (
      error
    ) {
      /*
       * Attempt a hardware STOP if the
       * operation was aborted or failed.
       */
      try {
        await this.stop();
      } catch {
        // Preserve original failure.
      }


      throw error;
    } finally {
      this.moving =
        false;
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
    this.assertConnected();


    if (
      options.signal
        ?.aborted
    ) {
      throw createAbortError(
        "XY homing aborted before start.",
      );
    }


    const currentState =
      await this.refreshStatus(
        options.signal,
      );


    if (
      currentState.estop
    ) {
      throw new Error(
        "Cannot home XY stage while emergency stop is active.",
      );
    }


    if (
      this.requireEnabled &&
      !currentState.enabled
    ) {
      throw new Error(
        "Cannot home XY stage while motor drivers are disabled.",
      );
    }


    this.moving =
      true;


    try {
      const response =
        await this.send(
          buildHomeCommand(),
          options.signal,
        );


      this.applyState(
        response,
      );


      if (
        !response.state
          .homed
      ) {
        throw new Error(
          "XY controller completed HOME without reporting HOMED=1.",
        );
      }


      this.assertSafeState(
        response.state,
      );


      return this.getPosition();
    } catch (
      error
    ) {
      try {
        await this.stop();
      } catch {
        // Preserve original failure.
      }


      throw error;
    } finally {
      this.moving =
        false;
    }
  }


  /* =======================================================
     STOP
     ======================================================= */

  async stop():
    Promise<void> {
    if (
      !this.transport
        .isConnected()
    ) {
      this.moving =
        false;

      return;
    }


    try {
      const response =
        await this.send(
          buildStopCommand(),
        );


      this.applyState(
        response,
      );
    } finally {
      this.moving =
        false;
    }
  }


  /* =======================================================
     PRIVATE SAFETY
     ======================================================= */

  private assertConnected():
    void {
    if (
      !this.transport
        .isConnected()
    ) {
      throw new Error(
        "XY hardware controller is not connected.",
      );
    }
  }


  private assertSafeToMove(
    state:
      XYHardwareState,
  ): void {
    this.assertSafeState(
      state,
    );


    if (
      this.requireHoming &&
      !state.homed
    ) {
      throw new Error(
        "XY movement rejected: stage has not been homed.",
      );
    }


    if (
      this.requireEnabled &&
      !state.enabled
    ) {
      throw new Error(
        "XY movement rejected: motor drivers are disabled.",
      );
    }
  }


  private assertSafeState(
    state:
      XYHardwareState,
  ): void {
    if (
      state.estop
    ) {
      throw new Error(
        "XY controller emergency stop is active.",
      );
    }


    validateCoordinate(
      {
        xUm:
          state.xUm,

        yUm:
          state.yUm,
      },
      this.bounds,
      "Reported XY position",
    );
  }


  private applyState(
    response:
      Extract<
        XYHardwareResponse,
        {
          ok:
            true;
        }
      >,
  ): void {
    this.state = {
      ...response.state,
    };


    this.position = {
      xUm:
        response.state.xUm,

      yUm:
        response.state.yUm,
    };


    this.moving =
      response.state.moving;
  }


  private async send(
    command:
      string,

    signal?:
      AbortSignal,
  ): Promise<
    Extract<
      XYHardwareResponse,
      {
        ok:
          true;
      }
    >
  > {
    const line =
      await this.transport
        .request(
          command,
          signal,
        );


    const response =
      parseHardwareResponse(
        line,
      );


    if (
      !response.ok
    ) {
      throw new Error(
        `XY controller error ${response.code}: ${response.message}`,
      );
    }


    return response;
  }
}


/* =========================================================
   VALIDATION HELPERS
   ========================================================= */

function validateBounds(
  bounds:
    ScanBounds,
): void {
  const values =
    [
      bounds.minXUm,
      bounds.maxXUm,
      bounds.minYUm,
      bounds.maxYUm,
    ];


  if (
    values.some(
      (
        value,
      ) =>
        !Number.isFinite(
          value,
        ),
    )
  ) {
    throw new Error(
      "XY hardware bounds must contain finite numbers.",
    );
  }


  if (
    bounds.minXUm >
      bounds.maxXUm ||
    bounds.minYUm >
      bounds.maxYUm
  ) {
    throw new Error(
      "Invalid XY hardware travel bounds.",
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
  if (
    !Number.isFinite(
      coordinate.xUm,
    ) ||
    !Number.isFinite(
      coordinate.yUm,
    )
  ) {
    throw new Error(
      `${label} must contain finite coordinates.`,
    );
  }


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
        `${label} exceeds configured XY travel limits.`,
        `Position=(${coordinate.xUm}, ${coordinate.yUm}) µm.`,
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
  const error =
    new Error(
      message,
    );


  error.name =
    "AbortError";


  return error;
}