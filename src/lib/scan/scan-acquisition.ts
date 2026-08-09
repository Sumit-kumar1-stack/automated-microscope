import type {
  ScanField,
} from "./scan-types";


export type ScanFrameSourceKind =
  | "simulation"
  | "camera"
  | "hardware"
  | "uploaded"
  | "test";


export type ScanFrameMetadataValue =
  | string
  | number
  | boolean
  | null;


export type ScanAcquiredFrame = {
  fieldId:
    string;

  filename:
    string;

  blob:
    Blob;

  mimeType:
    string;

  width:
    number;

  height:
    number;

  capturedAtMs:
    number;

  sourceKind:
    ScanFrameSourceKind;

  metadata?:
    Record<
      string,
      ScanFrameMetadataValue
    >;
};


export interface ScanFrameSource {
  readonly kind:
    ScanFrameSourceKind;

  capture(
    field:
      ScanField,

    signal:
      AbortSignal,
  ): Promise<ScanAcquiredFrame>;
}


/**
 * Generic adapter around an acquisition callback.
 *
 * This lets browser canvas capture, camera capture,
 * hardware capture and test acquisition all satisfy
 * the same scan contract.
 */
export class CallbackScanFrameSource
implements ScanFrameSource {
  constructor(
    readonly kind:
      ScanFrameSourceKind,

    private readonly captureCallback:
      (
        field:
          ScanField,

        signal:
          AbortSignal,
      ) => Promise<ScanAcquiredFrame>,
  ) {}


  async capture(
    field:
      ScanField,

    signal:
      AbortSignal,
  ): Promise<ScanAcquiredFrame> {
    if (
      signal.aborted
    ) {
      throw createAbortError(
        "Frame acquisition aborted before capture.",
      );
    }


    const frame =
      await this.captureCallback(
        field,
        signal,
      );


    if (
      signal.aborted
    ) {
      throw createAbortError(
        "Frame acquisition aborted.",
      );
    }


    validateFrame(
      field,
      frame,
    );


    return frame;
  }
}


export function validateFrame(
  field:
    ScanField,

  frame:
    ScanAcquiredFrame,
): void {
  if (
    frame.fieldId !==
    field.id
  ) {
    throw new Error(
      `Acquired frame belongs to "${frame.fieldId}" but current field is "${field.id}".`,
    );
  }


  if (
    !frame.filename.trim()
  ) {
    throw new Error(
      "Acquired frame filename cannot be empty.",
    );
  }


  if (
    !frame.mimeType.trim()
  ) {
    throw new Error(
      "Acquired frame MIME type cannot be empty.",
    );
  }


  if (
    !Number.isFinite(
      frame.width,
    ) ||
    frame.width <=
      0
  ) {
    throw new Error(
      "Acquired frame width must be greater than zero.",
    );
  }


  if (
    !Number.isFinite(
      frame.height,
    ) ||
    frame.height <=
      0
  ) {
    throw new Error(
      "Acquired frame height must be greater than zero.",
    );
  }


  if (
    !Number.isFinite(
      frame.capturedAtMs,
    )
  ) {
    throw new Error(
      "Acquired frame capturedAtMs must be finite.",
    );
  }


  if (
    frame.blob.size <=
    0
  ) {
    throw new Error(
      "Acquired frame blob is empty.",
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