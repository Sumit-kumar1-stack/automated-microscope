import type {
  ScanBounds,
  ScanCoordinate,
} from "./scan-types";


export type XYStageKind =
  | "simulated"
  | "hardware";


export type XYStageMoveOptions = {
  signal?: AbortSignal;
};


export interface XYStageController {
  readonly kind:
    XYStageKind;

  connect():
    Promise<void>;

  disconnect():
    Promise<void>;

  isConnected():
    boolean;

  isMoving():
    boolean;

  getPosition():
    ScanCoordinate;

  getBounds():
    ScanBounds;

  moveTo(
    target:
      ScanCoordinate,

    options?:
      XYStageMoveOptions,
  ): Promise<ScanCoordinate>;

  home(
    options?:
      XYStageMoveOptions,
  ): Promise<ScanCoordinate>;

  stop():
    Promise<void>;
}