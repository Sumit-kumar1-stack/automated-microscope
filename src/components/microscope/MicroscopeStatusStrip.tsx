import {
  type MicroscopeMode,
} from "@/lib/microscope-config";


type MicroscopeStatusStripProps = {
  mode: MicroscopeMode;

  cameraActive: boolean;

  hardwareConnected: boolean;

  hardwareArmed: boolean;

  z: number;

  focusScore: number;

  relativeDetail: number;

  status: string;
};


type StatProps = {
  label: string;

  value: string;

  good?: boolean;
};


function Stat({
  label,
  value,
  good = false,
}: StatProps) {
  return (
    <div className="stat">
      <span>
        {label}
      </span>

      <strong
        className={
          good
            ? "good"
            : ""
        }
      >
        {value}
      </strong>
    </div>
  );
}


export function MicroscopeStatusStrip({
  mode,
  cameraActive,
  hardwareConnected,
  hardwareArmed,
  z,
  focusScore,
  relativeDetail,
  status,
}: MicroscopeStatusStripProps) {
  const inputValue =
    mode === "simulation"
      ? "SYNTHETIC"
      : cameraActive
        ? "LIVE CAMERA"
        : "CAMERA OFF";


  const controllerValue =
    mode !== "hardware"
      ? "N/A"
      : !hardwareConnected
        ? "DISCONNECTED"
        : hardwareArmed
          ? "ARMED"
          : "DISARMED";


  const controllerGood =
    mode !== "hardware" ||
    (
      hardwareConnected &&
      hardwareArmed
    );


  const statusGood =
    status.includes(
      "LOCKED",
    ) ||
    status.includes(
      "HIGH RELATIVE DETAIL",
    ) ||
    status === "FOCUSED";


  return (
    <section className="statusStrip">
      <Stat
        label="Input"
        value={inputValue}
        good={
          mode === "simulation" ||
          cameraActive
        }
      />

      <Stat
        label="Controller"
        value={controllerValue}
        good={controllerGood}
      />

      <Stat
        label="Z position"
        value={
          mode === "camera"
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
          mode === "simulation"
            ? "Focus index"
            : "Relative detail"
        }
        value={
          `${relativeDetail}%`
        }
        good={
          relativeDetail > 65
        }
      />

      <Stat
        label="State"
        value={status}
        good={statusGood}
      />
    </section>
  );
}