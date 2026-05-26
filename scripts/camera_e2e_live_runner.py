#!/usr/bin/env python3
"""Run a configurable CameraE2E live simulation from a JSON request."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

from camera_e2e_bridge import DEFAULT_CAMERA_E2E_ROOT, DEFAULT_OUTPUT_DIR, check_live_import


def read_request(path_or_dash: str) -> dict[str, Any]:
    if path_or_dash == "-":
        return json.loads(sys.stdin.read())
    return json.loads(Path(path_or_dash).read_text(encoding="utf-8"))


def run_inner_simulation(
    camera_e2e_root: Path,
    output_dir: Path,
    request_path: Path,
    python_status: dict[str, Any],
) -> dict[str, Any]:
    if not python_status.get("available"):
        return {
            "status": "failed",
            "reason": "CameraE2E Python is not available.",
            "python": python_status,
        }

    code = r"""
import json
import re
import sys
import time
import datetime as dt
from pathlib import Path

import imageio.v3 as iio
import numpy as np

camera_e2e_root = Path(sys.argv[1])
request_path = Path(sys.argv[2])
output_dir = Path(sys.argv[3])
sys.path.insert(0, str(camera_e2e_root / "src"))

from pyisetcam import (
    AssetStore,
    camera_compute,
    camera_create,
    camera_set,
    hw_isp_config,
    hw_isp_config_from_profile,
    hw_isp_latency_summary,
    hw_isp_simulate_sequence,
    ip_compute,
    ip_get,
    oi_create,
    oi_get,
    oi_set,
    scene_adjust_luminance,
    scene_create,
    scene_from_file,
    scene_get,
    scene_set,
    sensor_create,
    sensor_get,
    sensor_read_filter,
    sensor_set,
    si_synthetic,
)
from pyisetcam.camera import camera_acutance, camera_color_accuracy, camera_mtf, camera_vsnr
from pyisetcam.optics import oi_psf, psf_find_criterion_radius, rt_psf_interp
from pyisetcam.sensor import _sensor_from_upstream_model, mlens_get, sensor_snr

try:
    from pyisetcam import (
        render_detection_overlay,
        task_model_config,
        task_model_config_from_profile,
        task_model_from_config,
        task_model_profile_names,
        task_perception_config,
    )
    TASK_PERCEPTION_AVAILABLE = True
    TASK_PERCEPTION_IMPORT_ERROR = ""
except Exception as exc:
    TASK_PERCEPTION_AVAILABLE = False
    TASK_PERCEPTION_IMPORT_ERROR = f"{type(exc).__name__}: {exc}"


def clamp(value, lo, hi):
    return max(lo, min(hi, value))


def to_uint8_rgb(image):
    array = np.asarray(image, dtype=float)
    if array.ndim == 2:
        array = np.repeat(array[:, :, None], 3, axis=2)
    if array.ndim == 3 and array.shape[2] > 3:
        array = array[:, :, :3]
    if array.size == 0:
        return np.zeros((16, 16, 3), dtype=np.uint8)
    if float(np.nanmax(array)) > 1.0 or float(np.nanmin(array)) < 0.0:
        lo = float(np.nanpercentile(array, 1.0))
        hi = float(np.nanpercentile(array, 99.0))
        array = (array - lo) / max(hi - lo, 1.0e-12)
    return np.round(np.clip(array, 0.0, 1.0) * 255.0).astype(np.uint8)


def save_rgb(path, image):
    path.parent.mkdir(parents=True, exist_ok=True)
    iio.imwrite(path, to_uint8_rgb(image))
    return str(path)


def crop_signal_region(image, margin_fraction=0.18):
    array = np.asarray(image, dtype=float)
    if array.ndim < 2 or array.size == 0:
        return array
    luma = np.mean(array[:, :, : min(array.shape[2], 3)], axis=2) if array.ndim == 3 else array
    finite = luma[np.isfinite(luma)]
    if finite.size == 0:
        return array
    peak = float(np.nanmax(finite))
    floor = float(np.nanpercentile(finite, 5.0))
    threshold = floor + max(peak - floor, 0.0) * 0.08
    mask = luma > threshold
    if not np.any(mask):
        return array
    ys, xs = np.where(mask)
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    rows, cols = luma.shape[:2]
    pad_y = max(4, int((y1 - y0) * float(margin_fraction)))
    pad_x = max(4, int((x1 - x0) * float(margin_fraction)))
    y0 = max(0, y0 - pad_y)
    y1 = min(rows, y1 + pad_y)
    x0 = max(0, x0 - pad_x)
    x1 = min(cols, x1 + pad_x)
    if y1 <= y0 or x1 <= x0:
        return array
    return array[y0:y1, x0:x1, ...] if array.ndim == 3 else array[y0:y1, x0:x1]


def display_tuned_preview(image):
    array = np.asarray(image, dtype=float)
    if array.ndim == 2:
        array = np.repeat(array[:, :, None], 3, axis=2)
    if array.ndim == 3 and array.shape[2] > 3:
        array = array[:, :, :3]
    if array.size == 0:
        return np.zeros((16, 16, 3), dtype=float)
    array = np.nan_to_num(array, nan=0.0, posinf=1.0, neginf=0.0)
    if float(np.max(array)) > 1.0 or float(np.min(array)) < 0.0:
        lo = float(np.percentile(array, 0.5))
        hi = float(np.percentile(array, 99.5))
        array = (array - lo) / max(hi - lo, 1.0e-12)
    array = np.clip(array, 0.0, 1.0)

    luma = 0.2126 * array[:, :, 0] + 0.7152 * array[:, :, 1] + 0.0722 * array[:, :, 2]
    valid = (luma > np.percentile(luma, 10.0)) & (luma < np.percentile(luma, 98.0))
    if np.any(valid):
        channel_means = np.mean(array[valid], axis=0)
        gray = float(np.mean(channel_means))
        gains = np.clip(gray / np.maximum(channel_means, 1.0e-6), 0.72, 1.38)
        array = np.clip(array * gains.reshape(1, 1, 3), 0.0, 1.0)

    luma = 0.2126 * array[:, :, 0] + 0.7152 * array[:, :, 1] + 0.0722 * array[:, :, 2]
    midtone = float(np.percentile(luma, 55.0))
    exposure_scale = np.clip(0.52 / max(midtone, 1.0e-6), 0.78, 1.42)
    array = np.clip(array * exposure_scale, 0.0, 1.0)
    array = np.power(array, 1.0 / 1.22)

    luma = 0.2126 * array[:, :, 0] + 0.7152 * array[:, :, 1] + 0.0722 * array[:, :, 2]
    array = luma[:, :, None] + (array - luma[:, :, None]) * 1.16
    array = (array - 0.5) * 1.04 + 0.5
    return np.clip(array, 0.0, 1.0)


def safe_float(value, default):
    try:
        return float(value)
    except Exception:
        return float(default)


def safe_int(value, default):
    try:
        return int(round(float(value)))
    except Exception:
        return int(default)


def safe_bool(value, default=False):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float, np.integer, np.floating)):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "on", "enabled"}:
            return True
        if normalized in {"0", "false", "no", "off", "disabled"}:
            return False
    return bool(default)


def physical_hfov_deg(sensor_cols, pixel_size_um, focal_length_mm):
    cols = safe_float(sensor_cols, 0.0)
    pixel_um = safe_float(pixel_size_um, 0.0)
    focal_mm = safe_float(focal_length_mm, 0.0)
    sensor_width_mm = cols * pixel_um / 1000.0
    if sensor_width_mm <= 0.0 or focal_mm <= 0.0:
        return None
    return float(np.rad2deg(2.0 * np.arctan(sensor_width_mm / (2.0 * focal_mm))))


def diagonal_to_horizontal_fov_deg(diagonal_fov_deg, rows, cols):
    diagonal_fov = safe_float(diagonal_fov_deg, 0.0)
    row_count = safe_float(rows, 0.0)
    col_count = safe_float(cols, 0.0)
    if diagonal_fov <= 0.0 or row_count <= 0.0 or col_count <= 0.0:
        return None
    height_over_width = row_count / col_count
    diagonal_scale = float(np.sqrt(1.0 + height_over_width**2))
    return float(
        np.rad2deg(
            2.0 * np.arctan(np.tan(np.deg2rad(diagonal_fov) / 2.0) / diagonal_scale)
        )
    )


def angular_extent_deg(size_m, distance_m):
    size = safe_float(size_m, 0.0)
    distance = safe_float(distance_m, 0.0)
    if size <= 0.0 or distance <= 0.0:
        return None
    return float(np.rad2deg(2.0 * np.arctan(size / (2.0 * distance))))


def image_size_on_sensor_mm(size_m, distance_m, focal_length_mm):
    size = safe_float(size_m, 0.0)
    distance = safe_float(distance_m, 0.0)
    focal = safe_float(focal_length_mm, 0.0)
    if size <= 0.0 or distance <= 0.0 or focal <= 0.0:
        return None
    return float(2.0 * focal * np.tan(np.arctan(size / (2.0 * distance))))


def valid_fov_authority(value, warnings):
    authority = str(value or "physicalGeometry")
    allowed = {"physicalGeometry", "lensAsset", "numericOptics", "sceneTarget", "manualOiHfov"}
    if authority not in allowed:
        warnings.append(f"lens.fovAuthority={authority} is unsupported; physicalGeometry is used.")
        return "physicalGeometry"
    return authority


def try_apply(label, func, warnings, applied):
    try:
        value = func()
        applied.append(label)
        return value
    except Exception as exc:
        warnings.append(f"{label} ignored: {type(exc).__name__}: {exc}")
        return None


def parse_catalog_lens_asset(lens_asset, store, warnings):
    path = store.resolve(lens_asset)
    name = path.stem
    description = ""
    focal_mm = None
    f_number = None
    fov_deg = None
    try:
        if path.suffix.lower() == ".json":
            payload = json.loads(path.read_text(encoding="utf-8"))
            name = str(payload.get("name") or name).strip() or name
            description = str(payload.get("description") or "")
            metadata = payload.get("metadata") if isinstance(payload.get("metadata"), dict) else {}
            focal = metadata.get("focalLength")
            if focal is not None:
                focal_value = safe_float(focal, 0.0)
                focal_mm = focal_value * 1000.0 if focal_value < 1.0 else focal_value
            fnum = metadata.get("fNumber")
            if fnum is not None:
                f_number = safe_float(fnum, 0.0)
            surfaces = payload.get("surfaces") if isinstance(payload.get("surfaces"), list) else []
            if f_number is None and focal_mm is not None and surfaces:
                apertures = [safe_float(surface.get("semi_aperture", 0.0), 0.0) for surface in surfaces if isinstance(surface, dict)]
                max_diameter = 2.0 * max(apertures or [0.0])
                if max_diameter > 0.0:
                    f_number = focal_mm / max_diameter
        elif path.suffix.lower() == ".dat":
            text = path.read_text(encoding="latin1", errors="ignore")
            for line in text.splitlines():
                if line.lower().startswith("# name:"):
                    name = line.split(":", 1)[1].strip() or name
                elif line.lower().startswith("# description:"):
                    description = line.split(":", 1)[1].strip()
            match = re.search(r"Focal length.*?\n\s*([0-9.]+)", text, flags=re.IGNORECASE | re.DOTALL)
            if match:
                focal_mm = safe_float(match.group(1), 0.0)
        elif path.suffix.lower() == ".mat":
            description = "Focus lookup table; geometry is inferred from filename."
    except Exception as exc:
        warnings.append(f"lens.catalog.parse={lens_asset} partial: {type(exc).__name__}: {exc}")

    fov_match = re.search(r"([0-9]+(?:\.[0-9]+)?)deg", name, flags=re.IGNORECASE)
    if fov_match:
        fov_deg = safe_float(fov_match.group(1), 0.0)
    focal_match = re.search(r"([0-9]+(?:\.[0-9]+)?)mm", name, flags=re.IGNORECASE)
    if focal_mm is None and focal_match:
        focal_mm = safe_float(focal_match.group(1), 0.0)

    return {
        "name": name,
        "description": description,
        "focalLengthMm": focal_mm,
        "fNumber": f_number,
        "fovDeg": fov_deg,
    }


def apply_catalog_lens_asset(camera, lens_asset, store, warnings, applied):
    parsed = parse_catalog_lens_asset(lens_asset, store, warnings)
    applied_any = False
    wave = np.asarray(oi_get(camera.fields["oi"], "wave"), dtype=float).reshape(-1)
    lens_payload = {
        "type": "catalog-lens",
        "name": parsed["name"],
        "wave": wave,
        "transmittance": np.ones(wave.size, dtype=float),
    }
    camera = try_apply(
        f"lens.catalog.identity={parsed['name']}",
        lambda: camera_set(camera, "optics lens", lens_payload),
        warnings,
        applied,
    ) or camera
    applied_any = True
    if parsed.get("focalLengthMm"):
        camera = try_apply(
            f"lens.catalog.focalLengthMm={parsed['focalLengthMm']:.4g}",
            lambda: camera_set(camera, "optics focal length", float(parsed["focalLengthMm"]) / 1000.0),
            warnings,
            applied,
        ) or camera
        applied_any = True
    if parsed.get("fNumber"):
        camera = try_apply(
            f"lens.catalog.fNumber={parsed['fNumber']:.4g}",
            lambda: camera_set(camera, "optics fnumber", float(parsed["fNumber"])),
            warnings,
            applied,
        ) or camera
        applied_any = True
    if parsed.get("fovDeg"):
        camera = try_apply(
            f"lens.catalog.fovDeg={parsed['fovDeg']:.4g}",
            lambda: camera_set(camera, "oi fov", float(parsed["fovDeg"])),
            warnings,
            applied,
        ) or camera
        applied_any = True
    warnings.append(
        "Selected catalog lens is applied as a geometric approximation. "
        "Focal length, F-number, FOV, and lens identity affect this run; full surface PSF/aberration requires a raytrace optics asset."
    )
    return camera, applied_any


def apply_sensor_reference_asset(camera, reference_asset, store, warnings, applied):
    if not reference_asset:
        return camera, False
    lower = str(reference_asset).lower()
    try:
        data = store.load_mat(reference_asset)
    except Exception as exc:
        warnings.append(f"sensor.asset={reference_asset} ignored: {type(exc).__name__}: {exc}")
        return camera, False

    try:
        if "sensor" in data:
            sensor_asset = _sensor_from_upstream_model(reference_asset, asset_store=store)
            camera = try_apply(
                f"sensor.asset.modelFile={reference_asset}",
                lambda: camera_set(camera, "sensor", sensor_asset),
                warnings,
                applied,
            ) or camera
            return camera, True

        sensor = camera.fields["sensor"]
        if "/irfilters/" in lower:
            updated = sensor_read_filter("ir filter", sensor, reference_asset, asset_store=store)
            label = "sensor.asset.irFilter"
        elif "/photodetectors/" in lower:
            updated = sensor_read_filter("pdspectralqe", sensor, reference_asset, asset_store=store)
            label = "sensor.asset.photodetectorQe"
        else:
            updated = sensor_read_filter("cfa", sensor, reference_asset, asset_store=store)
            label = "sensor.asset.spectralFilter"
        camera = try_apply(
            f"{label}={reference_asset}",
            lambda: camera_set(camera, "sensor", updated),
            warnings,
            applied,
        ) or camera
        return camera, True
    except Exception as exc:
        warnings.append(f"sensor.asset={reference_asset} ignored: {type(exc).__name__}: {exc}")
        return camera, False


def normalize_model_name(value):
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def optics_model_name(camera):
    try:
        return str(oi_get(camera.fields["oi"], "optics model"))
    except Exception:
        return str(camera.fields["oi"].fields.get("optics", {}).get("model", "unknown"))


def apply_optics_aberration_scale(camera, aberration_pixels, warnings, applied):
    value = safe_float(aberration_pixels, 0.0)
    if abs(value) <= 1.0e-12:
        return camera

    def build():
        optics = dict(camera.fields["oi"].fields.get("optics", {}))
        optics["aberration_scale"] = max(0.0, value)
        return camera_set(camera, "optics", optics)

    return try_apply(
        f"lens.physics.aberrationScalePx={value:.4g}",
        build,
        warnings,
        applied,
    ) or camera


def apply_lens_physics(camera, request, store, warnings, applied):
    physics_req = request.get("lensPhysics") or {}
    mode = str(physics_req.get("mode", "none") or "none")
    if mode == "none":
        applied.append("lens.physics.mode=selectedOpticsDefault")
        return camera

    current_model = normalize_model_name(optics_model_name(camera))

    if mode == "diffraction":
        def build_diffraction():
            oi = camera.fields["oi"]
            oi = oi_set(oi, "optics model", "diffraction limited")
            oi = oi_set(oi, "compute method", "opticsotf")
            return camera_set(camera, "oi", oi)

        if current_model == "raytrace":
            warnings.append(
                "Lens physics diffraction mode replaces the selected raytrace PSF with diffraction-limited OTF for this run."
            )
        camera = try_apply(
            "lens.physics.mode=diffractionLimitedOTF",
            build_diffraction,
            warnings,
            applied,
        ) or camera

    elif mode == "gaussianPsf":
        spread_um = clamp(safe_float(physics_req.get("gaussianSpreadUm", 2.5), 2.5), 0.05, 50.0)
        xy_ratio = clamp(safe_float(physics_req.get("xyRatio", 1.0), 1.0), 0.05, 20.0)

        def build_gaussian():
            optics = si_synthetic("gaussian", camera.fields["oi"], spread_um, xy_ratio)
            return camera_set(camera, "optics", optics)

        camera = try_apply(
            f"lens.physics.mode=shiftInvariantGaussianPSF({spread_um:.3g}um,xy={xy_ratio:.3g})",
            build_gaussian,
            warnings,
            applied,
        ) or camera
        if current_model == "raytrace":
            warnings.append(
                "Lens physics Gaussian PSF mode replaces the selected raytrace PSF with a shift-invariant synthetic PSF for this run."
            )
        warnings.append(
            "Lens physics uses CameraE2E shift-invariant Gaussian PSF. "
            "This is useful for blur/MTF sensitivity, but it is not a surface raytrace of the selected catalog lens."
        )

    elif mode == "wvfDefocus":
        defocus = safe_float(physics_req.get("defocusDiopters", 1.25), 1.25)

        def build_wvf_defocus():
            current_oi = camera.fields["oi"]
            wvf_oi = oi_create("wvf", asset_store=store)
            wvf_oi = oi_set(wvf_oi, "optics focal length", float(oi_get(current_oi, "optics focal length")))
            wvf_oi = oi_set(wvf_oi, "optics fnumber", float(oi_get(current_oi, "optics fnumber")))
            wvf_oi = oi_set(wvf_oi, "fov", float(oi_get(current_oi, "fov")))
            wvf_oi = oi_set(wvf_oi, "compute method", "opticspsf")
            wvf_oi = oi_set(wvf_oi, "wvf zcoeffs", defocus, "defocus")
            return camera_set(camera, "oi", wvf_oi)

        camera = try_apply(
            f"lens.physics.mode=wavefrontDefocus({defocus:.3g}D)",
            build_wvf_defocus,
            warnings,
            applied,
        ) or camera
        if current_model == "raytrace":
            warnings.append(
                "Wavefront defocus mode replaced the selected raytrace optics with a shift-invariant wavefront OI for this run."
            )
        warnings.append(
            "Wavefront defocus uses CameraE2E opticspsf and Zernike defocus. "
            "It models defocus behavior, not full lens-surface aberration unless a raytrace optics asset is used."
        )

    elif mode == "raytracePsf":
        step_deg = clamp(safe_float(physics_req.get("psfAngleStepDeg", 30.0), 30.0), 1.0, 180.0)
        if current_model != "raytrace":
            warnings.append(
                "Raytrace PSF mode requires a raytrace optics .mat asset. "
                "No surface-based PSF was applied because the current optics model is not raytrace."
            )
        else:
            def build_raytrace_psf():
                oi = oi_set(camera.fields["oi"], "psf angle step", step_deg)
                return camera_set(camera, "oi", oi)

            camera = try_apply(
                f"lens.physics.mode=raytracePSF(angleStep={step_deg:.3g}deg)",
                build_raytrace_psf,
                warnings,
                applied,
            ) or camera

    else:
        warnings.append(f"lens.physics.mode={mode} is unsupported and was ignored.")

    return camera


def scene_from_request(request, store, warnings, applied):
    scene_req = request.get("scene", {})
    scene_type = str(scene_req.get("type", "macbeth"))
    geometry_mode = str(scene_req.get("geometryMode", "physicalGeometry") or "physicalGeometry")
    patch_size = safe_int(scene_req.get("patchSize", 8), 8)
    source_image_path = str(scene_req.get("sourceImagePath", "") or "")
    if source_image_path:
        resolved_source = resolve_scene_source_path(source_image_path, output_dir)
        scene = scene_from_file(
            str(resolved_source),
            "rgb",
            safe_float(scene_req.get("luminanceCdM2", 100.0), 100.0),
            None,
            asset_store=store,
        )
        applied.append(f"scene.sourceImage={source_image_path}")
    elif scene_type == "macbeth":
        scene = scene_create("macbeth", patch_size, asset_store=store)
    elif scene_type == "uniform ee":
        scene = scene_create("uniform ee", patch_size, asset_store=store)
    else:
        scene = scene_create(scene_type, asset_store=store)
    applied.append(f"scene.type={scene_type}")
    if geometry_mode == "physicalGeometry":
        physical_hfov = angular_extent_deg(scene_req.get("targetWidthM", 1.2), scene_req.get("distanceM", 5.0))
        if physical_hfov is None:
            warnings.append("scene physical geometry is invalid; advanced scene angular width override is used.")
            physical_hfov = safe_float(scene_req.get("fovDeg", 10.0), 10.0)
        scene = try_apply(
            f"scene.physicalGeometry.hfovDeg={physical_hfov:.4g}",
            lambda: scene_set(scene, "fov", physical_hfov),
            warnings,
            applied,
        ) or scene
    elif "fovDeg" in scene_req:
        scene = try_apply(
            f"scene.fovDeg={scene_req['fovDeg']}",
            lambda: scene_set(scene, "fov", safe_float(scene_req["fovDeg"], 10.0)),
            warnings,
            applied,
        ) or scene
    else:
        warnings.append(f"scene.geometryMode={geometry_mode} has no fovDeg; CameraE2E default scene FOV is used.")
    if "luminanceCdM2" in scene_req:
        scene = try_apply(
            f"scene.luminanceCdM2={scene_req['luminanceCdM2']}",
            lambda: scene_adjust_luminance(scene, safe_float(scene_req["luminanceCdM2"], 100.0), asset_store=store),
            warnings,
            applied,
        ) or scene
    return scene


def resolve_scene_source_path(value, output_dir):
    path = Path(str(value)).expanduser()
    if path.exists():
        return path
    if str(value).startswith("/assets/"):
        for parent in [output_dir, *output_dir.parents]:
            if parent.name == "public":
                candidate = parent / str(value).lstrip("/")
                if candidate.exists():
                    return candidate
                break
    if not path.is_absolute():
        candidate = Path.cwd() / path
        if candidate.exists():
            return candidate
    raise FileNotFoundError(f"Scene source image not found: {value}")


STANDARD_CHART_FOV_DEG = {
    "macbeth": 10.0,
    "slanted bar": 8.0,
    "dead leaves": 10.0,
    "uniform ee": 10.0,
    "point array": 8.0,
    "harmonic": 10.0,
}


def standard_chart_scene_from_request(scene_type, request, store, warnings, applied):
    test_request = json.loads(json.dumps(request))
    test_request.setdefault("scene", {})
    test_request["scene"]["type"] = scene_type
    test_request["scene"]["sourceImagePath"] = ""
    test_request["scene"]["sourceImageLabel"] = ""
    test_request["scene"]["sourceImageAttribution"] = ""
    test_request["scene"]["geometryMode"] = "angularFov"
    test_request["scene"]["fovDeg"] = float(STANDARD_CHART_FOV_DEG.get(str(scene_type).lower(), 10.0))
    scene = scene_from_request(test_request, store, warnings, applied)
    applied.append(
        f"validationChart.framing=standardChartFit:{scene_type}:{test_request['scene']['fovDeg']:.4g}deg"
    )
    return scene, test_request


def camera_from_request(request, store, warnings, applied):
    camera = camera_create(asset_store=store)
    assets_req = request.get("assets", {})
    lens_req = request.get("lens", {})
    sensor_req = request.get("sensor", {})
    isp_req = request.get("isp", {})
    fov_authority = valid_fov_authority(lens_req.get("fovAuthority", "physicalGeometry"), warnings)
    raytrace_asset_applied = False
    catalog_lens_applied = False

    sensor_type = str(assets_req.get("sensorType", "default") or "default")
    sensor_variant = str(assets_req.get("sensorVariant", "") or "")
    if sensor_type != "default" or sensor_variant:
        def build_sensor_from_asset():
            if sensor_variant:
                return sensor_create(sensor_type, sensor_variant, asset_store=store)
            return sensor_create(sensor_type, asset_store=store)

        sensor_asset = try_apply(
            f"sensor.asset={sensor_type}{':' + sensor_variant if sensor_variant else ''}",
            build_sensor_from_asset,
            warnings,
            applied,
        )
        if sensor_asset is not None:
            if isinstance(sensor_asset, list):
                warnings.append(
                    f"sensor.asset={sensor_type} returned {len(sensor_asset)} sensors; the first sensor is used for this live run."
                )
                sensor_asset = sensor_asset[0]
            camera = try_apply(
                f"sensor.asset.apply={sensor_type}{':' + sensor_variant if sensor_variant else ''}",
                lambda: camera_set(camera, "sensor", sensor_asset),
                warnings,
                applied,
            ) or camera

    lens_mode = str(assets_req.get("lensMode", "none") or "none")
    lens_asset = str(assets_req.get("lensAsset", "") or "")
    if lens_mode == "raytraceOptics" and lens_asset:
        oi_asset = try_apply(
            f"lens.asset.raytrace={lens_asset}",
            lambda: oi_create("ray trace", store.resolve(lens_asset), asset_store=store),
            warnings,
            applied,
        )
        if oi_asset is not None:
            camera = try_apply(
                f"lens.asset.apply={lens_asset}",
                lambda: camera_set(camera, "oi", oi_asset),
                warnings,
                applied,
            ) or camera
            raytrace_asset_applied = True
            warnings.append(
                "Selected raytrace optics controls geometric optics for this run. "
                "F-number, focal length, HFOV, and transmittance numeric controls are not applied because they can invalidate "
                "the loaded ray-trace analysis."
            )
    elif lens_mode in {"catalogLens", "lensFileReference"} and lens_asset:
        camera, catalog_lens_applied = apply_catalog_lens_asset(camera, lens_asset, store, warnings, applied)
    color_filter_asset = str(assets_req.get("colorFilterAsset", "") or "")
    if color_filter_asset:
        camera, _ = apply_sensor_reference_asset(camera, color_filter_asset, store, warnings, applied)

    if raytrace_asset_applied and any(key in lens_req for key in ["fNumber", "focalLengthMm", "hfovDeg", "transmittanceScale"]):
        applied.append("lens.geometry.lockedByRaytraceAsset")
    if catalog_lens_applied and any(key in lens_req for key in ["fNumber", "focalLengthMm", "hfovDeg", "transmittanceScale"]):
        applied.append("lens.geometry.lockedByCatalogLens")

    lens_geometry_locked = raytrace_asset_applied or catalog_lens_applied
    if "fNumber" in lens_req and not lens_geometry_locked:
        camera = try_apply(
            f"lens.fNumber={lens_req['fNumber']}",
            lambda: camera_set(camera, "optics fnumber", safe_float(lens_req["fNumber"], 4.0)),
            warnings,
            applied,
        ) or camera
    if "focalLengthMm" in lens_req and not lens_geometry_locked:
        camera = try_apply(
            f"lens.focalLengthMm={lens_req['focalLengthMm']}",
            lambda: camera_set(camera, "optics focal length", safe_float(lens_req["focalLengthMm"], 4.0) / 1000.0),
            warnings,
            applied,
        ) or camera
    if "hfovDeg" in lens_req and not lens_geometry_locked:
        if fov_authority == "manualOiHfov":
            camera = try_apply(
                f"lens.hfovDeg={lens_req['hfovDeg']}",
                lambda: camera_set(camera, "oi fov", safe_float(lens_req["hfovDeg"], 10.0)),
                warnings,
                applied,
            ) or camera
        else:
            applied.append(f"lens.hfovDeg.deferredToFovAuthority={fov_authority}")
    if "transmittanceScale" in lens_req and not lens_geometry_locked:
        wave = np.asarray(oi_get(camera.fields["oi"], "wave"), dtype=float).reshape(-1)
        scale = np.full(wave.size, clamp(safe_float(lens_req["transmittanceScale"], 1.0), 0.0, 1.0), dtype=float)
        camera = try_apply(
            f"lens.transmittanceScale={lens_req['transmittanceScale']}",
            lambda: camera_set(camera, "oi transmittance", scale),
            warnings,
            applied,
        ) or camera

    if "rows" in sensor_req and "cols" in sensor_req:
        camera = try_apply(
            f"sensor.size={sensor_req['rows']}x{sensor_req['cols']}",
            lambda: camera_set(camera, "sensor size", [safe_int(sensor_req["rows"], 72), safe_int(sensor_req["cols"], 88)]),
            warnings,
            applied,
        ) or camera
    if "pixelSizeUm" in sensor_req:
        camera = try_apply(
            f"sensor.pixelSizeUm={sensor_req['pixelSizeUm']}",
            lambda: camera_set(camera, "pixel size", safe_float(sensor_req["pixelSizeUm"], 2.8) * 1.0e-6),
            warnings,
            applied,
        ) or camera
    if "exposureMs" in sensor_req:
        camera = try_apply(
            f"sensor.exposureMs={sensor_req['exposureMs']}",
            lambda: camera_set(camera, "sensor exposure time", safe_float(sensor_req["exposureMs"], 8.0) / 1000.0),
            warnings,
            applied,
        ) or camera
    if "analogGain" in sensor_req:
        camera = try_apply(
            f"sensor.analogGain={sensor_req['analogGain']}",
            lambda: camera_set(camera, "sensor analog gain", safe_float(sensor_req["analogGain"], 1.0)),
            warnings,
            applied,
        ) or camera
    if "noiseFlag" in sensor_req:
        camera = try_apply(
            f"sensor.noiseFlag={sensor_req['noiseFlag']}",
            lambda: camera_set(camera, "sensor noise flag", safe_int(sensor_req["noiseFlag"], 2)),
            warnings,
            applied,
        ) or camera
    if "readNoiseMv" in sensor_req:
        camera = try_apply(
            f"sensor.readNoiseMv={sensor_req['readNoiseMv']}",
            lambda: camera_set(camera, "pixel read noise volts", safe_float(sensor_req["readNoiseMv"], 2.0) / 1000.0),
            warnings,
            applied,
        ) or camera
    if "qeScale" in sensor_req:
        camera = try_apply(
            f"sensor.qeScale={sensor_req['qeScale']}",
            lambda: camera_set(camera, "sensor pixel qe", clamp(safe_float(sensor_req["qeScale"], 1.0), 0.1, 2.0)),
            warnings,
            applied,
        ) or camera
    if "bitDepth" in sensor_req:
        camera = try_apply(
            f"sensor.bitDepth={sensor_req['bitDepth']}",
            lambda: camera_set(camera, "sensor nbits", safe_int(sensor_req["bitDepth"], 12)),
            warnings,
            applied,
        ) or camera

    if "demosaicMethod" in isp_req:
        camera = try_apply(
            f"isp.demosaicMethod={isp_req['demosaicMethod']}",
            lambda: camera_set(camera, "ip demosaic method", str(isp_req["demosaicMethod"])),
            warnings,
            applied,
        ) or camera
    if "sensorConversionMethod" in isp_req:
        camera = try_apply(
            f"isp.sensorConversionMethod={isp_req['sensorConversionMethod']}",
            lambda: camera_set(camera, "ip sensor conversion method", str(isp_req["sensorConversionMethod"])),
            warnings,
            applied,
        ) or camera
    if "internalColorSpace" in isp_req:
        camera = try_apply(
            f"isp.internalColorSpace={isp_req['internalColorSpace']}",
            lambda: camera_set(camera, "ip internal cs", str(isp_req["internalColorSpace"])),
            warnings,
            applied,
        ) or camera
    if "illuminantCorrection" in isp_req:
        camera = try_apply(
            f"isp.illuminantCorrection={isp_req['illuminantCorrection']}",
            lambda: camera_set(camera, "ip illuminant correction method", str(isp_req["illuminantCorrection"])),
            warnings,
            applied,
        ) or camera
    if "renderScale" in isp_req:
        camera = try_apply(
            f"isp.renderScale={safe_bool(isp_req['renderScale'], True)}",
            lambda: camera_set(camera, "ip render scale", safe_bool(isp_req["renderScale"], True)),
            warnings,
            applied,
        ) or camera
    if safe_bool(isp_req.get("renderDemosaicOnly", False), False):
        camera = try_apply(
            "isp.renderDemosaicOnly=True",
            lambda: camera_set(camera, "ip render demosaic only", True),
            warnings,
            applied,
        ) or camera

    return camera


def resolve_fov_authority(camera, scene, request, warnings, applied):
    assets_req = request.get("assets", {})
    lens_req = request.get("lens", {})
    sensor_req = request.get("sensor", {})
    requested_authority = valid_fov_authority(lens_req.get("fovAuthority", "physicalGeometry"), warnings)
    lens_mode = str(assets_req.get("lensMode", "none") or "none")
    has_lens_asset = bool(assets_req.get("lensAsset")) and lens_mode in {"raytraceOptics", "catalogLens", "lensFileReference"}

    if has_lens_asset:
        if requested_authority != "lensAsset":
            warnings.append(
                "FOV authority was forced to lensAsset because a lens/raytrace asset owns optics geometry. "
                f"Requested authority was {requested_authority}."
            )
        applied.append(f"fov.authority=lensAsset:{lens_mode}")
        return camera, scene, "lensAsset"

    if requested_authority == "lensAsset":
        warnings.append("lens.fovAuthority=lensAsset requested, but no lens asset is selected; physicalGeometry is used.")
        requested_authority = "physicalGeometry"

    if requested_authority in {"physicalGeometry", "numericOptics"}:
        hfov = physical_hfov_deg(
            sensor_req.get("cols", 0),
            sensor_req.get("pixelSizeUm", 0),
            lens_req.get("focalLengthMm", 0),
        )
        if hfov is None:
            warnings.append("Physical camera FOV could not be computed; manual lens.hfovDeg is used.")
            hfov = safe_float(lens_req.get("hfovDeg", 10.0), 10.0)
            resolved_authority = "manualOiHfov"
        else:
            resolved_authority = requested_authority
        camera = try_apply(
            f"fov.authority.{resolved_authority}.hfovDeg={hfov:.4g}",
            lambda: camera_set(camera, "oi fov", hfov),
            warnings,
            applied,
        ) or camera
        current_scene_fov = safe_float(scene_get(scene, "fov"), hfov)
        if abs(current_scene_fov - hfov) > 0.5:
            warnings.append(
                "CameraE2E synthetic target FOV was aligned to the physical camera HFOV so CameraE2E does not override the selected FOV authority. "
                f"requested scene FOV {current_scene_fov:.2f} deg, resolved {hfov:.2f} deg."
            )
            scene = try_apply(
                f"scene.fovDeg.resolvedByFovAuthority={hfov:.4g}",
                lambda: scene_set(scene, "fov", hfov),
                warnings,
                applied,
            ) or scene
        return camera, scene, resolved_authority

    if requested_authority == "sceneTarget":
        scene_fov = safe_float(scene_get(scene, "fov"), 10.0)
        camera = try_apply(
            f"fov.authority.sceneTarget.hfovDeg={scene_fov:.4g}",
            lambda: camera_set(camera, "oi fov", scene_fov),
            warnings,
            applied,
        ) or camera
        return camera, scene, "sceneTarget"

    manual_hfov = safe_float(lens_req.get("hfovDeg", 10.0), 10.0)
    camera = try_apply(
        f"fov.authority.manualOiHfov.hfovDeg={manual_hfov:.4g}",
        lambda: camera_set(camera, "oi fov", manual_hfov),
        warnings,
        applied,
    ) or camera
    current_scene_fov = safe_float(scene_get(scene, "fov"), manual_hfov)
    if abs(current_scene_fov - manual_hfov) > 0.5:
        warnings.append(
            "Scene FOV was resolved to the manual OI HFOV so CameraE2E does not override the selected FOV authority. "
            f"requested scene FOV {current_scene_fov:.2f} deg, resolved {manual_hfov:.2f} deg."
        )
        scene = try_apply(
            f"scene.fovDeg.resolvedByFovAuthority={manual_hfov:.4g}",
            lambda: scene_set(scene, "fov", manual_hfov),
            warnings,
            applied,
        ) or scene
    return camera, scene, "manualOiHfov"


def align_scene_to_camera_asset(scene, camera, request, warnings, applied):
    assets_req = request.get("assets", {})
    if assets_req.get("lensMode") != "raytraceOptics" or not assets_req.get("lensAsset"):
        return scene
    try:
        max_diagonal_fov = float(oi_get(camera.fields["oi"], "optics rt fov"))
        scene_fov = float(scene_get(scene, "fov"))
        scene_diagonal_fov = float(
            np.rad2deg(
                2.0
                * np.arctan(
                    np.sqrt(2.0) * np.tan(np.deg2rad(scene_fov) / 2.0)
                )
            )
        )
    except Exception:
        return scene
    if scene_diagonal_fov <= max_diagonal_fov:
        return scene
    target_diagonal = max(0.1, max_diagonal_fov * 0.98)
    clamped_fov = float(
        np.rad2deg(2.0 * np.arctan(np.tan(np.deg2rad(target_diagonal) / 2.0) / np.sqrt(2.0)))
    )
    warnings.append(
        "Scene FOV exceeds selected raytrace optics analysis. "
        f"Scene HFOV was clamped from {scene_fov:.2f} deg to {clamped_fov:.2f} deg "
        f"because the raytrace diagonal FOV limit is {max_diagonal_fov:.2f} deg."
    )
    return try_apply(
        f"scene.fovDeg.clampedToRaytraceAsset={clamped_fov:.2f}",
        lambda: scene_set(scene, "fov", clamped_fov),
        warnings,
        applied,
    ) or scene


def proxy_perception_metrics(srgb, request):
    perception = request.get("perception", {})
    threshold = safe_float(perception.get("confidenceThreshold", 0.35), 0.35)
    gray = np.mean(np.asarray(srgb, dtype=float), axis=2)
    gx = np.abs(np.diff(gray, axis=1)).mean() if gray.shape[1] > 1 else 0.0
    gy = np.abs(np.diff(gray, axis=0)).mean() if gray.shape[0] > 1 else 0.0
    edge_energy = float((gx + gy) * 0.5)
    mean_luma = float(np.mean(gray))
    saturation = float(np.mean(np.asarray(srgb) >= 0.98))
    proxy_conf = clamp(0.35 + edge_energy * 2.2 + mean_luma * 0.25 - saturation * 0.4, 0.0, 1.0)
    return {
        "adapterStatus": "proxy_only",
        "model": str(perception.get("model", "detector_adapter_pending")),
        "inputSize": str(perception.get("inputSize", "1280x704")),
        "confidenceThreshold": threshold,
        "nmsThreshold": safe_float(perception.get("nmsThreshold", 0.5), 0.5),
        "proxyConfidence": round(proxy_conf, 4),
        "proxyAccepted": bool(proxy_conf >= threshold),
        "edgeEnergy": round(edge_energy, 4),
        "meanLuma": round(mean_luma, 4),
        "saturationRatio": round(saturation, 4),
        "warning": "No real detector was executed. This is an image-quality proxy until a perception adapter is connected.",
    }


def parse_perception_size(value, fallback_shape):
    match = re.search(r"(\d+)\s*[xX, ]\s*(\d+)", str(value or ""))
    if not match:
        height = int(fallback_shape[0]) if len(fallback_shape) > 0 else 0
        width = int(fallback_shape[1]) if len(fallback_shape) > 1 else 0
        return width, height
    width = max(1, safe_int(match.group(1), fallback_shape[1] if len(fallback_shape) > 1 else 1))
    height = max(1, safe_int(match.group(2), fallback_shape[0] if len(fallback_shape) > 0 else 1))
    return width, height


def resize_rgb_nearest(image, input_size):
    values = _normalized_srgb(image)
    width, height = parse_perception_size(input_size, values.shape)
    if values.shape[0] == height and values.shape[1] == width:
        return values
    row_idx = np.linspace(0, max(values.shape[0] - 1, 0), height).round().astype(int)
    col_idx = np.linspace(0, max(values.shape[1] - 1, 0), width).round().astype(int)
    return values[row_idx][:, col_idx]


def camera_e2e_task_perception_metrics(srgb, request, run_dir, warnings, applied):
    perception = request.get("perception", {}) or {}
    model_name = str(perception.get("model", "ultralytics_yolo11n_detection") or "ultralytics_yolo11n_detection")
    threshold = safe_float(perception.get("confidenceThreshold", 0.35), 0.35)
    nms = safe_float(perception.get("nmsThreshold", 0.5), 0.5)
    input_size = str(perception.get("inputSize", "640x384") or "640x384")

    if model_name in {"", "proxy_detector_v0", "detector_adapter_pending", "none"}:
        proxy = proxy_perception_metrics(srgb, request)
        proxy["fallbackReason"] = "No CameraE2E task perception model profile was selected."
        return proxy

    if not TASK_PERCEPTION_AVAILABLE:
        proxy = proxy_perception_metrics(srgb, request)
        proxy["adapterStatus"] = "task_perception_unavailable"
        proxy["fallbackReason"] = TASK_PERCEPTION_IMPORT_ERROR
        warnings.append(f"CameraE2E task perception import failed; proxy metrics used. {TASK_PERCEPTION_IMPORT_ERROR}")
        return proxy

    try:
        start_model = time.perf_counter()
        inference_options = {"inference": {"iou": nms}}
        device = str(perception.get("device", "cpu") or "cpu")
        profile_names = set(task_model_profile_names())
        if model_name in profile_names:
            model_config = task_model_config_from_profile(
                model_name,
                device=device,
                score_threshold=threshold,
                options=inference_options,
            )
        else:
            model_config = task_model_config(
                {
                    "name": model_name,
                    "backend": "ultralytics_yolo",
                    "task": "detection",
                    "model_id": model_name,
                    "device": device,
                    "score_threshold": threshold,
                    "options": inference_options,
                }
            )

        model_image = resize_rgb_nearest(srgb, input_size)
        adapter = task_model_from_config(model_config)
        task_config = task_perception_config(score_threshold=threshold, max_detections=100)
        boxes = adapter.detect(model_image, task_config)
        elapsed_ms = (time.perf_counter() - start_model) * 1000.0
        detections = [box.to_dict() for box in boxes]
        accepted = [box for box in boxes if float(box.score) >= threshold]
        top = max(boxes, key=lambda box: float(box.score), default=None)
        overlay = render_detection_overlay(model_image, boxes)
        overlay_path = save_rgb(run_dir / "perception_detection_overlay.png", overlay)
        applied.append(f"perception.model={model_config.name}:{model_config.backend}")
        applied.append(f"perception.inputSize={input_size}")
        return {
            "adapterStatus": "camera_e2e_task_perception",
            "model": str(model_config.name),
            "backend": str(model_config.backend),
            "task": str(model_config.task),
            "modelId": model_config.model_id,
            "device": str(model_config.device),
            "inputSize": input_size,
            "inputImageShape": [int(value) for value in model_image.shape],
            "confidenceThreshold": threshold,
            "nmsThreshold": nms,
            "elapsedMs": round(float(elapsed_ms), 3),
            "detectionCount": int(len(boxes)),
            "acceptedCount": int(len(accepted)),
            "topLabel": "" if top is None else str(top.label),
            "topScore": None if top is None else round(float(top.score), 4),
            "detections": detections,
            "overlayPath": overlay_path,
        }
    except Exception as exc:
        proxy = proxy_perception_metrics(srgb, request)
        proxy["adapterStatus"] = "task_perception_failed_fallback"
        proxy["fallbackReason"] = f"{type(exc).__name__}: {exc}"
        warnings.append(f"CameraE2E task perception failed; proxy metrics used. {type(exc).__name__}: {exc}")
        return proxy


def _normalized_srgb(srgb):
    image = np.asarray(srgb, dtype=float)
    if image.ndim == 2:
        image = np.repeat(image[:, :, None], 3, axis=2)
    if image.ndim == 3 and image.shape[2] > 3:
        image = image[:, :, :3]
    if image.size == 0:
        return np.zeros((1, 1, 3), dtype=float)
    if float(np.nanmax(image)) > 1.0 or float(np.nanmin(image)) < 0.0:
        lo = float(np.nanpercentile(image, 1.0))
        hi = float(np.nanpercentile(image, 99.0))
        image = (image - lo) / max(hi - lo, 1.0e-12)
    return np.clip(image, 0.0, 1.0)


def _image_measurements(srgb, sensor_volts=None):
    image = _normalized_srgb(srgb)
    gray = np.mean(image, axis=2)
    centered = gray - float(np.mean(gray))
    if min(gray.shape) < 2:
        gx = gy = np.asarray([0.0])
    else:
        gx = np.diff(gray, axis=1)
        gy = np.diff(gray, axis=0)
    acutance = float((np.mean(np.abs(gx)) + np.mean(np.abs(gy))) * 0.5)
    saturation = float(np.mean(image >= 0.98))
    underexposure = float(np.mean(image <= 0.02))
    mean_luma = float(np.mean(gray))
    luma_std = float(np.std(gray))
    uniformity_error = float(luma_std / max(mean_luma, 1.0e-6))
    snr_db = float(20.0 * np.log10(max(mean_luma, 1.0e-6) / max(luma_std, 1.0e-6)))

    fft = np.abs(np.fft.fftshift(np.fft.fft2(centered)))
    power = fft * fft
    rows, cols = gray.shape
    yy, xx = np.indices(gray.shape)
    radius = np.sqrt(((yy - rows / 2.0) / max(rows, 1)) ** 2 + ((xx - cols / 2.0) / max(cols, 1)) ** 2)
    total_power = float(np.sum(power)) + 1.0e-12
    high_frequency_ratio = float(np.sum(power[radius > 0.22]) / total_power)
    bins = np.linspace(0.0, 0.5, 28)
    radial_profile = []
    for lo, hi in zip(bins[:-1], bins[1:]):
        mask = (radius >= lo) & (radius < hi)
        radial_profile.append(float(np.mean(power[mask])) if np.any(mask) else 0.0)
    profile = np.asarray(radial_profile, dtype=float)
    if profile.size and float(np.max(profile)) > 0.0:
        profile = profile / float(np.max(profile))
    mtf50 = 0.0
    for index, value in enumerate(profile[1:], start=1):
        if value <= 0.5:
            mtf50 = float((bins[index] + bins[index + 1]) * 0.5)
            break
    if mtf50 == 0.0 and profile.size:
        mtf50 = float((bins[-2] + bins[-1]) * 0.5)

    volts = np.asarray(sensor_volts if sensor_volts is not None else np.empty(0), dtype=float)
    if volts.size:
        volt_mean = float(np.mean(volts))
        volt_std = float(np.std(volts))
        volt_snr_db = float(20.0 * np.log10(max(abs(volt_mean), 1.0e-9) / max(volt_std, 1.0e-9)))
        volt_p99 = float(np.percentile(volts, 99))
    else:
        volt_mean = volt_std = volt_snr_db = volt_p99 = None

    return {
        "meanLuma": mean_luma,
        "lumaStd": luma_std,
        "snrDb": snr_db,
        "voltageSnrDb": volt_snr_db,
        "voltageP99": volt_p99,
        "saturationRatio": saturation,
        "underexposureRatio": underexposure,
        "uniformityError": uniformity_error,
        "acutance": acutance,
        "highFrequencyRatio": high_frequency_ratio,
        "mtf50CyclesPerPixel": mtf50,
    }


def _safe_metric_float(value, fallback=0.0):
    try:
        numeric = float(value)
        if not np.isfinite(numeric):
            return fallback
        return numeric
    except Exception:
        return fallback


def _chart_value(value, precision=4):
    try:
        numeric = float(value)
        if not np.isfinite(numeric):
            return None
        return round(numeric, precision)
    except Exception:
        return None


def _downsample_curve(x_values, *series_values, limit=96):
    x = np.asarray(x_values, dtype=float).reshape(-1)
    series = []
    for values in series_values:
        item = np.asarray(values, dtype=float).reshape(-1)
        if item.size == 1 and x.size > 1:
            item = np.full(x.shape, float(item[0]), dtype=float)
        series.append(item)
    if x.size == 0:
        return x, series
    usable = min([x.size, *[item.size for item in series]])
    x = x[:usable]
    series = [item[:usable] for item in series]
    if usable <= int(limit):
        return x, series
    indices = np.unique(np.linspace(0, usable - 1, int(limit)).round().astype(int))
    return x[indices], [item[indices] for item in series]


def _metric_value(metric):
    value = metric.get("value", "-") if isinstance(metric, dict) else "-"
    unit = metric.get("unit", "") if isinstance(metric, dict) else ""
    return value, unit


def _fft_profile(gray, bin_count=18):
    image = np.asarray(gray, dtype=float)
    if image.size == 0 or min(image.shape) < 4:
        return np.linspace(0.0, 0.5, bin_count).tolist(), np.zeros(bin_count, dtype=float).tolist()
    image = image - float(np.mean(image))
    window_y = np.hanning(image.shape[0])[:, None]
    window_x = np.hanning(image.shape[1])[None, :]
    fft = np.abs(np.fft.fftshift(np.fft.fft2(image * window_y * window_x)))
    power = fft * fft
    rows, cols = image.shape
    yy, xx = np.indices(image.shape)
    radius = np.sqrt(((yy - rows / 2.0) / max(rows, 1)) ** 2 + ((xx - cols / 2.0) / max(cols, 1)) ** 2)
    bins = np.linspace(0.0, 0.5, bin_count + 1)
    values = []
    for lo, hi in zip(bins[:-1], bins[1:]):
        mask = (radius >= lo) & (radius < hi)
        values.append(float(np.mean(power[mask])) if np.any(mask) else 0.0)
    values = np.asarray(values, dtype=float)
    peak = float(np.max(values)) if values.size else 0.0
    if peak > 0.0:
        values = values / peak
    centers = ((bins[:-1] + bins[1:]) * 0.5).tolist()
    return centers, values.tolist()


def _crop_fraction(gray, top, left, height, width):
    rows, cols = gray.shape
    y0 = max(0, min(rows - 1, int(rows * top)))
    x0 = max(0, min(cols - 1, int(cols * left)))
    y1 = max(y0 + 2, min(rows, int(rows * (top + height))))
    x1 = max(x0 + 2, min(cols, int(cols * (left + width))))
    return gray[y0:y1, x0:x1]


def _mtf_frequency_chart(srgb):
    image = _normalized_srgb(srgb)
    gray = np.mean(image, axis=2)
    regions = {
        "center": _crop_fraction(gray, 0.24, 0.24, 0.52, 0.52),
        "midField": np.concatenate(
            [
                _crop_fraction(gray, 0.08, 0.24, 0.16, 0.52),
                _crop_fraction(gray, 0.76, 0.24, 0.16, 0.52),
            ],
            axis=0,
        ),
        "edge": np.concatenate(
            [
                _crop_fraction(gray, 0.08, 0.04, 0.84, 0.16),
                _crop_fraction(gray, 0.08, 0.80, 0.84, 0.16),
            ],
            axis=1,
        ),
    }
    frequencies, center = _fft_profile(regions["center"])
    _, mid_field = _fft_profile(regions["midField"])
    _, edge = _fft_profile(regions["edge"])
    data = []
    for index, frequency in enumerate(frequencies):
        data.append(
            {
                "frequency": round(float(frequency), 3),
                "center": round(_safe_metric_float(center[index]), 3),
                "midField": round(_safe_metric_float(mid_field[index]), 3),
                "edge": round(_safe_metric_float(edge[index]), 3),
            }
        )
    return {
        "id": "mtf_frequency_proxy",
        "title": "Image-derived MTF estimate by spatial frequency",
        "description": "FFT-derived response by image field. It is a practical trend curve, not ISO eSFR.",
        "kind": "line",
        "xKey": "frequency",
        "xLabel": "cycles / pixel",
        "yLabel": "normalized response",
        "data": data,
        "series": [
            {"key": "center", "label": "Center", "color": "#00e5ff"},
            {"key": "midField", "label": "Mid-field", "color": "#2ef5a9"},
            {"key": "edge", "label": "Edge", "color": "#f2c85b"},
        ],
    }


def _macbeth_patch_chart(srgb):
    image = _normalized_srgb(srgb)
    rows, cols = image.shape[:2]
    data = []
    if rows < 4 or cols < 6:
        return data
    reference = MACBETH_REFERENCE / max(float(np.percentile(MACBETH_REFERENCE, 95)), 1.0e-6)
    patch_index = 0
    for row in range(4):
        for col in range(6):
            y0 = int(row * rows / 4)
            y1 = int((row + 1) * rows / 4)
            x0 = int(col * cols / 6)
            x1 = int((col + 1) * cols / 6)
            patch = image[y0:y1, x0:x1, :]
            mean_rgb = np.mean(patch.reshape(-1, 3), axis=0)
            observed = mean_rgb / max(float(np.percentile(image, 95)), 1.0e-6)
            delta = float(np.sqrt(np.sum((observed - reference[patch_index]) ** 2)) * 18.0)
            clipping = float(np.mean(patch >= 0.98) * 100.0)
            luma = float(np.mean(mean_rgb) * 100.0)
            data.append(
                {
                    "patch": f"P{patch_index + 1}",
                    "deltaE": round(delta, 2),
                    "clippingPct": round(clipping, 2),
                    "lumaPct": round(luma, 2),
                }
            )
            patch_index += 1
    return data


def _noise_signal_chart(srgb, sensor_volts=None):
    image = _normalized_srgb(srgb)
    if sensor_volts is not None and np.asarray(sensor_volts).size:
        source = np.asarray(sensor_volts, dtype=float)
        if source.ndim == 3:
            source = np.mean(source, axis=2)
    else:
        source = np.mean(image, axis=2)
    if source.size == 0:
        return []
    rows, cols = source.shape[:2]
    block = max(4, min(rows, cols) // 12)
    samples = []
    for y0 in range(0, max(rows - block + 1, 1), block):
        for x0 in range(0, max(cols - block + 1, 1), block):
            patch = source[y0 : min(y0 + block, rows), x0 : min(x0 + block, cols)]
            if patch.size:
                samples.append((float(np.mean(patch)), float(np.std(patch))))
    if not samples:
        return []
    samples = sorted(samples, key=lambda item: item[0])
    bucket_count = min(10, max(4, len(samples) // 3))
    buckets = np.array_split(np.asarray(samples, dtype=float), bucket_count)
    data = []
    full_scale = max(float(np.percentile(source, 99.0)), 1.0e-9)
    for index, bucket in enumerate(buckets):
        if bucket.size == 0:
            continue
        signal = float(np.mean(bucket[:, 0]))
        noise = float(np.mean(bucket[:, 1]))
        snr = 20.0 * np.log10(max(abs(signal), 1.0e-9) / max(noise, 1.0e-9))
        data.append(
            {
                "bucket": f"B{index + 1}",
                "signalPct": round(signal / full_scale * 100.0, 2),
                "noisePct": round(noise / full_scale * 100.0, 3),
                "snrDb": round(float(snr), 2),
            }
        )
    return data


def _psf_radial_chart(srgb):
    image = _normalized_srgb(srgb)
    gray = np.mean(image, axis=2)
    threshold = float(np.percentile(gray, 99.3))
    yy, xx = np.indices(gray.shape)
    weights = np.maximum(gray - threshold, 0.0)
    total = float(np.sum(weights))
    if total <= 1.0e-12:
        return []
    cx = float(np.sum(xx * weights) / total)
    cy = float(np.sum(yy * weights) / total)
    radius = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    max_radius = min(18, max(4, int(min(gray.shape) / 5)))
    peak = float(np.max(weights)) or 1.0
    data = []
    for radius_px in range(max_radius + 1):
        mask = (radius >= radius_px) & (radius < radius_px + 1)
        intensity = float(np.mean(weights[mask]) / peak) if np.any(mask) else 0.0
        data.append({"radiusPx": radius_px, "relativeIntensity": round(intensity, 4)})
    return data


def _frequency_energy_chart(srgb, title, description, key="response"):
    image = _normalized_srgb(srgb)
    gray = np.mean(image, axis=2)
    frequencies, response = _fft_profile(gray)
    data = [
        {
            "frequency": round(float(frequency), 3),
            key: round(_safe_metric_float(value), 3),
        }
        for frequency, value in zip(frequencies, response)
    ]
    return {
        "id": key,
        "title": title,
        "description": description,
        "kind": "area",
        "xKey": "frequency",
        "xLabel": "cycles / pixel",
        "yLabel": "normalized response",
        "data": data,
        "series": [{"key": key, "label": title, "color": "#00e5ff"}],
    }


def _luma_histogram_chart(srgb):
    image = _normalized_srgb(srgb)
    luma = np.mean(image, axis=2)
    red = image[:, :, 0]
    green = image[:, :, 1]
    blue = image[:, :, 2]
    bins = np.linspace(0.0, 1.0, 13)
    data = []
    for lo, hi in zip(bins[:-1], bins[1:]):
        label = f"{lo:.2f}-{hi:.2f}"
        mask = (luma >= lo) & (luma < hi if hi < 1.0 else luma <= hi)
        data.append(
            {
                "bin": label,
                "lumaPct": round(float(np.mean(mask) * 100.0), 2),
                "redMean": round(float(np.mean(red[mask]) * 100.0), 2) if np.any(mask) else 0.0,
                "greenMean": round(float(np.mean(green[mask]) * 100.0), 2) if np.any(mask) else 0.0,
                "blueMean": round(float(np.mean(blue[mask]) * 100.0), 2) if np.any(mask) else 0.0,
            }
        )
    return {
        "id": "tone_histogram",
        "title": "Output tone distribution",
        "description": "Final sRGB luma occupancy and channel balance after ISP.",
        "kind": "bar",
        "xKey": "bin",
        "xLabel": "sRGB luma bin",
        "yLabel": "% pixels / channel mean",
        "data": data,
        "series": [
            {"key": "lumaPct", "label": "Luma occupancy", "color": "#00e5ff", "unit": "%"},
            {"key": "redMean", "label": "R mean", "color": "#fb7185", "unit": "%"},
            {"key": "greenMean", "label": "G mean", "color": "#2ef5a9", "unit": "%"},
            {"key": "blueMean", "label": "B mean", "color": "#60a5fa", "unit": "%"},
        ],
    }


def _mtf_function_payload(camera, store):
    mtf_result = camera_mtf(camera.clone(), asset_store=store)
    acutance_value = camera_acutance(camera.clone(), asset_store=store)
    freq = np.asarray(mtf_result.freq, dtype=float).reshape(-1)
    mtf = np.asarray(mtf_result.mtf, dtype=float)
    if mtf.ndim == 1:
        mtf = mtf.reshape(-1, 1)
    freq, series = _downsample_curve(
        freq,
        mtf[:, 0],
        mtf[:, 1] if mtf.shape[1] > 1 else mtf[:, 0],
        mtf[:, 2] if mtf.shape[1] > 2 else mtf[:, 0],
        mtf[:, 3] if mtf.shape[1] > 3 else np.mean(mtf[:, : min(3, mtf.shape[1])], axis=1),
    )
    data = []
    for index, frequency in enumerate(freq):
        data.append(
            {
                "frequency": _chart_value(frequency, 3),
                "red": _chart_value(series[0][index], 4),
                "green": _chart_value(series[1][index], 4),
                "blue": _chart_value(series[2][index], 4),
                "luma": _chart_value(series[3][index], 4),
            }
        )
    return {
        "metrics": [
            _static_metric("MTF50", mtf_result.mtf50, "cycles/mm", "CameraE2E", "camera_mtf ISO 12233 slanted-edge result."),
            _static_metric("Nyquist", mtf_result.nyquistf, "cycles/mm", "CameraE2E", "camera_mtf Nyquist frequency."),
            _static_metric("Aliasing", mtf_result.aliasingPercentage, "%", "CameraE2E", "camera_mtf aliasing percentage."),
            _static_metric("Acutance", acutance_value, "", "CameraE2E", "camera_acutance ISO/CPIQ weighted luminance MTF."),
        ],
        "charts": [
            {
                "id": "camera_e2e_mtf",
                "title": "CameraE2E MTF by spatial frequency",
                "description": "camera_mtf() ISO 12233 slanted-edge response. Frequency is reported in cycles/mm.",
                "kind": "line",
                "xKey": "frequency",
                "xLabel": "cycles / mm",
                "yLabel": "MTF",
                "data": data,
                "series": [
                    {"key": "red", "label": "R", "color": "#fb7185"},
                    {"key": "green", "label": "G", "color": "#2ef5a9"},
                    {"key": "blue", "label": "B", "color": "#60a5fa"},
                    {"key": "luma", "label": "Luma", "color": "#f2c85b"},
                ],
            }
        ],
    }


def _color_accuracy_function_payload(camera, store):
    color_accuracy, _ = camera_color_accuracy(camera.clone(), asset_store=store)
    delta_e = np.asarray(color_accuracy.get("deltaE", np.empty(0)), dtype=float).reshape(-1)
    macbeth_xyz = np.asarray(color_accuracy.get("macbethXYZ", np.empty((0, 3))), dtype=float)
    ideal_xyz = np.asarray(color_accuracy.get("idealXYZ", np.empty((0, 3))), dtype=float)
    data = []
    for index, delta in enumerate(delta_e):
        row = {
            "patch": f"P{index + 1}",
            "deltaE": _chart_value(delta, 3),
        }
        if macbeth_xyz.ndim == 2 and macbeth_xyz.shape[0] > index and macbeth_xyz.shape[1] >= 2:
            row["measuredY"] = _chart_value(macbeth_xyz[index, 1], 3)
        if ideal_xyz.ndim == 2 and ideal_xyz.shape[0] > index and ideal_xyz.shape[1] >= 2:
            row["idealY"] = _chart_value(ideal_xyz[index, 1], 3)
        data.append(row)
    white = np.asarray(color_accuracy.get("whiteXYZ", np.empty(0)), dtype=float).reshape(-1)
    ideal_white = np.asarray(color_accuracy.get("idealWhiteXYZ", np.empty(0)), dtype=float).reshape(-1)
    white_error = None
    if white.size >= 3 and ideal_white.size >= 3:
        white_error = float(np.linalg.norm((white / max(float(white[1]), 1.0e-12)) - (ideal_white / max(float(ideal_white[1]), 1.0e-12))))
    return {
        "metrics": [
            _static_metric("DeltaE mean", float(np.mean(delta_e)) if delta_e.size else None, "", "CameraE2E", "camera_color_accuracy Macbeth mean Delta E."),
            _static_metric("DeltaE max", float(np.max(delta_e)) if delta_e.size else None, "", "CameraE2E", "Worst Macbeth patch Delta E."),
            _static_metric("White point error", white_error, "", "CameraE2E", "Normalized measured-vs-ideal Macbeth white XYZ error."),
        ],
        "charts": [
            {
                "id": "camera_e2e_macbeth_delta_e",
                "title": "CameraE2E Macbeth color error",
                "description": "camera_color_accuracy() patch-level Delta E with measured and ideal Y response.",
                "kind": "bar",
                "xKey": "patch",
                "xLabel": "Macbeth patch",
                "yLabel": "Delta E / Y",
                "data": data,
                "series": [
                    {"key": "deltaE", "label": "Delta E", "color": "#00e5ff"},
                    {"key": "measuredY", "label": "Measured Y", "color": "#f2c85b"},
                    {"key": "idealY", "label": "Ideal Y", "color": "#a568ff"},
                ],
            }
        ],
    }


def _sensor_qe_function_payload(camera):
    sensor = camera.fields["sensor"]
    wave = np.asarray(sensor_get(sensor, "wave"), dtype=float).reshape(-1)
    qe = np.asarray(sensor_get(sensor, "spectral qe"), dtype=float)
    if qe.ndim == 1:
        qe = qe.reshape(-1, 1)
    if qe.shape[0] != wave.size and qe.shape[1] == wave.size:
        qe = qe.T
    usable_channels = min(qe.shape[1], 8)
    filter_names = list(sensor_get(sensor, "filter names"))
    channel_series = [qe[:, index] for index in range(usable_channels)]
    wave_ds, channel_series_ds = _downsample_curve(wave, *channel_series, limit=96)
    data = []
    for row_index, wavelength in enumerate(wave_ds):
        row = {"wavelength": _chart_value(wavelength, 2)}
        for channel_index in range(usable_channels):
            row[f"ch{channel_index + 1}"] = _chart_value(channel_series_ds[channel_index][row_index], 5)
        data.append(row)

    peak_qe = float(np.nanmax(qe)) if qe.size else None
    mean_qe = float(np.nanmean(qe)) if qe.size else None
    channel_count = int(qe.shape[1]) if qe.ndim == 2 else 1
    series = []
    palette = ["#fb7185", "#2ef5a9", "#60a5fa", "#f2c85b", "#a568ff", "#00e5ff", "#f97316", "#94a3b8"]
    for channel_index in range(usable_channels):
        label = str(filter_names[channel_index]) if channel_index < len(filter_names) else f"Channel {channel_index + 1}"
        series.append(
            {
                "key": f"ch{channel_index + 1}",
                "label": label,
                "color": palette[channel_index % len(palette)],
            }
        )

    return {
        "metrics": [
            _static_metric("Peak spectral QE", peak_qe, "", "CameraE2E", "Peak active sensor spectral QE after CFA/QE/IR/numeric scaling."),
            _static_metric("Mean spectral QE", mean_qe, "", "CameraE2E", "Mean active sensor spectral QE over wavelength and channels."),
            _static_metric("QE channels", channel_count, "", "CameraE2E", "Number of active spectral response channels."),
        ],
        "charts": [
            {
                "id": "camera_e2e_sensor_qe",
                "title": "CameraE2E active sensor QE spectral response",
                "description": "sensor_get(sensor, 'spectral qe') after selected sensor constructor, spectral/QE asset, IR filter, and numeric QE scale are applied.",
                "kind": "line",
                "xKey": "wavelength",
                "xLabel": "wavelength nm",
                "yLabel": "active QE",
                "data": data,
                "series": series,
            }
        ],
    }


def _sensor_snr_function_payload(camera, request, store):
    sensor = camera.fields["sensor"]
    qe_payload = _sensor_qe_function_payload(camera)
    total_snr, volts, shot_snr, read_snr, dsnu_snr, prnu_snr = sensor_snr(sensor)
    volts, series = _downsample_curve(volts, total_snr, shot_snr, read_snr, dsnu_snr, prnu_snr, limit=80)
    data = []
    for index, voltage in enumerate(volts):
        data.append(
            {
                "voltage": _chart_value(voltage, 5),
                "total": _chart_value(series[0][index], 2),
                "shot": _chart_value(series[1][index], 2),
                "read": _chart_value(series[2][index], 2),
                "dsnu": _chart_value(series[3][index], 2),
                "prnu": _chart_value(series[4][index], 2),
            }
        )

    vsnr_metrics = []
    vsnr_chart = None
    try:
        exposure_time = safe_float(request.get("sensor", {}).get("exposureMs", 10.0), 10.0) / 1000.0
        vsnr = camera_vsnr(camera.clone(), [1.0, 10.0, 100.0], exposure_time=exposure_time, asset_store=store)
        vsnr_data = []
        for light, value in zip(np.asarray(vsnr.lightLevels, dtype=float).reshape(-1), np.asarray(vsnr.vSNR, dtype=float).reshape(-1)):
            vsnr_data.append({"luminance": _chart_value(light, 2), "vSNR": _chart_value(value, 5)})
        vsnr_metrics.append(
            _static_metric("VSNR @ 100", np.asarray(vsnr.vSNR, dtype=float).reshape(-1)[-1], "", "CameraE2E", "camera_vsnr value at the brightest validation level.")
        )
        vsnr_chart = {
            "id": "camera_e2e_vsnr",
            "title": "CameraE2E visible SNR by luminance",
            "description": "camera_vsnr() uniform-field visible-noise sweep.",
            "kind": "line",
            "xKey": "luminance",
            "xLabel": "mean luminance cd/m2",
            "yLabel": "vSNR",
            "data": vsnr_data,
            "series": [{"key": "vSNR", "label": "vSNR", "color": "#2ef5a9"}],
        }
    except Exception:
        vsnr_metrics = []
        vsnr_chart = None

    charts = [
        {
            "id": "camera_e2e_sensor_snr",
            "title": "CameraE2E sensor SNR over voltage",
            "description": "sensor_snr() total SNR with shot/read/DSNU/PRNU components.",
            "kind": "line",
            "xKey": "voltage",
            "xLabel": "sensor voltage",
            "yLabel": "SNR dB",
            "data": data,
            "series": [
                {"key": "total", "label": "Total", "color": "#00e5ff", "unit": "dB"},
                {"key": "shot", "label": "Shot", "color": "#2ef5a9", "unit": "dB"},
                {"key": "read", "label": "Read", "color": "#fb7185", "unit": "dB"},
                {"key": "dsnu", "label": "DSNU", "color": "#f2c85b", "unit": "dB"},
                {"key": "prnu", "label": "PRNU", "color": "#a568ff", "unit": "dB"},
            ],
        }
    ]
    if vsnr_chart is not None:
        charts.append(vsnr_chart)
    return {
        "metrics": [
            *qe_payload["metrics"],
            _static_metric("Sensor SNR max", np.asarray(total_snr, dtype=float).reshape(-1)[-1], "dB", "CameraE2E", "sensor_snr at high voltage response."),
            _static_metric("Voltage swing sample", np.asarray(volts, dtype=float).reshape(-1)[-1], "V", "CameraE2E", "Highest sampled response voltage."),
            *vsnr_metrics,
        ],
        "charts": [*qe_payload["charts"], *charts],
    }


def _psf_function_payload(camera):
    oi = camera.fields["oi"]
    psf = np.asarray(rt_psf_interp(oi, field_height_m=0.0, field_angle_deg=0.0, wavelength_nm=550.0), dtype=float)
    if psf.ndim != 2 or psf.size == 0:
        raise ValueError("raytrace PSF interpolation returned an empty PSF.")
    psf_sum = float(np.sum(psf))
    if psf_sum > 0.0:
        psf = psf / psf_sum
    centered = psf
    yy, xx = np.indices(centered.shape)
    peak_row, peak_col = np.unravel_index(int(np.argmax(centered)), centered.shape)
    radius = np.sqrt((yy - peak_row) ** 2 + (xx - peak_col) ** 2)
    max_radius = min(32, max(4, int(np.ceil(float(np.max(radius))))))
    data = []
    for radius_px in range(max_radius + 1):
        mask = (radius >= radius_px) & (radius < radius_px + 1)
        data.append(
            {
                "radiusPx": radius_px,
                "relativeIntensity": _chart_value(float(np.mean(centered[mask]) / max(float(np.max(centered)), 1.0e-12)) if np.any(mask) else 0.0, 5),
            }
        )
    ee50 = psf_find_criterion_radius(centered, 0.5)
    ee80 = psf_find_criterion_radius(centered, 0.8)
    try:
        diameter = oi_psf(oi, "diameter", "units", "um", "wave", 550)
    except Exception:
        diameter = None
    return {
        "metrics": [
            _static_metric("EE50 radius", ee50, "samples", "CameraE2E", "psf_find_criterion_radius on raytrace PSF."),
            _static_metric("EE80 radius", ee80, "samples", "CameraE2E", "psf_find_criterion_radius on raytrace PSF."),
            _static_metric("PSF diameter", diameter, "um", "CameraE2E", "oi_psf thresholded diameter when available."),
        ],
        "charts": [
            {
                "id": "camera_e2e_raytrace_psf_profile",
                "title": "CameraE2E raytrace PSF radial profile",
                "description": "rt_psf_interp() at 550 nm, center field. Radius is in PSF sample units.",
                "kind": "line",
                "xKey": "radiusPx",
                "xLabel": "PSF sample radius",
                "yLabel": "relative intensity",
                "data": data,
                "series": [{"key": "relativeIntensity", "label": "Relative intensity", "color": "#00e5ff"}],
            }
        ],
    }


def _camera_e2e_function_payloads(camera, request, store, warnings):
    payloads = {}
    assets = request.get("assets", {})
    function_specs = {
        "slanted bar": lambda: _mtf_function_payload(camera, store),
        "macbeth": lambda: _color_accuracy_function_payload(camera, store),
        "uniform ee": lambda: _sensor_snr_function_payload(camera, request, store),
    }
    if assets.get("lensMode") == "raytraceOptics" and assets.get("lensAsset"):
        function_specs["point array"] = lambda: _psf_function_payload(camera)
    for scene_type, factory in function_specs.items():
        try:
            payloads[scene_type] = factory()
        except Exception as exc:
            warnings.append(f"CameraE2E metric function for {scene_type} unavailable: {type(exc).__name__}: {exc}")
    return payloads


def _static_charts_for_scene(scene_type, srgb, sensor_volts):
    lower = str(scene_type).lower()
    charts = []
    if lower == "macbeth":
        charts.append(
            {
                "id": "macbeth_patch_response",
                "title": "Macbeth patch response",
                "description": "Image-derived patch color error, clipping, and luma after ISP.",
                "kind": "bar",
                "xKey": "patch",
                "xLabel": "Macbeth patch",
                "yLabel": "estimate units / %",
                "data": _macbeth_patch_chart(srgb),
                "series": [
                    {"key": "deltaE", "label": "DeltaE estimate", "color": "#00e5ff"},
                    {"key": "clippingPct", "label": "Clipping", "color": "#f2c85b", "unit": "%"},
                    {"key": "lumaPct", "label": "Luma", "color": "#a568ff", "unit": "%"},
                ],
            }
        )
        charts.append(_luma_histogram_chart(srgb))
    elif lower == "slanted bar":
        charts.append(_mtf_frequency_chart(srgb))
    elif lower == "dead leaves":
        charts.append(
            _frequency_energy_chart(
                srgb,
                "Dead-leaves texture spectrum",
                "Normalized high-frequency texture retention. Useful for denoise/sharpening trade-offs.",
                "textureEnergy",
            )
        )
        charts.append(_luma_histogram_chart(srgb))
    elif lower == "uniform ee":
        charts.append(
            {
                "id": "noise_by_signal",
                "title": "Noise and SNR by signal bucket",
                "description": "Block-level signal/noise curve from rendered uniform chart.",
                "kind": "line",
                "xKey": "bucket",
                "xLabel": "sorted signal bucket",
                "yLabel": "% full scale / dB",
                "data": _noise_signal_chart(srgb, sensor_volts),
                "series": [
                    {"key": "signalPct", "label": "Signal", "color": "#00e5ff", "unit": "%"},
                    {"key": "noisePct", "label": "Noise std", "color": "#fb7185", "unit": "%"},
                    {"key": "snrDb", "label": "SNR", "color": "#2ef5a9", "unit": "dB"},
                ],
            }
        )
        charts.append(_luma_histogram_chart(srgb))
    elif lower == "point array":
        charts.append(
            {
                "id": "psf_radial_profile",
                "title": "PSF radial profile estimate",
                "description": "Image-derived bright-point spread falloff estimated from point-array output.",
                "kind": "line",
                "xKey": "radiusPx",
                "xLabel": "radius px",
                "yLabel": "relative intensity",
                "data": _psf_radial_chart(srgb),
                "series": [{"key": "relativeIntensity", "label": "Relative intensity", "color": "#00e5ff"}],
            }
        )
    elif lower == "harmonic":
        charts.append(
            _frequency_energy_chart(
                srgb,
                "Harmonic frequency response",
                "Image-derived frequency response estimated from the harmonic target after optics, sensor, and ISP.",
                "response",
            )
        )
    return charts


MACBETH_REFERENCE = np.asarray(
    [
        [0.45, 0.32, 0.25], [0.75, 0.58, 0.50], [0.38, 0.48, 0.62], [0.35, 0.42, 0.28],
        [0.53, 0.50, 0.70], [0.40, 0.75, 0.70], [0.82, 0.50, 0.20], [0.30, 0.36, 0.70],
        [0.75, 0.30, 0.32], [0.35, 0.24, 0.45], [0.65, 0.70, 0.26], [0.85, 0.66, 0.18],
        [0.23, 0.30, 0.64], [0.30, 0.58, 0.30], [0.70, 0.22, 0.22], [0.90, 0.78, 0.18],
        [0.72, 0.28, 0.58], [0.20, 0.55, 0.64], [0.94, 0.94, 0.90], [0.78, 0.78, 0.74],
        [0.58, 0.58, 0.56], [0.38, 0.38, 0.37], [0.20, 0.20, 0.20], [0.05, 0.05, 0.05],
    ],
    dtype=float,
)


def _macbeth_proxy_metrics(srgb):
    image = _normalized_srgb(srgb)
    rows, cols = image.shape[:2]
    if rows < 4 or cols < 6:
        return {"deltaEProxy": None, "patchSaturationMaxPct": None, "neutralBalanceErrorPct": None}
    patch_means = []
    for row in range(4):
        for col in range(6):
            y0 = int(row * rows / 4)
            y1 = int((row + 1) * rows / 4)
            x0 = int(col * cols / 6)
            x1 = int((col + 1) * cols / 6)
            patch = image[y0:y1, x0:x1, :]
            patch_means.append(np.mean(patch.reshape(-1, 3), axis=0))
    patches = np.clip(np.asarray(patch_means, dtype=float), 0.0, 1.0)
    observed = patches / max(float(np.percentile(patches, 95)), 1.0e-6)
    reference = MACBETH_REFERENCE / max(float(np.percentile(MACBETH_REFERENCE, 95)), 1.0e-6)
    delta = np.sqrt(np.sum((observed - reference) ** 2, axis=1)) * 18.0
    neutral = patches[-6:, :]
    neutral_error = float(np.mean(np.std(neutral, axis=1) / np.maximum(np.mean(neutral, axis=1), 1.0e-6)) * 100.0)
    return {
        "deltaEProxy": float(np.mean(delta)),
        "patchSaturationMaxPct": float(np.max(np.mean(patches >= 0.98, axis=1)) * 100.0),
        "neutralBalanceErrorPct": neutral_error,
    }


def _psf_width_proxy(srgb):
    image = _normalized_srgb(srgb)
    gray = np.mean(image, axis=2)
    threshold = float(np.percentile(gray, 99.5))
    mask = gray >= threshold
    if not np.any(mask):
        return None
    yy, xx = np.indices(gray.shape)
    weights = np.maximum(gray - threshold, 0.0)
    weights = weights * mask
    total = float(np.sum(weights))
    if total <= 1.0e-12:
        return None
    cx = float(np.sum(xx * weights) / total)
    cy = float(np.sum(yy * weights) / total)
    variance = float(np.sum(((xx - cx) ** 2 + (yy - cy) ** 2) * weights) / total)
    return float(np.sqrt(max(variance, 0.0)))


def _static_metric(label, value, unit="", status="image-derived", description=""):
    if value is None:
        rendered = "-"
    elif isinstance(value, str):
        rendered = value
    elif unit == "%":
        rendered = f"{float(value):.1f}"
    elif unit == "dB":
        rendered = f"{float(value):.1f}"
    elif unit in {"cycles/pixel", "px"}:
        rendered = f"{float(value):.3f}"
    else:
        rendered = f"{float(value):.3f}"
    return {
        "label": label,
        "value": rendered,
        "unit": unit,
        "status": status,
        "description": description,
    }


def _asset_json_payload(path):
    if path.suffix.lower() != ".json":
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _lens_catalog_asset_payload(request, store):
    assets = request.get("assets", {}) or {}
    lens_asset = assets.get("lensAsset")
    lens_mode = assets.get("lensMode")
    if not lens_asset or lens_mode not in {"catalogLens", "lensFileReference"}:
        return None

    path = store.resolve(lens_asset)
    payload = _asset_json_payload(path)
    parsed = parse_catalog_lens_asset(lens_asset, store, [])
    metrics = [
        _static_metric("Lens asset", parsed.get("name") or path.stem, "", "asset", "Selected catalogue lens asset."),
    ]
    charts = []

    if isinstance(payload, dict):
        surfaces = payload.get("surfaces") if isinstance(payload.get("surfaces"), list) else []
        valid_surfaces = [surface for surface in surfaces if isinstance(surface, dict)]
        if valid_surfaces:
            thickness = np.asarray([safe_float(surface.get("thickness", 0.0), 0.0) for surface in valid_surfaces], dtype=float)
            ior = np.asarray([safe_float(surface.get("ior", 0.0), 0.0) for surface in valid_surfaces], dtype=float)
            semi_aperture = np.asarray([safe_float(surface.get("semi_aperture", 0.0), 0.0) for surface in valid_surfaces], dtype=float)
            radius = np.asarray([safe_float(surface.get("radius", 0.0), 0.0) for surface in valid_surfaces], dtype=float)
            data = []
            for index, surface in enumerate(valid_surfaces):
                data.append(
                    {
                        "surface": f"S{index + 1}",
                        "ior": _chart_value(ior[index], 4),
                        "thicknessMm": _chart_value(thickness[index], 4),
                        "semiApertureMm": _chart_value(semi_aperture[index], 4),
                        "radiusAbsMm": _chart_value(min(abs(radius[index]), 100.0), 4),
                    }
                )
            metrics.extend(
                [
                    _static_metric("Surface count", len(valid_surfaces), "", "asset", "Number of catalogue lens surfaces."),
                    _static_metric("Total thickness", float(np.sum(np.maximum(thickness, 0.0))), "mm", "asset", "Sum of positive surface thickness entries."),
                    _static_metric("Max IOR", float(np.nanmax(ior)) if ior.size else None, "", "asset", "Highest refractive index in the catalogue surface stack."),
                    _static_metric("Max semi-aperture", float(np.nanmax(semi_aperture)) if semi_aperture.size else None, "mm", "asset", "Largest listed semi-aperture."),
                ]
            )
            charts.append(
                {
                    "id": "lens_catalog_surface_stack",
                    "title": "Lens DB surface stack / IOR",
                    "description": "Catalogue lens surface radius, thickness, semi-aperture, and refractive index parsed from the Lens DB. Radius is capped at 100 mm for display.",
                    "kind": "bar",
                    "xKey": "surface",
                    "xLabel": "surface index",
                    "yLabel": "mm / refractive index",
                    "data": data,
                    "series": [
                        {"key": "ior", "label": "IOR", "color": "#00e5ff"},
                        {"key": "thicknessMm", "label": "Thickness", "color": "#2ef5a9", "unit": "mm"},
                        {"key": "semiApertureMm", "label": "Semi-aperture", "color": "#f2c85b", "unit": "mm"},
                        {"key": "radiusAbsMm", "label": "|Radius| capped", "color": "#a568ff", "unit": "mm"},
                    ],
                }
            )

        polynomials = payload.get("polynomials") if isinstance(payload.get("polynomials"), list) else []
        first_poly = polynomials[0] if polynomials and isinstance(polynomials[0], dict) else None
        pass_no_pass = first_poly.get("passnopass") if isinstance(first_poly, dict) and isinstance(first_poly.get("passnopass"), dict) else None
        if pass_no_pass:
            positions = np.asarray(pass_no_pass.get("positions", []), dtype=float).reshape(-1)
            radii_x = np.asarray(pass_no_pass.get("radiiX", []), dtype=float).reshape(-1)
            radii_y = np.asarray(pass_no_pass.get("radiiY", []), dtype=float).reshape(-1)
            centers_x = np.asarray(pass_no_pass.get("centersX", []), dtype=float).reshape(-1)
            centers_y = np.asarray(pass_no_pass.get("centersY", []), dtype=float).reshape(-1)
            usable = min(positions.size, radii_x.size, radii_y.size)
            if usable:
                center_shift = np.sqrt(np.square(centers_x[:usable]) + np.square(centers_y[:usable])) if centers_x.size >= usable and centers_y.size >= usable else np.zeros(usable)
                pos_ds, series = _downsample_curve(positions[:usable], radii_x[:usable], radii_y[:usable], center_shift[:usable], limit=80)
                data = []
                for index, position in enumerate(pos_ds):
                    data.append(
                        {
                            "fieldPosition": _chart_value(position, 4),
                            "radiusX": _chart_value(series[0][index], 5),
                            "radiusY": _chart_value(series[1][index], 5),
                            "centerShift": _chart_value(series[2][index], 5),
                        }
                    )
                metrics.extend(
                    [
                        _static_metric("Ray-transfer samples", usable, "", "asset", "Pass/no-pass field samples in the selected ray-transfer asset."),
                        _static_metric("Max footprint X", float(np.nanmax(radii_x[:usable])), "mm", "asset", "Maximum pass footprint radius X."),
                        _static_metric("Max footprint Y", float(np.nanmax(radii_y[:usable])), "mm", "asset", "Maximum pass footprint radius Y."),
                    ]
                )
                charts.append(
                    {
                        "id": "lens_raytransfer_footprint",
                        "title": "Lens DB ray-transfer field footprint",
                        "description": "Field-position footprint and center shift parsed from a ray-transfer Lens DB asset.",
                        "kind": "line",
                        "xKey": "fieldPosition",
                        "xLabel": "field position",
                        "yLabel": "mm",
                        "data": data,
                        "series": [
                            {"key": "radiusX", "label": "Radius X", "color": "#00e5ff", "unit": "mm"},
                            {"key": "radiusY", "label": "Radius Y", "color": "#2ef5a9", "unit": "mm"},
                            {"key": "centerShift", "label": "Center shift", "color": "#f2c85b", "unit": "mm"},
                        ],
                    }
                )

    if parsed.get("focalLengthMm"):
        metrics.append(_static_metric("Focal length", parsed["focalLengthMm"], "mm", "asset", "Catalogue focal length parsed from metadata or filename."))
    if parsed.get("fNumber"):
        metrics.append(_static_metric("F-number", parsed["fNumber"], "", "asset", "Catalogue F-number parsed or inferred from aperture."))
    if parsed.get("fovDeg"):
        metrics.append(_static_metric("Nominal FOV", parsed["fovDeg"], "deg", "asset", "Catalogue FOV parsed from filename metadata."))

    return {
        "scene": "lens DB surface / ray-transfer",
        "purpose": "Lens DB surface, IOR, aperture, and ray-transfer metadata used as design evidence for catalogue lens assets.",
        "source": f"Lens DB asset · {path.name}",
        "status": "completed" if metrics else "failed",
        "artifactKey": "",
        "metrics": metrics,
        "charts": charts,
    }


def _raytrace_asset_metadata_payload(camera, request):
    assets = request.get("assets", {}) or {}
    lens_asset = assets.get("lensAsset")
    if assets.get("lensMode") != "raytraceOptics" or not lens_asset:
        return None

    oi = camera.fields["oi"]
    metrics = [
        _static_metric("Lens asset", str(lens_asset), "", "asset", "Selected CameraE2E raytrace optics asset."),
    ]
    charts = []

    def read_value(parameter, *args):
        try:
            return oi_get(oi, parameter, *args)
        except Exception:
            return None

    def add_scalar(label, parameter, unit="", description="", *args):
        value = read_value(parameter, *args)
        if value is None:
            return
        if isinstance(value, str):
            if value:
                metrics.append(_static_metric(label, value, unit, "metadata", description))
            return
        array = np.asarray(value)
        if array.size == 0:
            return
        scalar = array.reshape(-1)[0]
        if isinstance(scalar, (np.floating, float)) and not np.isfinite(float(scalar)):
            metrics.append(_static_metric(label, "infinite", unit, "metadata", description))
        else:
            metrics.append(_static_metric(label, float(scalar) if np.issubdtype(array.dtype, np.number) else str(scalar), unit, "metadata", description))

    add_scalar("RT optics name", "rtname", "", "Raytrace optics name loaded by CameraE2E.")
    add_scalar("RT program", "rtopticsprogram", "", "Optical design program recorded in the raytrace asset.")
    add_scalar("RT lens file", "lensfile", "", "Original optical design lens file recorded in the raytrace asset.")
    add_scalar("Focal length", "rteffectivefocallength", "mm", "Effective focal length from the raytrace optics asset.", "mm")
    add_scalar("F-number", "rtfnumber", "", "Nominal F-number from the raytrace optics asset.")
    add_scalar("Effective F-number", "rteffectivefnumber", "", "Effective F-number from the raytrace optics asset.")
    add_scalar("Reference wavelength", "rtreferencewavelength", "nm", "Reference wavelength used by the raytrace analysis.")
    add_scalar("Object distance", "rtobjectdistance", "m", "Reference object distance used by the raytrace analysis.", "m")
    add_scalar("Max raytrace FOV", "rtmaxfov", "deg", "Maximum field of view covered by the raytrace asset.")
    add_scalar("PSF angle step", "psfanglestep", "deg", "Angular spacing used when sampling shift-variant raytrace PSFs.")
    add_scalar("RT PSF spacing", "rtpsfspacing", "um", "Raytrace PSF sample spacing.", "um")

    psf_field_raw = read_value("rtpsffieldheight", "mm")
    psf_wave_raw = read_value("rtpsfwavelength")
    geom_field_raw = read_value("rtgeomfieldheight", "mm")
    geom_wave_raw = read_value("rtgeomwavelength")
    ri_field_raw = read_value("rtrifieldheight", "mm")
    ri_wave_raw = read_value("rtriwavelength")
    psf_field = np.asarray([] if psf_field_raw is None else psf_field_raw, dtype=float).reshape(-1)
    psf_wave = np.asarray([] if psf_wave_raw is None else psf_wave_raw, dtype=float).reshape(-1)
    geom_field = np.asarray([] if geom_field_raw is None else geom_field_raw, dtype=float).reshape(-1)
    geom_wave = np.asarray([] if geom_wave_raw is None else geom_wave_raw, dtype=float).reshape(-1)
    ri_field = np.asarray([] if ri_field_raw is None else ri_field_raw, dtype=float).reshape(-1)
    ri_wave = np.asarray([] if ri_wave_raw is None else ri_wave_raw, dtype=float).reshape(-1)
    metrics.extend(
        [
            _static_metric("PSF field samples", int(psf_field.size), "", "metadata", "Number of raytrace PSF field-height samples."),
            _static_metric("PSF wavelengths", int(psf_wave.size), "", "metadata", "Number of raytrace PSF wavelength samples."),
            _static_metric("Geometry field samples", int(geom_field.size), "", "metadata", "Number of distortion geometry field-height samples."),
            _static_metric("Geometry wavelengths", int(geom_wave.size), "", "metadata", "Number of distortion geometry wavelength samples."),
            _static_metric("RI field samples", int(ri_field.size), "", "metadata", "Number of relative-illumination field-height samples."),
            _static_metric("RI wavelengths", int(ri_wave.size), "", "metadata", "Number of relative-illumination wavelength samples."),
        ]
    )

    try:
        wave = np.asarray(oi.fields.get("wave", []), dtype=float).reshape(-1)
        transmittance = np.asarray(oi_get(oi, "transmittance", wave), dtype=float).reshape(-1)
        usable = min(wave.size, transmittance.size)
        if usable:
            wave_ds, series = _downsample_curve(wave[:usable], transmittance[:usable], limit=96)
            charts.append(
                {
                    "id": "raytrace_optics_transmittance",
                    "title": "Raytrace optics transmittance",
                    "description": "Active optical transmittance curve after the selected raytrace optics asset is loaded.",
                    "kind": "line",
                    "xKey": "wavelength",
                    "xLabel": "wavelength nm",
                    "yLabel": "transmittance",
                    "data": [
                        {
                            "wavelength": _chart_value(wavelength, 2),
                            "transmittance": _chart_value(series[0][index], 5),
                        }
                        for index, wavelength in enumerate(wave_ds)
                    ],
                    "series": [
                        {"key": "transmittance", "label": "Transmittance", "color": "#00e5ff"},
                    ],
                }
            )
    except Exception:
        pass

    return {
        "scene": "raytrace optics asset metadata",
        "purpose": "Raytrace Lens DB metadata and active optics tables used as pre-run design evidence. Surface-level glass stack is shown only when the selected asset exposes it.",
        "source": f"CameraE2E raytrace optics · {Path(str(lens_asset)).name}",
        "status": "completed",
        "artifactKey": "",
        "metrics": metrics,
        "charts": charts,
    }


def off_axis_illumination_summary(oi, request):
    assets = request.get("assets", {}) or {}
    optics = dict(oi.fields.get("optics", {}))
    optics_model = str(optics.get("model", "unknown"))
    offaxis_method = str(optics.get("offaxis_method", "cos4th"))
    cos4_applied = normalize_model_name(offaxis_method) == "cos4th"
    lens_asset = str(assets.get("lensAsset", "") or "")
    lens_mode = str(assets.get("lensMode", "none") or "none")
    source = "CameraE2E optics off-axis method"
    authority = "cos4Falloff" if cos4_applied else normalize_model_name(offaxis_method) or "skip"
    model = "Cos4 fall-off" if cos4_applied else f"{offaxis_method} off-axis method"
    field_samples = 0
    wavelength_samples = 0
    edge_ri = ""

    if normalize_model_name(optics_model) == "raytrace":
        source = lens_asset or str(optics.get("raytrace", {}).get("name", "raytrace optics"))
        try:
            field_height = np.asarray(oi_get(oi, "rtrifieldheight", "mm"), dtype=float).reshape(-1)
            ri_function = np.asarray(oi_get(oi, "rtrifunction"), dtype=float)
            wavelengths = np.asarray(oi_get(oi, "rtriwavelength"), dtype=float).reshape(-1)
            if ri_function.ndim == 1:
                ri_function = ri_function.reshape(-1, 1)
            field_samples = int(field_height.size)
            wavelength_samples = int(ri_function.shape[1]) if ri_function.ndim == 2 else int(wavelengths.size)
            has_ri_table = field_samples > 0 and ri_function.size > 0
            if has_ri_table:
                edge_ri = round(float(np.nanmin(ri_function[-1, :])), 4)
                authority = "raytraceRelativeIllumination+cos4Falloff" if cos4_applied else "raytraceRelativeIllumination"
                model = "Raytrace RI table + Cos4 fall-off" if cos4_applied else "Raytrace RI table"
            else:
                authority = "cos4Falloff" if cos4_applied else "raytraceNoRITable"
                model = "Raytrace optics + Cos4 fall-off" if cos4_applied else "Raytrace optics without RI table"
        except Exception:
            authority = "cos4Falloff" if cos4_applied else "raytraceRITableUnavailable"
            model = "Raytrace optics + Cos4 fall-off" if cos4_applied else "Raytrace RI table unavailable"

    return {
        "authority": authority,
        "model": model,
        "source": source,
        "lensMode": lens_mode,
        "offaxisMethod": offaxis_method,
        "cos4Applied": bool(cos4_applied),
        "fieldSamples": field_samples,
        "wavelengthSamples": wavelength_samples,
        "edgeRIMin": edge_ri,
        "policy": "Raytrace RI table is preferred when exposed by the selected optics asset. Cos4 is applied only when the active optics offaxis method resolves to cos4th.",
    }


def _raytrace_geometry_payload(camera):
    oi = camera.fields["oi"]
    tests = []
    try:
        cos4_applied = normalize_model_name(oi_get(oi, "offaxis method")) == "cos4th"
    except Exception:
        cos4_applied = False

    try:
        field_height = np.asarray(oi_get(oi, "rtgeomfieldheight", "mm"), dtype=float).reshape(-1)
        wavelengths = np.asarray(oi_get(oi, "rtgeomwavelength"), dtype=float).reshape(-1)
        reference_wave = float(wavelengths[np.argmin(np.abs(wavelengths - 550.0))]) if wavelengths.size else 550.0
        distorted_height = np.asarray(oi_get(oi, "rtgeomfunction", reference_wave, "mm"), dtype=float).reshape(-1)
        usable = min(field_height.size, distorted_height.size)
        if usable == 0:
            raise ValueError("empty raytrace geometry table")
        field_height = field_height[:usable]
        distorted_height = distorted_height[:usable]
        distortion_pct = np.zeros_like(field_height, dtype=float)
        nonzero = np.abs(field_height) > 1.0e-12
        distortion_pct[nonzero] = ((distorted_height[nonzero] - field_height[nonzero]) / field_height[nonzero]) * 100.0
        field_ds, series = _downsample_curve(field_height, distorted_height, distortion_pct, limit=96)
        data = []
        for index, field in enumerate(field_ds):
            data.append(
                {
                    "fieldHeightMm": _chart_value(field, 5),
                    "distortedHeightMm": _chart_value(series[0][index], 5),
                    "distortionPct": _chart_value(series[1][index], 5),
                }
            )
        tests.append(
            {
                "scene": "raytrace distortion geometry",
                "purpose": "Field-height to distorted image-height mapping from the selected raytrace optics.",
                "source": "CameraE2E oi_get(rtgeom*)",
                "status": "completed",
                "artifactKey": "",
                "metrics": [
                    _static_metric("Reference wavelength", reference_wave, "nm", "CameraE2E", "Nearest available raytrace geometry wavelength to 550 nm."),
                    _static_metric("Max field height", float(np.nanmax(field_height)), "mm", "CameraE2E", "Maximum field height in raytrace geometry table."),
                    _static_metric("Max distortion", float(np.nanmax(np.abs(distortion_pct))), "%", "CameraE2E", "Maximum absolute distortion over the field-height samples."),
                ],
                "charts": [
                    {
                        "id": "camera_e2e_raytrace_distortion",
                        "title": "Raytrace distortion geometry",
                        "description": "Ideal field height versus distorted image height and percent distortion from the selected raytrace optics asset.",
                        "kind": "line",
                        "xKey": "fieldHeightMm",
                        "xLabel": "field height mm",
                        "yLabel": "mm / %",
                        "data": data,
                        "series": [
                            {"key": "distortedHeightMm", "label": "Distorted height", "color": "#00e5ff", "unit": "mm"},
                            {"key": "distortionPct", "label": "Distortion", "color": "#f2c85b", "unit": "%"},
                        ],
                    }
                ],
            }
        )
    except Exception as exc:
        tests.append(
            {
                "scene": "raytrace distortion geometry",
                "purpose": "Field-height to distorted image-height mapping from the selected raytrace optics.",
                "source": "not available",
                "status": "failed",
                "artifactKey": "",
                "metrics": [_static_metric("status", "failed", "", "not_available", f"{type(exc).__name__}: {exc}")],
                "charts": [],
            }
        )

    try:
        field_height = np.asarray(oi_get(oi, "rtrifieldheight", "mm"), dtype=float).reshape(-1)
        wavelengths = np.asarray(oi_get(oi, "rtriwavelength"), dtype=float).reshape(-1)
        ri_function = np.asarray(oi_get(oi, "rtrifunction"), dtype=float)
        if ri_function.ndim == 1:
            ri_function = ri_function.reshape(-1, 1)
        if field_height.size == 0 or ri_function.size == 0:
            raise ValueError("empty relative illumination table")
        if ri_function.shape[0] != field_height.size and ri_function.shape[1] == field_height.size:
            ri_function = ri_function.T
        usable = min(field_height.size, ri_function.shape[0])
        field_height = field_height[:usable]
        ri_function = ri_function[:usable, :]
        channel_indices = []
        for target_wave in [450.0, 550.0, 650.0]:
            if wavelengths.size:
                channel_indices.append(int(np.argmin(np.abs(wavelengths - target_wave))))
        if not channel_indices:
            channel_indices = [0]
        channel_indices = list(dict.fromkeys([index for index in channel_indices if index < ri_function.shape[1]]))[:3]
        series_values = [ri_function[:, index] for index in channel_indices]
        field_ds, series = _downsample_curve(field_height, *series_values, limit=96)
        data = []
        for row_index, field in enumerate(field_ds):
            row = {"fieldHeightMm": _chart_value(field, 5)}
            for series_index, column_index in enumerate(channel_indices):
                wave_label = int(round(float(wavelengths[column_index]))) if wavelengths.size and column_index < wavelengths.size else series_index + 1
                row[f"ri{series_index + 1}"] = _chart_value(series[series_index][row_index], 5)
                row[f"wave{series_index + 1}"] = wave_label
            data.append(row)
        edge_ri = float(np.nanmin(ri_function[-1, channel_indices])) if channel_indices else float(np.nanmin(ri_function[-1, :]))
        tests.append(
            {
                "scene": "raytrace relative illumination",
                "purpose": "Relative illumination / vignetting by field height from the selected raytrace optics.",
                "source": "CameraE2E oi_get(rtrelillum*)",
                "status": "completed",
                "artifactKey": "",
                "metrics": [
                    _static_metric("RI authority", "Raytrace RI table", "", "CameraE2E", "Relative illumination authority for this raytrace optics asset."),
                    _static_metric("Cos4 applied", "Yes" if cos4_applied else "No", "", "CameraE2E", "Cos4 fall-off is applied only when the active optics offaxis method resolves to cos4th."),
                    _static_metric("Edge RI min", edge_ri, "", "CameraE2E", "Minimum selected-wavelength relative illumination at the edge field sample."),
                    _static_metric("RI field samples", usable, "", "CameraE2E", "Relative illumination field-height sample count."),
                    _static_metric("RI wavelengths", ri_function.shape[1], "", "CameraE2E", "Relative illumination wavelength channels."),
                ],
                "charts": [
                    {
                        "id": "camera_e2e_relative_illumination",
                        "title": "Raytrace relative illumination",
                        "description": "Field-dependent relative illumination from the selected optics. This is the lens vignetting / RI evidence before ISP lens shading correction.",
                        "kind": "line",
                        "xKey": "fieldHeightMm",
                        "xLabel": "field height mm",
                        "yLabel": "relative illumination",
                        "data": data,
                        "series": [
                            {
                                "key": f"ri{series_index + 1}",
                                "label": f"{int(round(float(wavelengths[column_index]))) if wavelengths.size and column_index < wavelengths.size else series_index + 1} nm",
                                "color": ["#00e5ff", "#2ef5a9", "#f2c85b"][series_index % 3],
                            }
                            for series_index, column_index in enumerate(channel_indices)
                        ],
                    }
                ],
            }
        )
    except Exception as exc:
        tests.append(
            {
                "scene": "raytrace relative illumination",
                "purpose": "Relative illumination / vignetting by field height from the selected raytrace optics.",
                "source": "not available",
                "status": "failed",
                "artifactKey": "",
                "metrics": [_static_metric("status", "failed", "", "not_available", f"{type(exc).__name__}: {exc}")],
                "charts": [],
            }
        )

    return tests


def _sensor_optical_stack_payload(camera):
    sensor = camera.fields["sensor"]
    metrics = []
    charts = []
    try:
        thickness_um = np.asarray(sensor_get(sensor, "pixel layer thicknesses", "um"), dtype=float).reshape(-1)
    except Exception:
        thickness_um = np.empty(0, dtype=float)
    try:
        refractive_indices = np.asarray(sensor_get(sensor, "pixel refractive indices"), dtype=float).reshape(-1)
    except Exception:
        refractive_indices = np.empty(0, dtype=float)

    usable = max(thickness_um.size, refractive_indices.size)
    if usable:
        data = []
        for index in range(usable):
            data.append(
                {
                    "layer": f"L{index + 1}",
                    "thicknessUm": _chart_value(thickness_um[index], 5) if index < thickness_um.size else None,
                    "refractiveIndex": _chart_value(refractive_indices[index], 5) if index < refractive_indices.size else None,
                }
            )
        metrics.extend(
            [
                _static_metric("Sensor stack layers", usable, "", "CameraE2E", "Pixel optical stack layer count from sensor_get."),
                _static_metric("Stack height", float(np.sum(thickness_um)) if thickness_um.size else None, "um", "CameraE2E", "Sum of pixel optical stack layer thicknesses."),
                _static_metric("Max stack RI", float(np.nanmax(refractive_indices)) if refractive_indices.size else None, "", "CameraE2E", "Maximum pixel stack refractive index."),
            ]
        )
        charts.append(
            {
                "id": "camera_e2e_sensor_stack_ri",
                "title": "Sensor pixel stack RI / thickness",
                "description": "Pixel optical-stack layer thickness and refractive indices exposed by the active CameraE2E sensor.",
                "kind": "bar",
                "xKey": "layer",
                "xLabel": "pixel stack layer",
                "yLabel": "um / refractive index",
                "data": data,
                "series": [
                    {"key": "thicknessUm", "label": "Thickness", "color": "#00e5ff", "unit": "um"},
                    {"key": "refractiveIndex", "label": "Refractive index", "color": "#f2c85b"},
                ],
            }
        )

    try:
        microlens = sensor_get(sensor, "microlens")
    except Exception:
        microlens = None
    if microlens:
        try:
            metrics.extend(
                [
                    _static_metric("Microlens CRA", mlens_get(microlens, "chief ray angle"), "deg", "CameraE2E", "Microlens chief ray angle."),
                    _static_metric("Microlens F-number", mlens_get(microlens, "ml fnumber"), "", "CameraE2E", "Microlens F-number."),
                    _static_metric("Microlens RI", mlens_get(microlens, "ml refractive index"), "", "CameraE2E", "Microlens refractive index."),
                    _static_metric("Microlens offset", mlens_get(microlens, "microlens offset", "microns"), "um", "CameraE2E", "Microlens offset."),
                ]
            )
        except Exception:
            pass

    if not metrics:
        metrics = [_static_metric("status", "not available", "", "not_available", "Active sensor did not expose pixel stack RI/layer thickness.")]

    return {
        "scene": "sensor optical stack / microlens",
        "purpose": "Sensor pixel optical-stack RI, layer thickness, and microlens metadata used for chief-ray and sensor stack review.",
        "source": "CameraE2E sensor_get(pixel stack / microlens)",
        "status": "completed" if charts else "failed",
        "artifactKey": "",
        "metrics": metrics,
        "charts": charts,
    }


def _module_calibration_payload(camera, request):
    sensor_req = request.get("sensor", {}) or {}
    calibration = request.get("calibration", {}) or {}
    cols = safe_float(sensor_req.get("cols", 0), 0)
    rows = safe_float(sensor_req.get("rows", 0), 0)
    pixel_size_um = safe_float(sensor_req.get("pixelSizeUm", 0), 0)
    try:
        focal_length_mm = float(oi_get(camera.fields["oi"], "optics focal length")) * 1000.0
    except Exception:
        focal_length_mm = safe_float(request.get("lens", {}).get("focalLengthMm", 0), 0)
    cx = safe_float(calibration.get("principalPointX", cols / 2.0), cols / 2.0)
    cy = safe_float(calibration.get("principalPointY", rows / 2.0), rows / 2.0)
    k1 = safe_float(calibration.get("radialK1", 0.0), 0.0)
    k2 = safe_float(calibration.get("radialK2", 0.0), 0.0)
    k3 = safe_float(calibration.get("radialK3", 0.0), 0.0)
    p1 = safe_float(calibration.get("tangentialP1", 0.0), 0.0)
    p2 = safe_float(calibration.get("tangentialP2", 0.0), 0.0)
    fx = focal_length_mm / max(pixel_size_um / 1000.0, 1.0e-12) if focal_length_mm > 0 and pixel_size_um > 0 else None
    fy = fx
    oc_offset = float(np.hypot(cx - cols / 2.0, cy - rows / 2.0))

    data = []
    for radius in np.linspace(0.0, 1.0, 41):
        r2 = radius * radius
        radial_scale = 1.0 + k1 * r2 + k2 * r2 * r2 + k3 * r2 * r2 * r2
        tangential_proxy = (abs(p1) + abs(p2)) * radius * 100.0
        data.append(
            {
                "normalizedRadius": _chart_value(radius, 3),
                "radialScale": _chart_value(radial_scale, 7),
                "radialDistortionPct": _chart_value((radial_scale - 1.0) * 100.0, 7),
                "tangentialProxyPct": _chart_value(tangential_proxy, 7),
            }
        )

    return {
        "scene": "module calibration / OC",
        "purpose": "Principal point, focal length in pixels, and OpenCV-style distortion coefficients carried as module calibration metadata.",
        "source": "Sinclair calibration request + CameraE2E active focal length",
        "status": "completed",
        "artifactKey": "",
        "metrics": [
            _static_metric("Principal point X", cx, "px", "metadata", "Optical center / principal point x in active sensor pixels."),
            _static_metric("Principal point Y", cy, "px", "metadata", "Optical center / principal point y in active sensor pixels."),
            _static_metric("OC offset", oc_offset, "px", "metadata", "Principal-point offset from image center."),
            _static_metric("Focal length fx", fx, "px", "metadata", "Active focal length converted to pixels from focal length and pixel pitch."),
            _static_metric("Radial k1", k1, "", "metadata", "OpenCV-style radial distortion coefficient."),
            _static_metric("Radial k2", k2, "", "metadata", "OpenCV-style radial distortion coefficient."),
        ],
        "charts": [
            {
                "id": "module_calibration_distortion_model",
                "title": "Calibration distortion coefficient response",
                "description": "Polynomial distortion response from the request-side calibration coefficients. This is separate from raytrace distortion geometry.",
                "kind": "line",
                "xKey": "normalizedRadius",
                "xLabel": "normalized image radius",
                "yLabel": "scale / %",
                "data": data,
                "series": [
                    {"key": "radialScale", "label": "Radial scale", "color": "#00e5ff"},
                    {"key": "radialDistortionPct", "label": "Radial distortion", "color": "#f2c85b", "unit": "%"},
                    {"key": "tangentialProxyPct", "label": "Tangential proxy", "color": "#a568ff", "unit": "%"},
                ],
            }
        ],
    }


def _metrics_for_static_scene(scene_type, srgb, sensor_volts):
    measurements = _image_measurements(srgb, sensor_volts)
    lower = str(scene_type).lower()
    if lower == "macbeth":
        macbeth = _macbeth_proxy_metrics(srgb)
        return [
            _static_metric("DeltaE estimate", macbeth["deltaEProxy"], "", "image-derived", "Macbeth patch color reproduction estimate from rendered image."),
            _static_metric("Neutral balance error", macbeth["neutralBalanceErrorPct"], "%", "image-derived", "Neutral patch RGB balance."),
            _static_metric("Patch clipping max", macbeth["patchSaturationMaxPct"], "%", "image-derived", "Worst Macbeth patch saturation ratio."),
        ]
    if lower == "slanted bar":
        return [
            _static_metric("MTF50 estimate", measurements["mtf50CyclesPerPixel"], "cycles/pixel", "image-derived", "FFT/edge sharpness estimate, not ISO eSFR."),
            _static_metric("Acutance", measurements["acutance"] * 100.0, "%", "image-derived", "Mean local contrast gradient."),
            _static_metric("High-frequency energy", measurements["highFrequencyRatio"] * 100.0, "%", "image-derived", "Energy above normalized high-frequency band."),
        ]
    if lower == "dead leaves":
        return [
            _static_metric("Texture retention", measurements["highFrequencyRatio"] * 100.0, "%", "image-derived", "Dead-leaves high-frequency retention from rendered output."),
            _static_metric("Acutance", measurements["acutance"] * 100.0, "%", "image-derived", "Texture edge contrast from rendered output."),
            _static_metric("Saturation", measurements["saturationRatio"] * 100.0, "%", "image-derived", "Clipped pixels in rendered output."),
        ]
    if lower == "uniform ee":
        return [
            _static_metric("SNR", measurements["voltageSnrDb"] or measurements["snrDb"], "dB", "image-derived", "Sensor voltage SNR when available; otherwise rendered luma SNR."),
            _static_metric("Uniformity error", measurements["uniformityError"] * 100.0, "%", "image-derived", "Spatial luma non-uniformity from rendered output."),
            _static_metric("Saturation", measurements["saturationRatio"] * 100.0, "%", "image-derived", "Clipped output pixels."),
        ]
    if lower == "point array":
        return [
            _static_metric("PSF width estimate", _psf_width_proxy(srgb), "px", "image-derived", "Bright-point spread estimate from rendered point array."),
            _static_metric("Acutance", measurements["acutance"] * 100.0, "%", "image-derived", "Point edge contrast from rendered output."),
            _static_metric("Underexposure", measurements["underexposureRatio"] * 100.0, "%", "image-derived", "Near-black output pixels."),
        ]
    if lower == "harmonic":
        return [
            _static_metric("Frequency response", measurements["highFrequencyRatio"] * 100.0, "%", "image-derived", "Harmonic chart high-frequency response from rendered output."),
            _static_metric("MTF50 estimate", measurements["mtf50CyclesPerPixel"], "cycles/pixel", "image-derived", "FFT-derived response estimate."),
            _static_metric("Mean luma", measurements["meanLuma"], "", "image-derived", "Rendered luma average."),
        ]
    return [
        _static_metric("Acutance", measurements["acutance"] * 100.0, "%", "image-derived", "General edge contrast from rendered output."),
        _static_metric("SNR", measurements["voltageSnrDb"] or measurements["snrDb"], "dB", "image-derived", "Sensor/luma SNR from rendered output."),
        _static_metric("Saturation", measurements["saturationRatio"] * 100.0, "%", "image-derived", "Clipped output pixels."),
    ]


def compute_camera_with_isp(camera, scene, request, sensor_resize, store, warnings, applied):
    computed = camera_compute(camera.clone(), scene, sensor_resize=sensor_resize, asset_store=store)
    isp_req = request.get("isp", {}) or {}
    if safe_bool(isp_req.get("hdrWhite", False), False):
        hdr_level = clamp(safe_float(isp_req.get("hdrLevel", 0.95), 0.95), 0.5, 0.99)
        try:
            computed.fields["ip"] = ip_compute(
                computed.fields["ip"],
                computed.fields["sensor"],
                hdr_white=True,
                hdr_level=hdr_level,
                asset_store=store,
            )
            applied.append(f"isp.hdrWhite=True(hdrLevel={hdr_level})")
        except Exception as exc:
            warnings.append(f"isp.hdrWhite could not be applied through ip_compute: {type(exc).__name__}: {exc}")
    return computed


def hw_isp_summary_from_request(camera, scene, request, store, warnings, applied):
    hw_req = request.get("hwIsp", {}) or {}
    profile = str(hw_req.get("profile", "default") or "default")
    if not safe_bool(hw_req.get("enabled", False), False):
        return {
            "enabled": False,
            "profile": profile,
        }
    sensor_size = np.asarray(sensor_get(camera.fields["sensor"], "size"), dtype=int).reshape(-1)
    active_lines = int(sensor_size[0]) if sensor_size.size else 1080
    nframes = int(clamp(safe_int(hw_req.get("nFrames", 4), 4), 1, 12))
    sensor_timing = {
        "fps": safe_float(hw_req.get("fps", 30.0), 30.0),
        "line_time_us": safe_float(hw_req.get("lineTimeUs", 15.2), 15.2),
        "active_lines": active_lines,
        "exposure_time_us": safe_float(hw_req.get("exposureTimeUs", 8000.0), 8000.0),
    }
    control_path = {
        "apply_to_image": safe_bool(hw_req.get("applyToImage", False), False),
        "ae_enabled": safe_bool(hw_req.get("aeEnabled", True), True),
        "awb_enabled": safe_bool(hw_req.get("awbEnabled", True), True),
        "ae_apply_delay_frames": safe_int(hw_req.get("aeApplyDelayFrames", 2), 2),
        "awb_apply_delay_frames": safe_int(hw_req.get("awbApplyDelayFrames", 2), 2),
        "target_luma": safe_float(hw_req.get("targetLuma", 0.18), 0.18),
    }
    transport = {
        "request_queue_depth": safe_int(hw_req.get("requestQueueDepth", 4), 4),
        "max_buffers": safe_int(hw_req.get("maxBuffers", 6), 6),
    }
    config_kwargs = {
        "sensor_timing": sensor_timing,
        "control_path": control_path,
        "transport": transport,
        "global_latency_factor": safe_float(hw_req.get("globalLatencyFactor", 1.0), 1.0),
    }
    try:
        config = (
            hw_isp_config(**config_kwargs)
            if profile == "default"
            else hw_isp_config_from_profile(profile, **config_kwargs)
        )
        applied.append(f"hwIsp.profile={profile}")
    except Exception as exc:
        warnings.append(f"hwIsp profile {profile} could not be loaded; default config used: {type(exc).__name__}: {exc}")
        config = hw_isp_config(**config_kwargs)

    try:
        sequence = hw_isp_simulate_sequence(camera.clone(), scene, config, nframes=nframes, asset_store=store)
        summary = hw_isp_latency_summary(sequence)
        applied.append(f"hwIsp.sequence={nframes}frames")
        return {
            "enabled": True,
            "profile": profile,
            "applyToImage": bool(control_path["apply_to_image"]),
            "frameCount": int(round(float(summary.get("frame_count", nframes)))),
            "fps": round(float(sensor_timing["fps"]), 3),
            "e2eLatencyMeanMs": round(float(summary.get("e2e_latency_mean_us", 0.0)) / 1000.0, 3),
            "e2eLatencyMaxMs": round(float(summary.get("e2e_latency_max_us", 0.0)) / 1000.0, 3),
            "queueStallTotalMs": round(float(summary.get("queue_stall_total_us", 0.0)) / 1000.0, 3),
            "aeSettleFrame": round(float(summary.get("ae_settle_frame", -1.0)), 3),
            "awbSettleFrame": round(float(summary.get("awb_settle_frame", -1.0)), 3),
            "aeFinalErrorEv": round(float(summary.get("ae_final_error_ev", 0.0)), 4),
            "awbFinalRgbImbalance": round(float(summary.get("awb_final_rgb_imbalance", 0.0)), 4),
        }
    except Exception as exc:
        warnings.append(f"hwIsp simulation failed: {type(exc).__name__}: {exc}")
        return {
            "enabled": True,
            "profile": profile,
            "status": "failed",
        }


def static_camera_report(
    primary_scene,
    primary_srgb,
    primary_sensor_volts,
    request,
    camera,
    scene,
    sensor_resize,
    store,
    run_dir,
    warnings,
):
    protocol = [
        ("macbeth", "Color reproduction, neutral balance, clipping"),
        ("slanted bar", "Sharpness and ISO 12233 MTF"),
        ("dead leaves", "Texture preservation and denoise/ISP smoothing"),
        ("uniform ee", "Camera VSNR, sensor SNR, uniformity, saturation"),
        ("point array", "PSF spread and field response"),
        ("harmonic", "Image-derived frequency response"),
    ]
    tests = []
    chart_artifacts = {}
    function_payloads = _camera_e2e_function_payloads(camera, request, store, warnings)
    for scene_type, purpose in protocol:
        try:
            function_payload = function_payloads.get(scene_type)
            local_warnings = []
            local_applied = []
            test_scene, test_request = standard_chart_scene_from_request(scene_type, request, store, local_warnings, local_applied)
            test_scene = align_scene_to_camera_asset(test_scene, camera.clone(), test_request, local_warnings, local_applied)
            if local_warnings:
                warnings.extend([f"validation chart {scene_type}: {warning}" for warning in local_warnings])
            test_fov = float(scene_get(test_scene, "fov"))
            test_camera = try_apply(
                f"validationChart.cameraOiFov={scene_type}:{test_fov:.4g}deg",
                lambda: camera_set(camera.clone(), "oi fov", test_fov),
                warnings,
                local_applied,
            ) or camera.clone()
            computed_test = compute_camera_with_isp(
                test_camera,
                test_scene,
                test_request,
                sensor_resize,
                store,
                warnings,
                local_applied,
            )
            test_ip = computed_test.fields["ip"]
            test_sensor_obj = computed_test.fields["sensor"]
            test_srgb = np.asarray(test_ip.data.get("srgb", test_ip.data.get("result")), dtype=float)
            test_sensor = np.asarray(test_sensor_obj.data.get("volts", test_sensor_obj.data.get("dv", np.empty((0, 0)))), dtype=float)
            source = "CameraE2E chart render · standard chart fit"
            artifact_key = f"chart_{scene_type.replace(' ', '_').replace('/', '_')}"
            artifact_path = save_rgb(run_dir / f"{artifact_key}.png", crop_signal_region(test_srgb))
            chart_artifacts[artifact_key] = artifact_path
            if function_payload:
                metrics = function_payload.get("metrics", [])
                charts = function_payload.get("charts", [])
                source = f"{source} + CameraE2E metric function"
            else:
                metrics = _metrics_for_static_scene(scene_type, test_srgb, test_sensor)
                charts = _static_charts_for_scene(scene_type, test_srgb, test_sensor)
            tests.append(
                {
                    "scene": scene_type,
                    "purpose": purpose,
                    "source": source,
                    "status": "completed",
                    "artifactKey": artifact_key,
                    "metrics": metrics,
                    "charts": charts,
                    "framingMode": "standardChartFit",
                    "sceneFovDeg": round(test_fov, 4),
                    "fovPolicy": "Chart angular size is fitted for metric stability; physical ODD target size and distance are not preserved in Camera Validation.",
                }
            )
        except Exception as exc:
            warnings.append(f"static camera test {scene_type} failed: {type(exc).__name__}: {exc}")
            tests.append(
                {
                    "scene": scene_type,
                    "purpose": purpose,
                    "source": "not available",
                    "status": "failed",
                    "artifactKey": "",
                    "metrics": [_static_metric("status", "failed", "", "not_available", f"{type(exc).__name__}: {exc}")],
                    "charts": [],
                }
            )

    flat_metrics = []
    for test in tests:
        for metric in test["metrics"]:
            flat_metrics.append((test["scene"], metric))

    def find_metric(scene_name, metric_names):
        names = metric_names if isinstance(metric_names, (list, tuple)) else [metric_names]
        for scene, metric in flat_metrics:
            if scene == scene_name and metric["label"] in names:
                return metric["value"], metric.get("unit", "")
        return "-", ""

    mtf50, mtf_unit = find_metric("slanted bar", ["MTF50", "MTF50 estimate"])
    delta_e, _ = find_metric("macbeth", ["DeltaE mean", "DeltaE estimate"])
    snr, snr_unit = find_metric("uniform ee", ["Sensor SNR max", "SNR"])
    texture, texture_unit = find_metric("dead leaves", "Texture retention")
    psf_width, psf_unit = find_metric("point array", ["EE50 radius", "PSF width estimate"])
    frequency, frequency_unit = find_metric("harmonic", "Frequency response")
    return {
        "protocolVersion": "static-camera-e2e-functions-v2",
        "provenance": "Camera Validation uses Standard Chart Fit framing so Macbeth, slanted-bar, uniform, dead-leaves, point-array, and harmonic targets occupy stable metric regions. CameraE2E headless metric functions are used where available: camera_mtf, camera_color_accuracy, camera_vsnr, sensor_snr, and raytrace PSF helpers. Dead-leaves and harmonic response remain image-derived estimates until dedicated CameraE2E metric functions are exposed. Physical ODD target size/distance is preserved only in the Selected Scene Pipeline run.",
        "primaryScene": str(primary_scene),
        "summary": [
            {"label": "MTF50", "value": mtf50, "unit": mtf_unit, "source": "slanted bar"},
            {"label": "Color DeltaE", "value": delta_e, "unit": "", "source": "Macbeth"},
            {"label": "Sensor SNR", "value": snr, "unit": snr_unit, "source": "uniform ee"},
            {"label": "Texture retention", "value": texture, "unit": texture_unit, "source": "dead leaves"},
            {"label": "PSF width", "value": psf_width, "unit": psf_unit, "source": "point array"},
            {"label": "Frequency response", "value": frequency, "unit": frequency_unit, "source": "harmonic"},
        ],
        "tests": tests,
        "chartArtifacts": chart_artifacts,
    }


def stack_characterization_report(camera, request, store, warnings):
    tests = []
    try:
        qe_payload = _sensor_qe_function_payload(camera)
        tests.append(
            {
                "scene": "active sensor QE",
                "purpose": "Active spectral response after sensor constructor, spectral/QE asset, IR filter, and numeric QE scale.",
                "source": "CameraE2E sensor_get(sensor, 'spectral qe')",
                "status": "completed",
                "artifactKey": "",
                "metrics": qe_payload.get("metrics", []),
                "charts": qe_payload.get("charts", []),
            }
        )
    except Exception as exc:
        warnings.append(f"stack characterization sensor QE failed: {type(exc).__name__}: {exc}")
        tests.append(
            {
                "scene": "active sensor QE",
                "purpose": "Active spectral response after sensor constructor, spectral/QE asset, IR filter, and numeric QE scale.",
                "source": "not available",
                "status": "failed",
                "artifactKey": "",
                "metrics": [_static_metric("status", "failed", "", "not_available", f"{type(exc).__name__}: {exc}")],
                "charts": [],
            }
        )

    assets = request.get("assets", {})
    if assets.get("lensMode") == "raytraceOptics" and assets.get("lensAsset"):
        raytrace_asset_payload = _raytrace_asset_metadata_payload(camera, request)
        if raytrace_asset_payload is not None:
            tests.append(raytrace_asset_payload)
        try:
            psf_payload = _psf_function_payload(camera)
            tests.append(
                {
                    "scene": "raytrace optics PSF",
                    "purpose": "Center-field raytrace PSF profile from selected optics asset.",
                    "source": "CameraE2E rt_psf_interp / oi_psf",
                    "status": "completed",
                    "artifactKey": "",
                    "metrics": psf_payload.get("metrics", []),
                    "charts": psf_payload.get("charts", []),
                }
            )
        except Exception as exc:
            warnings.append(f"stack characterization raytrace PSF failed: {type(exc).__name__}: {exc}")
            tests.append(
                {
                    "scene": "raytrace optics PSF",
                    "purpose": "Center-field raytrace PSF profile from selected optics asset.",
                    "source": "not available",
                    "status": "failed",
                    "artifactKey": "",
                    "metrics": [_static_metric("status", "failed", "", "not_available", f"{type(exc).__name__}: {exc}")],
                    "charts": [],
                }
            )

    if assets.get("lensMode") == "raytraceOptics" and assets.get("lensAsset"):
        raytrace_tests = _raytrace_geometry_payload(camera)
        tests.extend(raytrace_tests)
        for item in raytrace_tests:
            if item.get("status") == "failed":
                metric = item.get("metrics", [{}])[0]
                description = metric.get("description", "not available") if isinstance(metric, dict) else "not available"
                warnings.append(f"stack characterization {item.get('scene')} failed: {description}")

    catalog_payload = _lens_catalog_asset_payload(request, store)
    if catalog_payload is not None:
        tests.append(catalog_payload)

    try:
        tests.append(_sensor_optical_stack_payload(camera))
    except Exception as exc:
        warnings.append(f"stack characterization sensor optical stack failed: {type(exc).__name__}: {exc}")
        tests.append(
            {
                "scene": "sensor optical stack / microlens",
                "purpose": "Sensor pixel optical-stack RI, layer thickness, and microlens metadata used for chief-ray and sensor stack review.",
                "source": "not available",
                "status": "failed",
                "artifactKey": "",
                "metrics": [_static_metric("status", "failed", "", "not_available", f"{type(exc).__name__}: {exc}")],
                "charts": [],
            }
        )

    tests.append(_module_calibration_payload(camera, request))

    flat_metrics = []
    for test in tests:
        for metric in test["metrics"]:
            flat_metrics.append((test["scene"], metric))

    def find_metric(metric_names):
        names = metric_names if isinstance(metric_names, (list, tuple)) else [metric_names]
        for _, metric in flat_metrics:
            if metric["label"] in names:
                return metric["value"], metric.get("unit", ""), metric.get("source", "")
        return "-", "", ""

    peak_qe, peak_qe_unit, peak_qe_source = find_metric("Peak spectral QE")
    mean_qe, mean_qe_unit, mean_qe_source = find_metric("Mean spectral QE")
    qe_channels, qe_channels_unit, qe_channels_source = find_metric("QE channels")
    raytrace_psf_requested = bool(assets.get("lensMode") == "raytraceOptics" and assets.get("lensAsset"))
    psf_width, psf_width_unit, psf_width_source = find_metric(["EE50 radius", "PSF diameter"])
    if not raytrace_psf_requested and psf_width == "-":
        psf_width = "not selected"
        psf_width_source = "requires raytrace optics asset"
    max_distortion, max_distortion_unit, max_distortion_source = find_metric("Max distortion")
    edge_ri, edge_ri_unit, edge_ri_source = find_metric("Edge RI min")
    oc_offset, oc_offset_unit, oc_offset_source = find_metric("OC offset")
    stack_layers, stack_layers_unit, stack_layers_source = find_metric("Sensor stack layers")
    return {
        "protocolVersion": "stack-characterization-v2",
        "provenance": "Pre-run CameraE2E stack characterization. It reads active sensor spectral QE, raytrace asset metadata, raytrace PSF, raytrace distortion/relative illumination, Lens DB surface/IOR metadata when exposed, sensor optical-stack RI, and module calibration metadata. It does not run the selected scene pipeline.",
        "primaryScene": "none",
        "summary": [
            {"label": "Peak spectral QE", "value": peak_qe, "unit": peak_qe_unit, "source": peak_qe_source or "active sensor QE"},
            {"label": "Mean spectral QE", "value": mean_qe, "unit": mean_qe_unit, "source": mean_qe_source or "active sensor QE"},
            {"label": "QE channels", "value": qe_channels, "unit": qe_channels_unit, "source": qe_channels_source or "active sensor QE"},
            {"label": "PSF width", "value": psf_width, "unit": psf_width_unit, "source": psf_width_source or "raytrace optics PSF"},
            {"label": "Max distortion", "value": max_distortion, "unit": max_distortion_unit, "source": max_distortion_source or "raytrace geometry / calibration"},
            {"label": "Edge RI", "value": edge_ri, "unit": edge_ri_unit, "source": edge_ri_source or "relative illumination"},
            {"label": "OC offset", "value": oc_offset, "unit": oc_offset_unit, "source": oc_offset_source or "module calibration"},
            {"label": "Sensor stack layers", "value": stack_layers, "unit": stack_layers_unit, "source": stack_layers_source or "sensor optical stack"},
        ],
        "tests": tests,
        "chartArtifacts": {},
    }


def artifact_url(path, output_dir):
    resolved = Path(path)
    for parent in [resolved.parent, *resolved.parents]:
        if parent.name == "public":
            return "/" + resolved.relative_to(parent).as_posix()
    return "/" + resolved.relative_to(output_dir.parent.parent).as_posix()


request = json.loads(request_path.read_text(encoding="utf-8"))
assets_request = request.get("assets", {})
run_mode = str(request.get("runMode", "full") or "full")
allowed_run_modes = {"stackCharacterization", "cameraEvaluation", "scenePipeline", "full"}
if run_mode not in allowed_run_modes:
    run_mode = "full"
run_stack_characterization = run_mode in {"stackCharacterization", "full"}
run_camera_evaluation = run_mode in {"cameraEvaluation", "full"}
run_scene_pipeline = run_mode in {"scenePipeline", "full"}
run_id = request.get("runId") or dt.datetime.now(dt.timezone.utc).strftime("cam-e2e-%Y%m%d-%H%M%S")
run_dir = output_dir / str(run_id)
run_dir.mkdir(parents=True, exist_ok=True)

warnings = []
applied = []
start = time.perf_counter()
store = AssetStore.default()
scene = scene_from_request(request, store, warnings, applied)
camera = camera_from_request(request, store, warnings, applied)
scene = align_scene_to_camera_asset(scene, camera, request, warnings, applied)
camera, scene, resolved_fov_authority = resolve_fov_authority(camera, scene, request, warnings, applied)
camera = apply_lens_physics(camera, request, store, warnings, applied)
sensor_fit_mode = str(request.get("sensor", {}).get("fitMode", "preserveResolution") or "preserveResolution")
if sensor_fit_mode not in {"preserveResolution", "matchSceneFov"}:
    warnings.append(f"sensor.fitMode={sensor_fit_mode} is unsupported; preserveResolution is used.")
    sensor_fit_mode = "preserveResolution"
sensor_resize = sensor_fit_mode == "matchSceneFov"
applied.append(f"sensor.fitMode={sensor_fit_mode}")
oi = camera.fields["oi"]
sensor = camera.fields["sensor"]
ip = camera.fields["ip"]
srgb = np.empty((0, 0, 3), dtype=float)
sensor_volts = np.empty((0, 0), dtype=float)
oi_photons = np.empty((0, 0), dtype=float)
source_reference_rgb = np.empty((0, 0, 3), dtype=float)
artifacts = {}

if run_scene_pipeline:
    source_image_path = str(request.get("scene", {}).get("sourceImagePath", "") or "")
    if source_image_path:
        try:
            source_reference_rgb = np.asarray(iio.imread(resolve_scene_source_path(source_image_path, output_dir)), dtype=float)
            if source_reference_rgb.ndim == 2:
                source_reference_rgb = np.repeat(source_reference_rgb[:, :, None], 3, axis=2)
            if source_reference_rgb.ndim == 3 and source_reference_rgb.shape[2] > 3:
                source_reference_rgb = source_reference_rgb[:, :, :3]
            if source_reference_rgb.size and float(np.nanmax(source_reference_rgb)) > 1.0:
                source_reference_rgb = source_reference_rgb / 255.0
            artifacts["sourceReference"] = save_rgb(run_dir / "source_reference.png", np.clip(source_reference_rgb, 0.0, 1.0))
        except Exception as exc:
            warnings.append(f"scene.sourceReference artifact failed: {type(exc).__name__}: {exc}")
    computed = compute_camera_with_isp(camera.clone(), scene, request, sensor_resize, store, warnings, applied)
    oi = computed.fields["oi"]
    sensor = computed.fields["sensor"]
    ip = computed.fields["ip"]
    srgb = np.asarray(ip.data.get("srgb", ip.data.get("result")), dtype=float)
    sensor_volts = np.asarray(sensor.data.get("volts", sensor.data.get("dv", np.empty((0, 0)))), dtype=float)
    oi_photons = np.asarray(oi.data.get("photons", np.empty((0, 0))), dtype=float)
    display_preview = display_tuned_preview(srgb)
    artifacts["ipSrgb"] = save_rgb(run_dir / "ip_srgb.png", srgb)
    artifacts["displayPreview"] = save_rgb(run_dir / "display_tuned_preview.png", display_preview)
    if sensor_volts.size:
        artifacts["sensorVolts"] = save_rgb(run_dir / "sensor_volts.png", sensor_volts)
    if oi_photons.size:
        artifacts["oiPhotons"] = save_rgb(run_dir / "oi_photons.png", np.mean(oi_photons, axis=2) if oi_photons.ndim == 3 else oi_photons)
    perception_metrics = camera_e2e_task_perception_metrics(srgb, request, run_dir, warnings, applied)
    perception_overlay = perception_metrics.pop("overlayPath", None) if isinstance(perception_metrics, dict) else None
    if perception_overlay:
        artifacts["perceptionOverlay"] = perception_overlay
else:
    perception_metrics = None
    display_preview = np.empty((0, 0, 3), dtype=float)

stack_report = stack_characterization_report(camera, request, store, warnings) if run_stack_characterization else None
static_report = None
if run_camera_evaluation:
    static_report = static_camera_report(
        request.get("scene", {}).get("type", "macbeth"),
        srgb,
        sensor_volts,
        request,
        camera,
        scene,
        sensor_resize,
        store,
        run_dir,
        warnings,
    )
    for artifact_key, artifact_path in static_report.get("chartArtifacts", {}).items():
        artifacts[artifact_key] = artifact_path
    for test in static_report.get("tests", []):
        artifact_key = test.get("artifactKey")
        artifact_path = artifacts.get(artifact_key)
        if artifact_path:
            test["artifact"] = {
                "path": artifact_path,
                "url": artifact_url(artifact_path, output_dir),
            }
if run_scene_pipeline or run_camera_evaluation:
    hw_isp_summary = hw_isp_summary_from_request(camera, scene, request, store, warnings, applied)
else:
    hw_req = request.get("hwIsp", {}) or {}
    hw_isp_summary = {
        "enabled": safe_bool(hw_req.get("enabled", False), False),
        "profile": str(hw_req.get("profile", "default") or "default"),
        "status": "not run in stack characterization mode",
    }
elapsed_ms = (time.perf_counter() - start) * 1000.0

scene_request = request.get("scene", {})
scene_geometry_mode = str(scene_request.get("geometryMode", "physicalGeometry") or "physicalGeometry")
scene_physical_hfov = angular_extent_deg(scene_request.get("targetWidthM", 1.2), scene_request.get("distanceM", 5.0))
scene_physical_vfov = angular_extent_deg(scene_request.get("targetHeightM", 0.8), scene_request.get("distanceM", 5.0))
scene_summary = {
    "type": scene_request.get("type", "macbeth"),
    "geometryMode": scene_geometry_mode,
    "sourceImagePath": str(scene_request.get("sourceImagePath", "") or ""),
    "sourceImageLabel": str(scene_request.get("sourceImageLabel", "") or ""),
    "sourceImageAttribution": str(scene_request.get("sourceImageAttribution", "") or ""),
    "targetWidthM": safe_float(scene_request.get("targetWidthM", 0.0), 0.0),
    "targetHeightM": safe_float(scene_request.get("targetHeightM", 0.0), 0.0),
    "distanceM": safe_float(scene_request.get("distanceM", 0.0), 0.0),
    "physicalHfovDeg": round(float(scene_physical_hfov), 4) if scene_physical_hfov is not None else "",
    "physicalVfovDeg": round(float(scene_physical_vfov), 4) if scene_physical_vfov is not None else "",
    "size": [int(x) for x in np.asarray(scene_get(scene, "size"), dtype=int).reshape(-1)],
    "fovDeg": float(scene_get(scene, "fov")),
    "requestedFovDeg": safe_float(scene_request.get("fovDeg", scene_get(scene, "fov")), float(scene_get(scene, "fov"))),
    "fovPolicy": (
        "Scene angular FOV is used directly; physical target size/distance is metadata for object scale context."
        if scene_geometry_mode == "angularFov"
        else "Physical scene size/distance is converted to angular extent; CameraE2E synthetic targets may be aligned to the selected camera FOV authority."
    ),
}
requested_hfov = request.get("lens", {}).get("hfovDeg")
lens_asset_selected = assets_request.get("lensMode") in {"raytraceOptics", "catalogLens", "lensFileReference"} and assets_request.get("lensAsset")
oi_reported_fov = float(oi_get(oi, "fov"))
sensor_size_for_fov = np.asarray(sensor_get(sensor, "size"), dtype=int).reshape(-1)
sensor_rows_for_fov = int(sensor_size_for_fov[0]) if sensor_size_for_fov.size else 0
sensor_cols_for_fov = int(sensor_size_for_fov[-1]) if sensor_size_for_fov.size else 0
oi_reported_fov_as_hfov = oi_reported_fov
oi_reported_fov_converted_hfov = diagonal_to_horizontal_fov_deg(oi_reported_fov, sensor_rows_for_fov, sensor_cols_for_fov)
requested_physical_hfov_for_oi = physical_hfov_deg(
    request.get("sensor", {}).get("cols", 0),
    request.get("sensor", {}).get("pixelSizeUm", 0),
    request.get("lens", {}).get("focalLengthMm", 0),
)
if requested_physical_hfov_for_oi is not None and oi_reported_fov_converted_hfov is not None:
    raw_delta = abs(oi_reported_fov_as_hfov - requested_physical_hfov_for_oi)
    converted_delta = abs(oi_reported_fov_converted_hfov - requested_physical_hfov_for_oi)
    resolved_hfov = oi_reported_fov_converted_hfov if converted_delta < raw_delta else oi_reported_fov_as_hfov
else:
    resolved_hfov = oi_reported_fov_converted_hfov or oi_reported_fov_as_hfov
if assets_request.get("lensMode") == "raytraceOptics" and assets_request.get("lensAsset"):
    lens_source = "raytrace optics asset"
    lens_numeric_policy = "numeric lens controls locked by raytrace asset"
elif assets_request.get("lensMode") in {"catalogLens", "lensFileReference"} and assets_request.get("lensAsset"):
    lens_source = "catalog lens approximation"
    lens_numeric_policy = "numeric lens controls locked by catalog asset"
else:
    lens_source = "generated/default optics"
    lens_numeric_policy = "numeric lens controls applied before physics mode"
lens_request = request.get("lens", {})
lens_summary = {
    "source": lens_source,
    "numericPolicy": lens_numeric_policy,
    "fNumber": float(oi_get(oi, "optics fnumber")),
    "requestedFNumber": safe_float(lens_request.get("fNumber", oi_get(oi, "optics fnumber")), float(oi_get(oi, "optics fnumber"))),
    "focalLengthMm": float(oi_get(oi, "optics focal length", "mm")),
    "requestedFocalLengthMm": safe_float(
        lens_request.get("focalLengthMm", oi_get(oi, "optics focal length", "mm")),
        float(oi_get(oi, "optics focal length", "mm")),
    ),
    "hfovDeg": resolved_hfov,
    "oiReportedFovDeg": oi_reported_fov,
    "requestedTransmittanceScale": safe_float(lens_request.get("transmittanceScale", 1.0), 1.0),
}
if requested_hfov is not None:
    requested_hfov_float = safe_float(requested_hfov, resolved_hfov)
    lens_summary["requestedHfovDeg"] = requested_hfov_float
    lens_summary["hfovDeltaDeg"] = round(resolved_hfov - requested_hfov_float, 4)
    if (
        not lens_asset_selected
        and str(lens_request.get("fovAuthority", "physicalGeometry")) == "manualOiHfov"
        and abs(resolved_hfov - requested_hfov_float) > 0.5
    ):
        warnings.append(
            "lens.hfovDeg is over-constrained by scene/sensor/focal geometry; "
            f"requested {requested_hfov_float:.2f} deg, resolved {resolved_hfov:.2f} deg."
        )
sensor_request = request.get("sensor", {})
sensor_resize_policy = (
    "CameraE2E auto-resized sensor rows/cols to match scene FOV."
    if sensor_fit_mode == "matchSceneFov"
    else "Requested sensor rows/cols preserved; scene and lens FOV are resolved separately."
)
sensor_summary = {
    "fitMode": sensor_fit_mode,
    "numericPolicy": "sensor asset/reference is loaded first; numeric sensor controls override pixel, exposure, noise, QE, and bit depth.",
    "resizePolicy": sensor_resize_policy,
    "size": [int(x) for x in np.asarray(sensor_get(sensor, "size"), dtype=int).reshape(-1)],
    "requestedSize": [
        safe_int(sensor_request.get("rows", np.asarray(sensor_get(sensor, "size"), dtype=int).reshape(-1)[0]), 0),
        safe_int(sensor_request.get("cols", np.asarray(sensor_get(sensor, "size"), dtype=int).reshape(-1)[-1]), 0),
    ],
    "pixelSizeUm": [round(float(x) * 1.0e6, 4) for x in np.asarray(sensor_get(sensor, "pixel size"), dtype=float).reshape(-1)],
    "requestedPixelSizeUm": safe_float(sensor_request.get("pixelSizeUm", 0.0), 0.0),
    "exposureMs": round(float(sensor_get(sensor, "exposure duration")) * 1000.0, 4),
    "requestedExposureMs": safe_float(sensor_request.get("exposureMs", 0.0), 0.0),
    "analogGain": float(sensor_get(sensor, "analog gain")),
    "noiseFlag": int(sensor_get(sensor, "noise flag")),
    "bitDepth": int(sensor_get(sensor, "nbits")),
}
if sensor_fit_mode == "matchSceneFov" and sensor_summary["size"] != sensor_summary["requestedSize"]:
    warnings.append(
        "sensor.rows/cols were auto-resized by CameraE2E to match the scene FOV. "
        f"requested {sensor_summary['requestedSize']}, resolved {sensor_summary['size']}."
    )
elif sensor_fit_mode == "preserveResolution" and sensor_summary["size"] != sensor_summary["requestedSize"]:
    warnings.append(
        "sensor.rows/cols did not resolve to the requested size even though preserveResolution was selected. "
        f"requested {sensor_summary['requestedSize']}, resolved {sensor_summary['size']}."
    )
isp_summary = {
    "demosaicMethod": str(ip_get(ip, "demosaic method")),
    "sensorConversionMethod": str(ip_get(ip, "sensor conversion method")),
    "internalColorSpace": str(ip_get(ip, "internal cs")),
    "illuminantCorrection": str(ip_get(ip, "illuminant correction method")),
    "renderScale": bool(ip_get(ip, "render scale")),
    "renderDemosaicOnly": safe_bool(request.get("isp", {}).get("renderDemosaicOnly", False), False),
    "hdrWhite": safe_bool(request.get("isp", {}).get("hdrWhite", False), False),
    "hdrLevel": round(safe_float(request.get("isp", {}).get("hdrLevel", 0.95), 0.95), 4),
    "displayPreviewPolicy": "post-render tone/white-balance/saturation preview only; metrics and perception use physical ISP sRGB",
}
resolved_pixel_size_um = float(np.asarray(sensor_get(sensor, "pixel size"), dtype=float).reshape(-1)[0] * 1.0e6)
resolved_sensor_cols = int(np.asarray(sensor_get(sensor, "size"), dtype=int).reshape(-1)[-1])
requested_physical_hfov = physical_hfov_deg(
    sensor_request.get("cols", 0),
    sensor_request.get("pixelSizeUm", 0),
    lens_request.get("focalLengthMm", 0),
)
resolved_physical_hfov = physical_hfov_deg(
    resolved_sensor_cols,
    resolved_pixel_size_um,
    lens_summary["focalLengthMm"],
)
target_image_width_mm = image_size_on_sensor_mm(
    scene_request.get("targetWidthM", 0.0),
    scene_request.get("distanceM", 0.0),
    lens_summary["focalLengthMm"],
)
target_image_width_px = (
    target_image_width_mm / (resolved_pixel_size_um / 1000.0)
    if target_image_width_mm is not None and resolved_pixel_size_um > 0.0
    else None
)
sampling_px_per_deg = resolved_sensor_cols / max(resolved_hfov, 1.0e-6)
fov_status = "clean"
fov_notes = []
if resolved_physical_hfov is not None and abs(resolved_hfov - resolved_physical_hfov) > 1.0:
    fov_status = "warning"
    fov_notes.append(
        f"resolved OI HFOV differs from sensor-width/focal physical HFOV by {abs(resolved_hfov - resolved_physical_hfov):.2f} deg"
    )
if scene_physical_hfov is not None and scene_physical_hfov > resolved_hfov + 0.5:
    fov_status = "warning"
    fov_notes.append("physical target angular extent is wider than resolved lens/OI HFOV")
elif scene_physical_hfov is not None and scene_geometry_mode == "physicalGeometry":
    frame_fraction = scene_physical_hfov / max(resolved_hfov, 1.0e-6)
    fov_notes.append(f"physical target uses about {frame_fraction:.2f}x of horizontal frame by angular extent")
if resolved_fov_authority in {"physicalGeometry", "numericOptics"} and requested_hfov is not None:
    requested_hfov_float = safe_float(requested_hfov, resolved_hfov)
    if abs(requested_hfov_float - resolved_hfov) > 1.0:
        fov_notes.append("manual HFOV target was ignored because physical/numeric geometry owns FOV")
if fov_status == "warning" and fov_notes:
    warnings.append("FOV ledger: " + "; ".join(fov_notes) + ".")
try:
    raytrace_diagonal_limit = (
        round(float(oi_get(oi, "optics rt fov")), 4)
        if assets_request.get("lensMode") == "raytraceOptics" and assets_request.get("lensAsset")
        else ""
    )
except Exception:
    raytrace_diagonal_limit = ""
fov_ledger_summary = {
    "authorityRequested": str(lens_request.get("fovAuthority", "physicalGeometry")),
    "authorityResolved": resolved_fov_authority,
    "sceneGeometryMode": scene_geometry_mode,
    "scenePhysicalHfovDeg": round(float(scene_physical_hfov), 4) if scene_physical_hfov is not None else "",
    "scenePhysicalVfovDeg": round(float(scene_physical_vfov), 4) if scene_physical_vfov is not None else "",
    "cameraE2eSceneFovDeg": round(float(scene_summary["fovDeg"]), 4),
    "lensOiResolvedHfovDeg": round(float(resolved_hfov), 4),
    "oiReportedFovDeg": round(float(oi_reported_fov), 4),
    "manualHfovTargetDeg": safe_float(lens_request.get("hfovDeg", resolved_hfov), resolved_hfov),
    "sensorActiveWidthMm": round(resolved_sensor_cols * resolved_pixel_size_um / 1000.0, 6),
    "focalLengthMm": round(float(lens_summary["focalLengthMm"]), 6),
    "targetImageWidthMm": round(float(target_image_width_mm), 6) if target_image_width_mm is not None else "",
    "targetImageWidthPx": round(float(target_image_width_px), 2) if target_image_width_px is not None else "",
    "physicalHfovFromSensorAndFocalDeg": round(float(resolved_physical_hfov), 4)
    if resolved_physical_hfov is not None
    else "",
    "requestedPhysicalHfovDeg": round(float(requested_physical_hfov), 4) if requested_physical_hfov is not None else "",
    "samplingPxPerDeg": round(float(sampling_px_per_deg), 4),
    "raytraceDiagonalLimitDeg": raytrace_diagonal_limit,
    "status": fov_status,
    "notes": " | ".join(fov_notes) if fov_notes else "No FOV conflicts detected.",
}
asset_summary = {
    "lensMode": str(assets_request.get("lensMode", "none")),
    "lensAsset": str(assets_request.get("lensAsset", "")),
    "sensorType": str(assets_request.get("sensorType", "default")),
    "sensorVariant": str(assets_request.get("sensorVariant", "")),
    "colorFilterAsset": str(assets_request.get("colorFilterAsset", "")),
}
physics_request = request.get("lensPhysics", {}) or {}
try:
    resolved_compute_method = str(oi_get(oi, "compute method"))
except Exception:
    resolved_compute_method = str(oi.fields.get("compute_method", oi.fields.get("optics", {}).get("compute_method", "unknown")))
resolved_optics_model = optics_model_name(computed if run_scene_pipeline else camera)
if not resolved_compute_method and normalize_model_name(resolved_optics_model) == "raytrace":
    resolved_compute_method = "raytrace"
try:
    resolved_psf_angle_step = (
        round(float(oi_get(oi, "psf angle step")), 4)
        if str(physics_request.get("mode", "none")) == "raytracePsf"
        else ""
    )
except Exception:
    resolved_psf_angle_step = ""
try:
    resolved_aberration = round(float(oi.fields.get("optics", {}).get("aberration_scale", 0.0)), 4)
except Exception:
    resolved_aberration = 0.0
physics_mode = str(physics_request.get("mode", "none"))
physics_used_parameters = {
    "none": "none; selected optics default",
    "diffraction": "lens F-number and spectrum/wavelength",
    "gaussianPsf": "gaussianSpreadUm, xyRatio",
    "wvfDefocus": "defocusDiopters",
    "raytracePsf": "psfAngleStepDeg",
}.get(physics_mode, "none; unsupported mode ignored")
physics_summary = {
    "mode": physics_mode,
    "resolvedOpticsModel": resolved_optics_model,
    "resolvedComputeMethod": resolved_compute_method,
    "usedParameters": physics_used_parameters,
}
if physics_mode == "gaussianPsf":
    physics_summary["gaussianSpreadUm"] = safe_float(physics_request.get("gaussianSpreadUm", 0.0), 0.0)
    physics_summary["xyRatio"] = safe_float(physics_request.get("xyRatio", 1.0), 1.0)
elif physics_mode == "wvfDefocus":
    physics_summary["defocusDiopters"] = safe_float(physics_request.get("defocusDiopters", 0.0), 0.0)
elif physics_mode == "raytracePsf":
    physics_summary["psfAngleStepDeg"] = resolved_psf_angle_step
if resolved_aberration > 0:
    physics_summary["aberrationScalePx"] = resolved_aberration
off_axis_summary = off_axis_illumination_summary(oi, request)
if physics_mode == "none" and normalize_model_name(resolved_optics_model) == "raytrace":
    physics_policy = "selected raytrace optics default; Zemax PSF convolution remains active"
elif physics_mode == "none":
    physics_policy = "selected optics default; no extra synthetic physics mode"
elif physics_mode == "raytracePsf":
    physics_policy = "requires raytrace optics; adjusts PSF angular sampling step"
else:
    physics_policy = "replaces current optics model for this run"
resolution_summary = {
    "scene": scene_summary["fovPolicy"],
    "lens": lens_numeric_policy,
    "physics": physics_policy,
    "sensor": sensor_resize_policy,
    "outputImageShape": [int(x) for x in np.asarray(srgb).shape],
}

metrics_payload = {}
if run_scene_pipeline and srgb.size:
    metrics_payload.update(
        {
            "imageShape": [int(x) for x in np.asarray(srgb).shape],
            "sourceReferenceMeanRgb": [round(float(x), 4) for x in np.mean(source_reference_rgb.reshape(-1, source_reference_rgb.shape[-1]), axis=0)[:3]]
            if source_reference_rgb.size
            else None,
            "meanRgb": [round(float(x), 4) for x in np.mean(srgb.reshape(-1, srgb.shape[-1]), axis=0)[:3]],
            "displayPreviewMeanRgb": [round(float(x), 4) for x in np.mean(display_preview.reshape(-1, display_preview.shape[-1]), axis=0)[:3]],
            "sensorVoltsMean": round(float(np.mean(sensor_volts)), 6) if sensor_volts.size else None,
            "sensorVoltsP99": round(float(np.percentile(sensor_volts, 99)), 6) if sensor_volts.size else None,
            "oiPhotonsMean": round(float(np.mean(oi_photons)), 6) if oi_photons.size else None,
            "perception": perception_metrics,
            "perceptionProxy": perception_metrics if perception_metrics and perception_metrics.get("adapterStatus") in {"proxy_only", "task_perception_unavailable", "task_perception_failed_fallback"} else None,
        }
    )
if static_report is not None:
    metrics_payload["staticCamera"] = static_report
if stack_report is not None:
    metrics_payload["stackCharacterization"] = stack_report

result = {
    "schemaVersion": 1,
    "runId": str(run_id),
    "runMode": run_mode,
    "status": "completed",
    "createdAt": dt.datetime.now(dt.timezone.utc).isoformat(),
    "elapsedMs": round(elapsed_ms, 3),
    "request": request,
    "applied": applied,
    "warnings": warnings,
    "summaries": {
        "scene": scene_summary,
        "lens": lens_summary,
        "sensor": sensor_summary,
        "isp": isp_summary,
        "hwIsp": hw_isp_summary,
        "assets": asset_summary,
        "physics": physics_summary,
        "offAxisIllumination": off_axis_summary,
        "resolution": resolution_summary,
        "fovLedger": fov_ledger_summary,
    },
    "metrics": metrics_payload,
    "artifacts": {
        key: {
            "path": value,
            "url": artifact_url(value, output_dir),
        }
        for key, value in artifacts.items()
    },
}
(run_dir / "result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result))
"""

    command = [
        str(python_status["python"]),
        "-c",
        code,
        str(camera_e2e_root),
        str(request_path),
        str(output_dir),
    ]
    timeout_seconds = 180
    try:
        timeout_request = json.loads(request_path.read_text(encoding="utf-8"))
        timeout_assets = timeout_request.get("assets", {})
        timeout_physics = timeout_request.get("lensPhysics", {})
        if timeout_assets.get("lensMode") == "raytraceOptics" and timeout_assets.get("lensAsset"):
            timeout_seconds = 600
        if timeout_physics.get("mode") == "raytracePsf":
            timeout_seconds = max(timeout_seconds, 600)
    except Exception:
        timeout_seconds = 180
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=timeout_seconds, check=False)
    except subprocess.TimeoutExpired as exc:
        return {
            "status": "failed",
            "error": (
                f"CameraE2E full characterization timed out after {timeout_seconds}s. "
                "Raytrace optics and PSF convolution can be expensive; reduce resolution for iteration "
                "or run this configuration as a longer offline job."
            ),
            "stdout": (exc.stdout or "").strip() if isinstance(exc.stdout, str) else "",
            "stderr": (exc.stderr or "").strip() if isinstance(exc.stderr, str) else "",
            "timeoutSeconds": timeout_seconds,
        }
    except Exception as exc:  # pragma: no cover - host dependent.
        return {"status": "failed", "error": f"{type(exc).__name__}: {exc}"}

    if result.returncode != 0:
        return {
            "status": "failed",
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "returncode": result.returncode,
        }
    return json.loads(result.stdout.strip().splitlines()[-1])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True, help="Path to request JSON, or '-' for stdin.")
    parser.add_argument("--camera-e2e-root", type=Path, default=DEFAULT_CAMERA_E2E_ROOT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR / "live-runs")
    parser.add_argument("--python", default="auto")
    args = parser.parse_args()

    request = read_request(args.request)
    output_dir = args.output_dir.expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    request_id = str(request.get("runId") or f"request-{dt.datetime.now(dt.UTC).strftime('%Y%m%d%H%M%S%f')}")
    safe_request_id = re.sub(r"[^A-Za-z0-9_.-]+", "-", request_id).strip("-") or "camera-request"
    request_path = output_dir / f"{safe_request_id}_request.json"
    request_path.write_text(json.dumps(request, indent=2), encoding="utf-8")
    (output_dir / "_latest_request.json").write_text(json.dumps(request, indent=2), encoding="utf-8")

    camera_e2e_root = args.camera_e2e_root.expanduser().resolve()
    python_status = check_live_import(camera_e2e_root, args.python)
    result = run_inner_simulation(camera_e2e_root, output_dir, request_path, python_status)
    print(json.dumps(result, indent=2))
    return 0 if result.get("status") == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
