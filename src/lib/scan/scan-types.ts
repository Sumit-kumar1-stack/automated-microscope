export type ScanDirection =
  | "forward"
  | "reverse";


export type ScanCoordinate = {
  xUm: number;
  yUm: number;
};


export type ScanBounds = {
  minXUm: number;
  maxXUm: number;

  minYUm: number;
  maxYUm: number;
};


export type ScanGridConfig = {
  rows: number;
  columns: number;

  originXUm: number;
  originYUm: number;

  stepXUm: number;
  stepYUm: number;

  /**
   * When enabled, alternate rows are
   * traversed in opposite directions.
   *
   * This reduces unnecessary XY travel.
   */
  serpentine?: boolean;

  /**
   * Optional software travel envelope.
   *
   * Physical limit switches and
   * controller-side limits remain
   * mandatory for real hardware.
   */
  bounds?: ScanBounds;
};


export type ScanField = {
  id: string;

  /**
   * Zero-based acquisition order.
   */
  sequence: number;

  /**
   * Logical grid position.
   */
  row: number;
  column: number;

  xUm: number;
  yUm: number;

  direction:
    ScanDirection;
};


export type ScanExtent = {
  minXUm: number;
  maxXUm: number;

  minYUm: number;
  maxYUm: number;
};


export type ScanPlan = {
  fields:
    ScanField[];

  totalFields:
    number;

  extent:
    ScanExtent;

  serpentine:
    boolean;
};


export type ScanFieldStatus =
  | "pending"
  | "moving"
  | "settling"
  | "autofocusing"
  | "capturing"
  | "analyzing"
  | "completed"
  | "failed"
  | "skipped";


export type ScanRunStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "aborted"
  | "failed";