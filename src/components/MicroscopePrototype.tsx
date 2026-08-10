"use client";

import {
  type ChangeEvent,
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
  ResearchValidationPanel,
} from "@/components/ResearchValidationPanel";

import {
  runMlInference,
  type MlInferenceResult,
} from "@/lib/ml-inference";

import {
  MlAnalysisPanel,
} from "@/components/ml/MlAnalysisPanel";

import {
  MicroscopeHeader,
} from "@/components/microscope/MicroscopeHeader";

import {
  CameraControlPanel,
} from "@/components/microscope/CameraControlPanel";

import {
  ZAxisControlPanel,
} from "@/components/microscope/ZAxisControlPanel";

import {
  FocusResultPanel,
} from "@/components/microscope/FocusResultPanel";

import {
  MicroscopeStatusStrip,
} from "@/components/microscope/MicroscopeStatusStrip";

import {
  OpticalViewer,
} from "@/components/microscope/OpticalViewer";

import {
  ResearchImageSourcePanel,
} from "@/components/microscope/ResearchImageSourcePanel";

import {
  HardwareBridgePanel,
} from "@/components/microscope/HardwareBridgePanel";

import {
  ResearchPipelinePanel,
} from "@/components/microscope/ResearchPipelinePanel";

import {
  ScanControlPanel,
} from "@/components/microscope/ScanControlPanel";

import {
  ScanGridPreview,
} from "@/components/microscope/ScanGridPreview";

import {
  ScanExecutionControls,
} from "@/components/microscope/ScanExecutionControls";

import {
  ScanProgressPanel,
} from "@/components/microscope/ScanProgressPanel";

import {
  useSlideScan,
} from "@/hooks/useSlideScan";

import {
  useSlideScanWorkflow,
} from "@/hooks/useSlideScanWorkflow";

import {
  useMlServiceTelemetry,
} from "@/hooks/useMlServiceTelemetry";

import {
  MlModelTelemetryPanel,
} from "@/components/microscope/MlModelTelemetryPanel";

import {
  SlideScanSummaryPanel,
} from "@/components/microscope/SlideScanSummaryPanel";

import {
  ScanFieldResultsPanel,
} from "@/components/microscope/ScanFieldResultsPanel";

import {
  ExperimentStatusPanel,
} from "@/components/microscope/ExperimentStatusPanel";

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

type ResearchImageTransform = {
  sourceWidth: number;
  sourceHeight: number;

  scale: number;

  offsetX: number;
  offsetY: number;

  displayWidth: number;
  displayHeight: number;
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

function canvasToBlob(
  canvas: HTMLCanvasElement,
): Promise<Blob> {
  return new Promise(
    (
      resolve,
      reject,
    ) => {
      canvas.toBlob(
        (
          blob,
        ) => {
          if (
            !blob
          ) {
            reject(
              new Error(
                "Unable to encode microscope frame for ML inference.",
              ),
            );

            return;
          }

          resolve(
            blob,
          );
        },
        "image/png",
      );
    },
  );
}

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

export function MicroscopePrototype() {
  const {
    config:
      scanConfig,

    setConfig:
      setScanConfig,

    resetConfig:
      resetScanConfig,

    plan:
      scanPlan,

    planError:
      scanPlanError,

    travelUm:
      scanTravelUm,
  } =
    useSlideScan();

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


  const researchImageFileRef =
  useRef<File | null>(
    null,
  );

const researchImageTransformRef =
  useRef<ResearchImageTransform | null>(
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
    mlResult,
    setMlResult,
  ] =
    useState<
      MlInferenceResult | null
    >(
      null,
    );

  const [
   researchImageName,
   setResearchImageName,
  ] =
    useState<
      string | null
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

        setMlResult(
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

          const labelText =
            `${label} ${score}`;

          ctx.font =
            "700 11px Arial";

          const textWidth =
            ctx.measureText(
              labelText,
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
            labelText,
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
     DRAW ML PARASITE OVERLAY
     ======================================================= */

  const drawMlAnalysisOverlay =
    useCallback(
      (
        result:
          MlInferenceResult,
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

        const researchTransform =
          researchImageTransformRef.current;

        const usesResearchTransform =
          researchTransform !==
            null &&
          researchTransform.sourceWidth ===
            result.image.width &&
          researchTransform.sourceHeight ===
            result.image.height;

        const scaleX =
          usesResearchTransform
            ? researchTransform.scale
            : overlay.width /
              result.image.width;

        const scaleY =
          usesResearchTransform
            ? researchTransform.scale
            : overlay.height /
              result.image.height;

        const offsetX =
          usesResearchTransform
            ? researchTransform.offsetX
            : 0;

        const offsetY =
          usesResearchTransform
            ? researchTransform.offsetY
            : 0;

        for (
          const candidate
          of result.candidates
        ) {
          const x =
            offsetX +
            candidate.bbox.x1 *
            scaleX;

          const y =
            offsetY +
            candidate.bbox.y1 *
            scaleY;

          const width =
            (
              candidate.bbox.x2 -
              candidate.bbox.x1
            ) *
            scaleX;

          const height =
            (
              candidate.bbox.y2 -
              candidate.bbox.y1
            ) *
            scaleY;

          let stroke =
            "#ffd166";

          let background =
            "rgba(77, 58, 12, 0.92)";

          if (
            candidate.stage ===
            "ring"
          ) {
            stroke =
              "#64d8ff";

            background =
              "rgba(20, 76, 96, 0.92)";
          } else if (
            candidate.stage ===
            "trophozoite"
          ) {
            stroke =
              "#76e6a5";

            background =
              "rgba(25, 92, 56, 0.92)";
          } else if (
            candidate.stage ===
            "schizont"
          ) {
            stroke =
              "#d3a6ff";

            background =
              "rgba(73, 43, 103, 0.92)";
          } else if (
            candidate.stage ===
            "gametocyte"
          ) {
            stroke =
              "#ff9aaf";

            background =
              "rgba(109, 40, 57, 0.92)";
          }

          ctx.lineWidth =
            2.4;

          ctx.strokeStyle =
            stroke;

          ctx.strokeRect(
            x,
            y,
            width,
            height,
          );

          const stageConfidence =
            Math.round(
              candidate
                .stage_confidence *
              100,
            );

          const detectorConfidence =
            Math.round(
              candidate
                .detector_confidence *
              100,
            );

          const labelText =
            `${candidate.stage.toUpperCase()} S${stageConfidence} D${detectorConfidence}`;

          ctx.font =
            "700 11px Arial";

          const textWidth =
            ctx.measureText(
              labelText,
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
            labelText,
            x +
            5,
            labelY +
            13,
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
            "HARDWARE CONNECTED â€¢ CAMERA REQUIRED",
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
            "HARDWARE CONNECTED â€¢ CAMERA REQUIRED",
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

        if (
          nextMode !==
          "simulation"
        ) {
          researchImageFileRef.current =
            null;

          researchImageTransformRef.current =
            null;

          setResearchImageName(
            null,
          );
        }

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
   STATIC RESEARCH IMAGE
   ======================================================= */

const loadResearchImage =
  useCallback(
    async (
      event:
        ChangeEvent<HTMLInputElement>,
    ) => {
      const file =
        event.target.files?.[0];

      /*
       * Allow selecting the same file again later.
       */
      event.target.value =
        "";

      if (
        !file
      ) {
        return;
      }

      if (
        !file.type.startsWith(
          "image/",
        )
      ) {
        log(
          "Research image upload rejected: select a PNG, JPEG, WebP or another browser-readable image.",
          "warning",
        );

        return;
      }

      if (
        mode !==
        "simulation"
      ) {
        log(
          "Static research-image loading is currently available in Simulation mode only.",
          "warning",
        );

        return;
      }

      const canvas =
        canvasRef.current;

      if (
        !canvas
      ) {
        log(
          "Research image could not be loaded because the optical canvas is unavailable.",
          "error",
        );

        return;
      }

      try {
        clearCellAnalysis();

        const bitmap =
          await createImageBitmap(
            file,
          );

        try {
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
              "Optical canvas context is unavailable.",
            );
          }

          /*
           * Preserve microscopy-image geometry.
           * Do NOT independently stretch X and Y.
           */
          const scale =
            Math.min(
              canvas.width /
                bitmap.width,
              canvas.height /
                bitmap.height,
            );

          const displayWidth =
            bitmap.width *
            scale;

          const displayHeight =
            bitmap.height *
            scale;

          const offsetX =
            (
              canvas.width -
              displayWidth
            ) /
            2;

          const offsetY =
            (
              canvas.height -
              displayHeight
            ) /
            2;

          ctx.save();

          ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height,
          );

          /*
           * Neutral background for possible
           * letterbox areas.
           */
          ctx.fillStyle =
            "#05080b";

          ctx.fillRect(
            0,
            0,
            canvas.width,
            canvas.height,
          );

          ctx.imageSmoothingEnabled =
            true;

          ctx.imageSmoothingQuality =
            "high";

          ctx.drawImage(
            bitmap,
            offsetX,
            offsetY,
            displayWidth,
            displayHeight,
          );

          ctx.restore();

          researchImageFileRef.current =
            file;

          researchImageTransformRef.current =
            {
              sourceWidth:
                bitmap.width,

              sourceHeight:
                bitmap.height,

              scale,

              offsetX,

              offsetY,

              displayWidth,

              displayHeight,
            };

          setResearchImageName(
            file.name,
          );

          /*
           * Focus score shown here describes the
           * rendered research image, not a clinical
           * quality measure.
           */
          const image =
            ctx.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            );

          const score =
            calculateLaplacianVariance(
              image,
            );

          setFocusScore(
            score,
          );

          setStatus(
            "STATIC RESEARCH IMAGE",
          );

          log(
            `Research image loaded: ${file.name} (${bitmap.width}x${bitmap.height}).`,
            "success",
          );
        } finally {
          bitmap.close();
        }
      } catch (
        error
      ) {
        researchImageFileRef.current =
          null;

        researchImageTransformRef.current =
          null;

        setResearchImageName(
          null,
        );

        log(
          error instanceof
            Error
            ? error.message
            : "Unable to load research image.",
          "error",
        );
      }
    },
    [
      clearCellAnalysis,
      log,
      mode,
    ],
  );


const clearResearchImage =
  useCallback(
    () => {
      researchImageFileRef.current =
        null;

      researchImageTransformRef.current =
        null;

      setResearchImageName(
        null,
      );

      clearCellAnalysis();

      if (
        mode ===
        "simulation"
      ) {
        renderSimulationAtZ(
          zRef.current,
        );

        log(
          "Static research image cleared. Synthetic simulation restored.",
          "info",
        );
      }
    },
    [
      clearCellAnalysis,
      log,
      mode,
      renderSimulationAtZ,
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

        const isMlBloodParasiteProfile =
          activeProfile.id ===
          "blood-parasite-research";

        if (
          activeProfile.status !==
            "ready" &&
          !isMlBloodParasiteProfile
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

          let currentMlResult:
            MlInferenceResult | null =
              null;

          /*
           * ----------------------------------------------
           * PROFILE-BASED DETECTOR ROUTING
           * ----------------------------------------------
           */

          if (
            isMlBloodParasiteProfile
          ) {
            setAnalysisResult(
              null,
            );

            const researchFile =
              mode ===
                "simulation"
                ? researchImageFileRef.current
                : null;

            const inferenceImage:
              Blob =
                researchFile ??
                await canvasToBlob(
                  source,
                );

            const inferenceFilename =
              researchFile?.name ??
              `microscope-frame-${Date.now()}.png`;

            currentMlResult =
              await runMlInference(
                inferenceImage,
                inferenceFilename,
              );

            setMlResult(
              currentMlResult,
            );

            drawMlAnalysisOverlay(
              currentMlResult,
            );
          } else if (
            activeProfile
              .detector
              .kind ===
            "blood-color-components"
          ) {
            setMlResult(
              null,
            );

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

            setMlResult(
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
            currentMlResult
          ) {
            log(
              `ML analysis complete: ${currentMlResult.candidate_count} parasite-like research candidate${currentMlResult.candidate_count === 1 ? "" : "s"} using ${currentMlResult.model_version}; inference ${currentMlResult.timing_ms.inference.toFixed(1)} ms.`,
              "success",
            );
          } else if (
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
        drawMlAnalysisOverlay,
        focusScore,
        getAnalysisCanvas,
        log,
        mode,
        refreshAnalysisHistory,
        status,
      ],
    );

  /* =======================================================
     PHASE 8 SLIDE-SCAN WORKFLOW
     ======================================================= */

  const scanMoveToZ =
    useCallback(
      async (
        candidateZ:
          number,

        signal:
          AbortSignal,
      ) => {
        await moveStageTo(
          candidateZ,
          signal,
        );
      },
      [
        moveStageTo,
      ],
    );


  const scanMeasureFocus =
    useCallback(
      async (
        candidateZ:
          number,

        field:
          import("@/lib/scan").ScanField,
      ) => {
        void field;

        return renderSimulationAtZ(
          candidateZ,
        );
      },
      [
        renderSimulationAtZ,
      ],
    );


  const scanCaptureFrame =
    useCallback(
      async (
        field:
          import("@/lib/scan").ScanField,

        signal:
          AbortSignal,
      ): Promise<
        import("@/lib/scan").ScanAcquiredFrame
      > => {
        if (
          signal.aborted
        ) {
          throw new DOMException(
            "Scan frame capture aborted before start.",
            "AbortError",
          );
        }

        const researchFile =
          researchImageFileRef.current;

        const researchTransform =
          researchImageTransformRef.current;

        if (
          researchFile &&
          researchTransform
        ) {
          return {
            fieldId:
              field.id,

            filename:
              `${field.id}-${researchFile.name}`,

            blob:
              researchFile,

            mimeType:
              researchFile.type ||
              "application/octet-stream",

            width:
              researchTransform.sourceWidth,

            height:
              researchTransform.sourceHeight,

            capturedAtMs:
              Date.now(),

            sourceKind:
              "uploaded",

            metadata: {
              row:
                field.row,

              column:
                field.column,

              stageXUm:
                field.xUm,

              stageYUm:
                field.yUm,

              simulatedXY:
                true,

              researchOnly:
                true,
            },
          };
        }

        const source =
          canvasRef.current;

        if (
          !source
        ) {
          throw new Error(
            `Scan ${field.id}: optical canvas is unavailable.`,
          );
        }

        const blob =
          await canvasToBlob(
            source,
          );

        if (
          signal.aborted
        ) {
          throw new DOMException(
            "Scan frame capture aborted.",
            "AbortError",
          );
        }

        return {
          fieldId:
            field.id,

          filename:
            `scan-${field.id}-${Date.now()}.png`,

          blob,

          mimeType:
            "image/png",

          width:
            source.width,

          height:
            source.height,

          capturedAtMs:
            Date.now(),

          sourceKind:
            "simulation",

          metadata: {
            row:
              field.row,

            column:
              field.column,

            stageXUm:
              field.xUm,

            stageYUm:
              field.yUm,

            simulatedXY:
              true,

            researchOnly:
              true,
          },
        };
      },
      [],
    );


  const scanWorkflowCallbacks =
    useMemo(
      () => ({
        moveToZ:
          scanMoveToZ,

        measureFocus:
          scanMeasureFocus,

        captureFrame:
          scanCaptureFrame,

        beforeStart:
          () => {
            clearCellAnalysis();

            setAutofocusSamples(
              [],
            );

            setProgress(
              0,
            );
          },

        beforeAbort:
          () => {
            cancelAutofocus();
          },

        onAutofocusSample:
          (
            _field:
              import("@/lib/scan").ScanField,

            sample:
              AutofocusSample,
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

        onAutofocusResult:
          (
            result:
              import("@/lib/scan").ScanAutofocusResult,
          ) => {
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
              `SCAN AUTOFOCUS LOCKED • ${result.fieldId}`,
            );
          },

        onMlResult:
          (
            field:
              import("@/lib/scan").ScanField,

            result:
              MlInferenceResult,
          ) => {
            setMlResult(
              result,
            );

            drawMlAnalysisOverlay(
              result,
            );

            log(
              `Scan ${field.id}: ${result.candidate_count} research candidate${result.candidate_count === 1 ? "" : "s"}; inference ${result.timing_ms.inference.toFixed(
                1,
              )} ms.`,
              "success",
            );
          },

        onLog:
          log,
      }),
      [
        cancelAutofocus,
        clearCellAnalysis,
        drawMlAnalysisOverlay,
        log,
        scanCaptureFrame,
        scanMeasureFocus,
        scanMoveToZ,
      ],
    );


  const scanAutofocusConfig =
    useMemo(
      () => ({
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
          SIMULATION.settleMs,

        initialZ:
          z,
      }),
      [
        z,
      ],
    );


  const {
    snapshot:
      scanSnapshot,

    stagePosition:
      scanStagePosition,

    summary:
      scanSlideSummary,

    capturedFieldCount:
      scanCapturedFieldCount,

    analyzedFieldCount:
      scanAnalyzedFieldCount,

    candidateCount:
      scanCandidateCount,

    starting:
      scanStarting,

    error:
      scanExecutionError,

    isActive:
      scanExecutionActive,

    canPause:
      scanCanPause,

    canResume:
      scanCanResume,

    canAbort:
      scanCanAbort,

    start:
      startSlideScan,

    pause:
      pauseSlideScan,

    resume:
      resumeSlideScan,

    abort:
      abortSlideScan,

    reset:
      resetSlideScanExecution,
  } =
    useSlideScanWorkflow(
      {
        plan:
          scanPlan,

        autofocus:
          scanAutofocusConfig,

        callbacks:
          scanWorkflowCallbacks,

        settleMs:
          50,
      },
    );


  const {
    modelInfo:
      mlModelInfo,

    serviceStatus:
      mlServiceStatus,

    loading:
      mlTelemetryLoading,

    error:
      mlTelemetryError,

    lastCheckedAt:
      mlTelemetryCheckedAt,

    refresh:
      refreshMlTelemetry,
  } =
    useMlServiceTelemetry();


  const scanCanStart =
    mode ===
      "simulation" &&
    activeProfile.id ===
      "blood-parasite-research" &&
    scanPlan !==
      null &&
    !scanExecutionActive &&
    !running;


  const scanModeMessage =
    mode !==
      "simulation"
      ? "Automated slide-scan execution is currently limited to Simulation mode. Hardware XY remains adapter-ready but is not enabled in this research workstation."
      : activeProfile.id !==
          "blood-parasite-research"
        ? "Select the blood-parasite research profile to run the ML slide-scan workflow."
        : researchImageName
          ? "Simulated XY execution will reuse the loaded research image at each planned field. This validates orchestration, not physical slide coverage."
          : "Simulated XY execution uses the synthetic/current optical field. This validates orchestration, autofocus, acquisition, inference and aggregation without claiming physical slide coverage.";


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
  researchImageName
    ? "STATIC RESEARCH MICROSCOPY IMAGE"
    : mode ===
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
    <main
      id="overview"
      className="shell"
    >
      <video
        ref={
          videoRef
        }
        className="hiddenVideo"
        playsInline
        muted
      />

      <MicroscopeHeader
        mode={
          mode
        }
        onModeChange={
          chooseMode
        }
      />

      {/* ==================================================
          TEST PROFILE
          ================================================== */}

      <section
        id="settings"
        className="labSectionAnchor"
      >
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
      </section>

      <section
        id="validation"
        className="labSectionAnchor"
      >
        <ResearchValidationPanel />
      </section>

      <MicroscopeStatusStrip
        mode={
          mode
        }
        cameraActive={
          cameraActive
        }
        hardwareConnected={
          hardwareConnected
        }
        hardwareArmed={
          hardwareArmed
        }
        z={
          z
        }
        focusScore={
          focusScore
        }
        relativeDetail={
          relativeDetail
        }
        status={
          status
        }
      />

      {/* ==================================================
          MAIN WORKSPACE
          ================================================== */}

      <section className="workspace">
        <OpticalViewer
          canvasRef={
            canvasRef
          }
          analysisOverlayRef={
            analysisOverlayRef
          }
          canvasWidth={
            CANVAS.width
          }
          canvasHeight={
            CANVAS.height
          }
          viewerLabel={
            viewerLabel
          }
          mode={
            mode
          }
          cameraActive={
            cameraActive
          }
          cameraError={
            cameraError
          }
          onStartCamera={
            startCamera
          }
          focusScore={
            focusScore
          }
          relativeDetail={
            relativeDetail
          }
          z={
            z
          }
          analyzingField={
            analyzingField
          }
          analysisComplete={
            analysisResult !==
            null
          }
          hardwareConnected={
            hardwareConnected
          }
          hardwareArmed={
            hardwareArmed
          }
        />

        {/* ================================================
            RIGHT CONTROL COLUMN
            ================================================ */}

        <aside className="controlColumn">
          {/* CAMERA OR Z CONTROL */}

          {mode === "camera" ? (
            <CameraControlPanel
              focusScore={
                focusScore
              }
              cameraActive={
                cameraActive
              }
              onStartCamera={
                startCamera
              }
              onStopCamera={
                stopCamera
              }
            />
          ) : (
            <ZAxisControlPanel
              mode={
                mode
              }
              z={
                z
              }
              minZ={
                SIMULATION.minZ
              }
              maxZ={
                SIMULATION.maxZ
              }
              running={
                running
              }
              hardwareReady={
                hardwareReady
              }
              progress={
                progress
              }
              onMoveZ={
                moveZManually
              }
              onRunAutofocus={
                runAutofocus
              }
              onCancelAutofocus={
                cancelAutofocus
              }
            />
          )}

          {/* FOCUS RESULT */}

          <FocusResultPanel
            mode={
              mode
            }
            cameraHistory={
              cameraHistory
            }
            historyMax={
              historyMax
            }
            sessionPeak={
              livePeakRef.current
            }
            bestZ={
              bestZ
            }
            bestScore={
              bestScore
            }
            autofocusSampleCount={
              autofocusSamples.length
            }
            simulatorOptimalZ={
              SIMULATION.optimalZ
            }
          />

          {/* FIELD ANALYSIS */}

{activeProfile.id ===
  "blood-parasite-research" && (
    <ResearchImageSourcePanel
      mode={
        mode
      }
      researchImageName={
        researchImageName
      }
      analyzingField={
        analyzingField
      }
      onLoadImage={
        loadResearchImage
      }
      onClear={
        clearResearchImage
      }
    />
  )}

{activeProfile.id ===
  "blood-parasite-research" ? (
  <>
    <MlAnalysisPanel
      result={
        mlResult
      }
      analyzing={
        analyzingField
      }
      canAnalyze={
        mode ===
          "simulation" ||
        cameraActive
      }
      onAnalyze={() =>
        void runFieldAnalysis()
      }
      onClear={
        clearCellAnalysis
      }
    />

    <MlModelTelemetryPanel
      serviceStatus={
        mlServiceStatus
      }
      modelInfo={
        mlModelInfo
      }
      loading={
        mlTelemetryLoading
      }
      error={
        mlTelemetryError
      }
      lastCheckedAt={
        mlTelemetryCheckedAt
      }
      onRefresh={
        refreshMlTelemetry
      }
    />
  </>
) : (
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
)}

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

          <div
            id="hardware"
            className="labSectionAnchor"
          >
            <HardwareBridgePanel
              mode={
                mode
              }
              hardwareConnected={
                hardwareConnected
              }
              hardwareArmed={
                hardwareArmed
              }
              cameraActive={
                cameraActive
              }
              onConnect={
                connectHardware
              }
              onStartCamera={
                startCamera
              }
              onArm={
                armHardware
              }
              onDisarm={
                disarmHardware
              }
              onEmergencyStop={
                emergencyStop
              }
            />
          </div>
        </aside>
      </section>

      {/* ==================================================
          SLIDE SCAN PLANNING + EXECUTION
          ================================================== */}

      <section
        id="slide-scan"
        className="bottomGrid labWorkspaceSection"
      >
        <ScanControlPanel
          config={
            scanConfig
          }
          plan={
            scanPlan
          }
          planError={
            scanPlanError
          }
          travelUm={
            scanTravelUm
          }
          disabled={
            scanExecutionActive ||
            running
          }
          onChange={
            setScanConfig
          }
          onReset={
            resetScanConfig
          }
        />

        <ScanGridPreview
          plan={
            scanPlan
          }
          snapshot={
            scanSnapshot
          }
        />

        <ScanExecutionControls
          snapshot={
            scanSnapshot
          }
          starting={
            scanStarting
          }
          canStart={
            scanCanStart
          }
          canPause={
            scanCanPause
          }
          canResume={
            scanCanResume
          }
          canAbort={
            scanCanAbort
          }
          modeMessage={
            scanModeMessage
          }
          onStart={
            startSlideScan
          }
          onPause={
            pauseSlideScan
          }
          onResume={
            resumeSlideScan
          }
          onAbort={
            abortSlideScan
          }
          onReset={
            resetSlideScanExecution
          }
        />

        <ScanProgressPanel
          snapshot={
            scanSnapshot
          }
          stagePosition={
            scanStagePosition
          }
          error={
            scanExecutionError
          }
        />
      </section>

      <section
        id="experiments"
        className="bottomGrid labWorkspaceSection"
      >
        <ExperimentStatusPanel
          mode={
            mode
          }
          profileName={
            activeProfile.name
          }
          scanSnapshot={
            scanSnapshot
          }
          analyzedFieldCount={
            scanAnalyzedFieldCount
          }
          capturedFieldCount={
            scanCapturedFieldCount
          }
          candidateCount={
            scanCandidateCount
          }
          mlServiceStatus={
            mlServiceStatus
          }
        />

        <SlideScanSummaryPanel
          summary={
            scanSlideSummary
          }
        />

        <ScanFieldResultsPanel
          summary={
            scanSlideSummary
          }
        />
      </section>

      {/* ==================================================
          PIPELINE + LOGS
          ================================================== */}

      <section className="bottomGrid labOperationsGrid">
        <ResearchPipelinePanel
          mode={
            mode
          }
          detectorLabel={
            activeProfile.detector.label
          }
        />

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

      <section
        id="reports"
        className="labWorkspaceSection"
      >
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
      </section>
    </main>
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
