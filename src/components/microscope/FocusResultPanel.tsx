"use client";

import {
  type MicroscopeMode,
} from "@/lib/microscope-config";

type FocusResultPanelProps = {
  mode: MicroscopeMode;
  cameraHistory: number[];
  historyMax: number;
  sessionPeak: number;
  bestZ: number | null;
  bestScore: number;
  autofocusSampleCount: number;
  simulatorOptimalZ: number;
};

export function FocusResultPanel({
  mode,
  cameraHistory,
  historyMax,
  sessionPeak,
  bestZ,
  bestScore,
  autofocusSampleCount,
  simulatorOptimalZ,
}: FocusResultPanelProps) {
  return (
    <div className="card resultCard">
      <div className="cardHeader">
        <div>
          {mode === "camera"
            ? "FOCUS TREND"
            : "FOCUS RESULT"}
        </div>

        <span>
          {mode === "camera"
            ? "LIVE"
            : "COARSE → FINE"}
        </span>
      </div>

      {mode === "camera" ? (
        <>
          <div
            className="focusTrend"
            aria-label="Live focus score history"
          >
            {cameraHistory.length ===
            0 ? (
              <div className="trendPlaceholder">
                Start camera to collect
                focus measurements.
              </div>
            ) : (
              cameraHistory.map(
                (
                  value,
                  index,
                ) => (
                  <span
                    key={
                      `${index}-${value.toFixed(
                        2,
                      )}`
                    }
                    title={
                      value.toFixed(
                        1,
                      )
                    }
                    style={{
                      height:
                        `${Math.max(
                          4,
                          (
                            value /
                            historyMax
                          ) *
                            100,
                        )}%`,
                    }}
                  />
                ),
              )
            )}
          </div>

          <div className="resultRow">
            <span>
              Samples
            </span>

            <strong>
              {
                cameraHistory.length
              }
            </strong>
          </div>

          <div className="resultRow">
            <span>
              Session peak
            </span>

            <strong>
              {sessionPeak.toFixed(
                1,
              )}
            </strong>
          </div>

          <p className="tiny">
            Scores are calculated from
            downsampled real camera frames
            to reduce browser CPU usage.
          </p>
        </>
      ) : (
        <>
          <div className="resultRow">
            <span>
              Best Z
            </span>

            <strong>
              {bestZ ??
                "—"}
            </strong>
          </div>

          <div className="resultRow">
            <span>
              Peak score
            </span>

            <strong>
              {bestScore
                ? bestScore.toFixed(
                    1,
                  )
                : "—"}
            </strong>
          </div>

          <div className="resultRow">
            <span>
              Measurements
            </span>

            <strong>
              {
                autofocusSampleCount
              }
            </strong>
          </div>

          {mode ===
            "simulation" && (
              <div className="resultRow">
                <span>
                  Known simulator optimum
                </span>

                <strong>
                  {
                    simulatorOptimalZ
                  }
                </strong>
              </div>
            )}

          <p className="tiny">
            {mode === "hardware"
              ? "Hardware autofocus measures the live optics camera after each physical motor movement."
              : "The simulator optimum is shown only for validation. The search selects the best measured sharpness."}
          </p>
        </>
      )}
    </div>
  );
}
