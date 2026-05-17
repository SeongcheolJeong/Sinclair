export type SensorType = "camera" | "radar" | "lidar" | "fusion";

export type RunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "review"
  | "draft"
  | "active"
  | "paused";

export type Severity = "high" | "medium" | "low";

export type Persona =
  | "Camera Engineer"
  | "Radar Engineer"
  | "LiDAR Engineer"
  | "Fusion Engineer"
  | "Validation Engineer"
  | "Program Lead";

export type ValidationMode = "Log Replay" | "Synthetic Re-render" | "Physical Validation";

export type ValidationFeasibility =
  | "Replayable"
  | "Simulatable"
  | "Physical Required"
  | "Approximation Only"
  | "Replayable if RAW";

export type RadarValidationMode =
  | "Detection / Track Replay"
  | "Signal Processing Replay"
  | "Signal-level Simulation"
  | "Physical Validation";

export type RadarDataFidelity =
  | "Track only"
  | "Point cloud"
  | "Range-Doppler"
  | "Radar cube"
  | "Raw ADC/IQ"
  | "Synthetic signal";

export type RadarValidationFeasibility =
  | "Replayable"
  | "Reprocessable"
  | "Simulatable"
  | "Approximation"
  | "Physical Required";

export type LidarValidationMode =
  | "Detection / Track Replay"
  | "Point Cloud Reprocessing"
  | "Synthetic Ray-cast Simulation"
  | "Physical Validation";

export type LidarDataFidelity =
  | "Detections only"
  | "Tracks"
  | "Point cloud frame"
  | "Ring / intensity / timestamp"
  | "Motion-compensated cloud"
  | "Multi-sweep cloud"
  | "Voxel / pillar tensor"
  | "Ground segmentation"
  | "Synthetic ray-cast";

export type LidarValidationFeasibility =
  | "Replayable"
  | "Reprocessable"
  | "Simulatable"
  | "Approximation Only"
  | "Physical Required";

export interface Workspace {
  id: string;
  name: string;
  team: string;
  status: RunStatus;
  updatedAt: string;
  sensors: SensorType[];
  regressionCount: number;
  readiness: number;
  latestRunId: string;
}

export interface Experiment {
  id: string;
  name: string;
  goal:
    | "Sensor design comparison"
    | "Algorithm parameter sweep"
    | "Fusion strategy comparison"
    | "Regression validation"
    | "Robustness / degradation test"
    | "Release candidate evaluation";
  baseline: string;
  testSuite: string;
  changedParameters: string[];
  guardrailProfile: string;
  runEstimate: {
    runs: number;
    computeHours: number;
    estimatedCost: string;
  };
  owner: string;
  status: RunStatus;
}

export interface EvaluationRun {
  id: string;
  experimentId: string;
  workspaceId: string;
  name: string;
  status: RunStatus;
  sensors: SensorType[];
  environment: string;
  progress: number;
  updatedAt: string;
  stackVersion: string;
  dataset: string;
  gtQuality: "verified" | "warning" | "needs review";
  comparability: "clean" | "warning";
  keyDelta: number;
}

export interface SensorConfig {
  sensor: SensorType;
  physicalSpec: string[];
  processing: string[];
  algorithm: string[];
  health: {
    availability: number;
    latencyMs: number;
    syncOffsetMs: number;
    calibration: "nominal" | "warning" | "critical";
  };
}

export interface MetricDefinition {
  metricId: string;
  name: string;
  description: string;
  unit: string;
  higherIsBetter: boolean;
  aggregationMethod: "mean" | "p95" | "sum" | "rate" | "count";
  applicableLevel: "frame" | "object" | "track" | "scenario" | "run";
  applicableSensor: SensorType | "all";
  thresholdGood: number;
  thresholdWarning: number;
  thresholdFail: number;
}

export interface MetricValue {
  metricId: string;
  runId: string;
  sensor: SensorType;
  value: number;
  delta: number;
  sampleCount: number;
  coverage: number;
  trend: number[];
}

export interface Scenario {
  id: string;
  name: string;
  suite: string;
  weather: "clear" | "rain" | "fog" | "snow";
  lighting: "day" | "night" | "glare" | "tunnel";
  roadType: "urban" | "highway" | "parking" | "rural";
  rangeBand: "0-20m" | "20-40m" | "40-80m" | "80m+";
  objectClass: "vehicle" | "pedestrian" | "cyclist" | "traffic sign";
  coverage: number;
  regressions: number;
}

export interface ErrorEvent {
  id: string;
  runId: string;
  scenarioId: string;
  frameStart: number;
  frameEnd: number;
  objectId: string;
  sensor: SensorType;
  errorType:
    | "Sensor FN"
    | "Sensor FP"
    | "Fusion FN"
    | "Fusion FP"
    | "Wrong class"
    | "Localization error"
    | "Velocity error"
    | "ID switch"
    | "Fragmentation"
    | "Late birth"
    | "Early death"
    | "Calibration issue"
    | "Timestamp sync issue"
    | "Simulation artifact"
    | "GT issue";
  severity: Severity;
  metricImpact: string;
  rootCauseLabel:
    | "Sensor limitation"
    | "Calibration"
    | "Timestamp sync"
    | "Detection threshold"
    | "Association parameter"
    | "Tracker parameter"
    | "GT issue"
    | "Simulation artifact"
    | "Unknown";
  owner: "Camera" | "Radar" | "LiDAR" | "Fusion" | "Data" | "Simulation";
  status: "New" | "Investigating" | "Fixed" | "Accepted risk" | "GT issue";
  artifactLink: string;
}

export interface FusionAttribution {
  runId: string;
  objectId: string;
  finalClass: string;
  finalPositionSource: SensorType;
  finalVelocitySource: SensorType;
  acceptedRate: Record<Exclude<SensorType, "fusion">, number>;
  rejectedRate: Record<Exclude<SensorType, "fusion">, number>;
  contributionMatrix: Array<{
    attribute: "class" | "position" | "velocity" | "track stability";
    camera: number;
    radar: number;
    lidar: number;
  }>;
  conflictCases: string[];
  gainLoss: {
    fusionGain: number;
    fusionLoss: number;
    sensorOverrideError: number;
  };
  objectStory: string[];
}

export interface Report {
  id: string;
  title: string;
  type: "Release" | "Validation" | "Experiment";
  status: RunStatus;
  readiness: number;
  coverage: number;
  openRisks: number;
  generatedAt: string;
  signOff: "ready" | "blocked" | "needs review";
}

export interface Template {
  id: string;
  name: string;
  purpose: string;
  prefilled: string[];
  sensors: SensorType[];
}

export interface SensorWorkbenchState {
  sensor: SensorType;
  title: string;
  summary: string;
  config: SensorConfig;
  metrics: MetricValue[];
  designChecks: Array<{
    name: string;
    value: string;
    status: "pass" | "warn" | "fail";
  }>;
  failureBuckets: Array<{
    name: string;
    count: number;
    severity: Severity;
  }>;
  viewerLayers: string[];
  fusionNotes: string[];
}

export interface CameraConfigurationChange {
  group:
    | "Sensor & Lens"
    | "Image Sensor"
    | "ISP"
    | "Perception"
    | "Mounting / Extrinsic"
    | "Timing / Sync";
  parameter: string;
  baseline: string;
  candidate: string;
  feasibility: ValidationFeasibility;
  impact: string;
}

export interface CameraWorkbenchModel {
  cameraName: string;
  cameraRole: string[];
  knownWeakness: string[];
  validationMode: ValidationMode;
  baseline: string;
  candidate: string;
  dataset: string;
  scenarioSource: string;
  comparable: boolean;
  feasibilityWarning: string;
  configChanges: CameraConfigurationChange[];
  designImpact: {
    changed: string[];
    benefits: string[];
    tradeOffs: string[];
    recommendation: string;
  };
  pixelHeightByDistance: Array<{
    distance: string;
    pedestrian: number;
    cyclist: number;
    vehicle: number;
    trafficSign: number;
    recommended: number;
  }>;
  imageQualityFailure: Array<{
    factor: string;
    pedestrianFn: number;
    cyclistConfusion: number;
    trafficLightError: number;
  }>;
  recallByPixelSize: Array<{
    bucket: string;
    pedestrian: number;
    cyclist: number;
    vehicle: number;
    trafficSign: number;
  }>;
  ispSensitivity: Array<{
    denoise: string;
    snr: number;
    smallObjectRecall: number;
    falsePositive: number;
    latency: number;
  }>;
  fusionContribution: Array<{
    scenario: string;
    accepted: number;
    rejected: number;
    cameraOnlyTp: number;
    cameraTpFusionFn: number;
    cameraFpAccepted: number;
  }>;
  metricMapping: Array<{
    config: string;
    metrics: string[];
    charts: string[];
  }>;
  characterization: {
    lensSummary: Array<{
      label: string;
      value: string;
      evidence: "Datasheet" | "Measured Lab" | "Synthetic" | "Physical Required";
    }>;
    mtfByFrequency: Array<{
      frequency: string;
      center: number;
      midField: number;
      edge: number;
      candidateEdge: number;
    }>;
    qeResponse: Array<{
      wavelength: string;
      baseline: number;
      candidate: number;
    }>;
    sensorNoise: Array<{
      lux: string;
      shotNoise: number;
      readNoise: number;
      snr: number;
      pedestrianRecall: number;
    }>;
    macbethResponse: Array<{
      patch: string;
      deltaE: number;
      saturation: number;
      classifierShift: number;
    }>;
    ispComparison: Array<{
      stage: string;
      snr: number;
      sharpness: number;
      smallObjectRecall: number;
      trafficLightError: number;
    }>;
    perceptionCorrelations: Array<{
      characteristic: string;
      observation: string;
      effect: string;
      evidence: "Datasheet" | "Measured Lab" | "Synthetic" | "Physical Required";
    }>;
  };
}

export interface CameraE2ELiveImportStatus {
  available: boolean;
  python: string;
  command: string;
  stdout?: string;
  stderr?: string;
  returncode?: number;
  error?: string;
}

export interface CameraE2ECapability {
  area: string;
  status: "linked" | "available" | "not_available" | "future";
  description: string;
  evidence: string;
}

export interface CameraE2EPipelineStage {
  stage: "lens" | "sensor" | "isp" | string;
  edgeRcMeanRelPct: number;
  cropNormalizedMae: number;
  profileNormalizedMae: number;
  cropMaxAbs: number;
  profileMaxAbs: number;
  cropFigureUrl?: string;
  cropFigureSourcePath?: string;
  profileFigureUrl?: string;
  profileFigureSourcePath?: string;
}

export interface CameraE2EEvidenceImage {
  id: string;
  title: string;
  stage: "parity" | "hw_isp" | string;
  kind: "image" | "json" | "html" | "markdown";
  description: string;
  sourcePath: string;
  url: string;
}

export interface CameraE2EIntegration {
  schemaVersion: number;
  generatedAt: string;
  sourceRoot: string;
  package: {
    name: string;
    version: string;
    pipeline: string;
    liveImport: CameraE2ELiveImportStatus;
  };
  bridge: {
    mode: string;
    command: string;
    output: string;
    refreshPolicy: string;
  };
  capabilities: CameraE2ECapability[];
  summary: {
    parity: {
      generatedAt?: string;
      gitCommit?: string;
      selectedCases: number;
      passed: number;
      failed: number;
      skipped: number;
    };
    pipeline: {
      caseName?: string;
      gitCommit?: string;
      sceneSize?: string;
      sceneFovDeg?: number;
      oiSize?: string;
      sensorSize?: string;
      ipSize?: string;
    };
    hwIsp: {
      generatedAt?: string;
      gitCommit?: string;
      profile?: string;
      frameCount: number;
      e2eLatencyMeanMs: number;
      queueStallTotalMs: number;
      threeAE2ELatencyMeanMs: number;
      aeSettleFrame: number;
      awbSettleFrame: number;
      aeFinalErrorEv: number;
      awbFinalRgbImbalance: number;
      validationVerdicts: Record<string, boolean>;
    };
    liveSimulation?: {
      available: boolean;
      status: string;
      scene?: string;
      cameraPipeline?: string;
      imageShape?: number[];
      elapsedMs?: number;
      outputPath?: string;
      url?: string;
      reason?: string;
      stdout?: string;
      stderr?: string;
      returncode?: number;
      error?: string;
    };
    verification: Array<{
      command: string;
      status: string;
      returncode: number | null;
      summary: string;
      output_tail: string[];
    }>;
  };
  pipelineStages: CameraE2EPipelineStage[];
  evidenceImages: CameraE2EEvidenceImage[];
  warnings: string[];
  adapterContract: {
    request: Record<string, string>;
    response: Record<string, string>;
  };
}

export interface CameraSimulationRequest {
  runId?: string;
  assets?: {
    lensMode: "none" | "raytraceOptics" | "catalogLens" | "lensFileReference";
    lensAsset?: string;
    sensorType: string;
    sensorVariant?: string;
    colorFilterAsset?: string;
  };
  scene: {
    type: "macbeth" | "slanted bar" | "point array" | "harmonic" | "uniform ee" | "dead leaves";
    patchSize?: number;
    fovDeg: number;
    luminanceCdM2: number;
  };
  lens: {
    fNumber: number;
    focalLengthMm: number;
    hfovDeg: number;
    transmittanceScale: number;
  };
  lensPhysics?: {
    mode: "none" | "diffraction" | "gaussianPsf" | "wvfDefocus" | "raytracePsf";
    gaussianSpreadUm: number;
    xyRatio: number;
    aberrationPixels: number;
    defocusDiopters: number;
    psfAngleStepDeg: number;
  };
  sensor: {
    fitMode?: "preserveResolution" | "matchSceneFov";
    rows: number;
    cols: number;
    pixelSizeUm: number;
    exposureMs: number;
    analogGain: number;
    noiseFlag: number;
    readNoiseMv: number;
    qeScale: number;
    bitDepth: number;
  };
  isp: {
    demosaicMethod: string;
    illuminantCorrection: string;
  };
  perception: {
    model: string;
    inputSize: string;
    confidenceThreshold: number;
    nmsThreshold: number;
  };
}

export interface CameraSimulationArtifact {
  path: string;
  url: string;
}

export interface CameraSimulationResult {
  schemaVersion: number;
  runId: string;
  status: "completed" | "failed";
  createdAt?: string;
  elapsedMs?: number;
  request?: CameraSimulationRequest;
  applied?: string[];
  warnings?: string[];
  summaries?: {
    scene?: Record<string, string | number | number[]>;
    lens?: Record<string, string | number | number[]>;
    sensor?: Record<string, string | number | number[]>;
    isp?: Record<string, string | number | number[]>;
    assets?: Record<string, string | number | number[]>;
    physics?: Record<string, string | number | number[]>;
    resolution?: Record<string, string | number | number[]>;
  };
  metrics?: {
    imageShape?: number[];
    meanRgb?: number[];
    sensorVoltsMean?: number | null;
    sensorVoltsP99?: number | null;
    oiPhotonsMean?: number | null;
    perceptionProxy?: {
      adapterStatus: "proxy_only" | string;
      model: string;
      inputSize: string;
      confidenceThreshold: number;
      nmsThreshold: number;
      proxyConfidence: number;
      proxyAccepted: boolean;
      edgeEnergy: number;
      meanLuma: number;
      saturationRatio: number;
      warning: string;
    };
  };
  artifacts?: {
    ipSrgb?: CameraSimulationArtifact;
    sensorVolts?: CameraSimulationArtifact;
    oiPhotons?: CameraSimulationArtifact;
  };
  reason?: string;
  stderr?: string;
  returncode?: number | null;
}

export interface CameraE2EAssetOption {
  id: string;
  label: string;
  path?: string;
  type?: string;
  variant?: string;
  kind:
    | "raytraceOptics"
    | "catalogLens"
    | "lensFileReference"
    | "sensorConstructor"
    | "sensorModelFile"
    | "spectralFilter"
    | "irFilter"
    | "photoDetectorQe"
    | "sensorFile"
    | "colorFilter";
  testable: boolean;
  summary?: string;
  notes?: string[];
}

export interface CameraE2EAssetIndex {
  schemaVersion: number;
  generatedAt: string;
  sourceRoot: string;
  snapshotRoot?: string;
  lensAssets: CameraE2EAssetOption[];
  sensorAssets: CameraE2EAssetOption[];
  warnings: string[];
}

export interface RadarConfigurationChange {
  group:
    | "RF / Antenna"
    | "Waveform / Timing"
    | "Signal Processing"
    | "Detection / CFAR"
    | "Point Filtering"
    | "Clustering / Tracking"
    | "Degradation / Environment"
    | "Fusion"
    | "Output Contract";
  parameter: string;
  baseline: string;
  candidate: string;
  feasibility: RadarValidationFeasibility;
  requiredFidelity: RadarDataFidelity;
  impact: string;
}

export interface RadarWorkbenchModel {
  radarName: string;
  role: string[];
  knownWeakness: string[];
  validationMode: RadarValidationMode;
  dataFidelity: RadarDataFidelity[];
  baseline: string;
  candidate: string;
  scenarioSuite: string;
  comparable: boolean;
  fidelityWarning: string;
  configChanges: RadarConfigurationChange[];
  designImpact: {
    benefits: string[];
    risks: string[];
    recommendation: string;
  };
  kpis: Array<{
    label: string;
    value: string;
    delta: string;
    tone: "good" | "warn" | "bad" | "neutral";
  }>;
  detectionProbabilityByRange: Array<{
    range: string;
    vehicle: number;
    pedestrian: number;
    cyclist: number;
    motorcycle: number;
  }>;
  cfarSensitivity: Array<{
    pfa: string;
    detectionRecall: number;
    falseAlarm: number;
    ghostRate: number;
    fusionFalseTrack: number;
  }>;
  azimuthSeparation: Array<{
    distance: string;
    baselineMerged: number;
    candidateMerged: number;
    separationGain: number;
  }>;
  velocityTimeline: Array<{
    time: string;
    groundTruth: number;
    radar: number;
    fusion: number;
  }>;
  ghostHeatmap: Array<{
    scenario: string;
    rain: number;
    guardrail: number;
    tunnel: number;
    urban: number;
  }>;
  fusionContribution: Array<{
    scenario: string;
    accepted: number;
    rejected: number;
    radarOnlyTp: number;
    ghostAccepted: number;
    velocityImprovedTrack: number;
    conflict: number;
  }>;
  outputContract: Array<{
    level: "Point-level" | "Cluster-level" | "Track-level";
    fields: string[];
  }>;
  artifactLevels: Array<{
    level: string;
    artifact: string;
    useCase: string;
    storagePolicy: string;
  }>;
  failureBuckets: Array<{
    name: string;
    impact: string;
    relatedChanges: string[];
    followUp: string;
    severity: Severity;
  }>;
}

export interface LidarConfigurationChange {
  group:
    | "Hardware / Optical"
    | "Scan Pattern / Timing"
    | "Mounting / Calibration"
    | "Point Cloud Simulation"
    | "Point Processing"
    | "3D Perception"
    | "Tracking"
    | "Degradation / Environment"
    | "Fusion"
    | "Output Contract";
  parameter: string;
  baseline: string;
  candidate: string;
  feasibility: LidarValidationFeasibility;
  requiredFidelity: LidarDataFidelity;
  impact: string;
}

export interface LidarWorkbenchModel {
  lidarName: string;
  role: string[];
  knownWeakness: string[];
  validationMode: LidarValidationMode;
  dataFidelity: LidarDataFidelity[];
  baseline: string;
  candidate: string;
  scenarioSuite: string;
  comparable: boolean;
  fidelityWarning: string;
  configChanges: LidarConfigurationChange[];
  designImpact: {
    benefits: string[];
    risks: string[];
    recommendation: string;
  };
  kpis: Array<{
    label: string;
    value: string;
    delta: string;
    tone: "good" | "warn" | "bad" | "neutral";
  }>;
  pointCountByDistance: Array<{
    distance: string;
    vehicle: number;
    pedestrian: number;
    cyclist: number;
    cone: number;
    minimum: number;
  }>;
  recallByPointCount: Array<{
    bucket: string;
    vehicle: number;
    pedestrian: number;
    cyclist: number;
    cone: number;
  }>;
  voxelPareto: Array<{
    voxel: string;
    latency: number;
    ap3d: number;
    memory: number;
    guardrail: "pass" | "warn" | "fail";
  }>;
  groundSegmentation: Array<{
    slice: string;
    groundPrecision: number;
    objectRetention: number;
    falseGroundRemoval: number;
  }>;
  weatherRangeRecall: Array<{
    scenario: string;
    clear: number;
    rain: number;
    fog: number;
    dust: number;
  }>;
  fusionContribution: Array<{
    scenario: string;
    accepted: number;
    rejected: number;
    lidarOnlyTp: number;
    geometrySource: number;
    lidarTpFusionFn: number;
    lidarFpAccepted: number;
  }>;
  outputContract: Array<{
    level: "Point-level" | "Object-level" | "Segmentation-level" | "Track-level";
    fields: string[];
  }>;
  artifactLevels: Array<{
    level: string;
    artifact: string;
    useCase: string;
    storagePolicy: string;
  }>;
  failureBuckets: Array<{
    name: string;
    impact: string;
    relatedChanges: string[];
    followUp: string;
    severity: Severity;
  }>;
}

export interface RunCompare {
  baselineRun: EvaluationRun;
  candidateRun: EvaluationRun;
  executiveSummary: string;
  metricDeltas: Array<{
    metric: string;
    sensor: SensorType;
    baseline: number;
    candidate: number;
    delta: number;
    unit: string;
  }>;
  parameterDiff: Array<{
    module: string;
    parameter: string;
    baseline: string;
    candidate: string;
  }>;
  regressions: string[];
  improvements: string[];
}
