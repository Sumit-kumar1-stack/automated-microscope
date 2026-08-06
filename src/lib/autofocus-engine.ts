export type AutofocusSample = {
  z: number;
  score: number;
  phase: "coarse" | "fine" | "final";
};

type AutofocusOptions = {
  initialZ: number;
  minZ: number;
  maxZ: number;
  coarseStartZ: number;
  coarseEndZ: number;
  coarseStepZ: number;
  fineRadiusZ: number;
  settleMs: number;
  signal: AbortSignal;
  moveTo: (z: number, signal: AbortSignal) => Promise<void>;
  measure: (z: number, signal: AbortSignal) => Promise<number> | number;
  onProgress?: (progress: number) => void;
  onSample?: (sample: AutofocusSample) => void;
  onPhaseChange?: (phase: "coarse" | "fine" | "final") => void;
};

export type AutofocusResult = {
  bestZ: number;
  bestScore: number;
  samples: AutofocusSample[];
};

export async function abortableSleep(
  ms: number,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) {
    throw createAbortError();
  }

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(createAbortError());
    };

    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function runCoarseFineAutofocus(
  options: AutofocusOptions,
): Promise<AutofocusResult> {
  const {
    initialZ,
    minZ,
    maxZ,
    coarseStartZ,
    coarseEndZ,
    coarseStepZ,
    fineRadiusZ,
    settleMs,
    signal,
    moveTo,
    measure,
    onProgress,
    onSample,
    onPhaseChange,
  } = options;

  assertValidSearchRange({
    minZ,
    maxZ,
    coarseStartZ,
    coarseEndZ,
    coarseStepZ,
    fineRadiusZ,
  });

  const coarsePositions = createRange(
    clamp(coarseStartZ, minZ, maxZ),
    clamp(coarseEndZ, minZ, maxZ),
    coarseStepZ,
  );

  if (coarsePositions.length === 0) {
    throw new Error("Autofocus coarse search produced no candidate positions.");
  }

  const samples: AutofocusSample[] = [];
  let bestZ = clamp(initialZ, minZ, maxZ);
  let bestScore = Number.NEGATIVE_INFINITY;

  onPhaseChange?.("coarse");

  for (let index = 0; index < coarsePositions.length; index += 1) {
    throwIfAborted(signal);

    const candidateZ = coarsePositions[index];
    await moveTo(candidateZ, signal);
    await abortableSleep(settleMs, signal);

    const score = await measure(candidateZ, signal);
    const sample: AutofocusSample = {
      z: candidateZ,
      score,
      phase: "coarse",
    };

    samples.push(sample);
    onSample?.(sample);

    if (score > bestScore) {
      bestScore = score;
      bestZ = candidateZ;
    }

    onProgress?.(
      Math.round(((index + 1) / coarsePositions.length) * 82),
    );
  }

  onPhaseChange?.("fine");

  const fineStart = clamp(bestZ - fineRadiusZ, minZ, maxZ);
  const fineEnd = clamp(bestZ + fineRadiusZ, minZ, maxZ);
  const finePositions = createRange(fineStart, fineEnd, 1);

  for (let index = 0; index < finePositions.length; index += 1) {
    throwIfAborted(signal);

    const candidateZ = finePositions[index];
    await moveTo(candidateZ, signal);
    await abortableSleep(settleMs, signal);

    const score = await measure(candidateZ, signal);
    const sample: AutofocusSample = {
      z: candidateZ,
      score,
      phase: "fine",
    };

    samples.push(sample);
    onSample?.(sample);

    if (score > bestScore) {
      bestScore = score;
      bestZ = candidateZ;
    }

    onProgress?.(
      82 + Math.round(((index + 1) / finePositions.length) * 16),
    );
  }

  onPhaseChange?.("final");

  throwIfAborted(signal);
  await moveTo(bestZ, signal);
  await abortableSleep(settleMs, signal);

  const finalScore = await measure(bestZ, signal);
  const finalSample: AutofocusSample = {
    z: bestZ,
    score: finalScore,
    phase: "final",
  };

  samples.push(finalSample);
  onSample?.(finalSample);

  if (finalScore > bestScore) {
    bestScore = finalScore;
  }

  onProgress?.(100);

  return {
    bestZ,
    bestScore,
    samples,
  };
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}

function createAbortError(): DOMException {
  return new DOMException("Operation aborted.", "AbortError");
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw createAbortError();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createRange(start: number, end: number, step: number): number[] {
  const result: number[] = [];

  for (let value = start; value <= end; value += step) {
    result.push(value);
  }

  return result;
}

function assertValidSearchRange(input: {
  minZ: number;
  maxZ: number;
  coarseStartZ: number;
  coarseEndZ: number;
  coarseStepZ: number;
  fineRadiusZ: number;
}): void {
  if (input.minZ >= input.maxZ) {
    throw new Error("Autofocus minZ must be lower than maxZ.");
  }

  if (input.coarseStartZ > input.coarseEndZ) {
    throw new Error("Autofocus coarse start must be before coarse end.");
  }

  if (input.coarseStepZ <= 0) {
    throw new Error("Autofocus coarse step must be positive.");
  }

  if (input.fineRadiusZ < 0) {
    throw new Error("Autofocus fine radius cannot be negative.");
  }
}
