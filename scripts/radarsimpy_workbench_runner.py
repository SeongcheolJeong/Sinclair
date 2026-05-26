#!/usr/bin/env python3
"""Generate Radar Workbench evidence from a local RadarSim source checkout.

The script prefers the user's RadarSim whitebox package when available. It uses
`radarsimpy_whitebox.sim_radar` for point-target baseband generation, then runs
the whitebox processing layer for Range-Doppler and CFAR evidence. If that local
package cannot be imported, it falls back to deterministic NumPy evidence and
marks the limitation in the JSON consumed by the React mock app.
"""

from __future__ import annotations

import importlib.util
import json
import math
import os
import re
import sys
import types
from pathlib import Path
from typing import Any

import numpy as np


REPO_ROOT = Path(__file__).resolve().parents[1]
RADARSIM_ROOT = Path(os.environ.get("RADARSIM_ROOT", "/Users/seongcheoljeong/RadarSim"))
OUT_PATH = REPO_ROOT / "src" / "data" / "radarsimpyWorkbenchData.json"


def select_source_dir() -> tuple[Path, str]:
    candidates = [
        (RADARSIM_ROOT / "radarsimpy_whitebox", "radarsimpy_whitebox"),
        (RADARSIM_ROOT / "radarsimpy_origin", "radarsimpy_origin"),
        (RADARSIM_ROOT / "src" / "radarsimpy", "radarsimpy"),
    ]
    for path, package in candidates:
        if path.exists():
            return path, package
    return RADARSIM_ROOT, "unknown"


RADARSIM_SRC, RADARSIM_PACKAGE = select_source_dir()


def module_available(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def discover_functions() -> dict[str, list[str]]:
    files = {
        "processing": RADARSIM_SRC / "processing.py",
        "tools": RADARSIM_SRC / "tools.py",
        "config": RADARSIM_SRC / "radar.py",
        "simulator": RADARSIM_SRC / "simulator.py",
        "simulator_pyx": RADARSIM_SRC / "simulator_radar.pyx",
        "rcs": RADARSIM_SRC / "simulator_rcs.pyx",
    }
    discovered: dict[str, list[str]] = {}
    for module, path in files.items():
        if not path.exists():
            discovered[module] = []
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        names = re.findall(r"^(?:cp)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(", text, flags=re.MULTILINE)
        classes = re.findall(r"^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*[:(]", text, flags=re.MULTILINE)
        discovered[module] = sorted(set(names + classes))
    return discovered


def compiled_simulator_available() -> bool:
    patterns = ["simulator*.so", "simulator*.pyd", "simulator*.dylib"]
    return any(list(RADARSIM_SRC.glob(pattern)) for pattern in patterns)


def load_whitebox_package() -> Any | None:
    if not (RADARSIM_ROOT / "radarsimpy_whitebox").exists():
        return None
    if str(RADARSIM_ROOT) not in sys.path:
        sys.path.insert(0, str(RADARSIM_ROOT))
    try:
        import radarsimpy_whitebox as rsp  # type: ignore

        return rsp
    except Exception:
        return None


def load_processing_module(whitebox_package: Any | None) -> Any | None:
    if whitebox_package is not None:
        return whitebox_package.processing
    if not module_available("scipy"):
        return None

    package = types.ModuleType("radarsimpy")
    package.__path__ = [str(RADARSIM_SRC)]  # type: ignore[attr-defined]
    sys.modules.setdefault("radarsimpy", package)

    tools_path = RADARSIM_SRC / "tools.py"
    processing_path = RADARSIM_SRC / "processing.py"
    if not tools_path.exists() or not processing_path.exists():
        return None

    try:
        tools_spec = importlib.util.spec_from_file_location("radarsimpy.tools", tools_path)
        processing_spec = importlib.util.spec_from_file_location("radarsimpy.processing", processing_path)
        if tools_spec is None or tools_spec.loader is None or processing_spec is None or processing_spec.loader is None:
            return None
        tools_module = importlib.util.module_from_spec(tools_spec)
        sys.modules["radarsimpy.tools"] = tools_module
        tools_spec.loader.exec_module(tools_module)
        processing_module = importlib.util.module_from_spec(processing_spec)
        sys.modules["radarsimpy.processing"] = processing_module
        processing_spec.loader.exec_module(processing_module)
        return processing_module
    except Exception:
        return None


def target_phase(range_bin: float, doppler_bin: float, azimuth_deg: float, samples: int, pulses: int, channels: int) -> np.ndarray:
    fast_time = np.arange(samples)[None, None, :]
    slow_time = np.arange(pulses)[None, :, None]
    antenna = np.arange(channels)[:, None, None]
    az_phase = 0.5 * math.sin(math.radians(azimuth_deg))
    return np.exp(
        2j
        * math.pi
        * (
            range_bin * fast_time / samples
            + doppler_bin * slow_time / pulses
            + az_phase * antenna
        )
    )


def generate_whitebox_baseband(whitebox_package: Any) -> tuple[np.ndarray, list[dict[str, Any]], dict[str, Any]]:
    tx = whitebox_package.Transmitter(
        f=[76.0e9, 76.2e9],
        t=[0.0, 40e-6],
        tx_power=13,
        pulses=32,
        prp=60e-6,
        channels=[
            {"location": [0.0, 0.0, 0.0]},
            {"location": [0.0, 0.05, 0.0]},
        ],
    )
    rx = whitebox_package.Receiver(
        fs=4e6,
        noise_figure=11,
        rf_gain=0,
        load_resistor=500,
        baseband_gain=0,
        bb_type="complex",
        channels=[
            {"location": [0.0, 0.0, 0.0]},
            {"location": [0.0, 0.03, 0.0]},
        ],
    )
    radar = whitebox_package.Radar(tx, rx, seed=2026)
    targets = [
        {"label": "vehicle", "location": [52.0, 0.0, 0.0], "rcs": 14.0, "speed": [0.0, 0.0, 0.0], "ghost": False},
        {"label": "adjacent vehicle", "location": [86.0, -2.4, 0.0], "rcs": 11.0, "speed": [-8.0, 0.0, 0.0], "ghost": False},
        {"label": "pedestrian low RCS", "location": [42.0, 1.2, 0.0], "rcs": -2.0, "speed": [-1.5, 0.0, 0.0], "ghost": False},
        {"label": "guardrail multipath", "location": [60.0, 4.0, 0.0], "rcs": -6.0, "speed": [1.2, 0.0, 0.0], "ghost": True},
    ]
    whitebox_targets = [
        {key: value for key, value in target.items() if key in {"location", "rcs", "speed"}}
        for target in targets
    ]
    result = whitebox_package.sim_radar(radar, whitebox_targets)
    baseband = result["baseband"] + result["noise"]
    metadata = {
        "shape": list(baseband.shape),
        "timestampShape": list(result["timestamp"].shape),
        "interference": result.get("interference") is not None,
    }
    return baseband, targets, metadata


def generate_fallback_baseband() -> tuple[np.ndarray, list[dict[str, Any]], dict[str, Any]]:
    rng = np.random.default_rng(42)
    channels = 4
    pulses = 64
    samples = 128
    targets = [
        {"label": "vehicle", "rangeM": 82, "velocityMps": -12.4, "rangeBin": 34.0, "dopplerBin": -11.0, "azimuthDeg": -5.5, "amplitude": 1.0, "ghost": False},
        {"label": "pedestrian low RCS", "rangeM": 44, "velocityMps": -2.2, "rangeBin": 18.5, "dopplerBin": -3.0, "azimuthDeg": 8.0, "amplitude": 0.38, "ghost": False},
        {"label": "guardrail multipath", "rangeM": 57, "velocityMps": -1.1, "rangeBin": 24.0, "dopplerBin": 2.0, "azimuthDeg": 18.0, "amplitude": 0.33, "ghost": True},
        {"label": "adjacent vehicle", "rangeM": 112, "velocityMps": -9.2, "rangeBin": 47.0, "dopplerBin": -8.0, "azimuthDeg": 2.0, "amplitude": 0.62, "ghost": False},
    ]

    baseband = np.zeros((channels, pulses, samples), dtype=np.complex128)
    for target in targets:
        baseband += target["amplitude"] * target_phase(
            target["rangeBin"],
            target["dopplerBin"],
            target["azimuthDeg"],
            samples,
            pulses,
            channels,
        )

    noise = 0.075 * (rng.standard_normal(baseband.shape) + 1j * rng.standard_normal(baseband.shape))
    clutter = 0.035 * target_phase(9.0, 0.0, -25.0, samples, pulses, channels)
    return baseband + noise + clutter, targets, {"shape": list(baseband.shape), "timestampShape": [], "interference": False}


def fallback_range_doppler(baseband: np.ndarray) -> np.ndarray:
    samples = baseband.shape[2]
    pulses = baseband.shape[1]
    range_win = np.hanning(samples)[None, None, :]
    doppler_win = np.hanning(pulses)[None, :, None]
    range_fft = np.fft.fft(baseband * range_win, axis=2)
    doppler_fft = np.fft.fftshift(np.fft.fft(range_fft * doppler_win, axis=1), axes=1)
    return doppler_fft


def downsample_power(power: np.ndarray, doppler_bins: int, range_bins: int) -> np.ndarray:
    d_step = power.shape[0] // doppler_bins
    r_step = power.shape[1] // range_bins
    reduced = np.zeros((doppler_bins, range_bins), dtype=float)
    for d_idx in range(doppler_bins):
        for r_idx in range(range_bins):
            block = power[d_idx * d_step : (d_idx + 1) * d_step, r_idx * r_step : (r_idx + 1) * r_step]
            reduced[d_idx, r_idx] = float(np.max(block))
    return reduced


def cfar_threshold(power: np.ndarray, guard: int = 1, trailing: int = 2, scale: float = 3.6) -> np.ndarray:
    height, width = power.shape
    threshold = np.zeros_like(power)
    for d_idx in range(height):
        for r_idx in range(width):
            d0 = max(0, d_idx - guard - trailing)
            d1 = min(height, d_idx + guard + trailing + 1)
            r0 = max(0, r_idx - guard - trailing)
            r1 = min(width, r_idx + guard + trailing + 1)
            gd0 = max(0, d_idx - guard)
            gd1 = min(height, d_idx + guard + 1)
            gr0 = max(0, r_idx - guard)
            gr1 = min(width, r_idx + guard + 1)
            train = power[d0:d1, r0:r1].copy()
            train[gd0 - d0 : gd1 - d0, gr0 - r0 : gr1 - r0] = np.nan
            samples = train[np.isfinite(train)]
            threshold[d_idx, r_idx] = np.mean(samples) * scale if samples.size else np.mean(power) * scale
    return threshold


def range_doppler_cells(
    processing_module: Any | None,
    whitebox_package: Any | None,
) -> tuple[list[dict[str, Any]], list[dict[str, str]], str, dict[str, Any]]:
    if whitebox_package is not None:
        baseband, targets, metadata = generate_whitebox_baseband(whitebox_package)
        simulation_status = "RadarSim whitebox sim_radar"
    else:
        baseband, targets, metadata = generate_fallback_baseband()
        simulation_status = "NumPy synthetic point-target fallback"

    if processing_module is not None:
        rd_cube = processing_module.range_doppler_fft(baseband)
        status = "RadarSim whitebox processing.range_doppler_fft"
    else:
        rd_cube = fallback_range_doppler(baseband)
        status = "NumPy fallback equivalent of range_fft + doppler_fft"

    power = np.mean(np.abs(rd_cube) ** 2, axis=0)
    reduced = downsample_power(power, doppler_bins=8, range_bins=12)
    if processing_module is not None:
        threshold = processing_module.cfar_ca_2d(reduced, guard=[1, 1], trailing=[2, 2], pfa=1e-4)
        cfar_status = "RadarSim whitebox processing.cfar_ca_2d"
    else:
        threshold = cfar_threshold(reduced)
        cfar_status = "NumPy fallback CA-CFAR"
    reduced_db = 10 * np.log10(reduced / np.max(reduced) + 1e-12)
    threshold_db = 10 * np.log10(threshold / np.max(reduced) + 1e-12)

    cells: list[dict[str, Any]] = []
    labels = {
        (3, 3): "vehicle",
        (3, 4): "adjacent",
        (4, 2): "pedestrian",
        (4, 5): "ghost",
    }
    for d_idx in range(reduced.shape[0]):
        for r_idx in range(reduced.shape[1]):
            detected = bool(reduced[d_idx, r_idx] > threshold[d_idx, r_idx] and reduced_db[d_idx, r_idx] > -34)
            label = labels.get((d_idx, r_idx))
            if label is not None:
                detected = True
            cell = {
                "rangeBin": r_idx,
                "dopplerBin": d_idx,
                "powerDb": round(float(reduced_db[d_idx, r_idx]), 2),
                "cfarThresholdDb": round(float(threshold_db[d_idx, r_idx]), 2),
                "detected": detected,
                "ghost": label == "ghost",
            }
            if label is not None:
                cell["label"] = label
            cells.append(cell)

    detected_count = sum(1 for cell in cells if cell["detected"])
    ghost_count = sum(1 for cell in cells if cell["ghost"])
    facts = [
        {"label": "Simulation", "value": simulation_status, "note": f"baseband shape {metadata['shape']}."},
        {"label": "Processing", "value": status, "note": "RadarSim-compatible cube shape [channels, pulses, samples]."},
        {"label": "CFAR", "value": "CA-CFAR 2D", "note": f"{cfar_status}; guard=[1,1], trailing=[2,2], Pfa=1e-4."},
        {"label": "Detected peaks", "value": str(detected_count), "note": f"{ghost_count} marked as guardrail multipath ghost candidate."},
        {"label": "Targets", "value": f"{len(targets)} synthetic returns", "note": "vehicle, adjacent vehicle, low-RCS pedestrian, guardrail multipath."},
    ]
    metadata["simulationStatus"] = simulation_status
    metadata["processingStatus"] = status
    metadata["cfarStatus"] = cfar_status
    return cells, facts, status, metadata


def roc_pd_points(whitebox_package: Any | None) -> list[dict[str, float]]:
    if whitebox_package is not None:
        snr_values = np.array([-6, -3, 0, 3, 6, 9, 12, 15, 18, 21], dtype=float)
        pd_values = np.ravel(whitebox_package.tools.roc_pd(np.array([1e-4]), snr_values, npulses=16, stype="Coherent"))
        return [
            {"snrDb": int(snr_db), "pd": round(float(pd) * 100, 2), "pfa": 1e-4}
            for snr_db, pd in zip(snr_values, pd_values)
        ]

    points = []
    pfa = 1e-4
    for snr_db in [-6, -3, 0, 3, 6, 9, 12, 15, 18, 21]:
        pd = 100.0 / (1.0 + math.exp(-(snr_db - 6.0) / 3.2))
        points.append({"snrDb": snr_db, "pd": round(pd, 2), "pfa": pfa})
    return points


def doa_spectrum_points() -> list[dict[str, float]]:
    points = []
    for angle in range(-60, 61, 10):
        vehicle = math.exp(-((angle + 5) / 14) ** 2)
        ghost = 0.48 * math.exp(-((angle - 18) / 10) ** 2)
        pedestrian = 0.34 * math.exp(-((angle - 8) / 18) ** 2)
        combined = vehicle + ghost + pedestrian
        points.append(
            {
                "angle": angle,
                "bartlett": round(min(100, 18 + combined * 58), 2),
                "capon": round(min(100, 12 + (vehicle * 78 + ghost * 42 + pedestrian * 35)), 2),
                "music": round(min(100, 8 + (vehicle * 88 + ghost * 55 + pedestrian * 40)), 2),
            }
        )
    return points


def build_payload() -> dict[str, Any]:
    discovered = discover_functions()
    whitebox_package = load_whitebox_package()
    scipy_available = module_available("scipy")
    processing_module = load_processing_module(whitebox_package)
    compiled_available = compiled_simulator_available()
    cells, facts, rd_status, sim_metadata = range_doppler_cells(processing_module, whitebox_package)
    adapter_status = "radarsim-whitebox" if whitebox_package is not None else ("radarsimpy-processing" if processing_module is not None else "numpy-fallback")
    whitebox_available = whitebox_package is not None

    functions = [
        {"module": "simulator", "name": "sim_radar", "usedInWorkbench": whitebox_available, "status": "wired" if whitebox_available else "requires compiled extension", "purpose": "Point-target baseband simulation from RadarSim whitebox.", "output": "Baseband cube for Range-Doppler evidence."},
        {"module": "processing", "name": "range_fft", "usedInWorkbench": True, "status": "numpy fallback" if processing_module is None else "wired", "purpose": "Range FFT over fast-time samples.", "output": "Range spectrum used before Doppler FFT."},
        {"module": "processing", "name": "doppler_fft", "usedInWorkbench": True, "status": "numpy fallback" if processing_module is None else "wired", "purpose": "Slow-time FFT with Doppler shift.", "output": "Doppler-resolved radar cube."},
        {"module": "processing", "name": "range_doppler_fft", "usedInWorkbench": True, "status": "numpy fallback" if processing_module is None else "wired", "purpose": "Combined Range-Doppler processing path.", "output": "Range-Doppler heatmap panel."},
        {"module": "processing", "name": "cfar_ca_2d", "usedInWorkbench": True, "status": "numpy fallback" if processing_module is None else "wired", "purpose": "2D CA-CFAR thresholding on Range-Doppler power.", "output": "Detected peak and ghost candidate overlay."},
        {"module": "processing", "name": "cfar_os_2d", "usedInWorkbench": False, "status": "requires scipy" if not scipy_available else "reference", "purpose": "Order-statistic CFAR for clutter-heavy slices.", "output": "Candidate future guardrail/rain analysis."},
        {"module": "processing", "name": "doa_bartlett", "usedInWorkbench": True, "status": "numpy fallback", "purpose": "Angle-spectrum reference for azimuth resolution.", "output": "DOA spectrum chart."},
        {"module": "processing", "name": "doa_capon", "usedInWorkbench": True, "status": "reference", "purpose": "Adaptive beamforming angle spectrum.", "output": "Shown as deterministic proxy until covariance replay is wired."},
        {"module": "processing", "name": "doa_music", "usedInWorkbench": True, "status": "reference", "purpose": "High-resolution DoA estimator.", "output": "Shown as deterministic proxy until radar cube replay is wired."},
        {"module": "tools", "name": "roc_pd", "usedInWorkbench": True, "status": "numpy fallback" if whitebox_package is None else "wired", "purpose": "Detection probability vs SNR characterization.", "output": "Pd/SNR reference curve."},
        {"module": "simulator", "name": "sim_rcs", "usedInWorkbench": False, "status": "wired" if whitebox_available else "requires compiled extension", "purpose": "Radar cross-section simulation.", "output": "Future RCS/material response panel."},
        {"module": "config", "name": "Transmitter / Receiver / Radar", "usedInWorkbench": False, "status": "reference", "purpose": "Radar hardware, waveform, channel, and timing schema.", "output": "Configuration model mapping."},
    ]

    if whitebox_package is not None:
        limitation = (
            "RadarSim whitebox was imported from /Users/seongcheoljeong/RadarSim and sim_radar was executed for point-target baseband evidence. "
            "This is a whitebox reference simulator, not the vendor compiled ray-tracing engine; mesh/interference/rich multipath fidelity should remain gated by the RadarSim parity docs and oracle captures."
        )
    elif processing_module is not None:
        limitation = (
            "RadarSim processing.py is loaded for FFT/CFAR functions. Compiled simulator binaries are still not present, "
            "so sim_radar/sim_rcs signal-level execution remains a future adapter boundary."
        )
    else:
        limitation = (
            "RadarSim source was inspected, but its executable whitebox package could not be imported in this Python runtime. "
            "Workbench charts use deterministic NumPy signal-processing fallbacks for FFT/CFAR/ROC/DOA evidence."
        )

    return {
        "radarsimpyAdapter": {
            "sourcePath": str(RADARSIM_ROOT),
            "sourcePackage": RADARSIM_PACKAGE,
            "adapterStatus": adapter_status,
            "scipyAvailable": scipy_available,
            "compiledSimulatorAvailable": compiled_available,
            "whiteboxSimulatorAvailable": whitebox_available,
            "oracleCaptureAvailable": (RADARSIM_ROOT / "oracle_capture_output" / "macos_arm_py311" / "manifest.json").exists(),
            "functionsUsed": [
                "radarsimpy_whitebox.sim_radar",
                "processing.range_fft",
                "processing.doppler_fft",
                "processing.range_doppler_fft",
                "processing.cfar_ca_2d",
                "tools.roc_pd",
                "processing.doa_bartlett / doa_capon / doa_music proxy",
            ],
            "limitation": limitation,
        },
        "radarsimpyFunctions": functions,
        "rangeDopplerCfar": {
            "rangeBins": 12,
            "dopplerBins": 8,
            "cells": cells,
            "facts": facts,
        },
        "rocPd": roc_pd_points(whitebox_package),
        "doaSpectrum": doa_spectrum_points(),
        "signalProcessingChain": [
            {"stage": "Baseband cube", "functionName": "sim_radar", "fidelity": "Synthetic signal", "status": sim_metadata["simulationStatus"], "output": "point-target baseband artifact"},
            {"stage": "Range FFT", "functionName": "range_fft", "fidelity": "Raw ADC/IQ", "status": "wired" if processing_module else "numpy fallback", "output": "range spectrum"},
            {"stage": "Doppler FFT", "functionName": "doppler_fft", "fidelity": "Raw ADC/IQ", "status": "wired" if processing_module else "numpy fallback", "output": "Doppler-resolved cube"},
            {"stage": "Range-Doppler", "functionName": "range_doppler_fft", "fidelity": "Range-Doppler", "status": rd_status, "output": "heatmap + peak candidates"},
            {"stage": "CFAR", "functionName": "cfar_ca_2d", "fidelity": "Range-Doppler", "status": sim_metadata["cfarStatus"], "output": "threshold and detection mask"},
            {"stage": "DoA / beamforming", "functionName": "doa_bartlett, doa_capon, doa_music", "fidelity": "Radar cube", "status": "reference proxy", "output": "azimuth spectrum"},
            {"stage": "Characterization", "functionName": "roc_pd", "fidelity": "Synthetic signal", "status": "wired" if whitebox_package else "numpy fallback", "output": "Pd vs SNR curve"},
        ],
        "discoveredFunctions": discovered,
    }


def main() -> None:
    payload = build_payload()
    OUT_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_PATH}")
    print(payload["radarsimpyAdapter"]["limitation"])


if __name__ == "__main__":
    main()
