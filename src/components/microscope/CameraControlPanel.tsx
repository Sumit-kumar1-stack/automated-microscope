"use client";

type CameraControlPanelProps = {
  focusScore: number;
  cameraActive: boolean;
  onStartCamera: () => void | Promise<void>;
  onStopCamera: () => void;
};

export function CameraControlPanel({
  focusScore,
  cameraActive,
  onStartCamera,
  onStopCamera,
}: CameraControlPanelProps) {
  return (
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
          void onStartCamera()
        }
      >
        {cameraActive
          ? "RESTART CAMERA"
          : "START CAMERA"}
      </button>

      <button
        onClick={
          onStopCamera
        }
        disabled={
          !cameraActive
        }
      >
        STOP CAMERA
      </button>

      <p className="tiny">
        Higher Laplacian variance generally
        means more edge detail. Relative
        detail is based on the strongest
        frame observed in this camera
        session.
      </p>
    </div>
  );
}
