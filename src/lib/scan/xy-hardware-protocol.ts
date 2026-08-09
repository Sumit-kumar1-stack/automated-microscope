import type {
  ScanCoordinate,
} from "./scan-types";


/* =========================================================
   DEVICE STATE
   ========================================================= */

export type XYHardwareState = {
  xUm:
    number;

  yUm:
    number;

  moving:
    boolean;

  homed:
    boolean;

  estop:
    boolean;

  enabled:
    boolean;
};


/* =========================================================
   DEVICE RESPONSE
   ========================================================= */

export type XYHardwareResponse =
  | {
      ok:
        true;

      command:
        string;

      state:
        XYHardwareState;
    }

  | {
      ok:
        false;

      code:
        string;

      message:
        string;
    };


/* =========================================================
   COMMAND BUILDERS
   ========================================================= */

export function buildHelloCommand():
  string {
  return "HELLO";
}


export function buildStatusCommand():
  string {
  return "STATUS";
}


export function buildMoveAbsoluteCommand(
  target:
    ScanCoordinate,
): string {
  return [
    "MOVE_ABS",

    Math.round(
      target.xUm,
    ),

    Math.round(
      target.yUm,
    ),
  ].join(
    " ",
  );
}


export function buildHomeCommand():
  string {
  return "HOME";
}


export function buildStopCommand():
  string {
  return "STOP";
}


export function buildEnableCommand():
  string {
  return "ENABLE";
}


export function buildDisableCommand():
  string {
  return "DISABLE";
}


/* =========================================================
   RESPONSE PARSER
   ========================================================= */

/**
 * Expected successful device format:
 *
 * OK <COMMAND>
 * X=<number>
 * Y=<number>
 * MOVING=<0|1>
 * HOMED=<0|1>
 * ESTOP=<0|1>
 * ENABLED=<0|1>
 *
 * All tokens are transmitted on one line.
 *
 * Example:
 *
 * OK MOVE_ABS X=1500 Y=800 MOVING=0 HOMED=1 ESTOP=0 ENABLED=1
 *
 *
 * Error format:
 *
 * ERR CODE=<code> MESSAGE=<text>
 *
 * Example:
 *
 * ERR CODE=LIMIT_X_MAX MESSAGE=target_outside_limit
 */
export function parseHardwareResponse(
  line:
    string,
): XYHardwareResponse {
  const trimmed =
    line.trim();


  if (
    !trimmed
  ) {
    throw new Error(
      "XY controller returned an empty response.",
    );
  }


  const tokens =
    trimmed.split(
      /\s+/,
    );


  if (
    tokens[
      0
    ] ===
    "ERR"
  ) {
    const values =
      parseKeyValueTokens(
        tokens.slice(
          1,
        ),
      );


    return {
      ok:
        false,

      code:
        values.CODE ??
        "UNKNOWN",

      message:
        values.MESSAGE ??
        "Unknown controller error.",
    };
  }


  if (
    tokens[
      0
    ] !==
    "OK"
  ) {
    throw new Error(
      `Unexpected XY controller response: "${trimmed}".`,
    );
  }


  const command =
    tokens[
      1
    ] ??
    "UNKNOWN";


  const values =
    parseKeyValueTokens(
      tokens.slice(
        2,
      ),
    );


  const xUm =
    parseRequiredNumber(
      values.X,
      "X",
    );

  const yUm =
    parseRequiredNumber(
      values.Y,
      "Y",
    );


  return {
    ok:
      true,

    command,

    state: {
      xUm,

      yUm,

      moving:
        parseBooleanFlag(
          values.MOVING,
          "MOVING",
        ),

      homed:
        parseBooleanFlag(
          values.HOMED,
          "HOMED",
        ),

      estop:
        parseBooleanFlag(
          values.ESTOP,
          "ESTOP",
        ),

      enabled:
        parseBooleanFlag(
          values.ENABLED,
          "ENABLED",
        ),
    },
  };
}


/* =========================================================
   HELPERS
   ========================================================= */

function parseKeyValueTokens(
  tokens:
    string[],
): Record<
  string,
  string
> {
  const result:
    Record<
      string,
      string
    > =
      {};


  for (
    const token
    of tokens
  ) {
    const separatorIndex =
      token.indexOf(
        "=",
      );


    if (
      separatorIndex <=
      0
    ) {
      continue;
    }


    const key =
      token
        .slice(
          0,
          separatorIndex,
        )
        .toUpperCase();


    const value =
      token.slice(
        separatorIndex +
          1,
      );


    result[
      key
    ] =
      value;
  }


  return result;
}


function parseRequiredNumber(
  value:
    string | undefined,

  field:
    string,
): number {
  if (
    value ===
    undefined
  ) {
    throw new Error(
      `XY controller response is missing ${field}.`,
    );
  }


  const parsed =
    Number(
      value,
    );


  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    throw new Error(
      `XY controller returned invalid ${field} value "${value}".`,
    );
  }


  return parsed;
}


function parseBooleanFlag(
  value:
    string | undefined,

  field:
    string,
): boolean {
  if (
    value ===
    "1"
  ) {
    return true;
  }


  if (
    value ===
    "0"
  ) {
    return false;
  }


  throw new Error(
    `XY controller returned invalid ${field} flag "${value}".`,
  );
}