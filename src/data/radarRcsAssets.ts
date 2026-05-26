export type RadarRcsAssetClass =
  | "vehicle"
  | "pedestrian"
  | "cyclist"
  | "guardrail"
  | "calibration_reflector";

export type RadarRcsAsset = {
  id: string;
  label: string;
  assetClass: RadarRcsAssetClass;
  meshUrl: string;
  metadataUrl: string;
  fidelity: "canonical_mesh_estimate";
  materialPreset: string;
  nominalRcsDbsm: number;
  dimensionsM: {
    length: number;
    width: number;
    height: number;
  };
};

export const radarRcsAssetLibraryRoot = "/assets/radar-rcs-library";

export const radarRcsAssets: RadarRcsAsset[] = [
  {
    id: "canonical_sedan_v1",
    label: "Canonical sedan",
    assetClass: "vehicle",
    meshUrl: `${radarRcsAssetLibraryRoot}/vehicles/canonical_sedan_v1.obj`,
    metadataUrl: `${radarRcsAssetLibraryRoot}/vehicles/canonical_sedan_v1.json`,
    fidelity: "canonical_mesh_estimate",
    materialPreset: "mixed_vehicle_pec_like",
    nominalRcsDbsm: 12,
    dimensionsM: { length: 4.6, width: 1.85, height: 1.55 },
  },
  {
    id: "canonical_pedestrian_v1",
    label: "Canonical pedestrian",
    assetClass: "pedestrian",
    meshUrl: `${radarRcsAssetLibraryRoot}/pedestrians/canonical_pedestrian_v1.obj`,
    metadataUrl: `${radarRcsAssetLibraryRoot}/pedestrians/canonical_pedestrian_v1.json`,
    fidelity: "canonical_mesh_estimate",
    materialPreset: "human_body_dielectric_approx",
    nominalRcsDbsm: -3,
    dimensionsM: { length: 0.72, width: 0.55, height: 1.74 },
  },
  {
    id: "canonical_cyclist_v1",
    label: "Canonical cyclist",
    assetClass: "cyclist",
    meshUrl: `${radarRcsAssetLibraryRoot}/cyclists/canonical_cyclist_v1.obj`,
    metadataUrl: `${radarRcsAssetLibraryRoot}/cyclists/canonical_cyclist_v1.json`,
    fidelity: "canonical_mesh_estimate",
    materialPreset: "mixed_bicycle_rider_approx",
    nominalRcsDbsm: 2,
    dimensionsM: { length: 1.75, width: 0.62, height: 1.9 },
  },
  {
    id: "canonical_guardrail_v1",
    label: "Canonical guardrail",
    assetClass: "guardrail",
    meshUrl: `${radarRcsAssetLibraryRoot}/infrastructure/canonical_guardrail_v1.obj`,
    metadataUrl: `${radarRcsAssetLibraryRoot}/infrastructure/canonical_guardrail_v1.json`,
    fidelity: "canonical_mesh_estimate",
    materialPreset: "metal_guardrail_pec_like",
    nominalRcsDbsm: -5,
    dimensionsM: { length: 12, width: 0.22, height: 0.98 },
  },
  {
    id: "calibration_plate_1m_v1",
    label: "1 m calibration plate",
    assetClass: "calibration_reflector",
    meshUrl: `${radarRcsAssetLibraryRoot}/reflectors/calibration_plate_1m_v1.obj`,
    metadataUrl: `${radarRcsAssetLibraryRoot}/reflectors/calibration_plate_1m_v1.json`,
    fidelity: "canonical_mesh_estimate",
    materialPreset: "flat_plate_pec_like",
    nominalRcsDbsm: 27,
    dimensionsM: { length: 1, width: 0.025, height: 1 },
  },
];

export const radarRcsAssetUsagePolicy = {
  engine: "RadarSim sim_rcs",
  source: "Synthetic canonical mesh assets",
  policy:
    "Use raw sim_rcs for aspect-angle response shape, then normalize to nominal dBsm until measured RCS or validated CAD/material data is connected.",
  boundary: "Not measured RCS, not production CAD, not full EM ray tracing.",
};
