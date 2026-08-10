"use client";

import {
  type MicroscopeMode,
} from "@/lib/microscope-config";

type HardwareBridgePanelProps = {
  mode: MicroscopeMode;
  hardwareConnected: boolean;
  hardwareArmed: boolean;
  cameraActive: boolean;
  onConnect:
    () => void | Promise<void>;
  onStartCamera:
    () => void | Promise<void>;
  onArm:
    () => void;
  onDisarm:
    () => void;
  onEmergencyStop:
    () => void | Promise<void>;
};

export function HardwareBridgePanel({
  mode,
  hardwareConnected,
  hardwareArmed,
  cameraActive,
  onConnect,
  onStartCamera,
  onArm,
  onDisarm,
  onEmergencyStop,
}: HardwareBridgePanelProps) {
  const bridgeStatus =
    hardwareConnected
      ? hardwareArmed
        ? "ARMED"
        : "DISARMED"
      : "OPTIONAL";

  return (
    <div className="card hardwareCard">
      <div className="cardHeader">
        <div>
          HARDWARE BRIDGE
        </div>

        <span>
          {bridgeStatus}
        </span>
      </div>

      <button
        onClick={() =>
          void onConnect()
        }
        disabled={
          hardwareConnected
        }
      >
        {hardwareConnected
          ? "CONTROLLER CONNECTED"
          : "CONNECT USB CONTROLLER"}
      </button>

      {mode === "hardware" && (
        <>
          <button
            onClick={() =>
              void onStartCamera()
            }
          >
            {cameraActive
              ? "RESTART OPTICS CAMERA"
              : "START OPTICS CAMERA"}
          </button>

          {!hardwareArmed ? (
            <button
              onClick={
                onArm
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
                onDisarm
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
          void onEmergencyStop()
        }
      >
        EMERGENCY STOP
      </button>

      <p className="tiny">
        Software interlocks require serial
        + camera + explicit arming. Physical
        limit switches and hardware-side
        travel protection are still required
        before real microscope attachment.
      </p>
    </div>
  );
}
