"use client";

import {
  useMemo,
} from "react";

import {
  type ScanField,
  type ScanMachineSnapshot,
  type ScanPlan,
} from "@/lib/scan";


type ScanGridPreviewProps = {
  plan:
    ScanPlan | null;

  snapshot?:
    ScanMachineSnapshot | null;
};


function fieldKey(
  row:
    number,

  column:
    number,
): string {
  return `${row}:${column}`;
}


export function ScanGridPreview({
  plan,
  snapshot = null,
}: ScanGridPreviewProps) {
  const grid =
    useMemo(
      () => {
        if (
          !plan
        ) {
          return null;
        }

        const rowCount =
          Math.max(
            ...plan.fields.map(
              (
                field,
              ) =>
                field.row,
            ),
          ) +
          1;

        const columnCount =
          Math.max(
            ...plan.fields.map(
              (
                field,
              ) =>
                field.column,
            ),
          ) +
          1;

        const fieldsByPosition =
          new Map<
            string,
            ScanField
          >();

        for (
          const field
          of plan.fields
        ) {
          fieldsByPosition.set(
            fieldKey(
              field.row,
              field.column,
            ),
            field,
          );
        }

        return {
          rowCount,
          columnCount,
          fieldsByPosition,
        };
      },
      [
        plan,
      ],
    );


  const runtimeById =
    useMemo(
      () => {
        return new Map(
          (
            snapshot?.fields ??
            []
          ).map(
            (
              field,
            ) => [
              field.id,
              field,
            ],
          ),
        );
      },
      [
        snapshot,
      ],
    );


  return (
    <div className="card researchCard">
      <div className="cardHeader">
        <div>
          SCAN GRID PREVIEW
        </div>

        <span>
          {plan
            ? plan.serpentine
              ? "SERPENTINE"
              : "ROW-MAJOR"
            : "WAITING"}
        </span>
      </div>

      {!plan ||
      !grid ? (
        <div className="trendPlaceholder">
          Enter a valid scan configuration
          to preview the field order.
        </div>
      ) : (
        <>
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                `repeat(${grid.columnCount}, minmax(52px, 1fr))`,

              gap:
                7,

              overflowX:
                "auto",
            }}
          >
            {Array.from(
              {
                length:
                  grid.rowCount,
              },
            ).flatMap(
              (
                _,
                row,
              ) =>
                Array.from(
                  {
                    length:
                      grid.columnCount,
                  },
                ).map(
                  (
                    __,
                    column,
                  ) => {
                    const field =
                      grid.fieldsByPosition.get(
                        fieldKey(
                          row,
                          column,
                        ),
                      );

                    if (
                      !field
                    ) {
                      return (
                        <div
                          key={
                            fieldKey(
                              row,
                              column,
                            )
                          }
                          className="pipelineBox"
                          style={{
                            opacity:
                              0.25,
                          }}
                        />
                      );
                    }


                    const runtime =
                      runtimeById.get(
                        field.id,
                      );

                    const isCurrent =
                      snapshot
                        ?.currentField
                        ?.id ===
                      field.id;


                    return (
                      <div
                        key={
                          field.id
                        }
                        className="pipelineBox"
                        title={
                          `${field.id}: X=${field.xUm} µm, Y=${field.yUm} µm`
                        }
                        style={{
                          minHeight:
                            68,

                          display:
                            "flex",

                          flexDirection:
                            "column",

                          justifyContent:
                            "center",

                          gap:
                            3,

                          outline:
                            isCurrent
                              ? "2px solid currentColor"
                              : undefined,

                          opacity:
                            runtime
                              ?.status ===
                                "skipped"
                              ? 0.55
                              : 1,
                        }}
                      >
                        <strong>
                          {field.sequence +
                            1}
                        </strong>

                        <span>
                          R{field.row +
                            1}
                          {" "}
                          C{field.column +
                            1}
                        </span>

                        <span>
                          {runtime
                            ? runtime.status.toUpperCase()
                            : field.direction ===
                                "reverse"
                              ? "←"
                              : "→"}
                        </span>
                      </div>
                    );
                  },
                ),
            )}
          </div>

          <div
            className="resultRow"
            style={{
              marginTop:
                10,
            }}
          >
            <span>
              Acquisition order
            </span>

            <strong>
              1 → {plan.totalFields}
            </strong>
          </div>

          <p className="tiny">
            Cell numbers represent acquisition
            sequence. During execution each cell
            shows the ScanRunner field status and
            the active field receives an outline.
          </p>
        </>
      )}
    </div>
  );
}
