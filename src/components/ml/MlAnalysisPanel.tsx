"use client";

import type {
  MlInferenceResult,
} from "@/lib/ml-inference";

import styles from "./MlAnalysisPanel.module.css";


type MlAnalysisPanelProps = {
  result: MlInferenceResult | null;

  analyzing: boolean;

  canAnalyze: boolean;

  onAnalyze: () => void;

  onClear: () => void;
};


function percent(
  value: number,
) {
  return `${(
    value * 100
  ).toFixed(1)}%`;
}


export function MlAnalysisPanel({
  result,
  analyzing,
  canAnalyze,
  onAnalyze,
  onClear,
}: MlAnalysisPanelProps) {
  return (
    <section
      className={`card ${styles.panel}`}
    >
      <div className="cardHeader">
        <div>
          ML PARASITE CANDIDATE ANALYSIS
        </div>

        <span
          className={
            styles.experimental
          }
        >
          EXPERIMENTAL
        </span>
      </div>

      <div
        className={
          styles.actions
        }
      >
        <button
          className="primary"
          disabled={
            !canAnalyze ||
            analyzing
          }
          onClick={
            onAnalyze
          }
        >
          {analyzing
            ? "ANALYZING..."
            : "RUN ML ANALYSIS"}
        </button>

        <button
          disabled={
            analyzing
          }
          onClick={
            onClear
          }
        >
          CLEAR
        </button>
      </div>

      {!result && (
        <div
          className={
            styles.empty
          }
        >
          <strong>
            No ML result
          </strong>

          <span>
            Capture the current
            microscope field and run
            the frozen V2 research
            pipeline.
          </span>
        </div>
      )}

      {result && (
        <>
          <div
            className={
              styles.telemetry
            }
          >
            <div>
              <span>
                MODEL
              </span>

              <strong>
                {result.model_version}
              </strong>
            </div>

            <div>
              <span>
                CANDIDATES
              </span>

              <strong>
                {
                  result.candidate_count
                }
              </strong>
            </div>

            <div>
              <span>
                INFERENCE
              </span>

              <strong>
                {
                  result.timing_ms
                    .inference
                    .toFixed(
                      1,
                    )
                } ms
              </strong>
            </div>

            <div>
              <span>
                DETECTOR THRESHOLD
              </span>

              <strong>
                {
                  result.configuration
                    .detector_confidence
                    .toFixed(
                      2,
                    )
                }
              </strong>
            </div>
          </div>

          <div
            className={
              styles.candidates
            }
          >
            {
              result.candidates
                .map(
                  (
                    candidate,
                  ) => (
                    <article
                      key={
                        candidate
                          .candidate_id
                      }
                      className={
                        styles.candidate
                      }
                    >
                      <div
                        className={
                          styles.candidateHeader
                        }
                      >
                        <strong>
                          #
                          {
                            candidate
                              .candidate_id
                          }
                        </strong>

                        <span
                          className={
                            styles.stage
                          }
                        >
                          {
                            candidate
                              .stage
                              .toUpperCase()
                          }
                        </span>
                      </div>

                      <div
                        className={
                          styles.metrics
                        }
                      >
                        <div>
                          <span>
                            Detection
                          </span>

                          <strong>
                            {
                              percent(
                                candidate
                                  .detector_confidence,
                              )
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            Stage
                          </span>

                          <strong>
                            {
                              percent(
                                candidate
                                  .stage_confidence,
                              )
                            }
                          </strong>
                        </div>
                      </div>

                      <div
                        className={
                          styles.bbox
                        }
                      >
                        bbox [
                        {
                          candidate
                            .bbox
                            .x1
                            .toFixed(
                              0,
                            )
                        }
                        ,
                        {
                          candidate
                            .bbox
                            .y1
                            .toFixed(
                              0,
                            )
                        }
                        ] → [
                        {
                          candidate
                            .bbox
                            .x2
                            .toFixed(
                              0,
                            )
                        }
                        ,
                        {
                          candidate
                            .bbox
                            .y2
                            .toFixed(
                              0,
                            )
                        }
                        ]
                      </div>
                    </article>
                  ),
                )
            }
          </div>
        </>
      )}

      <div
        className={
          styles.warning
        }
      >
        Research candidate detection
        only. This model is not
        clinically validated and its
        external generalization remains
        limited.
      </div>
    </section>
  );
}
