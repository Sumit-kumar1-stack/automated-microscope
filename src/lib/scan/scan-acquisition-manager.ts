import type {
  ScanAcquiredFrame,
  ScanFrameSource,
} from "./scan-acquisition";

import type {
  ScanField,
} from "./scan-types";


export class ScanAcquisitionManager {
  private readonly frames =
    new Map<
      string,
      ScanAcquiredFrame
    >();


  constructor(
    private readonly source:
      ScanFrameSource,
  ) {}


  getSource():
    ScanFrameSource {
    return this.source;
  }


  async captureField(
    field:
      ScanField,

    signal:
      AbortSignal,
  ): Promise<ScanAcquiredFrame> {
    const frame =
      await this.source.capture(
        field,
        signal,
      );


    this.frames.set(
      field.id,
      frame,
    );


    return frame;
  }


  getFrame(
    fieldId:
      string,
  ): ScanAcquiredFrame | null {
    return (
      this.frames.get(
        fieldId,
      ) ??
      null
    );
  }


  requireFrame(
    fieldId:
      string,
  ): ScanAcquiredFrame {
    const frame =
      this.getFrame(
        fieldId,
      );


    if (
      !frame
    ) {
      throw new Error(
        `No acquired frame exists for scan field "${fieldId}".`,
      );
    }


    return frame;
  }


  hasFrame(
    fieldId:
      string,
  ): boolean {
    return this.frames.has(
      fieldId,
    );
  }


  listFrames():
    ScanAcquiredFrame[] {
    return [
      ...this.frames.values(),
    ];
  }


  getCapturedFieldCount():
    number {
    return this.frames.size;
  }


  removeFrame(
    fieldId:
      string,
  ): boolean {
    return this.frames.delete(
      fieldId,
    );
  }


  clear():
    void {
    this.frames.clear();
  }
}