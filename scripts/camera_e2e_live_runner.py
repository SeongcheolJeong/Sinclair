#!/usr/bin/env python3
"""Run a configurable CameraE2E live simulation from a JSON request."""

from __future__ import annotations

import argparse
import datetime as dt
import json
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
    ip_get,
    oi_create,
    oi_get,
    oi_set,
    scene_adjust_luminance,
    scene_create,
    scene_get,
    scene_set,
    sensor_create,
    sensor_get,
    sensor_read_filter,
    sensor_set,
    si_synthetic,
)
from pyisetcam.sensor import _sensor_from_upstream_model


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
        return apply_optics_aberration_scale(camera, physics_req.get("aberrationPixels", 0.0), warnings, applied)

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

    return apply_optics_aberration_scale(camera, physics_req.get("aberrationPixels", 0.0), warnings, applied)


def scene_from_request(request, store, warnings, applied):
    scene_req = request.get("scene", {})
    scene_type = str(scene_req.get("type", "macbeth"))
    patch_size = safe_int(scene_req.get("patchSize", 8), 8)
    if scene_type == "macbeth":
        scene = scene_create("macbeth", patch_size, asset_store=store)
    elif scene_type == "uniform ee":
        scene = scene_create("uniform ee", patch_size, asset_store=store)
    else:
        scene = scene_create(scene_type, asset_store=store)
    applied.append(f"scene.type={scene_type}")
    if "fovDeg" in scene_req:
        scene = try_apply(
            f"scene.fovDeg={scene_req['fovDeg']}",
            lambda: scene_set(scene, "fov", safe_float(scene_req["fovDeg"], 10.0)),
            warnings,
            applied,
        ) or scene
    if "luminanceCdM2" in scene_req:
        scene = try_apply(
            f"scene.luminanceCdM2={scene_req['luminanceCdM2']}",
            lambda: scene_adjust_luminance(scene, safe_float(scene_req["luminanceCdM2"], 100.0), asset_store=store),
            warnings,
            applied,
        ) or scene
    return scene


def camera_from_request(request, store, warnings, applied):
    camera = camera_create(asset_store=store)
    assets_req = request.get("assets", {})
    lens_req = request.get("lens", {})
    sensor_req = request.get("sensor", {})
    isp_req = request.get("isp", {})
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
        camera = try_apply(
            f"lens.hfovDeg={lens_req['hfovDeg']}",
            lambda: camera_set(camera, "oi fov", safe_float(lens_req["hfovDeg"], 10.0)),
            warnings,
            applied,
        ) or camera
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
    if "illuminantCorrection" in isp_req:
        camera = try_apply(
            f"isp.illuminantCorrection={isp_req['illuminantCorrection']}",
            lambda: camera_set(camera, "ip illuminant correction method", str(isp_req["illuminantCorrection"])),
            warnings,
            applied,
        ) or camera

    return camera


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


def artifact_url(path, output_dir):
    resolved = Path(path)
    for parent in [resolved.parent, *resolved.parents]:
        if parent.name == "public":
            return "/" + resolved.relative_to(parent).as_posix()
    return "/" + resolved.relative_to(output_dir.parent.parent).as_posix()


request = json.loads(request_path.read_text(encoding="utf-8"))
assets_request = request.get("assets", {})
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
camera = apply_lens_physics(camera, request, store, warnings, applied)
sensor_fit_mode = str(request.get("sensor", {}).get("fitMode", "preserveResolution") or "preserveResolution")
if sensor_fit_mode not in {"preserveResolution", "matchSceneFov"}:
    warnings.append(f"sensor.fitMode={sensor_fit_mode} is unsupported; preserveResolution is used.")
    sensor_fit_mode = "preserveResolution"
sensor_resize = sensor_fit_mode == "matchSceneFov"
applied.append(f"sensor.fitMode={sensor_fit_mode}")
computed = camera_compute(camera.clone(), scene, sensor_resize=sensor_resize, asset_store=store)
elapsed_ms = (time.perf_counter() - start) * 1000.0

oi = computed.fields["oi"]
sensor = computed.fields["sensor"]
ip = computed.fields["ip"]
srgb = np.asarray(ip.data.get("srgb", ip.data.get("result")), dtype=float)
sensor_volts = np.asarray(sensor.data.get("volts", sensor.data.get("dv", np.empty((0, 0)))), dtype=float)
oi_photons = np.asarray(oi.data.get("photons", np.empty((0, 0))), dtype=float)

artifacts = {
    "ipSrgb": save_rgb(run_dir / "ip_srgb.png", srgb),
}
if sensor_volts.size:
    artifacts["sensorVolts"] = save_rgb(run_dir / "sensor_volts.png", sensor_volts)
if oi_photons.size:
    artifacts["oiPhotons"] = save_rgb(run_dir / "oi_photons.png", np.mean(oi_photons, axis=2) if oi_photons.ndim == 3 else oi_photons)

scene_request = request.get("scene", {})
scene_summary = {
    "type": scene_request.get("type", "macbeth"),
    "size": [int(x) for x in np.asarray(scene_get(scene, "size"), dtype=int).reshape(-1)],
    "fovDeg": float(scene_get(scene, "fov")),
    "requestedFovDeg": safe_float(scene_request.get("fovDeg", scene_get(scene, "fov")), float(scene_get(scene, "fov"))),
    "fovPolicy": "Scene angular content; raytrace asset may clamp it to the lens analysis FOV.",
}
requested_hfov = request.get("lens", {}).get("hfovDeg")
lens_asset_selected = assets_request.get("lensMode") in {"raytraceOptics", "catalogLens", "lensFileReference"} and assets_request.get("lensAsset")
resolved_hfov = float(oi_get(oi, "fov"))
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
    "requestedTransmittanceScale": safe_float(lens_request.get("transmittanceScale", 1.0), 1.0),
}
if requested_hfov is not None:
    requested_hfov_float = safe_float(requested_hfov, resolved_hfov)
    lens_summary["requestedHfovDeg"] = requested_hfov_float
    lens_summary["hfovDeltaDeg"] = round(resolved_hfov - requested_hfov_float, 4)
    if not lens_asset_selected and abs(resolved_hfov - requested_hfov_float) > 0.5:
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
    "illuminantCorrection": str(ip_get(ip, "illuminant correction method")),
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
resolved_optics_model = optics_model_name(computed)
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
physics_summary = {
    "mode": str(physics_request.get("mode", "none")),
    "resolvedOpticsModel": resolved_optics_model,
    "resolvedComputeMethod": resolved_compute_method,
    "gaussianSpreadUm": safe_float(physics_request.get("gaussianSpreadUm", 0.0), 0.0),
    "xyRatio": safe_float(physics_request.get("xyRatio", 1.0), 1.0),
    "defocusDiopters": safe_float(physics_request.get("defocusDiopters", 0.0), 0.0),
    "aberrationScalePx": resolved_aberration,
    "psfAngleStepDeg": resolved_psf_angle_step,
}
physics_mode = str(physics_request.get("mode", "none"))
if physics_mode == "none" and normalize_model_name(resolved_optics_model) == "raytrace":
    physics_policy = "selected raytrace optics default; Zemax PSF convolution remains active"
elif physics_mode == "none":
    physics_policy = "selected optics default; no extra synthetic physics mode"
elif physics_mode == "raytracePsf":
    physics_policy = "requires raytrace optics; adjusts PSF angular sampling step"
else:
    physics_policy = "replaces current optics model for this run"
resolution_summary = {
    "scene": "scene FOV creates angular scene content; raytrace assets may clamp scene FOV",
    "lens": lens_numeric_policy,
    "physics": physics_policy,
    "sensor": sensor_resize_policy,
    "outputImageShape": [int(x) for x in np.asarray(srgb).shape],
}

result = {
    "schemaVersion": 1,
    "runId": str(run_id),
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
        "assets": asset_summary,
        "physics": physics_summary,
        "resolution": resolution_summary,
    },
    "metrics": {
        "imageShape": [int(x) for x in np.asarray(srgb).shape],
        "meanRgb": [round(float(x), 4) for x in np.mean(srgb.reshape(-1, srgb.shape[-1]), axis=0)[:3]],
        "sensorVoltsMean": round(float(np.mean(sensor_volts)), 6) if sensor_volts.size else None,
        "sensorVoltsP99": round(float(np.percentile(sensor_volts, 99)), 6) if sensor_volts.size else None,
        "oiPhotonsMean": round(float(np.mean(oi_photons)), 6) if oi_photons.size else None,
        "perceptionProxy": proxy_perception_metrics(srgb, request),
    },
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
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=90, check=False)
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
    request_path = output_dir / "_latest_request.json"
    request_path.write_text(json.dumps(request, indent=2), encoding="utf-8")

    camera_e2e_root = args.camera_e2e_root.expanduser().resolve()
    python_status = check_live_import(camera_e2e_root, args.python)
    result = run_inner_simulation(camera_e2e_root, output_dir, request_path, python_status)
    print(json.dumps(result, indent=2))
    return 0 if result.get("status") == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
