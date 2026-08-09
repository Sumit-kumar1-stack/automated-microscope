"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  getMlModelInfo,
  type MlModelInfo,
} from "@/lib/ml-inference";

import styles from "./MlModelTelemetryPanel.module.css";


function percent(
  value:
    number | null | undefined,
): string {
  if (
    typeof value !==
    "number"
  ) {
    return "—";
  }

  return `${(
    value * 100
  ).toFixed(
    1,
  )}%`;
}


function decimal(
  value:
    number | null | undefined,
): string {
  if (
    typeof value !==
    "number"
  ) {
    return "—";
  }

  return value.toFixed(
    3,
  );
}


export function MlModelTelemetryPanel() {
  const [
    info,
    setInfo,
  ] =
    useState<
      MlModelInfo | null
    >(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );


  useEffect(
    () => {
      let cancelled =
        false;

      async function load() {
        try {
          setLoading(
            true,
          );

          setError(
            null,
          );

          const result =
            await getMlModelInfo();

          if (
            cancelled
          ) {
            return;
          }

          setInfo(
            result,
          );
        } catch (
          caught
        ) {
          if (
            cancelled
          ) {
            return;
          }

          setError(
            caught instanceof
              Error
              ? caught.message
              : "Unable to load ML model telemetry.",
          );
        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false,
            );
          }
        }
      }

      void load();

      return () => {
        cancelled =
          true;
      };
    },
    [],
  );


  if (
    loading
  ) {
    return (
      <section
        className={`card ${styles.panel}`}
      >
        <div className="cardHeader">
          <div>
            ML MODEL TELEMETRY
          </div>

          <span>
            LOADING
          </span>
        </div>

        <div
          className={
            styles.loading
          }
        >
          Reading frozen model
          configuration and validation
          evidence...
        </div>
      </section>
    );
  }


  if (
    error ||
    !info
  ) {
    return (
      <section
        className={`card ${styles.panel}`}
      >
        <div className="cardHeader">
          <div>
            ML MODEL TELEMETRY
          </div>

          <span
            className={
              styles.errorState
            }
          >
            UNAVAILABLE
          </span>
        </div>

        <div
          className={
            styles.warning
          }
        >
          {error ??
            "Model telemetry unavailable."}
        </div>
      </section>
    );
  }


  const development =
    info.validation
      ?.development;

  const external =
    info.validation
      ?.external;


  return (
    <section
      className={`card ${styles.panel}`}
    >
      <div className="cardHeader">
        <div>
          ML MODEL TELEMETRY
        </div>

        <span
          className={
            styles.frozen
          }
        >
          FROZEN V2
        </span>
      </div>


      <div
        className={
          styles.statusRow
        }
      >
        <div>
          <span>
            PIPELINE
          </span>

          <strong>
            {
              info.status
                ?.toUpperCase() ??
              "EXPERIMENTAL"
            }
          </strong>
        </div>

        <div>
          <span>
            CLINICAL VALIDATION
          </span>

          <strong>
            {info.clinically_validated
              ? "YES"
              : "NO"}
          </strong>
        </div>

        <div>
          <span>
            USE
          </span>

          <strong>
            {info.research_only
              ? "RESEARCH ONLY"
              : "RESEARCH"}
          </strong>
        </div>
      </div>


      <div
        className={
          styles.section
        }
      >
        <div
          className={
            styles.sectionTitle
          }
        >
          FROZEN MODELS
        </div>

        <div
          className={
            styles.rows
          }
        >
          <div>
            <span>
              Detector
            </span>

            <strong>
              {
                info.detector
                  .name
              }
            </strong>
          </div>

          <div>
            <span>
              Classifier
            </span>

            <strong>
              {
                info.classifier
                  .name
              }
            </strong>
          </div>

          <div>
            <span>
              Architecture
            </span>

            <strong>
              {
                info.classifier
                  .architecture
              }
            </strong>
          </div>

          <div>
            <span>
              Stage classes
            </span>

            <strong>
              {
                info.classifier
                  .classes
                  .join(
                    ", ",
                  )
              }
            </strong>
          </div>
        </div>
      </div>


      <div
        className={
          styles.section
        }
      >
        <div
          className={
            styles.sectionTitle
          }
        >
          INFERENCE CONFIGURATION
        </div>

        <div
          className={
            styles.metricGrid
          }
        >
          <div>
            <span>
              Detector threshold
            </span>

            <strong>
              {
                info.detector
                  .confidence_threshold
                  .toFixed(
                    2,
                  )
              }
            </strong>
          </div>

          <div>
            <span>
              Detector input
            </span>

            <strong>
              {
                info.detector
                  .image_size
              } px
            </strong>
          </div>

          <div>
            <span>
              Classifier input
            </span>

            <strong>
              {
                info.classifier
                  .image_size
              } px
            </strong>
          </div>

          <div>
            <span>
              Crop context
            </span>

            <strong>
              {
                info.crop_context_scale
                  .toFixed(
                    1,
                  )
              }×
            </strong>
          </div>
        </div>
      </div>


      <div
        className={
          styles.section
        }
      >
        <div
          className={
            styles.sectionHeader
          }
        >
          <div
            className={
              styles.sectionTitle
            }
          >
            DEVELOPMENT VALIDATION
          </div>

          <span
            className={
              styles.developmentBadge
            }
          >
            INTERNAL
          </span>
        </div>

        <div
          className={
            styles.metricGrid
          }
        >
          <div>
            <span>
              Detector precision
            </span>

            <strong>
              {percent(
                development
                  ?.detector_precision,
              )}
            </strong>
          </div>

          <div>
            <span>
              Detector recall
            </span>

            <strong>
              {percent(
                development
                  ?.detector_recall,
              )}
            </strong>
          </div>

          <div>
            <span>
              Detector F1
            </span>

            <strong>
              {percent(
                development
                  ?.detector_f1,
              )}
            </strong>
          </div>

          <div>
            <span>
              End-to-end Macro F1
            </span>

            <strong>
              {decimal(
                development
                  ?.end_to_end_macro_f1,
              )}
            </strong>
          </div>
        </div>
      </div>


      <div
        className={
          styles.section
        }
      >
        <div
          className={
            styles.sectionHeader
          }
        >
          <div
            className={
              styles.sectionTitle
            }
          >
            EXTERNAL VALIDATION
          </div>

          <span
            className={
              styles.externalBadge
            }
          >
            FROZEN TEST
          </span>
        </div>

        <div
          className={
            styles.benchmark
          }
        >
          {
            external
              ?.benchmark ??
            "BBBC041 official frozen test"
          }
        </div>

        <div
          className={
            styles.metricGrid
          }
        >
          <div>
            <span>
              Detector precision
            </span>

            <strong>
              {percent(
                external
                  ?.detector_precision,
              )}
            </strong>
          </div>

          <div>
            <span>
              Detector recall
            </span>

            <strong>
              {percent(
                external
                  ?.detector_recall,
              )}
            </strong>
          </div>

          <div>
            <span>
              Detector F1
            </span>

            <strong>
              {percent(
                external
                  ?.detector_f1,
              )}
            </strong>
          </div>

          <div>
            <span>
              End-to-end Macro F1
            </span>

            <strong>
              {decimal(
                external
                  ?.end_to_end_macro_f1,
              )}
            </strong>
          </div>
        </div>

        <div
          className={
            styles.externalMeta
          }
        >
          <span>
            Images:{" "}
            <strong>
              {
                external
                  ?.images ??
                "—"
              }
            </strong>
          </span>

          <span>
            GT objects:{" "}
            <strong>
              {
                external
                  ?.ground_truth_objects ??
                "—"
              }
            </strong>
          </span>
        </div>
      </div>


      <div
        className={
          styles.limitation
        }
      >
        <strong>
          EXTERNAL GENERALIZATION LIMITED
        </strong>

        <p>
          The frozen external
          BBBC041 benchmark showed
          substantially lower detector
          recall than development
          validation. Predictions must
          therefore be interpreted as
          experimental research
          candidates, not diagnostic
          conclusions.
        </p>
      </div>


      <div
        className={
          styles.footer
        }
      >
        Research prototype • Not
        clinically validated • Frozen
        evaluation configuration
      </div>
    </section>
  );
}