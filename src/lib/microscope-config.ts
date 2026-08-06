export const MICROSCOPE_CONFIG = {
  canvas: {
    width: 900,
    height: 560,
  },

  simulation: {
    optimalZ: 62,
    minZ: 0,
    maxZ: 100,
    coarseStartZ: 10,
    coarseEndZ: 90,
    coarseStepZ: 4,
    fineRadiusZ: 3,
    settleMs: 55,
  },

  camera: {
    idealWidth: 1280,
    idealHeight: 720,
    measurementWidth: 450,
    measurementHeight: 280,
    measurementIntervalMs: 250,
    historySize: 40,
  },

  hardware: {
    motorStepsPerVirtualUnit: 20,
    maxVirtualUnitsPerCommand: 5,
    settleMs: 160,
    sessionMidpointZ: 50,
  },

  logs: {
    maxEntries: 20,
  },
} as const;

export type MicroscopeMode = "simulation" | "camera" | "hardware";
