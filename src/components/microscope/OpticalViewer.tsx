"use client";

import type {
  RefObject,
} from "react";

import {
  MICROSCOPE_CONFIG,
  type MicroscopeMode,
} from "@/lib/microscope-config";

import {
  blurForSimulationZ,
} from "@/lib/synthetic-field";


type OpticalViewerProps = {
  canvasRef:
    RefObject<HTMLCanvasElement | null>;

  analysisOverlayRef:
    RefObject<HTMLCanvasElement | null>;

  canvasWidth:
    number;

  canvasHeight:
    number;

  viewerLabel:
    string;

  mode:
    MicroscopeMode;

  cameraActive:
    boolean;

  cameraError:
    string | null;

  onStartCamera:
    () =>
      void |
      Promise<void>;

  focusScore:
    number;

  relativeDetail:
    number;

  z:
    number;

  analyzingField:
    boolean;

  analysisComplete:
    boolean;

  hardwareConnected:
    boolean;

  hardwareArmed:
    boolean;
};


export function OpticalViewer({
  canvasRef,
  analysisOverlayRef,
  canvasWidth,
  canvasHeight,
  viewerLabel,
  mode,
  cameraActive,
  cameraError,
  onStartCamera,
  focusScore,
  relativeDetail,
  z,
  analyzingField,
  analysisComplete,
  hardwareConnected,
  hardwareArmed,
}: OpticalViewerProps) {
  const {
    camera:
      CAMERA,

    hardware:
      HARDWARE,
  } =
    MICROSCOPE_CONFIG;


  const acquisitionState =
    mode ===
      "simulation"
      ? "SIMULATION"
      : cameraActive
        ? "LIVE"
        : "OFFLINE";


  const controllerState =
    mode !==
      "hardware"
      ? "VIRTUAL"
      : !hardwareConnected
        ? "OFFLINE"
        : hardwareArmed
          ? "ARMED"
          : "CONNECTED";


  const analysisState =
    analyzingField
      ? "RUNNING"
      : analysisComplete
        ? "COMPLETE"
        : "READY";


  return (
    <div className="viewerCard card opticalViewerCard">
      <div className="cardHeader opticalViewerHeader">
        <div className="opticalViewerTitle">
          <span className="liveDot" />

          <span>
            OPTICAL FIELD
          </span>
        </div>

        <span className="opticalViewerSource">
          {viewerLabel}
        </span>
      </div>


      <div className="canvasWrap">
        <canvas
          ref={
            canvasRef
          }
          width={
            canvasWidth
          }
          height={
            canvasHeight
          }
        />


        <canvas
          ref={
            analysisOverlayRef
          }
          width={
            canvasWidth
          }
          height={
            canvasHeight
          }
          className="analysisOverlay"
          aria-hidden="true"
        />


        {mode !==
          "simulation" &&
          !cameraActive && (
            <div className="cameraEmptyState">
              <div className="cameraEmptyIcon">
                ◉
              </div>

              <strong>
                Connect a microscope camera
              </strong>

              <span>
                Start the laptop camera or a
                USB microscope camera to use
                real optical pixels for focus
                measurement and field
                analysis.
              </span>

              <button
                type="button"
                className="primary cameraConnect"
                onClick={() =>
                  void onStartCamera()
                }
              >
                START LIVE CAMERA
              </button>

              {cameraError && (
                <small>
                  {cameraError}
                </small>
              )}
            </div>
          )}


        <div
          className="reticle horizontal"
          aria-hidden="true"
        />

        <div
          className="reticle vertical"
          aria-hidden="true"
        />


        <div className="viewerCornerStatus">
          <span
            className={
              cameraActive ||
              mode ===
                "simulation"
                ? "viewerCornerDot viewerCornerDotGood"
                : "viewerCornerDot"
            }
          />

          {acquisitionState}
        </div>


        <div className="scaleBar">
          100 μm
        </div>
      </div>


      <div className="instrumentTelemetry">
        <TelemetryItem
          label="Acquisition"
          value={
            acquisitionState
          }
          state="good"
        />


        <TelemetryItem
          label="Focus score"
          value={
            focusScore.toFixed(
              1,
            )
          }
        />


        <TelemetryItem
          label="Focus quality"
          value={
            `${relativeDetail}%`
          }
          state={
            relativeDetail >
            65
              ? "good"
              : relativeDetail >
                  35
                ? "warning"
                : "neutral"
          }
        />


        <TelemetryItem
          label="Z position"
          value={
            mode ===
              "camera"
              ? "N/A"
              : `${z} AU`
          }
        />


        <TelemetryItem
          label="Analysis"
          value={
            analysisState
          }
          state={
            analysisComplete
              ? "good"
              : analyzingField
                ? "warning"
                : "neutral"
          }
        />


        <TelemetryItem
          label="Controller"
          value={
            controllerState
          }
          state={
            mode !==
              "hardware" ||
            hardwareArmed
              ? "good"
              : hardwareConnected
                ? "warning"
                : "neutral"
          }
        />
      </div>


      <div className="viewerFooter">
        <div>
          {mode ===
            "simulation" ? (
              <>
                <span>
                  Objective simulation:
                  {" "}
                  40×
                </span>

                <span>
                  Blur estimate:
                  {" "}
                  {blurForSimulationZ(
                    z,
                  ).toFixed(
                    2,
                  )}
                  {" "}
                  px
                </span>
              </>
            ) : (
              <span>
                Focus sampling:
                {" "}
                {
                  CAMERA.measurementWidth
                }
                ×
                {
                  CAMERA.measurementHeight
                }
                {" "}
                px
              </span>
            )}


          {mode ===
            "hardware" && (
              <span>
                Motor scale:
                {" "}
                {
                  HARDWARE.motorStepsPerVirtualUnit
                }
                {" "}
                steps / virtual Z
              </span>
            )}
        </div>


        <strong>
          Laplacian variance
          {" "}
          {focusScore.toFixed(
            2,
          )}
        </strong>
      </div>
    </div>
  );
}


function TelemetryItem({
  label,
  value,
  state =
    "neutral",
}: {
  label:
    string;

  value:
    string;

  state?:
    | "good"
    | "warning"
    | "neutral";
}) {
  return (
    <div className="telemetryItem">
      <span>
        {label}
      </span>

      <strong
        className={
          state ===
          "good"
            ? "telemetryGood"
            : state ===
                "warning"
              ? "telemetryWarning"
              : undefined
        }
      >
        {value}
      </strong>
    </div>
  );
}