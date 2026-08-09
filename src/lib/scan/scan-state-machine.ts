import type {
  ScanField,
  ScanFieldStatus,
  ScanPlan,
  ScanRunStatus,
} from "./scan-types";


/* =========================================================
   EXECUTION TYPES
   ========================================================= */

export type ActiveScanPhase =
  | "moving"
  | "settling"
  | "autofocusing"
  | "capturing"
  | "analyzing";


export type ScanExecutionPhase =
  | "idle"
  | ActiveScanPhase
  | "paused"
  | "completed"
  | "aborted"
  | "failed";


export type ScanFieldRuntime =
  ScanField & {
    status:
      ScanFieldStatus;

    startedAtMs:
      number | null;

    completedAtMs:
      number | null;

    error:
      string | null;
  };


export type ScanMachineSnapshot = {
  runStatus:
    ScanRunStatus;

  phase:
    ScanExecutionPhase;

  resumePhase:
    ActiveScanPhase | null;

  currentFieldIndex:
    number | null;

  currentField:
    ScanFieldRuntime | null;

  fields:
    ScanFieldRuntime[];

  totalFields:
    number;

  processedFields:
    number;

  completedFields:
    number;

  failedFields:
    number;

  skippedFields:
    number;

  progressPercent:
    number;

  startedAtMs:
    number | null;

  completedAtMs:
    number | null;

  pausedAtMs:
    number | null;

  lastError:
    string | null;
};


export type FailFieldOptions = {
  /**
   * true:
   * mark this field failed and continue
   * to the next field.
   *
   * false:
   * fail the entire scan run.
   */
  continueScan?:
    boolean;
};


/* =========================================================
   INTERNAL STATE
   ========================================================= */

type InternalState = {
  runStatus:
    ScanRunStatus;

  phase:
    ScanExecutionPhase;

  resumePhase:
    ActiveScanPhase | null;

  currentFieldIndex:
    number | null;

  fields:
    ScanFieldRuntime[];

  startedAtMs:
    number | null;

  completedAtMs:
    number | null;

  pausedAtMs:
    number | null;

  lastError:
    string | null;
};


/* =========================================================
   PHASE RULES
   ========================================================= */

const NEXT_PHASE:
  Record<
    ActiveScanPhase,
    ActiveScanPhase | null
  > = {
    moving:
      "settling",

    settling:
      "autofocusing",

    autofocusing:
      "capturing",

    capturing:
      "analyzing",

    analyzing:
      null,
  };


const FIELD_STATUS_BY_PHASE:
  Record<
    ActiveScanPhase,
    ScanFieldStatus
  > = {
    moving:
      "moving",

    settling:
      "settling",

    autofocusing:
      "autofocusing",

    capturing:
      "capturing",

    analyzing:
      "analyzing",
  };


/* =========================================================
   HELPERS
   ========================================================= */

function cloneField(
  field:
    ScanFieldRuntime,
): ScanFieldRuntime {
  return {
    ...field,
  };
}


function isActivePhase(
  phase:
    ScanExecutionPhase,
): phase is ActiveScanPhase {
  return (
    phase ===
      "moving" ||
    phase ===
      "settling" ||
    phase ===
      "autofocusing" ||
    phase ===
      "capturing" ||
    phase ===
      "analyzing"
  );
}


function createRuntimeFields(
  plan:
    ScanPlan,
): ScanFieldRuntime[] {
  return plan.fields.map(
    (
      field,
    ) => ({
      ...field,

      status:
        "pending",

      startedAtMs:
        null,

      completedAtMs:
        null,

      error:
        null,
    }),
  );
}


/* =========================================================
   SCAN STATE MACHINE
   ========================================================= */

export class ScanStateMachine {
  private state:
    InternalState;


  constructor(
    plan:
      ScanPlan,
  ) {
    if (
      plan.fields.length ===
      0
    ) {
      throw new Error(
        "Cannot create a scan state machine from an empty scan plan.",
      );
    }


    this.state = {
      runStatus:
        "idle",

      phase:
        "idle",

      resumePhase:
        null,

      currentFieldIndex:
        null,

      fields:
        createRuntimeFields(
          plan,
        ),

      startedAtMs:
        null,

      completedAtMs:
        null,

      pausedAtMs:
        null,

      lastError:
        null,
    };
  }


  /* =======================================================
     READ STATE
     ======================================================= */

  getSnapshot():
    ScanMachineSnapshot {
    const fields =
      this.state.fields.map(
        cloneField,
      );


    const completedFields =
      fields.filter(
        (
          field,
        ) =>
          field.status ===
          "completed",
      ).length;


    const failedFields =
      fields.filter(
        (
          field,
        ) =>
          field.status ===
          "failed",
      ).length;


    const skippedFields =
      fields.filter(
        (
          field,
        ) =>
          field.status ===
          "skipped",
      ).length;


    const processedFields =
      completedFields +
      failedFields +
      skippedFields;


    const totalFields =
      fields.length;


    const progressPercent =
      totalFields >
      0
        ? (
            processedFields /
            totalFields
          ) *
          100
        : 0;


    const currentField =
      this.state
        .currentFieldIndex ===
      null
        ? null
        : fields[
            this.state
              .currentFieldIndex
          ] ??
          null;


    return {
      runStatus:
        this.state.runStatus,

      phase:
        this.state.phase,

      resumePhase:
        this.state.resumePhase,

      currentFieldIndex:
        this.state
          .currentFieldIndex,

      currentField,

      fields,

      totalFields,

      processedFields,

      completedFields,

      failedFields,

      skippedFields,

      progressPercent,

      startedAtMs:
        this.state.startedAtMs,

      completedAtMs:
        this.state.completedAtMs,

      pausedAtMs:
        this.state.pausedAtMs,

      lastError:
        this.state.lastError,
    };
  }


  getCurrentField():
    ScanFieldRuntime | null {
    const index =
      this.state
        .currentFieldIndex;


    if (
      index ===
      null
    ) {
      return null;
    }


    const field =
      this.state.fields[
        index
      ];


    return field
      ? cloneField(
          field,
        )
      : null;
  }


  /* =======================================================
     START
     ======================================================= */

  start(
    nowMs:
      number =
      Date.now(),
  ): ScanMachineSnapshot {
    if (
      this.state.runStatus !==
      "idle"
    ) {
      throw new Error(
        `Scan cannot start from status "${this.state.runStatus}".`,
      );
    }


    this.state.runStatus =
      "running";

    this.state.phase =
      "moving";

    this.state.startedAtMs =
      nowMs;

    this.state.completedAtMs =
      null;

    this.state.pausedAtMs =
      null;

    this.state.lastError =
      null;

    this.state.currentFieldIndex =
      0;


    this.markCurrentFieldPhase(
      "moving",
      nowMs,
    );


    return this.getSnapshot();
  }


  /* =======================================================
     NORMAL PHASE TRANSITION
     ======================================================= */

  transitionTo(
    nextPhase:
      ActiveScanPhase,

    nowMs:
      number =
      Date.now(),
  ): ScanMachineSnapshot {
    this.assertRunning();


    if (
      !isActivePhase(
        this.state.phase,
      )
    ) {
      throw new Error(
        `Cannot transition from phase "${this.state.phase}".`,
      );
    }


    const expected =
      NEXT_PHASE[
        this.state.phase
      ];


    if (
      expected ===
      null
    ) {
      throw new Error(
        `Phase "${this.state.phase}" must complete the current field instead of transitioning.`,
      );
    }


    if (
      nextPhase !==
      expected
    ) {
      throw new Error(
        `Invalid scan transition: "${this.state.phase}" → "${nextPhase}". Expected "${expected}".`,
      );
    }


    this.state.phase =
      nextPhase;


    this.markCurrentFieldPhase(
      nextPhase,
      nowMs,
    );


    return this.getSnapshot();
  }


  /* =======================================================
     CONVENIENCE TRANSITIONS
     ======================================================= */

  movementCompleted(
    nowMs:
      number =
      Date.now(),
  ): ScanMachineSnapshot {
    return this.transitionTo(
      "settling",
      nowMs,
    );
  }


  settlingCompleted(
    nowMs:
      number =
      Date.now(),
  ): ScanMachineSnapshot {
    return this.transitionTo(
      "autofocusing",
      nowMs,
    );
  }


  autofocusCompleted(
    nowMs:
      number =
      Date.now(),
  ): ScanMachineSnapshot {
    return this.transitionTo(
      "capturing",
      nowMs,
    );
  }


  captureCompleted(
    nowMs:
      number =
      Date.now(),
  ): ScanMachineSnapshot {
    return this.transitionTo(
      "analyzing",
      nowMs,
    );
  }


  /* =======================================================
     FIELD COMPLETE
     ======================================================= */

  analysisCompleted(
    nowMs:
      number =
      Date.now(),
  ): ScanMachineSnapshot {
    this.assertRunning();


    if (
      this.state.phase !==
      "analyzing"
    ) {
      throw new Error(
        `Cannot complete analysis while phase is "${this.state.phase}".`,
      );
    }


    const field =
      this.requireCurrentField();


    field.status =
      "completed";

    field.completedAtMs =
      nowMs;

    field.error =
      null;


    return this.advanceToNextField(
      nowMs,
    );
  }


  /* =======================================================
     FIELD FAILURE
     ======================================================= */

  failCurrentField(
    message:
      string,

    options:
      FailFieldOptions =
      {},

    nowMs:
      number =
      Date.now(),
  ): ScanMachineSnapshot {
    this.assertRunning();


    const field =
      this.requireCurrentField();


    field.status =
      "failed";

    field.completedAtMs =
      nowMs;

    field.error =
      message;


    this.state.lastError =
      message;


    const continueScan =
      options.continueScan ??
      true;


    if (
      !continueScan
    ) {
      this.state.runStatus =
        "failed";

      this.state.phase =
        "failed";

      this.state.completedAtMs =
        nowMs;

      this.state.resumePhase =
        null;


      return this.getSnapshot();
    }


    return this.advanceToNextField(
      nowMs,
    );
  }


  /* =======================================================
     PAUSE
     ======================================================= */

  pause(
    nowMs:
      number =
      Date.now(),
  ): ScanMachineSnapshot {
    this.assertRunning();


    if (
      !isActivePhase(
        this.state.phase,
      )
    ) {
      throw new Error(
        `Scan cannot pause from phase "${this.state.phase}".`,
      );
    }


    this.state.resumePhase =
      this.state.phase;

    this.state.runStatus =
      "paused";

    this.state.phase =
      "paused";

    this.state.pausedAtMs =
      nowMs;


    return this.getSnapshot();
  }


  /* =======================================================
     RESUME
     ======================================================= */

  resume():
    ScanMachineSnapshot {
    if (
      this.state.runStatus !==
      "paused"
    ) {
      throw new Error(
        `Scan cannot resume from status "${this.state.runStatus}".`,
      );
    }


    const resumePhase =
      this.state.resumePhase;


    if (
      !resumePhase
    ) {
      throw new Error(
        "Scan cannot resume because no previous active phase was recorded.",
      );
    }


    this.state.runStatus =
      "running";

    this.state.phase =
      resumePhase;

    this.state.resumePhase =
      null;

    this.state.pausedAtMs =
      null;


    return this.getSnapshot();
  }


  /* =======================================================
     ABORT
     ======================================================= */

  abort(
    reason =
      "Scan aborted by operator.",

    nowMs:
      number =
      Date.now(),
  ): ScanMachineSnapshot {
    if (
      this.state.runStatus !==
        "running" &&
      this.state.runStatus !==
        "paused"
    ) {
      throw new Error(
        `Scan cannot abort from status "${this.state.runStatus}".`,
      );
    }


    const field =
      this.getMutableCurrentField();


    if (
      field &&
      field.status !==
        "completed" &&
      field.status !==
        "failed"
    ) {
      field.status =
        "skipped";

      field.completedAtMs =
        nowMs;

      field.error =
        reason;
    }


    this.state.runStatus =
      "aborted";

    this.state.phase =
      "aborted";

    this.state.resumePhase =
      null;

    this.state.completedAtMs =
      nowMs;

    this.state.lastError =
      reason;


    return this.getSnapshot();
  }


  /* =======================================================
     RUN FAILURE
     ======================================================= */

  failRun(
    message:
      string,

    nowMs:
      number =
      Date.now(),
  ): ScanMachineSnapshot {
    if (
      this.state.runStatus !==
        "running" &&
      this.state.runStatus !==
        "paused"
    ) {
      throw new Error(
        `Scan cannot fail from status "${this.state.runStatus}".`,
      );
    }


    const field =
      this.getMutableCurrentField();


    if (
      field &&
      field.status !==
        "completed"
    ) {
      field.status =
        "failed";

      field.completedAtMs =
        nowMs;

      field.error =
        message;
    }


    this.state.runStatus =
      "failed";

    this.state.phase =
      "failed";

    this.state.resumePhase =
      null;

    this.state.completedAtMs =
      nowMs;

    this.state.lastError =
      message;


    return this.getSnapshot();
  }


  /* =======================================================
     PRIVATE HELPERS
     ======================================================= */

  private markCurrentFieldPhase(
    phase:
      ActiveScanPhase,

    nowMs:
      number,
  ): void {
    const field =
      this.requireCurrentField();


    field.status =
      FIELD_STATUS_BY_PHASE[
        phase
      ];


    if (
      field.startedAtMs ===
      null
    ) {
      field.startedAtMs =
        nowMs;
    }
  }


  private advanceToNextField(
    nowMs:
      number,
  ): ScanMachineSnapshot {
    const currentIndex =
      this.state
        .currentFieldIndex;


    if (
      currentIndex ===
      null
    ) {
      throw new Error(
        "Cannot advance scan because there is no current field.",
      );
    }


    const nextIndex =
      this.findNextPendingFieldIndex(
        currentIndex +
          1,
      );


    if (
      nextIndex ===
      null
    ) {
      this.state.runStatus =
        "completed";

      this.state.phase =
        "completed";

      this.state.currentFieldIndex =
        null;

      this.state.completedAtMs =
        nowMs;

      this.state.resumePhase =
        null;

      this.state.pausedAtMs =
        null;


      return this.getSnapshot();
    }


    this.state.currentFieldIndex =
      nextIndex;

    this.state.phase =
      "moving";

    this.state.resumePhase =
      null;


    this.markCurrentFieldPhase(
      "moving",
      nowMs,
    );


    return this.getSnapshot();
  }


  private findNextPendingFieldIndex(
    startIndex:
      number,
  ): number | null {
    for (
      let index =
        startIndex;
      index <
      this.state.fields.length;
      index +=
        1
    ) {
      if (
        this.state.fields[
          index
        ].status ===
        "pending"
      ) {
        return index;
      }
    }


    return null;
  }


  private assertRunning():
    void {
    if (
      this.state.runStatus !==
      "running"
    ) {
      throw new Error(
        `Scan operation requires running status. Current status="${this.state.runStatus}".`,
      );
    }
  }


  private getMutableCurrentField():
    ScanFieldRuntime | null {
    const index =
      this.state
        .currentFieldIndex;


    if (
      index ===
      null
    ) {
      return null;
    }


    return (
      this.state.fields[
        index
      ] ??
      null
    );
  }


  private requireCurrentField():
    ScanFieldRuntime {
    const field =
      this.getMutableCurrentField();


    if (
      !field
    ) {
      throw new Error(
        "Scan has no current field.",
      );
    }


    return field;
  }
}