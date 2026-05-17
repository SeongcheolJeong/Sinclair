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
  getCameraE2EAssets,
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
} from "./services/platform";
import type {
  CameraE2EAssetIndex,
  CameraE2EAssetOption,
  CameraE2EIntegration,
  CameraE2EEvidenceImage,
  CameraE2EPipelineStage,
  CameraSimulationRequest,
  CameraSimulationResult,
  CameraWorkbenchModel,
  ErrorEvent,
  EvaluationRun,
  LidarDataFidelity,
  LidarValidationFeasibility,
  LidarWorkbenchModel,
  Report,
  RadarDataFidelity,
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
    type: "macbeth",
    patchSize: 8,
    fovDeg: 12,
    luminanceCdM2: 120,
  },
  lens: {
    fNumber: 2.8,
    focalLengthMm: 6.2,
    hfovDeg: 90,
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
  sensor: {
    fitMode: "preserveResolution",
    rows: 96,
    cols: 128,
    pixelSizeUm: 2.8,
    exposureMs: 8,
    analogGain: 1.4,
    noiseFlag: 2,
    readNoiseMv: 2.1,
    qeScale: 1,
    bitDepth: 12,
  },
  isp: {
    demosaicMethod: "bilinear",
    illuminantCorrection: "gray world",
  },
  perception: {
    model: "proxy_detector_v0",
    inputSize: "1280x704",
    confidenceThreshold: 0.35,
    nmsThreshold: 0.5,
  },
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

      {selectedSensor === "camera" && <CameraDesignValidationWorkbench />}
      {selectedSensor === "radar" && <RadarDesignValidationWorkbench />}
      {selectedSensor === "lidar" && <LidarDesignValidationWorkbench />}

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Scenario Viewer">
          {selectedSensor === "camera" && <CameraViewer />}
          {selectedSensor === "radar" && <RadarViewer />}
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
    </PageFrame>
  );
}

function CameraDesignValidationWorkbench() {
  const cameraModel = getCameraWorkbenchModel();
  const [cameraE2EIntegration, setCameraE2EIntegration] = useState<CameraE2EIntegration | null>(null);
  const [cameraE2EAssets, setCameraE2EAssets] = useState<CameraE2EAssetIndex | null>(null);
  const [simulationRequest, setSimulationRequest] =
    useState<CameraSimulationRequest>(defaultCameraSimulationRequest);
  const [simulationResult, setSimulationResult] = useState<CameraSimulationResult | null>(null);
  const [simulationStatus, setSimulationStatus] = useState<"idle" | "running" | "completed" | "failed">("idle");
  const [simulationError, setSimulationError] = useState<string | null>(null);

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

  const runLiveSimulation = async () => {
    const request: CameraSimulationRequest = {
      ...simulationRequest,
      runId: `cam-live-${Date.now()}`,
    };
    setSimulationStatus("running");
    setSimulationError(null);
    try {
      const result = await runCameraE2ESimulation(request);
      setSimulationResult(result);
      setSimulationStatus("completed");
    } catch (error) {
      setSimulationError(error instanceof Error ? error.message : String(error));
      setSimulationStatus("failed");
    }
  };

  return (
    <div className="space-y-5">
      <Panel title="Camera Design & Validation Workbench" action="trust-aware camera configuration">
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
                  Dataset: {cameraModel.dataset} · Scenario source: {cameraModel.scenarioSource} ·
                  Comparable: {cameraModel.comparable ? "Yes" : "No"}
                </div>
              </div>
              <StatusBadge status="review" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {(["Log Replay", "Synthetic Re-render", "Physical Validation"] as const).map(
                (mode) => (
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
                )
              )}
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

        <Panel title="Camera Design Impact Summary">
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

      <CameraCharacterizationSuite cameraModel={cameraModel} />

      <CameraE2ELiveSimulationPanel
        request={simulationRequest}
        result={simulationResult}
        status={simulationStatus}
        error={simulationError}
        assets={cameraE2EAssets}
        setRequest={setSimulationRequest}
        onRun={runLiveSimulation}
      />

      <CameraE2EIntegrationPanel integration={cameraE2EIntegration} />

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
  );
}

function CameraCharacterizationSuite({ cameraModel }: { cameraModel: CameraWorkbenchModel }) {
  const characterization = cameraModel.characterization;

  return (
    <Panel title="Optics & Sensor Characterization" action="optical evidence linked to perception impact">
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-3 text-sm font-semibold text-white">Lens / Sensor Summary</div>
            <div className="space-y-2">
              {characterization.lensSummary.map((item) => (
                <div key={item.label} className="compact-row">
                  <Camera size={15} className="text-camera" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-slate-500">{item.label}</div>
                    <div className="text-sm font-semibold text-slate-200">{item.value}</div>
                  </div>
                  <EvidenceBadge evidence={item.evidence} />
                </div>
              ))}
            </div>
          </div>
          <OpticalPatternPreview />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="MTF vs Spatial Frequency">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={characterization.mtfByFrequency}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="frequency" stroke="#64748b" />
                  <YAxis stroke="#64748b" domain={[0, 1]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="center" stroke="#00e5ff" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="midField" stroke="#2ef5a9" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="edge" stroke="#f2c85b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="candidateEdge" stroke="#a568ff" strokeWidth={2} dot={false} />
                </ReLineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Sensor QE Spectral Response">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={characterization.qeResponse}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="wavelength" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="baseline" stroke="#64748b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="candidate" stroke="#00e5ff" strokeWidth={2} dot={false} />
                </ReLineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Sensor Noise / Low-light Response">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={characterization.sensorNoise}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="lux" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="shotNoise" stroke="#f2c85b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="readNoise" stroke="#fb7185" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="snr" stroke="#00e5ff" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pedestrianRecall" stroke="#2ef5a9" strokeWidth={2} dot={false} />
                </ReLineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Macbeth / Color Response">
            <div className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
              <MacbethChartPreview />
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={characterization.macbethResponse}>
                    <CartesianGrid stroke="rgba(148,163,184,0.12)" />
                    <XAxis dataKey="patch" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="deltaE" fill="#00e5ff" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="saturation" fill="#f2c85b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="classifierShift" fill="#a568ff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Panel>

          <Panel title="ISP Stage Impact">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={characterization.ispComparison}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="stage" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="snr" fill="#00e5ff" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sharpness" fill="#2ef5a9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="smallObjectRecall" fill="#a568ff" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="trafficLightError" fill="#fb7185" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Characteristic -> Perception Correlation">
            <div className="space-y-2">
              {characterization.perceptionCorrelations.map((item) => (
                <div key={item.characteristic} className="data-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{item.characteristic}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-400">{item.observation}</div>
                    </div>
                    <EvidenceBadge evidence={item.evidence} />
                  </div>
                  <div className="mt-3 rounded-xl border border-camera/20 bg-camera/10 p-3 text-xs leading-5 text-slate-200">
                    {item.effect}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </Panel>
  );
}

function CameraE2ELiveSimulationPanel({
  request,
  result,
  status,
  error,
  assets,
  setRequest,
  onRun,
}: {
  request: CameraSimulationRequest;
  result: CameraSimulationResult | null;
  status: "idle" | "running" | "completed" | "failed";
  error: string | null;
  assets: CameraE2EAssetIndex | null;
  setRequest: Dispatch<SetStateAction<CameraSimulationRequest>>;
  onRun: () => void;
}) {
  const sceneOptions: CameraSimulationRequest["scene"]["type"][] = [
    "macbeth",
    "slanted bar",
    "point array",
    "harmonic",
    "uniform ee",
    "dead leaves",
  ];
  const proxy = result?.metrics?.perceptionProxy;
  const liveImageCacheKey = result ? `${result.runId}:${result.createdAt ?? ""}:${result.elapsedMs ?? ""}` : "";
  const assetRequest = request.assets ?? defaultCameraSimulationRequest.assets!;
  const lensPhysicsRequest = request.lensPhysics ?? defaultCameraSimulationRequest.lensPhysics!;
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
  const lensResolutionPolicy =
    assetRequest.lensMode === "raytraceOptics" && assetRequest.lensAsset
      ? "Raytrace .mat owns geometry; numeric F-number, focal length, HFOV, and transmittance are locked."
      : (assetRequest.lensMode === "catalogLens" || assetRequest.lensMode === "lensFileReference") && assetRequest.lensAsset
        ? "Catalog lens sets focal/F-number/FOV approximation; numeric lens geometry is locked."
        : "Default optics uses numeric F-number, focal length, HFOV target, and transmittance.";
  const physicsResolutionPolicy =
    lensPhysicsRequest.mode === "none"
      ? assetRequest.lensMode === "raytraceOptics" && assetRequest.lensAsset
        ? "Selected optics default: Zemax raytrace PSF still runs."
        : "Selected optics default: no extra synthetic physics mode."
      : lensPhysicsRequest.mode === "raytracePsf"
        ? "Raytrace PSF mode adjusts angular PSF sampling and requires a raytrace optics asset."
        : "This physics mode replaces the current optics model for this run.";

  const updateScene = (field: keyof CameraSimulationRequest["scene"], value: string | number) => {
    setRequest((current) => ({
      ...current,
      scene: { ...current.scene, [field]: value },
    }));
  };
  const updateLens = (field: keyof CameraSimulationRequest["lens"], value: number) => {
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
  const updateIsp = (field: keyof CameraSimulationRequest["isp"], value: string) => {
    setRequest((current) => ({
      ...current,
      isp: { ...current.isp, [field]: value },
    }));
  };
  const updatePerception = (field: keyof CameraSimulationRequest["perception"], value: string | number) => {
    setRequest((current) => ({
      ...current,
      perception: { ...current.perception, [field]: value },
    }));
  };
  const updateAssets = (patch: Partial<NonNullable<CameraSimulationRequest["assets"]>>) => {
    setRequest((current) => ({
      ...current,
      assets: {
        lensMode: "none",
        lensAsset: "",
        sensorType: "default",
        sensorVariant: "",
        colorFilterAsset: "",
        ...current.assets,
        ...patch,
      },
    }));
  };

  return (
    <Panel title="CameraE2E Live Simulation Console" action="scene / lens / sensor / ISP / perception request">
      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-fusion/25 bg-fusion/10 p-4 text-xs leading-5 text-fusion">
            <div className="mb-1 flex items-center gap-2 font-semibold text-white">
              <AlertTriangle size={15} className="text-fusion" />
              Integration boundary
            </div>
            Live simulation runs the local CameraE2E Python package through the Vite dev server. The perception model
            controls are adapter metadata now; no real detector is executed until a detector service is connected.
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="data-card lg:col-span-2">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">CameraE2E Asset Loader</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">
                    Lens / optics and sensor assets are loaded from the CameraE2E AssetStore snapshot.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="code-chip">{assets ? `${raytraceLensAssets.length} raytrace optics` : "assets missing"}</span>
                  <span className="code-chip">{assets ? `${catalogLensAssets.length} catalog lenses` : "run asset sync"}</span>
                  <span className="code-chip">{assets ? `${sensorConstructorAssets.length} sensor constructors` : "run asset sync"}</span>
                </div>
              </div>
              {!assets && (
                <div className="mb-3 rounded-xl border border-fusion/25 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
                  Asset index is not loaded. Run <span className="font-semibold">npm run camera:e2e:assets</span> to
                  refresh /assets/camera-e2e/asset-index.json.
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-3">
                <CameraLiveSelectField
                  label="Lens asset mode"
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
                  label="Lens / optics asset"
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
                <CameraLiveSelectField
                  label="Sensor constructor"
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
                <div className="md:col-span-2">
                  <CameraLiveSelectField
                    label="Sensor / spectral asset"
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
                <div className="rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-400">
                  <div className="mb-1 font-semibold text-white">Selected asset behavior</div>
                  <div>
                    Optics .mat is raytraced. Catalog lenses apply focal/F-number/FOV approximation. Sensor model,
                    color filter, IR filter, and QE assets are applied to the live sensor pipeline.
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <CameraAssetSelectionSummary title="Lens" asset={selectedLensAsset} fallback={assetRequest.lensMode} />
                <CameraAssetSelectionSummary
                  title="Sensor"
                  asset={selectedSensorAsset}
                  fallback={assetRequest.sensorType}
                />
                <CameraAssetSelectionSummary
                  title="Spectral asset"
                  asset={selectedReferenceSensorAsset}
                  fallback={assetRequest.colorFilterAsset || "none"}
                />
              </div>
            </div>

            <div className="data-card lg:col-span-2">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Configuration Resolution</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">
                    Requested values can be constrained by CameraE2E optics geometry, asset contracts, and physics mode.
                    The run result below shows the resolved values after CameraE2E compute.
                  </div>
                </div>
                <span className="status-badge bg-fusion/15 text-fusion">requested vs resolved</span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <ConfigResolutionRow label="Scene FOV" value="Defines scene angular content; raytrace optics may clamp it." />
                <ConfigResolutionRow label="Lens geometry" value={lensResolutionPolicy} />
                <ConfigResolutionRow label="Lens physics" value={physicsResolutionPolicy} />
                <ConfigResolutionRow
                  label="Sensor"
                  value={
                    request.sensor.fitMode === "matchSceneFov"
                      ? "CameraE2E auto-resizes rows/cols to match scene FOV."
                      : "Requested rows/cols are preserved; scene and lens FOV are resolved separately."
                  }
                />
              </div>
            </div>

            <div className="data-card">
              <div className="mb-3 text-sm font-semibold text-white">Scene</div>
              <div className="grid gap-3">
                <CameraLiveSelectField
                  label="Scene type"
                  value={request.scene.type}
                  options={sceneOptions}
                  onChange={(value) => updateScene("type", value as CameraSimulationRequest["scene"]["type"])}
                />
                <CameraLiveNumberField
                  label="Patch / pattern size"
                  value={request.scene.patchSize ?? 8}
                  min={1}
                  step={1}
                  onChange={(value) => updateScene("patchSize", value)}
                />
                <CameraLiveNumberField
                  label="Scene FOV"
                  value={request.scene.fovDeg}
                  min={1}
                  max={120}
                  step={1}
                  unit="deg"
                  onChange={(value) => updateScene("fovDeg", value)}
                />
                <CameraLiveNumberField
                  label="Luminance"
                  value={request.scene.luminanceCdM2}
                  min={1}
                  step={10}
                  unit="cd/m2"
                  onChange={(value) => updateScene("luminanceCdM2", value)}
                />
              </div>
            </div>

            <div className="data-card">
              <div className="mb-3 text-sm font-semibold text-white">Lens / Optics</div>
              <div className="grid gap-3">
                <CameraLiveNumberField
                  label="F-number"
                  value={request.lens.fNumber}
                  min={1}
                  step={0.1}
                  onChange={(value) => updateLens("fNumber", value)}
                />
                <CameraLiveNumberField
                  label="Focal length"
                  value={request.lens.focalLengthMm}
                  min={0.5}
                  step={0.1}
                  unit="mm"
                  onChange={(value) => updateLens("focalLengthMm", value)}
                />
                <CameraLiveNumberField
                  label="HFOV target"
                  value={request.lens.hfovDeg}
                  min={5}
                  max={160}
                  step={1}
                  unit="deg"
                  onChange={(value) => updateLens("hfovDeg", value)}
                />
                <CameraLiveNumberField
                  label="Transmittance"
                  value={request.lens.transmittanceScale}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(value) => updateLens("transmittanceScale", value)}
                />
              </div>
            </div>

            <div className="data-card lg:col-span-2">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Lens Physics</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">
                    Uses CameraE2E optics compute paths: diffraction OTF, synthetic PSF, wavefront defocus, or
                    raytrace PSF sampling when a raytrace optics asset is selected.
                  </div>
                </div>
                <span className="code-chip">
                  {lensPhysicsRequest.mode === "raytracePsf" ? "surface PSF when .mat optics is active" : "physics approximation"}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <CameraLiveSelectField
                  label="Physics mode"
                  value={lensPhysicsRequest.mode}
                  options={[
                    { value: "none", label: "Selected optics default" },
                    { value: "diffraction", label: "Diffraction OTF" },
                    { value: "gaussianPsf", label: "Shift-invariant Gaussian PSF" },
                    { value: "wvfDefocus", label: "Wavefront defocus PSF" },
                    { value: "raytracePsf", label: "Raytrace PSF sampling" },
                  ]}
                  onChange={(value) =>
                    updateLensPhysics("mode", value as NonNullable<CameraSimulationRequest["lensPhysics"]>["mode"])
                  }
                />
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
                <CameraLiveNumberField
                  label="Aberration blur"
                  value={lensPhysicsRequest.aberrationPixels}
                  min={0}
                  max={6}
                  step={0.05}
                  unit="px"
                  onChange={(value) => updateLensPhysics("aberrationPixels", value)}
                />
                <CameraLiveNumberField
                  label="Defocus"
                  value={lensPhysicsRequest.defocusDiopters}
                  min={-5}
                  max={5}
                  step={0.05}
                  unit="D"
                  onChange={(value) => updateLensPhysics("defocusDiopters", value)}
                />
                <CameraLiveNumberField
                  label="RT PSF angle step"
                  value={lensPhysicsRequest.psfAngleStepDeg}
                  min={5}
                  max={180}
                  step={5}
                  unit="deg"
                  onChange={(value) => updateLensPhysics("psfAngleStepDeg", value)}
                />
              </div>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3 text-xs leading-5 text-slate-400">
                Catalog lens + synthetic physics is useful for design exploration, but it is not a surface raytrace.
                Select a raytrace optics .mat asset with Raytrace PSF sampling for surface-based PSF behavior.
              </div>
            </div>

            <div className="data-card lg:col-span-2">
              <div className="mb-3 text-sm font-semibold text-white">Sensor</div>
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

            <div className="data-card">
              <div className="mb-3 text-sm font-semibold text-white">ISP</div>
              <div className="grid gap-3">
                <CameraLiveTextField
                  label="Demosaic"
                  value={request.isp.demosaicMethod}
                  onChange={(value) => updateIsp("demosaicMethod", value)}
                />
                <CameraLiveTextField
                  label="Illuminant correction"
                  value={request.isp.illuminantCorrection}
                  onChange={(value) => updateIsp("illuminantCorrection", value)}
                />
              </div>
            </div>

            <div className="data-card">
              <div className="mb-3 text-sm font-semibold text-white">Perception Adapter</div>
              <div className="grid gap-3">
                <CameraLiveTextField
                  label="Model"
                  value={request.perception.model}
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

          <button className="primary-button w-full" type="button" onClick={onRun} disabled={status === "running"}>
            <Play size={16} />
            {status === "running" ? "Running CameraE2E..." : "Run Live Simulation"}
          </button>
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            {result?.artifacts?.ipSrgb ? (
              <CameraLiveImage
                title="CameraE2E IP sRGB live simulation output"
                artifact={result.artifacts.ipSrgb}
                cacheKey={liveImageCacheKey}
                imageClassName="h-[360px] w-full object-contain"
                fallbackClassName="flex h-[360px] flex-col items-center justify-center gap-2 p-6 text-center text-sm leading-6 text-slate-400"
              />
            ) : (
              <div className="flex h-[360px] items-center justify-center p-6 text-center text-sm leading-6 text-slate-400">
                Configure the scene, optics, sensor, ISP, and perception adapter, then run CameraE2E to render a fresh
                IP sRGB output.
              </div>
            )}
            <div className="border-t border-white/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Live result</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">
                    {result
                      ? `${result.runId} · ${result.elapsedMs ?? "-"}ms · ${result.metrics?.imageShape?.join("x") ?? "image"}`
                      : "No run yet"}
                  </div>
                </div>
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
              {error && (
                <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs leading-5 text-rose-200">
                  {error}
                </div>
              )}
            </div>
          </div>

          {result && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <IntegrationMetric
                  label="Mean RGB"
                  value={result.metrics?.meanRgb?.join(" / ") ?? "-"}
                  detail="IP sRGB mean"
                />
                <IntegrationMetric
                  label="Sensor p99"
                  value={String(result.metrics?.sensorVoltsP99 ?? "-")}
                  detail="sensor volts"
                />
                <IntegrationMetric
                  label="Proxy conf"
                  value={proxy ? proxy.proxyConfidence.toFixed(3) : "-"}
                  detail={proxy ? (proxy.proxyAccepted ? "proxy accepted" : "proxy below threshold") : "adapter pending"}
                />
                <IntegrationMetric
                  label="Saturation"
                  value={proxy ? proxy.saturationRatio.toFixed(3) : "-"}
                  detail="image-quality proxy"
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {result.artifacts?.sensorVolts && (
                  <CameraLiveArtifactCard
                    title="Sensor volts"
                    artifact={result.artifacts.sensorVolts}
                    cacheKey={liveImageCacheKey}
                  />
                )}
                {result.artifacts?.oiPhotons && (
                  <CameraLiveArtifactCard
                    title="OI photons"
                    artifact={result.artifacts.oiPhotons}
                    cacheKey={liveImageCacheKey}
                  />
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="data-card">
                  <div className="mb-3 text-sm font-semibold text-white">Applied CameraE2E setters</div>
                  <div className="flex max-h-56 flex-wrap gap-2 overflow-auto">
                    {(result.applied ?? []).map((item) => (
                      <span key={item} className="code-chip">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="data-card">
                  <div className="mb-3 text-sm font-semibold text-white">Warnings / Adapter notes</div>
                  <div className="space-y-2">
                    {proxy?.warning && (
                      <div className="flex gap-2 text-xs leading-5 text-fusion">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        {proxy.warning}
                      </div>
                    )}
                    {(result.warnings ?? []).map((warning) => (
                      <div key={warning} className="flex gap-2 text-xs leading-5 text-slate-400">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-fusion" />
                        {warning}
                      </div>
                    ))}
                    {!proxy?.warning && (result.warnings ?? []).length === 0 && (
                      <div className="text-xs text-slate-500">No runner warnings.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="data-card">
                <div className="mb-3 text-sm font-semibold text-white">Computed summaries</div>
                <div className="grid gap-2 md:grid-cols-4">
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
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

function CameraLiveNumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
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
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          className="min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-camera/50"
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
  onChange,
}: {
  label: string;
  value: string;
  options: CameraLiveSelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-camera/50"
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

function CameraLiveArtifactCard({
  title,
  artifact,
  cacheKey,
}: {
  title: string;
  artifact: { url: string };
  cacheKey: string;
}) {

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <CameraLiveImage
        title={title}
        artifact={artifact}
        cacheKey={cacheKey}
        imageClassName="h-48 w-full object-contain"
        fallbackClassName="flex h-48 flex-col items-center justify-center gap-2 p-4 text-center text-xs leading-5 text-slate-400"
      />
      <div className="border-t border-white/10 p-3 text-sm font-semibold text-white">{title}</div>
    </div>
  );
}

function formatCameraSimulationSummaryValue(value: string | number | number[]) {
  if (Array.isArray(value)) {
    return value.join(" x ");
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(4);
  }
  return value;
}

function CameraE2EIntegrationPanel({ integration }: { integration: CameraE2EIntegration | null }) {
  if (!integration) {
    return (
      <Panel title="CameraE2E Simulator Integration" action="waiting for synced simulator artifacts">
        <div className="rounded-xl border border-fusion/25 bg-fusion/10 p-4 text-sm leading-6 text-fusion">
          CameraE2E artifacts are not loaded yet. Run <span className="font-semibold">npm run camera:e2e:sync</span> to
          refresh /assets/camera-e2e/integration.json after CameraE2E reports are regenerated.
        </div>
      </Panel>
    );
  }

  const liveImport = integration.package.liveImport;
  const primaryImages = selectCameraE2EImages(integration.evidenceImages);

  return (
    <Panel
      title="CameraE2E Simulator Integration"
      action={`${integration.bridge.mode} · ${integration.bridge.command}`}
    >
      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-camera/20 bg-camera/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-camera">Linked simulator</div>
                <div className="mt-2 text-xl font-semibold text-white">{integration.package.name}</div>
                <div className="mt-1 text-xs leading-5 text-slate-400">{integration.package.pipeline}</div>
              </div>
              <span
                className={`status-badge ${
                  liveImport.available ? "bg-emerald-400/15 text-emerald-300" : "bg-fusion/15 text-fusion"
                }`}
              >
                {liveImport.available ? "live import ready" : "report linked"}
              </span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <SmallFact label="CameraE2E root" value={integration.sourceRoot} />
              <SmallFact label="Package version" value={integration.package.version} />
              <SmallFact label="Bridge output" value={integration.bridge.output} />
              <SmallFact label="Refresh" value={integration.bridge.refreshPolicy} />
            </div>
            {!liveImport.available && (
              <div className="mt-4 rounded-xl border border-fusion/25 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
                <div className="font-semibold text-white">Integration note</div>
                Live Python execution is not available in the current shell because CameraE2E dependencies are not
                installed there. Sinclair is using synced CameraE2E report artifacts now; the same contract can later be
                refreshed from live simulation output.
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
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
              label="3A sequence latency"
              value={`${integration.summary.hwIsp.threeAE2ELatencyMeanMs}ms`}
              detail={`AE frame ${integration.summary.hwIsp.aeSettleFrame}, AWB frame ${integration.summary.hwIsp.awbSettleFrame}`}
            />
            <IntegrationMetric
              label="Pipeline sizes"
              value={integration.summary.pipeline.sensorSize ?? "sensor linked"}
              detail={`OI ${integration.summary.pipeline.oiSize ?? "-"} · IP ${integration.summary.pipeline.ipSize ?? "-"}`}
            />
            <IntegrationMetric
              label="Live smoke run"
              value={integration.summary.liveSimulation?.status ?? "not run"}
              detail={
                integration.summary.liveSimulation?.elapsedMs
                  ? `${integration.summary.liveSimulation.elapsedMs}ms · ${integration.summary.liveSimulation.imageShape?.join("x") ?? "image"}`
                  : integration.summary.liveSimulation?.reason ?? "CameraE2E smoke render status"
              }
            />
          </div>

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
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            {integration.pipelineStages.map((stage) => (
              <CameraE2EStageCard key={stage.stage} stage={stage} />
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {primaryImages.map((image) => (
              <div key={image.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <img
                  src={image.url}
                  alt={image.title}
                  loading="lazy"
                  className="h-44 w-full object-cover object-top"
                />
                <div className="p-3">
                  <div className="text-sm font-semibold text-white">{image.title}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">{image.description}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-3 text-sm font-semibold text-white">3A / HW ISP verdicts</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(integration.summary.hwIsp.validationVerdicts).map(([name, passed]) => (
                <span
                  key={name}
                  className={`status-badge ${
                    passed ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"
                  }`}
                >
                  {formatVerdictName(name)} · {passed ? "pass" : "review"}
                </span>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {integration.warnings.map((warning) => (
                <div key={warning} className="flex gap-2 text-xs leading-5 text-slate-400">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-fusion" />
                  {warning}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Panel>
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

function formatVerdictName(name: string) {
  return name.replace(/_/g, " ");
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

function OpticalPatternPreview() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 text-sm font-semibold text-white">PSF / Strip Pattern Response</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="optical-preview">
          <div className="psf-grid">
            {Array.from({ length: 25 }, (_, index) => (
              <span
                key={index}
                className={index === 12 ? "psf-dot core" : index % 2 === 0 ? "psf-dot mid" : "psf-dot"}
              />
            ))}
          </div>
          <div className="mt-3 text-xs text-slate-400">PSF spot: center vs edge spread</div>
        </div>
        <div className="optical-preview">
          <div className="strip-pattern">
            {Array.from({ length: 14 }, (_, index) => (
              <span key={index} style={{ width: `${3 + index * 1.5}px` }} />
            ))}
          </div>
          <div className="mt-3 text-xs text-slate-400">Strip response: high-frequency contrast roll-off</div>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-fusion/20 bg-fusion/10 p-3 text-xs leading-5 text-fusion">
        Optical characterization is summarized here; release evidence still needs measured lab or
        physical vehicle validation for lens/sensor changes.
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
  const groupedChanges = radarModel.configChanges.reduce<
    Record<string, typeof radarModel.configChanges>
  >((groups, change) => {
    groups[change.group] = [...(groups[change.group] ?? []), change];
    return groups;
  }, {});

  return (
    <div className="space-y-5">
      <Panel title="Radar Design & Signal Validation Workbench" action="fidelity-aware radar pipeline">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-radar/20 bg-radar/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase text-radar">
                  Radar Workbench / {radarModel.radarName}
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {radarModel.baseline} vs {radarModel.candidate}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-300">
                  Scenario suite: {radarModel.scenarioSuite} · Comparable:{" "}
                  {radarModel.comparable ? "Yes, with fidelity warning" : "No"}
                </div>
              </div>
              <StatusBadge status="review" />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
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
                      ? "points, clusters, tracks, fusion gates를 빠르게 재평가"
                      : mode === "Signal Processing Replay"
                        ? "Range-Doppler, radar cube, raw IQ로 FFT/CFAR/angle 재처리"
                        : mode === "Signal-level Simulation"
                          ? "RF, waveform, antenna, multipath, rain/interference를 설계 검증"
                          : "hardware, radome, bumper, thermal, real weather 최종 검증"}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-fusion/30 bg-fusion/10 p-4 text-sm leading-6 text-fusion">
              <div className="mb-1 flex items-center gap-2 font-semibold text-white">
                <AlertTriangle size={16} className="text-fusion" />
                Data fidelity warning
              </div>
              {radarModel.fidelityWarning}
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

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="Radar KPI Summary">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {radarModel.kpis.map((kpi) => (
              <MetricTile key={kpi.label} label={kpi.label} value={kpi.value} delta={kpi.delta} tone={kpi.tone} />
            ))}
          </div>
        </Panel>

        <Panel title="Radar Design Impact Summary">
          <div className="grid gap-3">
            <SpecGroup title="Design benefit" items={radarModel.designImpact.benefits} icon={<BadgeCheck size={17} />} />
            <SpecGroup title="Risk / trade-off" items={radarModel.designImpact.risks} icon={<AlertTriangle size={17} />} />
            <div className="rounded-xl border border-radar/25 bg-radar/10 p-4 text-sm leading-6 text-slate-200">
              <div className="mb-1 font-semibold text-radar">Recommendation</div>
              {radarModel.designImpact.recommendation}
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

      <RadarMetricSuite radarModel={radarModel} />
    </div>
  );
}

function RadarMetricSuite({ radarModel }: { radarModel: RadarWorkbenchModel }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Detection Probability vs Range / RCS">
        <div className="h-[270px]">
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
      </Panel>

      <Panel title="Range-Doppler Map with CFAR Overlay">
        <RangeDopplerCfarPanel />
      </Panel>

      <Panel title="Azimuth Resolution / Two-target Separation">
        <div className="h-[270px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={radarModel.azimuthSeparation}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="distance" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="baselineMerged" fill="#64748b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="candidateMerged" fill="#2ef5a9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="separationGain" fill="#00e5ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Ghost / Multipath Heatmap">
        <GhostHeatmap radarModel={radarModel} />
      </Panel>

      <Panel title="Velocity Accuracy Timeline">
        <div className="h-[270px]">
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
      </Panel>

      <Panel title="CFAR Parameter Sensitivity">
        <div className="h-[270px]">
          <ResponsiveContainer width="100%" height="100%">
            <ReLineChart data={radarModel.cfarSensitivity}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="pfa" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="detectionRecall" stroke="#2ef5a9" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="falseAlarm" stroke="#f2c85b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="ghostRate" stroke="#fb7185" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="fusionFalseTrack" stroke="#a568ff" strokeWidth={2} dot={false} />
            </ReLineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Radar -> Fusion Contribution Matrix">
        <div className="h-[270px]">
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
      </Panel>

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
            Warning: Fusion stack v42 expects radial_velocity_covariance. Candidate output
            schema changes must preserve this field for comparable runs.
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

      <Panel title="Top Radar Failure Buckets">
        <div className="space-y-3">
          {radarModel.failureBuckets.map((bucket) => (
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

function RangeDopplerCfarPanel() {
  const cells = Array.from({ length: 96 }, (_, index) => {
    const rangePeak = index % 12;
    const dopplerPeak = Math.floor(index / 12);
    const peak =
      (rangePeak === 4 && dopplerPeak === 3) ||
      (rangePeak === 7 && dopplerPeak === 5) ||
      (rangePeak === 9 && dopplerPeak === 2);
    return { peak, ghost: rangePeak === 10 && dopplerPeak === 6, value: 0.14 + ((index * 17) % 80) / 100 };
  });

  return (
    <div className="range-doppler-panel">
      <div className="range-doppler-grid">
        {cells.map((cell, index) => (
          <span
            key={index}
            className={cell.ghost ? "rd-cell ghost" : cell.peak ? "rd-cell peak" : "rd-cell"}
            style={{ opacity: Math.min(cell.value, 0.95) }}
          />
        ))}
      </div>
      <div className="cfar-line" />
      <div className="rd-marker gt">GT</div>
      <div className="rd-marker ghost">Ghost</div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <SmallFact label="CFAR Pfa" value="1e-4 -> 1e-3" />
        <SmallFact label="Detected peaks" value="+18%" />
        <SmallFact label="Rain ghost" value="+19.4%" />
      </div>
    </div>
  );
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

function CameraViewer() {
  return (
    <div className="viewer-grid">
      <div className="camera-scene">
        <div className="road-line left" />
        <div className="road-line right" />
        <DetectionBox className="left-[42%] top-[42%] h-[28%] w-[14%] border-camera" label="GT pedestrian" />
        <DetectionBox className="left-[44%] top-[46%] h-[24%] w-[12%] border-rose-400" label="camera FN risk" />
        <DetectionBox className="left-[66%] top-[38%] h-[20%] w-[17%] border-lidar" label="fusion projection" />
      </div>
      <div className="space-y-3">
        <SpecGroup
          title="Image Quality"
          icon={<Camera size={17} />}
          items={["exposure 1/100s", "gain 12dB", "blur score 0.18", "glare score 0.74"]}
        />
        <SpecGroup
          title="Overlay"
          icon={<Target size={17} />}
          items={["raw/undistorted", "GT + detection", "projected 3D box", "depth error vector"]}
        />
      </div>
    </div>
  );
}

function RadarViewer() {
  const points = useMemo(
    () => Array.from({ length: 36 }, (_, index) => ({
      left: 12 + ((index * 17) % 74),
      top: 16 + ((index * 29) % 68),
      ghost: index % 7 === 0,
    })),
    []
  );
  return (
    <div className="viewer-grid">
      <div className="radar-scene">
        <div className="radar-car" />
        <div className="radar-ring ring-1" />
        <div className="radar-ring ring-2" />
        <div className="radar-ring ring-3" />
        {points.map((point, index) => (
          <span
            key={`${point.left}-${point.top}-${index}`}
            className={point.ghost ? "radar-point ghost" : "radar-point"}
            style={{ left: `${point.left}%`, top: `${point.top}%` }}
          />
        ))}
      </div>
      <div className="space-y-3">
        <div className="mini-heatmap">
          {Array.from({ length: 64 }, (_, index) => (
            <span
              key={index}
              style={{ opacity: 0.15 + ((index * 13) % 75) / 100 }}
              className={(index + 5) % 11 === 0 ? "bg-fusion" : "bg-camera"}
            />
          ))}
        </div>
        <SpecGroup
          title="Radar Targets"
          icon={<RadioTower size={17} />}
          items={["car 32.1m -3.2m/s", "truck 78.5m 1.6m/s", "ghost candidate 121.3m", "multipath cluster flagged"]}
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
