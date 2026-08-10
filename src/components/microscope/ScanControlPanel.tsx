"use client";

import {
  type ScanGridConfig,
  type ScanPlan,
} from "@/lib/scan";


type ScanControlPanelProps = {
  config:
    ScanGridConfig;

  plan:
    ScanPlan | null;

  planError:
    string | null;

  travelUm:
    number;

  disabled?:
    boolean;

  onChange:
    (
      nextConfig:
        ScanGridConfig,
    ) => void;

  onReset:
    () => void;
};


type NumericConfigKey =
  | "rows"
  | "columns"
  | "originXUm"
  | "originYUm"
  | "stepXUm"
  | "stepYUm";


function readNumber(
  value:
    string,
): number {
  const parsed =
    Number(
      value,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}


export function ScanControlPanel({
  config,
  plan,
  planError,
  travelUm,
  disabled = false,
  onChange,
  onReset,
}: ScanControlPanelProps) {
  const updateNumber =
    (
      key:
        NumericConfigKey,

      value:
        string,
    ) => {
      onChange(
        {
          ...config,

          [key]:
            readNumber(
              value,
            ),
        },
      );
    };


  const updateSerpentine =
    (
      checked:
        boolean,
    ) => {
      onChange(
        {
          ...config,

          serpentine:
            checked,
        },
      );
    };


  return (
    <div className="card researchCard">
      <div className="cardHeader">
        <div>
          SLIDE SCAN CONFIGURATION
        </div>

        <span>
          {plan
            ? `${plan.totalFields} FIELDS`
            : "INVALID PLAN"}
        </span>
      </div>

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(2, minmax(0, 1fr))",

          gap:
            10,
        }}
      >
        <label className="tiny">
          Rows

          <input
            aria-label="Scan rows"
            type="number"
            min={1}
            step={1}
            value={
              config.rows
            }
            disabled={
              disabled
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "rows",
                event.target.value,
              )
            }
          />
        </label>

        <label className="tiny">
          Columns

          <input
            aria-label="Scan columns"
            type="number"
            min={1}
            step={1}
            value={
              config.columns
            }
            disabled={
              disabled
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "columns",
                event.target.value,
              )
            }
          />
        </label>

        <label className="tiny">
          Origin X (µm)

          <input
            aria-label="Scan origin X"
            type="number"
            value={
              config.originXUm
            }
            disabled={
              disabled
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "originXUm",
                event.target.value,
              )
            }
          />
        </label>

        <label className="tiny">
          Origin Y (µm)

          <input
            aria-label="Scan origin Y"
            type="number"
            value={
              config.originYUm
            }
            disabled={
              disabled
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "originYUm",
                event.target.value,
              )
            }
          />
        </label>

        <label className="tiny">
          Step X (µm)

          <input
            aria-label="Scan step X"
            type="number"
            min={1}
            value={
              config.stepXUm
            }
            disabled={
              disabled
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "stepXUm",
                event.target.value,
              )
            }
          />
        </label>

        <label className="tiny">
          Step Y (µm)

          <input
            aria-label="Scan step Y"
            type="number"
            min={1}
            value={
              config.stepYUm
            }
            disabled={
              disabled
            }
            onChange={(
              event,
            ) =>
              updateNumber(
                "stepYUm",
                event.target.value,
              )
            }
          />
        </label>
      </div>

      <label
        className="tiny"
        style={{
          display:
            "flex",

          alignItems:
            "center",

          gap:
            8,

          marginTop:
            10,
        }}
      >
        <input
          type="checkbox"
          checked={
            config.serpentine ??
            true
          }
          disabled={
            disabled
          }
          onChange={(
            event,
          ) =>
            updateSerpentine(
              event.target.checked,
            )
          }
        />

        Serpentine traversal
      </label>

      {plan ? (
        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",

            gap:
              8,

            marginTop:
              12,
          }}
        >
          <div className="resultRow">
            <span>
              Fields
            </span>

            <strong>
              {
                plan.totalFields
              }
            </strong>
          </div>

          <div className="resultRow">
            <span>
              XY travel
            </span>

            <strong>
              {travelUm.toFixed(
                0,
              )} µm
            </strong>
          </div>

          <div className="resultRow">
            <span>
              X extent
            </span>

            <strong>
              {plan.extent.minXUm}
              {" → "}
              {plan.extent.maxXUm}
            </strong>
          </div>

          <div className="resultRow">
            <span>
              Y extent
            </span>

            <strong>
              {plan.extent.minYUm}
              {" → "}
              {plan.extent.maxYUm}
            </strong>
          </div>
        </div>
      ) : (
        <p
          className="tiny"
          role="alert"
          style={{
            marginTop:
              12,
          }}
        >
          {planError}
        </p>
      )}

      <button
        type="button"
        onClick={
          onReset
        }
        disabled={
          disabled
        }
        style={{
          marginTop:
            10,
        }}
      >
        RESET SCAN CONFIGURATION
      </button>

      <p className="tiny">
        Planning values are stage coordinates
        in micrometres. Real hardware still
        requires physical limit switches and
        controller-side travel limits.
      </p>
    </div>
  );
}
