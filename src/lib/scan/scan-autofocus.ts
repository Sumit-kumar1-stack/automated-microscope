import {
  runCoarseFineAutofocus,
  type AutofocusSample,
} from "../autofocus-engine";

import type {
  ScanField,
} from "./scan-types";


export type ScanAutofocusResult = {
  fieldId:
    string;

  bestZ:
    number;

  bestScore:
    number;

  samples:
    AutofocusSample[];

  durationMs:
    number;
};


export type ScanAutofocusAdapterConfig = {
  minZ:
    number;

  maxZ:
    number;

  coarseStartZ:
    number;

  coarseEndZ:
    number;

  coarseStepZ:
    number;

  fineRadiusZ:
    number;

  settleMs:
    number;

  initialZ:
    number;

  moveToZ:
    (
      z:
        number,

      signal:
        AbortSignal,
    ) => Promise<void>;

  measureFocus:
    (
      z:
        number,

      field:
        ScanField,
    ) => Promise<number>;

  onSample?:
    (
      field:
        ScanField,

      sample:
        AutofocusSample,
    ) => void;
};


export class ScanAutofocusAdapter {
  private currentZ:
    number;


  constructor(
    private readonly config:
      ScanAutofocusAdapterConfig,
  ) {
    this.currentZ =
      config.initialZ;
  }


  getCurrentZ():
    number {
    return this.currentZ;
  }


  async autofocusField(
    field:
      ScanField,

    signal:
      AbortSignal,
  ): Promise<ScanAutofocusResult> {
    const startedAt =
      Date.now();

    const samples:
      AutofocusSample[] =
        [];


    const result =
      await runCoarseFineAutofocus(
        {
          initialZ:
            this.currentZ,

          minZ:
            this.config.minZ,

          maxZ:
            this.config.maxZ,

          coarseStartZ:
            this.config.coarseStartZ,

          coarseEndZ:
            this.config.coarseEndZ,

          coarseStepZ:
            this.config.coarseStepZ,

          fineRadiusZ:
            this.config.fineRadiusZ,

          settleMs:
            this.config.settleMs,

          signal,

          moveTo:
            async (
              z,
              innerSignal,
            ) => {
              await this.config.moveToZ(
                z,
                innerSignal,
              );

              this.currentZ =
                z;
            },

          measure:
            async (
              z,
            ) => {
              return this.config.measureFocus(
                z,
                field,
              );
            },

          onSample:
            (
              sample,
            ) => {
              samples.push(
                sample,
              );

              this.config.onSample?.(
                field,
                sample,
              );
            },
        },
      );


    this.currentZ =
      result.bestZ;


    return {
      fieldId:
        field.id,

      bestZ:
        result.bestZ,

      bestScore:
        result.bestScore,

      samples,

      durationMs:
        Date.now() -
        startedAt,
    };
  }
}