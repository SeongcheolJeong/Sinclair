#!/usr/bin/env python3
"""Build a Sinclair-readable index of CameraE2E lens and sensor assets."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from camera_e2e_bridge import DEFAULT_CAMERA_E2E_ROOT, DEFAULT_OUTPUT_DIR, check_live_import


def run_inner_index(camera_e2e_root: Path, python_status: dict[str, Any]) -> dict[str, Any]:
    if not python_status.get("available"):
        return {
            "schemaVersion": 1,
            "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "sourceRoot": str(camera_e2e_root),
            "lensAssets": [],
            "sensorAssets": [],
            "warnings": ["CameraE2E Python is not available; asset index could not be generated."],
        }

    code = r"""
import datetime as dt
import json
import re
import sys
from pathlib import Path

import numpy as np

camera_e2e_root = Path(sys.argv[1])
sys.path.insert(0, str(camera_e2e_root / "src"))

from pyisetcam import AssetStore, oi_create, oi_get, sensor_create, sensor_get
from pyisetcam.sensor import _sensor_from_upstream_model


def rel(path, root):
    return path.relative_to(root).as_posix()


def option_id(prefix, value):
    return prefix + ":" + value.replace("/", "__").replace(" ", "_")


def summarize_oi(store, relative_path):
    try:
        oi = oi_create("ray trace", store.resolve(relative_path), asset_store=store)
        return (
            f"RT diagonal FOV {float(oi_get(oi, 'optics rt fov')):.1f} deg, "
            f"F/{float(oi_get(oi, 'optics fnumber')):.2f}, "
            f"{float(oi_get(oi, 'optics focal length', 'mm')):.2f} mm"
        ), True
    except Exception as exc:
        return f"Raytrace load check failed: {type(exc).__name__}: {exc}", False


def make_sensor(store, sensor_type, variant=None):
    if variant:
        return sensor_create(sensor_type, variant, asset_store=store)
    return sensor_create(sensor_type, asset_store=store)


def summarize_sensor(store, sensor_type, variant=None):
    try:
        sensor = make_sensor(store, sensor_type, variant)
        notes = []
        if isinstance(sensor, list):
            notes.append(f"constructor returned {len(sensor)} sensors; runner uses the first one")
            sensor = sensor[0]
        size = [int(x) for x in np.asarray(sensor_get(sensor, "size"), dtype=int).reshape(-1)]
        pixel = [float(x) * 1.0e6 for x in np.asarray(sensor_get(sensor, "pixel size"), dtype=float).reshape(-1)]
        nbits = int(sensor_get(sensor, "nbits"))
        summary = f"{size[0]}x{size[1]}, {pixel[0]:.2f} um, {nbits}-bit"
        return summary, notes, True
    except Exception as exc:
        return f"Constructor check failed: {type(exc).__name__}: {exc}", [], False


def catalog_lens_summary(relative_path, path):
    parsed = parse_catalog_lens(relative_path, path)
    if not parsed["applies"]:
        return "Catalog lens file available, but no focal/FOV metadata was found.", False
    parts = []
    if parsed.get("focalLengthMm") is not None:
        parts.append(f"{parsed['focalLengthMm']:.2f} mm")
    if parsed.get("fNumber") is not None:
        parts.append(f"F/{parsed['fNumber']:.2f}")
    if parsed.get("fovDeg") is not None:
        parts.append(f"{parsed['fovDeg']:.1f} deg FOV")
    return "Catalog approximation applies " + ", ".join(parts), True


def parse_catalog_lens(relative_path, path):
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
                focal_value = float(focal)
                focal_mm = focal_value * 1000.0 if focal_value < 1.0 else focal_value
            fnum = metadata.get("fNumber")
            if fnum is not None:
                f_number = float(fnum)
            surfaces = payload.get("surfaces") if isinstance(payload.get("surfaces"), list) else []
            if f_number is None and focal_mm is not None and surfaces:
                apertures = [float(surface.get("semi_aperture", 0.0)) for surface in surfaces if isinstance(surface, dict)]
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
            match = re.search(r"Focal length.*?\\n\\s*([0-9.]+)", text, flags=re.IGNORECASE | re.DOTALL)
            if match:
                focal_mm = float(match.group(1))
        elif path.suffix.lower() == ".mat":
            description = "Focus lookup table; geometry is inferred from filename."
    except Exception:
        pass

    fov_match = re.search(r"([0-9]+(?:\\.[0-9]+)?)deg", name, flags=re.IGNORECASE)
    if fov_match:
        fov_deg = float(fov_match.group(1))
    focal_match = re.search(r"([0-9]+(?:\\.[0-9]+)?)mm", name, flags=re.IGNORECASE)
    if focal_mm is None and focal_match:
        focal_mm = float(focal_match.group(1))

    return {
        "relativePath": relative_path,
        "name": name,
        "description": description,
        "focalLengthMm": focal_mm,
        "fNumber": f_number,
        "fovDeg": fov_deg,
        "applies": focal_mm is not None or f_number is not None or fov_deg is not None,
    }


def sensor_file_summary(store, relative_path):
    try:
        data = store.load_mat(relative_path)
    except Exception as exc:
        return "sensorFile", False, f"MAT load check failed: {type(exc).__name__}: {exc}", ["Unsupported by live runner."]

    data_array = np.asarray(data.get("data", np.empty(0)), dtype=float)
    wavelengths = np.asarray(data.get("wavelength", np.empty(0)), dtype=float).reshape(-1)
    lower = relative_path.lower()
    if "sensor" in data:
        try:
            sensor = _sensor_from_upstream_model(relative_path, asset_store=store)
            size = [int(x) for x in np.asarray(sensor_get(sensor, "size"), dtype=int).reshape(-1)]
            pixel = [float(x) * 1.0e6 for x in np.asarray(sensor_get(sensor, "pixel size"), dtype=float).reshape(-1)]
            return "sensorModelFile", True, f"Sensor model {size[0]}x{size[1]}, {pixel[0]:.2f} um", []
        except Exception as exc:
            return "sensorModelFile", False, f"Sensor model load failed: {type(exc).__name__}: {exc}", ["Unsupported by live runner."]
    if wavelengths.size and data_array.size:
        channels = 1 if data_array.ndim == 1 else int(data_array.shape[1])
        if "/irfilters/" in lower:
            return "irFilter", True, f"IR filter spectral curve, {wavelengths.size} samples", []
        if "/photodetectors/" in lower or (channels == 1 and "qe" in lower):
            return "photoDetectorQe", True, f"Photodetector QE curve, {wavelengths.size} samples", []
        return "spectralFilter", True, f"Spectral filter bank, {channels} channels, {wavelengths.size} samples", []
    return "sensorFile", False, "No supported sensor/filter/QE payload found.", ["Unsupported by live runner."]


store = AssetStore.default()
snapshot = store.ensure()
warnings = []

raytrace_paths = sorted(
    p for p in (snapshot / "data" / "optics").glob("*.mat")
    if p.is_file() and any(token in p.name.lower() for token in ["zemax", "wide", "fisheye", "ray", "rt", "double"])
)
lens_reference_paths = sorted(
    p for p in (snapshot / "data" / "lens").glob("*")
    if p.is_file() and p.suffix.lower() in {".json", ".dat", ".mat"}
)[:120]

lens_assets = []
for path in raytrace_paths:
    relative_path = rel(path, snapshot)
    summary, testable = summarize_oi(store, relative_path)
    lens_assets.append({
        "id": option_id("optics", relative_path),
        "label": path.stem,
        "path": relative_path,
        "kind": "raytraceOptics",
        "testable": testable,
        "summary": summary,
        "notes": ["Applied with oi_create('ray trace', asset) before numeric overrides."],
    })
for path in lens_reference_paths:
    relative_path = rel(path, snapshot)
    summary, testable = catalog_lens_summary(relative_path, path)
    lens_assets.append({
        "id": option_id("catalog-lens", relative_path),
        "label": path.name,
        "path": relative_path,
        "kind": "catalogLens",
        "testable": testable,
        "summary": summary,
        "notes": ["Applied as a catalog approximation: focal length, F-number, FOV, and lens identity are used; surface PSF requires raytrace optics."],
    })

sensor_specs = [
    ("default", None, "Default Bayer GRBG"),
    ("bayer-rggb", None, "Bayer RGGB"),
    ("bayer-grbg", None, "Bayer GRBG"),
    ("bayer-gbrg", None, "Bayer GBRG"),
    ("bayer-bggr", None, "Bayer BGGR"),
    ("monochrome", None, "Monochrome"),
    ("rgbw", None, "RGBW interleaved"),
    ("rccc", None, "RCCC automotive"),
    ("grbc", None, "GRBC automotive"),
    ("ycmy", None, "YCMY"),
    ("mt9v024", "rgb", "MT9V024 RGB"),
    ("mt9v024", "rgbw", "MT9V024 RGBW"),
    ("mt9v024", "rccc", "MT9V024 RCCC"),
    ("mt9v024", "mono", "MT9V024 mono"),
    ("ar0132at", "rgb", "AR0132AT RGB"),
    ("ar0132at", "rgbw", "AR0132AT RGBW"),
    ("ar0132at", "rccc", "AR0132AT RCCC"),
    ("imx363", None, "Sony IMX363 / Pixel 4a"),
    ("imx490-small", None, "Sony IMX490 small"),
    ("imx490-large", None, "Sony IMX490 large"),
    ("nikond100", None, "Nikon D100"),
    ("ovt-small", None, "OVT small pixel"),
    ("ovt-large", None, "OVT large pair"),
    ("imec44", None, "IMEC 4x4 VIS"),
]

sensor_assets = []
for sensor_type, variant, label in sensor_specs:
    summary, notes, testable = summarize_sensor(store, sensor_type, variant)
    sensor_assets.append({
        "id": option_id("sensor", f"{sensor_type}:{variant or ''}"),
        "label": label,
        "type": sensor_type,
        "variant": variant or "",
        "kind": "sensorConstructor",
        "testable": testable,
        "summary": summary,
        "notes": notes,
    })

sensor_file_paths = sorted(
    p for p in (snapshot / "data" / "sensor").rglob("*")
    if p.is_file() and p.suffix.lower() == ".mat"
)[:120]
for path in sensor_file_paths:
    relative_path = rel(path, snapshot)
    kind, testable, summary, notes = sensor_file_summary(store, relative_path)
    sensor_assets.append({
        "id": option_id("sensor-file", relative_path),
        "label": path.name,
        "path": relative_path,
        "kind": kind,
        "testable": testable,
        "summary": summary,
        "notes": notes,
    })

print(json.dumps({
    "schemaVersion": 1,
    "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
    "sourceRoot": str(camera_e2e_root),
    "snapshotRoot": str(snapshot),
    "lensAssets": lens_assets,
    "sensorAssets": sensor_assets,
    "warnings": warnings,
}, indent=2))
"""

    command = [str(python_status["python"]), "-c", code, str(camera_e2e_root)]
    result = subprocess.run(command, capture_output=True, text=True, timeout=90, check=False)
    if result.returncode != 0:
        return {
            "schemaVersion": 1,
            "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "sourceRoot": str(camera_e2e_root),
            "lensAssets": [],
            "sensorAssets": [],
            "warnings": [result.stderr.strip() or result.stdout.strip() or "CameraE2E asset index failed."],
        }
    return json.loads(result.stdout)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--camera-e2e-root", type=Path, default=DEFAULT_CAMERA_E2E_ROOT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_DIR / "asset-index.json")
    parser.add_argument("--python", default="auto")
    args = parser.parse_args()

    camera_e2e_root = args.camera_e2e_root.expanduser().resolve()
    python_status = check_live_import(camera_e2e_root, args.python)
    index = run_inner_index(camera_e2e_root, python_status)

    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(index, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(output), "lensAssets": len(index["lensAssets"]), "sensorAssets": len(index["sensorAssets"])}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
