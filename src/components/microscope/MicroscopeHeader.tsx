"use client";

import {
  type MicroscopeMode,
} from "@/lib/microscope-config";


type MicroscopeHeaderProps = {
  mode: MicroscopeMode;

  onModeChange: (
    mode: MicroscopeMode,
  ) => void;
};


export function MicroscopeHeader({
  mode,
  onModeChange,
}: MicroscopeHeaderProps) {
  return (
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
            mode === "simulation"
              ? "active"
              : ""
          }
          onClick={() =>
            onModeChange(
              "simulation",
            )
          }
        >
          Simulation
        </button>

        <button
          className={
            mode === "camera"
              ? "active"
              : ""
          }
          onClick={() =>
            onModeChange(
              "camera",
            )
          }
        >
          Live Camera
        </button>

        <button
          className={
            mode === "hardware"
              ? "active"
              : ""
          }
          onClick={() =>
            onModeChange(
              "hardware",
            )
          }
        >
          Hardware
        </button>
      </div>
    </header>
  );
}