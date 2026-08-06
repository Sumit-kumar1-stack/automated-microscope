export type CellCandidateType =
  | "rbc"
  | "wbc"
  | "platelet";

export type CellCandidate = {
  id: string;
  type: CellCandidateType;

  x: number;
  y: number;

  width: number;
  height: number;

  area: number;

  /**
   * Heuristic color/shape score.
   *
   * IMPORTANT:
   * This is NOT medical confidence.
   */
  score: number;
};

export type CellAnalysisResult = {
  candidates: CellCandidate[];

  counts: Record<
    CellCandidateType,
    number
  >;

  total: number;

  foregroundCoverage: number;

  processingMs: number;

  imageWidth: number;
  imageHeight: number;
};

type Component = {
  minX: number;
  minY: number;

  maxX: number;
  maxY: number;

  area: number;

  strengthSum: number;
};

/**
 * Our browser analysis canvas
 * normally runs at 450 × 280.
 *
 * Thresholds are automatically
 * scaled if that resolution changes.
 */
const REFERENCE_PIXELS =
  450 * 280;

export function analyzeBloodField(
  image: ImageData,
): CellAnalysisResult {
  const startedAt =
    now();

  const {
    width,
    height,
    data,
  } = image;

  const pixelCount =
    width * height;

  if (
    pixelCount === 0
  ) {
    return emptyResult(
      width,
      height,
    );
  }

  /*
   * Separate masks let us use
   * different connected-component
   * rules for red/pink cells
   * versus purple structures.
   */
  const rbcMask =
    new Uint8Array(
      pixelCount,
    );

  const purpleMask =
    new Uint8Array(
      pixelCount,
    );

  const rbcStrength =
    new Uint8Array(
      pixelCount,
    );

  const purpleStrength =
    new Uint8Array(
      pixelCount,
    );

  let foregroundPixels =
    0;

  /*
   * -------------------------------------------------
   * PIXEL CLASSIFICATION
   * -------------------------------------------------
   *
   * This is intentionally classical computer vision.
   *
   * It works especially well with our synthetic
   * stained-blood demo field.
   *
   * Later this interface can be replaced by:
   *
   * YOLO
   * segmentation model
   * ONNX model
   * TensorFlow.js
   *
   * without redesigning the UI.
   */
  for (
    let pixel = 0;
    pixel < pixelCount;
    pixel += 1
  ) {
    const offset =
      pixel * 4;

    const red =
      data[offset];

    const green =
      data[
        offset + 1
      ];

    const blue =
      data[
        offset + 2
      ];

    const alpha =
      data[
        offset + 3
      ];

    if (
      alpha < 80
    ) {
      continue;
    }

    const maxChannel =
      Math.max(
        red,
        green,
        blue,
      );

    const minChannel =
      Math.min(
        red,
        green,
        blue,
      );

    const saturation =
      maxChannel === 0
        ? 0
        :
          (
            maxChannel -
            minChannel
          ) /
          maxChannel;

    const redDominance =
      red -
      Math.max(
        green,
        blue,
      );

    const purpleDominance =
      blue -
      green;

    /*
     * RBC-like stained pixels.
     */
    const looksRedPink =
      red >= 120 &&
      redDominance >=
        18 &&
      red - green >=
        24 &&
      saturation >=
        0.12;

    /*
     * WBC / platelet-like
     * purple pixels.
     */
    const looksPurple =
      blue >= 90 &&
      purpleDominance >=
        14 &&
      saturation >=
        0.12 &&
      red >= 55;

    if (
      looksRedPink
    ) {
      rbcMask[
        pixel
      ] = 1;

      rbcStrength[
        pixel
      ] =
        toByte(
          redDominance *
            2.2 +
            saturation *
              90,
        );

      foregroundPixels +=
        1;
    }

    if (
      looksPurple
    ) {
      purpleMask[
        pixel
      ] = 1;

      purpleStrength[
        pixel
      ] =
        toByte(
          purpleDominance *
            2.4 +
            saturation *
              100,
        );

      foregroundPixels +=
        1;
    }
  }

  const scale =
    Math.max(
      0.25,
      pixelCount /
        REFERENCE_PIXELS,
    );

  const linearScale =
    Math.sqrt(
      scale,
    );

  const candidates:
    CellCandidate[] =
      [];

  let id =
    0;

  /*
   * -------------------------------------------------
   * RBC COMPONENTS
   * -------------------------------------------------
   */
  const rbcComponents =
    findComponents(
      rbcMask,
      rbcStrength,
      width,
      height,
    );

  for (
    const component
    of rbcComponents
  ) {
    const boxWidth =
      component.maxX -
      component.minX +
      1;

    const boxHeight =
      component.maxY -
      component.minY +
      1;

    const aspect =
      boxWidth /
      Math.max(
        1,
        boxHeight,
      );

    const density =
      component.area /
      Math.max(
        1,
        boxWidth *
          boxHeight,
      );

    /*
     * Reject tiny noise and
     * huge merged regions.
     */
    if (
      component.area <
        55 *
          scale ||
      component.area >
        1800 *
          scale ||
      boxWidth <
        8 *
          linearScale ||
      boxHeight <
        8 *
          linearScale ||
      aspect <
        0.45 ||
      aspect >
        2.2 ||
      density <
        0.08 ||
      density >
        0.92
    ) {
      continue;
    }

    candidates.push({
      id:
        `candidate-${++id}`,

      type:
        "rbc",

      x:
        component.minX,

      y:
        component.minY,

      width:
        boxWidth,

      height:
        boxHeight,

      area:
        component.area,

      score:
        colorScore(
          component,
        ),
    });
  }

  /*
   * -------------------------------------------------
   * PURPLE COMPONENTS
   * -------------------------------------------------
   *
   * Large purple region
   * → WBC-like
   *
   * Small purple region
   * → platelet-like
   */
  const purpleComponents =
    findComponents(
      purpleMask,
      purpleStrength,
      width,
      height,
    );

  for (
    const component
    of purpleComponents
  ) {
    const boxWidth =
      component.maxX -
      component.minX +
      1;

    const boxHeight =
      component.maxY -
      component.minY +
      1;

    const largestDimension =
      Math.max(
        boxWidth,
        boxHeight,
      );

    if (
      component.area <
      3 * scale
    ) {
      continue;
    }

    const isWbc =
      component.area >=
        170 *
          scale ||
      largestDimension >=
        20 *
          linearScale;

    if (
      isWbc
    ) {
      if (
        component.area >
          3200 *
            scale ||
        largestDimension >
          95 *
            linearScale
      ) {
        continue;
      }

      candidates.push({
        id:
          `candidate-${++id}`,

        type:
          "wbc",

        x:
          component.minX,

        y:
          component.minY,

        width:
          boxWidth,

        height:
          boxHeight,

        area:
          component.area,

        score:
          colorScore(
            component,
          ),
      });

      continue;
    }

    /*
     * Platelet-like region.
     */
    if (
      component.area <=
        130 *
          scale &&
      largestDimension <=
        18 *
          linearScale
    ) {
      candidates.push({
        id:
          `candidate-${++id}`,

        type:
          "platelet",

        x:
          component.minX,

        y:
          component.minY,

        width:
          boxWidth,

        height:
          boxHeight,

        area:
          component.area,

        score:
          colorScore(
            component,
          ),
      });
    }
  }

  const counts:
    Record<
      CellCandidateType,
      number
    > = {
      rbc: 0,
      wbc: 0,
      platelet: 0,
    };

  for (
    const candidate
    of candidates
  ) {
    counts[
      candidate.type
    ] += 1;
  }

  return {
    candidates,

    counts,

    total:
      candidates.length,

    foregroundCoverage:
      (
        foregroundPixels /
        Math.max(
          1,
          pixelCount,
        )
      ) *
      100,

    processingMs:
      now() -
      startedAt,

    imageWidth:
      width,

    imageHeight:
      height,
  };
}

/**
 * Connected-component detector.
 *
 * Uses 8-neighbour connectivity.
 */
function findComponents(
  mask: Uint8Array,
  strength: Uint8Array,
  width: number,
  height: number,
): Component[] {
  const visited =
    new Uint8Array(
      mask.length,
    );

  /*
   * Reusable queue avoids
   * creating thousands of
   * temporary JS arrays.
   */
  const queue =
    new Int32Array(
      mask.length,
    );

  const components:
    Component[] =
      [];

  for (
    let start = 0;
    start <
    mask.length;
    start += 1
  ) {
    if (
      mask[start] ===
        0 ||
      visited[
        start
      ] === 1
    ) {
      continue;
    }

    let head =
      0;

    let tail =
      0;

    queue[
      tail++
    ] =
      start;

    visited[
      start
    ] =
      1;

    let minX =
      start %
      width;

    let maxX =
      minX;

    let minY =
      Math.floor(
        start /
          width,
      );

    let maxY =
      minY;

    let area =
      0;

    let strengthSum =
      0;

    while (
      head <
      tail
    ) {
      const index =
        queue[
          head++
        ];

      const x =
        index %
        width;

      const y =
        Math.floor(
          index /
            width,
        );

      area +=
        1;

      strengthSum +=
        strength[
          index
        ];

      minX =
        Math.min(
          minX,
          x,
        );

      maxX =
        Math.max(
          maxX,
          x,
        );

      minY =
        Math.min(
          minY,
          y,
        );

      maxY =
        Math.max(
          maxY,
          y,
        );

      /*
       * 8-connected neighbourhood.
       */
      for (
        let dy = -1;
        dy <= 1;
        dy += 1
      ) {
        for (
          let dx = -1;
          dx <= 1;
          dx += 1
        ) {
          if (
            dx === 0 &&
            dy === 0
          ) {
            continue;
          }

          const nextX =
            x + dx;

          const nextY =
            y + dy;

          if (
            nextX < 0 ||
            nextX >=
              width ||
            nextY < 0 ||
            nextY >=
              height
          ) {
            continue;
          }

          const next =
            nextY *
              width +
            nextX;

          if (
            mask[
              next
            ] === 0 ||
            visited[
              next
            ] === 1
          ) {
            continue;
          }

          visited[
            next
          ] =
            1;

          queue[
            tail++
          ] =
            next;
        }
      }
    }

    components.push({
      minX,
      minY,
      maxX,
      maxY,
      area,
      strengthSum,
    });
  }

  return components;
}

function colorScore(
  component: Component,
): number {
  const normalized =
    component.strengthSum /
    Math.max(
      1,
      component.area,
    ) /
    255;

  /*
   * Heuristic score only.
   *
   * Never call this clinical
   * confidence.
   */
  return Math.max(
    0.5,
    Math.min(
      0.99,
      0.55 +
        normalized *
          0.44,
    ),
  );
}

function emptyResult(
  width: number,
  height: number,
): CellAnalysisResult {
  return {
    candidates: [],

    counts: {
      rbc: 0,
      wbc: 0,
      platelet: 0,
    },

    total: 0,

    foregroundCoverage:
      0,

    processingMs:
      0,

    imageWidth:
      width,

    imageHeight:
      height,
  };
}

function toByte(
  value: number,
): number {
  return Math.max(
    0,
    Math.min(
      255,
      Math.round(
        value,
      ),
    ),
  );
}

function now(): number {
  return typeof performance !==
    "undefined"
    ? performance.now()
    : Date.now();
}