"use client";

import {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  buildScanPlan,
  calculatePlanTravelUm,
  type ScanGridConfig,
  type ScanPlan,
} from "@/lib/scan";


export const DEFAULT_SCAN_GRID_CONFIG:
  ScanGridConfig = {
    rows: 3,
    columns: 4,

    originXUm: 0,
    originYUm: 0,

    stepXUm: 500,
    stepYUm: 500,

    serpentine: true,
  };


type ScanPlanningResult = {
  plan:
    ScanPlan | null;

  error:
    string | null;

  travelUm:
    number;
};


function describePlanningError(
  error:
    unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Unable to build the scan plan.";
}


export function useSlideScan() {
  const [
    config,
    setConfig,
  ] =
    useState<ScanGridConfig>(
      DEFAULT_SCAN_GRID_CONFIG,
    );


  const planning =
    useMemo<ScanPlanningResult>(
      () => {
        try {
          const plan =
            buildScanPlan(
              config,
            );

          return {
            plan,

            error:
              null,

            travelUm:
              calculatePlanTravelUm(
                plan,
              ),
          };
        } catch (
          error
        ) {
          return {
            plan:
              null,

            error:
              describePlanningError(
                error,
              ),

            travelUm:
              0,
          };
        }
      },
      [
        config,
      ],
    );


  const updateConfig =
    useCallback(
      (
        nextConfig:
          ScanGridConfig,
      ) => {
        setConfig(
          nextConfig,
        );
      },
      [],
    );


  const resetConfig =
    useCallback(
      () => {
        setConfig(
          DEFAULT_SCAN_GRID_CONFIG,
        );
      },
      [],
    );


  return {
    config,

    setConfig:
      updateConfig,

    resetConfig,

    plan:
      planning.plan,

    planError:
      planning.error,

    travelUm:
      planning.travelUm,
  };
}
