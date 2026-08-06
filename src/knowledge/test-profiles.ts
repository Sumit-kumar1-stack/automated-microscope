export type TestProfileStatus =
  | "ready"
  | "research-config";

export type DetectorKind =
  | "blood-color-components"
  | "focus-only";

export type MeasurementKey =
  | "focusScore"
  | "relativeDetail"
  | "zPosition"
  | "rbcCount"
  | "wbcCount"
  | "plateletCount"
  | "totalCandidates"
  | "foregroundCoverage"
  | "processingTime";

export type MeasurementDefinition = {
  key: MeasurementKey;

  label: string;

  unit?: string;

  description: string;
};

export type TestProfile = {
  id: string;

  name: string;

  shortName: string;

  description: string;

  version: string;

  specimenType: string;

  status: TestProfileStatus;

  focus: {
    method:
      "laplacian-variance";

    minimumRelativeDetail:
      number;
  };

  detector: {
    kind: DetectorKind;

    label: string;

    description: string;
  };

  targetClasses: string[];

  measurements:
    MeasurementDefinition[];

  report: {
    includeAnalyzedImage:
      boolean;

    includeFocus:
      boolean;

    includeProcessingTime:
      boolean;

    includeDisclaimer:
      boolean;
  };

  disclaimer: string;
};

export const TEST_PROFILES:
  TestProfile[] =
  [
    {
      id:
        "blood-cell-research",

      name:
        "Blood Cell Research",

      shortName:
        "Blood Cells",

      description:
        "Research-only stained blood field analysis using classical color segmentation and connected components.",

      version:
        "1.0.0",

      specimenType:
        "Stained blood smear",

      status:
        "ready",

      focus: {
        method:
          "laplacian-variance",

        minimumRelativeDetail:
          0.7,
      },

      detector: {
        kind:
          "blood-color-components",

        label:
          "Classical CV",

        description:
          "Color masks, connected components and morphology-based candidate filtering.",
      },

      targetClasses: [
        "RBC-like",
        "WBC-like",
        "Platelet-like",
      ],

      measurements: [
        {
          key:
            "focusScore",

          label:
            "Focus Score",

          description:
            "Variance of Laplacian focus measurement.",
        },

        {
          key:
            "relativeDetail",

          label:
            "Relative Detail",

          unit:
            "%",

          description:
            "Focus score relative to the strongest frame observed in the current session.",
        },

        {
          key:
            "rbcCount",

          label:
            "RBC-like Candidates",

          unit:
            "objects",

          description:
            "Red-cell-like candidate structures detected by the configured research detector.",
        },

        {
          key:
            "wbcCount",

          label:
            "WBC-like Candidates",

          unit:
            "objects",

          description:
            "White-cell-like candidate structures.",
        },

        {
          key:
            "plateletCount",

          label:
            "Platelet-like Candidates",

          unit:
            "objects",

          description:
            "Small purple platelet-like candidate structures.",
        },

        {
          key:
            "totalCandidates",

          label:
            "Total Candidates",

          unit:
            "objects",

          description:
            "Combined detected research candidates.",
        },

        {
          key:
            "foregroundCoverage",

          label:
            "Foreground Coverage",

          unit:
            "%",

          description:
            "Percentage of analyzed pixels classified as foreground candidate pixels.",
        },

        {
          key:
            "processingTime",

          label:
            "Analysis Processing",

          unit:
            "ms",

          description:
            "Browser-side candidate-analysis processing time.",
        },
      ],

      report: {
        includeAnalyzedImage:
          true,

        includeFocus:
          true,

        includeProcessingTime:
          true,

        includeDisclaimer:
          true,
      },

      disclaimer:
        "Research prototype only. Candidate detection is not clinically validated and must not be used for diagnosis or treatment decisions.",
    },

    {
      id:
        "focus-quality",

      name:
        "Focus Quality Assessment",

      shortName:
        "Focus Test",

      description:
        "Optical focus assessment profile for evaluating sharpness and autofocus behavior without biological classification.",

      version:
        "1.0.0",

      specimenType:
        "Any optical field",

      status:
        "ready",

      focus: {
        method:
          "laplacian-variance",

        minimumRelativeDetail:
          0.7,
      },

      detector: {
        kind:
          "focus-only",

        label:
          "No biological detector",

        description:
          "Measures optical focus only. No biological candidate classification is performed.",
      },

      targetClasses:
        [],

      measurements: [
        {
          key:
            "focusScore",

          label:
            "Focus Score",

          description:
            "Variance of Laplacian sharpness measurement.",
        },

        {
          key:
            "relativeDetail",

          label:
            "Relative Detail",

          unit:
            "%",

          description:
            "Current frame quality relative to the strongest observed frame.",
        },

        {
          key:
            "zPosition",

          label:
            "Z Position",

          description:
            "Current simulated or session-relative Z coordinate.",
        },
      ],

      report: {
        includeAnalyzedImage:
          true,

        includeFocus:
          true,

        includeProcessingTime:
          false,

        includeDisclaimer:
          true,
      },

      disclaimer:
        "Research optical-quality measurement only.",
    },

    {
      id:
        "gi-parasite-egg-research",

      name:
        "GI Parasite Egg Screening",

      shortName:
        "GI Parasites",

      description:
        "Knowledge configuration prepared for future gastrointestinal parasite egg detection.",

      version:
        "0.1.0",

      specimenType:
        "Veterinary fecal microscopy",

      status:
        "research-config",

      focus: {
        method:
          "laplacian-variance",

        minimumRelativeDetail:
          0.75,
      },

      detector: {
        kind:
          "focus-only",

        label:
          "Detector not installed",

        description:
          "Requires a validated parasite-egg object detector or segmentation model before automated screening can run.",
      },

      targetClasses: [
        "Egg-like candidate",
      ],

      measurements: [
        {
          key:
            "focusScore",

          label:
            "Focus Score",

          description:
            "Image sharpness measurement.",
        },

        {
          key:
            "relativeDetail",

          label:
            "Relative Detail",

          unit:
            "%",

          description:
            "Relative focus measurement.",
        },
      ],

      report: {
        includeAnalyzedImage:
          true,

        includeFocus:
          true,

        includeProcessingTime:
          false,

        includeDisclaimer:
          true,
      },

      disclaimer:
        "Detector configuration only. Parasite screening is not implemented or validated.",
    },

    {
      id:
        "blood-parasite-research",

      name:
        "Blood Parasite Screening",

      shortName:
        "Blood Parasites",

      description:
        "Knowledge profile reserved for future microscopy models targeting blood-parasite-like structures.",

      version:
        "0.1.0",

      specimenType:
        "Blood smear",

      status:
        "research-config",

      focus: {
        method:
          "laplacian-variance",

        minimumRelativeDetail:
          0.75,
      },

      detector: {
        kind:
          "focus-only",

        label:
          "Detector not installed",

        description:
          "Requires a target-specific trained and validated model.",
      },

      targetClasses: [
        "Parasite-like candidate",
      ],

      measurements: [
        {
          key:
            "focusScore",

          label:
            "Focus Score",

          description:
            "Image sharpness measurement.",
        },

        {
          key:
            "relativeDetail",

          label:
            "Relative Detail",

          unit:
            "%",

          description:
            "Relative focus measurement.",
        },
      ],

      report: {
        includeAnalyzedImage:
          true,

        includeFocus:
          true,

        includeProcessingTime:
          false,

        includeDisclaimer:
          true,
      },

      disclaimer:
        "Research configuration only. Blood parasite detection is not currently implemented or clinically validated.",
    },
  ];

export const DEFAULT_TEST_PROFILE_ID =
  "blood-cell-research";

export function getTestProfile(
  profileId: string,
): TestProfile {
  return (
    TEST_PROFILES.find(
      (
        profile,
      ) =>
        profile.id ===
        profileId,
    ) ??
    TEST_PROFILES[0]
  );
}