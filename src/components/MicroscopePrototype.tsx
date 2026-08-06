"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  isAbortError,
  runCoarseFineAutofocus,
  type AutofocusSample,
} from "@/lib/autofocus-engine";

import {
  MICROSCOPE_CONFIG,
  type MicroscopeMode,
} from "@/lib/microscope-config";

import {
  blurForSimulationZ,
  drawSyntheticBloodField,
} from "@/lib/synthetic-field";

import {
  calculateLaplacianVariance,
} from "@/lib/focus";

import {
  SerialMicroscopeController,
} from "@/lib/serial-controller";

import {
  CellAnalysisPanel,
} from "@/components/CellAnalysisPanel";

import {
  analyzeBloodField,
  type CellAnalysisResult,
} from "@/lib/cell-analysis";

import {
  TestProfileSelector,
} from "@/components/TestProfileSelector";

import {
  KnowledgeBasePanel,
} from "@/components/KnowledgeBasePanel";

import {
  ReportActions,
} from "@/components/ReportActions";

import {
  AnalysisHistory,
} from "@/components/AnalysisHistory";

import {
  DEFAULT_TEST_PROFILE_ID,
  getTestProfile,
} from "@/knowledge/test-profiles";

import {
  createAnalysisSnapshot,
  type AnalysisSnapshot,
} from "@/lib/analysis-snapshot";

import {
  captureAnalyzedImage,
} from "@/lib/reports/capture-analysis-image";

import {
  deleteAnalysisSnapshot,
  listAnalysisSnapshots,
  saveAnalysisSnapshot,
} from "@/lib/analysis-history";

/* =========================================================
   TYPES
   ========================================================= */

type LogLevel =
  | "info"
  | "success"
  | "warning"
  | "error";

type LogEntry = {
  id: number;

  time: string;

  level: LogLevel;

  message: string;
};

/* =========================================================
   CONFIG
   ========================================================= */

const {
  canvas: CANVAS,
  simulation: SIMULATION,
  camera: CAMERA,
  hardware: HARDWARE,
  logs: LOGS,
} = MICROSCOPE_CONFIG;

/* =========================================================
   HELPERS
   ========================================================= */

function nowTime(): string {
  return new Date().toLocaleTimeString(
    [],
    {
      hour12: false,
    },
  );
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(
    min,
    Math.min(
      max,
      value,
    ),
  );
}

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

export function MicroscopePrototype() {
  /* -------------------------------------------------------
     CANVAS / VIDEO REFS
     ------------------------------------------------------- */

  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null,
    );

  const syntheticCanvasRef =
    useRef<HTMLCanvasElement | null>(
      null,
    );

  const measurementCanvasRef =
    useRef<HTMLCanvasElement | null>(
      null,
    );

  const analysisCanvasRef =
    useRef<HTMLCanvasElement | null>(
      null,
    );

  const analysisOverlayRef =
    useRef<HTMLCanvasElement | null>(
      null,
    );

  const videoRef =
    useRef<HTMLVideoElement | null>(
      null,
    );

  const streamRef =
    useRef<MediaStream | null>(
      null,
    );

  /* -------------------------------------------------------
     CONTROLLER REFS
     ------------------------------------------------------- */

  const controllerRef =
    useRef<
      SerialMicroscopeController | null
    >(
      null,
    );

  const autofocusAbortRef =
    useRef<AbortController | null>(
      null,
    );

  const cameraSessionRef =
    useRef(
      0,
    );

  const zRef =
    useRef(
      28,
    );

  const logIdRef =
    useRef(
      0,
    );

  const livePeakRef =
    useRef(
      0,
    );

  /* -------------------------------------------------------
     CORE STATE
     ------------------------------------------------------- */

  const [
    mode,
    setMode,
  ] =
    useState<MicroscopeMode>(
      "simulation",
    );

  const [
    z,
    setZ,
  ] =
    useState(
      28,
    );

  const [
    focusScore,
    setFocusScore,
  ] =
    useState(
      0,
    );

  const [
    bestScore,
    setBestScore,
  ] =
    useState(
      0,
    );

  const [
    bestZ,
    setBestZ,
  ] =
    useState<
      number | null
    >(
      null,
    );

  const [
    running,
    setRunning,
  ] =
    useState(
      false,
    );

  const [
    hardwareConnected,
    setHardwareConnected,
  ] =
    useState(
      false,
    );

  const [
    hardwareArmed,
    setHardwareArmed,
  ] =
    useState(
      false,
    );

  const [
    cameraActive,
    setCameraActive,
  ] =
    useState(
      false,
    );

  const [
    cameraError,
    setCameraError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    status,
    setStatus,
  ] =
    useState(
      "OUT OF FOCUS",
    );

  const [
    progress,
    setProgress,
  ] =
    useState(
      0,
    );

  const [
    cameraHistory,
    setCameraHistory,
  ] =
    useState<
      number[]
    >(
      [],
    );

  const [
    autofocusSamples,
    setAutofocusSamples,
  ] =
    useState<
      AutofocusSample[]
    >(
      [],
    );

  /* -------------------------------------------------------
     FIELD ANALYSIS STATE
     ------------------------------------------------------- */

  const [
    analysisResult,
    setAnalysisResult,
  ] =
    useState<
      CellAnalysisResult | null
    >(
      null,
    );

  const [
    analyzingField,
    setAnalyzingField,
  ] =
    useState(
      false,
    );

  /* -------------------------------------------------------
     TEST PROFILE / KNOWLEDGE BASE
     ------------------------------------------------------- */

  const [
    selectedProfileId,
    setSelectedProfileId,
  ] =
    useState(
      DEFAULT_TEST_PROFILE_ID,
    );

  const activeProfile =
    useMemo(
      () =>
        getTestProfile(
          selectedProfileId,
        ),
      [
        selectedProfileId,
      ],
    );

  /* -------------------------------------------------------
     REPORT / HISTORY STATE
     ------------------------------------------------------- */

  const [
    latestSnapshot,
    setLatestSnapshot,
  ] =
    useState<
      AnalysisSnapshot | null
    >(
      null,
    );

  const [
    analysisHistory,
    setAnalysisHistory,
  ] =
    useState<
      AnalysisSnapshot[]
    >(
      [],
    );

  /* -------------------------------------------------------
     LOGGING
     ------------------------------------------------------- */

  const [
    logs,
    setLogs,
  ] =
    useState<
      LogEntry[]
    >(
      [],
    );

  const log =
    useCallback(
      (
        message: string,
        level:
          LogLevel =
          "info",
      ) => {
        const entry:
          LogEntry = {
          id:
            ++logIdRef.current,

          time:
            nowTime(),

          level,

          message,
        };

        setLogs(
          (
            current,
          ) =>
            [
              entry,
              ...current,
            ].slice(
              0,
              LOGS.maxEntries,
            ),
        );
      },
      [],
    );

  useEffect(
    () => {
      log(
        "Research prototype initialized. Simulation mode is active.",
        "success",
      );
    },
    [
      log,
    ],
  );

  /* =======================================================
     SERIAL CONTROLLER
     ======================================================= */

  const getController =
    useCallback(
      () => {
        if (
          !controllerRef.current
        ) {
          controllerRef.current =
            new SerialMicroscopeController();
        }

        return controllerRef.current;
      },
      [],
    );

  /* =======================================================
     CANVAS HELPERS
     ======================================================= */

  const getSyntheticCanvas =
    useCallback(
      () => {
        if (
          !syntheticCanvasRef.current
        ) {
          const canvas =
            document.createElement(
              "canvas",
            );

          canvas.width =
            CANVAS.width;

          canvas.height =
            CANVAS.height;

          drawSyntheticBloodField(
            canvas,
          );

          syntheticCanvasRef.current =
            canvas;
        }

        return syntheticCanvasRef.current;
      },
      [],
    );

  const getMeasurementCanvas =
    useCallback(
      () => {
        if (
          !measurementCanvasRef.current
        ) {
          const canvas =
            document.createElement(
              "canvas",
            );

          canvas.width =
            CAMERA.measurementWidth;

          canvas.height =
            CAMERA.measurementHeight;

          measurementCanvasRef.current =
            canvas;
        }

        return measurementCanvasRef.current;
      },
      [],
    );

  const getAnalysisCanvas =
    useCallback(
      () => {
        if (
          !analysisCanvasRef.current
        ) {
          const canvas =
            document.createElement(
              "canvas",
            );

          canvas.width =
            CAMERA.measurementWidth;

          canvas.height =
            CAMERA.measurementHeight;

          analysisCanvasRef.current =
            canvas;
        }

        return analysisCanvasRef.current;
      },
      [],
    );

  /* =======================================================
     CLEAR ANALYSIS
     ======================================================= */

  const clearCellAnalysis =
    useCallback(
      () => {
        setAnalysisResult(
          null,
        );

        const overlay =
          analysisOverlayRef.current;

        if (
          !overlay
        ) {
          return;
        }

        const ctx =
          overlay.getContext(
            "2d",
          );

        ctx?.clearRect(
          0,
          0,
          overlay.width,
          overlay.height,
        );
      },
      [],
    );

  /* =======================================================
     DRAW DETECTION OVERLAY
     ======================================================= */

  const drawCellAnalysisOverlay =
    useCallback(
      (
        result:
          CellAnalysisResult,
      ) => {
        const overlay =
          analysisOverlayRef.current;

        if (
          !overlay
        ) {
          return;
        }

        const ctx =
          overlay.getContext(
            "2d",
          );

        if (
          !ctx
        ) {
          return;
        }

        ctx.clearRect(
          0,
          0,
          overlay.width,
          overlay.height,
        );

        const scaleX =
          overlay.width /
          result.imageWidth;

        const scaleY =
          overlay.height /
          result.imageHeight;

        for (
          const candidate
          of result.candidates
        ) {
          const x =
            candidate.x *
            scaleX;

          const y =
            candidate.y *
            scaleY;

          const width =
            candidate.width *
            scaleX;

          const height =
            candidate.height *
            scaleY;

          let stroke =
            "#ff8a9a";

          let background =
            "rgba(120, 35, 47, 0.86)";

          let label =
            "RBC-like";

          if (
            candidate.type ===
            "wbc"
          ) {
            stroke =
              "#b49cff";

            background =
              "rgba(74, 53, 130, 0.90)";

            label =
              "WBC-like";
          }

          if (
            candidate.type ===
            "platelet"
          ) {
            stroke =
              "#7ed9ff";

            background =
              "rgba(34, 90, 112, 0.90)";

            label =
              "PLT-like";
          }

          ctx.lineWidth =
            candidate.type ===
            "platelet"
              ? 1.5
              : 2.2;

          ctx.strokeStyle =
            stroke;

          ctx.strokeRect(
            x,
            y,
            width,
            height,
          );

          const score =
            Math.round(
              candidate.score *
              100,
            );

          const text =
            `${label} ${score}`;

          ctx.font =
            "700 11px Arial";

          const textWidth =
            ctx.measureText(
              text,
            ).width;

          const labelWidth =
            textWidth +
            10;

          const labelHeight =
            18;

          const labelY =
            y >=
            labelHeight +
            4
              ? y -
                labelHeight -
                2
              : y +
                2;

          ctx.fillStyle =
            background;

          ctx.fillRect(
            x,
            labelY,
            labelWidth,
            labelHeight,
          );

          ctx.fillStyle =
            "#ffffff";

          ctx.fillText(
            text,
            x +
            5,
            labelY +
            12,
          );
        }
      },
      [],
    );

  /* =======================================================
     ANALYSIS HISTORY
     ======================================================= */

  const refreshAnalysisHistory =
    useCallback(
      async () => {
        try {
          const history =
            await listAnalysisSnapshots();

          setAnalysisHistory(
            history,
          );
        } catch (
          error
        ) {
          log(
            error instanceof
              Error
              ? error.message
              : "Unable to load analysis history.",
            "error",
          );
        }
      },
      [
        log,
      ],
    );

  useEffect(
    () => {
      void refreshAnalysisHistory();
    },
    [
      refreshAnalysisHistory,
    ],
  );

  const removeHistoryRecord =
    useCallback(
      async (
        id:
          string,
      ) => {
        try {
          await deleteAnalysisSnapshot(
            id,
          );

          if (
            latestSnapshot?.id ===
            id
          ) {
            setLatestSnapshot(
              null,
            );
          }

          await refreshAnalysisHistory();

          log(
            "Analysis record deleted.",
            "info",
          );
        } catch (
          error
        ) {
          log(
            error instanceof
              Error
              ? error.message
              : "Unable to delete analysis record.",
            "error",
          );
        }
      },
      [
        latestSnapshot,
        log,
        refreshAnalysisHistory,
      ],
    );

  /* =======================================================
     STAGE POSITION
     ======================================================= */

  const setStagePosition =
    useCallback(
      (
        nextZ:
          number,
      ) => {
        const bounded =
          clamp(
            nextZ,
            SIMULATION.minZ,
            SIMULATION.maxZ,
          );

        zRef.current =
          bounded;

        setZ(
          bounded,
        );
      },
      [],
    );

  /* =======================================================
     FOCUS STATUS
     ======================================================= */

  const updateSimulationStatus =
    useCallback(
      (
        score:
          number,
      ) => {
        if (
          score >
          85
        ) {
          setStatus(
            "FOCUSED",
          );
        } else if (
          score >
          35
        ) {
          setStatus(
            "NEAR FOCUS",
          );
        } else {
          setStatus(
            "OUT OF FOCUS",
          );
        }
      },
      [],
    );

  const updateLiveFocusState =
    useCallback(
      (
        score:
          number,
      ) => {
        const peak =
          Math.max(
            livePeakRef.current,
            score,
            1,
          );

        livePeakRef.current =
          peak;

        const relative =
          score /
          peak;

        if (
          relative >=
          0.75
        ) {
          setStatus(
            "LIVE: HIGH RELATIVE DETAIL",
          );
        } else if (
          relative >=
          0.4
        ) {
          setStatus(
            "LIVE: USABLE RELATIVE DETAIL",
          );
        } else {
          setStatus(
            "LIVE: LOW RELATIVE DETAIL",
          );
        }

        setFocusScore(
          score,
        );

        setCameraHistory(
          (
            current,
          ) =>
            [
              ...current,
              score,
            ].slice(
              -CAMERA.historySize,
            ),
        );
      },
      [],
    );

  /* =======================================================
     SIMULATION RENDER
     ======================================================= */

  const renderSimulationAtZ =
    useCallback(
      (
        nextZ:
          number,
      ): number => {
        const canvas =
          canvasRef.current;

        if (
          !canvas
        ) {
          throw new Error(
            "Microscope display canvas is unavailable.",
          );
        }

        const ctx =
          canvas.getContext(
            "2d",
            {
              willReadFrequently:
                true,
            },
          );

        if (
          !ctx
        ) {
          throw new Error(
            "2D canvas context is unavailable.",
          );
        }

        const source =
          getSyntheticCanvas();

        ctx.clearRect(
          0,
          0,
          CANVAS.width,
          CANVAS.height,
        );

        ctx.save();

        ctx.filter =
          `blur(${blurForSimulationZ(
            nextZ,
          ).toFixed(
            2,
          )}px)`;

        ctx.drawImage(
          source,
          0,
          0,
        );

        ctx.restore();

        const image =
          ctx.getImageData(
            0,
            0,
            CANVAS.width,
            CANVAS.height,
          );

        const score =
          calculateLaplacianVariance(
            image,
          );

        setFocusScore(
          score,
        );

        updateSimulationStatus(
          score,
        );

        return score;
      },
      [
        getSyntheticCanvas,
        updateSimulationStatus,
      ],
    );

  /* =======================================================
     CAMERA RENDER
     ======================================================= */

  const drawVideoToCanvas =
    useCallback(
      (): boolean => {
        const video =
          videoRef.current;

        const canvas =
          canvasRef.current;

        if (
          !video ||
          !canvas ||
          video.readyState <
          HTMLMediaElement.HAVE_CURRENT_DATA ||
          video.videoWidth <=
          0 ||
          video.videoHeight <=
          0
        ) {
          return false;
        }

        const ctx =
          canvas.getContext(
            "2d",
          );

        if (
          !ctx
        ) {
          return false;
        }

        const videoRatio =
          video.videoWidth /
          video.videoHeight;

        const canvasRatio =
          CANVAS.width /
          CANVAS.height;

        let sourceX =
          0;

        let sourceY =
          0;

        let sourceWidth =
          video.videoWidth;

        let sourceHeight =
          video.videoHeight;

        if (
          videoRatio >
          canvasRatio
        ) {
          sourceWidth =
            video.videoHeight *
            canvasRatio;

          sourceX =
            (
              video.videoWidth -
              sourceWidth
            ) /
            2;
        } else if (
          videoRatio <
          canvasRatio
        ) {
          sourceHeight =
            video.videoWidth /
            canvasRatio;

          sourceY =
            (
              video.videoHeight -
              sourceHeight
            ) /
            2;
        }

        ctx.drawImage(
          video,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          CANVAS.width,
          CANVAS.height,
        );

        return true;
      },
      [],
    );

  /* =======================================================
     CAMERA FOCUS MEASUREMENT
     ======================================================= */

  const measureCameraFocusNow =
    useCallback(
      (): number => {
        const video =
          videoRef.current;

        if (
          !video ||
          video.readyState <
          HTMLMediaElement.HAVE_CURRENT_DATA ||
          video.videoWidth <=
          0 ||
          video.videoHeight <=
          0
        ) {
          throw new Error(
            "Camera does not have a readable frame yet.",
          );
        }

        const canvas =
          getMeasurementCanvas();

        const ctx =
          canvas.getContext(
            "2d",
            {
              willReadFrequently:
                true,
            },
          );

        if (
          !ctx
        ) {
          throw new Error(
            "Focus measurement canvas is unavailable.",
          );
        }

        const sourceRatio =
          video.videoWidth /
          video.videoHeight;

        const targetRatio =
          CAMERA.measurementWidth /
          CAMERA.measurementHeight;

        let sourceX =
          0;

        let sourceY =
          0;

        let sourceWidth =
          video.videoWidth;

        let sourceHeight =
          video.videoHeight;

        if (
          sourceRatio >
          targetRatio
        ) {
          sourceWidth =
            video.videoHeight *
            targetRatio;

          sourceX =
            (
              video.videoWidth -
              sourceWidth
            ) /
            2;
        } else if (
          sourceRatio <
          targetRatio
        ) {
          sourceHeight =
            video.videoWidth /
            targetRatio;

          sourceY =
            (
              video.videoHeight -
              sourceHeight
            ) /
            2;
        }

        ctx.drawImage(
          video,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          CAMERA.measurementWidth,
          CAMERA.measurementHeight,
        );

        const image =
          ctx.getImageData(
            0,
            0,
            CAMERA.measurementWidth,
            CAMERA.measurementHeight,
          );

        return calculateLaplacianVariance(
          image,
        );
      },
      [
        getMeasurementCanvas,
      ],
    );

  /* =======================================================
     CAMERA CONTROL
     ======================================================= */

  const stopCamera =
    useCallback(
      () => {
        cameraSessionRef.current +=
          1;

        streamRef.current
          ?.getTracks()
          .forEach(
            (
              track,
            ) => {
              track.stop();
            },
          );

        streamRef.current =
          null;

        if (
          videoRef.current
        ) {
          videoRef.current.pause();

          videoRef.current.srcObject =
            null;
        }

        livePeakRef.current =
          0;

        setCameraActive(
          false,
        );
      },
      [],
    );

  const startCamera =
    useCallback(
      async () => {
        const sessionId =
          cameraSessionRef.current +
          1;

        cameraSessionRef.current =
          sessionId;

        setCameraError(
          null,
        );

        clearCellAnalysis();

        streamRef.current
          ?.getTracks()
          .forEach(
            (
              track,
            ) => {
              track.stop();
            },
          );

        if (
          !navigator.mediaDevices
            ?.getUserMedia
        ) {
          const message =
            "Camera access is not supported in this browser.";

          setCameraError(
            message,
          );

          log(
            message,
            "error",
          );

          return;
        }

        try {
          const stream =
            await navigator.mediaDevices.getUserMedia(
              {
                video: {
                  width: {
                    ideal:
                      CAMERA.idealWidth,
                  },

                  height: {
                    ideal:
                      CAMERA.idealHeight,
                  },

                  facingMode: {
                    ideal:
                      "environment",
                  },
                },

                audio:
                  false,
              },
            );

          if (
            cameraSessionRef.current !==
            sessionId
          ) {
            stream
              .getTracks()
              .forEach(
                (
                  track,
                ) =>
                  track.stop(),
              );

            return;
          }

          const video =
            videoRef.current;

          if (
            !video
          ) {
            stream
              .getTracks()
              .forEach(
                (
                  track,
                ) =>
                  track.stop(),
              );

            throw new Error(
              "Camera preview element is unavailable.",
            );
          }

          streamRef.current =
            stream;

          video.srcObject =
            stream;

          await video.play();

          if (
            cameraSessionRef.current !==
            sessionId
          ) {
            stream
              .getTracks()
              .forEach(
                (
                  track,
                ) =>
                  track.stop(),
              );

            return;
          }

          livePeakRef.current =
            0;

          setCameraHistory(
            [],
          );

          setFocusScore(
            0,
          );

          setCameraActive(
            true,
          );

          setStatus(
            "LIVE CAMERA ACTIVE",
          );

          log(
            "Live camera connected. Focus scoring uses downsampled real camera frames.",
            "success",
          );
        } catch (
          error
        ) {
          const message =
            describeCameraError(
              error,
            );

          setCameraError(
            message,
          );

          setCameraActive(
            false,
          );

          log(
            message,
            "error",
          );
        }
      },
      [
        clearCellAnalysis,
        log,
      ],
    );

  /* =======================================================
     LIVE CAMERA LOOP
     ======================================================= */

  useEffect(
    () => {
      if (
        !cameraActive
      ) {
        return;
      }

      let frameId =
        0;

      let stopped =
        false;

      let lastMeasuredAt =
        0;

      const tick =
        (
          timestamp:
            number,
        ) => {
          if (
            stopped
          ) {
            return;
          }

          drawVideoToCanvas();

          if (
            timestamp -
            lastMeasuredAt >=
            CAMERA.measurementIntervalMs
          ) {
            try {
              const score =
                measureCameraFocusNow();

              updateLiveFocusState(
                score,
              );

              lastMeasuredAt =
                timestamp;
            } catch {
              /*
               * Camera startup may briefly
               * not have a readable frame.
               */
            }
          }

          frameId =
            requestAnimationFrame(
              tick,
            );
        };

      frameId =
        requestAnimationFrame(
          tick,
        );

      return () => {
        stopped =
          true;

        cancelAnimationFrame(
          frameId,
        );
      };
    },
    [
      cameraActive,
      drawVideoToCanvas,
      measureCameraFocusNow,
      updateLiveFocusState,
    ],
  );

  /* =======================================================
     MODE STATE
     ======================================================= */

  useEffect(
    () => {
      if (
        mode ===
        "simulation"
      ) {
        stopCamera();

        renderSimulationAtZ(
          zRef.current,
        );

        return;
      }

      if (
        mode ===
          "camera" &&
        !cameraActive
      ) {
        setStatus(
          "CAMERA NOT CONNECTED",
        );

        return;
      }

      if (
        mode ===
        "hardware"
      ) {
        if (
          !hardwareConnected
        ) {
          setStatus(
            "HARDWARE DISCONNECTED",
          );
        } else if (
          !cameraActive
        ) {
          setStatus(
            "HARDWARE CONNECTED • CAMERA REQUIRED",
          );
        } else if (
          !hardwareArmed
        ) {
          setStatus(
            "READY TO ARM",
          );
        }
      }
    },
    [
      cameraActive,
      hardwareArmed,
      hardwareConnected,
      mode,
      renderSimulationAtZ,
      stopCamera,
    ],
  );

  /* =======================================================
     CLEANUP
     ======================================================= */

  useEffect(
    () => {
      return () => {
        autofocusAbortRef.current
          ?.abort();

        stopCamera();
      };
    },
    [
      stopCamera,
    ],
  );

  /* =======================================================
     HARDWARE MOTION
     ======================================================= */

  const sendSafeHardwareDelta =
    useCallback(
      async (
        virtualDelta:
          number,

        signal?:
          AbortSignal,
      ) => {
        if (
          !hardwareConnected
        ) {
          throw new Error(
            "Serial microscope controller is not connected.",
          );
        }

        if (
          !hardwareArmed
        ) {
          throw new Error(
            "Hardware motor control is not armed.",
          );
        }

        const controller =
          getController();

        const direction =
          Math.sign(
            virtualDelta,
          );

        let remaining =
          Math.abs(
            virtualDelta,
          );

        while (
          remaining >
          0
        ) {
          if (
            signal?.aborted
          ) {
            throw new DOMException(
              "Operation aborted.",
              "AbortError",
            );
          }

          const chunk =
            Math.min(
              remaining,
              HARDWARE.maxVirtualUnitsPerCommand,
            );

          const steps =
            direction *
            chunk *
            HARDWARE.motorStepsPerVirtualUnit;

          await controller.moveZ(
            Math.round(
              steps,
            ),
          );

          remaining -=
            chunk;
        }
      },
      [
        getController,
        hardwareArmed,
        hardwareConnected,
      ],
    );

  const moveStageTo =
    useCallback(
      async (
        nextZ:
          number,

        signal?:
          AbortSignal,
      ) => {
        const bounded =
          clamp(
            nextZ,
            SIMULATION.minZ,
            SIMULATION.maxZ,
          );

        const previous =
          zRef.current;

        const delta =
          bounded -
          previous;

        if (
          mode ===
            "hardware" &&
          delta !==
            0
        ) {
          await sendSafeHardwareDelta(
            delta,
            signal,
          );
        }

        setStagePosition(
          bounded,
        );
      },
      [
        mode,
        sendSafeHardwareDelta,
        setStagePosition,
      ],
    );

  const moveZManually =
    useCallback(
      async (
        nextZ:
          number,
      ) => {
        if (
          running
        ) {
          return;
        }

        clearCellAnalysis();

        try {
          await moveStageTo(
            nextZ,
          );

          if (
            mode ===
            "simulation"
          ) {
            renderSimulationAtZ(
              clamp(
                nextZ,
                SIMULATION.minZ,
                SIMULATION.maxZ,
              ),
            );
          }
        } catch (
          error
        ) {
          const message =
            describeError(
              error,
            );

          setStatus(
            "MOTION ERROR",
          );

          log(
            message,
            "error",
          );
        }
      },
      [
        clearCellAnalysis,
        log,
        mode,
        moveStageTo,
        renderSimulationAtZ,
        running,
      ],
    );

  /* =======================================================
     AUTOFOCUS
     ======================================================= */

  const cancelAutofocus =
    useCallback(
      () => {
        autofocusAbortRef.current
          ?.abort();
      },
      [],
    );

  const runAutofocus =
    useCallback(
      async () => {
        if (
          running ||
          mode ===
          "camera"
        ) {
          return;
        }

        if (
          mode ===
          "hardware"
        ) {
          if (
            !hardwareConnected
          ) {
            log(
              "Hardware autofocus blocked: connect the serial controller first.",
              "warning",
            );

            return;
          }

          if (
            !cameraActive
          ) {
            log(
              "Hardware autofocus blocked: a live optics camera is required.",
              "warning",
            );

            return;
          }

          if (
            !hardwareArmed
          ) {
            log(
              "Hardware autofocus blocked: motor control is not armed.",
              "warning",
            );

            return;
          }
        }

        autofocusAbortRef.current
          ?.abort();

        clearCellAnalysis();

        const abortController =
          new AbortController();

        autofocusAbortRef.current =
          abortController;

        setRunning(
          true,
        );

        setBestScore(
          0,
        );

        setBestZ(
          null,
        );

        setProgress(
          0,
        );

        setAutofocusSamples(
          [],
        );

        setStatus(
          "AUTOFOCUS: COARSE SEARCH",
        );

        log(
          mode ===
          "hardware"
            ? "Closed-loop hardware autofocus started using real camera focus measurements."
            : "Simulation autofocus started: coarse Z sweep.",
          "info",
        );

        try {
          const result =
            await runCoarseFineAutofocus(
              {
                initialZ:
                  zRef.current,

                minZ:
                  SIMULATION.minZ,

                maxZ:
                  SIMULATION.maxZ,

                coarseStartZ:
                  SIMULATION.coarseStartZ,

                coarseEndZ:
                  SIMULATION.coarseEndZ,

                coarseStepZ:
                  SIMULATION.coarseStepZ,

                fineRadiusZ:
                  SIMULATION.fineRadiusZ,

                settleMs:
                  mode ===
                  "hardware"
                    ? HARDWARE.settleMs
                    : SIMULATION.settleMs,

                signal:
                  abortController.signal,

                moveTo:
                  async (
                    candidateZ,
                    signal,
                  ) => {
                    await moveStageTo(
                      candidateZ,
                      signal,
                    );
                  },

                measure:
                  async (
                    candidateZ,
                  ) => {
                    if (
                      mode ===
                      "hardware"
                    ) {
                      const score =
                        measureCameraFocusNow();

                      updateLiveFocusState(
                        score,
                      );

                      return score;
                    }

                    return renderSimulationAtZ(
                      candidateZ,
                    );
                  },

                onProgress:
                  setProgress,

                onSample:
                  (
                    sample,
                  ) => {
                    setAutofocusSamples(
                      (
                        current,
                      ) =>
                        [
                          ...current,
                          sample,
                        ].slice(
                          -80,
                        ),
                    );
                  },

                onPhaseChange:
                  (
                    phase,
                  ) => {
                    if (
                      phase ===
                      "coarse"
                    ) {
                      setStatus(
                        "AUTOFOCUS: COARSE SEARCH",
                      );
                    } else if (
                      phase ===
                      "fine"
                    ) {
                      setStatus(
                        "AUTOFOCUS: FINE SEARCH",
                      );

                      log(
                        "Coarse peak found. Fine focus search started.",
                      );
                    } else {
                      setStatus(
                        "AUTOFOCUS: VERIFYING",
                      );
                    }
                  },
              },
            );

          setBestZ(
            result.bestZ,
          );

          setBestScore(
            result.bestScore,
          );

          setProgress(
            100,
          );

          setStatus(
            "AUTOFOCUS LOCKED",
          );

          log(
            `Autofocus locked at Z=${result.bestZ}, score=${result.bestScore.toFixed(
              1,
            )}.`,
            "success",
          );
        } catch (
          error
        ) {
          if (
            isAbortError(
              error,
            )
          ) {
            setStatus(
              "AUTOFOCUS CANCELLED",
            );

            log(
              "Autofocus cancelled.",
              "warning",
            );
          } else {
            const message =
              describeError(
                error,
              );

            setStatus(
              "AUTOFOCUS ERROR",
            );

            log(
              message,
              "error",
            );
          }
        } finally {
          if (
            autofocusAbortRef.current ===
            abortController
          ) {
            autofocusAbortRef.current =
              null;
          }

          setRunning(
            false,
          );
        }
      },
      [
        cameraActive,
        clearCellAnalysis,
        hardwareArmed,
        hardwareConnected,
        log,
        measureCameraFocusNow,
        mode,
        moveStageTo,
        renderSimulationAtZ,
        running,
        updateLiveFocusState,
      ],
    );

  /* =======================================================
     HARDWARE CONNECT / ARM
     ======================================================= */

  const connectHardware =
    useCallback(
      async () => {
        try {
          const controller =
            getController();

          await controller.connect();

          setHardwareConnected(
            true,
          );

          setHardwareArmed(
            false,
          );

          setMode(
            "hardware",
          );

          setStatus(
            "HARDWARE CONNECTED • CAMERA REQUIRED",
          );

          log(
            "Serial controller connected. Motor output remains DISARMED.",
            "success",
          );
        } catch (
          error
        ) {
          const message =
            describeError(
              error,
            );

          setStatus(
            "HARDWARE CONNECTION ERROR",
          );

          log(
            message,
            "error",
          );
        }
      },
      [
        getController,
        log,
      ],
    );

  const armHardware =
    useCallback(
      () => {
        if (
          !hardwareConnected
        ) {
          log(
            "Cannot arm: serial controller is disconnected.",
            "warning",
          );

          return;
        }

        if (
          !cameraActive
        ) {
          log(
            "Cannot arm: live camera feedback is required for closed-loop autofocus.",
            "warning",
          );

          return;
        }

        setStagePosition(
          HARDWARE.sessionMidpointZ,
        );

        setHardwareArmed(
          true,
        );

        setStatus(
          "HARDWARE ARMED",
        );

        log(
          "Motor control armed with a session-relative midpoint. Physical travel limits are still required before microscope attachment.",
          "warning",
        );
      },
      [
        cameraActive,
        hardwareConnected,
        log,
        setStagePosition,
      ],
    );

  const disarmHardware =
    useCallback(
      () => {
        autofocusAbortRef.current
          ?.abort();

        setHardwareArmed(
          false,
        );

        setStatus(
          "HARDWARE DISARMED",
        );

        log(
          "Motor control disarmed.",
          "info",
        );
      },
      [
        log,
      ],
    );

  const emergencyStop =
    useCallback(
      async () => {
        autofocusAbortRef.current
          ?.abort();

        setRunning(
          false,
        );

        setHardwareArmed(
          false,
        );

        setStatus(
          "EMERGENCY STOP",
        );

        if (
          hardwareConnected
        ) {
          try {
            await getController().stop();
          } catch (
            error
          ) {
            log(
              `Emergency stop command could not be confirmed: ${describeError(
                error,
              )}`,
              "error",
            );

            return;
          }
        }

        log(
          "Emergency stop issued. Motor control is disarmed.",
          "warning",
        );
      },
      [
        getController,
        hardwareConnected,
        log,
      ],
    );

  /* =======================================================
     MODE CHANGE
     ======================================================= */

  const chooseMode =
    useCallback(
      (
        nextMode:
          MicroscopeMode,
      ) => {
        if (
          nextMode ===
          mode
        ) {
          return;
        }

        autofocusAbortRef.current
          ?.abort();

        clearCellAnalysis();

        setHardwareArmed(
          false,
        );

        setBestScore(
          0,
        );

        setBestZ(
          null,
        );

        setProgress(
          0,
        );

        setAutofocusSamples(
          [],
        );

        if (
          nextMode ===
          "simulation"
        ) {
          stopCamera();

          setMode(
            "simulation",
          );

          log(
            "Simulation mode selected.",
          );

          return;
        }

        setMode(
          nextMode,
        );

        if (
          nextMode ===
          "camera"
        ) {
          log(
            "Live Camera mode selected. Focus is measured from real camera pixels.",
          );
        } else {
          log(
            "Hardware mode selected. Closed-loop autofocus requires serial control and a live camera.",
            "warning",
          );
        }
      },
      [
        clearCellAnalysis,
        log,
        mode,
        stopCamera,
      ],
    );

  /* =======================================================
     FIELD ANALYSIS + REPORT SNAPSHOT
     ======================================================= */

  const runFieldAnalysis =
    useCallback(
      async () => {
        if (
          analyzingField
        ) {
          return;
        }

        if (
          activeProfile.status !==
          "ready"
        ) {
          log(
            `${activeProfile.name} currently contains knowledge configuration only. A validated target detector has not been installed.`,
            "warning",
          );

          return;
        }

        if (
          mode !==
            "simulation" &&
          !cameraActive
        ) {
          log(
            "Field analysis blocked: start the camera first.",
            "warning",
          );

          return;
        }

        const source =
          canvasRef.current;

        if (
          !source
        ) {
          log(
            "Field analysis failed: optical canvas is unavailable.",
            "error",
          );

          return;
        }

        setAnalyzingField(
          true,
        );

        try {
          clearCellAnalysis();

          await new Promise<void>(
            (
              resolve,
            ) => {
              requestAnimationFrame(
                () =>
                  resolve(),
              );
            },
          );

          let result:
            CellAnalysisResult | null =
              null;

          /*
           * ----------------------------------------------
           * PROFILE-BASED DETECTOR ROUTING
           * ----------------------------------------------
           */

          if (
            activeProfile
              .detector
              .kind ===
            "blood-color-components"
          ) {
            const analysisCanvas =
              getAnalysisCanvas();

            const ctx =
              analysisCanvas.getContext(
                "2d",
                {
                  willReadFrequently:
                    true,
                },
              );

            if (
              !ctx
            ) {
              throw new Error(
                "Analysis canvas context is unavailable.",
              );
            }

            ctx.clearRect(
              0,
              0,
              analysisCanvas.width,
              analysisCanvas.height,
            );

            ctx.drawImage(
              source,
              0,
              0,
              source.width,
              source.height,
              0,
              0,
              analysisCanvas.width,
              analysisCanvas.height,
            );

            const image =
              ctx.getImageData(
                0,
                0,
                analysisCanvas.width,
                analysisCanvas.height,
              );

            result =
              analyzeBloodField(
                image,
              );

            setAnalysisResult(
              result,
            );

            drawCellAnalysisOverlay(
              result,
            );
          } else {
            /*
             * Focus Quality Assessment profile.
             * No biological classification.
             */
            setAnalysisResult(
              null,
            );
          }

          /*
           * Wait one frame so the overlay canvas is
           * painted before capturing the report image.
           */
          await new Promise<void>(
            (
              resolve,
            ) => {
              requestAnimationFrame(
                () =>
                  resolve(),
              );
            },
          );

          const imageDataUrl =
            captureAnalyzedImage(
              source,
              analysisOverlayRef.current,
            );

          const currentRelativeDetail =
            mode ===
            "simulation"
              ? Math.min(
                  100,
                  Math.round(
                    (
                      focusScore /
                      125
                    ) *
                    100,
                  ),
                )
              : livePeakRef.current >
                0
                ? Math.min(
                    100,
                    Math.round(
                      (
                        focusScore /
                        livePeakRef.current
                      ) *
                      100,
                    ),
                  )
                : 0;

          const snapshot =
            createAnalysisSnapshot(
              {
                profileId:
                  activeProfile.id,

                profileName:
                  activeProfile.name,

                profileVersion:
                  activeProfile.version,

                acquisitionMode:
                  mode,

                focusScore,

                relativeDetail:
                  currentRelativeDetail,

                focusStatus:
                  status,

                zPosition:
                  mode ===
                  "camera"
                    ? null
                    : zRef.current,

                analysis:
                  result,

                imageDataUrl,
              },
            );

          setLatestSnapshot(
            snapshot,
          );

          await saveAnalysisSnapshot(
            snapshot,
          );

          await refreshAnalysisHistory();

          if (
            result
          ) {
            log(
              `Analysis saved: ${result.counts.rbc} RBC-like, ${result.counts.wbc} WBC-like, ${result.counts.platelet} platelet-like candidates.`,
              "success",
            );
          } else {
            log(
              `${activeProfile.name} measurement snapshot saved.`,
              "success",
            );
          }
        } catch (
          error
        ) {
          log(
            error instanceof
              Error
              ? error.message
              : "Field analysis failed.",
            "error",
          );
        } finally {
          setAnalyzingField(
            false,
          );
        }
      },
      [
        activeProfile,
        analyzingField,
        cameraActive,
        clearCellAnalysis,
        drawCellAnalysisOverlay,
        focusScore,
        getAnalysisCanvas,
        log,
        mode,
        refreshAnalysisHistory,
        status,
      ],
    );

  /* =======================================================
     COMPUTED VALUES
     ======================================================= */

  const historyMax =
    useMemo(
      () =>
        Math.max(
          1,
          ...cameraHistory,
        ),
      [
        cameraHistory,
      ],
    );

  const relativeDetail =
    useMemo(
      () => {
        if (
          mode ===
          "simulation"
        ) {
          return Math.min(
            100,
            Math.round(
              (
                focusScore /
                125
              ) *
              100,
            ),
          );
        }

        if (
          livePeakRef.current <=
          0
        ) {
          return 0;
        }

        return Math.min(
          100,
          Math.round(
            (
              focusScore /
              livePeakRef.current
            ) *
            100,
          ),
        );
      },
      [
        focusScore,
        mode,
      ],
    );

  const hardwareReady =
    hardwareConnected &&
    cameraActive &&
    hardwareArmed;

  const viewerLabel =
    mode ===
    "simulation"
      ? "SYNTHETIC BLOOD FIELD"
      : cameraActive
        ? mode ===
          "hardware"
          ? "LIVE OPTICS + SERIAL STAGE"
          : "LIVE CAMERA FEED"
        : "WAITING FOR CAMERA";

  /* =======================================================
     UI
     ======================================================= */

  return (
    <main className="shell">
      <video
        ref={
          videoRef
        }
        className="hiddenVideo"
        playsInline
        muted
      />

      {/* ==================================================
          HEADER
          ================================================== */}

      <header className="topbar">
        <div>
          <p className="eyebrow">
            AUTONOMOUS MICROSCOPY R&D
          </p>

          <h1>
            Adaptive Focus & Automated Analysis Platform
          </h1>

          <p className="subtle">
            Real image sharpness measurement •
            profile-based research analysis •
            downloadable reports •
            hardware-ready microscope control
          </p>
        </div>

        <div className="modeSwitch threeModes">
          <button
            className={
              mode ===
              "simulation"
                ? "active"
                : ""
            }
            onClick={() =>
              chooseMode(
                "simulation",
              )
            }
          >
            Simulation
          </button>

          <button
            className={
              mode ===
              "camera"
                ? "active"
                : ""
            }
            onClick={() =>
              chooseMode(
                "camera",
              )
            }
          >
            Live Camera
          </button>

          <button
            className={
              mode ===
              "hardware"
                ? "active"
                : ""
            }
            onClick={() =>
              chooseMode(
                "hardware",
              )
            }
          >
            Hardware
          </button>
        </div>
      </header>

      {/* ==================================================
          TEST PROFILE
          ================================================== */}

      <TestProfileSelector
        profile={
          activeProfile
        }
        onChange={(
          profileId,
        ) => {
          clearCellAnalysis();

          setLatestSnapshot(
            null,
          );

          setSelectedProfileId(
            profileId,
          );

          const profile =
            getTestProfile(
              profileId,
            );

          log(
            `Test profile selected: ${profile.name} v${profile.version}.`,
            profile.status ===
            "ready"
              ? "info"
              : "warning",
          );
        }}
      />

      {/* ==================================================
          STATUS
          ================================================== */}

      <section className="statusStrip">
        <Stat
          label="Input"
          value={
            mode ===
            "simulation"
              ? "SYNTHETIC"
              : cameraActive
                ? "LIVE CAMERA"
                : "CAMERA OFF"
          }
          good={
            mode ===
            "simulation" ||
            cameraActive
          }
        />

        <Stat
          label="Controller"
          value={
            mode !==
            "hardware"
              ? "N/A"
              : !hardwareConnected
                ? "DISCONNECTED"
                : hardwareArmed
                  ? "ARMED"
                  : "DISARMED"
          }
          good={
            mode !==
            "hardware" ||
            (
              hardwareConnected &&
              hardwareArmed
            )
          }
        />

        <Stat
          label="Z position"
          value={
            mode ===
            "camera"
              ? "—"
              : String(
                  z,
                )
          }
        />

        <Stat
          label="Focus score"
          value={
            focusScore.toFixed(
              1,
            )
          }
        />

        <Stat
          label={
            mode ===
            "simulation"
              ? "Focus index"
              : "Relative detail"
          }
          value={
            `${relativeDetail}%`
          }
          good={
            relativeDetail >
            65
          }
        />

        <Stat
          label="State"
          value={
            status
          }
          good={
            status.includes(
              "LOCKED",
            ) ||
            status.includes(
              "HIGH RELATIVE DETAIL",
            ) ||
            status ===
            "FOCUSED"
          }
        />
      </section>

      {/* ==================================================
          MAIN WORKSPACE
          ================================================== */}

      <section className="workspace">
        {/* ================================================
            OPTICAL VIEWER
            ================================================ */}

        <div className="viewerCard card">
          <div className="cardHeader">
            <div>
              <span className="liveDot" />
              {" "}
              OPTICAL FIELD
            </div>

            <span>
              {
                viewerLabel
              }
            </span>
          </div>

          <div className="canvasWrap">
            <canvas
              ref={
                canvasRef
              }
              width={
                CANVAS.width
              }
              height={
                CANVAS.height
              }
            />

            <canvas
              ref={
                analysisOverlayRef
              }
              width={
                CANVAS.width
              }
              height={
                CANVAS.height
              }
              className="analysisOverlay"
              aria-hidden="true"
            />

            {mode !==
              "simulation" &&
              !cameraActive && (
                <div className="cameraEmptyState">
                  <strong>
                    Connect your laptop camera
                    or USB microscope camera
                  </strong>

                  <span>
                    Real camera pixels are
                    used for focus measurement
                    and field analysis.
                  </span>

                  <button
                    className="primary cameraConnect"
                    onClick={() =>
                      void startCamera()
                    }
                  >
                    START LIVE CAMERA
                  </button>

                  {cameraError && (
                    <small>
                      {
                        cameraError
                      }
                    </small>
                  )}
                </div>
              )}

            <div className="reticle horizontal" />

            <div className="reticle vertical" />

            <div className="scaleBar">
              100 μm
            </div>
          </div>

          <div className="viewerFooter">
            {mode ===
              "simulation" && (
                <span>
                  Objective simulation:
                  {" "}
                  40×
                </span>
              )}

            {mode ===
              "simulation" && (
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
              )}

            {mode !==
              "simulation" && (
                <span>
                  Focus measurement:
                  {" "}
                  {
                    CAMERA.measurementWidth
                  }
                  ×
                  {
                    CAMERA.measurementHeight
                  }
                  {" "}
                  pixels
                </span>
              )}

            {mode ===
              "hardware" && (
                <span>
                  Motor:
                  {" "}
                  {
                    HARDWARE.motorStepsPerVirtualUnit
                  }
                  {" "}
                  steps / virtual Z unit
                </span>
              )}

            <span>
              Laplacian variance:
              {" "}
              {focusScore.toFixed(
                2,
              )}
            </span>
          </div>
        </div>

        {/* ================================================
            RIGHT CONTROL COLUMN
            ================================================ */}

        <aside className="controlColumn">
          {/* CAMERA OR Z CONTROL */}

          {mode ===
          "camera" ? (
            <div className="card controlCard">
              <div className="cardHeader">
                <div>
                  LIVE IMAGE ANALYSIS
                </div>

                <span>
                  NO MOTOR REQUIRED
                </span>
              </div>

              <div className="zReadout">
                {focusScore.toFixed(
                  1,
                )}

                <small>
                  {" "}
                  focus score
                </small>
              </div>

              <button
                className="primary"
                onClick={() =>
                  void startCamera()
                }
              >
                {cameraActive
                  ? "RESTART CAMERA"
                  : "START CAMERA"}
              </button>

              <button
                onClick={
                  stopCamera
                }
                disabled={
                  !cameraActive
                }
              >
                STOP CAMERA
              </button>

              <p className="tiny">
                Higher Laplacian variance
                generally means more edge
                detail. Relative detail is
                based on the strongest frame
                observed in this camera
                session.
              </p>
            </div>
          ) : (
            <div className="card controlCard">
              <div className="cardHeader">
                <div>
                  Z-AXIS CONTROL
                </div>

                <span>
                  {mode ===
                  "hardware"
                    ? hardwareReady
                      ? "ARMED"
                      : "INTERLOCKED"
                    : "SIMULATED 0–100"}
                </span>
              </div>

              <div className="zReadout">
                {z}

                <small>
                  {mode ===
                  "hardware"
                    ? " session-relative units"
                    : " virtual units"}
                </small>
              </div>

              <input
                aria-label="Z position"
                type="range"
                min={
                  SIMULATION.minZ
                }
                max={
                  SIMULATION.maxZ
                }
                value={
                  z
                }
                disabled={
                  running ||
                  (
                    mode ===
                      "hardware" &&
                    !hardwareReady
                  )
                }
                onChange={(
                  event,
                ) =>
                  void moveZManually(
                    Number(
                      event.target.value,
                    ),
                  )
                }
              />

              <div className="buttonGrid">
                <button
                  onClick={() =>
                    void moveZManually(
                      z -
                      5,
                    )
                  }
                  disabled={
                    running ||
                    (
                      mode ===
                        "hardware" &&
                      !hardwareReady
                    )
                  }
                >
                  Z − 5
                </button>

                <button
                  onClick={() =>
                    void moveZManually(
                      z -
                      1,
                    )
                  }
                  disabled={
                    running ||
                    (
                      mode ===
                        "hardware" &&
                      !hardwareReady
                    )
                  }
                >
                  Z − 1
                </button>

                <button
                  onClick={() =>
                    void moveZManually(
                      z +
                      1,
                    )
                  }
                  disabled={
                    running ||
                    (
                      mode ===
                        "hardware" &&
                      !hardwareReady
                    )
                  }
                >
                  Z + 1
                </button>

                <button
                  onClick={() =>
                    void moveZManually(
                      z +
                      5,
                    )
                  }
                  disabled={
                    running ||
                    (
                      mode ===
                        "hardware" &&
                      !hardwareReady
                    )
                  }
                >
                  Z + 5
                </button>
              </div>

              <button
                className="primary"
                onClick={() =>
                  void runAutofocus()
                }
                disabled={
                  running ||
                  (
                    mode ===
                      "hardware" &&
                    !hardwareReady
                  )
                }
              >
                {running
                  ? "AUTOFOCUS RUNNING…"
                  : "RUN AUTOFOCUS"}
              </button>

              {running && (
                <button
                  onClick={
                    cancelAutofocus
                  }
                >
                  CANCEL AUTOFOCUS
                </button>
              )}

              <div className="progress">
                <span
                  style={{
                    width:
                      `${progress}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* FOCUS RESULT */}

          <div className="card resultCard">
            <div className="cardHeader">
              <div>
                {mode ===
                "camera"
                  ? "FOCUS TREND"
                  : "FOCUS RESULT"}
              </div>

              <span>
                {mode ===
                "camera"
                  ? "LIVE"
                  : "COARSE → FINE"}
              </span>
            </div>

            {mode ===
            "camera" ? (
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
                          key={`${index}-${value.toFixed(
                            2,
                          )}`}
                          title={value.toFixed(
                            1,
                          )}
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
                    {livePeakRef.current.toFixed(
                      1,
                    )}
                  </strong>
                </div>

                <p className="tiny">
                  Scores are calculated from
                  downsampled real camera
                  frames to reduce browser CPU
                  usage.
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
                      autofocusSamples.length
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
                          SIMULATION.optimalZ
                        }
                      </strong>
                    </div>
                  )}

                <p className="tiny">
                  {mode ===
                  "hardware"
                    ? "Hardware autofocus measures the live optics camera after each physical motor movement."
                    : "The simulator optimum is shown only for validation. The search selects the best measured sharpness."}
                </p>
              </>
            )}
          </div>

          {/* FIELD ANALYSIS */}

          <CellAnalysisPanel
            result={
              analysisResult
            }
            analyzing={
              analyzingField
            }
            canAnalyze={
              activeProfile.status ===
                "ready" &&
              (
                mode ===
                  "simulation" ||
                cameraActive
              )
            }
            onAnalyze={() =>
              void runFieldAnalysis()
            }
            onClear={
              clearCellAnalysis
            }
          />

          {/* KNOWLEDGE BASE */}

          <KnowledgeBasePanel
            profile={
              activeProfile
            }
          />

          {/* REPORT */}

          <ReportActions
            snapshot={
              latestSnapshot
            }
            profile={
              activeProfile
            }
          />

          {/* HARDWARE */}

          <div className="card hardwareCard">
            <div className="cardHeader">
              <div>
                HARDWARE BRIDGE
              </div>

              <span>
                {hardwareConnected
                  ? hardwareArmed
                    ? "ARMED"
                    : "DISARMED"
                  : "OPTIONAL"}
              </span>
            </div>

            <button
              onClick={() =>
                void connectHardware()
              }
              disabled={
                hardwareConnected
              }
            >
              {hardwareConnected
                ? "CONTROLLER CONNECTED"
                : "CONNECT USB CONTROLLER"}
            </button>

            {mode ===
              "hardware" && (
                <>
                  <button
                    onClick={() =>
                      void startCamera()
                    }
                  >
                    {cameraActive
                      ? "RESTART OPTICS CAMERA"
                      : "START OPTICS CAMERA"}
                  </button>

                  {!hardwareArmed ? (
                    <button
                      onClick={
                        armHardware
                      }
                      disabled={
                        !hardwareConnected ||
                        !cameraActive
                      }
                    >
                      ENABLE MOTOR CONTROL
                    </button>
                  ) : (
                    <button
                      onClick={
                        disarmHardware
                      }
                    >
                      DISARM MOTOR CONTROL
                    </button>
                  )}
                </>
              )}

            <button
              className="danger"
              onClick={() =>
                void emergencyStop()
              }
            >
              EMERGENCY STOP
            </button>

            <p className="tiny">
              Software interlocks require
              serial + camera + explicit
              arming. Physical limit switches
              and hardware-side travel
              protection are still required
              before real microscope
              attachment.
            </p>
          </div>
        </aside>
      </section>

      {/* ==================================================
          PIPELINE + LOGS
          ================================================== */}

      <section className="bottomGrid">
        <div className="card researchCard">
          <div className="cardHeader">
            <div>
              RESEARCH PIPELINE
            </div>

            <span>
              PHASE 3.5 • PROFILES + REPORTING
            </span>
          </div>

          <div className="pipeline">
            <Pipeline
              title="Acquire"
              text={
                mode ===
                "simulation"
                  ? "Synthetic validation frame"
                  : "Real camera frame"
              }
            />

            <b>
              →
            </b>

            <Pipeline
              title="Focus"
              text={
                mode ===
                "camera"
                  ? "Live Laplacian measurement"
                  : "Coarse + fine Z search"
              }
            />

            <b>
              →
            </b>

            <Pipeline
              title="Analyze"
              text={
                activeProfile.detector.label
              }
            />

            <b>
              →
            </b>

            <Pipeline
              title="Report"
              text="Snapshot + PDF + history"
            />
          </div>
        </div>

        <div className="card logCard">
          <div className="cardHeader">
            <div>
              SYSTEM LOG
            </div>

            <span>
              LIVE
            </span>
          </div>

          <div className="logs">
            {logs.length ===
            0 ? (
              <div>
                <time>
                  --
                </time>

                <span>
                  Initializing research
                  prototype...
                </span>
              </div>
            ) : (
              logs.map(
                (
                  entry,
                ) => (
                  <div
                    key={
                      entry.id
                    }
                  >
                    <time>
                      {
                        entry.time
                      }
                    </time>

                    <span>
                      [
                      {
                        entry.level.toUpperCase()
                      }
                      ]
                      {" "}
                      {
                        entry.message
                      }
                    </span>
                  </div>
                ),
              )
            )}
          </div>
        </div>
      </section>

      {/* ==================================================
          PERSISTENT ANALYSIS HISTORY
          ================================================== */}

      <AnalysisHistory
        items={
          analysisHistory
        }
        onDelete={(
          id,
        ) =>
          void removeHistoryRecord(
            id,
          )
        }
      />
    </main>
  );
}

/* =========================================================
   SMALL UI COMPONENTS
   ========================================================= */

function Stat({
  label,
  value,
  good = false,
}: {
  label:
    string;

  value:
    string;

  good?:
    boolean;
}) {
  return (
    <div className="stat">
      <span>
        {
          label
        }
      </span>

      <strong
        className={
          good
            ? "good"
            : ""
        }
      >
        {
          value
        }
      </strong>
    </div>
  );
}

function Pipeline({
  title,
  text,
}: {
  title:
    string;

  text:
    string;
}) {
  return (
    <div className="pipelineBox">
      <strong>
        {
          title
        }
      </strong>

      <span>
        {
          text
        }
      </span>
    </div>
  );
}

/* =========================================================
   ERROR HELPERS
   ========================================================= */

function describeCameraError(
  error:
    unknown,
): string {
  if (
    error instanceof
    DOMException
  ) {
    if (
      error.name ===
      "NotAllowedError"
    ) {
      return "Camera permission was denied. Allow camera access in the browser and retry.";
    }

    if (
      error.name ===
      "NotFoundError"
    ) {
      return "No camera device was found.";
    }

    if (
      error.name ===
      "NotReadableError"
    ) {
      return "The camera is already in use by another application.";
    }

    if (
      error.name ===
      "OverconstrainedError"
    ) {
      return "The requested camera configuration is not supported by this device.";
    }

    if (
      error.name ===
      "SecurityError"
    ) {
      return "Camera access is blocked by the browser security policy.";
    }
  }

  return describeError(
    error,
  );
}

function describeError(
  error:
    unknown,
): string {
  return error instanceof
    Error
    ? error.message
    : "An unexpected microscope control error occurred.";
}