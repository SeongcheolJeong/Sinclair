#!/usr/bin/env python3
"""Sync CameraE2E simulator evidence into Sinclair public assets.

The Sinclair frontend cannot execute a local Python package directly. This
bridge normalizes CameraE2E report artifacts into a browser-readable contract.
If the Python simulator environment is available later, this file is the place
to add live execution before writing the same JSON shape.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


DEFAULT_CAMERA_E2E_ROOT = Path("/Users/seongcheoljeong/Documents/CameraE2E")
DEFAULT_OUTPUT_DIR = Path("public/assets/camera-e2e")
DEFAULT_CAMERA_E2E_PYTHON_CANDIDATES = [
    Path("/Users/seongcheoljeong/miniforge3/envs/isetcam-py/bin/python"),
    Path("/Users/seongcheoljeong/.micromamba/envs/isetcam-py/bin/python"),
]


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def read_project_version(pyproject: Path) -> str:
    if not pyproject.exists():
        return "unknown"
    match = re.search(r'^version\s*=\s*"([^"]+)"', pyproject.read_text(encoding="utf-8"), re.MULTILINE)
    return match.group(1) if match else "unknown"


def candidate_python_paths(root: Path) -> list[str]:
    paths: list[str] = []
    env_value = os_environ_get("CAMERA_E2E_PYTHON")
    if env_value:
        paths.append(env_value)
    for candidate in DEFAULT_CAMERA_E2E_PYTHON_CANDIDATES:
        paths.append(str(candidate))
    for local_name in (".venv", "venv", "env"):
        paths.append(str(root / local_name / "bin" / "python"))
    paths.extend(["python3.12", "python3", sys.executable])
    return list(dict.fromkeys(paths))


def os_environ_get(name: str) -> str | None:
    # Isolated to keep environment access explicit and easy to mock.
    import os

    return os.environ.get(name)


def check_live_import(root: Path, python: str) -> dict[str, Any]:
    if python == "auto":
        attempts = []
        for candidate in candidate_python_paths(root):
            status = check_live_import(root, candidate)
            attempts.append(status)
            if status.get("available"):
                return {
                    **status,
                    "autoDiscovered": True,
                    "attempts": attempts[:-1],
                }
        return {
            "available": False,
            "python": "auto",
            "command": "auto-discover CameraE2E Python",
            "stderr": "No candidate Python could import pyisetcam.",
            "attempts": attempts,
        }

    command = [
        python,
        "-c",
        (
            "import sys; "
            f"sys.path.insert(0, {str(root / 'src')!r}); "
            "import pyisetcam; "
            "print('import-ok')"
        ),
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=20, check=False)
    except Exception as exc:  # pragma: no cover - host environment dependent.
        return {
            "available": False,
            "python": python,
            "command": " ".join(command),
            "error": f"{type(exc).__name__}: {exc}",
        }

    return {
        "available": result.returncode == 0,
        "python": python,
        "command": " ".join(command),
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
        "returncode": result.returncode,
    }


def run_live_smoke(root: Path, python_status: dict[str, Any], output_dir: Path) -> dict[str, Any]:
    if not python_status.get("available"):
        return {
            "available": False,
            "status": "not_run",
            "reason": "CameraE2E Python import is not available.",
        }

    python = str(python_status["python"])
    output_path = output_dir / "live" / "macbeth_smoke.png"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    code = r"""
import json
import sys
import time
from pathlib import Path

import imageio.v3 as iio
import numpy as np

camera_e2e_root = Path(sys.argv[1])
output_path = Path(sys.argv[2])
sys.path.insert(0, str(camera_e2e_root / "src"))

from pyisetcam import AssetStore, camera_compute, camera_create, scene_create

start = time.perf_counter()
store = AssetStore.default()
scene = scene_create("macbeth", 4, asset_store=store)
camera = camera_compute(camera_create(asset_store=store), scene, asset_store=store)
srgb = np.asarray(camera.fields["ip"].data["srgb"], dtype=float)
output_path.parent.mkdir(parents=True, exist_ok=True)
iio.imwrite(output_path, np.round(np.clip(srgb, 0.0, 1.0) * 255.0).astype(np.uint8))
elapsed_ms = (time.perf_counter() - start) * 1000.0
print(json.dumps({
    "available": True,
    "status": "pass",
    "scene": "macbeth",
    "cameraPipeline": "scene_create -> camera_create -> camera_compute -> ip.srgb",
    "imageShape": list(srgb.shape),
    "elapsedMs": round(elapsed_ms, 3),
    "outputPath": str(output_path),
}))
"""
    command = [python, "-c", code, str(root), str(output_path)]
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=60, check=False)
    except Exception as exc:  # pragma: no cover - host environment dependent.
        return {
            "available": True,
            "status": "failed",
            "command": " ".join(command[:2]) + " <smoke-script>",
            "error": f"{type(exc).__name__}: {exc}",
        }

    if result.returncode != 0:
        return {
            "available": True,
            "status": "failed",
            "command": " ".join(command[:2]) + " <smoke-script>",
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "returncode": result.returncode,
        }

    try:
        payload = json.loads(result.stdout.strip().splitlines()[-1])
    except Exception as exc:
        return {
            "available": True,
            "status": "failed",
            "command": " ".join(command[:2]) + " <smoke-script>",
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "error": f"Unable to parse smoke output: {exc}",
        }

    return {
        **payload,
        "command": " ".join(command[:2]) + " <smoke-script>",
        "url": public_url(output_path, output_dir),
    }


def public_url(destination: Path, output_dir: Path) -> str:
    return "/" + destination.relative_to(output_dir.parent.parent).as_posix()


def copy_report_asset(source: Path, reports_root: Path, output_dir: Path) -> dict[str, str] | None:
    if not source.exists() or not source.is_file():
        return None
    try:
        relative = source.relative_to(reports_root)
    except ValueError:
        relative = Path(source.name)
    destination = output_dir / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return {
        "sourcePath": str(source),
        "url": public_url(destination, output_dir),
    }


def figure_source_path(value: Any, camera_e2e_root: Path, reports_root: Path) -> Path | None:
    if not isinstance(value, str) or not value:
        return None
    candidate = Path(value)
    if candidate.is_absolute():
        return candidate
    return reports_root / "parity" / candidate


def collect_parity_artifacts(
    camera_e2e_root: Path,
    reports_root: Path,
    output_dir: Path,
    camera_field: dict[str, Any],
) -> list[dict[str, Any]]:
    artifacts: list[dict[str, Any]] = []
    for case in camera_field.get("cases", []):
        figures = case.get("figures", {})
        if not isinstance(figures, dict):
            continue
        for figure_id, figure in figures.items():
            if not isinstance(figure, dict):
                continue
            path = figure_source_path(figure.get("path"), camera_e2e_root, reports_root)
            copied = copy_report_asset(path, reports_root, output_dir) if path is not None else None
            if copied is None:
                continue
            artifacts.append(
                {
                    "id": f"{case.get('name', 'case')}.{figure_id}",
                    "title": f"{case.get('name', 'CameraE2E')} / {figure_id}",
                    "stage": "parity",
                    "kind": "image",
                    "description": f"{case.get('matlab_function', 'CameraE2E')} parity evidence",
                    **copied,
                }
            )
    return artifacts


def collect_pipeline_stages(
    pipeline_summary: dict[str, Any],
    reports_root: Path,
    output_dir: Path,
) -> list[dict[str, Any]]:
    stages: list[dict[str, Any]] = []
    for stage_name, stage in pipeline_summary.get("stages", {}).items():
        if not isinstance(stage, dict):
            continue
        entry: dict[str, Any] = {
            "stage": stage_name,
            "edgeRcMeanRelPct": round(float(stage.get("edge_rc_mean_rel", 0.0)) * 100.0, 3),
            "cropNormalizedMae": float(stage.get("crop_normalized_mae", 0.0)),
            "profileNormalizedMae": float(stage.get("profile_normalized_mae", 0.0)),
            "cropMaxAbs": float(stage.get("crop_max_abs", 0.0)),
            "profileMaxAbs": float(stage.get("profile_max_abs", 0.0)),
        }
        for key in ("crop_figure", "profile_figure"):
            source = figure_source_path(stage.get(key), reports_root.parent, reports_root)
            copied = copy_report_asset(source, reports_root, output_dir) if source is not None else None
            if copied is not None:
                entry[key.replace("_figure", "FigureUrl")] = copied["url"]
                entry[key.replace("_figure", "FigureSourcePath")] = copied["sourcePath"]
        stages.append(entry)
    return stages


def collect_hwisp_artifacts(reports_root: Path, output_dir: Path) -> list[dict[str, Any]]:
    artifacts: list[dict[str, Any]] = []
    for name, title in [
        ("frame_timeline.png", "HW ISP frame timeline"),
        ("stage_latency.png", "HW ISP stage latency"),
        ("e2e_latency.png", "HW ISP E2E latency"),
        ("ae_convergence.png", "AE convergence"),
        ("awb_convergence.png", "AWB convergence"),
        ("three_a_thumbnails.png", "3A Macbeth sequence thumbnails"),
    ]:
        source = reports_root / "hwisp" / name
        copied = copy_report_asset(source, reports_root, output_dir)
        if copied is None:
            continue
        artifacts.append(
            {
                "id": f"hwisp.{Path(name).stem}",
                "title": title,
                "stage": "hw_isp",
                "kind": "image",
                "description": "CameraE2E HW ISP timing/control artifact",
                **copied,
            }
        )
    return artifacts


def build_contract(camera_e2e_root: Path, output_dir: Path, python: str) -> dict[str, Any]:
    reports_root = camera_e2e_root / "reports"
    camera_field = read_json(reports_root / "parity" / "camera_field_summary.json")
    pipeline = read_json(reports_root / "parity" / "pipeline_rt_bar_small_summary.json")
    hwisp = read_json(reports_root / "hwisp" / "hwisp_technical_summary.json")
    verification = read_json(reports_root / "hwisp" / "implementation_verification_integrated_summary.json")
    live_import = check_live_import(camera_e2e_root, python)
    live_smoke = run_live_smoke(camera_e2e_root, live_import, output_dir)

    parity_artifacts = collect_parity_artifacts(camera_e2e_root, reports_root, output_dir, camera_field)
    pipeline_stages = collect_pipeline_stages(pipeline, reports_root, output_dir)
    hwisp_artifacts = collect_hwisp_artifacts(reports_root, output_dir)

    timeline = hwisp.get("timeline_aggregate", {})
    three_a = hwisp.get("three_a_aggregate", {})
    parity_summary = camera_field.get("summary", {})

    warnings = [
        "Sinclair UI reads normalized CameraE2E report artifacts; it does not execute the Python simulator in the browser.",
        "Current host python import is unavailable until CameraE2E dependencies are installed; precomputed CameraE2E reports are linked.",
        "HW ISP timing profile is seed/reference data and should be replaced by board measurements before release evidence.",
    ]
    if live_import.get("available"):
        warnings[1] = "CameraE2E Python import is available and a lightweight live smoke render is executed during sync."

    if live_smoke.get("status") == "pass":
        hwisp_artifacts.insert(
            0,
            {
                "id": "live.macbeth_smoke",
                "title": "Live CameraE2E Macbeth smoke render",
                "stage": "live",
                "kind": "image",
                "description": "Fresh scene_create -> camera_compute -> ip.srgb smoke render from CameraE2E",
                "sourcePath": str(live_smoke.get("outputPath", "")),
                "url": str(live_smoke.get("url", "")),
            },
        )

    return {
        "schemaVersion": 1,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "sourceRoot": str(camera_e2e_root),
        "package": {
            "name": "pyisetcam",
            "version": read_project_version(camera_e2e_root / "pyproject.toml"),
            "pipeline": "Scene -> OpticalImage -> Sensor -> ImageProcessor -> Camera",
            "liveImport": live_import,
        },
        "bridge": {
            "mode": "report-artifact-sync",
            "command": "npm run camera:e2e:sync",
            "output": str(output_dir / "integration.json"),
            "refreshPolicy": "Run after regenerating CameraE2E reports or when switching simulator profiles.",
        },
        "capabilities": [
            {
                "area": "End-to-end camera render",
                "status": "linked",
                "description": "Default Macbeth camera pipeline, OI photons, sensor volts, and IP result parity evidence.",
                "evidence": "camera_default_pipeline",
            },
            {
                "area": "Optics / PSF / MTF",
                "status": "linked",
                "description": "Ray-trace point array, PSF triptych, PSF profiles, slanted-bar MTF, and pixel-size MTF evidence.",
                "evidence": "optics_rt_center_edge_psf_small",
            },
            {
                "area": "Sensor and IP stage response",
                "status": "linked",
                "description": "Lens, sensor, and ISP stage edge crop/profile comparisons from CameraE2E pipeline report.",
                "evidence": "pipeline_rt_bar_small",
            },
            {
                "area": "Macbeth color accuracy",
                "status": "linked",
                "description": "CameraE2E Macbeth color accuracy patch comparison and Delta-E oriented evidence.",
                "evidence": "metrics_color_accuracy_small",
            },
            {
                "area": "HW ISP timing / 3A",
                "status": "linked",
                "description": "Frame timeline, stage latency, E2E latency, AE/AWB convergence, and 3A validation verdicts.",
                "evidence": "rpi_vc4_imx219_public_seed",
            },
        ],
        "summary": {
            "parity": {
                "generatedAt": camera_field.get("generated_at"),
                "gitCommit": camera_field.get("git_commit"),
                "selectedCases": int(parity_summary.get("selected_cases", 0)),
                "passed": int(parity_summary.get("passed", 0)),
                "failed": int(parity_summary.get("failed", 0)),
                "skipped": int(parity_summary.get("skipped", 0)),
            },
            "pipeline": {
                "caseName": pipeline.get("case_name"),
                "gitCommit": pipeline.get("git_commit"),
                "sceneSize": pipeline.get("scene_size"),
                "sceneFovDeg": pipeline.get("scene_fov_deg"),
                "oiSize": pipeline.get("oi_size"),
                "sensorSize": pipeline.get("sensor_size"),
                "ipSize": pipeline.get("ip_size"),
            },
            "hwIsp": {
                "generatedAt": hwisp.get("generated_at"),
                "gitCommit": hwisp.get("git_commit"),
                "profile": hwisp.get("profile"),
                "frameCount": float(timeline.get("frame_count", 0.0)),
                "e2eLatencyMeanMs": round(float(timeline.get("e2e_latency_mean_us", 0.0)) / 1000.0, 3),
                "queueStallTotalMs": round(float(timeline.get("queue_stall_total_us", 0.0)) / 1000.0, 3),
                "threeAE2ELatencyMeanMs": round(float(three_a.get("e2e_latency_mean_us", 0.0)) / 1000.0, 3),
                "aeSettleFrame": int(float(three_a.get("ae_settle_frame", -1))),
                "awbSettleFrame": int(float(three_a.get("awb_settle_frame", -1))),
                "aeFinalErrorEv": round(float(three_a.get("ae_final_error_ev", 0.0)), 3),
                "awbFinalRgbImbalance": round(float(three_a.get("awb_final_rgb_imbalance", 0.0)), 3),
                "validationVerdicts": three_a.get("validation_verdicts", {}),
            },
            "liveSimulation": live_smoke,
            "verification": verification.get("verification", []),
        },
        "pipelineStages": pipeline_stages,
        "evidenceImages": parity_artifacts + hwisp_artifacts,
        "warnings": warnings,
        "adapterContract": {
            "request": {
                "sensorConfigId": "cam_front_wide_v042",
                "scene": "macbethD65 | slanted-bar | point-array | RGB input",
                "mode": "report-artifact-sync | future-live-simulation",
            },
            "response": {
                "summary": "typed CameraE2E metrics and verdicts",
                "artifacts": "browser-readable PNG/HTML/JSON paths",
                "provenance": "sourceRoot, gitCommit, profile, import status",
            },
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--camera-e2e-root", type=Path, default=DEFAULT_CAMERA_E2E_ROOT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument(
        "--python",
        default="auto",
        help="Python executable for CameraE2E live import check. Use 'auto' to discover isetcam-py.",
    )
    args = parser.parse_args()

    camera_e2e_root = args.camera_e2e_root.expanduser().resolve()
    output_dir = args.output_dir.expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    contract = build_contract(camera_e2e_root, output_dir, args.python)
    output_path = output_dir / "integration.json"
    output_path.write_text(json.dumps(contract, indent=2, ensure_ascii=False), encoding="utf-8")
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
