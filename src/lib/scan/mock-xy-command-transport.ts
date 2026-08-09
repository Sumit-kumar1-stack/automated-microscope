import type {
  XYCommandTransport,
} from "./xy-command-transport";


export type MockXYTransportConfig = {
  maxXUm:
    number;

  maxYUm:
    number;
};


export class MockXYCommandTransport
implements XYCommandTransport {
  private connected =
    false;

  private xUm =
    0;

  private yUm =
    0;

  private homed =
    false;

  private enabled =
    false;

  private estop =
    false;


  constructor(
    private readonly config:
      MockXYTransportConfig,
  ) {}


  async connect():
    Promise<void> {
    this.connected =
      true;
  }


  async disconnect():
    Promise<void> {
    this.connected =
      false;
  }


  isConnected():
    boolean {
    return this.connected;
  }


  setEmergencyStop(
    active:
      boolean,
  ): void {
    this.estop =
      active;
  }


  async request(
    command:
      string,

    signal?:
      AbortSignal,
  ): Promise<string> {
    if (
      !this.connected
    ) {
      throw new Error(
        "Mock XY controller is disconnected.",
      );
    }


    if (
      signal?.aborted
    ) {
      const error =
        new Error(
          "Mock controller command aborted.",
        );

      error.name =
        "AbortError";

      throw error;
    }


    const parts =
      command
        .trim()
        .split(
          /\s+/,
        );


    const operation =
      parts[
        0
      ];


    switch (
      operation
    ) {
      case "HELLO":
        return this.ok(
          "HELLO",
        );


      case "STATUS":
        return this.ok(
          "STATUS",
        );


      case "ENABLE":
        this.enabled =
          true;

        return this.ok(
          "ENABLE",
        );


      case "DISABLE":
        this.enabled =
          false;

        return this.ok(
          "DISABLE",
        );


      case "HOME":
        if (
          this.estop
        ) {
          return this.error(
            "ESTOP_ACTIVE",
            "emergency_stop_active",
          );
        }


        if (
          !this.enabled
        ) {
          return this.error(
            "DRIVER_DISABLED",
            "motor_driver_disabled",
          );
        }


        this.xUm =
          0;

        this.yUm =
          0;

        this.homed =
          true;


        return this.ok(
          "HOME",
        );


      case "MOVE_ABS": {
        if (
          this.estop
        ) {
          return this.error(
            "ESTOP_ACTIVE",
            "emergency_stop_active",
          );
        }


        if (
          !this.enabled
        ) {
          return this.error(
            "DRIVER_DISABLED",
            "motor_driver_disabled",
          );
        }


        if (
          !this.homed
        ) {
          return this.error(
            "NOT_HOMED",
            "stage_not_homed",
          );
        }


        const x =
          Number(
            parts[
              1
            ],
          );

        const y =
          Number(
            parts[
              2
            ],
          );


        if (
          !Number.isFinite(
            x,
          ) ||
          !Number.isFinite(
            y,
          )
        ) {
          return this.error(
            "BAD_COMMAND",
            "invalid_coordinates",
          );
        }


        if (
          x <
            0 ||
          x >
            this.config.maxXUm ||
          y <
            0 ||
          y >
            this.config.maxYUm
        ) {
          return this.error(
            "LIMIT",
            "target_outside_limit",
          );
        }


        this.xUm =
          x;

        this.yUm =
          y;


        return this.ok(
          "MOVE_ABS",
        );
      }


      case "STOP":
        return this.ok(
          "STOP",
        );


      default:
        return this.error(
          "UNKNOWN_COMMAND",
          "unsupported_command",
        );
    }
  }


  private ok(
    command:
      string,
  ): string {
    return [
      "OK",
      command,
      `X=${this.xUm}`,
      `Y=${this.yUm}`,
      "MOVING=0",
      `HOMED=${this.homed ? 1 : 0}`,
      `ESTOP=${this.estop ? 1 : 0}`,
      `ENABLED=${this.enabled ? 1 : 0}`,
    ].join(
      " ",
    );
  }


  private error(
    code:
      string,

    message:
      string,
  ): string {
    return [
      "ERR",
      `CODE=${code}`,
      `MESSAGE=${message}`,
    ].join(
      " ",
    );
  }
}