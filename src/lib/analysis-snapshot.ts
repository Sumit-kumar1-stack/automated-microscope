import type {
  CellAnalysisResult,
} from "@/lib/cell-analysis";

export type AnalysisSnapshot = {
  id: string;

  createdAt: string;

  profileId: string;

  profileName: string;

  profileVersion: string;

  acquisitionMode:
    | "simulation"
    | "camera"
    | "hardware";

  focusScore: number;

  relativeDetail: number;

  focusStatus: string;

  zPosition:
    | number
    | null;

  analysis:
    | CellAnalysisResult
    | null;

  imageDataUrl: string;
};

export function createAnalysisSnapshot(
  input: Omit<
    AnalysisSnapshot,
    "id" | "createdAt"
  >,
): AnalysisSnapshot {
  return {
    id:
      createSnapshotId(),

    createdAt:
      new Date().toISOString(),

    ...input,
  };
}

function createSnapshotId(): string {
  if (
    typeof crypto !==
      "undefined" &&
    "randomUUID" in
      crypto
  ) {
    return crypto.randomUUID();
  }

  return [
    "analysis",
    Date.now(),
    Math.random()
      .toString(16)
      .slice(2),
  ].join("-");
}