"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type CurvePoint = {
  z: number;
  focusScore: number;
};

type ValidationData = {
  schemaVersion: number;

  title: string;

  dataset: string;

  datasetProvider: string;

  algorithm: string;

  benchmarkVersion: string;

  generatedAt: string;

  status:
    | "PASS"
    | "REVIEW";

  metrics: {
    fieldsEvaluated: number;

    focusBandSuccessPercent:
      number;

    exactOptimumPercent:
      number;

    meanErrorMicrons:
      number;

    medianErrorPlanes:
      number;

    maximumErrorPlanes:
      number;

    curveDirectionPercent:
      number;
  };

  groundTruth: {
    laserOptimalZ:
      number;

    expertFocusBand:
      number[];

    micronsPerPlane:
      number;
  };

  sampling: {
    zPlanes:
      number[];

    fieldCount:
      number;
  };

  sampleCurve:
    CurvePoint[];

  limitations:
    string[];

  disclaimer:
    string;
};

export function ResearchValidationPanel() {
  const [
    data,
    setData,
  ] =
    useState<
      ValidationData | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response =
          await fetch(
            "/research/focus-validation.json",
            {
              cache:
                "no-store",
            },
          );

        if (!response.ok) {
          throw new Error(
            "Validation data unavailable.",
          );
        }

        const result =
          (await response.json()) as ValidationData;

        if (!cancelled) {
          setData(result);
        }
      } catch (
        caught
      ) {
        if (!cancelled) {
          setError(
            caught
              instanceof Error
              ? caught.message
              : "Unable to load validation.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const chartPoints =
    useMemo(
      () =>
        createChartPoints(
          data?.sampleCurve ??
            [],
        ),
      [
        data?.sampleCurve,
      ],
    );

  return (
    <section className="card validationCard">
      <div className="cardHeader">
        <div>
          RESEARCH VALIDATION
        </div>

        <span>
          REAL MICROSCOPY DATA
        </span>
      </div>

      <div className="validationBody">
        {loading && (
          <div className="validationEmpty">
            Loading validation benchmark…
          </div>
        )}

        {error && (
          <div className="validationEmpty">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="validationHeading">
              <div>
                <span className="profileEyebrow">
                  {data.dataset}
                </span>

                <strong>
                  {data.title}
                </strong>

                <small>
                  {
                    data.datasetProvider
                  }
                </small>
              </div>

              <div
                className={
                  data.status ===
                  "PASS"
                    ? "validationPass"
                    : "validationReview"
                }
              >
                {data.status}
              </div>
            </div>

            <div className="validationMetrics">
              <ValidationMetric
                label="Fields"
                value={
                  data.metrics
                    .fieldsEvaluated
                }
              />

              <ValidationMetric
                label="Focus-band success"
                value={`${data.metrics.focusBandSuccessPercent.toFixed(
                  1,
                )}%`}
              />

              <ValidationMetric
                label="Exact optimum"
                value={`${data.metrics.exactOptimumPercent.toFixed(
                  1,
                )}%`}
              />

              <ValidationMetric
                label="Mean Z error"
                value={`${data.metrics.meanErrorMicrons.toFixed(
                  1,
                )} µm`}
              />
            </div>

            <div className="validationDetailsGrid">
              <div className="validationDetail">
                <span>
                  Algorithm
                </span>

                <strong>
                  {data.algorithm}
                </strong>
              </div>

              <div className="validationDetail">
                <span>
                  Laser reference
                </span>

                <strong>
                  Z=
                  {
                    data
                      .groundTruth
                      .laserOptimalZ
                  }
                </strong>
              </div>

              <div className="validationDetail">
                <span>
                  Expert focus band
                </span>

                <strong>
                  Z=
                  {
                    data
                      .groundTruth
                      .expertFocusBand[
                      0
                    ]
                  }
                  –
                  {
                    data
                      .groundTruth
                      .expertFocusBand[
                      1
                    ]
                  }
                </strong>
              </div>

              <div className="validationDetail">
                <span>
                  Median error
                </span>

                <strong>
                  {
                    data.metrics
                      .medianErrorPlanes
                  }
                  {" "}
                  planes
                </strong>
              </div>
            </div>

            {chartPoints && (
              <div className="validationChart">
                <div className="validationChartHeader">
                  <span>
                    SAMPLE Z-STACK
                  </span>

                  <small>
                    Focus score vs Z
                  </small>
                </div>

                <svg
                  viewBox="0 0 600 150"
                  role="img"
                  aria-label="Sample focus score curve"
                >
                  <line
                    x1="20"
                    y1="130"
                    x2="580"
                    y2="130"
                    className="validationAxis"
                  />

                  <line
                    x1={
                      chartPoints
                        .optimalX
                    }
                    y1="12"
                    x2={
                      chartPoints
                        .optimalX
                    }
                    y2="130"
                    className="validationReference"
                  />

                  <polyline
                    points={
                      chartPoints.points
                    }
                    className="validationCurve"
                  />

                  {chartPoints.circles.map(
                    (circle) => (
                      <circle
                        key={
                          circle.key
                        }
                        cx={circle.x}
                        cy={circle.y}
                        r="4"
                        className={
                          circle.z ===
                          data
                            .groundTruth
                            .laserOptimalZ
                            ? "validationPoint validationPointBest"
                            : "validationPoint"
                        }
                      />
                    ),
                  )}
                </svg>

                <div className="validationChartLegend">
                  <span>
                    Sampled:
                    {" "}
                    {
                      data.sampling
                        .zPlanes
                        .join(
                          ", ",
                        )
                    }
                  </span>

                  <span>
                    Reference Z=
                    {
                      data
                        .groundTruth
                        .laserOptimalZ
                    }
                  </span>
                </div>
              </div>
            )}

            <div className="validationEvidence">
              <strong>
                What this proves
              </strong>

              <p>
                The production focus
                metric was evaluated
                against independently
                acquired real microscopy
                fields rather than only
                synthetic images.
              </p>
            </div>

            <div className="validationDisclaimer">
              {data.disclaimer}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function ValidationMetric({
  label,
  value,
}: {
  label: string;

  value:
    string | number;
}) {
  return (
    <div className="validationMetric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function createChartPoints(
  values:
    CurvePoint[],
) {
  if (
    values.length <
    2
  ) {
    return null;
  }

  const width = 560;

  const height = 108;

  const left = 20;

  const top = 14;

  const minZ =
    Math.min(
      ...values.map(
        (item) =>
          item.z,
      ),
    );

  const maxZ =
    Math.max(
      ...values.map(
        (item) =>
          item.z,
      ),
    );

  const scores =
    values.map(
      (item) =>
        item.focusScore,
    );

  const minScore =
    Math.min(
      ...scores,
    );

  const maxScore =
    Math.max(
      ...scores,
    );

  const zRange =
    Math.max(
      maxZ - minZ,
      1,
    );

  const scoreRange =
    Math.max(
      maxScore -
        minScore,
      1,
    );

  const circles =
    values.map(
      (item) => {
        const x =
          left +
          ((item.z -
            minZ) /
            zRange) *
            width;

        const y =
          top +
          height -
          ((item.focusScore -
            minScore) /
            scoreRange) *
            height;

        return {
          key:
            `${item.z}-${item.focusScore}`,
          z:
            item.z,
          x,
          y,
        };
      },
    );

  const optimal =
    values.find(
      (item) =>
        item.z === 16,
    ) ??
    values[0];

  const optimalX =
    left +
    ((optimal.z -
      minZ) /
      zRange) *
      width;

  return {
    points:
      circles
        .map(
          (circle) =>
            `${circle.x},${circle.y}`,
        )
        .join(" "),

    circles,

    optimalX,
  };
}