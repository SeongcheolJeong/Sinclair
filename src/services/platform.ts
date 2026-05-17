import {
  cameraWorkbenchModel,
  errorEvents,
  experiments,
  fusionAttribution,
  lidarWorkbenchModel,
  radarWorkbenchModel,
  reports,
  runCompare,
  runs,
  scenarios,
  templates,
  workbenchStates,
  workspaces,
} from "../data/mockData";
import type {
  CameraE2EAssetIndex,
  CameraE2EIntegration,
  CameraSimulationRequest,
  CameraSimulationResult,
  SensorType,
} from "../types/domain";

// These functions are the simulation/API integration seam. They return fixtures
// now and can be swapped for network or local simulation adapters later.
export function listWorkspaces() {
  return workspaces;
}

export function listExperiments() {
  return experiments;
}

export function listRuns() {
  return runs;
}

export function getRunCompare() {
  return runCompare;
}

export function getWorkbenchState(sensor: Exclude<SensorType, "fusion">) {
  return workbenchStates[sensor];
}

export function getCameraWorkbenchModel() {
  return cameraWorkbenchModel;
}

export async function getCameraE2EIntegration(): Promise<CameraE2EIntegration | null> {
  try {
    const response = await fetch("/assets/camera-e2e/integration.json", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as CameraE2EIntegration;
  } catch {
    return null;
  }
}

export async function getCameraE2EAssets(): Promise<CameraE2EAssetIndex | null> {
  try {
    const response = await fetch("/assets/camera-e2e/asset-index.json", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as CameraE2EAssetIndex;
  } catch {
    return null;
  }
}

export async function runCameraE2ESimulation(request: CameraSimulationRequest): Promise<CameraSimulationResult> {
  const response = await fetch("/api/camera-e2e/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  const payload = (await response.json()) as CameraSimulationResult;
  if (!response.ok || payload.status === "failed") {
    throw new Error(payload.reason ?? payload.stderr ?? "CameraE2E simulation failed");
  }
  return payload;
}

export function getRadarWorkbenchModel() {
  return radarWorkbenchModel;
}

export function getLidarWorkbenchModel() {
  return lidarWorkbenchModel;
}

export function getFusionAttribution(runId: string) {
  void runId;
  return fusionAttribution;
}

export function listScenarios() {
  return scenarios;
}

export function listErrorEvents() {
  return errorEvents;
}

export function listReports() {
  return reports;
}

export function listTemplates() {
  return templates;
}
