"use client";

import {
  type ChangeEvent,
} from "react";

import {
  type MicroscopeMode,
} from "@/lib/microscope-config";

type ResearchImageSourcePanelProps = {
  mode: MicroscopeMode;
  researchImageName: string | null;
  analyzingField: boolean;
  onLoadImage: (
    event: ChangeEvent<HTMLInputElement>,
  ) => void | Promise<void>;
  onClear: () => void;
};

export function ResearchImageSourcePanel({
  mode,
  researchImageName,
  analyzingField,
  onLoadImage,
  onClear,
}: ResearchImageSourcePanelProps) {
  const canUpload =
    mode === "simulation";

  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div className="cardHeader">
        <div>
          RESEARCH IMAGE SOURCE
        </div>

        <span>
          {researchImageName
            ? "LOADED"
            : "OPTIONAL"}
        </span>
      </div>

      <label
        style={{
          display:
            "inline-flex",
          alignItems:
            "center",
          justifyContent:
            "center",
          minHeight: 36,
          padding:
            "0 12px",
          border:
            "1px solid rgba(255,255,255,0.12)",
          borderRadius: 5,
          cursor:
            canUpload
              ? "pointer"
              : "not-allowed",
          opacity:
            canUpload
              ? 1
              : 0.5,
        }}
      >
        UPLOAD MICROSCOPY IMAGE

        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={
            !canUpload
          }
          onChange={(
            event,
          ) =>
            void onLoadImage(
              event,
            )
          }
          style={{
            display:
              "none",
          }}
        />
      </label>

      {researchImageName && (
        <>
          <div className="tiny">
            Loaded:{" "}
            <strong>
              {
                researchImageName
              }
            </strong>
          </div>

          <button
            onClick={
              onClear
            }
            disabled={
              analyzingField
            }
          >
            REMOVE RESEARCH IMAGE
          </button>
        </>
      )}

      <p className="tiny">
        Static research images are loaded
        without changing their original
        inference resolution. Display
        scaling preserves aspect ratio.
        Research use only.
      </p>
    </div>
  );
}
