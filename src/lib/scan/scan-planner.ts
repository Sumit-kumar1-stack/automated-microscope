import type {
  ScanBounds,
  ScanExtent,
  ScanField,
  ScanGridConfig,
  ScanPlan,
} from "./scan-types";


function assertFiniteNumber(
  value: number,
  label: string,
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


function assertPositiveInteger(
  value: number,
  label: string,
): void {
  if (
    !Number.isInteger(
      value,
    ) ||
    value <=
      0
  ) {
    throw new Error(
      `${label} must be a positive integer.`,
    );
  }
}


function assertPositiveNumber(
  value: number,
  label: string,
): void {
  assertFiniteNumber(
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
  bounds: ScanBounds,
): void {
  assertFiniteNumber(
    bounds.minXUm,
    "bounds.minXUm",
  );

  assertFiniteNumber(
    bounds.maxXUm,
    "bounds.maxXUm",
  );

  assertFiniteNumber(
    bounds.minYUm,
    "bounds.minYUm",
  );

  assertFiniteNumber(
    bounds.maxYUm,
    "bounds.maxYUm",
  );


  if (
    bounds.minXUm >
    bounds.maxXUm
  ) {
    throw new Error(
      "bounds.minXUm cannot be greater than bounds.maxXUm.",
    );
  }


  if (
    bounds.minYUm >
    bounds.maxYUm
  ) {
    throw new Error(
      "bounds.minYUm cannot be greater than bounds.maxYUm.",
    );
  }
}


function validateCoordinate(
  xUm: number,
  yUm: number,
  bounds:
    ScanBounds | undefined,
): void {
  if (
    !bounds
  ) {
    return;
  }


  if (
    xUm <
      bounds.minXUm ||
    xUm >
      bounds.maxXUm ||
    yUm <
      bounds.minYUm ||
    yUm >
      bounds.maxYUm
  ) {
    throw new Error(
      [
        "Generated scan field exceeds configured travel bounds.",
        `Coordinate=(${xUm}, ${yUm}) µm.`,
        `Allowed X=${bounds.minXUm}..${bounds.maxXUm} µm.`,
        `Allowed Y=${bounds.minYUm}..${bounds.maxYUm} µm.`,
      ].join(
        " ",
      ),
    );
  }
}


function getExtent(
  config:
    ScanGridConfig,
): ScanExtent {
  const maxXUm =
    config.originXUm +
    (
      config.columns -
      1
    ) *
      config.stepXUm;

  const maxYUm =
    config.originYUm +
    (
      config.rows -
      1
    ) *
      config.stepYUm;


  return {
    minXUm:
      Math.min(
        config.originXUm,
        maxXUm,
      ),

    maxXUm:
      Math.max(
        config.originXUm,
        maxXUm,
      ),

    minYUm:
      Math.min(
        config.originYUm,
        maxYUm,
      ),

    maxYUm:
      Math.max(
        config.originYUm,
        maxYUm,
      ),
  };
}


export function validateScanGridConfig(
  config:
    ScanGridConfig,
): void {
  assertPositiveInteger(
    config.rows,
    "rows",
  );

  assertPositiveInteger(
    config.columns,
    "columns",
  );

  assertFiniteNumber(
    config.originXUm,
    "originXUm",
  );

  assertFiniteNumber(
    config.originYUm,
    "originYUm",
  );

  assertPositiveNumber(
    config.stepXUm,
    "stepXUm",
  );

  assertPositiveNumber(
    config.stepYUm,
    "stepYUm",
  );


  if (
    config.bounds
  ) {
    validateBounds(
      config.bounds,
    );
  }
}


export function buildScanPlan(
  config:
    ScanGridConfig,
): ScanPlan {
  validateScanGridConfig(
    config,
  );


  const serpentine =
    config.serpentine ??
    true;

  const fields:
    ScanField[] =
      [];

  let sequence =
    0;


  for (
    let row =
      0;
    row <
    config.rows;
    row +=
      1
  ) {
    const reverseRow =
      serpentine &&
      row %
        2 ===
        1;


    for (
      let position =
        0;
      position <
      config.columns;
      position +=
        1
    ) {
      const column =
        reverseRow
          ? config.columns -
            1 -
            position
          : position;


      const xUm =
        config.originXUm +
        column *
          config.stepXUm;

      const yUm =
        config.originYUm +
        row *
          config.stepYUm;


      validateCoordinate(
        xUm,
        yUm,
        config.bounds,
      );


      fields.push(
        {
          id:
            `F${String(
              sequence +
                1,
            ).padStart(
              4,
              "0",
            )}`,

          sequence,

          row,
          column,

          xUm,
          yUm,

          direction:
            reverseRow
              ? "reverse"
              : "forward",
        },
      );


      sequence +=
        1;
    }
  }


  return {
    fields,

    totalFields:
      fields.length,

    extent:
      getExtent(
        config,
      ),

    serpentine,
  };
}


export function calculatePlanTravelUm(
  plan:
    ScanPlan,
): number {
  if (
    plan.fields.length <=
    1
  ) {
    return 0;
  }


  let distance =
    0;


  for (
    let index =
      1;
    index <
    plan.fields.length;
    index +=
      1
  ) {
    const previous =
      plan.fields[
        index -
        1
      ];

    const current =
      plan.fields[
        index
      ];


    const deltaX =
      current.xUm -
      previous.xUm;

    const deltaY =
      current.yUm -
      previous.yUm;


    distance +=
      Math.hypot(
        deltaX,
        deltaY,
      );
  }


  return distance;
}