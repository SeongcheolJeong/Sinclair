import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  Camera,
  Car,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ClipboardList,
  Database,
  FileText,
  Grid2X2,
  Layers3,
  MonitorPlay,
  Network,
  Play,
  Plus,
  RadioTower,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  TimerReset,
  UserCircle,
  Waves,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as ReLineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar as ReRadar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  dashboardTrends,
  paretoData,
  sensorLabels,
  sweepLineData,
} from "./data/mockData";
import {
  radarRcsAssetLibraryRoot,
  radarRcsAssets,
  radarRcsAssetUsagePolicy,
} from "./data/radarRcsAssets";
import {
  getCameraE2EAssets,
  getCameraE2EDefaultEvaluationResult,
  getCameraE2EDefaultPipelineResult,
  getCameraE2EDefaultStackResult,
  getCameraE2EIntegration,
  getCameraWorkbenchModel,
  getFusionAttribution,
  getLidarWorkbenchModel,
  getRadarWorkbenchModel,
  getRunCompare,
  getWorkbenchState,
  listErrorEvents,
  listExperiments,
  listReports,
  listRuns,
  listScenarios,
  listTemplates,
  listWorkspaces,
  runCameraE2ESimulation,
  runRadarSimSimulation,
} from "./services/platform";
import type {
  CameraE2EAssetIndex,
  CameraE2EAssetOption,
  CameraE2EIntegration,
  CameraE2EEvidenceImage,
  CameraE2EPipelineStage,
  CameraSimulationRequest,
  CameraSimulationResult,
  CameraStaticChart,
  CameraWorkbenchModel,
  ErrorEvent,
  EvaluationRun,
  LidarDataFidelity,
  LidarValidationFeasibility,
  LidarWorkbenchModel,
  RadarSimulationRequest,
  RadarSimulationResult,
  Report,
  RadarDataFidelity,
  RadarTargetAssociation,
  RadarValidationFeasibility,
  RadarWorkbenchModel,
  RunStatus,
  Scenario,
  SensorType,
  SensorWorkbenchState,
  Severity,
  Template,
  ValidationFeasibility,
} from "./types/domain";

type Route =
  | "launchpad"
  | "workspaces"
  | "experiments"
  | "workbench"
  | "fusion"
  | "scenarios"
  | "reports"
  | "docs";

type CameraRunMode = NonNullable<CameraSimulationRequest["runMode"]>;
type CameraRunStatus = "idle" | "running" | "completed" | "failed";

const navItems: Array<{ route: Route; label: string; icon: ReactNode }> = [
  { route: "workspaces", label: "Workspaces", icon: <Grid2X2 size={16} /> },
  { route: "experiments", label: "Experiments", icon: <Activity size={16} /> },
  { route: "workbench", label: "Sensor Workbench", icon: <MonitorPlay size={16} /> },
  { route: "fusion", label: "Fusion Analysis", icon: <Network size={16} /> },
  { route: "scenarios", label: "Scenario Library", icon: <Layers3 size={16} /> },
  { route: "reports", label: "Reports", icon: <FileText size={16} /> },
  { route: "docs", label: "Docs", icon: <BookOpen size={16} /> },
];

const defaultCameraSimulationRequest: CameraSimulationRequest = {
  assets: {
    lensMode: "none",
    lensAsset: "",
    sensorType: "default",
    sensorVariant: "",
    colorFilterAsset: "",
  },
  scene: {
    geometryMode: "angularFov",
    type: "rgb image",
    patchSize: 8,
    sourceImagePath: "/assets/camera-e2e/default-scenes/signed_pedestrian_crosswalk_01_1024.jpg",
    sourceImageLabel: "Signed Pedestrian Crosswalk 01",
    sourceImageAttribution: "Wikimedia Commons · Lumikeiju · CC0 1.0",
    targetWidthM: 0.7,
    targetHeightM: 1.7,
    distanceM: 24,
    fovDeg: 60,
    luminanceCdM2: 240,
  },
  lens: {
    fovAuthority: "numericOptics",
    fNumber: 2.8,
    focalLengthMm: 1.24,
    hfovDeg: 60,
    transmittanceScale: 0.92,
  },
  lensPhysics: {
    mode: "none",
    gaussianSpreadUm: 2.5,
    xyRatio: 1,
    aberrationPixels: 0,
    defocusDiopters: 1.25,
    psfAngleStepDeg: 30,
  },
  calibration: {
    principalPointX: 256,
    principalPointY: 192,
    radialK1: 0,
    radialK2: 0,
    radialK3: 0,
    tangentialP1: 0,
    tangentialP2: 0,
  },
  sensor: {
    fitMode: "preserveResolution",
    rows: 384,
    cols: 512,
    pixelSizeUm: 2.8,
    exposureMs: 16,
    analogGain: 1.8,
    noiseFlag: 2,
    readNoiseMv: 2.1,
    qeScale: 1,
    bitDepth: 12,
  },
  isp: {
    demosaicMethod: "bilinear",
    sensorConversionMethod: "mcc optimized",
    internalColorSpace: "xyz",
    illuminantCorrection: "gray world",
    renderScale: true,
    renderDemosaicOnly: false,
    hdrWhite: false,
    hdrLevel: 0.95,
  },
  hwIsp: {
    enabled: false,
    profile: "generic_1080p_30fps",
    applyToImage: false,
    nFrames: 4,
    fps: 30,
    lineTimeUs: 15.2,
    exposureTimeUs: 8000,
    aeEnabled: true,
    awbEnabled: true,
    aeApplyDelayFrames: 2,
    awbApplyDelayFrames: 2,
    targetLuma: 0.18,
    requestQueueDepth: 4,
    maxBuffers: 6,
    globalLatencyFactor: 1,
  },
  perception: {
    model: "ultralytics_yolo11n_detection",
    inputSize: "640x384",
    confidenceThreshold: 0.25,
    nmsThreshold: 0.5,
  },
};

type CameraDrivingSceneProfile = {
  sceneType: CameraSimulationRequest["scene"]["type"];
  geometryMode?: CameraSimulationRequest["scene"]["geometryMode"];
  sourceImagePath?: string;
  sourceImageLabel?: string;
  sourceImageAttribution?: string;
  targetWidthM: number;
  targetHeightM: number;
  distanceM: number;
  fovDeg?: number;
  luminanceCdM2: number;
  adapterNote: string;
};

type CameraExampleScene = CameraDrivingSceneProfile & {
  id: string;
  label: string;
  category: string;
  scenarioId: string;
};

const cameraExampleScenes: CameraExampleScene[] = [
  {
    id: "rgb-urban-crosswalk",
    label: "Urban crosswalk / pedestrian",
    category: "RGB road scene",
    scenarioId: "sc-night-crosswalk",
    sceneType: "rgb image",
    geometryMode: "angularFov",
    sourceImagePath: "/assets/camera-e2e/default-scenes/signed_pedestrian_crosswalk_01_1024.jpg",
    sourceImageLabel: "Signed Pedestrian Crosswalk 01",
    sourceImageAttribution: "Wikimedia Commons · Lumikeiju · CC0 1.0",
    targetWidthM: 0.7,
    targetHeightM: 1.7,
    distanceM: 24,
    fovDeg: 60,
    luminanceCdM2: 240,
    adapterNote: "Downloaded CC0 road-scene baseline: the RGB image is processed through CameraE2E optics, sensor, ISP, and perception.",
  },
  {
    id: "rgb-rain-urban",
    label: "Rainy urban street",
    category: "RGB road scene",
    scenarioId: "sc-rain-urban-20-40",
    sceneType: "rgb image",
    geometryMode: "angularFov",
    sourceImagePath: "/assets/camera-e2e/default-scenes/rainy_street_midwest_1024.jpg",
    sourceImageLabel: "Rainy Street",
    sourceImageAttribution: "Wikimedia Commons · source image",
    targetWidthM: 2.0,
    targetHeightM: 1.6,
    distanceM: 32,
    fovDeg: 64,
    luminanceCdM2: 85,
    adapterNote: "Rainy RGB road scene: useful for ISP tone, wet-road contrast, and perception overlay smoke tests.",
  },
  {
    id: "rgb-city-street",
    label: "Dense city street",
    category: "RGB road scene",
    scenarioId: "sc-night-crosswalk",
    sceneType: "rgb image",
    geometryMode: "angularFov",
    sourceImagePath: "/assets/camera-e2e/default-scenes/city_street_bethesda_1280.jpg",
    sourceImageLabel: "City street",
    sourceImageAttribution: "Wikimedia Commons · source image",
    targetWidthM: 3.5,
    targetHeightM: 2.1,
    distanceM: 28,
    fovDeg: 70,
    luminanceCdM2: 210,
    adapterNote: "Daytime city RGB scene: useful for object-rich ISP output and perception adapter checks.",
  },
  {
    id: "rgb-tunnel",
    label: "Tunnel road / low light",
    category: "RGB road scene",
    scenarioId: "sc-tunnel-sign",
    sceneType: "rgb image",
    geometryMode: "angularFov",
    sourceImagePath: "/assets/camera-e2e/default-scenes/one_lane_tunnel_1024.jpg",
    sourceImageLabel: "One lane tunnel",
    sourceImageAttribution: "Wikimedia Commons · source image",
    targetWidthM: 2.4,
    targetHeightM: 1.6,
    distanceM: 55,
    fovDeg: 58,
    luminanceCdM2: 70,
    adapterNote: "Tunnel RGB scene: useful for low-light tone mapping, clipping, and traffic-sign contrast experiments.",
  },
  {
    id: "rgb-highway",
    label: "Highway traffic",
    category: "RGB road scene",
    scenarioId: "sc-highway-long",
    sceneType: "rgb image",
    geometryMode: "angularFov",
    sourceImagePath: "/assets/camera-e2e/default-scenes/oncoming_highway_traffic_1280.jpg",
    sourceImageLabel: "On coming traffic on highway",
    sourceImageAttribution: "Wikimedia Commons · source image",
    targetWidthM: 1.9,
    targetHeightM: 1.5,
    distanceM: 90,
    fovDeg: 52,
    luminanceCdM2: 180,
    adapterNote: "Highway RGB scene: useful for long-range vehicle contrast and scene-pipeline perception checks.",
  },
  {
    id: "chart-dead-leaves",
    label: "Dead leaves texture",
    category: "Camera validation chart",
    scenarioId: "sc-fog-cyclist",
    sceneType: "dead leaves",
    geometryMode: "physicalGeometry",
    targetWidthM: 1.8,
    targetHeightM: 1.5,
    distanceM: 36,
    luminanceCdM2: 72,
    adapterNote: "Cyclist texture/occlusion proxy: dead-leaves texture stresses ISP and detector features.",
  },
  {
    id: "chart-macbeth",
    label: "Macbeth color chart",
    category: "Camera validation chart",
    scenarioId: "sc-tunnel-sign",
    sceneType: "macbeth",
    geometryMode: "physicalGeometry",
    targetWidthM: 0.9,
    targetHeightM: 0.9,
    distanceM: 62,
    luminanceCdM2: 95,
    adapterNote: "Traffic-sign proxy: color response and clipping at tunnel-exit range.",
  },
  {
    id: "chart-slanted-bar",
    label: "Slanted bar / MTF proxy",
    category: "Camera validation chart",
    scenarioId: "sc-highway-long",
    sceneType: "slanted bar",
    geometryMode: "physicalGeometry",
    targetWidthM: 1.9,
    targetHeightM: 1.5,
    distanceM: 90,
    luminanceCdM2: 140,
    adapterNote: "Long-range vehicle proxy: edge contrast and MTF at far target distance.",
  },
  {
    id: "chart-harmonic",
    label: "Harmonic contrast pattern",
    category: "Camera validation chart",
    scenarioId: "sc-rain-urban-20-40",
    sceneType: "harmonic",
    geometryMode: "physicalGeometry",
    targetWidthM: 2.0,
    targetHeightM: 1.6,
    distanceM: 32,
    luminanceCdM2: 55,
    adapterNote: "Rain urban proxy: harmonic contrast and low luminance for wet-road visibility.",
  },
];

const defaultCameraExampleSceneId = "rgb-urban-crosswalk";

const cameraDrivingSceneProfiles: Record<string, CameraDrivingSceneProfile> = {
  "sc-night-crosswalk": cameraExampleScenes.find((scene) => scene.id === "rgb-urban-crosswalk") ?? cameraExampleScenes[0],
  "sc-fog-cyclist": cameraExampleScenes.find((scene) => scene.id === "chart-dead-leaves") ?? cameraExampleScenes[0],
  "sc-tunnel-sign": cameraExampleScenes.find((scene) => scene.id === "rgb-tunnel") ?? cameraExampleScenes[0],
  "sc-highway-long": cameraExampleScenes.find((scene) => scene.id === "rgb-highway") ?? cameraExampleScenes[0],
  "sc-rain-urban-20-40": cameraExampleScenes.find((scene) => scene.id === "rgb-rain-urban") ?? cameraExampleScenes[0],
};

function getCameraDrivingSceneProfile(scenario?: Scenario): CameraDrivingSceneProfile {
  if (scenario && cameraDrivingSceneProfiles[scenario.id]) {
    return cameraDrivingSceneProfiles[scenario.id];
  }
  if (scenario?.objectClass === "traffic sign") {
    return cameraDrivingSceneProfiles["sc-tunnel-sign"];
  }
  if (scenario?.objectClass === "pedestrian") {
    return cameraDrivingSceneProfiles["sc-night-crosswalk"];
  }
  if (scenario?.objectClass === "cyclist") {
    return cameraDrivingSceneProfiles["sc-fog-cyclist"];
  }
  return cameraDrivingSceneProfiles["sc-highway-long"];
}

const radarPresetLabels: Record<RadarSimulationRequest["preset"], string> = {
  highwayCutIn: "Highway cut-in",
  rainGuardrailGhost: "Rain / guardrail ghost",
  lowRcsPedestrian: "Low-RCS pedestrian",
  twoTargetSeparation: "Two-target separation",
  offAxisMimo: "Off-axis MIMO",
};

const radarPresetTargets: Record<RadarSimulationRequest["preset"], RadarSimulationRequest["targets"]> = {
  highwayCutIn: [
    { label: "lead vehicle", semanticClass: "vehicle", lengthM: 4.7, widthM: 1.9, rangeM: 84, azimuthM: 0, rcsDbsm: 14, radialVelocityMps: -11.5 },
    { label: "cut-in vehicle", semanticClass: "vehicle", lengthM: 4.5, widthM: 1.9, rangeM: 62, azimuthM: -2.4, rcsDbsm: 11, radialVelocityMps: -8.2 },
    { label: "guardrail weak return", semanticClass: "guardrail", lengthM: 14, widthM: 0.35, rangeM: 58, azimuthM: 4.2, rcsDbsm: -7, radialVelocityMps: 0.8, ghost: true },
  ],
  rainGuardrailGhost: [
    { label: "vehicle", semanticClass: "vehicle", lengthM: 4.6, widthM: 1.9, rangeM: 52, azimuthM: 0.3, rcsDbsm: 12, radialVelocityMps: -5.5 },
    { label: "guardrail multipath", semanticClass: "guardrail", lengthM: 16, widthM: 0.35, rangeM: 34, azimuthM: 4.4, rcsDbsm: -4.5, radialVelocityMps: -1.2, ghost: true },
    { label: "rain clutter", semanticClass: "clutter", lengthM: 2.8, widthM: 2.8, rangeM: 27, azimuthM: -3.2, rcsDbsm: -10, radialVelocityMps: 0.7, ghost: true },
  ],
  lowRcsPedestrian: [
    { label: "pedestrian low RCS", semanticClass: "pedestrian", lengthM: 0.7, widthM: 0.55, rangeM: 42, azimuthM: 1.2, rcsDbsm: -3, radialVelocityMps: -1.4 },
    { label: "vehicle context", semanticClass: "vehicle", lengthM: 4.7, widthM: 1.9, rangeM: 75, azimuthM: -1.6, rcsDbsm: 13, radialVelocityMps: -6 },
  ],
  twoTargetSeparation: [
    { label: "adjacent vehicle A", semanticClass: "vehicle", lengthM: 4.7, widthM: 1.9, rangeM: 78, azimuthM: -1.1, rcsDbsm: 12.5, radialVelocityMps: -9 },
    { label: "adjacent vehicle B", semanticClass: "vehicle", lengthM: 4.7, widthM: 1.9, rangeM: 81, azimuthM: 1.1, rcsDbsm: 12, radialVelocityMps: -8.6 },
  ],
  offAxisMimo: [
    { label: "off-axis vehicle", semanticClass: "vehicle", lengthM: 4.6, widthM: 1.9, rangeM: 55, azimuthM: 3, rcsDbsm: 12, radialVelocityMps: -7.5 },
    { label: "off-axis ghost", semanticClass: "ghost", lengthM: 3.8, widthM: 1.6, rangeM: 62, azimuthM: -4.6, rcsDbsm: -6, radialVelocityMps: 1.1, ghost: true },
  ],
};

const defaultRadarSimulationRequest: RadarSimulationRequest = {
  preset: "highwayCutIn",
  rcsSource: {
    mode: "scenarioAssumption",
  },
  mimo: {
    mode: "tdm",
  },
  waveform: {
    startFrequencyGhz: 76,
    stopFrequencyGhz: 76.2,
    chirpDurationUs: 40,
    pulses: 32,
    prpUs: 60,
    txPowerDbm: 20,
  },
  receiver: {
    samplingRateMsps: 8,
    noiseFigureDb: 6,
  },
  array: {
    txChannels: 2,
    rxChannels: 2,
    txSpacingM: 0.0039,
    rxSpacingM: 0.00195,
  },
  cfar: {
    pfa: 1e-2,
    guard: 1,
    trailing: 2,
  },
  targets: radarPresetTargets.highwayCutIn,
};

const workflow = [
  { label: "Configure", description: "시나리오 & 센서 구성", icon: <SlidersHorizontal size={18} /> },
  { label: "Simulate", description: "대규모 시뮬레이션 실행", icon: <Play size={18} /> },
  { label: "Evaluate", description: "지표 분석 & 비교", icon: <BarChart3 size={18} /> },
  { label: "Explain", description: "원인 분석 & 인사이트", icon: <BrainCircuit size={18} /> },
  { label: "Decide", description: "개선 사항 적용 & 검증", icon: <ShieldCheck size={18} /> },
];

const quickGuides = [
  {
    role: "Camera Engineer",
    question: "Night, glare, occlusion에서 왜 떨어지는가?",
    target: "Image viewer, FOV, exposure, depth error",
  },
  {
    role: "Radar Engineer",
    question: "Ghost/multipath가 fusion false track으로 들어갔는가?",
    target: "BEV, Range-Doppler, RCS, velocity timeline",
  },
  {
    role: "LiDAR Engineer",
    question: "Point density와 long-range localization은 충분한가?",
    target: "3D point cloud, BEV, point count, sparse analysis",
  },
  {
    role: "Fusion Engineer",
    question: "Output이 왜 accepted/rejected/overridden 되었는가?",
    target: "Contribution matrix, gain/loss, object inspector",
  },
  {
    role: "Validation Engineer",
    question: "Release candidate를 통과시켜도 되는가?",
    target: "Guardrail, regression suite, report",
  },
  {
    role: "Program Lead",
    question: "전체 상태와 리스크는 무엇인가?",
    target: "Mission Control, readiness, top attention",
  },
];

const conceptAssets = [
  {
    title: "Launchpad concept",
    file: "sinclair_launchpad_ux_design_concept.png",
  },
  {
    title: "IA and journey",
    file: "sinclair_platform_ux_concept_board.png",
  },
  {
    title: "Hero and Mission Control",
    file: "futuristic_ui_concept_design_presentation.png",
  },
  {
    title: "Sensor Workbench",
    file: "high_tech_sensor_simulation_ui_concept.png",
  },
  {
    title: "Quick Start and Reports",
    file: "high_tech_ui_concept_with_neon_accents.png",
  },
  {
    title: "Visual system",
    file: "sinclair_ui_design_system_concept.png",
  },
  {
    title: "Platform infographic",
    file: "a_high_detail_infographic_ui_design_mockup_image.png",
  },
  {
    title: "Perception poster",
    file: "a_clean_high_resolution_ux_design_concept_poster.png",
  },
];

function calculatePhysicalHfovDeg(cols: number, pixelSizeUm: number, focalLengthMm: number) {
  const sensorWidthMm = (cols * pixelSizeUm) / 1000;
  if (!Number.isFinite(sensorWidthMm) || !Number.isFinite(focalLengthMm) || sensorWidthMm <= 0 || focalLengthMm <= 0) {
    return null;
  }
  return (2 * Math.atan(sensorWidthMm / (2 * focalLengthMm)) * 180) / Math.PI;
}

function calculateAngularExtentDeg(sizeM: number, distanceM: number) {
  if (!Number.isFinite(sizeM) || !Number.isFinite(distanceM) || sizeM <= 0 || distanceM <= 0) {
    return null;
  }
  return (2 * Math.atan(sizeM / (2 * distanceM)) * 180) / Math.PI;
}

function calculateImageSizeOnSensorMm(sizeM: number, distanceM: number, focalLengthMm: number) {
  if (
    !Number.isFinite(sizeM) ||
    !Number.isFinite(distanceM) ||
    !Number.isFinite(focalLengthMm) ||
    sizeM <= 0 ||
    distanceM <= 0 ||
    focalLengthMm <= 0
  ) {
    return null;
  }
  return 2 * focalLengthMm * Math.tan(Math.atan(sizeM / (2 * distanceM)));
}

function formatDeg(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)} deg` : "-";
}

function formatMm(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(4)} mm` : "-";
}

const topAttention = [
  { label: "Radar ghost increased in Rain / Urban / 20-40m", severity: "high" as Severity },
  { label: "Camera night pedestrian recall dropped by 3.1%", severity: "medium" as Severity },
  { label: "LiDAR long-range vehicle recall improved by 7.8%", severity: "low" as Severity },
  { label: "Fusion ID switch increased in pedestrian crossing", severity: "medium" as Severity },
];

function getInitialRoute(): Route {
  const hash = window.location.hash.replace("#/", "") as Route;
  return navItems.some((item) => item.route === hash) || hash === "launchpad"
    ? hash
    : "launchpad";
}

function App() {
  const [route, setRoute] = useState<Route>(getInitialRoute);
  const [selectedSensor, setSelectedSensor] = useState<Exclude<SensorType, "fusion">>("camera");

  useEffect(() => {
    const handleHashChange = () => setRoute(getInitialRoute());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigate = (nextRoute: Route) => {
    window.location.hash = `/${nextRoute}`;
    setRoute(nextRoute);
  };

  const openWorkbench = (sensor: Exclude<SensorType, "fusion">) => {
    setSelectedSensor(sensor);
    navigate("workbench");
  };

  return (
    <div className="min-h-screen bg-ink-950 text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_8%,rgba(0,229,255,0.16),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(165,104,255,0.14),transparent_28%),linear-gradient(135deg,#030712_0%,#071225_48%,#030712_100%)]" />
      <div className="fixed inset-0 -z-10 bg-scan-grid bg-[length:40px_40px] opacity-40" />
      <AppHeader route={route} navigate={navigate} />
      <main className="mx-auto w-full max-w-[1520px] px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {route === "launchpad" && (
          <Launchpad navigate={navigate} openWorkbench={openWorkbench} />
        )}
        {route === "workspaces" && <WorkspacesPage openWorkbench={openWorkbench} />}
        {route === "experiments" && <ExperimentsPage />}
        {route === "workbench" && (
          <WorkbenchPage selectedSensor={selectedSensor} setSelectedSensor={setSelectedSensor} />
        )}
        {route === "fusion" && <FusionPage />}
        {route === "scenarios" && <ScenarioLibraryPage />}
        {route === "reports" && <ReportsPage />}
        {route === "docs" && <DocsPage />}
      </main>
    </div>
  );
}

function AppHeader({
  route,
  navigate,
}: {
  route: Route;
  navigate: (route: Route) => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-cyan-200/10 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1520px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button
          className="flex shrink-0 items-center gap-3"
          onClick={() => navigate("launchpad")}
          type="button"
          aria-label="Open Sinclair Launchpad"
        >
          <img
            src="/assets/sinclair/sinclair_mark.svg"
            alt=""
            className="h-9 w-9 rounded-xl border border-cyan-200/20 bg-cyan-300/5 p-1"
          />
          <div className="hidden text-left sm:block">
            <div className="text-sm font-semibold uppercase text-white">
              SINCLAIR
            </div>
            <div className="text-xs text-slate-400">
              Camera · LiDAR · Radar Simulation & Fusion
            </div>
          </div>
        </button>

        <div className="hidden min-w-[220px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 2xl:flex">
          <Car size={15} className="text-camera" />
          Urban Perception v2
          <ChevronDown size={15} className="ml-auto text-slate-500" />
        </div>

        <nav className="no-scrollbar ml-0 flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.035] p-1 lg:ml-1">
          {navItems.map((item) => (
            <button
              key={item.route}
              type="button"
              aria-label={item.label}
              title={item.label}
              onClick={() => navigate(item.route)}
              className={`nav-item ${route === item.route ? "nav-item-active" : ""}`}
            >
              {item.icon}
              <span className="hidden md:inline">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="hidden min-w-[210px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-400 2xl:flex">
          <Search size={15} />
          Search (⌘K)
        </div>
        <button className="icon-button hidden md:inline-flex" type="button" aria-label="Notifications">
          <Bell size={17} />
        </button>
        <button className="primary-button shrink-0" type="button">
          <Plus size={17} />
          <span className="hidden 2xl:inline">Create Experiment</span>
        </button>
        <UserCircle className="hidden text-slate-300 sm:block" size={30} />
      </div>
    </header>
  );
}

function Launchpad({
  navigate,
  openWorkbench,
}: {
  navigate: (route: Route) => void;
  openWorkbench: (sensor: Exclude<SensorType, "fusion">) => void;
}) {
  const workspaces = listWorkspaces();
  const runs = listRuns();
  const templates = listTemplates();
  const reports = listReports();

  return (
    <div className="space-y-5">
      <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="hero-panel overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-camera/30 bg-camera/10 px-3 py-1 text-xs font-semibold text-camera">
              <Sparkles size={14} />
              Simulation Intelligence Nexus for Camera, LiDAR, AI & Radar
            </div>
            <h1 className="text-balance text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
              센서의 복잡성을 통찰로,
              <span className="block text-camera">시뮬레이션을 실전으로.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              Camera · LiDAR · Radar 시뮬레이션과 Fusion Perception 검증을 하나의
              실험 플랫폼에서 수행하세요.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button className="primary-button" onClick={() => navigate("workspaces")} type="button">
                <Grid2X2 size={17} />
                Open Workspace
              </button>
              <button className="secondary-button" onClick={() => navigate("experiments")} type="button">
                <Plus size={17} />
                Create Experiment
              </button>
              <button className="ghost-button" onClick={() => navigate("docs")} type="button">
                <BookOpen size={17} />
                View Guide
              </button>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <img
              src="/assets/sinclair/futuristic_ui_concept_design_presentation.png"
              alt=""
              className="h-full w-full object-cover opacity-75 mix-blend-screen"
            />
          </div>
        </div>

        <Panel title="Latest Release Candidate" action="View report">
          <div className="grid grid-cols-2 gap-3">
            <MetricTile label="Readiness" value="87%" delta="+4 vs RC1" tone="good" />
            <MetricTile label="Coverage" value="92%" delta="+5 slices" tone="good" />
            <MetricTile label="Open risks" value="4" delta="2 high" tone="warn" />
            <MetricTile label="Sign-off" value="Review" delta="guardrail pending" tone="neutral" />
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
              <AlertTriangle size={16} className="text-fusion" />
              Top Attention
            </div>
            <div className="space-y-2">
              {topAttention.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-300">{item.label}</span>
                  <SeverityBadge severity={item.severity} />
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Continue Working"
          description="최근 workspace, regressions, reports, latest run 상태"
          action="View all workspaces"
          onAction={() => navigate("workspaces")}
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              onClick={() => navigate("workspaces")}
              className="workspace-card text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-xl border border-camera/20 bg-camera/10 p-2 text-camera">
                  <Grid2X2 size={20} />
                </div>
                <StatusBadge status={workspace.status} />
              </div>
              <div className="mt-4 text-sm font-semibold text-white">{workspace.name}</div>
              <div className="mt-1 text-xs text-slate-400">{workspace.team}</div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-500">{workspace.updatedAt}</span>
                <span className="text-camera">{workspace.readiness}% ready</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Mission Control" action="View all runs">
          <div className="grid gap-3 sm:grid-cols-3">
            <TrendCard
              label="Active Experiments"
              value="24"
              delta="+6 vs yesterday"
              color="#00e5ff"
              data={dashboardTrends.activeExperiments}
            />
            <TrendCard
              label="Open Regressions"
              value="7"
              delta="+2 vs yesterday"
              color="#ff6b6b"
              data={dashboardTrends.regressions}
            />
            <TrendCard
              label="Reports Generated"
              value="52"
              delta="+12 vs yesterday"
              color="#6b8cff"
              data={dashboardTrends.reports}
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MetricTile label="Dataset health" value="94%" delta="GT verified" tone="good" />
            <MetricTile label="Running runs" value="11" delta="3 queues delayed" tone="warn" />
          </div>
        </Panel>

        <Panel title="Sensor Workbench" action="Open all">
          <div className="grid gap-3 md:grid-cols-3">
            <SensorEntryCard
              sensor="camera"
              title="Camera"
              text="이미지 시뮬레이션, 렌즈/노출 모델, 왜곡, 노이즈, 압성 데이터 생성"
              onClick={() => openWorkbench("camera")}
            />
            <SensorEntryCard
              sensor="radar"
              title="Radar"
              text="4D 레이더 모델링, RCS, 간섭, 클러터, 도플러 시뮬레이션"
              onClick={() => openWorkbench("radar")}
            />
            <SensorEntryCard
              sensor="lidar"
              title="LiDAR"
              text="포인트 클라우드 생성, 반사율, 밀도, 움직임 왜곡 모델링"
              onClick={() => openWorkbench("lidar")}
            />
          </div>
        </Panel>
      </section>

      <Panel title="Simulation Workflow">
        <div className="grid gap-3 md:grid-cols-5">
          {workflow.map((step, index) => (
            <div key={step.label} className="workflow-step">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-camera/30 bg-camera/10 text-camera">
                {step.icon}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{step.label}</div>
                <div className="text-xs text-slate-400">{step.description}</div>
              </div>
              {index < workflow.length - 1 && (
                <ArrowRight className="hidden text-slate-600 md:block" size={18} />
              )}
            </div>
          ))}
        </div>
      </Panel>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Quick Start" action="Docs">
          <div className="grid gap-3 sm:grid-cols-2">
            {quickGuides.slice(0, 4).map((guide) => (
              <div key={guide.role} className="compact-card">
                <div className="text-sm font-semibold text-white">{guide.role}</div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{guide.question}</p>
                <p className="mt-3 text-xs text-camera">{guide.target}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Templates & Recent Runs" action="Open experiments">
          <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="space-y-2">
              {templates.slice(0, 4).map((template) => (
                <TemplateRow key={template.id} template={template} />
              ))}
            </div>
            <div className="space-y-2">
              {runs.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
              <ReportMiniCard report={reports[0]} />
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function WorkspacesPage({
  openWorkbench,
}: {
  openWorkbench: (sensor: Exclude<SensorType, "fusion">) => void;
}) {
  const workspaces = listWorkspaces();
  const runs = listRuns();

  return (
    <PageFrame
      title="Workspaces"
      eyebrow="Program / vehicle / sensor rig context"
      description="최근 작업, 즐겨찾기, workspace switcher, 상태 요약을 한 화면에 배치했습니다."
      action={<button className="primary-button" type="button"><Plus size={17} />New Workspace</button>}
    >
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Workspace Switcher">
          <div className="grid gap-3 md:grid-cols-2">
            {workspaces.map((workspace) => (
              <div key={workspace.id} className="data-card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-white">{workspace.name}</div>
                    <div className="mt-1 text-sm text-slate-400">{workspace.team}</div>
                  </div>
                  <StatusBadge status={workspace.status} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <MetricTile label="Readiness" value={`${workspace.readiness}%`} delta="release gate" tone="good" />
                  <MetricTile label="Regressions" value={String(workspace.regressionCount)} delta="open" tone={workspace.regressionCount > 4 ? "warn" : "neutral"} />
                  <MetricTile label="Latest run" value={workspace.latestRunId.split("-").pop() ?? "045"} delta={workspace.updatedAt} tone="neutral" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {workspace.sensors.map((sensor) => (
                    <button
                      key={sensor}
                      type="button"
                      disabled={sensor === "fusion"}
                      onClick={() => sensor !== "fusion" && openWorkbench(sensor)}
                      className={`sensor-chip ${sensorClass(sensor)}`}
                    >
                      {sensorLabels[sensor]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Recent Workspace Activity">
          <div className="space-y-3">
            {runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
        </Panel>
      </div>
    </PageFrame>
  );
}

function ExperimentsPage() {
  const experiments = listExperiments();
  const runs = listRuns();
  const compare = getRunCompare();

  return (
    <PageFrame
      title="Experiments"
      eyebrow="Experiment Studio"
      description="설계/알고리즘/파라미터 실험 생성, 실행, 비교, sweep을 mock 데이터로 연결했습니다."
      action={<button className="primary-button" type="button"><Plus size={17} />Create Experiment</button>}
    >
      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Experiment Builder">
          <div className="space-y-3">
            {[
              "Experiment goal 선택",
              "Baseline 선택",
              "Test suite / scenario slice 선택",
              "Sensor design 또는 algorithm parameter 선택",
              "Sweep 설정",
              "Run count / compute / cost estimate 확인",
              "Guardrail profile 선택",
              "실행",
            ].map((step, index) => (
              <div key={step} className="builder-step">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-camera/10 text-sm font-semibold text-camera">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">{step}</div>
                  <div className="text-xs text-slate-400">
                    {index === 5
                      ? "현재 estimate: 32 runs / 81 compute-hours / $3.1k"
                      : "typed mock contract로 저장되는 설정"}
                  </div>
                </div>
                {index === 3 && (
                  <span className="rounded-full bg-fusion/10 px-2 py-1 text-xs text-fusion">
                    invalid combination warning
                  </span>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Active Experiments">
          <div className="space-y-3">
            {experiments.map((experiment) => (
              <div key={experiment.id} className="data-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{experiment.name}</div>
                    <div className="mt-1 text-xs text-slate-400">{experiment.goal}</div>
                  </div>
                  <StatusBadge status={experiment.status} />
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-3">
                  <SmallFact label="Baseline" value={experiment.baseline} />
                  <SmallFact label="Test suite" value={experiment.testSuite} />
                  <SmallFact label="Guardrail" value={experiment.guardrailProfile} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {experiment.changedParameters.map((parameter) => (
                    <span key={parameter} className="code-chip">
                      {parameter}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Run Monitor">
          <div className="space-y-3">
            {runs.map((run) => (
              <div key={run.id} className="data-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{run.name}</div>
                    <div className="text-xs text-slate-400">
                      {run.stackVersion} · {run.dataset} · {run.environment}
                    </div>
                  </div>
                  <StatusBadge status={run.status} />
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-camera to-lidar"
                    style={{ width: `${run.progress}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <SmallFact label="GT quality" value={run.gtQuality} />
                  <SmallFact label="Comparability" value={run.comparability} />
                  <SmallFact label="Retry action" value={run.status === "failed" ? "available" : "none"} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Run Compare">
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <div className="text-sm font-semibold text-white">
              {compare.baselineRun.name} vs {compare.candidateRun.name}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">{compare.executiveSummary}</p>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-white/[0.05] text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Metric</th>
                  <th className="px-4 py-3">Sensor</th>
                  <th className="px-4 py-3">Baseline</th>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Delta</th>
                </tr>
              </thead>
              <tbody>
                {compare.metricDeltas.map((delta) => (
                  <tr key={delta.metric} className="border-t border-white/10">
                    <td className="px-4 py-3 text-white">{delta.metric}</td>
                    <td className="px-4 py-3">
                      <span className={`sensor-chip ${sensorClass(delta.sensor)}`}>
                        {sensorLabels[delta.sensor]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {delta.baseline}
                      {delta.unit}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {delta.candidate}
                      {delta.unit}
                    </td>
                    <td className={delta.delta < 0 ? "px-4 py-3 text-rose-300" : "px-4 py-3 text-emerald-300"}>
                      {delta.delta > 0 ? "+" : ""}
                      {delta.delta}
                      {delta.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Parameter Sensitivity">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ReLineChart data={sweepLineData}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="parameter" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip contentStyle={tooltipStyle} />
                <ReferenceLine y={88} stroke="#f2c85b" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="recall" stroke="#00e5ff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="guardrail" stroke="#f2c85b" strokeWidth={1} dot={false} />
              </ReLineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Pareto Frontier">
          <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="latency" name="latency" stroke="#64748b" />
                  <YAxis dataKey="recall" name="recall" stroke="#64748b" />
                  <ZAxis dataKey="cost" range={[80, 420]} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter name="candidate" data={paretoData} fill="#00e5ff">
                    {paretoData.map((entry) => (
                      <Cell key={entry.name} fill={entry.recall > 91 ? "#2ef5a9" : "#00e5ff"} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              <SmallFact label="Recommended range" value="association.distance_gate 1.2-1.4m" />
              <SmallFact label="Guardrail overlay" value="recall >= 88%, ghost <= 2.1/km" />
              <SmallFact label="Trade-off" value="higher recall increases radar ghost risk" />
            </div>
          </div>
        </Panel>
      </div>
    </PageFrame>
  );
}

function WorkbenchPage({
  selectedSensor,
  setSelectedSensor,
}: {
  selectedSensor: Exclude<SensorType, "fusion">;
  setSelectedSensor: (sensor: Exclude<SensorType, "fusion">) => void;
}) {
  const state = getWorkbenchState(selectedSensor);
  const fusion = getFusionAttribution("run-fusion-210");

  return (
    <PageFrame
      title="Sensor Workbench"
      eyebrow="Camera / Radar / LiDAR native evidence"
      description="각 센서의 설계, config, raw/processed output, 성능, failure, fusion 영향을 end-to-end로 확인합니다."
      action={
        <div className="flex flex-wrap gap-2">
          {(["camera", "radar", "lidar"] as const).map((sensor) => (
            <button
              key={sensor}
              type="button"
              onClick={() => setSelectedSensor(sensor)}
              className={`sensor-tab ${selectedSensor === sensor ? "sensor-tab-active" : ""} ${sensorClass(sensor)}`}
            >
              {sensorLabels[sensor]}
            </button>
          ))}
        </div>
      }
    >
      {selectedSensor === "camera" ? (
        <CameraDesignValidationWorkbench state={state} fusion={fusion} />
      ) : selectedSensor === "radar" ? (
        <RadarDesignValidationWorkbench />
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
            <Panel title={state.title} action={state.summary}>
              <WorkbenchTabs state={state} />
            </Panel>
            <Panel title="Fusion Interface" action="accepted / rejected / overridden">
              <div className="grid gap-3 sm:grid-cols-3">
                {(["camera", "radar", "lidar"] as const).map((sensor) => (
                  <MetricTile
                    key={sensor}
                    label={`${sensorLabels[sensor]} accepted`}
                    value={`${fusion.acceptedRate[sensor]}%`}
                    delta={`${fusion.rejectedRate[sensor]}% rejected`}
                    tone={sensor === selectedSensor ? "good" : "neutral"}
                  />
                ))}
              </div>
              <div className="mt-4">
                <ContributionMatrix />
              </div>
              <div className="mt-4 space-y-2">
                {state.fusionNotes.map((note) => (
                  <div key={note} className="compact-row">
                    <CircleDot size={14} className={sensorTextClass(selectedSensor)} />
                    {note}
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {selectedSensor === "lidar" && <LidarDesignValidationWorkbench />}

          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <Panel title="Scenario Viewer">
              {selectedSensor === "lidar" && <LidarViewer />}
            </Panel>
            <Panel title="Error Analysis">
              <div className="space-y-2">
                {state.failureBuckets.map((bucket) => (
                  <div key={bucket.name} className="failure-row">
                    <div>
                      <div className="text-sm font-semibold text-white">{bucket.name}</div>
                      <div className="text-xs text-slate-500">failure bucket · owner workflow ready</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-200">{bucket.count}</span>
                      <SeverityBadge severity={bucket.severity} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}
    </PageFrame>
  );
}

function CameraDesignValidationWorkbench({
  state,
  fusion,
}: {
  state: SensorWorkbenchState;
  fusion: ReturnType<typeof getFusionAttribution>;
}) {
  const cameraModel = getCameraWorkbenchModel();
  const [cameraE2EIntegration, setCameraE2EIntegration] = useState<CameraE2EIntegration | null>(null);
  const [cameraE2EAssets, setCameraE2EAssets] = useState<CameraE2EAssetIndex | null>(null);
  const [simulationRequest, setSimulationRequest] =
    useState<CameraSimulationRequest>(defaultCameraSimulationRequest);
  const [stackResult, setStackResult] = useState<CameraSimulationResult | null>(null);
  const [stackStatus, setStackStatus] = useState<CameraRunStatus>("idle");
  const [stackError, setStackError] = useState<string | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<CameraSimulationResult | null>(null);
  const [evaluationStatus, setEvaluationStatus] = useState<CameraRunStatus>("idle");
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [pipelineResult, setPipelineResult] = useState<CameraSimulationResult | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<CameraRunStatus>("idle");
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getCameraE2EIntegration().then((integration) => {
      if (isMounted) {
        setCameraE2EIntegration(integration);
      }
    });
    getCameraE2EAssets().then((assets) => {
      if (isMounted) {
        setCameraE2EAssets(assets);
      }
    });
    getCameraE2EDefaultStackResult().then((result) => {
      if (isMounted && result) {
        setStackResult(result);
        setStackStatus("completed");
      }
    });
    getCameraE2EDefaultEvaluationResult().then((result) => {
      if (isMounted && result) {
        setEvaluationResult(result);
        setEvaluationStatus("completed");
      }
    });
    getCameraE2EDefaultPipelineResult().then((result) => {
      if (isMounted && result) {
        setPipelineResult(result);
        setPipelineStatus("completed");
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const groupedChanges = cameraModel.configChanges.reduce<
    Record<string, typeof cameraModel.configChanges>
  >((groups, change) => {
    groups[change.group] = [...(groups[change.group] ?? []), change];
    return groups;
  }, {});

  const runLiveSimulation = async (runMode: CameraRunMode) => {
    const request: CameraSimulationRequest = {
      ...simulationRequest,
      runMode,
      runId: `cam-${runMode}-${Date.now()}`,
    };
    const setStatus =
      runMode === "stackCharacterization"
        ? setStackStatus
        : runMode === "cameraEvaluation"
          ? setEvaluationStatus
          : setPipelineStatus;
    const setError =
      runMode === "stackCharacterization"
        ? setStackError
        : runMode === "cameraEvaluation"
          ? setEvaluationError
          : setPipelineError;
    const setResult =
      runMode === "stackCharacterization"
        ? setStackResult
        : runMode === "cameraEvaluation"
          ? setEvaluationResult
          : setPipelineResult;
    setStatus("running");
    setError(null);
    try {
      const result = await runCameraE2ESimulation(request);
      setResult({ ...result, resultOrigin: "liveRun" });
      setStatus("completed");
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      setStatus("failed");
    }
  };

  return (
    <div className="space-y-5">
      <CameraE2ELiveSimulationPanel
        request={simulationRequest}
        stackResult={stackResult}
        stackStatus={stackStatus}
        stackError={stackError}
        evaluationResult={evaluationResult}
        evaluationStatus={evaluationStatus}
        evaluationError={evaluationError}
        pipelineResult={pipelineResult}
        pipelineStatus={pipelineStatus}
        pipelineError={pipelineError}
        assets={cameraE2EAssets}
        characterization={cameraModel.characterization}
        setRequest={setSimulationRequest}
        onRunStack={() => runLiveSimulation("stackCharacterization")}
        onRunEvaluation={() => runLiveSimulation("cameraEvaluation")}
        onRunPipeline={() => runLiveSimulation("scenePipeline")}
      />

      <CameraFusionFailureSummary state={state} fusion={fusion} />

      <CameraAdvancedReferencePanel
        cameraModel={cameraModel}
        groupedChanges={groupedChanges}
        integration={cameraE2EIntegration}
      />
    </div>
  );
}

function CameraFusionFailureSummary({
  state,
  fusion,
}: {
  state: SensorWorkbenchState;
  fusion: ReturnType<typeof getFusionAttribution>;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
      <Panel title="Camera -> Fusion Impact" action="compact summary; full triage belongs in Fusion Analysis">
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricTile
            label="Camera accepted"
            value={`${fusion.acceptedRate.camera}%`}
            delta={`${fusion.rejectedRate.camera}% rejected`}
            tone="good"
          />
          <MetricTile
            label="Other sensor context"
            value={`${fusion.acceptedRate.lidar}% / ${fusion.acceptedRate.radar}%`}
            delta="LiDAR / Radar accepted"
            tone="neutral"
          />
        </div>
        <div className="mt-4 space-y-2">
          {state.fusionNotes.slice(0, 3).map((note) => (
            <div key={note} className="compact-row">
              <CircleDot size={14} className="text-camera" />
              {note}
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
          Camera Workbench only keeps sensor-local fusion evidence. Cross-sensor conflicts, object attribution, and
          final fusion decisions should be reviewed in Fusion Analysis.
        </div>
      </Panel>

      <Panel title="Camera Failure Review" action="top buckets after scene pipeline">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {state.failureBuckets.map((bucket) => (
            <div key={bucket.name} className="failure-row">
              <div>
                <div className="text-sm font-semibold text-white">{bucket.name}</div>
                <div className="text-xs text-slate-500">compact camera-local bucket</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-200">{bucket.count}</span>
                <SeverityBadge severity={bucket.severity} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function CameraAdvancedReferencePanel({
  cameraModel,
  groupedChanges,
  integration,
}: {
  cameraModel: CameraWorkbenchModel;
  groupedChanges: Record<string, CameraWorkbenchModel["configChanges"]>;
  integration: CameraE2EIntegration | null;
}) {
  return (
    <details className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-semibold text-white">Advanced / Reference</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">
            Design context, feasibility matrix, mock guidance charts, and adapter health. Kept collapsed so the
            CameraE2E workflow remains the primary surface.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="status-badge bg-white/10 text-slate-300">collapsed reference</span>
          <ChevronDown size={16} className="text-slate-400" />
        </div>
      </summary>

      <div className="space-y-5 border-t border-white/10 p-4">
        <Panel title="Camera Design Context" action="trust-aware camera configuration">
          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-camera/20 bg-camera/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase text-camera">
                    Camera Workbench / {cameraModel.cameraName}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {cameraModel.baseline} vs {cameraModel.candidate}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-300">
                    Dataset: {cameraModel.dataset} · Scenario source: {cameraModel.scenarioSource} · Comparable:{" "}
                    {cameraModel.comparable ? "Yes" : "No"}
                  </div>
                </div>
                <StatusBadge status="review" />
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {(["Log Replay", "Synthetic Re-render", "Physical Validation"] as const).map((mode) => (
                  <div
                    key={mode}
                    className={`validation-mode-card ${
                      cameraModel.validationMode === mode ? "validation-mode-active" : ""
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{mode}</div>
                    <div className="mt-2 text-xs leading-5 text-slate-400">
                      {mode === "Log Replay"
                        ? "기존 RGB/RAW log로 algorithm, threshold, calibration 재처리"
                        : mode === "Synthetic Re-render"
                          ? "FOV, lens, mounting, exposure, weather effect를 scene에서 재렌더"
                          : "새 sensor/lens/ISP/housing/mounting의 최종 양산 검증"}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-fusion/30 bg-fusion/10 p-4 text-sm leading-6 text-fusion">
                <div className="mb-1 flex items-center gap-2 font-semibold text-white">
                  <AlertTriangle size={16} className="text-fusion" />
                  Validation feasibility warning
                </div>
                {cameraModel.feasibilityWarning}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <SpecGroup title="Primary Role" items={cameraModel.cameraRole} icon={<Target size={17} />} />
              <SpecGroup
                title="Known Weakness"
                items={cameraModel.knownWeakness}
                icon={<AlertTriangle size={17} />}
              />
            </div>
          </div>
        </Panel>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <Panel title="Configuration Feasibility Matrix">
            <div className="space-y-4">
              {Object.entries(groupedChanges).map(([group, changes]) => (
                <div key={group} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                  <div className="mb-3 text-sm font-semibold text-white">{group}</div>
                  <div className="space-y-2">
                    {changes.map((change) => (
                      <div key={`${change.group}-${change.parameter}`} className="config-change-row">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-white">{change.parameter}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {change.baseline} -&gt; {change.candidate}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">{change.impact}</div>
                        </div>
                        <FeasibilityBadge feasibility={change.feasibility} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Design Impact Reference">
            <div className="grid gap-3">
              <SpecGroup title="Changed" items={cameraModel.designImpact.changed} icon={<Settings2 size={17} />} />
              <SpecGroup title="Design benefit" items={cameraModel.designImpact.benefits} icon={<BadgeCheck size={17} />} />
              <SpecGroup title="Trade-off" items={cameraModel.designImpact.tradeOffs} icon={<AlertTriangle size={17} />} />
              <div className="rounded-xl border border-camera/25 bg-camera/10 p-4 text-sm leading-6 text-slate-200">
                <div className="mb-1 font-semibold text-camera">Recommendation</div>
                {cameraModel.designImpact.recommendation}
              </div>
            </div>
          </Panel>
        </div>

        <CameraE2EAdapterHealth integration={integration} />

        <CameraDesignReferencePanel cameraModel={cameraModel} />
      </div>
    </details>
  );
}

function CameraE2ELiveSimulationPanel({
  request,
  stackResult,
  stackStatus,
  stackError,
  evaluationResult,
  evaluationStatus,
  evaluationError,
  pipelineResult,
  pipelineStatus,
  pipelineError,
  assets,
  characterization,
  setRequest,
  onRunStack,
  onRunEvaluation,
  onRunPipeline,
}: {
  request: CameraSimulationRequest;
  stackResult: CameraSimulationResult | null;
  stackStatus: CameraRunStatus;
  stackError: string | null;
  evaluationResult: CameraSimulationResult | null;
  evaluationStatus: CameraRunStatus;
  evaluationError: string | null;
  pipelineResult: CameraSimulationResult | null;
  pipelineStatus: CameraRunStatus;
  pipelineError: string | null;
  assets: CameraE2EAssetIndex | null;
  characterization: CameraWorkbenchModel["characterization"];
  setRequest: Dispatch<SetStateAction<CameraSimulationRequest>>;
  onRunStack: () => void;
  onRunEvaluation: () => void;
  onRunPipeline: () => void;
}) {
  const sceneOptions: CameraSimulationRequest["scene"]["type"][] = [
    "rgb image",
    "macbeth",
    "slanted bar",
    "point array",
    "harmonic",
    "uniform ee",
    "dead leaves",
  ];
  const cameraDrivingScenarios = useMemo(
    () => listScenarios().filter((scenario) => scenario.objectClass !== "vehicle" || scenario.roadType !== "parking"),
    []
  );
  const [selectedDrivingSceneId, setSelectedDrivingSceneId] = useState(
    cameraDrivingScenarios.find((scenario) => scenario.id === "sc-night-crosswalk")?.id ?? cameraDrivingScenarios[0]?.id ?? ""
  );
  const [selectedExampleSceneId, setSelectedExampleSceneId] = useState(defaultCameraExampleSceneId);
  const selectedDrivingScene =
    cameraDrivingScenarios.find((scenario) => scenario.id === selectedDrivingSceneId) ?? cameraDrivingScenarios[0];
  const selectedExampleScene =
    cameraExampleScenes.find((exampleScene) => exampleScene.id === selectedExampleSceneId) ?? cameraExampleScenes[0];
  const pipelinePerception = pipelineResult?.metrics?.perception ?? pipelineResult?.metrics?.perceptionProxy;
  const latestGeometryResult = pipelineResult ?? evaluationResult ?? stackResult;
  const evaluationCacheKey = evaluationResult
    ? `${evaluationResult.runId}:${evaluationResult.createdAt ?? ""}:${evaluationResult.elapsedMs ?? ""}`
    : "";
  const pipelineCacheKey = pipelineResult
    ? `${pipelineResult.runId}:${pipelineResult.createdAt ?? ""}:${pipelineResult.elapsedMs ?? ""}`
    : "";
  const pipelineMatchesCurrentConfig =
    Boolean(pipelineResult?.request) && cameraSimulationRequestSignature(pipelineResult?.request) === cameraSimulationRequestSignature(request);
  const [openResults, setOpenResults] = useState({
    stack: false,
    evaluation: false,
    pipeline: true,
  });
  const setResultOpen = (stage: keyof typeof openResults, open: boolean) => {
    setOpenResults((current) => ({ ...current, [stage]: open }));
  };
  useEffect(() => {
    if (stackStatus === "completed" || stackStatus === "failed") {
      setOpenResults((current) => ({ ...current, stack: true }));
    }
  }, [stackStatus, stackResult?.runId, stackError]);
  useEffect(() => {
    if (evaluationStatus === "completed" || evaluationStatus === "failed") {
      setOpenResults((current) => ({ ...current, evaluation: true }));
    }
  }, [evaluationStatus, evaluationResult?.runId, evaluationError]);
  useEffect(() => {
    if (pipelineStatus === "completed" || pipelineStatus === "failed") {
      setOpenResults((current) => ({ ...current, pipeline: true }));
    }
  }, [pipelineStatus, pipelineResult?.runId, pipelineError]);
  const assetRequest = request.assets ?? defaultCameraSimulationRequest.assets!;
  const lensPhysicsRequest = request.lensPhysics ?? defaultCameraSimulationRequest.lensPhysics!;
  const calibrationRequest = request.calibration ?? {
    ...defaultCameraSimulationRequest.calibration!,
    principalPointX: request.sensor.cols / 2,
    principalPointY: request.sensor.rows / 2,
  };
  const hwIspRequest = request.hwIsp ?? defaultCameraSimulationRequest.hwIsp!;
  const raytraceLensAssets =
    assets?.lensAssets.filter((asset) => asset.kind === "raytraceOptics" && asset.testable) ?? [];
  const catalogLensAssets = assets?.lensAssets.filter((asset) => asset.kind === "catalogLens" && asset.testable) ?? [];
  const sensorConstructorAssets =
    assets?.sensorAssets.filter((asset) => asset.kind === "sensorConstructor" && asset.testable) ?? [];
  const sensorReferenceAssets =
    assets?.sensorAssets.filter(
      (asset) =>
        asset.testable &&
        ["sensorModelFile", "spectralFilter", "irFilter", "photoDetectorQe"].includes(asset.kind)
    ) ?? [];
  const selectedLensAsset = assets?.lensAssets.find((asset) => asset.path === assetRequest.lensAsset);
  const selectedSensorAsset = sensorConstructorAssets.find(
    (asset) => asset.type === assetRequest.sensorType && (asset.variant ?? "") === (assetRequest.sensorVariant ?? "")
  );
  const selectedReferenceSensorAsset = sensorReferenceAssets.find((asset) => asset.path === assetRequest.colorFilterAsset);
  const lensAssetPool =
    assetRequest.lensMode === "raytraceOptics"
      ? raytraceLensAssets
      : assetRequest.lensMode === "catalogLens" || assetRequest.lensMode === "lensFileReference"
        ? catalogLensAssets
        : [];
  const sensorSelectionValue = `${assetRequest.sensorType || "default"}::${assetRequest.sensorVariant ?? ""}`;
  const isLensGeometryLocked = Boolean(
    assetRequest.lensAsset &&
      (assetRequest.lensMode === "raytraceOptics" ||
        assetRequest.lensMode === "catalogLens" ||
        assetRequest.lensMode === "lensFileReference")
  );
  const lensResolutionPolicy =
    assetRequest.lensMode === "raytraceOptics" && assetRequest.lensAsset
      ? "Raytrace .mat owns geometry; numeric F-number, focal length, HFOV, and transmittance are locked."
      : (assetRequest.lensMode === "catalogLens" || assetRequest.lensMode === "lensFileReference") && assetRequest.lensAsset
        ? "Catalog lens sets focal/F-number/FOV approximation; numeric lens geometry is locked."
        : "Default optics uses numeric F-number, focal length, HFOV target, and transmittance.";
  const physicsResolutionPolicy =
    lensPhysicsRequest.mode === "none"
      ? assetRequest.lensMode === "raytraceOptics" && assetRequest.lensAsset
        ? "Optics / PSF source: selected raytrace asset default; Zemax PSF convolution remains active."
        : "Optics / PSF source: selected/default optics; no extra PSF override."
      : lensPhysicsRequest.mode === "diffraction"
        ? "Diffraction-limited OTF uses lens F-number and spectrum/wavelength; no Gaussian, defocus, or raytrace controls apply."
        : lensPhysicsRequest.mode === "gaussianPsf"
          ? "Gaussian blur proxy uses only Gaussian spread and XY ratio."
          : lensPhysicsRequest.mode === "wvfDefocus"
            ? "Wavefront defocus proxy uses only defocus diopters."
      : lensPhysicsRequest.mode === "raytracePsf"
        ? "Raytrace PSF grid uses only angular PSF sampling and requires a raytrace optics asset."
        : "Unsupported optics / PSF source is ignored.";
  const psfSourceBadge =
    lensPhysicsRequest.mode === "none"
      ? "no extra PSF override"
      : lensPhysicsRequest.mode === "diffraction"
        ? "ideal diffraction"
        : lensPhysicsRequest.mode === "gaussianPsf"
          ? "proxy PSF"
          : lensPhysicsRequest.mode === "wvfDefocus"
            ? "defocus proxy"
            : "raytrace PSF grid";
  const psfSourceDescription =
    lensPhysicsRequest.mode === "none"
      ? assetRequest.lensMode === "raytraceOptics" && assetRequest.lensAsset
        ? "Uses the selected raytrace optics asset as-is. No extra synthetic PSF parameter is added on top."
        : "Uses the selected/default optics behavior. This mode intentionally has no editable PSF parameters."
      : lensPhysicsRequest.mode === "diffraction"
        ? "Uses an ideal diffraction-limited OTF derived from the active lens F-number and spectrum/wavelength. Gaussian spread, defocus, and raytrace angle controls are not used."
        : lensPhysicsRequest.mode === "gaussianPsf"
          ? "Uses a shift-invariant Gaussian PSF proxy. Only spread and XY ratio are sent to the runner."
          : lensPhysicsRequest.mode === "wvfDefocus"
            ? "Uses CameraE2E wavefront defocus through a Zernike defocus term. Only defocus diopters are sent to the runner."
            : "Uses the selected raytrace optics PSF grid. Only PSF angular sampling is sent to the runner.";
  const offAxisIlluminationPreview =
    assetRequest.lensMode === "raytraceOptics" && assetRequest.lensAsset
      ? "Raytrace RI table"
      : "Cos4 fall-off";
  const offAxisIlluminationDescription =
    assetRequest.lensMode === "raytraceOptics" && assetRequest.lensAsset
      ? "Selected raytrace optics owns relative illumination/vignetting. Cos4 is not assumed unless CameraE2E resolves the active off-axis method to cos4th."
      : "Generated, diffraction, wavefront, Gaussian proxy, and catalogue approximation paths use CameraE2E's optics off-axis method; default optics resolve to cos4th.";
  const raytracePsfMissingAsset =
    lensPhysicsRequest.mode === "raytracePsf" && !(assetRequest.lensMode === "raytraceOptics" && assetRequest.lensAsset);
  const fovAuthority = request.lens.fovAuthority ?? "physicalGeometry";
  const activeFovAuthority = isLensGeometryLocked ? "lensAsset" : fovAuthority;
  const sceneGeometryMode = request.scene.geometryMode ?? "physicalGeometry";
  const scenePhysicalHfov = calculateAngularExtentDeg(request.scene.targetWidthM ?? 1.2, request.scene.distanceM ?? 5);
  const scenePhysicalVfov = calculateAngularExtentDeg(request.scene.targetHeightM ?? 0.8, request.scene.distanceM ?? 5);
  const sceneAngularExtentForUi = sceneGeometryMode === "physicalGeometry" ? scenePhysicalHfov : request.scene.fovDeg;
  const targetImageWidthMm = calculateImageSizeOnSensorMm(
    request.scene.targetWidthM ?? 1.2,
    request.scene.distanceM ?? 5,
    request.lens.focalLengthMm
  );
  const targetImageWidthPx =
    targetImageWidthMm !== null && request.sensor.pixelSizeUm > 0 ? targetImageWidthMm / (request.sensor.pixelSizeUm / 1000) : null;
  const requestedSensorWidthMm = (request.sensor.cols * request.sensor.pixelSizeUm) / 1000;
  const requestedPhysicalHfov = calculatePhysicalHfovDeg(
    request.sensor.cols,
    request.sensor.pixelSizeUm,
    request.lens.focalLengthMm
  );
  const fovLedgerSummary = latestGeometryResult?.summaries?.fovLedger;
  const resolvedLensHfov =
    typeof fovLedgerSummary?.lensOiResolvedHfovDeg === "number"
      ? fovLedgerSummary.lensOiResolvedHfovDeg
      : activeFovAuthority === "physicalGeometry" || activeFovAuthority === "numericOptics"
        ? requestedPhysicalHfov ?? request.lens.hfovDeg
        : activeFovAuthority === "sceneTarget"
          ? sceneAngularExtentForUi ?? request.lens.hfovDeg
          : request.lens.hfovDeg;
  const resolvedPhysicalHfov =
    typeof fovLedgerSummary?.physicalHfovFromSensorAndFocalDeg === "number"
      ? fovLedgerSummary.physicalHfovFromSensorAndFocalDeg
      : requestedPhysicalHfov;
  const fovConflictNotes = [
    sceneGeometryMode === "physicalGeometry" &&
    scenePhysicalHfov !== null &&
    requestedPhysicalHfov !== null &&
    scenePhysicalHfov > requestedPhysicalHfov + 0.5
      ? "Physical target is wider than the camera captured HFOV; the target would be cropped in a physical setup."
      : "",
    (activeFovAuthority === "numericOptics" || activeFovAuthority === "physicalGeometry") &&
    Math.abs((requestedPhysicalHfov ?? 0) - request.lens.hfovDeg) > 1
      ? "Manual HFOV target differs from physical HFOV; numeric optics will ignore the manual target."
      : "",
    activeFovAuthority === "sceneTarget" && Math.abs(request.scene.fovDeg - request.lens.hfovDeg) > 1
      ? "Scene angular width override differs from manual HFOV; scene target will drive the OI HFOV."
      : "",
  ].filter((note): note is string => Boolean(note));
  const geometryStatus = fovLedgerSummary?.status ?? (fovConflictNotes.length ? "warning" : "clean");
  const geometryResult = (fovLedgerSummary?.notes ?? fovConflictNotes.join(" ")) || "No geometry conflicts detected.";

  const updateScene = (field: keyof CameraSimulationRequest["scene"], value: string | number) => {
    setRequest((current) => ({
      ...current,
      scene: { ...current.scene, [field]: value },
    }));
  };
  const applySceneProfile = (profile: CameraDrivingSceneProfile) => {
    setRequest((current) => ({
      ...current,
      scene: {
        ...current.scene,
        geometryMode: profile.geometryMode ?? "physicalGeometry",
        type: profile.sceneType,
        sourceImagePath: profile.sourceImagePath ?? "",
        sourceImageLabel: profile.sourceImageLabel ?? "",
        sourceImageAttribution: profile.sourceImageAttribution ?? "",
        targetWidthM: profile.targetWidthM,
        targetHeightM: profile.targetHeightM,
        distanceM: profile.distanceM,
        fovDeg: profile.fovDeg ?? current.scene.fovDeg,
        luminanceCdM2: profile.luminanceCdM2,
      },
    }));
  };
  const applyDrivingScene = (scenarioId: string) => {
    const scenario = cameraDrivingScenarios.find((item) => item.id === scenarioId) ?? cameraDrivingScenarios[0];
    const profile = getCameraDrivingSceneProfile(scenario);
    const nextExample =
      cameraExampleScenes.find((exampleScene) => exampleScene.scenarioId === scenario?.id && exampleScene.sceneType === profile.sceneType) ??
      cameraExampleScenes.find((exampleScene) => exampleScene.scenarioId === scenario?.id) ??
      selectedExampleScene;
    setSelectedDrivingSceneId(scenario?.id ?? scenarioId);
    setSelectedExampleSceneId(nextExample.id);
    applySceneProfile(nextExample);
  };
  const applyExampleScene = (exampleSceneId: string) => {
    const exampleScene = cameraExampleScenes.find((item) => item.id === exampleSceneId) ?? cameraExampleScenes[0];
    setSelectedExampleSceneId(exampleScene.id);
    setSelectedDrivingSceneId(exampleScene.scenarioId);
    applySceneProfile(exampleScene);
  };
  const updateLens = (field: keyof CameraSimulationRequest["lens"], value: string | number) => {
    setRequest((current) => ({
      ...current,
      lens: { ...current.lens, [field]: value },
    }));
  };
  const updateLensPhysics = (
    field: keyof NonNullable<CameraSimulationRequest["lensPhysics"]>,
    value: string | number
  ) => {
    setRequest((current) => ({
      ...current,
      lensPhysics: {
        ...defaultCameraSimulationRequest.lensPhysics!,
        ...current.lensPhysics,
        [field]: value,
      },
    }));
  };
  const updateCalibration = (
    field: keyof NonNullable<CameraSimulationRequest["calibration"]>,
    value: number
  ) => {
    setRequest((current) => ({
      ...current,
      calibration: {
        ...defaultCameraSimulationRequest.calibration!,
        principalPointX: current.sensor.cols / 2,
        principalPointY: current.sensor.rows / 2,
        ...current.calibration,
        [field]: value,
      },
    }));
  };
  const updateSensor = (field: Exclude<keyof CameraSimulationRequest["sensor"], "fitMode">, value: number) => {
    setRequest((current) => ({
      ...current,
      sensor: { ...current.sensor, [field]: value },
    }));
  };
  const updateSensorFitMode = (value: NonNullable<CameraSimulationRequest["sensor"]["fitMode"]>) => {
    setRequest((current) => ({
      ...current,
      sensor: { ...current.sensor, fitMode: value },
    }));
  };
  const updateIsp = (field: keyof CameraSimulationRequest["isp"], value: string | number | boolean) => {
    setRequest((current) => ({
      ...current,
      isp: { ...current.isp, [field]: value },
    }));
  };
  const updateHwIsp = (
    field: keyof NonNullable<CameraSimulationRequest["hwIsp"]>,
    value: string | number | boolean
  ) => {
    setRequest((current) => ({
      ...current,
      hwIsp: {
        ...defaultCameraSimulationRequest.hwIsp!,
        ...current.hwIsp,
        [field]: value,
      },
    }));
  };
  const updatePerception = (field: keyof CameraSimulationRequest["perception"], value: string | number) => {
    setRequest((current) => ({
      ...current,
      perception: { ...current.perception, [field]: value },
    }));
  };
  const updateAssets = (patch: Partial<NonNullable<CameraSimulationRequest["assets"]>>) => {
    setRequest((current) => {
      const nextAssets: NonNullable<CameraSimulationRequest["assets"]> = {
        lensMode: "none",
        lensAsset: "",
        sensorType: "default",
        sensorVariant: "",
        colorFilterAsset: "",
        ...current.assets,
        ...patch,
      };
      const nextLensLocked = Boolean(
        nextAssets.lensAsset &&
          (nextAssets.lensMode === "raytraceOptics" ||
            nextAssets.lensMode === "catalogLens" ||
            nextAssets.lensMode === "lensFileReference")
      );
      const nextFovAuthority =
        nextLensLocked
          ? "lensAsset"
          : current.lens.fovAuthority === "lensAsset"
            ? "physicalGeometry"
            : current.lens.fovAuthority;
      return {
        ...current,
        assets: nextAssets,
        lens: {
          ...current.lens,
          fovAuthority: nextFovAuthority,
        },
      };
    });
  };

  return (
    <Panel title="CameraE2E Workflow Console" action="configure stack -> validate camera -> run scene pipeline">
      <div className="space-y-5">
        <div className="space-y-4">
          <div className="rounded-xl border border-fusion/25 bg-fusion/10 p-4 text-xs leading-5 text-fusion">
            <div className="mb-1 flex items-center gap-2 font-semibold text-white">
              <AlertTriangle size={15} className="text-fusion" />
              Integration boundary
            </div>
            Live simulation runs the local CameraE2E Python package through the Vite dev server. The perception model
            control now calls CameraE2E task perception profiles when the selected model backend is available. Chart-like
            proxy scenes may produce zero detections; realistic scene assets are still needed for object-level validation.
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="data-card lg:col-span-2">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Lens Model & Overrides</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">
                    Base lens model is selected first, an asset can lock geometry, numeric overrides apply only when
                    allowed, and the physics/PSF mode controls the optics compute path.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="code-chip">Base lens -&gt; Asset -&gt; Numeric overrides -&gt; Physics/PSF</span>
                  <span className="code-chip">{assets ? `${raytraceLensAssets.length} raytrace optics` : "assets missing"}</span>
                  <span className="code-chip">{assets ? `${catalogLensAssets.length} catalog lenses` : "run asset sync"}</span>
                </div>
              </div>
              {!assets && (
                <div className="mb-3 rounded-xl border border-fusion/25 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
                  Asset index is not loaded. Run <span className="font-semibold">npm run camera:e2e:assets</span> to
                  refresh /assets/camera-e2e/asset-index.json.
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <CameraLiveSelectField
                  label="Base Lens / Optics Model"
                  value={assetRequest.lensMode}
                  options={[
                    { value: "none", label: "Generated/default optics" },
                    { value: "raytraceOptics", label: "Raytrace optics .mat" },
                    { value: "catalogLens", label: "Lens catalog approximation" },
                  ]}
                  onChange={(value) =>
                    updateAssets({
                      lensMode: value as NonNullable<CameraSimulationRequest["assets"]>["lensMode"],
                      lensAsset: "",
                    })
                  }
                />
                <CameraLiveSelectField
                  label="Lens / Optics Asset"
                  value={assetRequest.lensAsset ?? ""}
                  options={[
                    {
                      value: "",
                      label: assetRequest.lensMode === "none" ? "No lens asset selected" : "Select asset",
                    },
                    ...lensAssetPool.slice(0, 90).map((asset) => ({
                      value: asset.path ?? "",
                      label: `${asset.label} · ${asset.summary ?? asset.kind}`,
                    })),
                  ]}
                  onChange={(value) => updateAssets({ lensAsset: value })}
                />
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
                <CameraAssetSelectionSummary title="Lens" asset={selectedLensAsset} fallback={assetRequest.lensMode} />
                <div className="rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-400">
                  <div className="mb-1 font-semibold text-white">Lens model behavior</div>
                  <div>
                    Generated/default optics uses numeric lens controls. Catalog lenses own focal/F-number/FOV
                    approximation. Raytrace optics .mat owns geometry plus PSF/aberration behavior.
                  </div>
                </div>
              </div>

              {isLensGeometryLocked && (
                <div className="mt-3 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
                  The selected lens asset owns focal length, F-number, FOV, transmittance, and PSF/aberration behavior.
                  Numeric lens parameters are shown as reference/request metadata and are not applied as geometry overrides.
                </div>
              )}

              <div className="mt-4 mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Numeric Overrides</div>
                {isLensGeometryLocked && (
                  <span className="status-badge bg-fusion/15 text-fusion">locked by selected lens asset</span>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <CameraLiveNumberField
                  label="F-number"
                  value={request.lens.fNumber}
                  min={1}
                  step={0.1}
                  disabled={isLensGeometryLocked}
                  onChange={(value) => updateLens("fNumber", value)}
                />
                <CameraLiveNumberField
                  label="Focal length"
                  value={request.lens.focalLengthMm}
                  min={0.5}
                  step={0.1}
                  unit="mm"
                  disabled={isLensGeometryLocked}
                  onChange={(value) => updateLens("focalLengthMm", value)}
                />
                <CameraLiveNumberField
                  label="Manual HFOV target"
                  value={request.lens.hfovDeg}
                  min={5}
                  max={160}
                  step={1}
                  unit="deg"
                  disabled={isLensGeometryLocked}
                  onChange={(value) => updateLens("hfovDeg", value)}
                />
                <CameraLiveNumberField
                  label="Transmittance"
                  value={request.lens.transmittanceScale}
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={isLensGeometryLocked}
                  onChange={(value) => updateLens("transmittanceScale", value)}
                />
              </div>

              <div className="mt-4 mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Optics / PSF Source
                </div>
                <span className="code-chip">{psfSourceBadge}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <CameraLiveSelectField
                  label="Optics / PSF source"
                  value={lensPhysicsRequest.mode}
                  options={[
                    { value: "none", label: "Use selected lens default" },
                    { value: "diffraction", label: "Diffraction-limited ideal" },
                    { value: "gaussianPsf", label: "Gaussian blur proxy" },
                    { value: "wvfDefocus", label: "Wavefront defocus proxy" },
                    { value: "raytracePsf", label: "Raytrace PSF grid" },
                  ]}
                  onChange={(value) =>
                    updateLensPhysics("mode", value as NonNullable<CameraSimulationRequest["lensPhysics"]>["mode"])
                  }
                />
                {(lensPhysicsRequest.mode === "none" || lensPhysicsRequest.mode === "diffraction") && (
                  <div className="rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-400 md:col-span-2">
                    {psfSourceDescription}
                  </div>
                )}
                {lensPhysicsRequest.mode === "gaussianPsf" && (
                  <>
                    <CameraLiveNumberField
                      label="Gaussian spread"
                      value={lensPhysicsRequest.gaussianSpreadUm}
                      min={0.1}
                      max={20}
                      step={0.1}
                      unit="um"
                      onChange={(value) => updateLensPhysics("gaussianSpreadUm", value)}
                    />
                    <CameraLiveNumberField
                      label="XY PSF ratio"
                      value={lensPhysicsRequest.xyRatio}
                      min={0.2}
                      max={5}
                      step={0.05}
                      onChange={(value) => updateLensPhysics("xyRatio", value)}
                    />
                  </>
                )}
                {lensPhysicsRequest.mode === "wvfDefocus" && (
                  <>
                    <CameraLiveNumberField
                      label="Defocus"
                      value={lensPhysicsRequest.defocusDiopters}
                      min={-5}
                      max={5}
                      step={0.05}
                      unit="D"
                      onChange={(value) => updateLensPhysics("defocusDiopters", value)}
                    />
                    <div className="rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-400">
                      {psfSourceDescription}
                    </div>
                  </>
                )}
                {lensPhysicsRequest.mode === "raytracePsf" && (
                  <>
                    <CameraLiveNumberField
                      label="RT PSF angle step"
                      value={lensPhysicsRequest.psfAngleStepDeg}
                      min={5}
                      max={180}
                      step={5}
                      unit="deg"
                      onChange={(value) => updateLensPhysics("psfAngleStepDeg", value)}
                    />
                    <div
                      className={`rounded-xl border p-3 text-xs leading-5 ${
                        raytracePsfMissingAsset
                          ? "border-fusion/25 bg-fusion/10 text-fusion"
                          : "border-white/10 bg-black/10 text-slate-400"
                      }`}
                    >
                      {raytracePsfMissingAsset
                        ? "Raytrace PSF grid needs a raytrace optics .mat asset. Without it, the runner will warn and skip surface PSF sampling."
                        : psfSourceDescription}
                    </div>
                  </>
                )}
              </div>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-400">
                Only the controls shown for the selected source are applied. Catalog lens + proxy PSF is useful for
                design exploration, but surface-based PSF behavior requires a raytrace optics .mat asset.
              </div>
              <div className="mt-3 rounded-xl border border-camera/20 bg-camera/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Off-axis illumination / RI authority
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">{offAxisIlluminationPreview}</div>
                  </div>
                  <span className="status-badge bg-camera/15 text-camera">
                    {assetRequest.lensMode === "raytraceOptics" && assetRequest.lensAsset ? "cos4 not assumed" : "cos4 default"}
                  </span>
                </div>
                <div className="mt-2 text-xs leading-5 text-slate-300">{offAxisIlluminationDescription}</div>
              </div>
            </div>

            <div className="data-card lg:col-span-2">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Camera Module Calibration</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">
                    Principal point / optical center and OpenCV-style polynomial coefficients are tracked as module
                    calibration metadata. Raytrace lens assets still own physical lens geometry when selected.
                  </div>
                </div>
                <span className="code-chip">OC / K / D metadata</span>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <CameraLiveNumberField
                  label="Principal X"
                  value={calibrationRequest.principalPointX}
                  min={0}
                  max={request.sensor.cols}
                  step={0.1}
                  unit="px"
                  onChange={(value) => updateCalibration("principalPointX", value)}
                />
                <CameraLiveNumberField
                  label="Principal Y"
                  value={calibrationRequest.principalPointY}
                  min={0}
                  max={request.sensor.rows}
                  step={0.1}
                  unit="px"
                  onChange={(value) => updateCalibration("principalPointY", value)}
                />
                <CameraLiveNumberField
                  label="Radial k1"
                  value={calibrationRequest.radialK1}
                  step={0.0001}
                  onChange={(value) => updateCalibration("radialK1", value)}
                />
                <CameraLiveNumberField
                  label="Radial k2"
                  value={calibrationRequest.radialK2}
                  step={0.0001}
                  onChange={(value) => updateCalibration("radialK2", value)}
                />
                <CameraLiveNumberField
                  label="Radial k3"
                  value={calibrationRequest.radialK3}
                  step={0.0001}
                  onChange={(value) => updateCalibration("radialK3", value)}
                />
                <CameraLiveNumberField
                  label="Tangential p1"
                  value={calibrationRequest.tangentialP1}
                  step={0.0001}
                  onChange={(value) => updateCalibration("tangentialP1", value)}
                />
                <CameraLiveNumberField
                  label="Tangential p2"
                  value={calibrationRequest.tangentialP2}
                  step={0.0001}
                  onChange={(value) => updateCalibration("tangentialP2", value)}
                />
                <ConfigResolutionRow
                  label="OC offset from center"
                  value={`${Math.hypot(
                    calibrationRequest.principalPointX - request.sensor.cols / 2,
                    calibrationRequest.principalPointY - request.sensor.rows / 2,
                  ).toFixed(2)} px`}
                />
              </div>
              <div className="mt-3 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
                These coefficients are included in Stack Characterization as calibration evidence. They do not override
                the selected raytrace distortion table yet; if both exist, Sinclair shows both as separate authorities.
              </div>
            </div>

            <div className="data-card lg:col-span-2">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Sensor Model & Overrides</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">
                    Base sensor model is loaded first, spectral/QE assets are applied second, and numeric controls override
                    selected parameters last.
                  </div>
                </div>
                <span className="code-chip">Base model -&gt; Spectral/QE asset -&gt; Numeric overrides</span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <CameraLiveSelectField
                  label="Base Sensor Model"
                  value={sensorSelectionValue}
                  options={[
                    ...sensorConstructorAssets.map((asset) => ({
                      value: `${asset.type ?? "default"}::${asset.variant ?? ""}`,
                      label: `${asset.label} · ${asset.summary ?? ""}`,
                    })),
                    ...(sensorConstructorAssets.length === 0
                      ? [{ value: "default::", label: "Default Bayer GRBG" }]
                      : []),
                  ]}
                  onChange={(value) => {
                    const [sensorType, sensorVariant = ""] = value.split("::");
                    updateAssets({ sensorType, sensorVariant });
                  }}
                />
                <CameraLiveSelectField
                  label="Spectral / QE Asset"
                  value={assetRequest.colorFilterAsset ?? ""}
                  options={[
                    { value: "", label: "No spectral asset selected" },
                    ...sensorReferenceAssets.slice(0, 90).map((asset) => ({
                      value: asset.path ?? "",
                      label: `${asset.label} · ${asset.summary ?? asset.kind}`,
                    })),
                  ]}
                  onChange={(value) => updateAssets({ colorFilterAsset: value })}
                />
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <CameraAssetSelectionSummary title="Base sensor" asset={selectedSensorAsset} fallback={assetRequest.sensorType} />
                <CameraAssetSelectionSummary
                  title="Spectral / QE asset"
                  asset={selectedReferenceSensorAsset}
                  fallback={assetRequest.colorFilterAsset || "none"}
                />
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-400">
                Full sensor model files may replace more behavior than a simple CFA/QE filter. Numeric controls below are
                applied afterward, so they act as explicit overrides for resolution, pixel pitch, exposure, gain, noise,
                QE scale, and bit depth.
              </div>

              <div className="mt-4 mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Numeric Overrides
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <CameraLiveSelectField
                  label="Resolution fit"
                  value={request.sensor.fitMode ?? "preserveResolution"}
                  options={[
                    { value: "preserveResolution", label: "Preserve requested resolution" },
                    { value: "matchSceneFov", label: "Auto-resize to scene FOV" },
                  ]}
                  onChange={(value) =>
                    updateSensorFitMode(value as NonNullable<CameraSimulationRequest["sensor"]["fitMode"]>)
                  }
                />
                <CameraLiveNumberField
                  label="Rows"
                  value={request.sensor.rows}
                  min={16}
                  step={8}
                  onChange={(value) => updateSensor("rows", value)}
                />
                <CameraLiveNumberField
                  label="Cols"
                  value={request.sensor.cols}
                  min={16}
                  step={8}
                  onChange={(value) => updateSensor("cols", value)}
                />
                <CameraLiveNumberField
                  label="Pixel size"
                  value={request.sensor.pixelSizeUm}
                  min={0.8}
                  step={0.1}
                  unit="um"
                  onChange={(value) => updateSensor("pixelSizeUm", value)}
                />
                <CameraLiveNumberField
                  label="Exposure"
                  value={request.sensor.exposureMs}
                  min={0.1}
                  step={0.1}
                  unit="ms"
                  onChange={(value) => updateSensor("exposureMs", value)}
                />
                <CameraLiveNumberField
                  label="Analog gain"
                  value={request.sensor.analogGain}
                  min={0.1}
                  step={0.1}
                  onChange={(value) => updateSensor("analogGain", value)}
                />
                <CameraLiveNumberField
                  label="Noise flag"
                  value={request.sensor.noiseFlag}
                  min={0}
                  step={1}
                  onChange={(value) => updateSensor("noiseFlag", value)}
                />
                <CameraLiveNumberField
                  label="Read noise"
                  value={request.sensor.readNoiseMv}
                  min={0}
                  step={0.1}
                  unit="mV"
                  onChange={(value) => updateSensor("readNoiseMv", value)}
                />
                <CameraLiveNumberField
                  label="QE scale"
                  value={request.sensor.qeScale}
                  min={0.1}
                  max={2}
                  step={0.05}
                  onChange={(value) => updateSensor("qeScale", value)}
                />
                <CameraLiveNumberField
                  label="Bit depth"
                  value={request.sensor.bitDepth}
                  min={8}
                  max={16}
                  step={1}
                  onChange={(value) => updateSensor("bitDepth", value)}
                />
              </div>
            </div>

            <div className="lg:col-span-2">
              <CameraLiveReferenceCharacterization
                characterization={characterization}
                selectedLensAsset={selectedLensAsset}
                selectedSensorAsset={selectedSensorAsset}
                selectedReferenceSensorAsset={selectedReferenceSensorAsset}
                psfSourceBadge={psfSourceBadge}
                offAxisIlluminationPreview={offAxisIlluminationPreview}
                hasRunResult={false}
              />
              <div className="mt-3 rounded-xl border border-camera/20 bg-camera/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">1. Analyze Stack</div>
                    <div className="mt-1 text-xs leading-5 text-slate-300">
                      Computes active sensor QE, lens DB / raytrace geometry, relative illumination, sensor stack RI,
                      and calibration evidence before static chart validation or a selected scene.
                    </div>
                  </div>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={onRunStack}
                    disabled={stackStatus === "running"}
                  >
                    <Play size={16} />
                    {stackStatus === "running" ? "Analyzing stack..." : "Analyze Stack"}
                  </button>
                </div>
                {stackError && (
                  <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs leading-5 text-rose-200">
                    {stackError}
                  </div>
                )}
              </div>
            </div>

            <div className="data-card">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Image ISP</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">
                    Connected to CameraE2E <span className="font-semibold text-slate-300">ip_set/ip_compute</span>.
                  </div>
                </div>
                <span className="status-badge bg-camera/15 text-camera">pixel path</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <CameraLiveSelectField
                  label="Demosaic"
                  value={request.isp.demosaicMethod}
                  options={[
                    { value: "bilinear", label: "Bilinear" },
                    { value: "nearest neighbor", label: "Nearest neighbor" },
                    { value: "laplacian", label: "Laplacian" },
                    { value: "adaptive laplacian", label: "Adaptive laplacian" },
                  ]}
                  onChange={(value) => updateIsp("demosaicMethod", value)}
                />
                <CameraLiveSelectField
                  label="Sensor conversion"
                  value={request.isp.sensorConversionMethod}
                  options={[
                    { value: "mcc optimized", label: "MCC optimized" },
                    { value: "esser optimized", label: "Esser optimized" },
                    { value: "sensor", label: "Sensor space" },
                    { value: "none", label: "None" },
                    { value: "current", label: "Current matrix" },
                  ]}
                  onChange={(value) => updateIsp("sensorConversionMethod", value)}
                />
                <CameraLiveSelectField
                  label="Internal color space"
                  value={request.isp.internalColorSpace}
                  options={[
                    { value: "xyz", label: "XYZ" },
                    { value: "sensor", label: "Sensor" },
                  ]}
                  onChange={(value) => updateIsp("internalColorSpace", value)}
                />
                <CameraLiveSelectField
                  label="Illuminant correction"
                  value={request.isp.illuminantCorrection}
                  options={[
                    { value: "none", label: "None" },
                    { value: "gray world", label: "Gray world" },
                    { value: "white world", label: "White world" },
                    { value: "manual", label: "Manual matrix" },
                  ]}
                  onChange={(value) => updateIsp("illuminantCorrection", value)}
                />
                <CameraLiveSelectField
                  label="Render scaling"
                  value={request.isp.renderScale ? "true" : "false"}
                  options={[
                    { value: "true", label: "Scale display output" },
                    { value: "false", label: "Preserve linear magnitude" },
                  ]}
                  onChange={(value) => updateIsp("renderScale", value === "true")}
                />
                <CameraLiveSelectField
                  label="Demosaic-only debug"
                  value={request.isp.renderDemosaicOnly ? "true" : "false"}
                  options={[
                    { value: "false", label: "Full color pipeline" },
                    { value: "true", label: "Sensor/demosaic only" },
                  ]}
                  onChange={(value) => updateIsp("renderDemosaicOnly", value === "true")}
                />
                <CameraLiveSelectField
                  label="HDR white blend"
                  value={request.isp.hdrWhite ? "true" : "false"}
                  options={[
                    { value: "false", label: "Disabled" },
                    { value: "true", label: "ip_compute HDR white" },
                  ]}
                  onChange={(value) => updateIsp("hdrWhite", value === "true")}
                />
                <CameraLiveNumberField
                  label="HDR level"
                  value={request.isp.hdrLevel}
                  min={0.5}
                  max={0.99}
                  step={0.01}
                  onChange={(value) => updateIsp("hdrLevel", value)}
                  disabled={!request.isp.hdrWhite}
                />
              </div>
            </div>

            <div className="data-card">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">HW ISP / 3A Timing</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">
                    Uses CameraE2E <span className="font-semibold text-slate-300">hw_isp_simulate_sequence</span>.
                  </div>
                </div>
                <span className={`status-badge ${hwIspRequest.enabled ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-slate-400"}`}>
                  {hwIspRequest.enabled ? "enabled" : "off"}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <CameraLiveSelectField
                  label="HW ISP simulation"
                  value={hwIspRequest.enabled ? "true" : "false"}
                  options={[
                    { value: "false", label: "Disabled" },
                    { value: "true", label: "Run timing / 3A" },
                  ]}
                  onChange={(value) => updateHwIsp("enabled", value === "true")}
                />
                <CameraLiveSelectField
                  label="Profile"
                  value={hwIspRequest.profile}
                  options={[
                    { value: "default", label: "CameraE2E default" },
                    { value: "generic_1080p_30fps", label: "Generic 1080p30" },
                    { value: "rpi_vc4_imx219_public_seed", label: "Raspberry Pi VC4 IMX219 seed" },
                  ]}
                  disabled={!hwIspRequest.enabled}
                  onChange={(value) => updateHwIsp("profile", value)}
                />
                <CameraLiveSelectField
                  label="Apply 3A to image"
                  value={hwIspRequest.applyToImage ? "true" : "false"}
                  options={[
                    { value: "false", label: "Timing only" },
                    { value: "true", label: "Modify frame exposure/WB" },
                  ]}
                  disabled={!hwIspRequest.enabled}
                  onChange={(value) => updateHwIsp("applyToImage", value === "true")}
                />
                <CameraLiveNumberField
                  label="Frames"
                  value={hwIspRequest.nFrames}
                  min={1}
                  max={12}
                  step={1}
                  disabled={!hwIspRequest.enabled}
                  onChange={(value) => updateHwIsp("nFrames", value)}
                />
                <CameraLiveNumberField
                  label="FPS"
                  value={hwIspRequest.fps}
                  min={1}
                  max={120}
                  step={1}
                  disabled={!hwIspRequest.enabled}
                  onChange={(value) => updateHwIsp("fps", value)}
                />
                <CameraLiveNumberField
                  label="Line time"
                  value={hwIspRequest.lineTimeUs}
                  min={1}
                  step={0.1}
                  unit="us"
                  disabled={!hwIspRequest.enabled}
                  onChange={(value) => updateHwIsp("lineTimeUs", value)}
                />
                <CameraLiveNumberField
                  label="Exposure time"
                  value={hwIspRequest.exposureTimeUs}
                  min={10}
                  step={100}
                  unit="us"
                  disabled={!hwIspRequest.enabled}
                  onChange={(value) => updateHwIsp("exposureTimeUs", value)}
                />
                <CameraLiveNumberField
                  label="Target luma"
                  value={hwIspRequest.targetLuma}
                  min={0.02}
                  max={0.8}
                  step={0.01}
                  disabled={!hwIspRequest.enabled}
                  onChange={(value) => updateHwIsp("targetLuma", value)}
                />
                <CameraLiveSelectField
                  label="AE / AWB"
                  value={`${hwIspRequest.aeEnabled ? "ae" : ""}${hwIspRequest.awbEnabled ? "awb" : ""}`}
                  options={[
                    { value: "aeawb", label: "AE + AWB" },
                    { value: "ae", label: "AE only" },
                    { value: "awb", label: "AWB only" },
                    { value: "", label: "Locked controls" },
                  ]}
                  disabled={!hwIspRequest.enabled}
                  onChange={(value) => {
                    updateHwIsp("aeEnabled", value.includes("ae"));
                    updateHwIsp("awbEnabled", value.includes("awb"));
                  }}
                />
                <CameraLiveNumberField
                  label="Latency factor"
                  value={hwIspRequest.globalLatencyFactor}
                  min={0.1}
                  max={5}
                  step={0.1}
                  disabled={!hwIspRequest.enabled}
                  onChange={(value) => updateHwIsp("globalLatencyFactor", value)}
                />
              </div>
              <details className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                  Advanced timing knobs
                </summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <CameraLiveNumberField
                    label="AE delay"
                    value={hwIspRequest.aeApplyDelayFrames}
                    min={0}
                    max={8}
                    step={1}
                    disabled={!hwIspRequest.enabled || !hwIspRequest.aeEnabled}
                    onChange={(value) => updateHwIsp("aeApplyDelayFrames", value)}
                  />
                  <CameraLiveNumberField
                    label="AWB delay"
                    value={hwIspRequest.awbApplyDelayFrames}
                    min={0}
                    max={8}
                    step={1}
                    disabled={!hwIspRequest.enabled || !hwIspRequest.awbEnabled}
                    onChange={(value) => updateHwIsp("awbApplyDelayFrames", value)}
                  />
                  <CameraLiveNumberField
                    label="Request queue"
                    value={hwIspRequest.requestQueueDepth}
                    min={1}
                    max={16}
                    step={1}
                    disabled={!hwIspRequest.enabled}
                    onChange={(value) => updateHwIsp("requestQueueDepth", value)}
                  />
                  <CameraLiveNumberField
                    label="Max buffers"
                    value={hwIspRequest.maxBuffers}
                    min={1}
                    max={24}
                    step={1}
                    disabled={!hwIspRequest.enabled}
                    onChange={(value) => updateHwIsp("maxBuffers", value)}
                  />
                </div>
              </details>
            </div>

            <div className="lg:col-span-2">
              <button
                className="primary-button w-full"
                type="button"
                onClick={onRunEvaluation}
                disabled={evaluationStatus === "running"}
              >
                <Play size={16} />
                {evaluationStatus === "running" ? "Running camera validation..." : "2. Run Camera Validation"}
              </button>
            </div>

            <div className="data-card lg:col-span-2">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Selected Scene Pipeline Config</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">
                    Select an ODD scenario for test context, choose an example scene input, then run OI, sensor, ISP,
                    and task perception on that scene output.
                  </div>
                </div>
                <span className="code-chip">scene -&gt; OI -&gt; sensor -&gt; ISP -&gt; perception</span>
              </div>

              <div className="mb-3 grid gap-3 xl:grid-cols-[0.92fr_1.08fr]">
                <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                  <CameraLiveSelectField
                    label="Autonomous scene asset"
                    value={selectedDrivingScene?.id ?? ""}
                    options={cameraDrivingScenarios.map((scenario) => ({
                      value: scenario.id,
                      label: `${scenario.name} · ${scenario.suite}`,
                    }))}
                    onChange={applyDrivingScene}
                  />
                  <div className="mt-3">
                    <CameraLiveSelectField
                      label="Example scene input"
                      value={selectedExampleScene?.id ?? ""}
                      options={cameraExampleScenes.map((exampleScene) => ({
                        value: exampleScene.id,
                        label: `${exampleScene.label} · ${exampleScene.category}`,
                      }))}
                      onChange={applyExampleScene}
                    />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <ConfigResolutionRow label="ODD" value={selectedDrivingScene ? `${selectedDrivingScene.weather} / ${selectedDrivingScene.lighting}` : "-"} />
                    <ConfigResolutionRow label="Road / range" value={selectedDrivingScene ? `${selectedDrivingScene.roadType} · ${selectedDrivingScene.rangeBand}` : "-"} />
                    <ConfigResolutionRow label="Primary object" value={selectedDrivingScene?.objectClass ?? "-"} />
                    <ConfigResolutionRow label="Coverage / regressions" value={selectedDrivingScene ? `${selectedDrivingScene.coverage}% · ${selectedDrivingScene.regressions}` : "-"} />
                    <ConfigResolutionRow label="CameraE2E scene input" value={request.scene.type} />
                    <ConfigResolutionRow label="Selected example" value={`${selectedExampleScene?.label ?? "Manual scene"} · ${selectedExampleScene?.category ?? "custom"}`} />
                    <ConfigResolutionRow
                      label={sceneGeometryMode === "angularFov" ? "Object scale metadata" : "Physical target"}
                      value={`${request.scene.targetWidthM ?? "-"}m x ${request.scene.targetHeightM ?? "-"}m @ ${request.scene.distanceM ?? "-"}m`}
                    />
                    {request.scene.sourceImagePath && (
                      <ConfigResolutionRow
                        label="Selected RGB scene"
                        value={`${request.scene.sourceImageLabel ?? "downloaded scene"} · ${
                          request.scene.sourceImageAttribution ?? "source recorded"
                        }`}
                      />
                    )}
                  </div>
                  <div className="mt-3 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
                    {selectedExampleScene?.adapterNote ?? "Manual scene selection is applied to CameraE2E."} RGB source scenes are run through CameraE2E scene_from_file;
                    full 3D road-world rendering remains a future renderer adapter boundary.
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                  <SelectedScenePreview request={request} selectedExampleScene={selectedExampleScene} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <CameraLiveSelectField
                  label="Scene geometry"
                  value={sceneGeometryMode}
                  options={[
                    { value: "physicalGeometry", label: "Physical target size + distance" },
                    { value: "angularFov", label: "Advanced: scene angular width override" },
                  ]}
                  onChange={(value) =>
                    updateScene("geometryMode", value as NonNullable<CameraSimulationRequest["scene"]["geometryMode"]>)
                  }
                />
                <CameraLiveSelectField
                  label="Scene type"
                  value={request.scene.type}
                  options={sceneOptions}
                  onChange={(value) => {
                    const matchingExample =
                      cameraExampleScenes.find((exampleScene) => exampleScene.sceneType === value && exampleScene.id === defaultCameraExampleSceneId) ??
                      cameraExampleScenes.find((exampleScene) => exampleScene.sceneType === value);
                    if (matchingExample) {
                      applyExampleScene(matchingExample.id);
                      return;
                    }
                    setRequest((current) => ({
                      ...current,
                      scene: {
                        ...current.scene,
                        type: value as CameraSimulationRequest["scene"]["type"],
                        sourceImagePath: "",
                        sourceImageLabel: "",
                        sourceImageAttribution: "",
                      },
                    }));
                  }}
                />
                <CameraLiveNumberField
                  label="Patch / pattern size"
                  value={request.scene.patchSize ?? 8}
                  min={1}
                  step={1}
                  onChange={(value) => updateScene("patchSize", value)}
                />
                <CameraLiveNumberField
                  label="Luminance"
                  value={request.scene.luminanceCdM2}
                  min={1}
                  step={10}
                  unit="cd/m2"
                  onChange={(value) => updateScene("luminanceCdM2", value)}
                />
                <CameraLiveNumberField
                  label="Target width"
                  value={request.scene.targetWidthM ?? 1.2}
                  min={0.01}
                  step={0.01}
                  unit="m"
                  onChange={(value) => updateScene("targetWidthM", value)}
                />
                <CameraLiveNumberField
                  label="Target height"
                  value={request.scene.targetHeightM ?? 0.8}
                  min={0.01}
                  step={0.01}
                  unit="m"
                  onChange={(value) => updateScene("targetHeightM", value)}
                />
                <CameraLiveNumberField
                  label="Distance"
                  value={request.scene.distanceM ?? 5}
                  min={0.05}
                  step={0.05}
                  unit="m"
                  onChange={(value) => updateScene("distanceM", value)}
                />
                {sceneGeometryMode === "angularFov" && (
                  <div className="rounded-xl border border-fusion/20 bg-fusion/10 p-3">
                    <CameraLiveNumberField
                      label="Scene angular width override"
                      value={request.scene.fovDeg}
                      min={1}
                      max={120}
                      step={1}
                      unit="deg"
                      onChange={(value) => updateScene("fovDeg", value)}
                    />
                    <div className="mt-2 text-xs leading-5 text-fusion">
                      Advanced mode: physical target width / height / distance are ignored for CameraE2E scene FOV.
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-camera/20 bg-camera/10 p-3">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">Scene Pipeline Perception Model</div>
                    <div className="mt-1 text-xs leading-5 text-slate-300">
                      Runs CameraE2E `task_perception` on the selected scene IP sRGB output. This belongs to Scene
                      Pipeline, not Camera Validation; chart scenes may legitimately produce zero detections.
                    </div>
                  </div>
                  <span className="status-badge bg-camera/15 text-camera">scene-level task inference</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <CameraLiveSelectField
                    label="Model profile"
                    value={request.perception.model}
                    options={[
                      { value: "ultralytics_yolo11n_detection", label: "YOLO11n detection · CameraE2E" },
                      { value: "ultralytics_yolo11n_segmentation", label: "YOLO11n segmentation · CameraE2E" },
                      { value: "torchvision_fasterrcnn_resnet50_fpn_v2_coco", label: "Faster R-CNN COCO · optional" },
                      { value: "proxy_detector_v0", label: "Proxy fallback · no detector" },
                    ]}
                    onChange={(value) => updatePerception("model", value)}
                  />
                  <CameraLiveTextField
                    label="Input size"
                    value={request.perception.inputSize}
                    onChange={(value) => updatePerception("inputSize", value)}
                  />
                  <CameraLiveNumberField
                    label="Confidence"
                    value={request.perception.confidenceThreshold}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(value) => updatePerception("confidenceThreshold", value)}
                  />
                  <CameraLiveNumberField
                    label="NMS"
                    value={request.perception.nmsThreshold}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(value) => updatePerception("nmsThreshold", value)}
                  />
                </div>
              </div>
            </div>

            <div className="data-card lg:col-span-2">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Resolved Camera Geometry</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">
                    Run readiness check after scene, lens, sensor, ISP, and scene-pipeline perception settings are defined.
                  </div>
                </div>
                <span
                  className={`status-badge ${
                    geometryStatus === "warning"
                      ? "bg-fusion/15 text-fusion"
                      : "bg-emerald-400/15 text-emerald-300"
                  }`}
                >
                  {geometryStatus}
                </span>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <ConfigResolutionRow
                  label="Scene target"
                  value={
                    sceneGeometryMode === "physicalGeometry"
                      ? `${request.scene.targetWidthM ?? 1.2}m x ${request.scene.targetHeightM ?? 0.8}m @ ${
                          request.scene.distanceM ?? 5
                        }m`
                      : "advanced angular override"
                  }
                />
                <ConfigResolutionRow
                  label="Target angular size"
                  value={`${formatDeg(sceneAngularExtentForUi)} x ${formatDeg(scenePhysicalVfov)}`}
                />
                <ConfigResolutionRow label="Captured HFOV" value={formatDeg(resolvedLensHfov)} />
                <ConfigResolutionRow
                  label="Sensor active area"
                  value={`${request.sensor.cols} x ${request.sensor.rows} · ${formatMm(requestedSensorWidthMm)} wide`}
                />
                <ConfigResolutionRow
                  label="Lens basis"
                  value={
                    isLensGeometryLocked
                      ? "selected lens asset owns optics geometry"
                      : `${request.lens.focalLengthMm}mm, F/${request.lens.fNumber}`
                  }
                />
                <ConfigResolutionRow
                  label="Physical HFOV from f + sensor"
                  value={formatDeg(resolvedPhysicalHfov)}
                />
                <ConfigResolutionRow
                  label="Target image width"
                  value={
                    targetImageWidthPx !== null
                      ? `${targetImageWidthPx.toFixed(1)} px · ${formatMm(targetImageWidthMm)}`
                      : "-"
                  }
                />
                <ConfigResolutionRow
                  label="Sampling"
                  value={`${(request.sensor.cols / Math.max(resolvedLensHfov, 0.001)).toFixed(2)} px/deg`}
                />
              </div>
              <div
                className={`mt-3 rounded-xl border p-3 text-xs leading-5 ${
                  geometryStatus === "warning"
                    ? "border-fusion/20 bg-fusion/10 text-fusion"
                    : "border-white/10 bg-black/10 text-slate-400"
                }`}
              >
                {geometryResult}
              </div>
              {fovConflictNotes.length > 0 && (
                <div className="mt-3 space-y-2 rounded-xl border border-fusion/20 bg-fusion/10 p-3">
                  {fovConflictNotes.map((note) => (
                    <div key={note} className="flex gap-2 text-xs leading-5 text-fusion">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      {note}
                    </div>
                  ))}
                </div>
              )}
              <details className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-400">
                <summary className="cursor-pointer text-sm font-semibold text-white">Advanced geometry debug</summary>
                <div className="mt-3 grid gap-3 lg:grid-cols-[0.72fr_1.28fr]">
                  <div className="space-y-3">
                    <CameraLiveSelectField
                      label="FOV authority"
                      value={activeFovAuthority}
                      disabled={isLensGeometryLocked}
                      options={[
                        { value: "physicalGeometry", label: "Physical geometry owns FOV" },
                        { value: "lensAsset", label: "Lens asset owns FOV" },
                        { value: "numericOptics", label: "Numeric optics: sensor width + focal length" },
                        { value: "sceneTarget", label: "Scene target owns OI FOV" },
                        { value: "manualOiHfov", label: "Manual OI HFOV override" },
                      ]}
                      onChange={(value) =>
                        updateLens("fovAuthority", value as NonNullable<CameraSimulationRequest["lens"]["fovAuthority"]>)
                      }
                    />
                    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                      {activeFovAuthority === "physicalGeometry" &&
                        "Scene width/height/distance define target angular extent; sensor active area and focal length define captured camera FOV."}
                      {activeFovAuthority === "lensAsset" &&
                        "Raytrace/catalog lens asset owns optics geometry. Numeric lens fields become reference metadata."}
                      {activeFovAuthority === "numericOptics" &&
                        "HFOV is derived from active sensor width and focal length."}
                      {activeFovAuthority === "sceneTarget" &&
                        "Synthetic target angular extent drives OI FOV. Use only for chart diagnostics."}
                      {activeFovAuthority === "manualOiHfov" &&
                        "Manual HFOV directly sets CameraE2E OI FOV. Use only for debug sweeps."}
                    </div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    <ConfigResolutionRow label="Resolved authority" value={String(fovLedgerSummary?.authorityResolved ?? activeFovAuthority)} />
                    <ConfigResolutionRow label="Scene angular extent" value={formatDeg(sceneAngularExtentForUi)} />
                    <ConfigResolutionRow label="Scene vertical extent" value={formatDeg(scenePhysicalVfov)} />
                    <ConfigResolutionRow label="Lens / OI resolved HFOV" value={formatDeg(resolvedLensHfov)} />
                    <ConfigResolutionRow label="Physical HFOV from f + sensor" value={formatDeg(resolvedPhysicalHfov)} />
                    <ConfigResolutionRow label="Sensor active width" value={formatMm(requestedSensorWidthMm)} />
                    <ConfigResolutionRow label="Lens geometry" value={lensResolutionPolicy} />
                    <ConfigResolutionRow label="Lens physics" value={physicsResolutionPolicy} />
                    <ConfigResolutionRow
                      label="Sensor fit"
                      value={
                        request.sensor.fitMode === "matchSceneFov"
                          ? "CameraE2E auto-resizes rows/cols to match scene FOV."
                          : "Requested rows/cols are preserved."
                      }
                    />
                  </div>
                </div>
              </details>
            </div>
          </div>

          <div>
            <button
              className="primary-button w-full"
              type="button"
              onClick={onRunPipeline}
              disabled={pipelineStatus === "running"}
            >
              <Play size={16} />
              {pipelineStatus === "running" ? "Running scene pipeline..." : "3. Run Scene Pipeline"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="data-card">
            <div className="mb-3 text-sm font-semibold text-white">Run Output Stages</div>
            <div className="grid gap-2 md:grid-cols-3">
              <ConfigResolutionRow
                label="1. Stack characterization"
                value={
                  stackResult
                    ? `${stackStatus} · ${stackResult.elapsedMs ?? "-"}ms`
                    : `${stackStatus} · QE / optics geometry / calibration`
                }
              />
              <ConfigResolutionRow
                label="2. Camera evaluation"
                value={
                  evaluationResult
                    ? `${evaluationStatus} · ${evaluationResult.elapsedMs ?? "-"}ms`
                    : `${evaluationStatus} · Macbeth / MTF / noise / texture`
                }
              />
              <ConfigResolutionRow
                label="3. Selected scene pipeline"
                value={
                  pipelineResult
                    ? `${pipelineStatus} · ${pipelineResult.metrics?.imageShape?.join("x") ?? "image"}`
                    : `${pipelineStatus} · ${request.scene.type} -> OI -> sensor -> ISP -> perception`
                }
              />
            </div>
            <div className="mt-3 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
              Camera Validation uses fitted lab charts for metric stability. Selected Scene Pipeline uses the active
              scene framing, focal length, pixel pitch, resolution behavior, ISP, and task perception settings.
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <ConfigResolutionRow
                label="Camera Validation framing"
                value="Standard Chart Fit · chart size chosen for stable MTF/Macbeth/noise metrics"
              />
              <ConfigResolutionRow
                label="Selected Scene framing"
                value={
                  sceneGeometryMode === "angularFov"
                    ? "Scene Angular FOV · source image field width is explicit"
                    : "Physical Target Geometry · target pixel size changes with camera geometry"
                }
              />
            </div>
          </div>

          <CameraResultAccordion
            title="Stack Characterization Result"
            subtitle={
              stackResult
                ? `${stackResult.runId} · ${stackResult.elapsedMs ?? "-"}ms`
                : "Analyze Stack computes QE, optics geometry / RI / PSF, sensor stack RI, and calibration metadata."
            }
            status={stackStatus}
            open={openResults.stack}
            onOpenChange={(open) => setResultOpen("stack", open)}
          >
            {stackResult?.metrics?.stackCharacterization ? (
              <CameraStackCharacterizationReport
                report={stackResult.metrics.stackCharacterization}
                offAxisSummary={stackResult.summaries?.offAxisIllumination}
                lensMode={assetRequest.lensMode}
                selectedLensAsset={selectedLensAsset}
              />
            ) : (
              <CameraResultPlaceholder
                status={stackStatus}
                error={stackError}
                text="No stack characterization result yet. Run Analyze Stack to compute active sensor QE, lens geometry / RI / PSF, sensor stack RI, and calibration evidence."
              />
            )}
          </CameraResultAccordion>

          <CameraResultAccordion
            title="Camera Validation Result"
            subtitle={
              evaluationResult
                ? `${evaluationResult.runId} · ${evaluationResult.elapsedMs ?? "-"}ms`
                : "Camera Validation computes MTF, Macbeth, noise, texture, and harmonic evidence."
            }
            status={evaluationStatus}
            open={openResults.evaluation}
            onOpenChange={(open) => setResultOpen("evaluation", open)}
          >
            {evaluationError && (
              <div className="mb-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs leading-5 text-rose-200">
                {evaluationError}
              </div>
            )}
            {evaluationResult ? (
              <CameraLiveCharacterizationEvidence
                request={request}
                result={evaluationResult}
                cacheKey={evaluationCacheKey}
                selectedLensAsset={selectedLensAsset}
                selectedSensorAsset={selectedSensorAsset}
                selectedReferenceSensorAsset={selectedReferenceSensorAsset}
                psfSourceBadge={psfSourceBadge}
              />
            ) : (
              <CameraResultPlaceholder
                status={evaluationStatus}
                error={evaluationError}
                text="No camera validation result yet. Run Camera Validation to compute static chart metrics."
              />
            )}
          </CameraResultAccordion>

          <CameraResultAccordion
            title="Scene Pipeline Result"
            subtitle={
              pipelineResult
                ? `${pipelineResult.runId} · ${pipelineResult.metrics?.imageShape?.join("x") ?? "image"}`
                : "Scene Pipeline renders the selected scene through OI, sensor, ISP, and adapter outputs."
            }
              status={pipelineStatus}
              open={openResults.pipeline}
              onOpenChange={(open) => setResultOpen("pipeline", open)}
            >
              <CameraScenePipelineResultPanel
              result={pipelineResult}
                status={pipelineStatus}
                error={pipelineError}
              cacheKey={pipelineCacheKey}
              perceptionWarning={pipelinePerception?.warning ?? pipelinePerception?.fallbackReason}
              configMatches={pipelineMatchesCurrentConfig}
            />
            </CameraResultAccordion>
        </div>
      </div>
    </Panel>
  );
}

function CameraRunStatusBadge({ status }: { status: CameraRunStatus }) {
  const className =
    status === "completed"
      ? "bg-emerald-400/15 text-emerald-300"
      : status === "failed"
        ? "bg-rose-400/15 text-rose-300"
        : status === "running"
          ? "bg-camera/15 text-camera"
          : "bg-white/10 text-slate-300";

  return <span className={`status-badge ${className}`}>{status}</span>;
}

function CameraResultAccordion({
  title,
  subtitle,
  status,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  subtitle: string;
  status: CameraRunStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]"
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 truncate text-xs leading-5 text-slate-400">{subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          <CameraRunStatusBadge status={status} />
          <ChevronDown size={16} className={`text-slate-400 transition ${open ? "rotate-180" : ""}`} />
        </div>
      </summary>
      {open && <div className="border-t border-white/10 p-4">{children}</div>}
    </details>
  );
}

function CameraResultPlaceholder({
  status,
  error,
  text,
}: {
  status: CameraRunStatus;
  error?: string | null;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-4 text-sm leading-6 text-slate-400">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span>{text}</span>
        <CameraRunStatusBadge status={status} />
      </div>
      {error && (
        <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs leading-5 text-rose-200">
          {error}
        </div>
      )}
    </div>
  );
}

function CameraScenePipelineResultPanel({
  result,
  status,
  error,
  cacheKey,
  perceptionWarning,
  configMatches,
}: {
  result: CameraSimulationResult | null;
  status: "idle" | "running" | "completed" | "failed";
  error: string | null;
  cacheKey: string;
  perceptionWarning?: string;
  configMatches: boolean;
}) {
  const perception = result?.metrics?.perception ?? result?.metrics?.perceptionProxy;
  const perceptionConfidence =
    perception?.topScore != null
      ? perception.topScore.toFixed(3)
      : perception?.proxyConfidence != null
        ? perception.proxyConfidence.toFixed(3)
        : "-";
  const perceptionAccepted =
    perception?.detectionCount != null
      ? `${perception.acceptedCount ?? 0}/${perception.detectionCount}`
      : perception?.proxyAccepted != null
        ? String(perception.proxyAccepted)
        : "-";
  const perceptionLabel =
    perception?.topLabel && perception.topLabel.length > 0 ? `${perception.topLabel} · ${perceptionConfidence}` : perceptionConfidence;
  const perceptionStatus = formatCameraPerceptionStatus(perception?.adapterStatus);
  const resultOriginLabel =
    result?.resultOrigin === "precomputedDefault"
      ? "Default baseline · precomputed"
      : result
        ? "Live run · completed"
        : "No result";
  const sourceMeanRgb = result?.metrics?.sourceReferenceMeanRgb?.join(" / ") ?? "-";
  const physicalMeanRgb = result?.metrics?.meanRgb?.join(" / ") ?? "-";
  const previewMeanRgb = result?.metrics?.displayPreviewMeanRgb?.join(" / ") ?? "-";
  const hasSourceReference = Boolean(result?.artifacts?.sourceReference);
  const hasDisplayPreview = Boolean(result?.artifacts?.displayPreview);
  const imageGridClass =
    hasSourceReference && hasDisplayPreview ? "lg:grid-cols-3" : hasSourceReference || hasDisplayPreview ? "lg:grid-cols-2" : "";
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
        {result?.artifacts?.ipSrgb ? (
          <div className={`grid gap-0 ${imageGridClass}`}>
            {result.artifacts.sourceReference && (
              <div className="overflow-hidden border-b border-white/10 lg:border-b-0 lg:border-r">
                <CameraLiveImage
                  title="Source RGB scene reference"
                  artifact={result.artifacts.sourceReference}
                  cacheKey={cacheKey}
                  imageClassName="h-[360px] w-full object-contain"
                  fallbackClassName="flex h-[360px] flex-col items-center justify-center gap-2 p-6 text-center text-sm leading-6 text-slate-400"
                />
                <div className="border-t border-white/10 p-2 text-xs font-semibold text-slate-300">
                  Source RGB reference · input scene
                </div>
              </div>
            )}
            {result.artifacts.displayPreview && (
              <div className="overflow-hidden border-b border-white/10 lg:border-b-0 lg:border-r">
                <CameraLiveImage
                  title="Display-tuned selected scene preview"
                  artifact={result.artifacts.displayPreview}
                  cacheKey={cacheKey}
                  imageClassName="h-[360px] w-full object-contain"
                  fallbackClassName="flex h-[360px] flex-col items-center justify-center gap-2 p-6 text-center text-sm leading-6 text-slate-400"
                />
                <div className="border-t border-white/10 p-2 text-xs font-semibold text-slate-300">
                  Display-tuned preview · visual only
                </div>
              </div>
            )}
            <div className="overflow-hidden">
              <CameraLiveImage
                title="CameraE2E selected scene physical ISP sRGB output"
                artifact={result.artifacts.ipSrgb}
                cacheKey={cacheKey}
                imageClassName="h-[360px] w-full object-contain"
                fallbackClassName="flex h-[360px] flex-col items-center justify-center gap-2 p-6 text-center text-sm leading-6 text-slate-400"
              />
              <div className="border-t border-white/10 p-2 text-xs font-semibold text-slate-300">
                Physical ISP sRGB output · metric/perception source
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-[360px] items-center justify-center p-6 text-center text-sm leading-6 text-slate-400">
            Select the camera stack and scene, then run CameraE2E to render selected-scene OI photons, sensor volts,
            ISP sRGB output, and perception adapter evidence.
          </div>
        )}
        <div className="border-t border-white/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Selected Scene Pipeline Output</div>
              <div className="mt-1 text-xs leading-5 text-slate-400">
                {result
                  ? `${result.runId} · ${result.elapsedMs ?? "-"}ms · ${result.metrics?.imageShape?.join("x") ?? "image"}`
                  : "No scene pipeline run yet"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {result && (
                <span className="status-badge bg-camera/15 text-camera">
                  {resultOriginLabel}
                </span>
              )}
              {result && !configMatches && (
                <span className="status-badge bg-fusion/15 text-fusion">stale after config change</span>
              )}
              <span
                className={`status-badge ${
                  status === "completed"
                    ? "bg-emerald-400/15 text-emerald-300"
                    : status === "failed"
                      ? "bg-rose-400/15 text-rose-300"
                      : status === "running"
                        ? "bg-camera/15 text-camera"
                        : "bg-white/10 text-slate-300"
                }`}
              >
                {status}
              </span>
            </div>
          </div>
          {error && (
            <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs leading-5 text-rose-200">
              {error}
            </div>
          )}
          {result && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
              <CameraLiveEvidenceFact label="Source mean RGB" value={sourceMeanRgb} />
              <CameraLiveEvidenceFact label="Physical mean RGB" value={physicalMeanRgb} />
              <CameraLiveEvidenceFact label="Preview mean RGB" value={previewMeanRgb} />
              <CameraLiveEvidenceFact label="Sensor volts p99" value={String(result.metrics?.sensorVoltsP99 ?? "-")} />
              <CameraLiveEvidenceFact label="Perception" value={perceptionStatus} />
              <CameraLiveEvidenceFact label="Detections" value={perceptionAccepted} />
              <CameraLiveEvidenceFact label="Top result" value={perceptionLabel} />
            </div>
          )}
          {result?.artifacts?.displayPreview && (
            <div className="mt-3 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
              Source RGB is the downloaded scene input. Display-tuned preview is a post-render white-balance, tone,
              contrast, and saturation view for inspection only. Camera metrics and task perception still use the
              physical ISP sRGB output.
            </div>
          )}
        </div>
      </div>

      {result && (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {result.artifacts?.perceptionOverlay && (
              <div className="overflow-hidden rounded-xl border border-camera/20 bg-black/20">
                <CameraLiveImage
                  title="CameraE2E task perception detection overlay"
                  artifact={result.artifacts.perceptionOverlay}
                  cacheKey={cacheKey}
                  imageClassName="h-44 w-full object-contain"
                  fallbackClassName="flex h-44 flex-col items-center justify-center gap-2 p-4 text-center text-xs leading-5 text-slate-400"
                />
                <div className="border-t border-white/10 p-2 text-xs font-semibold text-slate-300">
                  Perception detection overlay
                </div>
              </div>
            )}
            {result.artifacts?.oiPhotons && (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <CameraLiveImage
                  title="OI photons"
                  artifact={result.artifacts.oiPhotons}
                  cacheKey={cacheKey}
                  imageClassName="h-44 w-full object-contain"
                  fallbackClassName="flex h-44 flex-col items-center justify-center gap-2 p-4 text-center text-xs leading-5 text-slate-400"
                />
                <div className="border-t border-white/10 p-2 text-xs font-semibold text-slate-300">OI photons</div>
              </div>
            )}
            {result.artifacts?.sensorVolts && (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <CameraLiveImage
                  title="Sensor volts"
                  artifact={result.artifacts.sensorVolts}
                  cacheKey={cacheKey}
                  imageClassName="h-44 w-full object-contain"
                  fallbackClassName="flex h-44 flex-col items-center justify-center gap-2 p-4 text-center text-xs leading-5 text-slate-400"
                />
                <div className="border-t border-white/10 p-2 text-xs font-semibold text-slate-300">Sensor volts</div>
              </div>
            )}
          </div>

          {perception?.detections && perception.detections.length > 0 && (
            <details className="rounded-xl border border-white/10 bg-black/10 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-white">
                Perception detections ({perception.detections.length})
              </summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {perception.detections.slice(0, 9).map((detection, index) => (
                  <div key={`${detection.label}-${index}`} className="rounded-xl border border-white/10 bg-black/10 p-3">
                    <div className="text-sm font-semibold text-white">{detection.label}</div>
                    <div className="mt-1 text-xs text-slate-400">score {detection.score.toFixed(3)}</div>
                    {detection.xyxy && <div className="mt-1 text-xs text-slate-500">xyxy {detection.xyxy.map((v) => Math.round(v)).join(", ")}</div>}
                  </div>
                ))}
              </div>
            </details>
          )}

          <CameraLiveRunNotes result={result} perceptionWarning={perceptionWarning} />

          <details className="data-card">
            <summary className="cursor-pointer text-sm font-semibold text-white">Developer trace</summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="mb-3 text-xs font-semibold uppercase text-camera">Applied CameraE2E setters</div>
                <div className="flex max-h-48 flex-wrap gap-2 overflow-auto">
                  {(result.applied ?? []).map((item) => (
                    <span key={item} className="code-chip">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                <div className="mb-3 text-xs font-semibold uppercase text-camera">Computed summaries</div>
                <div className="grid max-h-72 gap-2 overflow-auto sm:grid-cols-2">
                  {Object.entries(result.summaries ?? {}).map(([group, summary]) => (
                    <div key={group} className="rounded-xl border border-white/10 bg-black/10 p-3">
                      <div className="mb-2 text-xs font-semibold uppercase text-camera">{group}</div>
                      <div className="space-y-1">
                        {Object.entries(summary ?? {}).map(([key, value]) => (
                          <SmallFact key={key} label={key} value={formatCameraSimulationSummaryValue(value)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

function SelectedScenePreview({
  request,
  selectedExampleScene,
}: {
  request: CameraSimulationRequest;
  selectedExampleScene?: CameraExampleScene;
}) {
  const scene = request.scene;
  const isRgbScene = scene.type === "rgb image" && Boolean(scene.sourceImagePath);
  const geometryLabel =
    scene.geometryMode === "angularFov"
      ? `${scene.fovDeg} deg scene angular width`
      : `${scene.targetWidthM ?? "-"}m x ${scene.targetHeightM ?? "-"}m @ ${scene.distanceM ?? "-"}m`;
  const sourceLabel = isRgbScene
    ? `${scene.sourceImageLabel ?? selectedExampleScene?.label ?? "RGB source"} · ${
        scene.sourceImageAttribution ?? "source recorded"
      }`
    : `${scene.type} · generated CameraE2E chart scene`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-camera">Selected scene preview</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">
            Input preview only. The computed OI, sensor, ISP, and perception images appear after Run Scene Pipeline.
          </div>
        </div>
        <span className="status-badge bg-camera/15 text-camera">{isRgbScene ? "scene_from_file" : "generated chart"}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/25">
        {isRgbScene ? (
          <img
            src={scene.sourceImagePath}
            alt={scene.sourceImageLabel ?? selectedExampleScene?.label ?? "Selected scene"}
            className="h-64 w-full object-contain"
          />
        ) : (
          <CameraSceneChartPreview sceneType={scene.type} />
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <CameraLiveEvidenceFact label="Scene input" value={selectedExampleScene?.label ?? scene.type} />
        <CameraLiveEvidenceFact label="Source" value={sourceLabel} />
        <CameraLiveEvidenceFact label="Geometry" value={geometryLabel} />
        <CameraLiveEvidenceFact label="Luminance" value={`${scene.luminanceCdM2} cd/m2`} />
      </div>

      <div className="mt-3 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
        This preview does not apply lens PSF, sensor QE/noise, ISP, or detector logic. It only confirms which scene will
        enter the CameraE2E pipeline.
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-500">
        Pd values are computed with <span className="text-radar">tools.roc_pd</span> using a link-budget SNR estimate from range and class RCS.
      </div>
    </div>
  );
}

function CameraSceneChartPreview({ sceneType }: { sceneType: CameraSimulationRequest["scene"]["type"] }) {
  if (sceneType === "macbeth") {
    return (
      <div className="flex h-64 items-center justify-center bg-slate-950 p-6">
        <div className="w-full max-w-sm">
          <MacbethChartPreview />
        </div>
      </div>
    );
  }

  if (sceneType === "slanted bar") {
    return (
      <div className="relative h-64 overflow-hidden bg-slate-950">
        <div className="absolute inset-0 origin-center rotate-[-7deg] scale-125 bg-[repeating-linear-gradient(90deg,#f8fafc_0_12px,#020617_12px_24px)]" />
        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/55 p-3 text-xs font-semibold text-slate-200">
          Slanted edge / bar pattern for MTF and edge response
        </div>
      </div>
    );
  }

  if (sceneType === "point array") {
    return (
      <div className="grid h-64 grid-cols-9 gap-4 bg-slate-950 p-8">
        {Array.from({ length: 54 }, (_, index) => (
          <span
            key={index}
            className="m-auto block rounded-full bg-camera shadow-[0_0_12px_rgba(0,229,255,0.65)]"
            style={{
              width: `${4 + (index % 3) * 2}px`,
              height: `${4 + (index % 3) * 2}px`,
              opacity: 0.45 + (index % 4) * 0.12,
            }}
          />
        ))}
      </div>
    );
  }

  if (sceneType === "harmonic") {
    return (
      <div className="relative h-64 overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,#e2e8f0_0_2px,#020617_2px_5px,#94a3b8_5px_12px,#020617_12px_24px)]" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-black/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/55 p-3 text-xs font-semibold text-slate-200">
          Harmonic contrast sweep for frequency response
        </div>
      </div>
    );
  }

  if (sceneType === "uniform ee") {
    return (
      <div className="flex h-64 items-end bg-[radial-gradient(circle_at_center,#dbeafe_0%,#94a3b8_38%,#1e293b_100%)] p-3 text-xs font-semibold text-slate-950">
        Uniform field for exposure, SNR, QE, and noise checks
      </div>
    );
  }

  if (sceneType === "dead leaves") {
    return (
      <div className="relative h-64 overflow-hidden bg-slate-950">
        {Array.from({ length: 56 }, (_, index) => (
          <span
            key={index}
            className="absolute rounded-full mix-blend-screen"
            style={{
              left: `${(index * 17) % 100}%`,
              top: `${(index * 29) % 100}%`,
              width: `${18 + (index % 7) * 10}px`,
              height: `${18 + (index % 7) * 10}px`,
              backgroundColor: ["#00e5ff", "#2ef5a9", "#f2c85b", "#a568ff", "#64748b"][index % 5],
              opacity: 0.18 + (index % 5) * 0.05,
            }}
          />
        ))}
        <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/60 p-3 text-xs font-semibold text-slate-200">
          Dead leaves texture for ISP detail retention and noise interaction
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-64 items-center justify-center bg-slate-950 p-6 text-center text-xs leading-5 text-slate-400">
      Select an RGB source image or generated CameraE2E chart scene.
    </div>
  );
}

function CameraLiveNumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          className="min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-camera/50 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/5 disabled:text-slate-500"
        />
        {unit && <span className="w-14 shrink-0 text-xs text-slate-500">{unit}</span>}
      </div>
    </label>
  );
}

function CameraLiveTextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-camera/50"
      />
    </label>
  );
}

type CameraLiveSelectOption = string | { value: string; label: string; disabled?: boolean };

function CameraLiveSelectField({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: CameraLiveSelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-camera/50 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/5 disabled:text-slate-500"
      >
        {options.map((option) => (
          <option
            key={typeof option === "string" ? option : option.value}
            value={typeof option === "string" ? option : option.value}
            disabled={typeof option === "string" ? false : option.disabled}
          >
            {typeof option === "string" ? option : option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CameraAssetSelectionSummary({
  title,
  asset,
  fallback,
}: {
  title: string;
  asset?: CameraE2EAssetOption;
  fallback: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="text-xs font-semibold uppercase text-camera">{title}</div>
      <div className="mt-1 truncate text-sm font-semibold text-white">{asset?.label ?? fallback}</div>
      <div className="mt-1 text-xs leading-5 text-slate-400">
        {asset?.summary ?? "No CameraE2E asset detail selected."}
      </div>
      {asset && (
        <div className="mt-2">
          <span className={`status-badge ${asset.testable ? "bg-camera/15 text-camera" : "bg-fusion/15 text-fusion"}`}>
            {asset.testable ? "live testable" : "reference only"}
          </span>
        </div>
      )}
    </div>
  );
}

function ConfigResolutionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-xs leading-5 text-slate-300">{value}</div>
    </div>
  );
}

function CameraLiveImage({
  title,
  artifact,
  cacheKey,
  imageClassName,
  fallbackClassName,
}: {
  title: string;
  artifact: { url: string };
  cacheKey: string;
  imageClassName: string;
  fallbackClassName: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [artifact.url, cacheKey]);

  const imageUrl = `${artifact.url}${artifact.url.includes("?") ? "&" : "?"}v=${encodeURIComponent(
    `${cacheKey}:${artifact.url}:${attempt}`
  )}`;

  const handleError = () => {
    if (attempt < 3) {
      window.setTimeout(() => {
        setAttempt((current) => current + 1);
      }, 250 * (attempt + 1));
      return;
    }
    setFailed(true);
  };

  if (failed) {
    return (
      <div className={fallbackClassName}>
        <AlertTriangle size={18} className="text-fusion" />
        <div>{title} image could not be displayed, but the artifact file was generated.</div>
        <a href={artifact.url} target="_blank" rel="noreferrer" className="text-camera underline-offset-4 hover:underline">
          Open artifact
        </a>
      </div>
    );
  }

  return (
    <img
      key={`${artifact.url}:${cacheKey}:${attempt}`}
      src={imageUrl}
      alt={title}
      loading="eager"
      decoding="async"
      onError={handleError}
      onLoad={() => setFailed(false)}
      className={imageClassName}
    />
  );
}

function CameraLiveEvidenceFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
      <div className="text-[11px] uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-xs font-semibold leading-5 text-slate-200">{value}</div>
    </div>
  );
}

function CameraStackPreviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/10 bg-black/10 px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <div className="w-28 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</div>
        <div className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-200" title={value}>
          {value}
        </div>
      </div>
    </div>
  );
}

function CameraLiveReferenceCharacterization({
  characterization,
  selectedLensAsset,
  selectedSensorAsset,
  selectedReferenceSensorAsset,
  psfSourceBadge,
  offAxisIlluminationPreview,
  hasRunResult,
}: {
  characterization: CameraWorkbenchModel["characterization"];
  selectedLensAsset?: CameraE2EAssetOption;
  selectedSensorAsset?: CameraE2EAssetOption;
  selectedReferenceSensorAsset?: CameraE2EAssetOption;
  psfSourceBadge: string;
  offAxisIlluminationPreview: string;
  hasRunResult: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">Selected Stack</div>
          <div className="mt-0.5 text-xs text-slate-500">Input summary only. Computed evidence appears after each run.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="status-badge bg-fusion/15 text-fusion">pre-run input summary</span>
          <span className="code-chip">{hasRunResult ? "computed evidence available" : "not computed yet"}</span>
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <CameraStackPreviewItem label="Lens / optics" value={selectedLensAsset?.label ?? "Generated/default optics"} />
        <CameraStackPreviewItem label="PSF source" value={psfSourceBadge} />
        <CameraStackPreviewItem label="Off-axis / RI" value={offAxisIlluminationPreview} />
        <CameraStackPreviewItem label="Sensor" value={selectedSensorAsset?.label ?? "Default Bayer GRBG"} />
        <CameraStackPreviewItem
          label="Spectral / QE asset"
          value={selectedReferenceSensorAsset?.label ?? "Numeric QE scale"}
        />
      </div>

      <div className="mt-2 text-[11px] leading-5 text-slate-500">
        Not validation evidence. Analyze Stack computes active Sensor QE, lens geometry / RI / PSF, sensor stack RI, and
        module calibration metadata; Camera Validation computes MTF, Macbeth, noise, texture, and harmonic metrics.
      </div>

      <details className="mt-2 rounded-xl border border-white/10 bg-black/10 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-white">Reference asset assumptions</summary>
        <div className="mt-2 grid gap-2">
          {characterization.lensSummary.map((item) => (
            <div key={item.label} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
              <div className="w-28 shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                {item.label}
              </div>
              <div className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-200" title={item.value}>
                {item.value}
              </div>
              <EvidenceBadge evidence={item.evidence} />
            </div>
          ))}
        </div>
      </details>

      <details className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-white">
          Reference expectations
          <span className="ml-2 text-xs font-normal text-slate-500">mock/design guidance, not computed run evidence</span>
        </summary>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="mb-2 text-xs font-semibold text-white">MTF vs Spatial Frequency</div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={characterization.mtfByFrequency}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="frequency" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[0, 1]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="center" stroke="#00e5ff" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="midField" stroke="#2ef5a9" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="edge" stroke="#f2c85b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="candidateEdge" stroke="#a568ff" strokeWidth={2} dot={false} />
                </ReLineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="mb-2 text-xs font-semibold text-white">Sensor QE Spectral Response</div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={characterization.qeResponse}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="wavelength" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="baseline" stroke="#64748b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="candidate" stroke="#00e5ff" strokeWidth={2} dot={false} />
                </ReLineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="mb-2 text-xs font-semibold text-white">Sensor Noise / Low-light Response</div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={characterization.sensorNoise}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="lux" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="shotNoise" stroke="#f2c85b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="readNoise" stroke="#fb7185" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="snr" stroke="#00e5ff" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pedestrianRecall" stroke="#2ef5a9" strokeWidth={2} dot={false} />
                </ReLineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="mb-2 text-xs font-semibold text-white">ISP / Macbeth Response</div>
            <div className="grid gap-3 sm:grid-cols-[0.72fr_1.28fr]">
              <MacbethChartPreview />
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={characterization.macbethResponse}>
                    <CartesianGrid stroke="rgba(148,163,184,0.12)" />
                    <XAxis dataKey="patch" stroke="#64748b" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="deltaE" fill="#00e5ff" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="saturation" fill="#f2c85b" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="classifierShift" fill="#a568ff" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/10 p-3 lg:col-span-2">
            <div className="mb-2 text-xs font-semibold text-white">ISP Stage Impact</div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={characterization.ispComparison}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="stage" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="snr" fill="#00e5ff" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="sharpness" fill="#2ef5a9" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="smallObjectRecall" fill="#a568ff" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="trafficLightError" fill="#fb7185" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/10 p-3 lg:col-span-2">
            <div className="mb-2 text-xs font-semibold text-white">Characteristic -&gt; Perception Correlation</div>
            <div className="grid gap-2 lg:grid-cols-2">
              {characterization.perceptionCorrelations.map((item) => (
                <div key={item.characteristic} className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-white">{item.characteristic}</div>
                      <div className="mt-1 text-[11px] leading-5 text-slate-400">{item.observation}</div>
                    </div>
                    <EvidenceBadge evidence={item.evidence} />
                  </div>
                  <div className="mt-2 rounded-lg border border-camera/20 bg-camera/10 p-2 text-[11px] leading-5 text-slate-200">
                    {item.effect}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

const staticChartFallbackColors = ["#00e5ff", "#2ef5a9", "#f2c85b", "#a568ff", "#fb7185", "#60a5fa"];

function CameraStaticAnalysisChart({ chart }: { chart: CameraStaticChart }) {
  const data = chart.data ?? [];
  const series = chart.series.length > 0 ? chart.series : [];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-white">{chart.title}</div>
          {chart.description && <div className="mt-1 text-[11px] leading-5 text-slate-500">{chart.description}</div>}
        </div>
        {chart.xLabel && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-400">{chart.xLabel}</span>}
      </div>

      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          {chart.kind === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey={chart.xKey} stroke="#64748b" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              {series.map((item, index) => (
                <Bar
                  key={item.key}
                  dataKey={item.key}
                  name={item.label}
                  fill={item.color ?? staticChartFallbackColors[index % staticChartFallbackColors.length]}
                  radius={[3, 3, 0, 0]}
                />
              ))}
            </BarChart>
          ) : chart.kind === "area" ? (
            <AreaChart data={data}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey={chart.xKey} stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              {series.map((item, index) => (
                <Area
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.label}
                  stroke={item.color ?? staticChartFallbackColors[index % staticChartFallbackColors.length]}
                  fill={item.color ?? staticChartFallbackColors[index % staticChartFallbackColors.length]}
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          ) : (
            <ReLineChart data={data}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey={chart.xKey} stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} />
              {series.map((item, index) => (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.label}
                  stroke={item.color ?? staticChartFallbackColors[index % staticChartFallbackColors.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </ReLineChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {series.map((item, index) => (
          <span key={item.key} className="inline-flex items-center gap-1.5 text-[10px] text-slate-400">
            <span
              className="h-1.5 w-3 rounded-full"
              style={{ backgroundColor: item.color ?? staticChartFallbackColors[index % staticChartFallbackColors.length] }}
            />
            {item.label}
            {item.unit && <span className="text-slate-600">({item.unit})</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

function CameraStaticRunReport({
  report,
  cacheKey,
  title = "Static Camera Test Report",
  description = "Macbeth, slanted bar, dead leaves, uniform, point array, and harmonic charts rendered through CameraE2E.",
}: {
  report?: CameraStaticReportForUi;
  cacheKey: string;
  title?: string;
  description?: string;
}) {
  if (!report) {
    return null;
  }

  return (
    <div className="data-card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">{description}</div>
        </div>
        <span className="status-badge bg-camera/15 text-camera">{report.protocolVersion}</span>
      </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {report.summary.map((metric) => (
            <div key={`${metric.label}-${metric.source}`} className="rounded-xl border border-white/10 bg-black/10 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">{metric.label}</div>
              <div className="mt-2 text-xl font-semibold text-white">
                {metric.value}
                {metric.unit && <span className="ml-1 text-xs text-slate-500">{metric.unit}</span>}
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-400">{metric.source}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {report.tests.map((test) => (
            <div key={test.scene} className="rounded-xl border border-white/10 bg-black/10 p-3">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{test.scene}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">{test.purpose}</div>
                  {test.framingMode && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="code-chip">{test.framingMode}</span>
                      {typeof test.sceneFovDeg === "number" && <span className="code-chip">{test.sceneFovDeg.toFixed(2)} deg chart FOV</span>}
                    </div>
                  )}
                </div>
                <span
                  className={`status-badge ${
                    test.status === "completed"
                      ? "bg-emerald-400/15 text-emerald-300"
                      : test.status === "skipped"
                        ? "bg-fusion/15 text-fusion"
                        : "bg-rose-400/15 text-rose-300"
                  }`}
                >
                  {test.source}
                </span>
              </div>
              {test.fovPolicy && (
                <div className="mb-3 rounded-lg border border-fusion/20 bg-fusion/10 p-2 text-xs leading-5 text-fusion">
                  {test.fovPolicy}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-[0.78fr_1.22fr]">
                {test.artifact ? (
                  <div className="overflow-hidden rounded-lg border border-white/10 bg-black/20">
                    <CameraLiveImage
                      title={`${test.scene} static chart`}
                      artifact={test.artifact}
                      cacheKey={cacheKey}
                      imageClassName="h-28 w-full object-contain"
                      fallbackClassName="flex h-28 flex-col items-center justify-center gap-2 p-3 text-center text-xs leading-5 text-slate-400"
                    />
                  </div>
                ) : (
                  <div className="flex h-28 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-xs text-slate-500">
                    no chart artifact
                  </div>
                )}
                <div className="grid gap-2">
                  {test.metrics.map((metric) => (
                    <div key={`${test.scene}-${metric.label}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[11px] uppercase text-slate-500">{metric.label}</div>
                          <div className="mt-1 text-sm font-semibold text-white">
                            {metric.value}
                            {metric.unit && <span className="ml-1 text-xs text-slate-500">{metric.unit}</span>}
                          </div>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${metricStatusClass(metric.status)}`}>
                          {metric.status ?? "image-derived"}
                        </span>
                      </div>
                      {metric.description && <div className="mt-1 text-xs leading-5 text-slate-500">{metric.description}</div>}
                    </div>
                  ))}
                </div>
              </div>
              {test.charts && test.charts.length > 0 && (
                <div className="mt-3 grid gap-3">
                  {test.charts.map((chart) => (
                    <CameraStaticAnalysisChart key={`${test.scene}-${chart.id}`} chart={chart} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
          {report.provenance}
        </div>
      </div>
  );
}
type CameraStaticReportForUi = NonNullable<NonNullable<CameraSimulationResult["metrics"]>["staticCamera"]>;
type CameraStaticTestForUi = CameraStaticReportForUi["tests"][number];
type CameraStaticMetricForUi = CameraStaticTestForUi["metrics"][number];

function findCameraStaticTest(report: CameraStaticReportForUi | undefined, scene: string) {
  return report?.tests.find((test) => test.scene.toLowerCase() === scene.toLowerCase());
}

function findCameraStaticChart(test: CameraStaticTestForUi | undefined, preferredIds: string[]) {
  if (!test?.charts?.length) {
    return undefined;
  }
  return preferredIds.map((id) => test.charts?.find((chart) => chart.id === id)).find(Boolean) ?? test.charts[0];
}

function findCameraStaticMetric(test: CameraStaticTestForUi | undefined, labels: string[]) {
  return labels.map((label) => test?.metrics.find((metric) => metric.label === label)).find(Boolean);
}

function formatCameraStaticMetric(metric: CameraStaticMetricForUi | undefined) {
  if (!metric) {
    return "-";
  }
  return `${metric.value}${metric.unit ? ` ${metric.unit}` : ""}`;
}

function metricStatusClass(status?: string) {
  const normalized = (status ?? "image-derived").toLowerCase();
  if (normalized === "camerae2e" || normalized === "computed") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  }
  if (normalized === "asset" || normalized === "metadata") {
    return "border-camera/20 bg-camera/10 text-camera";
  }
  if (normalized === "image-derived") {
    return "border-fusion/20 bg-fusion/10 text-fusion";
  }
  if (normalized === "not_available" || normalized === "failed") {
    return "border-rose-400/20 bg-rose-400/10 text-rose-300";
  }
  return "border-slate-300/20 bg-white/10 text-slate-300";
}

function CameraRunMetricFact({
  label,
  metric,
  fallback,
}: {
  label: string;
  metric?: CameraStaticMetricForUi;
  fallback?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase text-slate-500">{label}</div>
          <div className="mt-1 text-xs font-semibold leading-5 text-slate-200">{metric ? formatCameraStaticMetric(metric) : fallback ?? "-"}</div>
        </div>
        {metric?.status && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${metricStatusClass(metric.status)}`}
          >
            {metric.status}
          </span>
        )}
      </div>
      {metric?.description && <div className="mt-1 text-[11px] leading-5 text-slate-500">{metric.description}</div>}
    </div>
  );
}

function CameraRunMetricChartSlot({ chart, empty }: { chart?: CameraStaticChart; empty: string }) {
  if (!chart) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-xl border border-white/10 bg-black/10 p-4 text-center text-xs leading-5 text-slate-500">
        {empty}
      </div>
    );
  }
  return <CameraStaticAnalysisChart chart={chart} />;
}

function CameraComputedStackTestSection({
  title,
  description,
  test,
  empty,
}: {
  title: string;
  description: string;
  test?: CameraStaticTestForUi;
  empty: string;
}) {
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">{description}</div>
        </div>
        <span
          className={`status-badge ${
            test?.status === "completed"
              ? "bg-emerald-400/15 text-emerald-300"
              : test
                ? "bg-fusion/15 text-fusion"
                : "bg-white/10 text-slate-400"
          }`}
        >
          {test?.status ?? "not available"}
        </span>
      </div>
      {test ? (
        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {test.metrics.map((metric) => (
              <CameraRunMetricFact key={`${test.scene}-${metric.label}`} label={metric.label} metric={metric} />
            ))}
          </div>
          {test.charts && test.charts.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {test.charts.map((chart) => (
                <CameraStaticAnalysisChart key={`${test.scene}-${chart.id}`} chart={chart} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs leading-5 text-slate-500">
              {empty}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs leading-5 text-slate-500">
          {empty}
        </div>
      )}
    </div>
  );
}

function CameraStackCharacterizationReport({
  report,
  offAxisSummary,
  lensMode,
  selectedLensAsset,
}: {
  report: CameraStaticReportForUi;
  offAxisSummary?: Record<string, string | number | boolean | number[]>;
  lensMode?: NonNullable<CameraSimulationRequest["assets"]>["lensMode"];
  selectedLensAsset?: CameraE2EAssetOption;
}) {
  const qeTest = findCameraStaticTest(report, "active sensor QE");
  const psfTest = findCameraStaticTest(report, "raytrace optics PSF");
  const raytraceAssetTest = findCameraStaticTest(report, "raytrace optics asset metadata");
  const distortionTest = findCameraStaticTest(report, "raytrace distortion geometry");
  const riTest = findCameraStaticTest(report, "raytrace relative illumination");
  const lensDbTest = findCameraStaticTest(report, "lens DB surface / ray-transfer");
  const sensorStackTest = findCameraStaticTest(report, "sensor optical stack / microlens");
  const calibrationTest = findCameraStaticTest(report, "module calibration / OC");
  const qeChart = findCameraStaticChart(qeTest, ["camera_e2e_sensor_qe"]);
  const psfChart = findCameraStaticChart(psfTest, ["camera_e2e_raytrace_psf_profile"]);
  const raytraceSelected = lensMode === "raytraceOptics" && Boolean(selectedLensAsset);
  const offAxisModel = typeof offAxisSummary?.model === "string" ? offAxisSummary.model : "not resolved";
  const offAxisSource = typeof offAxisSummary?.source === "string" ? offAxisSummary.source : "-";
  const offAxisCos4 =
    typeof offAxisSummary?.cos4Applied === "boolean"
      ? offAxisSummary.cos4Applied
        ? "Yes"
        : "No"
      : "-";
  const offAxisEdgeRi =
    offAxisSummary?.edgeRIMin !== undefined && offAxisSummary.edgeRIMin !== ""
      ? formatCameraSimulationSummaryValue(offAxisSummary.edgeRIMin)
      : "-";

  return (
    <div className="data-card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Computed Stack Characterization</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">
            Pre-run lens/sensor/calibration evidence from the selected stack. This does not render the selected scene pipeline.
          </div>
        </div>
        <span className="status-badge bg-camera/15 text-camera">{report.protocolVersion}</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {report.summary.map((metric) => (
          <CameraRunMetricFact key={`${metric.label}-${metric.source}`} label={metric.label} metric={metric as CameraStaticMetricForUi} />
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Active Sensor QE</div>
            <div className="mt-1 text-xs leading-5 text-slate-400">
              The spectral quantum-efficiency curve currently installed on the sensor object after constructor, spectral
              asset, and numeric QE scale are applied.
            </div>
          </div>
          <span className="status-badge bg-emerald-400/15 text-emerald-300">{qeTest?.status ?? "not run"}</span>
        </div>
        <CameraRunMetricChartSlot
          chart={qeChart}
          empty="Active sensor QE chart was not produced. Check whether CameraE2E exposes sensor_get(sensor, 'spectral qe') for this sensor."
        />
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Raytrace Optics PSF</div>
            <div className="mt-1 text-xs leading-5 text-slate-400">
              A center-field point spread function sampled from the selected raytrace optics asset. It is only available
              when the lens model is a raytrace optics .mat asset.
            </div>
          </div>
          <span className={`status-badge ${psfChart ? "bg-emerald-400/15 text-emerald-300" : "bg-fusion/15 text-fusion"}`}>
            {psfChart ? "computed" : "requires raytrace lens"}
          </span>
        </div>

        {psfChart ? (
          <div className="grid gap-3 lg:grid-cols-[0.7fr_1.3fr]">
            <div className="grid gap-2">
              <CameraRunMetricFact label="EE50 radius" metric={findCameraStaticMetric(psfTest, ["EE50 radius"])} />
              <CameraRunMetricFact label="EE80 radius" metric={findCameraStaticMetric(psfTest, ["EE80 radius"])} />
              <CameraRunMetricFact label="PSF diameter" metric={findCameraStaticMetric(psfTest, ["PSF diameter"])} />
            </div>
            <CameraStaticAnalysisChart chart={psfChart} />
          </div>
        ) : (
          <div className="rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
            {raytraceSelected
              ? "A raytrace lens is selected, but CameraE2E did not return a PSF grid for this stack. Check the runner warnings and the raytrace optics asset."
              : "No raytrace lens asset is selected. Default/generated optics and catalogue approximations do not contain Zemax/raytrace PSF grids. Use Run Camera Evaluation for MTF and point-array proxy evidence, or select a raytrace optics asset to compute this PSF."}
          </div>
        )}
      </div>

      {(distortionTest || riTest || lensDbTest || raytraceAssetTest) && (
        <div className="mt-3 rounded-xl border border-camera/20 bg-camera/10 p-3">
          <div className="mb-1 text-sm font-semibold text-white">Optical Geometry / Lens DB Evidence</div>
          <div className="text-xs leading-5 text-slate-300">
            Lens asset metadata, raytrace distortion, relative illumination, and catalogue surface data are shown as
            separate authorities. Surface-level glass/IOR stacks appear only when the selected Lens DB asset exposes them.
          </div>
          {offAxisSummary && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <CameraLiveEvidenceFact label="RI authority" value={offAxisModel} />
              <CameraLiveEvidenceFact label="RI source" value={offAxisSource} />
              <CameraLiveEvidenceFact label="Cos4 applied" value={offAxisCos4} />
              <CameraLiveEvidenceFact label="Edge RI" value={offAxisEdgeRi} />
            </div>
          )}
        </div>
      )}

      {raytraceAssetTest && (
        <CameraComputedStackTestSection
          title="Lens DB / Raytrace Asset Metadata"
          description="Raytrace optics name, source lens file, focal/F-number defaults, PSF sampling, field-table coverage, and transmittance from the selected CameraE2E optics asset."
          test={raytraceAssetTest}
          empty="The selected raytrace asset did not expose metadata beyond the loaded optics object."
        />
      )}

      {lensDbTest && (
        <CameraComputedStackTestSection
          title="Lens DB Surface / Ray-transfer"
          description="Surface radius, thickness, semi-aperture, IOR, and ray-transfer footprint parsed from the selected Lens DB asset."
          test={lensDbTest}
          empty="The selected lens asset did not expose a surface stack or ray-transfer footprint table."
        />
      )}

      {(raytraceSelected || distortionTest) && (
        <CameraComputedStackTestSection
          title="Raytrace Distortion Geometry"
          description="Field-height to distorted image-height mapping from CameraE2E raytrace optics. This is separate from OpenCV-style calibration coefficients."
          test={distortionTest}
          empty="The selected raytrace lens did not expose a geometry distortion table."
        />
      )}

      {(raytraceSelected || riTest) && (
        <CameraComputedStackTestSection
          title="Relative Illumination / Vignetting"
          description="Field-dependent relative illumination from the selected optics before ISP lens-shading correction."
          test={riTest}
          empty="The selected raytrace lens did not expose relative illumination data."
        />
      )}

      <CameraComputedStackTestSection
        title="Sensor Optical Stack / Microlens"
        description="Pixel layer thickness, refractive-index stack, and microlens metadata from the active CameraE2E sensor."
        test={sensorStackTest}
        empty="The active sensor did not expose pixel stack RI or layer thickness."
      />

      <CameraComputedStackTestSection
        title="Module Calibration / Optical Center"
        description="Principal point, focal length in pixels, and request-side OpenCV-style distortion coefficients. These do not replace raytrace distortion tables."
        test={calibrationTest}
        empty="No module calibration metadata was supplied."
      />

      <div className="mt-3 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
        {report.provenance}
      </div>
    </div>
  );
}

function CameraLiveCharacterizationEvidence({
  request,
  result,
  cacheKey,
  selectedLensAsset,
  selectedSensorAsset,
  selectedReferenceSensorAsset,
  psfSourceBadge,
}: {
  request: CameraSimulationRequest;
  result: CameraSimulationResult;
  cacheKey: string;
  selectedLensAsset?: CameraE2EAssetOption;
  selectedSensorAsset?: CameraE2EAssetOption;
  selectedReferenceSensorAsset?: CameraE2EAssetOption;
  psfSourceBadge: string;
}) {
  const lensMode = request.assets?.lensMode ?? "none";
  const report = result.metrics?.staticCamera;
  const slantedBar = findCameraStaticTest(report, "slanted bar");
  const pointArray = findCameraStaticTest(report, "point array");
  const uniformEe = findCameraStaticTest(report, "uniform ee");
  const macbeth = findCameraStaticTest(report, "macbeth");
  const deadLeaves = findCameraStaticTest(report, "dead leaves");
  const harmonic = findCameraStaticTest(report, "harmonic");
  const mtfChart = findCameraStaticChart(slantedBar, ["camera_e2e_mtf", "mtf_frequency_proxy"]);
  const psfChart = findCameraStaticChart(pointArray, ["camera_e2e_raytrace_psf_profile", "psf_radial_profile"]);
  const sensorQeChart = findCameraStaticChart(uniformEe, ["camera_e2e_sensor_qe"]);
  const sensorSnrChart = findCameraStaticChart(uniformEe, ["camera_e2e_sensor_snr", "noise_by_signal"]);
  const vsnrChart = findCameraStaticChart(uniformEe, ["camera_e2e_vsnr"]);
  const macbethChart = findCameraStaticChart(macbeth, ["camera_e2e_macbeth_delta_e", "macbeth_patch_response"]);
  const textureChart = findCameraStaticChart(deadLeaves, ["textureEnergy", "tone_histogram"]);
  const harmonicChart = findCameraStaticChart(harmonic, ["response", "tone_histogram"]);
  const opticsProvenance = selectedLensAsset
    ? lensMode === "raytraceOptics"
      ? "Raytrace asset"
      : "Catalogue approximation"
    : request.lensPhysics?.mode === "diffraction"
      ? "Diffraction ideal"
      : request.lensPhysics?.mode === "gaussianPsf" || request.lensPhysics?.mode === "wvfDefocus"
        ? "Synthetic proxy"
        : "Generated/default optics";
  const sensorProvenance = selectedReferenceSensorAsset
    ? "Spectral/QE asset override"
    : selectedSensorAsset
      ? "Sensor constructor default"
      : "Default Bayer sensor";
  const hwIspSummary = result.summaries?.hwIsp;
  const hwIspEnabled = hwIspSummary?.enabled === true;
  const hwIspStatus = hwIspEnabled
    ? `${formatCameraSimulationSummaryValue(hwIspSummary?.e2eLatencyMeanMs ?? "-")} ms mean`
    : String(hwIspSummary?.status ?? "disabled");
  const offAxisSummary = result.summaries?.offAxisIllumination;
  const offAxisModel = typeof offAxisSummary?.model === "string" ? offAxisSummary.model : "not resolved";
  const offAxisSource = typeof offAxisSummary?.source === "string" ? offAxisSummary.source : "-";
  const offAxisCos4 =
    typeof offAxisSummary?.cos4Applied === "boolean"
      ? offAxisSummary.cos4Applied
        ? "Yes"
        : "No"
      : "-";
  const offAxisEdgeRi =
    offAxisSummary?.edgeRIMin !== undefined && offAxisSummary.edgeRIMin !== ""
      ? formatCameraSimulationSummaryValue(offAxisSummary.edgeRIMin)
      : "-";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="data-card">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Optics Run Metrics</div>
              <div className="mt-1 text-xs leading-5 text-slate-400">
                Calculated from this CameraE2E run: slanted-bar MTF and point-array PSF evidence.
              </div>
            </div>
            <span className="status-badge bg-camera/15 text-camera">{opticsProvenance}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <CameraLiveEvidenceFact label="Lens basis" value={selectedLensAsset?.label ?? `${request.lens.focalLengthMm}mm, F/${request.lens.fNumber}`} />
            <CameraLiveEvidenceFact label="PSF source" value={psfSourceBadge} />
            <CameraLiveEvidenceFact label="Off-axis / RI" value={offAxisModel} />
            <CameraLiveEvidenceFact label="RI source" value={offAxisSource} />
            <CameraLiveEvidenceFact label="Cos4 applied" value={offAxisCos4} />
            <CameraLiveEvidenceFact label="Edge RI" value={offAxisEdgeRi} />
            <CameraRunMetricFact label="MTF50" metric={findCameraStaticMetric(slantedBar, ["MTF50", "MTF50 estimate", "MTF50 proxy"])} />
            <CameraRunMetricFact label="PSF width" metric={findCameraStaticMetric(pointArray, ["EE50 radius", "PSF width estimate", "PSF width proxy"])} />
          </div>
          <div className="mt-3 grid gap-3">
            <CameraRunMetricChartSlot
              chart={mtfChart}
              empty="MTF chart was not produced. Check the slanted-bar static test warning in the full protocol report."
            />
            <CameraRunMetricChartSlot
              chart={psfChart}
              empty="PSF chart was not produced. Raytrace PSF requires a raytrace optics asset; otherwise only point-array proxy metrics may be available."
            />
          </div>
        </div>

        <div className="data-card">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Sensor Run Metrics</div>
              <div className="mt-1 text-xs leading-5 text-slate-400">
                Calculated from this CameraE2E run: sensor SNR, visible SNR, voltage response, and uniform-field noise.
              </div>
            </div>
            <span className="status-badge bg-emerald-400/15 text-emerald-300">{sensorProvenance}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <CameraLiveEvidenceFact label="Sensor model" value={selectedSensorAsset?.label ?? request.assets?.sensorType ?? "default"} />
            <CameraLiveEvidenceFact
              label="QE evidence"
              value={selectedReferenceSensorAsset ? `${selectedReferenceSensorAsset.label} applied as input` : "numeric QE scale applied as input"}
            />
            <CameraRunMetricFact label="Peak spectral QE" metric={findCameraStaticMetric(uniformEe, ["Peak spectral QE"])} />
            <CameraRunMetricFact label="Sensor SNR" metric={findCameraStaticMetric(uniformEe, ["Sensor SNR max", "SNR"])} />
            <CameraLiveEvidenceFact label="Voltage p99" value={String(result.metrics?.sensorVoltsP99 ?? "-")} />
          </div>
          <div className="mt-3 grid gap-3">
            <CameraRunMetricChartSlot
              chart={sensorQeChart}
              empty="Sensor QE chart was not produced. Check whether the uniform-ee static test completed and the active sensor exposes spectral QE."
            />
            <CameraRunMetricChartSlot
              chart={sensorSnrChart}
              empty="Sensor SNR chart was not produced. Check whether the uniform-ee static test completed."
            />
            <CameraRunMetricChartSlot
              chart={vsnrChart}
              empty="Visible SNR sweep was not produced by CameraE2E for this sensor setup."
            />
          </div>
        </div>
      </div>

      <div className="data-card">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">ISP / Color Run Metrics</div>
            <div className="mt-1 text-xs leading-5 text-slate-400">
              CameraE2E function metrics where available; dead-leaves, tone, and harmonic values are computed from the rendered ISP output.
            </div>
          </div>
          <span className="status-badge bg-fusion/15 text-fusion">CameraE2E + image-derived</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="space-y-3">
            <MacbethChartPreview />
            <div className="grid gap-2 sm:grid-cols-2">
              <CameraLiveEvidenceFact label="Demosaic" value={request.isp.demosaicMethod} />
              <CameraLiveEvidenceFact label="Sensor conversion" value={request.isp.sensorConversionMethod} />
              <CameraLiveEvidenceFact label="Internal CS" value={request.isp.internalColorSpace} />
              <CameraLiveEvidenceFact label="Illuminant" value={request.isp.illuminantCorrection} />
              <CameraLiveEvidenceFact label="Render scale" value={request.isp.renderScale ? "enabled" : "off"} />
              <CameraLiveEvidenceFact label="HDR white" value={request.isp.hdrWhite ? `enabled @ ${request.isp.hdrLevel}` : "off"} />
              <CameraLiveEvidenceFact label="HW ISP" value={hwIspStatus} />
              {hwIspEnabled && (
                <CameraLiveEvidenceFact
                  label="3A settle"
                  value={`AE ${formatCameraSimulationSummaryValue(hwIspSummary?.aeSettleFrame ?? "-")} / AWB ${formatCameraSimulationSummaryValue(hwIspSummary?.awbSettleFrame ?? "-")}`}
                />
              )}
              <CameraRunMetricFact label="Color DeltaE" metric={findCameraStaticMetric(macbeth, ["DeltaE mean", "DeltaE estimate", "DeltaE proxy"])} />
              <CameraRunMetricFact label="Texture retention" metric={findCameraStaticMetric(deadLeaves, ["Texture retention"])} />
              <CameraRunMetricFact label="Harmonic response" metric={findCameraStaticMetric(harmonic, ["Frequency response"])} />
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            <CameraRunMetricChartSlot chart={macbethChart} empty="Macbeth color chart was not produced." />
            <CameraRunMetricChartSlot chart={textureChart} empty="Dead-leaves texture chart was not produced." />
            <CameraRunMetricChartSlot chart={harmonicChart} empty="Harmonic response chart was not produced." />
          </div>
        </div>
      </div>

      <CameraStaticRunReport report={report} cacheKey={cacheKey} />
    </div>
  );
}

function CameraLiveRunNotes({
  result,
  perceptionWarning,
}: {
  result: CameraSimulationResult;
  perceptionWarning?: string;
}) {
  const notes = [perceptionWarning, ...(result.warnings ?? [])].filter((note): note is string => Boolean(note));
  if (notes.length === 0) {
    return null;
  }

  return (
    <details className="rounded-xl border border-fusion/25 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
      <summary className="cursor-pointer text-sm font-semibold text-white">Run notes / adapter caveats ({notes.length})</summary>
      <div className="mt-3 space-y-2">
        {notes.map((note) => (
          <div key={note} className="flex gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {note}
          </div>
        ))}
      </div>
    </details>
  );
}

function formatCameraSimulationSummaryValue(value: string | number | boolean | number[]) {
  if (Array.isArray(value)) {
    return value.join(" x ");
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(4);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return value;
}

function formatCameraPerceptionStatus(status?: string) {
  if (!status) return "-";
  const labels: Record<string, string> = {
    camera_e2e_task_perception: "CameraE2E task",
    proxy_only: "Proxy only",
    task_perception_unavailable: "Unavailable",
    task_perception_failed_fallback: "Fallback proxy",
  };
  return labels[status] ?? status;
}

function cameraSimulationRequestSignature(request?: CameraSimulationRequest) {
  if (!request) return "";
  const { assets, scene, lens, lensPhysics, sensor, isp, hwIsp, perception } = request;
  return JSON.stringify({ assets, scene, lens, lensPhysics, sensor, isp, hwIsp, perception });
}

function CameraE2EAdapterHealth({ integration }: { integration: CameraE2EIntegration | null }) {
  if (!integration) {
    return (
      <details className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="text-sm font-semibold text-white">Adapter / Integration Health</div>
            <div className="mt-1 text-xs leading-5 text-slate-400">
              CameraE2E synced artifact status and bridge diagnostics.
            </div>
          </div>
          <span className="status-badge bg-fusion/15 text-fusion">not loaded</span>
        </summary>
        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl border border-fusion/25 bg-fusion/10 p-4 text-sm leading-6 text-fusion">
            CameraE2E artifacts are not loaded yet. Run <span className="font-semibold">npm run camera:e2e:sync</span> to
            refresh /assets/camera-e2e/integration.json after CameraE2E reports are regenerated.
          </div>
        </div>
      </details>
    );
  }

  const liveImport = integration.package.liveImport;
  const primaryImages = selectCameraE2EImages(integration.evidenceImages);

  return (
    <details className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-semibold text-white">Adapter / Integration Health</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">
            Developer-facing bridge status. Kept collapsed because the Workflow Console is the primary user surface.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`status-badge ${
              liveImport.available ? "bg-emerald-400/15 text-emerald-300" : "bg-fusion/15 text-fusion"
            }`}
          >
            {liveImport.available ? "live import ready" : "report linked"}
          </span>
          <ChevronDown size={16} className="text-slate-400" />
        </div>
      </summary>
      <div className="space-y-4 border-t border-white/10 p-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <SmallFact label="CameraE2E root" value={integration.sourceRoot} />
          <SmallFact label="Package version" value={integration.package.version} />
          <SmallFact label="Bridge" value={`${integration.bridge.mode} · ${integration.bridge.command}`} />
          <SmallFact label="Refresh" value={integration.bridge.refreshPolicy} />
        </div>

        {!liveImport.available && (
          <div className="rounded-xl border border-fusion/25 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
            Live Python import is unavailable in this shell. The console still runs through the Vite bridge, and synced
            report artifacts remain available for integration diagnostics.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <IntegrationMetric
            label="Parity cases"
            value={`${integration.summary.parity.passed}/${integration.summary.parity.selectedCases}`}
            detail={`failed ${integration.summary.parity.failed}, skipped ${integration.summary.parity.skipped}`}
          />
          <IntegrationMetric
            label="HW ISP latency"
            value={`${integration.summary.hwIsp.e2eLatencyMeanMs}ms`}
            detail={`${integration.summary.hwIsp.profile ?? "profile"} · ${integration.summary.hwIsp.frameCount} frames`}
          />
          <IntegrationMetric
            label="3A latency"
            value={`${integration.summary.hwIsp.threeAE2ELatencyMeanMs}ms`}
            detail={`AE ${integration.summary.hwIsp.aeSettleFrame}, AWB ${integration.summary.hwIsp.awbSettleFrame}`}
          />
          <IntegrationMetric
            label="Pipeline size"
            value={integration.summary.pipeline.sensorSize ?? "sensor linked"}
            detail={`OI ${integration.summary.pipeline.oiSize ?? "-"} · IP ${integration.summary.pipeline.ipSize ?? "-"}`}
          />
          <IntegrationMetric
            label="Smoke run"
            value={integration.summary.liveSimulation?.status ?? "not run"}
            detail={
              integration.summary.liveSimulation?.elapsedMs
                ? `${integration.summary.liveSimulation.elapsedMs}ms · ${integration.summary.liveSimulation.imageShape?.join("x") ?? "image"}`
                : integration.summary.liveSimulation?.reason ?? "CameraE2E smoke render status"
            }
          />
        </div>

        <details className="rounded-xl border border-white/10 bg-black/10 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-white">Bridge evidence and warnings</summary>
          <div className="mt-3 grid gap-4 xl:grid-cols-2">
            <div className="grid gap-2">
              {integration.capabilities.map((capability) => (
                <div key={capability.area} className="compact-row">
                  <CheckCircle2 size={15} className="text-emerald-300" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white">{capability.area}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">{capability.description}</div>
                  </div>
                  <span className="code-chip">{capability.evidence}</span>
                </div>
              ))}
              {integration.warnings.map((warning) => (
                <div key={warning} className="flex gap-2 text-xs leading-5 text-slate-400">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-fusion" />
                  {warning}
                </div>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {integration.pipelineStages.map((stage) => (
                <CameraE2EStageCard key={stage.stage} stage={stage} />
              ))}
            </div>
          </div>
        </details>

        {primaryImages.length > 0 && (
          <details className="rounded-xl border border-white/10 bg-black/10 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-white">Synced report images</summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {primaryImages.map((image) => (
                <div key={image.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                  <img src={image.url} alt={image.title} loading="lazy" className="h-40 w-full object-cover object-top" />
                  <div className="p-3">
                    <div className="text-sm font-semibold text-white">{image.title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">{image.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </details>
  );
}

function CameraE2EStageCard({ stage }: { stage: CameraE2EPipelineStage }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold capitalize text-white">{stage.stage}</div>
        <span className="code-chip">CameraE2E</span>
      </div>
      <div className="space-y-2">
        <SmallFact label="edge rel" value={`${stage.edgeRcMeanRelPct}%`} />
        <SmallFact label="crop MAE" value={stage.cropNormalizedMae.toFixed(4)} />
        <SmallFact label="profile MAE" value={stage.profileNormalizedMae.toFixed(4)} />
      </div>
      {stage.cropFigureUrl && (
        <img
          src={stage.cropFigureUrl}
          alt={`${stage.stage} edge crop`}
          loading="lazy"
          className="mt-3 h-28 w-full rounded-lg border border-white/10 object-cover object-top"
        />
      )}
    </div>
  );
}

function IntegrationMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-400">{detail}</div>
    </div>
  );
}

function selectCameraE2EImages(images: CameraE2EEvidenceImage[]) {
  const preferredIds = [
    "live.macbeth_smoke",
    "camera_default_pipeline.result",
    "optics_rt_center_edge_psf_small.psf",
    "metrics_mtf_slanted_bar_small.curves",
    "metrics_color_accuracy_small.patches",
    "hwisp.frame_timeline",
    "hwisp.ae_convergence",
  ];
  const selected = preferredIds
    .map((id) => images.find((image) => image.id === id))
    .filter((image): image is CameraE2EEvidenceImage => Boolean(image));
  return selected.length > 0 ? selected : images.slice(0, 6);
}

function CameraDesignReferencePanel({ cameraModel }: { cameraModel: CameraWorkbenchModel }) {
  return (
    <details className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-semibold text-white">Design Reference / Metric Mapping</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">
            Mock guidance charts and config-to-metric mapping. Keep collapsed unless you need design heuristics outside
            the computed CameraE2E run results.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="status-badge bg-white/10 text-slate-300">reference</span>
          <ChevronDown size={16} className="text-slate-400" />
        </div>
      </summary>
      <div className="space-y-5 border-t border-white/10 p-4">
        <CameraMetricSuite cameraModel={cameraModel} />

        <Panel title="Camera Config -> Metric Mapping">
          <div className="grid gap-3 lg:grid-cols-2">
            {cameraModel.metricMapping.map((mapping) => (
              <div key={mapping.config} className="data-card">
                <div className="text-sm font-semibold text-white">{mapping.config}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {mapping.metrics.map((metric) => (
                    <span key={metric} className="code-chip">
                      {metric}
                    </span>
                  ))}
                </div>
                <div className="mt-3 space-y-1">
                  {mapping.charts.map((chart) => (
                    <div key={chart} className="flex gap-2 text-xs leading-5 text-slate-400">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-camera" />
                      {chart}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </details>
  );
}

function CameraMetricSuite({ cameraModel }: { cameraModel: CameraWorkbenchModel }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Pixel Height by Distance">
        <div className="h-[270px]">
          <ResponsiveContainer width="100%" height="100%">
            <ReLineChart data={cameraModel.pixelHeightByDistance}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="distance" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine y={45} stroke="#f2c85b" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="pedestrian" stroke="#00e5ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cyclist" stroke="#2ef5a9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="vehicle" stroke="#a568ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="trafficSign" stroke="#f2c85b" strokeWidth={2} dot={false} />
            </ReLineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 text-xs leading-5 text-slate-400">
          Recommended minimum is 45 px. Wider FOV improves near-field coverage but can reduce
          far-range pixel height.
        </div>
      </Panel>

      <Panel title="FOV Coverage / Blind Zone Map">
        <FovCoverageMap />
      </Panel>

      <Panel title="Image Quality -> Perception Failure">
        <div className="h-[270px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cameraModel.imageQualityFailure}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="factor" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="pedestrianFn" fill="#00e5ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cyclistConfusion" fill="#2ef5a9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="trafficLightError" fill="#f2c85b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Recall by Pixel Size">
        <div className="h-[270px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cameraModel.recallByPixelSize}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="bucket" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="pedestrian" fill="#00e5ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cyclist" fill="#2ef5a9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="vehicle" fill="#a568ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="trafficSign" fill="#f2c85b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Calibration Reprojection Error Heatmap">
        <ReprojectionHeatmap />
      </Panel>

      <Panel title="ISP Parameter Sensitivity">
        <div className="h-[270px]">
          <ResponsiveContainer width="100%" height="100%">
            <ReLineChart data={cameraModel.ispSensitivity}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="denoise" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="snr" stroke="#00e5ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="smallObjectRecall" stroke="#2ef5a9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="falsePositive" stroke="#f2c85b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="latency" stroke="#a568ff" strokeWidth={2} dot={false} />
            </ReLineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Camera -> Fusion Contribution Matrix">
        <div className="h-[270px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cameraModel.fusionContribution}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="scenario" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="accepted" fill="#00e5ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="rejected" fill="#64748b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cameraOnlyTp" fill="#2ef5a9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cameraTpFusionFn" fill="#f2c85b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cameraFpAccepted" fill="#fb7185" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Validation Evidence Policy">
        <div className="grid gap-3 sm:grid-cols-2">
          <EvidencePolicyCard
            title="Replayable"
            text="Detector threshold, model checkpoint, NMS, crop/resize, calibration transform, latency compensation."
            feasibility="Replayable"
          />
          <EvidencePolicyCard
            title="Simulatable"
            text="FOV, lens distortion, mounting, exposure, glare, rain/fog, sensor noise, motion blur."
            feasibility="Simulatable"
          />
          <EvidencePolicyCard
            title="Physical Required"
            text="New sensor chip, lens, ISP firmware, housing, windshield behavior, thermal behavior, HDR silicon."
            feasibility="Physical Required"
          />
          <EvidencePolicyCard
            title="Approximation Only"
            text="RGB-only lens warp, crop-based FOV approximation, limited rolling-shutter or frame-rate estimation."
            feasibility="Approximation Only"
          />
        </div>
      </Panel>
    </div>
  );
}

function FovCoverageMap() {
  return (
    <div className="fov-map">
      <div className="vehicle-top" />
      <div className="fov-cone baseline" />
      <div className="fov-cone candidate" />
      <div className="blind-zone left" />
      <div className="blind-zone right" />
      <div className="critical-path" />
      <div className="absolute bottom-4 left-4 grid gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="h-2 w-5 rounded-full bg-camera" />
          Candidate 120 deg FOV
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <span className="h-2 w-5 rounded-full bg-lidar" />
          Baseline 100 deg FOV
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <span className="h-2 w-5 rounded-full bg-rose-400" />
          Blind zone / occlusion risk
        </div>
      </div>
    </div>
  );
}

function ReprojectionHeatmap() {
  const cells = Array.from({ length: 36 }, (_, index) => {
    const row = Math.floor(index / 6);
    const col = index % 6;
    const edgeBoost = Math.abs(col - 2.5) + Math.abs(row - 2.5);
    return 0.4 + edgeBoost * 0.42;
  });

  return (
    <div>
      <div className="grid grid-cols-6 gap-2">
        {cells.map((value, index) => (
          <div
            key={index}
            className="flex aspect-square items-center justify-center rounded-lg border border-white/10 text-xs font-semibold text-white"
            style={{
              background:
                value > 2.1
                  ? `rgba(251, 113, 133, ${Math.min(value / 4, 0.75)})`
                  : `rgba(0, 229, 255, ${Math.min(value / 3, 0.55)})`,
            }}
          >
            {value.toFixed(1)}
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <SmallFact label="Center" value="0.6 px" />
        <SmallFact label="Left edge" value="2.4 px" />
        <SmallFact label="Right edge" value="2.1 px" />
      </div>
      <div className="mt-3 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
        Edge reprojection error may affect wide-angle pedestrian detection and fusion association.
      </div>
    </div>
  );
}

function MacbethChartPreview() {
  const colors = [
    "#735244",
    "#c29682",
    "#627a9d",
    "#576c43",
    "#8580b1",
    "#67bdaa",
    "#d67e2c",
    "#505ba6",
    "#c15a63",
    "#5e3c6c",
    "#9dbc40",
    "#e0a32e",
    "#383d96",
    "#469449",
    "#af363c",
    "#e7c71f",
    "#bb5695",
    "#0885a1",
    "#f3f3f2",
    "#c8c8c8",
    "#a0a0a0",
    "#7a7a7a",
    "#555555",
    "#343434",
  ];

  return (
    <div className="macbeth-preview">
      {colors.map((color, index) => (
        <span key={`${color}-${index}`} style={{ background: color }} />
      ))}
    </div>
  );
}

function EvidenceBadge({
  evidence,
}: {
  evidence: "Datasheet" | "Measured Lab" | "Synthetic" | "Physical Required";
}) {
  const className =
    evidence === "Measured Lab"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-300"
      : evidence === "Synthetic"
        ? "border-camera/30 bg-camera/10 text-camera"
        : evidence === "Physical Required"
          ? "border-rose-300/30 bg-rose-300/10 text-rose-300"
          : "border-fusion/30 bg-fusion/10 text-fusion";

  return <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{evidence}</span>;
}

function EvidencePolicyCard({
  title,
  text,
  feasibility,
}: {
  title: string;
  text: string;
  feasibility: ValidationFeasibility;
}) {
  return (
    <div className="compact-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">{title}</div>
        <FeasibilityBadge feasibility={feasibility} />
      </div>
      <div className="text-xs leading-5 text-slate-400">{text}</div>
    </div>
  );
}

function FeasibilityBadge({ feasibility }: { feasibility: ValidationFeasibility }) {
  const className =
    feasibility === "Replayable"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-300"
      : feasibility === "Simulatable"
        ? "border-camera/30 bg-camera/10 text-camera"
        : feasibility === "Replayable if RAW"
          ? "border-radar/30 bg-radar/10 text-radar"
          : feasibility === "Physical Required"
            ? "border-rose-300/30 bg-rose-300/10 text-rose-300"
            : "border-fusion/30 bg-fusion/10 text-fusion";

  return <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{feasibility}</span>;
}

function RadarDesignValidationWorkbench() {
  const radarModel = getRadarWorkbenchModel();
  const [radarRequest, setRadarRequest] = useState<RadarSimulationRequest>(defaultRadarSimulationRequest);
  const [radarResult, setRadarResult] = useState<RadarSimulationResult | null>(null);
  const [radarStatus, setRadarStatus] = useState<CameraRunStatus>("idle");
  const [radarError, setRadarError] = useState<string | null>(null);
  const activeRadarModel: RadarWorkbenchModel = radarResult
    ? {
        ...radarModel,
        kpis: radarResult.kpis ?? radarModel.kpis,
        radarsimpyAdapter: radarResult.adapter ?? radarModel.radarsimpyAdapter,
        rangeDopplerCfar: radarResult.rangeDopplerCfar ?? radarModel.rangeDopplerCfar,
        rocPd: radarResult.rocPd ?? radarModel.rocPd,
        detectionProbabilityByRange: radarResult.detectionProbabilityByRange ?? radarModel.detectionProbabilityByRange,
        velocityTimeline: radarResult.velocityTimeline ?? radarModel.velocityTimeline,
        cfarSensitivity: radarResult.cfarSensitivity ?? radarModel.cfarSensitivity,
        postCfarFiltering: radarResult.postCfarFiltering ?? radarModel.postCfarFiltering,
        mimoComparison: radarResult.mimoComparison ?? radarModel.mimoComparison,
        failureBuckets: radarResult.failureBuckets ?? radarModel.failureBuckets,
        signalProcessingChain: radarResult.signalProcessingChain ?? radarModel.signalProcessingChain,
        doaSpectrum: radarResult.doaSpectrum ?? radarModel.doaSpectrum,
      }
    : radarModel;
  const groupedChanges = radarModel.configChanges.reduce<
    Record<string, typeof radarModel.configChanges>
  >((groups, change) => {
    groups[change.group] = [...(groups[change.group] ?? []), change];
    return groups;
  }, {});

  const runLiveRadar = async () => {
    const request: RadarSimulationRequest = {
      ...radarRequest,
      runId: `radar-live-${Date.now()}`,
    };
    setRadarStatus("running");
    setRadarError(null);
    try {
      const result = await runRadarSimSimulation(request);
      setRadarResult(result);
      setRadarStatus("completed");
    } catch (error) {
      setRadarError(error instanceof Error ? error.message : String(error));
      setRadarStatus("failed");
    }
  };

  return (
    <div className="space-y-5">
      <RadarWorkflowConsole
        radarModel={activeRadarModel}
        groupedChanges={groupedChanges}
        request={radarRequest}
        result={radarResult}
        status={radarStatus}
        error={radarError}
        setRequest={setRadarRequest}
        onRun={runLiveRadar}
      />
      <RadarPrimaryResults radarModel={activeRadarModel} result={radarResult} />
      <RadarFusionFailureSummary radarModel={activeRadarModel} result={radarResult} />
      <RadarAdvancedReferencePanel radarModel={activeRadarModel} groupedChanges={groupedChanges} />
    </div>
  );
}

function RadarWorkflowConsole({
  radarModel,
  groupedChanges,
  request,
  result,
  status,
  error,
  setRequest,
  onRun,
}: {
  radarModel: RadarWorkbenchModel;
  groupedChanges: Record<string, RadarWorkbenchModel["configChanges"]>;
  request: RadarSimulationRequest;
  result: RadarSimulationResult | null;
  status: CameraRunStatus;
  error: string | null;
  setRequest: Dispatch<SetStateAction<RadarSimulationRequest>>;
  onRun: () => void;
}) {
  const primaryGroups = [
    "RF / Antenna",
    "Waveform / Timing",
    "Signal Processing",
    "Detection / CFAR",
    "Clustering / Tracking",
    "Fusion",
  ];
  const adapter = radarModel.radarsimpyAdapter;
  const updateWaveform = (field: keyof RadarSimulationRequest["waveform"], value: number) => {
    setRequest((current) => ({
      ...current,
      waveform: { ...current.waveform, [field]: value },
    }));
  };
  const updateReceiver = (field: keyof RadarSimulationRequest["receiver"], value: number) => {
    setRequest((current) => ({
      ...current,
      receiver: { ...current.receiver, [field]: value },
    }));
  };
  const updateCfar = (field: keyof RadarSimulationRequest["cfar"], value: number) => {
    setRequest((current) => ({
      ...current,
      cfar: { ...current.cfar, [field]: value },
    }));
  };
  const updateArray = (field: keyof RadarSimulationRequest["array"], value: number) => {
    setRequest((current) => ({
      ...current,
      array: { ...current.array, [field]: value },
    }));
  };
  const updateMimoMode = (mode: NonNullable<RadarSimulationRequest["mimo"]>["mode"]) => {
    setRequest((current) => ({
      ...current,
      mimo: { mode },
    }));
  };
  const updateRcsSource = (mode: NonNullable<RadarSimulationRequest["rcsSource"]>["mode"]) => {
    setRequest((current) => ({
      ...current,
      rcsSource: { mode },
    }));
  };
  const applyPreset = (preset: RadarSimulationRequest["preset"]) => {
    setRequest((current) => ({
      ...current,
      preset,
      targets: radarPresetTargets[preset],
    }));
  };

  return (
    <Panel title="RadarSim Workflow Console" action="configure stack -> characterize radar -> validate signal -> run scene pipeline">
      <div className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-radar/20 bg-radar/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-radar">
                  Radar Workbench / {radarModel.radarName}
                </div>
                <div className="mt-2 text-xl font-semibold text-white">
                  {radarModel.baseline} vs {radarModel.candidate}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-300">
                  {radarModel.scenarioSuite}
                </div>
              </div>
              <StatusBadge status="review" />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <SmallFact label="Execution" value={adapter.adapterStatus === "radarsim-whitebox" ? "RadarSim whitebox" : "fallback"} />
              <SmallFact label="Source" value={adapter.sourcePackage ?? "unknown"} />
              <SmallFact label="SciPy" value={adapter.scipyAvailable ? "available" : "missing"} />
              <SmallFact label="Oracle" value={adapter.oracleCaptureAvailable ? "available" : "not found"} />
            </div>
            <div className="mt-4 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
              {adapter.limitation}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Play size={16} className="text-radar" />
                RadarSim Live Run
              </div>
              <button type="button" className="primary-button" onClick={onRun} disabled={status === "running"}>
                {status === "running" ? "Running..." : "Run RadarSim"}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="text-xs font-semibold uppercase text-slate-500 sm:col-span-2">Scene / Targets</div>
              <label className="field-label">
                Scenario preset
                <select
                  className="field-input"
                  value={request.preset}
                  onChange={(event) => applyPreset(event.target.value as RadarSimulationRequest["preset"])}
                >
                  {Object.entries(radarPresetLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 text-[11px] leading-4 text-slate-500">
                  Higher Pfa lowers the CFAR threshold and can recover weak returns, but false alarms can increase.
                </span>
              </label>
              <label className="field-label">
                RCS source mode
                <select
                  className="field-input"
                  value={request.rcsSource?.mode ?? "scenarioAssumption"}
                  onChange={(event) => updateRcsSource(event.target.value as NonNullable<RadarSimulationRequest["rcsSource"]>["mode"])}
                >
                  <option value="scenarioAssumption">Scenario assumption</option>
                  <option value="radarsimMeshNormalized">RadarSim mesh RCS, normalized</option>
                </select>
              </label>
              <div className="rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion sm:col-span-2">
                {request.rcsSource?.mode === "radarsimMeshNormalized"
                  ? "Pd uses RadarSim sim_rcs-loaded canonical mesh assets, normalized to each asset's nominal dBsm. Raw mesh absolute dBsm is not treated as truth."
                  : "Pd uses scenario preset RCS assumptions. No mesh/RCS asset calculation is applied to Pd until mesh mode is selected."}
              </div>
              <div className="mt-2 text-xs font-semibold uppercase text-slate-500 sm:col-span-2">Waveform</div>
              <label className="field-label">
                Start frequency (GHz)
                <input
                  className="field-input"
                  type="number"
                  step="0.05"
                  value={request.waveform.startFrequencyGhz}
                  onChange={(event) => updateWaveform("startFrequencyGhz", Number(event.target.value))}
                />
              </label>
              <label className="field-label">
                Stop frequency (GHz)
                <input
                  className="field-input"
                  type="number"
                  step="0.05"
                  value={request.waveform.stopFrequencyGhz}
                  onChange={(event) => updateWaveform("stopFrequencyGhz", Number(event.target.value))}
                />
              </label>
              <label className="field-label">
                Chirp duration (us)
                <input
                  className="field-input"
                  type="number"
                  step="1"
                  value={request.waveform.chirpDurationUs}
                  onChange={(event) => updateWaveform("chirpDurationUs", Number(event.target.value))}
                />
              </label>
              <label className="field-label">
                Pulses per frame
                <input
                  className="field-input"
                  type="number"
                  min={4}
                  max={96}
                  value={request.waveform.pulses}
                  onChange={(event) => updateWaveform("pulses", Number(event.target.value))}
                />
              </label>
              <label className="field-label">
                PRP (us)
                <input
                  className="field-input"
                  type="number"
                  step="1"
                  value={request.waveform.prpUs}
                  onChange={(event) => updateWaveform("prpUs", Number(event.target.value))}
                />
              </label>
              <label className="field-label">
                TX power (dBm)
                <input
                  className="field-input"
                  type="number"
                  step="1"
                  value={request.waveform.txPowerDbm}
                  onChange={(event) => updateWaveform("txPowerDbm", Number(event.target.value))}
                />
              </label>
              <div className="mt-2 text-xs font-semibold uppercase text-slate-500 sm:col-span-2">Receiver / Array</div>
              <label className="field-label">
                Sampling rate (MSps)
                <input
                  className="field-input"
                  type="number"
                  step="0.5"
                  value={request.receiver.samplingRateMsps}
                  onChange={(event) => updateReceiver("samplingRateMsps", Number(event.target.value))}
                />
              </label>
              <label className="field-label">
                Noise figure (dB)
                <input
                  className="field-input"
                  type="number"
                  step="0.5"
                  value={request.receiver.noiseFigureDb}
                  onChange={(event) => updateReceiver("noiseFigureDb", Number(event.target.value))}
                />
              </label>
              <label className="field-label">
                TX / RX channels
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="field-input"
                    type="number"
                    min={1}
                    max={4}
                    value={request.array.txChannels}
                    onChange={(event) => updateArray("txChannels", Number(event.target.value))}
                  />
                  <input
                    className="field-input"
                    type="number"
                    min={1}
                    max={4}
                    value={request.array.rxChannels}
                    onChange={(event) => updateArray("rxChannels", Number(event.target.value))}
                  />
                </div>
              </label>
              <label className="field-label">
                MIMO modulation
                <select
                  className="field-input"
                  value={request.mimo?.mode ?? "tdm"}
                  onChange={(event) => updateMimoMode(event.target.value as NonNullable<RadarSimulationRequest["mimo"]>["mode"])}
                >
                  <option value="tdm">TDM, one TX per pulse</option>
                  <option value="tpmBpm">TPM/BPM phase-coded</option>
                </select>
                <span className="mt-1 text-[11px] leading-4 text-slate-500">
                  TPM is mapped to RadarSim BPM phase-code helpers in the current adapter.
                </span>
              </label>
              <label className="field-label">
                TX / RX spacing (m)
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="field-input"
                    type="number"
                    step="0.001"
                    value={request.array.txSpacingM}
                    onChange={(event) => updateArray("txSpacingM", Number(event.target.value))}
                  />
                  <input
                    className="field-input"
                    type="number"
                    step="0.001"
                    value={request.array.rxSpacingM}
                    onChange={(event) => updateArray("rxSpacingM", Number(event.target.value))}
                  />
                </div>
                <span className="mt-1 text-[11px] leading-4 text-slate-500">
                  Default uses 76GHz lambda/2 RX spacing and 2x RX spacing for TDM-MIMO virtual array.
                </span>
              </label>
              <div className="mt-2 text-xs font-semibold uppercase text-slate-500 sm:col-span-2">Detection / CFAR</div>
              <label className="field-label">
                CFAR Pfa (prob.)
                <select
                  className="field-input"
                  value={String(request.cfar.pfa)}
                  onChange={(event) => updateCfar("pfa", Number(event.target.value))}
                >
                  {[1e-5, 3e-5, 1e-4, 3e-4, 1e-3, 1e-2].map((value) => (
                    <option key={value} value={value}>
                      {value.toExponential(0)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Guard / training cells (cells)
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="field-input"
                    type="number"
                    min={1}
                    max={4}
                    value={request.cfar.guard}
                    onChange={(event) => updateCfar("guard", Number(event.target.value))}
                  />
                  <input
                    className="field-input"
                    type="number"
                    min={1}
                    max={6}
                    value={request.cfar.trailing}
                    onChange={(event) => updateCfar("trailing", Number(event.target.value))}
                  />
                </div>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {request.targets.map((target) => (
                <span key={`${target.label}-${target.rangeM}`} className="code-chip">
                  {target.label}: {target.rangeM}m / {target.radialVelocityMps}m/s / {target.rcsDbsm}dBsm
                </span>
              ))}
            </div>
            {result && (
              <div className="mt-3 rounded-xl border border-radar/20 bg-radar/10 p-3 text-xs leading-5 text-radar">
                <div>
                  Completed {result.runId} in {result.elapsedMs ?? "-"}ms. Baseband{" "}
                  {Array.isArray(result.summaries?.basebandShape) ? result.summaries?.basebandShape.join("x") : "shape unavailable"}.
                </div>
                {result.artifacts?.resultJson && (
                  <a
                    href={result.artifacts.resultJson.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 font-semibold text-radar underline-offset-4 hover:underline"
                  >
                    <FileText size={13} />
                    Open saved run JSON
                  </a>
                )}
              </div>
            )}
            {result?.warnings?.length ? (
              <div className="mt-3 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
                {result.warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            ) : null}
            {error && (
              <div className="mt-3 rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-xs leading-5 text-rose-200">
                {error}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Settings2 size={16} className="text-radar" />
              Radar Stack Config
            </div>
            <div className="space-y-2">
              {primaryGroups.flatMap((group) => groupedChanges[group] ?? []).slice(0, 8).map((change) => (
                <div key={`${change.group}-${change.parameter}`} className="config-change-row">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white">{change.parameter}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {change.baseline} -&gt; {change.candidate}
                    </div>
                  </div>
                  <RadarFeasibilityBadge feasibility={change.feasibility} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            {radarModel.kpis.slice(0, 4).map((kpi) => (
              <MetricTile key={kpi.label} label={kpi.label} value={kpi.value} delta={kpi.delta} tone={kpi.tone} />
            ))}
          </div>

          <RadarLiveConfigurationPreview request={request} result={result} />

          <div className="grid gap-3 md:grid-cols-4">
            {(
              [
                { label: "1. Characterize", text: "Pd/SNR, range, Doppler, azimuth, noise floor", active: true },
                { label: "2. Validate Signal", text: "sim_radar, Range-Doppler, CFAR, two-target separation", active: true },
                { label: "3. Run Scene", text: "targets, ghost, velocity timeline, failure buckets", active: true },
                { label: "4. Fusion Impact", text: "accepted/rejected, radar-only TP, ghost accepted", active: false },
              ]
            ).map((step) => (
              <div key={step.label} className={`validation-mode-card ${step.active ? "radar-mode-active" : ""}`}>
                <div className="text-sm font-semibold text-white">{step.label}</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">{step.text}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-fusion/30 bg-fusion/10 p-4 text-sm leading-6 text-fusion">
            <div className="mb-1 flex items-center gap-2 font-semibold text-white">
              <AlertTriangle size={16} className="text-fusion" />
              Data fidelity rule
            </div>
            {radarModel.fidelityWarning}
          </div>

          <RadarEvidenceBoundaryCard result={result} />

          <RadarRcsAssetLibraryCard />

          <div className="grid gap-2 sm:grid-cols-3">
            {radarModel.dataFidelity.map((fidelity) => (
              <DataFidelityCard key={fidelity} fidelity={fidelity} active />
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

const radarSpeedOfLightMps = 299_792_458;

function getRadarDerivedPreview(request: RadarSimulationRequest) {
  const centerFrequencyGhz = (request.waveform.startFrequencyGhz + request.waveform.stopFrequencyGhz) / 2;
  const centerFrequencyHz = Math.max(centerFrequencyGhz * 1e9, 1);
  const wavelengthM = radarSpeedOfLightMps / centerFrequencyHz;
  const bandwidthHz = Math.max((request.waveform.stopFrequencyGhz - request.waveform.startFrequencyGhz) * 1e9, 1);
  const chirpDurationS = Math.max(request.waveform.chirpDurationUs * 1e-6, 1e-9);
  const prpS = Math.max(request.waveform.prpUs * 1e-6, chirpDurationS);
  const slopeHzPerS = bandwidthHz / chirpDurationS;
  const rangeResolutionM = radarSpeedOfLightMps / (2 * bandwidthHz);
  const maxVelocityMps = wavelengthM / (4 * prpS);
  const samplesPerChirp = Math.max(1, Math.round(request.receiver.samplingRateMsps * 1e6 * chirpDurationS));
  const nyquistMhz = request.receiver.samplingRateMsps / 2;
  const maxTargetRangeM = Math.max(...request.targets.map((target) => target.rangeM), 1);
  const maxBeatMhz = (2 * slopeHzPerS * maxTargetRangeM) / radarSpeedOfLightMps / 1e6;
  const maxSamplingRangeM = (radarSpeedOfLightMps * nyquistMhz * 1e6) / (2 * slopeHzPerS);
  const txSpacingRisk = request.array.txSpacingM > wavelengthM / 2;
  const rxSpacingRisk = request.array.rxSpacingM > wavelengthM / 2;
  const txApertureM = Math.max(0, (request.array.txChannels - 1) * request.array.txSpacingM);
  const rxApertureM = Math.max(0, (request.array.rxChannels - 1) * request.array.rxSpacingM);
  const virtualPositions = Array.from({ length: request.array.txChannels }, (_, txIndex) => {
    const txOffset = (txIndex - (request.array.txChannels - 1) / 2) * request.array.txSpacingM;
    return Array.from({ length: request.array.rxChannels }, (_, rxIndex) => {
      const rxOffset = (rxIndex - (request.array.rxChannels - 1) / 2) * request.array.rxSpacingM;
      return txOffset + rxOffset;
    });
  }).flat();
  const virtualApertureM = Math.max(...virtualPositions) - Math.min(...virtualPositions || [0]);
  const angularResolutionDeg =
    virtualApertureM > 0 ? (0.886 * wavelengthM) / virtualApertureM * (180 / Math.PI) : 180;

  return {
    centerFrequencyGhz,
    wavelengthM,
    bandwidthHz,
    chirpDurationS,
    prpS,
    slopeHzPerS,
    rangeResolutionM,
    maxVelocityMps,
    samplesPerChirp,
    nyquistMhz,
    maxBeatMhz,
    maxSamplingRangeM,
    txSpacingRisk,
    rxSpacingRisk,
    txApertureM,
    rxApertureM,
    virtualPositions,
    virtualApertureM,
    angularResolutionDeg,
  };
}

function getRadarMimoPulsePreview(request: RadarSimulationRequest) {
  const txCount = Math.max(1, request.array.txChannels);
  const previewCount = Math.min(request.waveform.pulses, 8);
  return Array.from({ length: previewCount }, (_, pulseIndex) => {
    const tdmTx = (pulseIndex % txCount) + 1;
    const phases = Array.from({ length: txCount }, (_, txIndex) => {
      if (txIndex === 0) return 0;
      return (pulseIndex + txIndex) % 2 === 0 ? 0 : 180;
    });
    return {
      pulse: pulseIndex + 1,
      tdmActive: `TX${tdmTx}`,
      tpmBpmActive: Array.from({ length: txCount }, (_, index) => `TX${index + 1}`).join(","),
      tpmBpmPhases: phases.map((phase, index) => `TX${index + 1}:${phase}`).join(" / "),
    };
  });
}

function RadarLiveConfigurationPreview({
  request,
  result,
}: {
  request: RadarSimulationRequest;
  result: RadarSimulationResult | null;
}) {
  const derived = getRadarDerivedPreview(request);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Live Configuration Preview</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">
            Pre-run visualization updates immediately from Scenario, Waveform, Receiver, Array, and CFAR settings.
          </div>
        </div>
        <span className="status-badge bg-radar/10 text-radar">pre-run design view</span>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <RadarScenarioGeometryPreview request={request} result={result} />
        <RadarWaveformPreview request={request} derived={derived} />
        <RadarArrayPreview request={request} derived={derived} />
        <RadarReceiverCfarPreview request={request} derived={derived} />
      </div>
    </div>
  );
}

function RadarScenarioGeometryPreview({
  request,
  result,
}: {
  request: RadarSimulationRequest;
  result: RadarSimulationResult | null;
}) {
  const associations = result?.rangeDopplerCfar?.targetAssociations ?? [];
  const maxRange = Math.max(120, ...request.targets.map((target) => target.rangeM + 12));
  const maxLateral = Math.max(6, ...request.targets.map((target) => Math.abs(target.azimuthM) + 1));
  const width = 360;
  const height = 250;
  const originX = width / 2;
  const originY = height - 28;
  const lateralPxPerM = 145 / maxLateral;
  const rangePxPerM = 190 / maxRange;
  const mapTarget = (rangeM: number, lateralM: number) => ({
    x: originX + lateralM * lateralPxPerM,
    y: originY - rangeM * rangePxPerM,
  });
  const getTargetClass = (target: RadarSimulationRequest["targets"][number]) => {
    if (target.semanticClass) return target.semanticClass;
    const label = target.label.toLowerCase();
    if (label.includes("guardrail")) return "guardrail";
    if (label.includes("pedestrian")) return "pedestrian";
    if (label.includes("cyclist")) return "cyclist";
    if (label.includes("rain") || label.includes("clutter")) return "clutter";
    if (target.ghost) return "ghost";
    return "vehicle";
  };
  const getFootprintSize = (target: RadarSimulationRequest["targets"][number]) => {
    const targetClass = getTargetClass(target);
    if (target.lengthM && target.widthM) return { lengthM: target.lengthM, widthM: target.widthM };
    if (targetClass === "pedestrian") return { lengthM: 0.7, widthM: 0.55 };
    if (targetClass === "cyclist") return { lengthM: 1.8, widthM: 0.7 };
    if (targetClass === "guardrail") return { lengthM: 14, widthM: 0.35 };
    if (targetClass === "clutter") return { lengthM: 2.8, widthM: 2.8 };
    return { lengthM: 4.7, widthM: 1.9 };
  };

  return (
      <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-white">Scenario Target Geometry</div>
        <span className="status-badge bg-white/10 text-slate-300">point return preview</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[250px] w-full rounded-xl border border-white/10 bg-ink-950/80">
        <defs>
          <linearGradient id="radarFovGradient" x1="0" x2="0" y1="1" y2="0">
            <stop offset="0%" stopColor="rgba(46,245,169,0.22)" />
            <stop offset="100%" stopColor="rgba(46,245,169,0.02)" />
          </linearGradient>
          <marker id="radarVelocityArrow" markerHeight="6" markerWidth="6" orient="auto" refX="5" refY="3">
            <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
          </marker>
        </defs>
        <polygon
          points={`${originX},${originY} ${originX - 150},${originY - 188} ${originX + 150},${originY - 188}`}
          fill="url(#radarFovGradient)"
          stroke="rgba(46,245,169,0.32)"
        />
        {[30, 60, 90, 120].map((range) => {
          const y = originY - (range / maxRange) * 190;
          return (
            <g key={range}>
              <line x1={36} x2={width - 36} y1={y} y2={y} stroke="rgba(148,163,184,0.14)" strokeDasharray="4 5" />
              <text x={42} y={y - 4} fill="#64748b" fontSize="10">
                {range}m
              </text>
            </g>
          );
        })}
        <rect x={originX - 16} y={originY - 22} width={32} height={42} rx={8} fill="rgba(0,229,255,0.10)" stroke="rgba(0,229,255,0.55)" />
        <text x={originX} y={originY + 34} fill="#94a3b8" fontSize="10" textAnchor="middle">
          radar
        </text>
        {request.targets.map((target) => {
          const point = mapTarget(target.rangeM, target.azimuthM);
          const association = associations.find((item) => item.label === target.label);
          const targetClass = getTargetClass(target);
          const footprint = getFootprintSize(target);
          const color = target.ghost ? "#fb7185" : association?.outcome === "hit" ? "#2ef5a9" : association ? "#f2c85b" : "#00e5ff";
          const returnRadius = 3.5;
          const rcsHaloRadius = Math.max(6, Math.min(15, 7 + target.rcsDbsm / 3));
          const velocityScale = Math.max(-24, Math.min(24, target.radialVelocityMps * -1.4));
          return (
            <g key={target.label}>
              <title>
                {target.label}: {targetClass}, metadata size {footprint.lengthM}m x {footprint.widthM}m, RCS {target.rcsDbsm} dBsm
              </title>
              <line x1={point.x} x2={point.x} y1={point.y} y2={point.y + velocityScale} stroke={color} strokeWidth="1.8" markerEnd="url(#radarVelocityArrow)" />
              <circle cx={point.x} cy={point.y} r={rcsHaloRadius} fill={color} opacity="0.12" />
              {target.ghost && <circle cx={point.x} cy={point.y} r={rcsHaloRadius + 3} fill="none" stroke={color} strokeDasharray="3 3" strokeWidth="1.2" opacity="0.72" />}
              <circle cx={point.x} cy={point.y} r={returnRadius} fill={color} opacity="0.95" />
              <text x={point.x + 9} y={point.y - 9} fill="#e2e8f0" fontSize="10">
                {target.label}
              </text>
              {association && (
                <text x={point.x + 9} y={point.y + 5} fill={color} fontSize="10">
                  {association.outcome}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 grid gap-2 text-xs leading-5 text-slate-500 sm:grid-cols-2">
        <span>Map draws point-return centers only; object size stays as scenario metadata.</span>
        <span>Halo = RCS strength, arrow = radial velocity, dashed ring = ghost candidate.</span>
      </div>
    </div>
  );
}

function RadarWaveformPreview({
  request,
  derived,
}: {
  request: RadarSimulationRequest;
  derived: ReturnType<typeof getRadarDerivedPreview>;
}) {
  const pulsePreviewCount = Math.min(request.waveform.pulses, 14);
  const timelineWidth = 360;
  const timelineHeight = 92;
  const timelineLeft = 28;
  const timelineRight = 332;
  const timelineTop = 24;
  const timelineBottom = 66;
  const timelineInnerWidth = timelineRight - timelineLeft;
  const pulseSlotWidth = timelineInnerWidth / pulsePreviewCount;
  const chirpFillRatio = Math.max(0.08, Math.min(0.92, request.waveform.chirpDurationUs / request.waveform.prpUs));
  const frameDurationUs = request.waveform.pulses * request.waveform.prpUs;
  const idleTimeUs = Math.max(request.waveform.prpUs - request.waveform.chirpDurationUs, 0);
  const dutyCyclePercent = (request.waveform.chirpDurationUs / request.waveform.prpUs) * 100;
  const centerFrequencyGhz = (request.waveform.startFrequencyGhz + request.waveform.stopFrequencyGhz) / 2;
  const chirpTicksUs = [0, request.waveform.chirpDurationUs / 2, request.waveform.chirpDurationUs];
  const frequencyTicksGhz = [request.waveform.startFrequencyGhz, centerFrequencyGhz, request.waveform.stopFrequencyGhz];
  const chirpData = Array.from({ length: 18 }, (_, index) => {
    const t = (request.waveform.chirpDurationUs / 17) * index;
    const frequency =
      request.waveform.startFrequencyGhz +
      ((request.waveform.stopFrequencyGhz - request.waveform.startFrequencyGhz) * index) / 17;
    return { t: Number(t.toFixed(2)), frequency: Number(frequency.toFixed(4)) };
  });
  const pulseData = Array.from({ length: pulsePreviewCount }, (_, index) => ({ pulse: index + 1 }));

  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">Waveform Shape</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">Single chirp frequency sweep, then chirp repetition inside one radar frame.</div>
        </div>
        <span className="status-badge bg-radar/10 text-radar">FMCW timing</span>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-slate-300">x: time inside chirp (us)</span>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-slate-300">y: frequency (GHz)</span>
        <span className="rounded-full border border-radar/20 bg-radar/10 px-2.5 py-1 text-radar">
          sweep {(derived.bandwidthHz / 1e6).toFixed(0)} MHz / {request.waveform.chirpDurationUs} us
        </span>
      </div>
      <div className="h-[176px]">
        <ResponsiveContainer width="100%" height="100%">
          <ReLineChart data={chirpData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.12)" />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, request.waveform.chirpDurationUs]}
              ticks={chirpTicksUs}
              stroke="#64748b"
              tickFormatter={(value) => `${Number(value).toFixed(0)} us`}
              tickMargin={8}
              minTickGap={12}
            />
            <YAxis
              stroke="#64748b"
              domain={[request.waveform.startFrequencyGhz, request.waveform.stopFrequencyGhz]}
              ticks={frequencyTicksGhz}
              tickFormatter={(value) => `${Number(value).toFixed(2)}`}
              width={48}
              tickMargin={6}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => [`${Number(value).toFixed(4)} GHz`, name === "frequency" ? "frequency" : name]}
              labelFormatter={(label) => `time ${label} us`}
            />
            <Line name="frequency" type="monotone" dataKey="frequency" stroke="#2ef5a9" strokeWidth={2} dot={false} />
          </ReLineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold uppercase text-slate-500">Frame timing: chirp train</span>
        <span className="rounded-full border border-radar/20 bg-radar/10 px-2.5 py-1 text-radar">PRP {request.waveform.prpUs} us</span>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-slate-300">
          active {request.waveform.chirpDurationUs} us + idle {idleTimeUs.toFixed(0)} us
        </span>
      </div>
      <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.035] p-2">
        <svg viewBox={`0 0 ${timelineWidth} ${timelineHeight}`} className="h-[92px] w-full">
          <line x1={timelineLeft} x2={timelineRight} y1={timelineBottom} y2={timelineBottom} stroke="rgba(148,163,184,0.22)" />
          {pulseData.map((item, index) => {
            const slotX = timelineLeft + index * pulseSlotWidth;
            const chirpWidth = Math.max(4, pulseSlotWidth * chirpFillRatio - 2);
            const nextX = slotX + pulseSlotWidth;
            return (
              <g key={item.pulse}>
                <rect x={slotX + 1} y={timelineTop} width={chirpWidth} height={timelineBottom - timelineTop} rx={3} fill="rgba(46,245,169,0.72)" />
                <line x1={slotX} x2={slotX} y1={timelineBottom + 3} y2={timelineBottom + 9} stroke="rgba(148,163,184,0.4)" />
                {index < pulsePreviewCount - 1 && (
                  <line x1={slotX + chirpWidth + 3} x2={nextX - 2} y1={timelineBottom - 8} y2={timelineBottom - 8} stroke="rgba(148,163,184,0.26)" strokeDasharray="3 3" />
                )}
              </g>
            );
          })}
          <line x1={timelineLeft} x2={timelineLeft + pulseSlotWidth} y1={timelineBottom + 18} y2={timelineBottom + 18} stroke="#2ef5a9" />
          <line x1={timelineLeft} x2={timelineLeft} y1={timelineBottom + 14} y2={timelineBottom + 22} stroke="#2ef5a9" />
          <line x1={timelineLeft + pulseSlotWidth} x2={timelineLeft + pulseSlotWidth} y1={timelineBottom + 14} y2={timelineBottom + 22} stroke="#2ef5a9" />
          <text x={timelineLeft + pulseSlotWidth / 2} y={timelineBottom + 34} fill="#2ef5a9" fontSize="10" textAnchor="middle">one PRP</text>
        </svg>
        <div className="grid gap-2 text-xs leading-5 text-slate-400 sm:grid-cols-2">
          <span>Green blocks = active chirp transmit time.</span>
          <span>Dashed gaps = idle time between chirps.</span>
          <span>Showing {pulsePreviewCount} of {request.waveform.pulses} chirps.</span>
          <span>One frame = {(frameDurationUs / 1000).toFixed(2)} ms.</span>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <SmallFact label="Bandwidth" value={`${(derived.bandwidthHz / 1e6).toFixed(0)} MHz`} />
        <SmallFact label="Slope" value={`${(derived.slopeHzPerS / 1e12).toFixed(2)} MHz/us`} />
        <SmallFact label="Range res" value={`${derived.rangeResolutionM.toFixed(2)} m`} />
        <SmallFact label="Max unambig. velocity" value={`${derived.maxVelocityMps.toFixed(1)} m/s`} />
        <SmallFact label="Frame time" value={`${(frameDurationUs / 1000).toFixed(2)} ms`} />
        <SmallFact label="Duty / idle" value={`${dutyCyclePercent.toFixed(0)}% / ${idleTimeUs.toFixed(0)} us`} />
      </div>
    </div>
  );
}

function RadarArrayPreview({
  request,
  derived,
}: {
  request: RadarSimulationRequest;
  derived: ReturnType<typeof getRadarDerivedPreview>;
}) {
  const width = 360;
  const height = 190;
  const centerX = width / 2;
  const scale = 230 / Math.max(derived.virtualApertureM, request.array.txSpacingM, request.array.rxSpacingM, 0.004);
  const txPositions = Array.from({ length: request.array.txChannels }, (_, index) => (index - (request.array.txChannels - 1) / 2) * request.array.txSpacingM);
  const rxPositions = Array.from({ length: request.array.rxChannels }, (_, index) => (index - (request.array.rxChannels - 1) / 2) * request.array.rxSpacingM);
  const toX = (value: number) => centerX + value * scale;
  const targetAngles = request.targets.map((target) => ({
    label: target.label.length > 10 ? `${target.label.slice(0, 10)}...` : target.label,
    angleDeg: Math.atan2(target.azimuthM, Math.max(target.rangeM, 0.1)) * (180 / Math.PI),
    ghost: Boolean(target.ghost),
  }));
  const angleResponseData = Array.from({ length: 101 }, (_, index) => {
    const angleDeg = -75 + index * 1.5;
    const steering = (2 * Math.PI * Math.sin((angleDeg * Math.PI) / 180)) / derived.wavelengthM;
    const real = derived.virtualPositions.reduce((sum, position) => sum + Math.cos(steering * position), 0);
    const imag = derived.virtualPositions.reduce((sum, position) => sum + Math.sin(steering * position), 0);
    const magnitude = Math.sqrt(real * real + imag * imag) / Math.max(derived.virtualPositions.length, 1);
    return {
      angleDeg,
      responseDb: Math.max(-40, 20 * Math.log10(Math.max(magnitude, 0.0001))),
    };
  });
  const sideLobePeaks = angleResponseData
    .slice(1, -1)
    .filter((point, index) => {
      const previous = angleResponseData[index];
      const next = angleResponseData[index + 2];
      return Math.abs(point.angleDeg) > Math.max(derived.angularResolutionDeg, 4) && point.responseDb > previous.responseDb && point.responseDb > next.responseDb;
    })
    .sort((a, b) => b.responseDb - a.responseDb);
  const strongestSideLobeDb = sideLobePeaks[0]?.responseDb ?? -40;
  const angleAmbiguityRisk = derived.txSpacingRisk || derived.rxSpacingRisk || strongestSideLobeDb > -6;
  const pulsePreview = getRadarMimoPulsePreview(request);
  const selectedMimoMode = request.mimo?.mode ?? "tdm";

  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">TX / RX / Virtual Array</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">
            Physical TX/RX spacing creates virtual sampling positions; selected pulse modulation is {selectedMimoMode === "tpmBpm" ? "TPM/BPM phase-coded" : "TDM"}.
          </div>
        </div>
        <span className={`status-badge ${angleAmbiguityRisk ? "bg-rose-300/10 text-rose-200" : "bg-radar/10 text-radar"}`}>
          {angleAmbiguityRisk ? "angle ambiguity risk" : "spacing ok"}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[190px] w-full rounded-xl border border-white/10 bg-ink-950/80">
        <line x1={40} x2={width - 40} y1={56} y2={56} stroke="rgba(148,163,184,0.2)" />
        <line x1={40} x2={width - 40} y1={102} y2={102} stroke="rgba(148,163,184,0.2)" />
        <line x1={40} x2={width - 40} y1={150} y2={150} stroke="rgba(148,163,184,0.2)" />
        <text x={42} y={44} fill="#64748b" fontSize="10">TX physical</text>
        <text x={42} y={90} fill="#64748b" fontSize="10">RX physical</text>
        <text x={42} y={138} fill="#64748b" fontSize="10">TX+RX virtual</text>
        {txPositions.map((pos, index) => (
          <circle key={`tx-${index}`} cx={toX(pos)} cy={56} r={7} fill="#2ef5a9" />
        ))}
        {rxPositions.map((pos, index) => (
          <rect key={`rx-${index}`} x={toX(pos) - 6} y={96} width={12} height={12} rx={3} fill="#00e5ff" />
        ))}
        {derived.virtualPositions.map((pos, index) => (
          <circle key={`virtual-${index}`} cx={toX(pos)} cy={150} r={4} fill="#f2c85b" opacity="0.82" />
        ))}
      </svg>
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase text-slate-500">Angle response preview</div>
          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-slate-300">normalized broadside array factor</span>
        </div>
        <div className="h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <ReLineChart data={angleResponseData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis
                dataKey="angleDeg"
                type="number"
                domain={[-75, 75]}
                ticks={[-60, -30, 0, 30, 60]}
                stroke="#64748b"
                tickFormatter={(value) => `${Number(value).toFixed(0)}deg`}
                tickMargin={8}
              />
              <YAxis
                stroke="#64748b"
                domain={[-40, 0]}
                ticks={[-40, -20, 0]}
                width={44}
                tickFormatter={(value) => `${Number(value).toFixed(0)}dB`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value) => [`${Number(value).toFixed(1)} dB`, "array response"]}
                labelFormatter={(label) => `angle ${Number(label).toFixed(1)} deg`}
              />
              <ReferenceLine x={0} stroke="rgba(242,200,91,0.65)" strokeDasharray="4 4" />
              {targetAngles.map((target) => (
                <ReferenceLine
                  key={`${target.label}-${target.angleDeg}`}
                  x={target.angleDeg}
                  stroke={target.ghost ? "rgba(251,113,133,0.62)" : "rgba(0,229,255,0.52)"}
                  strokeDasharray="2 4"
                />
              ))}
              <Line type="monotone" dataKey="responseDb" stroke="#f2c85b" strokeWidth={2} dot={false} />
            </ReLineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 grid gap-2 text-xs leading-5 text-slate-500 sm:grid-cols-2">
          <span>Peaks away from 0deg indicate possible grating or angle-alias ambiguity.</span>
          <span>Vertical markers show approximate target bearing from lateral/range geometry.</span>
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase text-slate-500">TDM vs TPM/BPM pulse preview</div>
          <span className="code-chip">{selectedMimoMode === "tpmBpm" ? "selected: TPM/BPM" : "selected: TDM"}</span>
        </div>
        <div className="grid gap-1 text-[11px] leading-4 text-slate-400">
          {pulsePreview.slice(0, 5).map((pulse) => (
            <div key={pulse.pulse} className="grid grid-cols-[44px_0.45fr_1fr] gap-2 rounded-lg border border-white/10 bg-black/10 px-2 py-1">
              <span className="font-semibold text-slate-300">P{pulse.pulse}</span>
              <span>TDM {pulse.tdmActive}</span>
              <span className="truncate">TPM/BPM {pulse.tpmBpmPhases}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[11px] leading-4 text-slate-500">
          TDM separates TX by pulse time. TPM/BPM keeps TXs active together and separates them by phase code in this whitebox adapter.
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <SmallFact label="Lambda" value={`${(derived.wavelengthM * 1000).toFixed(2)} mm`} />
        <SmallFact label="Lambda/2" value={`${(derived.wavelengthM * 500).toFixed(2)} mm`} />
        <SmallFact label="Virtual aperture" value={`${(derived.virtualApertureM * 1000).toFixed(1)} mm`} />
        <SmallFact label="Angle res est." value={`${derived.angularResolutionDeg.toFixed(1)} deg`} />
        <SmallFact label="Strongest side peak" value={`${strongestSideLobeDb.toFixed(1)} dB`} />
        <SmallFact label="Target bearings" value={targetAngles.map((target) => `${target.angleDeg.toFixed(1)}deg`).join(" / ")} />
      </div>
    </div>
  );
}

function RadarReceiverCfarPreview({
  request,
  derived,
}: {
  request: RadarSimulationRequest;
  derived: ReturnType<typeof getRadarDerivedPreview>;
}) {
  const beatData = request.targets.map((target) => ({
    label: target.label.length > 11 ? `${target.label.slice(0, 11)}...` : target.label,
    rangeM: target.rangeM,
    beatMhz: Number(((2 * derived.slopeHzPerS * target.rangeM) / radarSpeedOfLightMps / 1e6).toFixed(2)),
  }));
  const samplingAliasingRisk = derived.maxBeatMhz > derived.nyquistMhz;
  const yAxisMaxMhz = Math.max(derived.nyquistMhz, derived.maxBeatMhz, 1) * 1.18;
  const radius = request.cfar.guard + request.cfar.trailing;
  const size = radius * 2 + 1;
  const pfaMode =
    request.cfar.pfa <= 1e-4
      ? "strict threshold"
      : request.cfar.pfa >= 1e-3
        ? "loose threshold"
        : "balanced threshold";
  const pfaTradeoff =
    request.cfar.pfa <= 1e-4
      ? "Lower false alarms, but weak low-RCS targets can be missed."
      : request.cfar.pfa >= 1e-3
        ? "More weak detections, but ghost and clutter false alarms can increase."
        : "Middle setting between missed weak targets and false alarms.";
  const cells = Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size);
    const col = index % size;
    const center = radius;
    const rowDistance = Math.abs(row - center);
    const colDistance = Math.abs(col - center);
    const isCut = row === center && col === center;
    const isGuard = !isCut && rowDistance <= request.cfar.guard && colDistance <= request.cfar.guard;
    return { index, isCut, isGuard };
  });

  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">Receiver / Sampling / CFAR</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">Checks whether ADC sampling can capture target beat frequencies, then previews CFAR detection window.</div>
        </div>
        <span className={`status-badge ${samplingAliasingRisk ? "bg-rose-300/10 text-rose-200" : "bg-radar/10 text-radar"}`}>
          {samplingAliasingRisk ? "sampling alias risk" : "sampling ok"}
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase text-slate-500">Range Beat Frequency vs Nyquist</div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-radar/20 bg-radar/10 px-2.5 py-1 text-radar">bar = target range beat</span>
              <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-2.5 py-1 text-rose-200">dash = Nyquist limit</span>
            </div>
          </div>
          <div className="h-[178px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={beatData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" />
                <XAxis dataKey="label" stroke="#64748b" tickMargin={8} minTickGap={8} />
                <YAxis
                  stroke="#64748b"
                  domain={[0, yAxisMaxMhz]}
                  width={42}
                  tickFormatter={(value) => `${Number(value).toFixed(1)}`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`${Number(value).toFixed(2)} MHz`, "beat frequency"]}
                  labelFormatter={(label) => {
                    const row = beatData.find((item) => item.label === label);
                    return row ? `${label} · ${row.rangeM} m` : String(label);
                  }}
                />
                <ReferenceLine y={derived.nyquistMhz} stroke="rgba(251,113,133,0.75)" strokeDasharray="4 4" />
                <Bar dataKey="beatMhz" radius={[4, 4, 0, 0]}>
                  {beatData.map((item) => (
                    <Cell key={item.label} fill={item.beatMhz > derived.nyquistMhz ? "#fb7185" : "#2ef5a9"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs leading-5 text-slate-500">
            This is a sampling-feasibility check, not a detection-strength chart. Bars above Nyquist may alias into the wrong range bin.
          </div>
        </div>
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">CFAR Window Stencil</div>
              <div className="mt-1 text-[11px] leading-4 text-slate-500">x: range-bin offset, y: Doppler-bin offset</div>
            </div>
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs text-slate-300">{pfaMode}</span>
          </div>
          <div
            className="grid gap-1 rounded-xl border border-white/10 bg-white/[0.035] p-2"
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
          >
            {cells.map((cell) => (
              <span
                key={cell.index}
                className={`aspect-square rounded-sm ${cell.isCut ? "bg-fusion" : cell.isGuard ? "bg-slate-600" : "bg-radar/60"}`}
                title={cell.isCut ? "CUT" : cell.isGuard ? "guard cell" : "training cell"}
              />
            ))}
          </div>
          <div className="mt-2 grid gap-2 text-xs leading-5 text-slate-500">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-fusion" />CUT</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-600" />guard</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-radar/60" />training</span>
            </div>
            <div>This is not a data map. The stencil slides across the Range-Doppler grid; each visited cell becomes the CUT.</div>
            <div>Pfa {request.cfar.pfa.toExponential(0)}: {pfaTradeoff}</div>
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SmallFact label="Samples/chirp" value={String(derived.samplesPerChirp)} />
        <SmallFact label="Nyquist" value={`${derived.nyquistMhz.toFixed(1)} MHz`} />
        <SmallFact label="Max beat" value={`${derived.maxBeatMhz.toFixed(2)} MHz`} />
        <SmallFact label="Sampling range cap" value={`${derived.maxSamplingRangeM.toFixed(1)} m`} />
      </div>
    </div>
  );
}

function RadarRcsAssetLibraryCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Database size={16} className="text-radar" />
            Radar RCS Asset Library
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-400">
            Canonical mesh assets collected for RadarSim mesh-RCS experiments. These replace hidden hard-coded RCS assumptions with visible asset-backed inputs.
          </div>
        </div>
        <span className="status-badge bg-radar/10 text-radar">5 assets ready</span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SmallFact label="Engine" value={radarRcsAssetUsagePolicy.engine} />
        <SmallFact label="Source" value={radarRcsAssetUsagePolicy.source} />
        <SmallFact label="Root" value={radarRcsAssetLibraryRoot} />
      </div>

      <div className="mt-3 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
        {radarRcsAssetUsagePolicy.policy}
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-5">
        {radarRcsAssets.map((asset) => (
          <div key={asset.id} className="rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="text-sm font-semibold text-white">{asset.label}</div>
            <div className="mt-1 text-xs capitalize text-slate-500">{asset.assetClass.replace("_", " ")}</div>
            <div className="mt-3 space-y-1 text-xs leading-5 text-slate-300">
              <div>{asset.dimensionsM.length}m x {asset.dimensionsM.width}m x {asset.dimensionsM.height}m</div>
              <div>nominal {asset.nominalRcsDbsm} dBsm</div>
              <div className="text-slate-500">{asset.materialPreset}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <a className="code-chip hover:border-radar/60 hover:text-radar" href={asset.meshUrl} target="_blank" rel="noreferrer">
                OBJ
              </a>
              <a className="code-chip hover:border-radar/60 hover:text-radar" href={asset.metadataUrl} target="_blank" rel="noreferrer">
                JSON
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-xs leading-5 text-slate-500">
        Boundary: {radarRcsAssetUsagePolicy.boundary}
      </div>
    </div>
  );
}

function RadarEvidenceBoundaryCard({ result }: { result: RadarSimulationResult | null }) {
  const computed = result?.computedSections ?? [
    "RadarSim adapter not run yet",
    "Static fixture range-Doppler display",
  ];
  const proxy = result?.proxySections ?? [
    "Fusion contribution is reference data until fusion adapter is connected",
    "DOA/angle spectrum remains reference unless radar cube covariance replay is available",
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <ShieldCheck size={16} className="text-radar" />
        Evidence Boundary
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-radar/20 bg-radar/10 p-3">
          <div className="mb-2 text-xs font-semibold uppercase text-radar">Computed by run</div>
          <ul className="space-y-1 text-xs leading-5 text-slate-300">
            {computed.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-fusion/20 bg-fusion/10 p-3">
          <div className="mb-2 text-xs font-semibold uppercase text-fusion">Proxy / reference</div>
          <ul className="space-y-1 text-xs leading-5 text-slate-300">
            {proxy.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function RadarPrimaryResults({ radarModel, result }: { radarModel: RadarWorkbenchModel; result: RadarSimulationResult | null }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="1. Radar Stack Characterization" action="pre-scene RF / waveform / receiver evidence">
          <div className="grid gap-4 lg:grid-cols-2">
            <RadarDetectionProbabilityChart radarModel={radarModel} rcsSourceSummary={result?.rcsSourceSummary} />
            <RadarRocChart radarModel={radarModel} />
            <RadarDesignImpactCard radarModel={radarModel} />
            <RadarDoaChart radarModel={radarModel} />
          </div>
          <div className="mt-4">
            <RadarMimoComparisonPanel result={result} />
          </div>
        </Panel>

        <Panel title="2. Radar Signal Validation" action="sim_radar -> range_doppler_fft -> cfar_ca_2d">
          <div className="space-y-4">
            <RangeDopplerCfarPanel radarModel={radarModel} />
            <RadarPostCfarFilteringPanel radarModel={radarModel} />
            <RadarPeakAssociationPanel radarModel={radarModel} result={result} />
            <RadarProcessingChainList radarModel={radarModel} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="3. RadarSim Scene Pipeline Output" action="point-target scene -> baseband -> detections">
          <div className="mb-4 rounded-xl border border-radar/20 bg-radar/10 p-3 text-xs leading-5 text-slate-300">
            <span className="font-semibold text-radar">Computed scene run.</span> This section shows the selected
            RadarSim point-target scene after signal generation, Range-Doppler processing, CFAR association, velocity
            evidence, and parameter sensitivity. It is not yet a full road-mesh, material, multipath, or ray-traced
            environment pipeline.
          </div>
          <RadarSceneRunSummary radarModel={radarModel} result={result} />
          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <RadarViewer radarModel={radarModel} result={result} />
            <div className="space-y-4">
              <RadarVelocityChart radarModel={radarModel} />
              <RadarCfarSensitivityChart radarModel={radarModel} />
            </div>
          </div>
        </Panel>

        <Panel title="4. Radar Failure / Scene Review" action="scene-local; full attribution belongs in Fusion Analysis">
          <GhostHeatmap radarModel={radarModel} />
          <div className="mt-4 space-y-3">
            {radarModel.failureBuckets.slice(0, 3).map((bucket) => (
              <div key={bucket.name} className="data-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{bucket.name}</div>
                    <div className="mt-2 text-xs leading-5 text-slate-400">{bucket.impact}</div>
                  </div>
                  <SeverityBadge severity={bucket.severity} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function RadarFusionFailureSummary({ radarModel, result }: { radarModel: RadarWorkbenchModel; result: RadarSimulationResult | null }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <Panel title="Radar -> Fusion Impact Reference" action="not live-computed until fusion adapter is connected">
        <div className="mb-4 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
          {result
            ? "RadarSim live run currently stops at radar signal/CFAR evidence. Fusion contribution remains reference data until a fusion adapter consumes radar objects/tracks."
            : "Reference-only fusion view. Run RadarSim for signal evidence; fusion attribution requires a separate adapter."}
        </div>
        <RadarFusionContributionChart radarModel={radarModel} />
      </Panel>
      <Panel title="Radar Design Recommendation" action="decision summary">
        <div className="grid gap-3 md:grid-cols-2">
          <SpecGroup title="Design benefit" items={radarModel.designImpact.benefits} icon={<BadgeCheck size={17} />} />
          <SpecGroup title="Risk / trade-off" items={radarModel.designImpact.risks} icon={<AlertTriangle size={17} />} />
        </div>
        <div className="mt-3 rounded-xl border border-radar/25 bg-radar/10 p-4 text-sm leading-6 text-slate-200">
          <div className="mb-1 font-semibold text-radar">Recommendation</div>
          {radarModel.designImpact.recommendation}
        </div>
      </Panel>
    </div>
  );
}

function RadarSceneRunSummary({ radarModel, result }: { radarModel: RadarWorkbenchModel; result: RadarSimulationResult | null }) {
  const summary = radarModel.rangeDopplerCfar.detectionSummary;
  const associations = radarModel.rangeDopplerCfar.targetAssociations ?? [];
  const suppressedGhosts = associations.filter((association) => association.outcome === "ghost-suppressed").length;
  const falseGhosts = associations.filter((association) => association.outcome === "ghost-false-alarm").length;
  const request = result?.request;
  const derived = request ? getRadarDerivedPreview(request) : null;
  const bestCellMarginDb = radarModel.rangeDopplerCfar.cells.reduce(
    (best, cell) => Math.max(best, cell.powerDb - cell.cfarThresholdDb),
    Number.NEGATIVE_INFINITY
  );
  const completed = result?.status === "completed";
  const failed = result?.status === "failed";
  const noDetections = completed && summary && summary.cfarPeaks === 0;
  const diagnosis = [
    ...(derived && derived.maxBeatMhz > derived.nyquistMhz
      ? [
          {
            label: "Sampling alias risk",
            value: `${derived.maxBeatMhz.toFixed(2)} MHz beat > ${derived.nyquistMhz.toFixed(2)} MHz Nyquist`,
            note: `For this chirp slope and ${Math.max(...(request?.targets.map((target) => target.rangeM) ?? [0])).toFixed(0)} m scene, use higher sampling rate or lower chirp slope.`,
            tone: "bad" as const,
          },
        ]
      : derived
        ? [
            {
              label: "Sampling",
              value: `${derived.maxBeatMhz.toFixed(2)} MHz beat <= ${derived.nyquistMhz.toFixed(2)} MHz Nyquist`,
              note: "Beat-frequency placement is inside the current sampling range.",
              tone: "good" as const,
            },
          ]
        : []),
    ...(request && request.cfar.pfa <= 1e-4
      ? [
          {
            label: "Strict CFAR",
            value: `Pfa ${request.cfar.pfa.toExponential(0)}`,
            note: "This favors low false alarms; weak or aliased returns can remain below threshold.",
            tone: "warn" as const,
          },
        ]
      : request && request.cfar.pfa >= 1e-3
        ? [
            {
              label: "Lower CFAR threshold",
              value: `Pfa ${request.cfar.pfa.toExponential(0)}`,
              note: "Weak returns are easier to promote to detections, but false alarms and ghost acceptance must be watched.",
              tone: "warn" as const,
            },
          ]
      : request
        ? [
            {
              label: "CFAR threshold",
              value: `Pfa ${request.cfar.pfa.toExponential(0)}`,
              note: "Looser Pfa can recover weak returns, but false alarms and ghost acceptance may increase.",
              tone: "neutral" as const,
            },
          ]
        : []),
    ...(Number.isFinite(bestCellMarginDb)
      ? [
          {
            label: "Best cell margin",
            value: `${bestCellMarginDb.toFixed(1)} dB vs CFAR`,
            note:
              bestCellMarginDb >= 0
                ? "At least one displayed cell is above threshold."
                : "No displayed cell crossed threshold; the strongest return is still below CFAR.",
            tone: bestCellMarginDb >= 0 ? ("good" as const) : ("bad" as const),
          },
        ]
      : []),
    ...(result?.adapter?.whiteboxSimulatorAvailable
      ? [
          {
            label: "Commercial radar boundary",
            value: "whitebox point-target",
            note: "This is not calibrated production radar evidence; antenna gain, vendor DSP, and measured noise are not fully modeled.",
            tone: "neutral" as const,
          },
        ]
      : []),
  ];
  const toneClass = failed
    ? "border-rose-300/30 bg-rose-300/10 text-rose-100"
    : noDetections
      ? "border-fusion/30 bg-fusion/10 text-fusion"
      : completed
        ? "border-radar/30 bg-radar/10 text-radar"
        : "border-white/10 bg-white/[0.035] text-slate-300";
  const interpretation = failed
    ? result?.reason ?? result?.error ?? "RadarSim run failed before producing scene evidence."
    : noDetections
      ? "Run completed, but CFAR declared zero detections. The target returns are present as simulated truth markers, but the selected threshold/SNR/bin gate did not promote them to detections."
      : completed
        ? "Run completed and scene evidence is populated from the active RadarSim result."
        : "Waiting for Run RadarSim. Until then this section will not invent target detections.";

  return (
    <div className={`mb-4 rounded-xl border p-3 ${toneClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            {completed ? "RadarSim run result" : failed ? "RadarSim run failed" : "RadarSim not run yet"}
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-300">{interpretation}</div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">
            {completed ? `${result?.elapsedMs ?? "-"} ms` : "pending"}
          </span>
          {result?.runId && <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">{result.runId}</span>}
        </div>
      </div>
      {summary && (
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          <SmallFact label="CFAR peaks" value={String(summary.cfarPeaks)} />
          <SmallFact label="Truth hits" value={String(summary.hits)} />
          <SmallFact label="Truth misses" value={String(summary.misses)} />
          <SmallFact label="Ghost suppressed" value={String(suppressedGhosts)} />
          <SmallFact label="Ghost false alarms" value={String(falseGhosts)} />
        </div>
      )}
      {diagnosis.length > 0 && (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {diagnosis.map((item) => (
            <div key={item.label} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    item.tone === "good"
                      ? "border-radar/20 bg-radar/10 text-radar"
                      : item.tone === "bad"
                        ? "border-rose-300/20 bg-rose-300/10 text-rose-200"
                        : item.tone === "warn"
                          ? "border-fusion/20 bg-fusion/10 text-fusion"
                          : "border-white/10 bg-white/[0.035] text-slate-300"
                  }`}
                >
                  {item.value}
                </span>
              </div>
              <div className="mt-2 text-xs leading-5 text-slate-400">{item.note}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RadarAdvancedReferencePanel({
  radarModel,
  groupedChanges,
}: {
  radarModel: RadarWorkbenchModel;
  groupedChanges: Record<string, RadarWorkbenchModel["configChanges"]>;
}) {
  return (
    <details className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-semibold text-white">Advanced / Reference</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">
            Data fidelity matrix, full feasibility table, adapter function coverage, output contract, and storage strategy.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="status-badge bg-white/10 text-slate-300">collapsed reference</span>
          <ChevronDown size={16} className="text-slate-400" />
        </div>
      </summary>

      <div className="space-y-5 border-t border-white/10 p-4">
        <Panel title="Radar Role / Validation Modes" action="fidelity-aware radar pipeline">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-radar/20 bg-radar/10 p-4">
              <div className="grid gap-3 md:grid-cols-4">
                {(
                  [
                    "Detection / Track Replay",
                    "Signal Processing Replay",
                    "Signal-level Simulation",
                    "Physical Validation",
                  ] as const
                ).map((mode) => (
                  <div
                    key={mode}
                    className={`validation-mode-card ${
                      radarModel.validationMode === mode ? "radar-mode-active" : ""
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{mode}</div>
                    <div className="mt-2 text-xs leading-5 text-slate-400">
                      {mode === "Detection / Track Replay"
                        ? "points, clusters, tracks, fusion gates"
                        : mode === "Signal Processing Replay"
                          ? "Range-Doppler, radar cube, raw IQ"
                          : mode === "Signal-level Simulation"
                            ? "RF, waveform, antenna, multipath"
                            : "hardware, radome, bumper, weather"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <SpecGroup title="Radar Role" items={radarModel.role} icon={<RadioTower size={17} />} />
              <SpecGroup title="Known Weakness" items={radarModel.knownWeakness} icon={<AlertTriangle size={17} />} />
            </div>
          </div>
        </Panel>

        <Panel title="Data Fidelity">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {(
              [
                "Track only",
                "Point cloud",
                "Range-Doppler",
                "Radar cube",
                "Raw ADC/IQ",
                "Synthetic signal",
              ] as const
            ).map((fidelity) => (
              <DataFidelityCard
                key={fidelity}
                fidelity={fidelity}
                active={radarModel.dataFidelity.includes(fidelity)}
              />
            ))}
          </div>
        </Panel>

        <RadarSimPyAdapterPanel radarModel={radarModel} />

        <Panel title="Configuration Diff / Re-evaluation Feasibility">
          <div className="grid gap-4 xl:grid-cols-2">
            {Object.entries(groupedChanges).map(([group, changes]) => (
              <div key={group} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                <div className="mb-3 text-sm font-semibold text-white">{group}</div>
                <div className="space-y-2">
                  {changes.map((change) => (
                    <div key={`${change.group}-${change.parameter}`} className="config-change-row">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white">{change.parameter}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {change.baseline} -&gt; {change.candidate}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">{change.impact}</div>
                        <div className="mt-2">
                          <DataFidelityBadge fidelity={change.requiredFidelity} />
                        </div>
                      </div>
                      <RadarFeasibilityBadge feasibility={change.feasibility} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <RadarReferenceTables radarModel={radarModel} />
      </div>
    </details>
  );
}

function RadarDetectionProbabilityChart({
  radarModel,
  rcsSourceSummary,
}: {
  radarModel: RadarWorkbenchModel;
  rcsSourceSummary?: RadarSimulationResult["rcsSourceSummary"];
}) {
  const sourceLabel = rcsSourceSummary?.label ?? "Scenario assumption RCS";
  const sourceBoundary =
    rcsSourceSummary?.boundary ??
    "Pd is computed from preset class RCS assumptions and RadarSim tools.roc_pd; no mesh RCS asset is applied.";
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">Detection Probability Estimate</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">Pd vs range using the selected RCS source and RadarSim ROC/Pd function.</div>
        </div>
        <span className="status-badge bg-radar/10 text-radar">{sourceLabel}</span>
      </div>
      <div className="h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <ReLineChart data={radarModel.detectionProbabilityByRange}>
            <CartesianGrid stroke="rgba(148,163,184,0.12)" />
            <XAxis dataKey="range" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="vehicle" stroke="#2ef5a9" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="pedestrian" stroke="#00e5ff" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="cyclist" stroke="#a568ff" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="motorcycle" stroke="#f2c85b" strokeWidth={2} dot={false} />
          </ReLineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
        {sourceBoundary}
      </div>
    </div>
  );
}

function RadarRocChart({ radarModel }: { radarModel: RadarWorkbenchModel }) {
  const firstPoint = radarModel.rocPd[0] as { pfa?: number; npulses?: number; stype?: string } | undefined;
  const pfaLabel = firstPoint?.pfa ? Number(firstPoint.pfa).toExponential(0) : "selected Pfa";
  const pulseLabel = firstPoint?.npulses ?? "selected pulses";
  const stypeLabel = firstPoint?.stype ?? "Coherent";
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">Pd vs SNR Reference Curve</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">Reference curve only: converts an assumed SNR into detection probability.</div>
        </div>
        <span className="status-badge bg-white/10 text-slate-300">not scene-specific</span>
      </div>
      <div className="h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <ReLineChart data={radarModel.rocPd}>
            <CartesianGrid stroke="rgba(148,163,184,0.12)" />
            <XAxis dataKey="snrDb" stroke="#64748b" />
            <YAxis stroke="#64748b" domain={[0, 100]} />
            <Tooltip contentStyle={tooltipStyle} />
            <ReferenceLine y={90} stroke="rgba(242,200,91,0.65)" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="pd" stroke="#2ef5a9" strokeWidth={2} dot={false} />
          </ReLineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-xs leading-5 text-slate-400">
        <div className="mb-2 font-semibold text-white">Model used</div>
        <code className="block overflow-x-auto rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-radar">
          tools.roc_pd(Pfa={pfaLabel}, SNR_dB=[-6..21], npulses={pulseLabel}, stype="{stypeLabel}")
        </code>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <span>Included: Pfa, pulse count, coherent detection model.</span>
          <span>Excluded: range, RCS, antenna, sampling, clutter, multipath, and scene geometry.</span>
        </div>
      </div>
    </div>
  );
}

function RadarDoaChart({ radarModel }: { radarModel: RadarWorkbenchModel }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="mb-3 text-sm font-semibold text-white">DOA / Angle Spectrum</div>
      <div className="h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <ReLineChart data={radarModel.doaSpectrum}>
            <CartesianGrid stroke="rgba(148,163,184,0.12)" />
            <XAxis dataKey="angle" stroke="#64748b" />
            <YAxis stroke="#64748b" domain={[0, 100]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="bartlett" stroke="#2ef5a9" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="capon" stroke="#00e5ff" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="music" stroke="#a568ff" strokeWidth={2} dot={false} />
          </ReLineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-500">
        Computed from simulated channel covariance using RadarSim processing DOA functions.
      </div>
    </div>
  );
}

function RadarDesignImpactCard({ radarModel }: { radarModel: RadarWorkbenchModel }) {
  return (
    <div className="rounded-xl border border-radar/20 bg-radar/10 p-3">
      <div className="mb-3 text-sm font-semibold text-white">Characterization Summary</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {radarModel.kpis.slice(4, 8).map((kpi) => (
          <SmallFact key={kpi.label} label={kpi.label} value={`${kpi.value} · ${kpi.delta}`} />
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-300">
        Radar characterization is pre-scene evidence: it explains sensor/waveform behavior before scenario-specific
        ghost, clustering, and fusion decisions are inspected.
      </div>
    </div>
  );
}

function RadarProcessingChainList({ radarModel }: { radarModel: RadarWorkbenchModel }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="mb-3 text-sm font-semibold text-white">RadarSim Processing Chain</div>
      <div className="space-y-2">
        {radarModel.signalProcessingChain.map((stage) => (
          <div key={`${stage.stage}-${stage.functionName}`} className="compact-row">
            <Activity size={15} className="text-radar" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white">{stage.stage}</div>
              <div className="text-xs text-slate-500">
                {stage.functionName} · {stage.output}
              </div>
            </div>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${radarFunctionStatusClass(stage.status)}`}>
              {stage.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RadarVelocityChart({ radarModel }: { radarModel: RadarWorkbenchModel }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="mb-3 text-sm font-semibold text-white">Velocity Accuracy Timeline</div>
      <div className="h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <ReLineChart data={radarModel.velocityTimeline}>
            <CartesianGrid stroke="rgba(148,163,184,0.12)" />
            <XAxis dataKey="time" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="groundTruth" stroke="#f2c85b" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="radar" stroke="#2ef5a9" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="fusion" stroke="#00e5ff" strokeWidth={2} dot={false} />
          </ReLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RadarCfarSensitivityChart({ radarModel }: { radarModel: RadarWorkbenchModel }) {
  const sweepRows = radarModel.cfarSensitivity.map((row) => ({
    ...row,
    sweepLabel: row.label ?? row.pfa,
  }));
  const recommended =
    radarModel.cfarSensitivity.find((row) => row.recommended) ??
    [...radarModel.cfarSensitivity].sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))[0];
  const topRows = [...radarModel.cfarSensitivity]
    .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
    .slice(0, 3);

  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">CFAR Sweep: Pfa x Guard / Training</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">
            Same RadarSim baseband, reprocessed with multiple CFAR thresholds and window sizes.
          </div>
        </div>
        {recommended && (
          <span className="status-badge bg-radar/10 text-radar">
            best score {recommended.label ?? recommended.pfa}
          </span>
        )}
      </div>
      <div className="h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <ReLineChart data={sweepRows}>
            <CartesianGrid stroke="rgba(148,163,184,0.12)" />
            <XAxis dataKey="sweepLabel" stroke="#64748b" minTickGap={10} tick={{ fontSize: 10 }} />
            <YAxis stroke="#64748b" />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="detectionRecall" stroke="#2ef5a9" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="falseAlarm" stroke="#f2c85b" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ghostRate" stroke="#fb7185" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="fusionFalseTrack" stroke="#a568ff" strokeWidth={2} dot={false} />
          </ReLineChart>
        </ResponsiveContainer>
      </div>
      {topRows.length > 0 && (
        <div className="mt-3 grid gap-2">
          {topRows.map((row) => (
            <div key={row.label ?? row.pfa} className="rounded-lg border border-white/10 bg-white/[0.035] p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-white">{row.label ?? row.pfa}</div>
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-slate-300">
                  score {row.score ?? "-"}
                </span>
              </div>
              <div className="mt-1 text-[11px] leading-4 text-slate-500">
                recall {row.detectionRecall}% · false alarms {row.falseAlarm} · ghost {row.ghostRate}% · miss {row.misses ?? "-"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RadarFusionContributionChart({ radarModel }: { radarModel: RadarWorkbenchModel }) {
  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={radarModel.fusionContribution}>
          <CartesianGrid stroke="rgba(148,163,184,0.12)" />
          <XAxis dataKey="scenario" stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="accepted" fill="#2ef5a9" radius={[4, 4, 0, 0]} />
          <Bar dataKey="rejected" fill="#64748b" radius={[4, 4, 0, 0]} />
          <Bar dataKey="radarOnlyTp" fill="#00e5ff" radius={[4, 4, 0, 0]} />
          <Bar dataKey="ghostAccepted" fill="#fb7185" radius={[4, 4, 0, 0]} />
          <Bar dataKey="velocityImprovedTrack" fill="#f2c85b" radius={[4, 4, 0, 0]} />
          <Bar dataKey="conflict" fill="#a568ff" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RadarReferenceTables({ radarModel }: { radarModel: RadarWorkbenchModel }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Radar Output Contract">
        <div className="space-y-3">
          {radarModel.outputContract.map((contract) => (
            <div key={contract.level} className="data-card">
              <div className="mb-3 text-sm font-semibold text-white">{contract.level}</div>
              <div className="flex flex-wrap gap-2">
                {contract.fields.map((field) => (
                  <span key={field} className="code-chip">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
            Warning: Fusion stack v42 expects radial_velocity_covariance. Candidate output schema changes must preserve this field for comparable runs.
          </div>
        </div>
      </Panel>

      <Panel title="Artifact Storage Strategy">
        <div className="space-y-2">
          {radarModel.artifactLevels.map((artifact) => (
            <div key={artifact.level} className="compact-row">
              <Database size={15} className="text-radar" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">
                  {artifact.level}: {artifact.artifact}
                </div>
                <div className="text-xs text-slate-500">{artifact.useCase}</div>
              </div>
              <span className="text-right text-xs text-radar">{artifact.storagePolicy}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function DataFidelityCard({
  fidelity,
  active,
}: {
  fidelity: RadarDataFidelity;
  active: boolean;
}) {
  return (
    <div className={`data-fidelity-card ${active ? "data-fidelity-active" : ""}`}>
      <div className="text-sm font-semibold text-white">{fidelity}</div>
      <div className="mt-2 text-xs leading-5 text-slate-400">
        {fidelity === "Track only"
          ? "tracking/fusion replay only"
          : fidelity === "Point cloud"
            ? "filtering, clustering, object formation"
            : fidelity === "Range-Doppler"
              ? "CFAR, peak extraction, missed-detection analysis"
              : fidelity === "Radar cube"
                ? "angle estimation and beamforming replay"
                : fidelity === "Raw ADC/IQ"
                  ? "FFT, windowing, raw signal replay"
                  : "RF/waveform/antenna design simulation"}
      </div>
      <div className="mt-3">
        <DataFidelityBadge fidelity={fidelity} />
      </div>
    </div>
  );
}

function DataFidelityBadge({ fidelity }: { fidelity: RadarDataFidelity }) {
  const className =
    fidelity === "Track only"
      ? "border-slate-300/30 bg-slate-300/10 text-slate-300"
      : fidelity === "Point cloud"
        ? "border-radar/30 bg-radar/10 text-radar"
        : fidelity === "Range-Doppler"
          ? "border-camera/30 bg-camera/10 text-camera"
          : fidelity === "Radar cube"
            ? "border-lidar/30 bg-lidar/10 text-lidar"
            : fidelity === "Raw ADC/IQ"
              ? "border-fusion/30 bg-fusion/10 text-fusion"
              : "border-emerald-300/30 bg-emerald-300/10 text-emerald-300";

  return <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{fidelity}</span>;
}

function RadarSimPyAdapterPanel({ radarModel }: { radarModel: RadarWorkbenchModel }) {
  const adapter = radarModel.radarsimpyAdapter;
  const wiredCount = radarModel.radarsimpyFunctions.filter((item) => item.usedInWorkbench).length;

  return (
    <Panel title="RadarSimPy Adapter / Function Coverage" action={adapter.sourcePath}>
      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="rounded-xl border border-radar/20 bg-radar/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase text-radar">Adapter status</div>
              <div className="mt-2 text-xl font-semibold text-white">{adapter.adapterStatus}</div>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${adapter.whiteboxSimulatorAvailable || adapter.compiledSimulatorAvailable ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-300" : "border-fusion/30 bg-fusion/10 text-fusion"}`}>
              {adapter.whiteboxSimulatorAvailable
                ? "whitebox sim_radar ready"
                : adapter.compiledSimulatorAvailable
                  ? "compiled simulator ready"
                  : "simulator missing"}
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
            <SmallFact label="SciPy" value={adapter.scipyAvailable ? "available" : "not installed"} />
            <SmallFact label="Source package" value={adapter.sourcePackage ?? "unknown"} />
            <SmallFact label="Functions mapped" value={`${wiredCount}/${radarModel.radarsimpyFunctions.length}`} />
            <SmallFact
              label="Execution"
              value={
                adapter.adapterStatus === "radarsim-whitebox"
                  ? "RadarSim whitebox"
                  : adapter.adapterStatus === "radarsimpy-processing"
                    ? "RadarSimPy processing"
                    : "NumPy fallback"
              }
            />
            <SmallFact label="Oracle capture" value={adapter.oracleCaptureAvailable ? "available" : "not found"} />
          </div>
          <div className="mt-4 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
            {adapter.limitation}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {radarModel.radarsimpyFunctions.map((item) => (
            <div key={`${item.module}-${item.name}`} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{item.name}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-slate-500">{item.module}</div>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${radarFunctionStatusClass(item.status)}`}>
                  {item.status}
                </span>
              </div>
              <div className="mt-3 text-xs leading-5 text-slate-400">{item.purpose}</div>
              <div className="mt-2 text-xs text-radar">{item.output}</div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function radarFunctionStatusClass(status: string) {
  if (status === "wired" || status === "radarsimpy-processing") {
    return "border-emerald-300/30 bg-emerald-300/10 text-emerald-300";
  }
  if (status === "numpy fallback" || status.includes("NumPy")) {
    return "border-camera/30 bg-camera/10 text-camera";
  }
  if (status === "requires compiled extension" || status === "requires scipy") {
    return "border-fusion/30 bg-fusion/10 text-fusion";
  }
  return "border-slate-300/30 bg-slate-300/10 text-slate-300";
}

function RadarFeasibilityBadge({
  feasibility,
}: {
  feasibility: RadarValidationFeasibility;
}) {
  const className =
    feasibility === "Replayable"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-300"
      : feasibility === "Reprocessable"
        ? "border-camera/30 bg-camera/10 text-camera"
        : feasibility === "Simulatable"
          ? "border-radar/30 bg-radar/10 text-radar"
          : feasibility === "Physical Required"
            ? "border-rose-300/30 bg-rose-300/10 text-rose-300"
            : "border-fusion/30 bg-fusion/10 text-fusion";

  return <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{feasibility}</span>;
}

function RangeDopplerCfarPanel({ radarModel }: { radarModel: RadarWorkbenchModel }) {
  const { axisSummary, cells, detectionSummary, rangeBins, facts } = radarModel.rangeDopplerCfar;
  const velocityTicks = axisSummary
    ? [
        `${axisSummary.radialVelocityMaxMps} m/s`,
        `${((axisSummary.radialVelocityMaxMps + axisSummary.radialVelocityMinMps) / 2).toFixed(1)} m/s`,
        `${axisSummary.radialVelocityMinMps} m/s`,
      ]
    : ["+v m/s", "0 m/s", "-v m/s"];
  const rangeTicks = axisSummary
    ? [`${axisSummary.rangeMinM} m`, `${((axisSummary.rangeMinM + axisSummary.rangeMaxM) / 2).toFixed(0)} m`, `${axisSummary.rangeMaxM} m`]
    : ["near m", "mid m", "far m"];
  const hasTruthCells = cells.some((cell) => cell.gt);
  const hasGhostCells = cells.some((cell) => cell.ghost);
  const cellClasses = (cell: RadarWorkbenchModel["rangeDopplerCfar"]["cells"][number]) =>
    [
      "rd-cell",
      cell.detected || cell.targetOutcome === "hit" || cell.targetOutcome === "ghost-false-alarm" ? "peak" : "",
      cell.gt ? "gt" : "",
      cell.ghost ? "ghost" : "",
    ]
      .filter(Boolean)
      .join(" ");
  const cellLabel = (cell: RadarWorkbenchModel["rangeDopplerCfar"]["cells"][number]) => {
    if (cell.targetOutcome === "hit") return "Hit";
    if (cell.targetOutcome === "miss") return "Miss";
    if (cell.targetOutcome === "ghost-false-alarm") return "Ghost FA";
    if (cell.targetOutcome === "ghost-suppressed") return "Ghost GT";
    if (cell.detected && cell.gt) return "Hit";
    if (cell.detected && cell.ghost) return "Ghost FA";
    if (cell.gt) return "Miss";
    if (cell.ghost) return "Ghost GT";
    if (cell.detected) return "CFAR";
    return "";
  };
  return (
    <div className="range-doppler-panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Range-Doppler / CFAR Grid</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">
            {axisSummary
              ? `x: Range (${axisSummary.rangeMinM}-${axisSummary.rangeMaxM} m), y: Radial velocity (${axisSummary.radialVelocityMinMps}-${axisSummary.radialVelocityMaxMps} m/s)`
              : "fixture axes"}
          </div>
        </div>
        {detectionSummary && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="status-badge bg-radar/10 text-radar">CFAR {detectionSummary.cfarPeaks}</span>
            <span className="status-badge bg-camera/10 text-camera">Hit {detectionSummary.hits}</span>
            <span className="status-badge bg-rose-300/10 text-rose-200">Miss {detectionSummary.misses}</span>
            <span className="status-badge bg-fusion/10 text-fusion">Ghost {detectionSummary.ghostCandidates}</span>
          </div>
        )}
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-radar" />CFAR detection = detector output
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-camera ring-1 ring-radar" />Truth target bin = GT
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />Ghost truth = scenario multipath/ghost candidate
        </span>
      </div>
      <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-xs leading-5 text-slate-400">
        <span className="font-semibold text-white">Interpretation:</span> GT/Truth and Ghost truth are scenario labels.
        CFAR detection is the radar detector output. Hit means Truth + CFAR overlap; Miss means Truth without CFAR;
        CFAR-only means a detector peak with no matched truth bin, so it is an unassociated false-alarm candidate.
        Ghost FA means a ghost truth bin was detected as a CFAR peak. Hit/Miss is computed on the full-resolution
        RadarSim Range-Doppler grid, then projected into this compact view.
        {!hasTruthCells && (
          <span className="ml-1 text-fusion">This fixture has no truth target bins; run RadarSim to populate GT/Miss/Hit cells.</span>
        )}
        {hasGhostCells && <span className="ml-1 text-rose-200">Ghost is not a predicted class here.</span>}
      </div>
      <div className="rd-axis-frame">
        <div className="rd-y-title">Radial velocity (m/s)</div>
        <div className="rd-y-ticks" aria-hidden="true">
          {velocityTicks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
        <div className="range-doppler-grid" style={{ gridTemplateColumns: `repeat(${rangeBins}, minmax(0, 1fr))` }}>
          {cells.map((cell, index) => (
            <span
              key={`${cell.dopplerBin}-${cell.rangeBin}-${index}`}
              title={`${cell.label ?? "noise"} · Range ${cell.rangeM ?? cell.rangeBin} m · Radial velocity ${cell.radialVelocityMps ?? cell.dopplerBin} m/s · Power ${cell.powerDb} dB · CFAR threshold ${cell.cfarThresholdDb} dB${cell.detected ? " · CFAR detection output" : ""}${cell.gt ? " · truth target bin" : ""}${cell.ghost ? " · ghost truth bin" : ""}${cell.targetOutcome ? ` · ${cell.targetOutcome}` : ""}`}
              className={cellClasses(cell)}
              style={{ opacity: Math.max(0.14, Math.min(0.96, (cell.powerDb + 12) / 12)) }}
            >
              {cellLabel(cell)}
            </span>
          ))}
        </div>
        <div className="rd-x-ticks" aria-hidden="true">
          {rangeTicks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
        <div className="rd-x-title">Range (m)</div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
            <div className="text-[11px] uppercase text-slate-500">{fact.label}</div>
            <div className="mt-1 break-words text-xs font-semibold text-slate-200">{fact.value}</div>
            <div className="mt-1 text-[11px] leading-4 text-slate-500">{fact.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function deriveRadarPostCfarFiltering(radarModel: RadarWorkbenchModel): NonNullable<RadarWorkbenchModel["postCfarFiltering"]> {
  const summary = radarModel.rangeDopplerCfar.detectionSummary;
  const rawCfar = summary?.cfarPeaks ?? radarModel.rangeDopplerCfar.cells.filter((cell) => cell.detected).length;
  const hits = summary?.hits ?? radarModel.rangeDopplerCfar.cells.filter((cell) => cell.detected && cell.gt).length;
  const falseAlarms = summary?.falseAlarms ?? Math.max(rawCfar - hits, 0);
  const ghostFalseAlarms = summary?.ghostFalseAlarms ?? 0;
  const ghostCandidates = summary?.ghostCandidates ?? radarModel.rangeDopplerCfar.cells.filter((cell) => cell.ghost).length;
  const ghostSuppressed = Math.max(ghostCandidates - ghostFalseAlarms, 0);
  const groupedPeaks = Math.max(hits + ghostFalseAlarms, Math.min(rawCfar, rawCfar - Math.ceil(falseAlarms * 0.45)));
  const gatedPoints = Math.min(groupedPeaks, hits + ghostFalseAlarms + Math.min(falseAlarms, 1));
  const radarObjects = Math.min(gatedPoints, hits + ghostFalseAlarms);
  const confirmedTracks = Math.min(radarObjects, hits + ghostFalseAlarms);
  const fusionAccepted = Math.min(confirmedTracks, hits);
  const stageValues = [
    ["Raw CFAR candidates", rawCfar, "processing.cfar_ca_2d threshold cells", "computed"],
    ["Peak grouped / NMS", groupedPeaks, "local peak grouping collapses adjacent range-Doppler cells", "derived"],
    ["SNR/RCS/velocity gated", gatedPoints, "margin, weak-RCS, and near-zero-Doppler gates", "derived"],
    ["Radar objects", radarObjects, "range/velocity clustering candidate objects", "derived"],
    ["Confirmed tracks", confirmedTracks, "multi-frame track confirmation policy proxy", "proxy"],
    ["Fusion accepted", fusionAccepted, "truth/ghost association proxy until fusion adapter is connected", "proxy"],
  ] as const;
  let previous = rawCfar;

  return {
    evidenceSource: "derived",
    stages: stageValues.map(([stage, count, method, evidence], index) => {
      const rejected = index === 0 ? 0 : Math.max(previous - count, 0);
      previous = count;
      return { stage, count, rejected, method, evidence };
    }),
    filters: [
      {
        name: "Peak grouping / NMS",
        setting: "3x3 Range-Doppler neighborhood",
        effect: "Collapses multiple adjacent CFAR cells caused by one target return.",
        tradeoff: "Can merge close objects when range or Doppler separation is small.",
      },
      {
        name: "SNR margin gate",
        setting: "keep peaks with positive margin over CFAR threshold",
        effect: "Removes weak CFAR-only peaks near the adaptive threshold.",
        tradeoff: "Low-RCS pedestrians and long-range objects can be removed first.",
      },
      {
        name: "Static / ghost guard",
        setting: "near-zero Doppler + guardrail/rain context",
        effect: `Suppresses ${ghostSuppressed} ghost candidate(s) in this run.`,
        tradeoff: "Static or slow valid objects need a different policy in parking/urban scenes.",
      },
      {
        name: "Track confirmation",
        setting: "2-of-3 frame confirmation proxy",
        effect: "Prevents one-frame CFAR spikes from becoming radar tracks.",
        tradeoff: "Track birth can be delayed for fast cut-in or low-RCS targets.",
      },
    ],
    summary: {
      rawCfar,
      groupedPeaks,
      radarPoints: gatedPoints,
      radarObjects,
      confirmedTracks,
      fusionAccepted,
      ghostSuppressed,
    },
  };
}

function RadarPostCfarFilteringPanel({ radarModel }: { radarModel: RadarWorkbenchModel }) {
  const filtering = radarModel.postCfarFiltering ?? deriveRadarPostCfarFiltering(radarModel);
  const maxCount = Math.max(...filtering.stages.map((stage) => stage.count), 1);
  const stageColors = ["#2ef5a9", "#00e5ff", "#f2c85b", "#a568ff", "#a7f3d0", "#38bdf8"];
  const hasProxyStages = filtering.stages.some((stage) => stage.evidence === "proxy");
  const topPoints = filtering.radarPoints?.slice(0, 5) ?? [];
  const topObjects = filtering.radarObjects?.slice(0, 5) ?? [];

  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Post-CFAR Filtering Funnel</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">
            CFAR cells are raw detector candidates. Object and track counts are reduced by grouping, gates, and confirmation.
          </div>
        </div>
        <span className="status-badge bg-fusion/10 text-fusion">
          {filtering.evidenceSource === "computed" ? (hasProxyStages ? "computed + proxy" : "computed") : "policy estimate"}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="min-w-0">
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filtering.stages} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" horizontal={false} />
                <XAxis type="number" stroke="#64748b" domain={[0, maxCount]} allowDecimals={false} />
                <YAxis dataKey="stage" type="category" stroke="#94a3b8" width={118} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                  {filtering.stages.map((stage, index) => (
                    <Cell key={stage.stage} fill={stageColors[index % stageColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <SmallFact label="Raw CFAR" value={String(filtering.summary.rawCfar)} />
            <SmallFact label="Radar points" value={String(filtering.summary.radarPoints ?? 0)} />
            <SmallFact label="Radar objects" value={String(filtering.summary.radarObjects)} />
          </div>
        </div>

        <div className="space-y-2">
          {filtering.stages.map((stage) => (
            <div key={stage.stage} className="rounded-lg border border-white/10 bg-white/[0.035] p-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-white">{stage.stage}</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-radar/20 bg-radar/10 px-2 py-0.5 text-[11px] font-semibold text-radar">
                    {stage.count}
                  </span>
                  {stage.rejected > 0 && (
                    <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-2 py-0.5 text-[11px] font-semibold text-rose-200">
                      filtered {stage.rejected}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-1 text-[11px] leading-4 text-slate-500">{stage.method}</div>
            </div>
          ))}
        </div>
      </div>

      {(topPoints.length > 0 || topObjects.length > 0) && (
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Computed Radar Points</div>
              <span className="code-chip">range + Doppler + DOA</span>
            </div>
            <div className="space-y-2">
              {topPoints.length ? (
                topPoints.map((point) => (
                  <div key={point.id} className="compact-row">
                    <CircleDot size={14} className={point.association?.targetKind === "ghost" ? "text-rose-300" : "text-radar"} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">
                        {point.classification} · {point.rangeM}m · {point.angleDeg}deg
                      </div>
                      <div className="text-xs text-slate-500">
                        v {point.radialVelocityMps}m/s · SNR {point.snrDb}dB · margin {point.cfarMarginDb}dB
                        {point.angleAmbiguity !== "low" ? ` · ${point.angleAmbiguity}` : ""}
                      </div>
                    </div>
                    <span className="status-badge bg-radar/10 text-radar">{point.association?.targetKind ?? "unassoc"}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-400">
                  No radar point survived the SNR/margin gate.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Computed Radar Objects</div>
              <span className="code-chip">point clustering</span>
            </div>
            <div className="space-y-2">
              {topObjects.length ? (
                topObjects.map((object) => (
                  <div key={object.id} className="compact-row">
                    <Target size={14} className={object.targetKind === "ghost" ? "text-rose-300" : object.targetKind === "truth" ? "text-camera" : "text-slate-500"} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">
                        {object.classHint} · {object.rangeM}m · {object.angleDeg}deg
                      </div>
                      <div className="text-xs text-slate-500">
                        {object.pointCount} point(s) · v {object.radialVelocityMps}m/s · confidence {Math.round(object.confidence * 100)}%
                      </div>
                    </div>
                    <span
                      className={`status-badge ${
                        object.targetKind === "truth"
                          ? "bg-radar/10 text-radar"
                          : object.targetKind === "ghost"
                            ? "bg-rose-300/10 text-rose-200"
                            : "bg-white/10 text-slate-300"
                      }`}
                    >
                      {object.targetKind}
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-400">
                  No object cluster was formed from the current radar points.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {filtering.angleWarning && (
        <div className="mt-3 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
          {filtering.angleWarning}
        </div>
      )}

      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {filtering.filters.map((filter) => (
          <div key={filter.name} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-white">{filter.name}</div>
              <span className="code-chip">{filter.setting}</span>
            </div>
            <div className="mt-2 text-xs leading-5 text-slate-400">{filter.effect}</div>
            <div className="mt-1 text-[11px] leading-4 text-slate-500">Trade-off: {filter.tradeoff}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RadarMimoComparisonPanel({ result }: { result: RadarSimulationResult | null }) {
  const comparison = result?.mimoComparison;

  if (!comparison) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/10 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-white">TDM vs TPM/BPM MIMO Comparison</div>
          <span className="status-badge bg-white/10 text-slate-300">run required</span>
        </div>
        <div className="text-xs leading-5 text-slate-400">
          Run RadarSim to execute the same scene twice: once with RadarSim TDM helpers and once with BPM phase-code helpers used as the current TPM adapter.
        </div>
      </div>
    );
  }

  const selectedLabel = comparison.selectedMode === "tpmBpm" ? "TPM/BPM" : "TDM";
  const chartRows = comparison.rows.map((row) => ({
    ...row,
    shortLabel: row.mode === "tpmBpm" ? "TPM/BPM" : "TDM",
  }));

  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">TDM vs TPM/BPM MIMO Comparison</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">{comparison.boundary}</div>
        </div>
        <span className="status-badge bg-radar/10 text-radar">selected {selectedLabel}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="h-[210px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="shortLabel" stroke="#64748b" />
              <YAxis stroke="#64748b" allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="hits" name="GT hits" fill="#2ef5a9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="falseAlarms" name="False alarms" fill="#fb7185" radius={[4, 4, 0, 0]} />
              <Bar dataKey="radarObjects" name="Radar objects" fill="#00e5ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid gap-2">
          {comparison.rows.map((row) => (
            <div key={row.mode} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-white">{row.label}</div>
                <span className="code-chip">{row.implementation.replace("radarsimpy_whitebox.", "")}</span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <SmallFact label="TX duty" value={`${row.txDutyPercent}%`} />
                <SmallFact label="Active TX" value={`${row.activeTxPerPulse}/pulse`} />
                <SmallFact label="Phase" value={row.phaseLevels} />
                <SmallFact label="CFAR / points" value={`${row.rawCfar} / ${row.radarPoints}`} />
                <SmallFact label="Hit / miss" value={`${row.hits} / ${row.misses}`} />
                <SmallFact label="Peak SNR" value={`${row.peakSnrDb} dB`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-radar/20 bg-radar/10 p-3 text-xs leading-5 text-radar">
        {comparison.recommendation}
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {comparison.pulsePreview.slice(0, 4).map((pulse) => (
          <div key={pulse.pulse} className="rounded-lg border border-white/10 bg-white/[0.035] p-2 text-[11px] leading-4 text-slate-400">
            <div className="font-semibold text-white">Pulse {pulse.pulse}</div>
            <div>TDM active: {pulse.tdmActiveTx}</div>
            <div>TPM/BPM active: {pulse.tpmBpmActiveTx}</div>
            <div className="truncate">TPM/BPM phase: {pulse.tpmBpmPhasesDeg}</div>
          </div>
        ))}
      </div>

      {comparison.warnings?.length ? (
        <div className="mt-3 rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
          {comparison.warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RadarPeakAssociationPanel({
  radarModel,
  result,
}: {
  radarModel: RadarWorkbenchModel;
  result: RadarSimulationResult | null;
}) {
  const peaks = radarModel.rangeDopplerCfar.peaks ?? [];
  const associations = radarModel.rangeDopplerCfar.targetAssociations ?? [];
  const artifact = result?.artifacts?.resultJson ?? radarModel.rangeDopplerCfar.artifact;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-xl border border-white/10 bg-black/10 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white">Peak List</div>
          <span className="status-badge bg-radar/10 text-radar">computed grid</span>
        </div>
        <div className="space-y-2">
          {peaks.length ? (
            peaks.slice(0, 6).map((peak) => (
              <div key={peak.id} className="compact-row">
                <CircleDot size={14} className={peak.detected ? "text-radar" : "text-slate-500"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{peak.label}</div>
                  <div className="text-xs text-slate-500">
                    {peak.rangeM}m · {peak.radialVelocityMps}m/s · power {peak.powerDb}dB · CFAR {peak.cfarThresholdDb}dB
                  </div>
                </div>
                <span className={`status-badge ${peak.source === "cfar" ? "bg-radar/10 text-radar" : "bg-white/10 text-slate-300"}`}>
                  {peak.source}
                </span>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-xs leading-5 text-slate-400">
              Run RadarSim to populate peak list.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/10 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white">Target Association</div>
          {artifact && (
            <a href={artifact.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-radar underline-offset-4 hover:underline">
              artifact JSON
            </a>
          )}
        </div>
        <div className="space-y-2">
          {associations.length ? (
            associations.map((association) => (
              <div key={`${association.label}-${association.expectedRangeM}`} className="compact-row">
                <Target size={14} className={association.targetKind === "ghost" ? "text-rose-300" : "text-camera"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{association.label}</div>
                  <div className="text-xs text-slate-500">
                    expected {association.expectedRangeM}m / {association.expectedVelocityMps}m/s
                    {association.rangeErrorM != null
                      ? ` · error ${association.rangeErrorM}m / ${association.velocityErrorMps}m/s`
                      : ""}
                  </div>
                </div>
                <RadarAssociationOutcomeBadge outcome={association.outcome} />
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-xs leading-5 text-slate-400">
              No target association has been computed yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RadarAssociationOutcomeBadge({ outcome }: { outcome: NonNullable<RadarWorkbenchModel["rangeDopplerCfar"]["targetAssociations"]>[number]["outcome"] }) {
  const className =
    outcome === "hit"
      ? "bg-radar/10 text-radar"
      : outcome === "miss"
        ? "bg-rose-300/10 text-rose-200"
        : outcome === "ghost-false-alarm"
          ? "bg-fusion/10 text-fusion"
          : outcome === "ghost-suppressed"
            ? "bg-camera/10 text-camera"
            : "bg-white/10 text-slate-300";
  return <span className={`status-badge ${className}`}>{outcome}</span>;
}

function GhostHeatmap({ radarModel }: { radarModel: RadarWorkbenchModel }) {
  const keys = ["rain", "guardrail", "tunnel", "urban"] as const;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1.2fr_repeat(4,1fr)] gap-2 text-xs text-slate-400">
        <div />
        {keys.map((key) => (
          <div key={key} className="text-center capitalize">{key}</div>
        ))}
        {radarModel.ghostHeatmap.map((row) => (
          <Fragment key={row.scenario}>
            <div key={`${row.scenario}-label`} className="flex items-center text-slate-300">{row.scenario}</div>
            {keys.map((key) => (
              <div
                key={`${row.scenario}-${key}`}
                className="flex min-h-12 items-center justify-center rounded-lg border border-white/10 text-sm font-semibold text-white"
                style={{ background: `rgba(251, 113, 133, ${Math.max(row[key] / 55, 0.12)})` }}
              >
                {row[key]}%
              </div>
            ))}
          </Fragment>
        ))}
      </div>
      <div className="rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
        Guardrail and rain slices show the highest ghost-to-fusion false-track risk.
      </div>
    </div>
  );
}

function LidarDesignValidationWorkbench() {
  const lidarModel = getLidarWorkbenchModel();
  const groupedChanges = lidarModel.configChanges.reduce<
    Record<string, typeof lidarModel.configChanges>
  >((groups, change) => {
    groups[change.group] = [...(groups[change.group] ?? []), change];
    return groups;
  }, {});

  return (
    <div className="space-y-5">
      <Panel title="LiDAR Design & 3D Perception Validation Workbench" action="geometry-aware validation">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-lidar/20 bg-lidar/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase text-lidar">
                  LiDAR Workbench / {lidarModel.lidarName}
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {lidarModel.baseline} vs {lidarModel.candidate}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-300">
                  Scenario suite: {lidarModel.scenarioSuite} · Comparable:{" "}
                  {lidarModel.comparable ? "Yes, with simulation fidelity warning" : "No"}
                </div>
              </div>
              <StatusBadge status="review" />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {(
                [
                  "Detection / Track Replay",
                  "Point Cloud Reprocessing",
                  "Synthetic Ray-cast Simulation",
                  "Physical Validation",
                ] as const
              ).map((mode) => (
                <div
                  key={mode}
                  className={`validation-mode-card ${
                    lidarModel.validationMode === mode ? "lidar-mode-active" : ""
                  }`}
                >
                  <div className="text-sm font-semibold text-white">{mode}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-400">
                    {mode === "Detection / Track Replay"
                      ? "detections, tracks, thresholds, fusion weights 재평가"
                      : mode === "Point Cloud Reprocessing"
                        ? "voxel, ground segmentation, deskew, temporal aggregation 재처리"
                        : mode === "Synthetic Ray-cast Simulation"
                          ? "channel, FOV, scan pattern, range, mounting을 ray-cast로 검증"
                          : "hardware, housing, weather, vibration, contamination 최종 검증"}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-fusion/30 bg-fusion/10 p-4 text-sm leading-6 text-fusion">
              <div className="mb-1 flex items-center gap-2 font-semibold text-white">
                <AlertTriangle size={16} className="text-fusion" />
                LiDAR fidelity warning
              </div>
              {lidarModel.fidelityWarning}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <SpecGroup title="LiDAR Role" items={lidarModel.role} icon={<Waves size={17} />} />
            <SpecGroup title="Known Weakness" items={lidarModel.knownWeakness} icon={<AlertTriangle size={17} />} />
          </div>
        </div>
      </Panel>

      <Panel title="LiDAR Data Fidelity">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {(
            [
              "Detections only",
              "Tracks",
              "Point cloud frame",
              "Ring / intensity / timestamp",
              "Motion-compensated cloud",
              "Multi-sweep cloud",
              "Voxel / pillar tensor",
              "Ground segmentation",
              "Synthetic ray-cast",
            ] as const
          ).map((fidelity) => (
            <LidarDataFidelityCard
              key={fidelity}
              fidelity={fidelity}
              active={lidarModel.dataFidelity.includes(fidelity)}
            />
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="LiDAR KPI Summary">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {lidarModel.kpis.map((kpi) => (
              <MetricTile key={kpi.label} label={kpi.label} value={kpi.value} delta={kpi.delta} tone={kpi.tone} />
            ))}
          </div>
        </Panel>

        <Panel title="LiDAR Design Impact Summary">
          <div className="grid gap-3">
            <SpecGroup title="Design benefit" items={lidarModel.designImpact.benefits} icon={<BadgeCheck size={17} />} />
            <SpecGroup title="Risk / trade-off" items={lidarModel.designImpact.risks} icon={<AlertTriangle size={17} />} />
            <div className="rounded-xl border border-lidar/25 bg-lidar/10 p-4 text-sm leading-6 text-slate-200">
              <div className="mb-1 font-semibold text-lidar">Recommendation</div>
              {lidarModel.designImpact.recommendation}
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Configuration Diff / Re-evaluation Feasibility">
        <div className="grid gap-4 xl:grid-cols-2">
          {Object.entries(groupedChanges).map(([group, changes]) => (
            <div key={group} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <div className="mb-3 text-sm font-semibold text-white">{group}</div>
              <div className="space-y-2">
                {changes.map((change) => (
                  <div key={`${change.group}-${change.parameter}`} className="config-change-row">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white">{change.parameter}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {change.baseline} -&gt; {change.candidate}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">{change.impact}</div>
                      <div className="mt-2">
                        <LidarDataFidelityBadge fidelity={change.requiredFidelity} />
                      </div>
                    </div>
                    <LidarFeasibilityBadge feasibility={change.feasibility} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <LidarMetricSuite lidarModel={lidarModel} />
    </div>
  );
}

function LidarMetricSuite({ lidarModel }: { lidarModel: LidarWorkbenchModel }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Point Count per Object vs Distance">
        <div className="h-[270px]">
          <ResponsiveContainer width="100%" height="100%">
            <ReLineChart data={lidarModel.pointCountByDistance}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="distance" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine y={16} stroke="#f2c85b" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="vehicle" stroke="#a568ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="pedestrian" stroke="#00e5ff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cyclist" stroke="#2ef5a9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cone" stroke="#f2c85b" strokeWidth={2} dot={false} />
            </ReLineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Point Density BEV Heatmap">
        <LidarDensityMap />
      </Panel>

      <Panel title="Vertical FOV Coverage Cross-section">
        <VerticalFovCrossSection />
      </Panel>

      <Panel title="Recall by Point Count">
        <div className="h-[270px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lidarModel.recallByPointCount}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="bucket" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="vehicle" fill="#a568ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pedestrian" fill="#00e5ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cyclist" fill="#2ef5a9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cone" fill="#f2c85b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Voxel Size vs AP / Latency Pareto">
        <div className="h-[270px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="latency" name="latency" stroke="#64748b" />
              <YAxis dataKey="ap3d" name="3D AP" stroke="#64748b" />
              <ZAxis dataKey="memory" range={[120, 520]} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={lidarModel.voxelPareto} fill="#a568ff">
                {lidarModel.voxelPareto.map((entry) => (
                  <Cell
                    key={entry.voxel}
                    fill={entry.guardrail === "pass" ? "#2ef5a9" : entry.guardrail === "warn" ? "#f2c85b" : "#fb7185"}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Ground Segmentation Before / After">
        <div className="h-[270px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lidarModel.groundSegmentation}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="slice" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="groundPrecision" fill="#2ef5a9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="objectRetention" fill="#00e5ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="falseGroundRemoval" fill="#fb7185" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Weather x Range x Object Recall">
        <WeatherRecallHeatmap lidarModel={lidarModel} />
      </Panel>

      <Panel title="LiDAR -> Fusion Contribution Matrix">
        <div className="h-[270px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lidarModel.fusionContribution}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="scenario" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="accepted" fill="#a568ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="rejected" fill="#64748b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lidarOnlyTp" fill="#00e5ff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="geometrySource" fill="#2ef5a9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lidarTpFusionFn" fill="#f2c85b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lidarFpAccepted" fill="#fb7185" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="LiDAR Output Contract">
        <div className="space-y-3">
          {lidarModel.outputContract.map((contract) => (
            <div key={contract.level} className="data-card">
              <div className="mb-3 text-sm font-semibold text-white">{contract.level}</div>
              <div className="flex flex-wrap gap-2">
                {contract.fields.map((field) => (
                  <span key={field} className="code-chip">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
            Warning: Fusion stack v42 uses point_count and covariance for association
            confidence. Removing those fields makes baseline/candidate comparison unreliable.
          </div>
        </div>
      </Panel>

      <Panel title="Artifact Storage Strategy">
        <div className="space-y-2">
          {lidarModel.artifactLevels.map((artifact) => (
            <div key={artifact.level} className="compact-row">
              <Database size={15} className="text-lidar" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">
                  {artifact.level}: {artifact.artifact}
                </div>
                <div className="text-xs text-slate-500">{artifact.useCase}</div>
              </div>
              <span className="text-right text-xs text-lidar">{artifact.storagePolicy}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Top LiDAR Failure Buckets">
        <div className="space-y-3">
          {lidarModel.failureBuckets.map((bucket) => (
            <div key={bucket.name} className="data-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{bucket.name}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-400">{bucket.impact}</div>
                </div>
                <SeverityBadge severity={bucket.severity} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {bucket.relatedChanges.map((change) => (
                  <span key={change} className="code-chip">
                    {change}
                  </span>
                ))}
              </div>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-300">
                {bucket.followUp}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function LidarDataFidelityCard({
  fidelity,
  active,
}: {
  fidelity: LidarDataFidelity;
  active: boolean;
}) {
  return (
    <div className={`data-fidelity-card ${active ? "lidar-fidelity-active" : ""}`}>
      <div className="text-sm font-semibold text-white">{fidelity}</div>
      <div className="mt-2 text-xs leading-5 text-slate-400">
        {fidelity === "Detections only"
          ? "threshold, NMS, class/fusion replay"
          : fidelity === "Tracks"
            ? "track and fusion association replay"
            : fidelity === "Point cloud frame"
              ? "voxel, ROI, range, point count"
              : fidelity === "Ring / intensity / timestamp"
                ? "deskew, ring health, intensity analysis"
                : fidelity === "Motion-compensated cloud"
                  ? "before/after motion compensation"
                  : fidelity === "Multi-sweep cloud"
                    ? "temporal aggregation analysis"
                    : fidelity === "Voxel / pillar tensor"
                      ? "model input and compute debug"
                      : fidelity === "Ground segmentation"
                        ? "ground/non-ground failure evidence"
                        : "hardware/FOV/scan/range design simulation"}
      </div>
      <div className="mt-3">
        <LidarDataFidelityBadge fidelity={fidelity} />
      </div>
    </div>
  );
}

function LidarDataFidelityBadge({ fidelity }: { fidelity: LidarDataFidelity }) {
  const className =
    fidelity === "Detections only"
      ? "border-slate-300/30 bg-slate-300/10 text-slate-300"
      : fidelity === "Tracks"
        ? "border-camera/30 bg-camera/10 text-camera"
        : fidelity === "Point cloud frame"
          ? "border-lidar/30 bg-lidar/10 text-lidar"
          : fidelity === "Ring / intensity / timestamp"
            ? "border-radar/30 bg-radar/10 text-radar"
            : fidelity === "Motion-compensated cloud"
              ? "border-fusion/30 bg-fusion/10 text-fusion"
              : fidelity === "Multi-sweep cloud"
                ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-300"
                : fidelity === "Voxel / pillar tensor"
                  ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-300"
                  : fidelity === "Ground segmentation"
                    ? "border-amber-300/30 bg-amber-300/10 text-amber-300"
                    : "border-purple-300/30 bg-purple-300/10 text-purple-300";

  return <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{fidelity}</span>;
}

function LidarFeasibilityBadge({
  feasibility,
}: {
  feasibility: LidarValidationFeasibility;
}) {
  const className =
    feasibility === "Replayable"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-300"
      : feasibility === "Reprocessable"
        ? "border-camera/30 bg-camera/10 text-camera"
        : feasibility === "Simulatable"
          ? "border-lidar/30 bg-lidar/10 text-lidar"
          : feasibility === "Physical Required"
            ? "border-rose-300/30 bg-rose-300/10 text-rose-300"
            : "border-fusion/30 bg-fusion/10 text-fusion";

  return <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{feasibility}</span>;
}

function LidarDensityMap() {
  const cells = Array.from({ length: 80 }, (_, index) => {
    const col = index % 10;
    const row = Math.floor(index / 10);
    const center = Math.abs(col - 4.5) + Math.abs(row - 6);
    return Math.max(12, 92 - center * 12 + ((index * 7) % 16));
  });

  return (
    <div className="lidar-density-panel">
      <div className="grid grid-cols-10 gap-1">
        {cells.map((value, index) => (
          <span
            key={index}
            className="aspect-square rounded-sm"
            style={{
              background:
                value < 28
                  ? `rgba(251,113,133,${Math.max(value / 80, 0.2)})`
                  : `rgba(165,104,255,${Math.min(value / 100, 0.8)})`,
            }}
          />
        ))}
      </div>
      <div className="lidar-ego" />
      <div className="sparse-zone" />
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <SmallFact label="Dense zone" value="0-40m urban" />
        <SmallFact label="Sparse zone" value="60m+ pedestrian" />
        <SmallFact label="Blind zone" value="near roof shadow" />
      </div>
    </div>
  );
}

function VerticalFovCrossSection() {
  return (
    <div className="vertical-fov-panel">
      <div className="ground-line" />
      <div className="lidar-origin" />
      <div className="fov-ray upper" />
      <div className="fov-ray lower" />
      <div className="fov-ray candidate-upper" />
      <div className="fov-ray candidate-lower" />
      <div className="vfov-object pedestrian">Pedestrian</div>
      <div className="vfov-object vehicle">Vehicle</div>
      <div className="vfov-blind-zone">Near-field blind zone</div>
      <div className="absolute bottom-4 left-4 grid gap-2 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="h-2 w-5 rounded-full bg-lidar" />
          Candidate -30 deg to +20 deg
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-5 rounded-full bg-slate-500" />
          Baseline -25 deg to +15 deg
        </div>
      </div>
    </div>
  );
}

function WeatherRecallHeatmap({ lidarModel }: { lidarModel: LidarWorkbenchModel }) {
  const keys = ["clear", "rain", "fog", "dust"] as const;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_repeat(4,1fr)] gap-2 text-xs text-slate-400">
        <div />
        {keys.map((key) => (
          <div key={key} className="text-center capitalize">{key}</div>
        ))}
        {lidarModel.weatherRangeRecall.map((row) => (
          <Fragment key={row.scenario}>
            <div className="flex items-center text-slate-300">{row.scenario}</div>
            {keys.map((key) => (
              <div
                key={`${row.scenario}-${key}`}
                className="flex min-h-12 items-center justify-center rounded-lg border border-white/10 text-sm font-semibold text-white"
                style={{
                  background:
                    row[key] < 50
                      ? `rgba(251,113,133,${Math.max(row[key] / 100, 0.16)})`
                      : `rgba(165,104,255,${Math.max(row[key] / 130, 0.22)})`,
                }}
              >
                {row[key]}%
              </div>
            ))}
          </Fragment>
        ))}
      </div>
      <div className="rounded-xl border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
        Rain/fog degradation should be treated as design guidance until physical weather
        capture confirms attenuation and contamination behavior.
      </div>
    </div>
  );
}

function WorkbenchTabs({ state }: { state: SensorWorkbenchState }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile
          label="Availability"
          value={`${state.config.health.availability}%`}
          delta="sensor health"
          tone="good"
        />
        <MetricTile label="Latency" value={`${state.config.health.latencyMs}ms`} delta="p95" tone="neutral" />
        <MetricTile label="Sync offset" value={`${state.config.health.syncOffsetMs}ms`} delta="frame alignment" tone="neutral" />
        <MetricTile label="Calibration" value={state.config.health.calibration} delta="latest status" tone={state.config.health.calibration === "nominal" ? "good" : "warn"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <SpecGroup title="Configuration" items={state.config.physicalSpec} icon={<Settings2 size={17} />} />
        <SpecGroup title="Processing" items={state.config.processing} icon={<SlidersHorizontal size={17} />} />
        <SpecGroup title="Algorithm" items={state.config.algorithm} icon={<BrainCircuit size={17} />} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="mb-3 text-sm font-semibold text-white">Design Verification</div>
          <div className="space-y-2">
            {state.designChecks.map((check) => (
              <div key={check.name} className="compact-row">
                {check.status === "pass" ? (
                  <CheckCircle2 size={15} className="text-emerald-300" />
                ) : check.status === "warn" ? (
                  <AlertTriangle size={15} className="text-fusion" />
                ) : (
                  <AlertTriangle size={15} className="text-rose-300" />
                )}
                <span className="min-w-0 flex-1">{check.name}</span>
                <span className="text-right text-slate-300">{check.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold text-white">Scenario Viewer Layers</div>
          <div className="flex flex-wrap gap-2">
            {state.viewerLayers.map((layer) => (
              <span key={layer} className="code-chip">
                {layer}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FusionPage() {
  const fusion = getFusionAttribution("run-fusion-210");
  const errors = listErrorEvents();

  return (
    <PageFrame
      title="Fusion Analysis"
      eyebrow="Sensor contribution / gain / loss / conflict"
      description="센서 output과 fusion decision을 object 단위로 연결해 accepted, rejected, overridden 원인을 추적합니다."
    >
      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Fusion Gain / Loss">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile label="Fusion Gain" value={`${fusion.gainLoss.fusionGain}%`} delta="weak/missing sensor recovery" tone="good" />
            <MetricTile label="Fusion Loss" value={`${fusion.gainLoss.fusionLoss}%`} delta="sensor hit missed by fusion" tone="warn" />
            <MetricTile label="Override Error" value={`${fusion.gainLoss.sensorOverrideError}%`} delta="better hypothesis ignored" tone="warn" />
          </div>
          <div className="mt-5">
            <ContributionMatrix />
          </div>
        </Panel>

        <Panel title="Object Inspector">
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">{fusion.objectId}</div>
                <div className="text-sm text-slate-400">
                  final class {fusion.finalClass} · position from {sensorLabels[fusion.finalPositionSource]} · velocity from {sensorLabels[fusion.finalVelocitySource]}
                </div>
              </div>
              <StatusBadge status="review" />
            </div>
            <div className="mt-4 space-y-2">
              {fusion.objectStory.map((story) => (
                <div key={story} className="compact-row">
                  <CircleDot size={14} className="text-camera" />
                  {story}
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel title="Association Graph">
          <AssociationGraph />
        </Panel>
        <Panel title="Conflict Cases">
          <div className="space-y-3">
            {fusion.conflictCases.map((item) => (
              <div key={item} className="data-card">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={17} className="mt-0.5 text-fusion" />
                  <div className="text-sm leading-6 text-slate-300">{item}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Error Mining">
        <div className="grid gap-3 lg:grid-cols-2">
          {errors.map((error) => (
            <ErrorCard key={error.id} error={error} />
          ))}
        </div>
      </Panel>
    </PageFrame>
  );
}

function ScenarioLibraryPage() {
  const scenarios = listScenarios();
  const filters = ["weather", "lighting", "road type", "range", "object class"];

  return (
    <PageFrame
      title="Scenario Library"
      eyebrow="ODD / scenario / test suite management"
      description="Scenario slice, coverage heatmap, saved test suite를 통해 run 결과를 원인 단위로 좁힙니다."
      action={<button className="secondary-button" type="button"><Plus size={17} />Save as test suite</button>}
    >
      <Panel title="ODD Filters">
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button key={filter} type="button" className="filter-chip">
              <SlidersHorizontal size={14} />
              {filter}
            </button>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Scenario Slices">
          <div className="space-y-3">
            {scenarios.map((scenario) => (
              <ScenarioRow key={scenario.id} scenario={scenario} />
            ))}
          </div>
        </Panel>
        <Panel title="Coverage Heatmap">
          <CoverageHeatmap scenarios={scenarios} />
        </Panel>
      </div>
    </PageFrame>
  );
}

function ReportsPage() {
  const reports = listReports();
  const compare = getRunCompare();

  return (
    <PageFrame
      title="Reports"
      eyebrow="Release / validation / experiment decision records"
      description="검증 결과를 release readiness, guardrail, coverage, top regression, sign-off 흐름으로 정리합니다."
      action={<button className="primary-button" type="button"><FileText size={17} />Generate Report</button>}
    >
      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel title="Report Library">
          <div className="space-y-3">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        </Panel>
        <Panel title="Release Readiness Detail">
          <div className="grid gap-3 md:grid-cols-4">
            <MetricTile label="Readiness" value="87%" delta="needs review" tone="warn" />
            <MetricTile label="Guardrail" value="3/4" delta="one warning" tone="warn" />
            <MetricTile label="Coverage" value="92%" delta="critical suite" tone="good" />
            <MetricTile label="Open risk" value="4" delta="2 high" tone="warn" />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <SpecGroup title="Top Regressions" items={compare.regressions} icon={<AlertTriangle size={17} />} />
            <SpecGroup title="Top Improvements" items={compare.improvements} icon={<BadgeCheck size={17} />} />
          </div>
          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-3 text-sm font-semibold text-white">Sign-off workflow</div>
            <div className="grid gap-3 md:grid-cols-4">
              {["Camera", "Radar", "LiDAR", "Fusion"].map((owner, index) => (
                <div key={owner} className="compact-card">
                  <div className="text-sm font-semibold text-white">{owner}</div>
                  <div className={index === 1 ? "mt-2 text-xs text-fusion" : "mt-2 text-xs text-emerald-300"}>
                    {index === 1 ? "blocked by ghost regression" : "ready"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </PageFrame>
  );
}

function DocsPage() {
  return (
    <PageFrame
      title="Docs"
      eyebrow="Role-based guides / API handoff / visual references"
      description="온보딩, template, data contract, visual system, handoff 이미지 확인을 한 곳에 모았습니다."
    >
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Role-based Guides">
          <div className="space-y-3">
            {quickGuides.map((guide) => (
              <div key={guide.role} className="data-card">
                <div className="text-sm font-semibold text-white">{guide.role}</div>
                <div className="mt-2 text-sm leading-6 text-slate-400">{guide.question}</div>
                <div className="mt-3 text-xs text-camera">{guide.target}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Typed Mock Contracts">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              "Workspace",
              "Experiment",
              "EvaluationRun",
              "SensorConfig",
              "MetricDefinition",
              "MetricValue",
              "Scenario",
              "ErrorEvent",
              "FusionAttribution",
              "Report",
              "Template",
            ].map((name) => (
              <div key={name} className="compact-row">
                <Database size={15} className="text-camera" />
                {name}
                <span className="ml-auto text-xs text-slate-500">src/types/domain.ts</span>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-fusion/20 bg-fusion/10 p-4 text-sm leading-6 text-fusion">
            실제 Simulation 코드는 이 단계에 포함하지 않았습니다. `src/services/platform.ts`
            adapter가 향후 API 또는 simulation bridge로 교체될 위치입니다.
          </div>
        </Panel>
      </div>

      <Panel title="Reference Boards From Handoff Package">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {conceptAssets.map((asset) => (
            <figure key={asset.file} className="reference-card">
              <img
                src={`/assets/sinclair/${asset.file}`}
                alt={asset.title}
                className="aspect-video w-full rounded-lg object-cover"
              />
              <figcaption className="mt-3 text-sm font-semibold text-white">{asset.title}</figcaption>
            </figure>
          ))}
        </div>
      </Panel>
    </PageFrame>
  );
}

function PageFrame({
  title,
  eyebrow,
  description,
  action,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-card lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase text-camera">{eyebrow}</div>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-card backdrop-blur-md sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {action && <div className="text-xs text-slate-400">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function SectionHeader({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      {action && (
        <button type="button" onClick={onAction} className="link-button">
          {action}
          <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}

function MetricTile({
  label,
  value,
  delta,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  const toneClass = {
    good: "text-emerald-300",
    warn: "text-fusion",
    bad: "text-rose-300",
    neutral: "text-camera",
  }[tone];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 break-words text-2xl font-semibold text-white">{value}</div>
      <div className={`mt-1 text-xs ${toneClass}`}>{delta}</div>
    </div>
  );
}

function TrendCard({
  label,
  value,
  delta,
  color,
  data,
}: {
  label: string;
  value: string;
  delta: string;
  color: string;
  data: Array<{ x: string; value: number }>;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <div className="text-3xl font-semibold text-white">{value}</div>
          <div className="mt-1 text-xs text-emerald-300">{delta}</div>
        </div>
        <div className="h-16 w-28">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.12} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function SensorEntryCard({
  sensor,
  title,
  text,
  onClick,
}: {
  sensor: Exclude<SensorType, "fusion">;
  title: string;
  text: string;
  onClick: () => void;
}) {
  const Icon = sensor === "camera" ? Camera : sensor === "radar" ? RadioTower : Waves;
  return (
    <button type="button" onClick={onClick} className={`sensor-entry ${sensorBorderClass(sensor)}`}>
      <div className={`mb-4 inline-flex rounded-xl border p-3 ${sensorPillClass(sensor)}`}>
        <Icon size={26} />
      </div>
      <div className="text-lg font-semibold text-white">{title}</div>
      <p className="mt-2 min-h-[60px] text-sm leading-6 text-slate-400">{text}</p>
      <div className={`mt-4 text-sm font-semibold ${sensorTextClass(sensor)}`}>
        {title} Workbench <ArrowRight className="inline" size={15} />
      </div>
    </button>
  );
}

function TemplateRow({ template }: { template: Template }) {
  return (
    <div className="compact-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{template.name}</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">{template.purpose}</div>
        </div>
        <ClipboardList size={17} className="text-camera" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {template.sensors.map((sensor) => (
          <span key={sensor} className={`sensor-chip ${sensorClass(sensor)}`}>
            {sensorLabels[sensor]}
          </span>
        ))}
      </div>
    </div>
  );
}

function RunRow({ run }: { run: EvaluationRun }) {
  return (
    <div className="compact-row">
      <StatusIcon status={run.status} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-white">{run.name}</div>
        <div className="text-xs text-slate-500">{run.environment} · {run.updatedAt}</div>
      </div>
      <StatusBadge status={run.status} />
    </div>
  );
}

function ReportMiniCard({ report }: { report: Report }) {
  return (
    <div className="rounded-xl border border-camera/20 bg-camera/10 p-4">
      <div className="flex items-center gap-3">
        <FileText size={18} className="text-camera" />
        <div>
          <div className="text-sm font-semibold text-white">{report.title}</div>
          <div className="text-xs text-slate-400">{report.type} · {report.generatedAt}</div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-2xl font-semibold text-camera">{report.readiness}%</div>
        <button className="link-button" type="button">
          리포트 열기
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function ContributionMatrix() {
  const fusion = getFusionAttribution("run-fusion-210");
  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={fusion.contributionMatrix}>
          <PolarGrid stroke="rgba(148,163,184,0.18)" />
          <PolarAngleAxis dataKey="attribute" tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <ReRadar name="Camera" dataKey="camera" stroke="#00e5ff" fill="#00e5ff" fillOpacity={0.18} />
          <ReRadar name="Radar" dataKey="radar" stroke="#2ef5a9" fill="#2ef5a9" fillOpacity={0.13} />
          <ReRadar name="LiDAR" dataKey="lidar" stroke="#a568ff" fill="#a568ff" fillOpacity={0.14} />
          <Tooltip contentStyle={tooltipStyle} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RadarViewer({ radarModel, result }: { radarModel: RadarWorkbenchModel; result: RadarSimulationResult | null }) {
  const targets = result?.request?.targets ?? [];
  const associations = radarModel.rangeDopplerCfar.targetAssociations ?? [];
  const associationByLabel = new Map(associations.map((association) => [association.label, association]));
  const cells = radarModel.rangeDopplerCfar.cells;
  const rangeBins = radarModel.rangeDopplerCfar.rangeBins;
  const dopplerBins = radarModel.rangeDopplerCfar.dopplerBins;
  const powerValues = cells.map((cell) => cell.powerDb);
  const minPower = Math.min(...powerValues, -30);
  const maxPower = Math.max(...powerValues, 0);
  const maxRange = Math.max(120, ...targets.map((target) => target.rangeM + 12));
  const maxLateral = Math.max(6, ...targets.map((target) => Math.abs(target.azimuthM) + 1));
  const width = 360;
  const height = 260;
  const originX = width / 2;
  const originY = height - 36;
  const lateralPxPerM = 145 / maxLateral;
  const rangePxPerM = 188 / maxRange;
  const mapTarget = (rangeM: number, lateralM: number) => ({
    x: originX + lateralM * lateralPxPerM,
    y: originY - rangeM * rangePxPerM,
  });
  const targetLines =
    targets.length > 0
      ? targets.map((target) => {
          const association = associationByLabel.get(target.label);
          const outcome = association?.outcome ? ` · ${association.outcome}` : "";
          const ghost = target.ghost ? " · ghost candidate" : "";
          return `${target.label}: ${target.rangeM.toFixed(1)} m, ${target.radialVelocityMps.toFixed(1)} m/s, ${target.rcsDbsm.toFixed(1)} dBsm${ghost}${outcome}`;
        })
      : ["No live target geometry yet. Run RadarSim to populate this viewer."];
  const sceneOutcomeLabel = (outcome: RadarTargetAssociation["outcome"]) =>
    outcome === "ghost-suppressed"
      ? "suppressed"
      : outcome === "ghost-false-alarm"
        ? "ghost FA"
        : outcome;

  return (
    <div className="viewer-grid">
      <div className="radar-scene p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full min-h-[330px] w-full">
          <defs>
            <linearGradient id="radarPipelineFovGradient" x1="0" x2="0" y1="1" y2="0">
              <stop offset="0%" stopColor="rgba(46,245,169,0.22)" />
              <stop offset="100%" stopColor="rgba(46,245,169,0.03)" />
            </linearGradient>
            <marker id="radarPipelineVelocityArrow" markerHeight="6" markerWidth="6" orient="auto" refX="5" refY="3">
              <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
            </marker>
          </defs>
          <polygon
            points={`${originX},${originY} ${originX - 150},${originY - 190} ${originX + 150},${originY - 190}`}
            fill="url(#radarPipelineFovGradient)"
            stroke="rgba(46,245,169,0.3)"
          />
          {[30, 60, 90, 120].map((range) => {
            const y = originY - (range / maxRange) * 188;
            return (
              <g key={range}>
                <line x1={36} x2={width - 36} y1={y} y2={y} stroke="rgba(148,163,184,0.14)" strokeDasharray="4 5" />
                <text x={42} y={y - 5} fill="#64748b" fontSize="10">
                  {range} m
                </text>
              </g>
            );
          })}
          <rect x={originX - 16} y={originY - 22} width={32} height={42} rx={8} fill="rgba(0,229,255,0.10)" stroke="rgba(0,229,255,0.55)" />
          <text x={originX} y={originY + 34} fill="#94a3b8" fontSize="10" textAnchor="middle">
            radar
          </text>
          {targets.length === 0 && (
            <text x={originX} y={originY - 112} fill="#94a3b8" fontSize="12" textAnchor="middle">
              Run RadarSim to draw computed target returns.
            </text>
          )}
          {targets.map((target) => {
            const point = mapTarget(target.rangeM, target.azimuthM);
            const association = associationByLabel.get(target.label);
            const isHit = association?.outcome === "hit";
            const color = target.ghost ? "#fb7185" : isHit ? "#2ef5a9" : association ? "#f2c85b" : "#00e5ff";
            const rcsHaloRadius = Math.max(5, Math.min(16, 7 + target.rcsDbsm / 3));
            const velocityScale = Math.max(-24, Math.min(24, target.radialVelocityMps * -1.4));
            const labelLeft = point.x > width - 100;
            const labelX = labelLeft ? point.x - 8 : point.x + 8;
            const labelAnchor = labelLeft ? "end" : "start";
            return (
              <g key={target.label}>
                <title>
                  {target.label}: range {target.rangeM} m, lateral {target.azimuthM} m, velocity {target.radialVelocityMps} m/s,
                  RCS {target.rcsDbsm} dBsm, outcome {association?.outcome ?? "not associated"}
                </title>
                <line x1={point.x} x2={point.x} y1={point.y} y2={point.y + velocityScale} stroke={color} strokeWidth="1.8" markerEnd="url(#radarPipelineVelocityArrow)" />
                <circle cx={point.x} cy={point.y} r={rcsHaloRadius} fill={color} opacity="0.13" />
                {target.ghost && <circle cx={point.x} cy={point.y} r={rcsHaloRadius + 3} fill="none" stroke={color} strokeDasharray="3 3" strokeWidth="1.2" opacity="0.72" />}
                <circle cx={point.x} cy={point.y} r={3.6} fill={color} opacity="0.95" />
                <text x={labelX} y={point.y - 8} fill="#e2e8f0" fontSize="10" textAnchor={labelAnchor}>
                  {target.label}
                </text>
                {association && (
                  <text x={labelX} y={point.y + 6} fill={color} fontSize="10" textAnchor={labelAnchor}>
                    {sceneOutcomeLabel(association.outcome)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="space-y-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Range-Doppler cells</div>
            <span className="text-[10px] text-slate-500">
              {rangeBins} range x {dopplerBins} Doppler
            </span>
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${rangeBins}, minmax(0, 1fr))` }}>
            {cells.map((cell) => {
              const normalized = (cell.powerDb - minPower) / Math.max(maxPower - minPower, 1);
              const colorClass = cell.detected ? (cell.ghost ? "bg-rose-300" : "bg-radar") : "bg-camera";
              return (
                <span
                  key={`${cell.rangeBin}-${cell.dopplerBin}`}
                  className={`h-4 rounded-sm ${colorClass}`}
                  style={{ opacity: 0.18 + normalized * 0.78 }}
                  title={`range bin ${cell.rangeBin}, Doppler bin ${cell.dopplerBin}, power ${cell.powerDb.toFixed(1)} dB, threshold ${cell.cfarThresholdDb.toFixed(1)} dB`}
                />
              );
            })}
          </div>
          <div className="mt-2 text-xs leading-5 text-slate-500">
            Cell color/opacity comes from the active Range-Doppler/CFAR data, not decorative patterning.
          </div>
        </div>
        <SpecGroup
          title="RadarSim Targets"
          icon={<RadioTower size={17} />}
          items={targetLines}
        />
      </div>
    </div>
  );
}

function LidarViewer() {
  const points = useMemo(
    () => Array.from({ length: 130 }, (_, index) => ({
      left: 8 + ((index * 37) % 84),
      top: 10 + ((index * 23) % 76),
      near: index % 5 === 0,
    })),
    []
  );
  return (
    <div className="viewer-grid">
      <div className="lidar-scene">
        <div className="lidar-ground" />
        <DetectionBox className="left-[52%] top-[42%] h-[22%] w-[15%] border-lidar" label="3D box" />
        {points.map((point, index) => (
          <span
            key={`${point.left}-${point.top}-${index}`}
            className={point.near ? "lidar-point near" : "lidar-point"}
            style={{ left: `${point.left}%`, top: `${point.top}%` }}
          />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-[150px] rounded-xl border border-white/10 bg-white/[0.035] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[12, 18, 24, 21, 17, 11, 7].map((value, index) => ({ range: `${index * 20}m`, value }))}>
              <XAxis dataKey="range" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
              <Bar dataKey="value" fill="#a568ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <SpecGroup
          title="Point Inspector"
          icon={<Waves size={17} />}
          items={["point count 42", "intensity median 0.62", "ground/non-ground split", "dropout risk +6.4%"]}
        />
      </div>
    </div>
  );
}

function DetectionBox({ className, label }: { className: string; label: string }) {
  return (
    <div className={`absolute rounded-sm border-2 ${className}`}>
      <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-ink-950/85 px-2 py-1 text-[10px] text-slate-200">
        {label}
      </span>
    </div>
  );
}

function AssociationGraph() {
  return (
    <div className="association-graph">
      <div className="graph-node camera">Camera</div>
      <div className="graph-node radar">Radar</div>
      <div className="graph-node lidar">LiDAR</div>
      <div className="graph-center">Fusion Engine</div>
      <div className="graph-node output">Track</div>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 320" aria-hidden="true">
        <path d="M150 70 L300 160 L450 70" stroke="rgba(0,229,255,0.45)" strokeWidth="2" fill="none" />
        <path d="M300 65 L300 160 L300 250" stroke="rgba(46,245,169,0.45)" strokeWidth="2" fill="none" />
        <path d="M300 160 L450 250" stroke="rgba(165,104,255,0.45)" strokeWidth="2" fill="none" />
      </svg>
    </div>
  );
}

function CoverageHeatmap({ scenarios }: { scenarios: Scenario[] }) {
  const cells = Array.from({ length: 48 }, (_, index) => ({
    value: 30 + ((index * 17) % 70),
    regression: scenarios[index % scenarios.length].regressions,
  }));
  return (
    <div>
      <div className="grid grid-cols-8 gap-2">
        {cells.map((cell, index) => (
          <div
            key={index}
            className="flex aspect-square items-center justify-center rounded-lg border border-white/10 text-xs font-semibold text-white"
            style={{
              background:
                cell.regression > 4
                  ? `rgba(244, 63, 94, ${cell.value / 160})`
                  : `rgba(0, 229, 255, ${cell.value / 180})`,
            }}
          >
            {cell.value}
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <SmallFact label="Best covered" value="Highway / Day / Vehicle" />
        <SmallFact label="Needs data" value="Fog / Cyclist / 20-40m" />
        <SmallFact label="Critical risk" value="Rain / Guardrail / Radar" />
      </div>
    </div>
  );
}

function ScenarioRow({ scenario }: { scenario: Scenario }) {
  return (
    <div className="data-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{scenario.name}</div>
          <div className="mt-1 text-xs text-slate-400">{scenario.suite}</div>
        </div>
        <SeverityBadge severity={scenario.regressions > 4 ? "high" : scenario.regressions > 2 ? "medium" : "low"} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[scenario.weather, scenario.lighting, scenario.roadType, scenario.rangeBand, scenario.objectClass].map((tag) => (
          <span key={tag} className="code-chip">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <SmallFact label="Coverage" value={`${scenario.coverage}%`} />
        <SmallFact label="Regressions" value={String(scenario.regressions)} />
      </div>
    </div>
  );
}

function ErrorCard({ error }: { error: ErrorEvent }) {
  return (
    <div className="data-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{error.errorType}</div>
          <div className="mt-1 text-xs text-slate-400">
            {error.objectId} · frames {error.frameStart}-{error.frameEnd}
          </div>
        </div>
        <SeverityBadge severity={error.severity} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <SmallFact label="Metric impact" value={error.metricImpact} />
        <SmallFact label="Root cause" value={error.rootCauseLabel} />
        <SmallFact label="Owner" value={error.owner} />
        <SmallFact label="Status" value={error.status} />
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: Report }) {
  return (
    <div className="data-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{report.title}</div>
          <div className="mt-1 text-xs text-slate-400">{report.type} · {report.generatedAt}</div>
        </div>
        <StatusBadge status={report.status} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MetricTile label="Readiness" value={`${report.readiness}%`} delta={report.signOff} tone={report.signOff === "ready" ? "good" : "warn"} />
        <MetricTile label="Coverage" value={`${report.coverage}%`} delta="scenario suite" tone="good" />
        <MetricTile label="Risks" value={String(report.openRisks)} delta="open" tone={report.openRisks > 4 ? "warn" : "neutral"} />
      </div>
    </div>
  );
}

function SpecGroup({ title, items, icon }: { title: string; items: string[]; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <span className="text-camera">{icon}</span>
        {title}
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-xs leading-5 text-slate-400">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-camera" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
      <div className="text-[11px] uppercase text-slate-500">{label}</div>
      <div className="mt-1 break-words text-xs font-semibold text-slate-200">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: RunStatus }) {
  const className =
    status === "completed" || status === "active"
      ? "bg-emerald-400/15 text-emerald-300"
      : status === "running"
        ? "bg-camera/15 text-camera"
        : status === "failed"
          ? "bg-rose-400/15 text-rose-300"
          : status === "review"
            ? "bg-fusion/15 text-fusion"
            : "bg-slate-400/15 text-slate-300";

  return <span className={`status-badge ${className}`}>{status}</span>;
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const className =
    severity === "high"
      ? "bg-rose-400/15 text-rose-300"
      : severity === "medium"
        ? "bg-fusion/15 text-fusion"
        : "bg-emerald-400/15 text-emerald-300";
  return <span className={`status-badge ${className}`}>{severity}</span>;
}

function StatusIcon({ status }: { status: RunStatus }) {
  if (status === "completed") return <CheckCircle2 size={17} className="text-emerald-300" />;
  if (status === "failed") return <AlertTriangle size={17} className="text-rose-300" />;
  if (status === "running") return <TimerReset size={17} className="text-camera" />;
  return <CircleDot size={17} className="text-fusion" />;
}

function sensorClass(sensor: SensorType) {
  if (sensor === "camera") return "border-camera/30 bg-camera/10 text-camera";
  if (sensor === "radar") return "border-radar/30 bg-radar/10 text-radar";
  if (sensor === "lidar") return "border-lidar/30 bg-lidar/10 text-lidar";
  return "border-fusion/30 bg-fusion/10 text-fusion";
}

function sensorBorderClass(sensor: SensorType) {
  if (sensor === "camera") return "border-camera/30 hover:border-camera";
  if (sensor === "radar") return "border-radar/30 hover:border-radar";
  if (sensor === "lidar") return "border-lidar/30 hover:border-lidar";
  return "border-fusion/30 hover:border-fusion";
}

function sensorPillClass(sensor: SensorType) {
  if (sensor === "camera") return "border-camera/30 bg-camera/10 text-camera";
  if (sensor === "radar") return "border-radar/30 bg-radar/10 text-radar";
  if (sensor === "lidar") return "border-lidar/30 bg-lidar/10 text-lidar";
  return "border-fusion/30 bg-fusion/10 text-fusion";
}

function sensorTextClass(sensor: SensorType) {
  if (sensor === "camera") return "text-camera";
  if (sensor === "radar") return "text-radar";
  if (sensor === "lidar") return "text-lidar";
  return "text-fusion";
}

const tooltipStyle = {
  background: "#080f1f",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px",
  color: "#e2e8f0",
};

export default App;
