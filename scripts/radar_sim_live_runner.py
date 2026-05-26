#!/usr/bin/env python3
"""Run a configurable RadarSim whitebox live simulation from a JSON request."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import sys
import time
from pathlib import Path
from typing import Any

import numpy as np


DEFAULT_RADARSIM_ROOT = Path(os.environ.get("RADARSIM_ROOT", "/Users/seongcheoljeong/RadarSim"))
DEFAULT_RCS_ASSET_ROOT = Path(__file__).resolve().parents[1] / "public" / "assets" / "radar-rcs-library"
SPEED_OF_LIGHT_MPS = 299_792_458.0


def read_request(path_or_dash: str) -> dict[str, Any]:
    if path_or_dash == "-":
        return json.loads(sys.stdin.read())
    return json.loads(Path(path_or_dash).read_text(encoding="utf-8"))


def safe_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except Exception:
        return float(default)


def safe_int(value: Any, default: int) -> int:
    try:
        return int(round(float(value)))
    except Exception:
        return int(default)


def normalize_mimo_mode(value: Any) -> str:
    mode = str(value or "tdm").strip().lower()
    if mode in {"bpm", "tpm", "tpmbpm", "tpm-bpm", "phase", "phase-coded", "phasecoded"}:
        return "tpmBpm"
    return "tdm"


def load_radarsim(radarsim_root: Path):
    sys.path.insert(0, str(radarsim_root))
    import radarsimpy_whitebox as rsp  # type: ignore

    return rsp


def preset_targets(preset: str) -> list[dict[str, Any]]:
    presets: dict[str, list[dict[str, Any]]] = {
        "highwayCutIn": [
            {"label": "lead vehicle", "rangeM": 84.0, "azimuthM": 0.0, "rcsDbsm": 14.0, "radialVelocityMps": -11.5},
            {"label": "cut-in vehicle", "rangeM": 62.0, "azimuthM": -2.4, "rcsDbsm": 11.0, "radialVelocityMps": -8.2},
            {"label": "guardrail weak return", "rangeM": 58.0, "azimuthM": 4.2, "rcsDbsm": -7.0, "radialVelocityMps": 0.8, "ghost": True},
        ],
        "rainGuardrailGhost": [
            {"label": "vehicle", "rangeM": 52.0, "azimuthM": 0.3, "rcsDbsm": 12.0, "radialVelocityMps": -5.5},
            {"label": "guardrail multipath", "rangeM": 34.0, "azimuthM": 4.4, "rcsDbsm": -4.5, "radialVelocityMps": -1.2, "ghost": True},
            {"label": "rain clutter", "rangeM": 27.0, "azimuthM": -3.2, "rcsDbsm": -10.0, "radialVelocityMps": 0.7, "ghost": True},
        ],
        "lowRcsPedestrian": [
            {"label": "pedestrian low RCS", "rangeM": 42.0, "azimuthM": 1.2, "rcsDbsm": -3.0, "radialVelocityMps": -1.4},
            {"label": "vehicle context", "rangeM": 75.0, "azimuthM": -1.6, "rcsDbsm": 13.0, "radialVelocityMps": -6.0},
        ],
        "twoTargetSeparation": [
            {"label": "adjacent vehicle A", "rangeM": 78.0, "azimuthM": -1.1, "rcsDbsm": 12.5, "radialVelocityMps": -9.0},
            {"label": "adjacent vehicle B", "rangeM": 81.0, "azimuthM": 1.1, "rcsDbsm": 12.0, "radialVelocityMps": -8.6},
        ],
        "offAxisMimo": [
            {"label": "off-axis vehicle", "rangeM": 55.0, "azimuthM": 3.0, "rcsDbsm": 12.0, "radialVelocityMps": -7.5},
            {"label": "off-axis ghost", "rangeM": 62.0, "azimuthM": -4.6, "rcsDbsm": -6.0, "radialVelocityMps": 1.1, "ghost": True},
        ],
    }
    return presets.get(preset, presets["highwayCutIn"])


def normalize_request(raw: dict[str, Any]) -> dict[str, Any]:
    preset = str(raw.get("preset", "highwayCutIn"))
    waveform = raw.get("waveform", {})
    receiver = raw.get("receiver", {})
    array = raw.get("array", {})
    mimo = raw.get("mimo", {})
    cfar = raw.get("cfar", {})
    targets = raw.get("targets") or preset_targets(preset)
    rcs_source = raw.get("rcsSource", {})
    rcs_source_mode = str(rcs_source.get("mode", "scenarioAssumption"))
    if rcs_source_mode not in {"scenarioAssumption", "radarsimMeshNormalized"}:
        rcs_source_mode = "scenarioAssumption"
    return {
        "runId": raw.get("runId") or f"radar-live-{int(time.time() * 1000)}",
        "preset": preset,
        "rcsSource": {
            "mode": rcs_source_mode,
        },
        "mimo": {
            "mode": normalize_mimo_mode(mimo.get("mode") if isinstance(mimo, dict) else raw.get("mimoMode")),
        },
        "waveform": {
            "startFrequencyGhz": safe_float(waveform.get("startFrequencyGhz"), 76.0),
            "stopFrequencyGhz": safe_float(waveform.get("stopFrequencyGhz"), 76.2),
            "chirpDurationUs": safe_float(waveform.get("chirpDurationUs"), 40.0),
            "pulses": max(4, min(96, safe_int(waveform.get("pulses"), 32))),
            "prpUs": safe_float(waveform.get("prpUs"), 60.0),
            "txPowerDbm": safe_float(waveform.get("txPowerDbm"), 20.0),
        },
        "receiver": {
            "samplingRateMsps": safe_float(receiver.get("samplingRateMsps"), 8.0),
            "noiseFigureDb": safe_float(receiver.get("noiseFigureDb"), 6.0),
        },
        "array": {
            "txChannels": max(1, min(4, safe_int(array.get("txChannels"), 2))),
            "rxChannels": max(1, min(4, safe_int(array.get("rxChannels"), 2))),
            "txSpacingM": safe_float(array.get("txSpacingM"), 0.0039),
            "rxSpacingM": safe_float(array.get("rxSpacingM"), 0.00195),
        },
        "cfar": {
            "pfa": safe_float(cfar.get("pfa"), 1e-2),
            "guard": max(1, min(4, safe_int(cfar.get("guard"), 1))),
            "trailing": max(1, min(6, safe_int(cfar.get("trailing"), 2))),
        },
        "targets": targets,
    }


def make_channels(count: int, spacing_m: float) -> list[dict[str, list[float]]]:
    center = (count - 1) / 2
    return [{"location": [0.0, (idx - center) * spacing_m, 0.0]} for idx in range(count)]


def next_power_of_two(value: int) -> int:
    output = 1
    while output < max(1, value):
        output *= 2
    return output


def hadamard_matrix(order: int) -> np.ndarray:
    matrix = np.array([[1.0]], dtype=float)
    while matrix.shape[0] < order:
        matrix = np.block([[matrix, matrix], [matrix, -matrix]])
    return matrix


def bpm_code_matrix_for_tx(tx_channels: int) -> list[list[float]]:
    order = next_power_of_two(tx_channels)
    return hadamard_matrix(order)[:, :tx_channels].tolist()


def modulation_code(rsp, tx_channels: int, pulses: int, mode: str) -> dict[str, np.ndarray]:
    if normalize_mimo_mode(mode) == "tpmBpm":
        code_matrix = None if tx_channels > 0 and (tx_channels & (tx_channels - 1)) == 0 else bpm_code_matrix_for_tx(tx_channels)
        return rsp.bpm_code(tx_channels=tx_channels, pulses=pulses, code_matrix=code_matrix)
    return rsp.tdm_code(tx_channels=tx_channels, pulses=pulses)


def make_tx_channels(rsp, request: dict[str, Any], mode: str | None = None) -> list[dict[str, Any]]:
    array = request["array"]
    waveform = request["waveform"]
    selected_mode = normalize_mimo_mode(mode or request.get("mimo", {}).get("mode"))
    channels = make_channels(array["txChannels"], array["txSpacingM"])
    if selected_mode == "tpmBpm":
        return rsp.bpm_channels(
            channels,
            pulses=waveform["pulses"],
            code_matrix=None
            if array["txChannels"] > 0 and (array["txChannels"] & (array["txChannels"] - 1)) == 0
            else bpm_code_matrix_for_tx(array["txChannels"]),
        )
    return rsp.tdm_channels(channels, pulses=waveform["pulses"])


def modulation_summary(rsp, request: dict[str, Any], mode: str) -> dict[str, Any]:
    selected_mode = normalize_mimo_mode(mode)
    code = modulation_code(rsp, request["array"]["txChannels"], request["waveform"]["pulses"], selected_mode)
    pulse_amp = np.asarray(code["pulse_amp"], dtype=float)
    pulse_phs = np.asarray(code["pulse_phs"], dtype=float)
    active_counts = np.sum(pulse_amp > 0.0, axis=0)
    active_tx_per_pulse = float(np.mean(active_counts)) if active_counts.size else 0.0
    tx_duty_percent = float(np.mean(pulse_amp > 0.0) * 100.0) if pulse_amp.size else 0.0
    phase_values = sorted({int(round(float(value))) for value in np.ravel(pulse_phs)})
    return {
        "mode": selected_mode,
        "label": "TPM/BPM phase-coded" if selected_mode == "tpmBpm" else "TDM",
        "implementation": "radarsimpy_whitebox.bpm_code / bpm_channels"
        if selected_mode == "tpmBpm"
        else "radarsimpy_whitebox.tdm_code / tdm_channels",
        "txDutyPercent": round(tx_duty_percent, 1),
        "activeTxPerPulse": round(active_tx_per_pulse, 2),
        "phaseLevels": "/".join(f"{value}deg" for value in phase_values) or "-",
    }


def modulation_pulse_preview(rsp, request: dict[str, Any]) -> list[dict[str, Any]]:
    pulses = min(request["waveform"]["pulses"], 8)
    tx_channels = request["array"]["txChannels"]
    tdm = modulation_code(rsp, tx_channels, request["waveform"]["pulses"], "tdm")
    bpm = modulation_code(rsp, tx_channels, request["waveform"]["pulses"], "tpmBpm")
    rows = []
    for pulse_idx in range(pulses):
        tdm_active = [idx + 1 for idx in range(tx_channels) if float(tdm["pulse_amp"][idx, pulse_idx]) > 0.0]
        bpm_active = [idx + 1 for idx in range(tx_channels) if float(bpm["pulse_amp"][idx, pulse_idx]) > 0.0]
        bpm_phases = [
            f"TX{idx + 1}:{int(round(float(bpm['pulse_phs'][idx, pulse_idx])))}"
            for idx in range(tx_channels)
            if float(bpm["pulse_amp"][idx, pulse_idx]) > 0.0
        ]
        rows.append(
            {
                "pulse": pulse_idx + 1,
                "tdmActiveTx": ",".join(f"TX{idx}" for idx in tdm_active) or "-",
                "tpmBpmActiveTx": ",".join(f"TX{idx}" for idx in bpm_active) or "-",
                "tpmBpmPhasesDeg": " / ".join(bpm_phases) or "-",
            }
        )
    return rows


def target_to_whitebox(target: dict[str, Any]) -> dict[str, Any]:
    return {
        "location": [
            safe_float(target.get("rangeM"), 50.0),
            safe_float(target.get("azimuthM"), 0.0),
            0.0,
        ],
        "rcs": safe_float(target.get("rcsDbsm"), 10.0),
        "speed": [safe_float(target.get("radialVelocityMps"), 0.0), 0.0, 0.0],
    }


def semantic_class_for_target(target: dict[str, Any]) -> str:
    semantic = str(target.get("semanticClass") or "").strip()
    if semantic:
        return semantic
    label = str(target.get("label", "")).lower()
    if "pedestrian" in label:
        return "pedestrian"
    if "cyclist" in label:
        return "cyclist"
    if "guardrail" in label:
        return "guardrail"
    if "rain" in label or "clutter" in label:
        return "clutter"
    if target.get("ghost"):
        return "ghost"
    return "vehicle"


def load_rcs_asset_manifest(asset_root: Path = DEFAULT_RCS_ASSET_ROOT) -> dict[str, Any] | None:
    manifest_path = asset_root / "manifest.json"
    if not manifest_path.exists():
        return None
    return json.loads(manifest_path.read_text(encoding="utf-8"))


def rcs_target_from_metadata(asset_root: Path, metadata: dict[str, Any]) -> dict[str, Any]:
    target = {"model": str(asset_root / metadata["mesh"])}
    permittivity = metadata.get("permittivity")
    if isinstance(permittivity, dict):
        target["permittivity"] = complex(
            safe_float(permittivity.get("real"), 1.0),
            safe_float(permittivity.get("imag"), 0.0),
        )
    return target


def resolve_rcs_source(rsp, request: dict[str, Any]) -> tuple[dict[str, float], dict[str, Any]]:
    scenario_class_rcs = {
        "vehicle": 12.0,
        "pedestrian": -3.0,
        "cyclist": 2.0,
        "motorcycle": 6.0,
        "guardrail": -5.0,
    }
    mode = request.get("rcsSource", {}).get("mode", "scenarioAssumption")
    if mode != "radarsimMeshNormalized":
        return scenario_class_rcs, {
            "mode": "scenarioAssumption",
            "label": "Scenario assumption RCS",
            "boundary": "Pd and live point targets use preset nominal class RCS assumptions. No mesh RCS asset is applied.",
            "assets": [],
        }

    manifest = load_rcs_asset_manifest()
    if not manifest:
        return scenario_class_rcs, {
            "mode": "scenarioAssumption",
            "label": "Scenario assumption RCS",
            "boundary": "RadarSim mesh RCS mode requested, but the asset manifest was not found. Falling back to preset RCS assumptions.",
            "assets": [],
        }

    class_rcs = dict(scenario_class_rcs)
    assets_summary: list[dict[str, Any]] = []
    for asset in manifest.get("assets", []):
        asset_class = str(asset.get("class", ""))
        metadata_path = DEFAULT_RCS_ASSET_ROOT / str(asset.get("metadata", ""))
        if not metadata_path.exists():
            continue
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        nominal = safe_float(metadata.get("nominalRcsDbsm"), scenario_class_rcs.get(asset_class, 0.0))
        raw_dbsm = None
        try:
            raw = rsp.sim_rcs(
                [rcs_target_from_metadata(DEFAULT_RCS_ASSET_ROOT, metadata)],
                f=safe_float(metadata.get("radarsim", {}).get("recommendedFrequencyHz"), 77e9),
                inc_phi=0.0,
                inc_theta=90.0,
            )
            raw_dbsm = 10.0 * math.log10(max(float(raw), 1e-12))
        except Exception:
            raw_dbsm = None
        if asset_class in class_rcs:
            class_rcs[asset_class] = nominal
        asset_summary = {
            "id": metadata.get("id", asset.get("id")),
            "class": asset_class,
            "nominalRcsDbsm": round(nominal, 2),
            "calibratedBroadsideDbsm": round(nominal, 2),
            "mesh": metadata.get("mesh", asset.get("mesh")),
        }
        if raw_dbsm is not None:
            asset_summary["rawBroadsideDbsm"] = round(raw_dbsm, 2)
        assets_summary.append(asset_summary)

    return class_rcs, {
        "mode": "radarsimMeshNormalized",
        "label": "RadarSim mesh RCS normalized",
        "boundary": "OBJ assets are loaded with RadarSim sim_rcs. Raw broadside dBsm is used only as a mesh response check; Pd uses each asset's nominal calibrated dBsm until measured RCS or validated CAD/material data is connected.",
        "assets": assets_summary,
    }


def apply_effective_target_rcs(request: dict[str, Any], class_rcs: dict[str, float]) -> dict[str, Any]:
    if request.get("rcsSource", {}).get("mode") != "radarsimMeshNormalized":
        return request

    adjusted_targets = []
    for target in request["targets"]:
        adjusted = dict(target)
        target_class = semantic_class_for_target(adjusted)
        if target_class in class_rcs and target_class not in {"ghost", "clutter"}:
            adjusted["sourceRcsDbsm"] = safe_float(adjusted.get("rcsDbsm"), class_rcs[target_class])
            adjusted["rcsDbsm"] = class_rcs[target_class]
            adjusted["rcsSource"] = "radarsimMeshNormalized"
        else:
            adjusted["rcsSource"] = "scenarioAssumptionFallback"
        adjusted_targets.append(adjusted)
    return {**request, "targets": adjusted_targets}


def downsample_power(power: np.ndarray, doppler_bins: int, range_bins: int) -> np.ndarray:
    d_step = max(1, power.shape[0] // doppler_bins)
    r_step = max(1, power.shape[1] // range_bins)
    reduced = np.zeros((doppler_bins, range_bins), dtype=float)
    for d_idx in range(doppler_bins):
        for r_idx in range(range_bins):
            block = power[
                d_idx * d_step : min(power.shape[0], (d_idx + 1) * d_step),
                r_idx * r_step : min(power.shape[1], (r_idx + 1) * r_step),
            ]
            reduced[d_idx, r_idx] = float(np.max(block)) if block.size else 0.0
    return reduced


def downsample_any(mask: np.ndarray, doppler_bins: int, range_bins: int) -> np.ndarray:
    d_step = max(1, mask.shape[0] // doppler_bins)
    r_step = max(1, mask.shape[1] // range_bins)
    reduced = np.zeros((doppler_bins, range_bins), dtype=bool)
    for d_idx in range(doppler_bins):
        for r_idx in range(range_bins):
            block = mask[
                d_idx * d_step : min(mask.shape[0], (d_idx + 1) * d_step),
                r_idx * r_step : min(mask.shape[1], (r_idx + 1) * r_step),
            ]
            reduced[d_idx, r_idx] = bool(np.any(block)) if block.size else False
    return reduced


def downsample_axis(axis: np.ndarray, bins: int) -> np.ndarray:
    step = max(1, len(axis) // bins)
    reduced = []
    for idx in range(bins):
        block = axis[idx * step : min(len(axis), (idx + 1) * step)]
        reduced.append(float(np.mean(block)) if block.size else float(axis[min(idx, len(axis) - 1)]))
    return np.array(reduced, dtype=float)


def build_range_axis(request: dict[str, Any], range_bins: int, sample_count: int) -> np.ndarray:
    bandwidth_hz = max(
        (request["waveform"]["stopFrequencyGhz"] - request["waveform"]["startFrequencyGhz"]) * 1e9,
        1.0,
    )
    range_resolution_m = SPEED_OF_LIGHT_MPS / (2.0 * bandwidth_hz)
    full_axis = np.arange(sample_count, dtype=float) * range_resolution_m
    return downsample_axis(full_axis, range_bins)


def build_full_range_axis(request: dict[str, Any], sample_count: int) -> np.ndarray:
    bandwidth_hz = max(
        (request["waveform"]["stopFrequencyGhz"] - request["waveform"]["startFrequencyGhz"]) * 1e9,
        1.0,
    )
    range_resolution_m = SPEED_OF_LIGHT_MPS / (2.0 * bandwidth_hz)
    return np.arange(sample_count, dtype=float) * range_resolution_m


def build_full_doppler_axis(request: dict[str, Any], pulse_count: int) -> np.ndarray:
    center_frequency_hz = (
        request["waveform"]["startFrequencyGhz"] + request["waveform"]["stopFrequencyGhz"]
    ) * 0.5e9
    wavelength_m = SPEED_OF_LIGHT_MPS / max(center_frequency_hz, 1.0)
    prp_s = max(request["waveform"]["prpUs"] * 1e-6, 1e-9)
    full_axis = np.fft.fftfreq(pulse_count, d=prp_s) * wavelength_m / 2.0
    return np.flip(np.fft.fftshift(full_axis))


def build_doppler_axis(request: dict[str, Any], doppler_bins: int, pulse_count: int) -> np.ndarray:
    return downsample_axis(build_full_doppler_axis(request, pulse_count), doppler_bins)


def full_to_reduced_bin(full_index: int, full_count: int, reduced_count: int) -> int:
    step = max(1, full_count // reduced_count)
    return max(0, min(reduced_count - 1, full_index // step))


def nearest_axis_index(axis: np.ndarray, value: float) -> int:
    return int(np.argmin(np.abs(axis - value))) if axis.size else 0


def build_range_doppler(rsp, request: dict[str, Any], baseband: np.ndarray) -> dict[str, Any]:
    rd_cube = rsp.processing.range_doppler_fft(baseband)
    power = np.mean(np.abs(rd_cube) ** 2, axis=0)
    full_threshold = rsp.processing.cfar_ca_2d(
        power,
        guard=[request["cfar"]["guard"], request["cfar"]["guard"]],
        trailing=[request["cfar"]["trailing"], request["cfar"]["trailing"]],
        pfa=request["cfar"]["pfa"],
    )
    full_detection = power > full_threshold
    display_power = np.flip(np.fft.fftshift(power, axes=0), axis=0)
    display_threshold = np.flip(np.fft.fftshift(full_threshold, axes=0), axis=0)
    display_detection = np.flip(np.fft.fftshift(full_detection, axes=0), axis=0)
    reduced = downsample_power(display_power, doppler_bins=8, range_bins=12)
    threshold = downsample_power(display_threshold, doppler_bins=8, range_bins=12)
    detection = downsample_any(display_detection, doppler_bins=8, range_bins=12)
    full_range_axis = build_full_range_axis(request, sample_count=power.shape[1])
    full_doppler_axis = build_full_doppler_axis(request, pulse_count=power.shape[0])
    range_axis = build_range_axis(request, range_bins=12, sample_count=power.shape[1])
    doppler_axis = build_doppler_axis(request, doppler_bins=8, pulse_count=power.shape[0])
    reduced_db = 10 * np.log10(reduced / np.max(reduced) + 1e-12)
    threshold_db = 10 * np.log10(np.maximum(threshold, 1e-18) / np.max(reduced) + 1e-12)
    noise_floor_db = float(np.percentile(reduced_db, 35))
    full_power_db = 10 * np.log10(display_power / np.max(display_power) + 1e-12)
    full_threshold_db = 10 * np.log10(np.maximum(display_threshold, 1e-18) / np.max(display_power) + 1e-12)
    cells = []
    cfar_peak_ids: set[str] = set()
    for d_idx in range(reduced.shape[0]):
        for r_idx in range(reduced.shape[1]):
            detected = bool(detection[d_idx, r_idx] and reduced_db[d_idx, r_idx] > -45)
            if detected:
                cfar_peak_ids.add(f"rd-{d_idx}-{r_idx}")
            cells.append(
                {
                    "rangeBin": r_idx,
                    "dopplerBin": d_idx,
                    "rangeM": round(float(range_axis[r_idx]), 2),
                    "radialVelocityMps": round(float(doppler_axis[d_idx]), 2),
                    "powerDb": round(float(reduced_db[d_idx, r_idx]), 2),
                    "cfarThresholdDb": round(float(threshold_db[d_idx, r_idx]), 2),
                    "detected": detected,
                    "ghost": False,
                }
            )

    associations = []
    associated_cfar_ids: set[str] = set()
    for target in request["targets"]:
        target_range = safe_float(target.get("rangeM"), 0.0)
        target_velocity = safe_float(target.get("radialVelocityMps"), 0.0)
        expected_full_range_bin = nearest_axis_index(full_range_axis, target_range)
        expected_full_doppler_bin = nearest_axis_index(full_doppler_axis, target_velocity)
        expected_range_bin = full_to_reduced_bin(expected_full_range_bin, len(full_range_axis), 12)
        expected_doppler_bin = full_to_reduced_bin(expected_full_doppler_bin, len(full_doppler_axis), 8)

        d0 = max(0, expected_full_doppler_bin - 2)
        d1 = min(display_detection.shape[0], expected_full_doppler_bin + 3)
        r0 = max(0, expected_full_range_bin - 3)
        r1 = min(display_detection.shape[1], expected_full_range_bin + 4)
        detection_window = display_detection[d0:d1, r0:r1]
        matched_peak = None
        if detection_window.size and bool(np.any(detection_window)):
            local_candidates = np.argwhere(detection_window)
            best_local = max(
                local_candidates,
                key=lambda item: float(display_power[d0 + int(item[0]), r0 + int(item[1])]),
            )
            matched_full_doppler_bin = d0 + int(best_local[0])
            matched_full_range_bin = r0 + int(best_local[1])
            matched_range_bin = full_to_reduced_bin(matched_full_range_bin, len(full_range_axis), 12)
            matched_doppler_bin = full_to_reduced_bin(matched_full_doppler_bin, len(full_doppler_axis), 8)
            matched_peak = {
                "id": f"rd-{matched_doppler_bin}-{matched_range_bin}",
                "rangeBin": matched_range_bin,
                "dopplerBin": matched_doppler_bin,
                "rangeM": round(float(full_range_axis[matched_full_range_bin]), 2),
                "radialVelocityMps": round(float(full_doppler_axis[matched_full_doppler_bin]), 2),
                "powerDb": round(float(full_power_db[matched_full_doppler_bin, matched_full_range_bin]), 2),
                "cfarThresholdDb": round(float(full_threshold_db[matched_full_doppler_bin, matched_full_range_bin]), 2),
            }
            associated_cfar_ids.add(str(matched_peak["id"]))

        is_ghost = bool(target.get("ghost"))
        matched = matched_peak is not None
        outcome = (
            "ghost-false-alarm"
            if is_ghost and matched
            else "ghost-suppressed"
            if is_ghost
            else "hit"
            if matched
            else "miss"
        )
        index = expected_doppler_bin * 12 + expected_range_bin
        if 0 <= index < len(cells):
            cells[index]["label"] = str(target.get("label", "target"))
            cells[index]["targetOutcome"] = outcome
            if target.get("ghost"):
                cells[index]["ghost"] = True
            else:
                cells[index]["gt"] = True
            if matched_peak is not None:
                cells[index]["matchedPeakId"] = matched_peak["id"]

        associations.append(
            {
                "label": str(target.get("label", "target")),
                "targetKind": "ghost" if is_ghost else "truth",
                "expectedRangeM": round(target_range, 2),
                "expectedVelocityMps": round(target_velocity, 2),
                "expectedRangeBin": expected_range_bin,
                "expectedDopplerBin": expected_doppler_bin,
                "rcsDbsm": round(safe_float(target.get("rcsDbsm"), 0.0), 2),
                **(
                    {
                        "nearestPeakId": matched_peak["id"],
                        "nearestPeakRangeM": matched_peak["rangeM"],
                        "nearestPeakVelocityMps": matched_peak["radialVelocityMps"],
                        "rangeErrorM": round(float(matched_peak["rangeM"] - target_range), 2),
                        "velocityErrorMps": round(float(matched_peak["radialVelocityMps"] - target_velocity), 2),
                    }
                    if matched_peak is not None
                    else {}
                ),
                "outcome": outcome,
                "note": (
                    "CFAR peak was associated with this target in the full-resolution Range-Doppler gate."
                    if outcome == "hit"
                    else "A ghost-labelled scenario bin produced CFAR evidence."
                    if outcome == "ghost-false-alarm"
                    else "Ghost target did not produce a CFAR peak in the full-resolution gate."
                    if outcome == "ghost-suppressed"
                    else "No CFAR peak was found in the target's full-resolution Range-Doppler gate."
                ),
            }
        )

    peak_candidates: list[dict[str, Any]] = []
    for cell in cells:
        peak_id = f"rd-{cell['dopplerBin']}-{cell['rangeBin']}"
        if peak_id in cfar_peak_ids:
            peak_candidates.append(
                {
                    "id": peak_id,
                    "label": cell.get("label") or "CFAR peak",
                    "rangeBin": cell["rangeBin"],
                    "dopplerBin": cell["dopplerBin"],
                    "rangeM": cell["rangeM"],
                    "radialVelocityMps": cell["radialVelocityMps"],
                    "powerDb": cell["powerDb"],
                    "cfarThresholdDb": cell["cfarThresholdDb"],
                    "snrDb": round(float(cell["powerDb"] - noise_floor_db), 2),
                    "detected": True,
                    "ghost": bool(cell.get("ghost")),
                    "source": "cfar",
                }
            )

    top_power_cells = sorted(cells, key=lambda cell: float(cell["powerDb"]), reverse=True)[:6]
    existing_peak_ids = {peak["id"] for peak in peak_candidates}
    for cell in top_power_cells:
        peak_id = f"rd-{cell['dopplerBin']}-{cell['rangeBin']}"
        if peak_id in existing_peak_ids:
            continue
        peak_candidates.append(
            {
                "id": f"top-{peak_id}",
                "label": cell.get("label") or "top power cell",
                "rangeBin": cell["rangeBin"],
                "dopplerBin": cell["dopplerBin"],
                "rangeM": cell["rangeM"],
                "radialVelocityMps": cell["radialVelocityMps"],
                "powerDb": cell["powerDb"],
                "cfarThresholdDb": cell["cfarThresholdDb"],
                "snrDb": round(float(cell["powerDb"] - noise_floor_db), 2),
                "detected": bool(cell["detected"]),
                "ghost": bool(cell.get("ghost")),
                "source": "top-power",
            }
        )

    cfar_peaks = [peak for peak in peak_candidates if peak["source"] == "cfar"]
    false_alarms = [peak for peak in cfar_peaks if peak["id"] not in associated_cfar_ids and not peak["ghost"]]
    hits = sum(1 for item in associations if item["outcome"] == "hit")
    misses = sum(1 for item in associations if item["outcome"] == "miss")
    ghost_false_alarms = sum(1 for item in associations if item["outcome"] == "ghost-false-alarm")
    ghost_candidates = sum(1 for item in associations if item["targetKind"] == "ghost")

    return {
        "rangeBins": 12,
        "dopplerBins": 8,
        "evidenceSource": "computed",
        "rangeAxisM": [round(float(value), 2) for value in range_axis],
        "dopplerAxisMps": [round(float(value), 2) for value in doppler_axis],
        "axisSummary": {
            "rangeMinM": round(float(range_axis[0]), 2),
            "rangeMaxM": round(float(range_axis[-1]), 2),
            "rangeStepM": round(float(np.mean(np.diff(range_axis))), 2),
            "radialVelocityMinMps": round(float(np.min(doppler_axis)), 2),
            "radialVelocityMaxMps": round(float(np.max(doppler_axis)), 2),
            "radialVelocityStepMps": round(float(np.mean(np.abs(np.diff(doppler_axis)))), 2),
        },
        "cells": cells,
        "peaks": peak_candidates[:12],
        "targetAssociations": associations,
        "detectionSummary": {
            "cfarPeaks": len(cfar_peaks),
            "gtTargets": sum(1 for target in request["targets"] if not target.get("ghost")),
            "hits": hits,
            "misses": misses,
            "ghostCandidates": ghost_candidates,
            "ghostFalseAlarms": ghost_false_alarms,
            "falseAlarms": len(false_alarms),
        },
        "facts": [
            {
                "label": "Simulation",
                "value": "RadarSim whitebox sim_radar",
                "note": f"baseband shape {list(baseband.shape)}.",
            },
            {
                "label": "Processing",
                "value": "processing.range_doppler_fft",
                "note": "Range-Doppler map computed from live baseband.",
            },
            {
                "label": "CFAR",
                "value": "processing.cfar_ca_2d",
                "note": f"Pfa={request['cfar']['pfa']}, guard={request['cfar']['guard']}, trailing={request['cfar']['trailing']}.",
            },
            {
                "label": "Axes",
                "value": f"{range_axis[0]:.1f}-{range_axis[-1]:.1f}m / {np.min(doppler_axis):.1f}-{np.max(doppler_axis):.1f}m/s",
                "note": "Range axis is derived from bandwidth; Doppler axis is fftshifted from carrier frequency and PRP for display/GT association.",
            },
            {
                "label": "Targets",
                "value": f"{len(request['targets'])} live returns",
                "note": ", ".join(str(target.get("label", "target")) for target in request["targets"]),
            },
        ],
    }


def roc_pd(rsp, pfa: float, npulses: int = 16) -> list[dict[str, float]]:
    snr_values = np.array([-6, -3, 0, 3, 6, 9, 12, 15, 18, 21], dtype=float)
    pd_values = np.ravel(rsp.tools.roc_pd(np.array([pfa]), snr_values, npulses=npulses, stype="Coherent"))
    return [
        {"snrDb": int(snr), "pd": round(float(pd) * 100, 2), "pfa": pfa, "npulses": npulses, "stype": "Coherent"}
        for snr, pd in zip(snr_values, pd_values)
    ]


def velocity_timeline(request: dict[str, Any]) -> list[dict[str, float | str]]:
    moving = [target for target in request["targets"] if abs(safe_float(target.get("radialVelocityMps"), 0.0)) > 0.1]
    target_velocity = safe_float((moving[0] if moving else request["targets"][0]).get("radialVelocityMps"), -5.0)
    rng = np.random.default_rng(7)
    timeline = []
    for idx in range(6):
        gt = target_velocity + math.sin(idx / 2.2) * 0.4
        radar = gt + float(rng.normal(0, 0.12))
        fusion = gt + float(rng.normal(0, 0.08))
        timeline.append({"time": f"{idx}s", "groundTruth": round(gt, 2), "radar": round(radar, 2), "fusion": round(fusion, 2)})
    return timeline


def cfar_sensitivity(rsp, request: dict[str, Any], baseband: np.ndarray) -> list[dict[str, float | str | int | bool]]:
    pfas = [1e-3, 3e-3, 1e-2]
    windows = [(1, 2), (1, 3), (2, 3), (2, 4)]
    rows = []
    for guard, trailing in windows:
        for pfa in pfas:
            sweep_request = {
                **request,
                "cfar": {
                    **request["cfar"],
                    "pfa": pfa,
                    "guard": guard,
                    "trailing": trailing,
                },
            }
            summary = build_range_doppler(rsp, sweep_request, baseband)["detectionSummary"]
            gt_targets = max(int(summary["gtTargets"]), 1)
            hits = int(summary["hits"])
            misses = int(summary["misses"])
            false_alarms = int(summary["falseAlarms"])
            ghost_false_alarms = int(summary["ghostFalseAlarms"])
            ghost_candidates = max(int(summary["ghostCandidates"]), 1)
            detection_recall = round(hits / gt_targets * 100, 1)
            ghost_rate = round(ghost_false_alarms / ghost_candidates * 100, 1)
            fusion_false_track = round(false_alarms + ghost_false_alarms * 1.5 + misses * 0.5, 1)
            score = round(detection_recall - false_alarms * 4.0 - ghost_rate * 0.35 - misses * 8.0, 1)
            rows.append(
                {
                    "label": f"{pfa:.0e} g{guard}/t{trailing}",
                    "pfa": f"{pfa:.0e}",
                    "guard": guard,
                    "trailing": trailing,
                    "detectionRecall": detection_recall,
                    "falseAlarm": false_alarms,
                    "ghostRate": ghost_rate,
                    "fusionFalseTrack": fusion_false_track,
                    "score": score,
                    "hits": hits,
                    "misses": misses,
                }
            )
    if rows:
        best = max(rows, key=lambda row: float(row["score"]))
        best["recommended"] = True
    return rows


def virtual_array_y_positions(request: dict[str, Any], channel_count: int) -> np.ndarray:
    tx_channels = max(1, int(request["array"]["txChannels"]))
    rx_channels = max(1, int(request["array"]["rxChannels"]))
    tx_center = (tx_channels - 1) / 2.0
    rx_center = (rx_channels - 1) / 2.0
    tx_y = [(idx - tx_center) * request["array"]["txSpacingM"] for idx in range(tx_channels)]
    rx_y = [(idx - rx_center) * request["array"]["rxSpacingM"] for idx in range(rx_channels)]
    positions = [tx + rx for tx in tx_y for rx in rx_y]
    if len(positions) < channel_count:
        positions = (positions * math.ceil(channel_count / max(len(positions), 1)))[:channel_count]
    return np.array(positions[:channel_count], dtype=float)


def estimate_angle_bartlett_nonuniform(
    snapshot: np.ndarray,
    y_positions_m: np.ndarray,
    wavelength_m: float,
) -> dict[str, Any]:
    scan_angles = np.arange(-60.0, 60.1, 1.0)
    finite_snapshot = np.nan_to_num(np.asarray(snapshot, dtype=complex))
    if finite_snapshot.size < 2 or np.max(np.abs(finite_snapshot)) <= 1e-18:
        return {
            "angleDeg": 0.0,
            "confidence": 0.0,
            "ambiguity": "insufficient channel evidence",
        }

    y_positions_m = y_positions_m[: finite_snapshot.size]
    responses = []
    for angle in scan_angles:
        steering = np.exp(1j * 2.0 * np.pi * y_positions_m / max(wavelength_m, 1e-12) * math.sin(math.radians(angle)))
        responses.append(float(abs(np.vdot(steering, finite_snapshot)) ** 2 / max(np.vdot(steering, steering).real, 1e-12)))
    responses_np = np.array(responses, dtype=float)
    peak_idx = int(np.argmax(responses_np))
    peak = float(responses_np[peak_idx])
    side_mask = np.abs(scan_angles - scan_angles[peak_idx]) >= 6.0
    side_peak = float(np.max(responses_np[side_mask])) if np.any(side_mask) else 0.0
    lobe_ratio = peak / max(side_peak, 1e-12)
    max_spacing_m = float(np.max(np.diff(np.sort(y_positions_m)))) if y_positions_m.size > 1 else 0.0
    ambiguity = "low"
    if max_spacing_m > wavelength_m / 2.0:
        ambiguity = "grating-lobe risk"
    if lobe_ratio < 1.4:
        ambiguity = "ambiguous peak"

    return {
        "angleDeg": round(float(scan_angles[peak_idx]), 2),
        "confidence": round(float(min(1.0, (lobe_ratio - 1.0) / 2.0)), 2),
        "ambiguity": ambiguity,
    }


def associate_peak_to_target(peak: dict[str, Any], request: dict[str, Any]) -> dict[str, Any] | None:
    best_target = None
    best_score = float("inf")
    for target in request["targets"]:
        range_error = abs(float(peak["rangeM"]) - safe_float(target.get("rangeM"), 0.0))
        velocity_error = abs(float(peak["radialVelocityMps"]) - safe_float(target.get("radialVelocityMps"), 0.0))
        # Velocity bins are coarse in short demo chirp trains, so keep a moderate gate here.
        if range_error > 4.0 or velocity_error > 2.2:
            continue
        score = range_error / 4.0 + velocity_error / 2.2
        if score < best_score:
            best_score = score
            best_target = {
                "label": str(target.get("label", "target")),
                "semanticClass": semantic_class_for_target(target),
                "targetKind": "ghost" if target.get("ghost") else "truth",
                "rangeErrorM": round(range_error, 2),
                "velocityErrorMps": round(velocity_error, 2),
            }
    return best_target


def build_post_cfar_products(rsp, request: dict[str, Any], baseband: np.ndarray) -> dict[str, Any]:
    rd_cube = rsp.processing.range_doppler_fft(baseband)
    power = np.mean(np.abs(rd_cube) ** 2, axis=0)
    threshold = rsp.processing.cfar_ca_2d(
        power,
        guard=[request["cfar"]["guard"], request["cfar"]["guard"]],
        trailing=[request["cfar"]["trailing"], request["cfar"]["trailing"]],
        pfa=request["cfar"]["pfa"],
    )
    detection = power > threshold
    display_cube = np.flip(np.fft.fftshift(rd_cube, axes=1), axis=1)
    display_power = np.flip(np.fft.fftshift(power, axes=0), axis=0)
    display_threshold = np.flip(np.fft.fftshift(threshold, axes=0), axis=0)
    display_detection = np.flip(np.fft.fftshift(detection, axes=0), axis=0)
    full_range_axis = build_full_range_axis(request, sample_count=power.shape[1])
    full_doppler_axis = build_full_doppler_axis(request, pulse_count=power.shape[0])
    normalized_power_db = 10.0 * np.log10(display_power / np.max(display_power) + 1e-12)
    normalized_threshold_db = 10.0 * np.log10(np.maximum(display_threshold, 1e-18) / np.max(display_power) + 1e-12)
    noise_floor_db = float(np.percentile(normalized_power_db, 35))
    wavelength_m = SPEED_OF_LIGHT_MPS / (
        (request["waveform"]["startFrequencyGhz"] + request["waveform"]["stopFrequencyGhz"]) * 0.5e9
    )
    y_positions_m = virtual_array_y_positions(request, display_cube.shape[0])

    raw_indices = np.argwhere(display_detection)
    raw_candidates = []
    for d_idx, r_idx in raw_indices:
        d_idx = int(d_idx)
        r_idx = int(r_idx)
        d0 = max(0, d_idx - 1)
        d1 = min(display_power.shape[0], d_idx + 2)
        r0 = max(0, r_idx - 2)
        r1 = min(display_power.shape[1], r_idx + 3)
        if display_power[d_idx, r_idx] < np.max(display_power[d0:d1, r0:r1]):
            continue
        raw_candidates.append(
            {
                "id": f"full-{d_idx}-{r_idx}",
                "fullDopplerBin": d_idx,
                "fullRangeBin": r_idx,
                "rangeM": round(float(full_range_axis[r_idx]), 2),
                "radialVelocityMps": round(float(full_doppler_axis[d_idx]), 2),
                "powerDb": round(float(normalized_power_db[d_idx, r_idx]), 2),
                "cfarThresholdDb": round(float(normalized_threshold_db[d_idx, r_idx]), 2),
                "cfarMarginDb": round(float(normalized_power_db[d_idx, r_idx] - normalized_threshold_db[d_idx, r_idx]), 2),
                "snrDb": round(float(normalized_power_db[d_idx, r_idx] - noise_floor_db), 2),
            }
        )

    raw_candidates.sort(key=lambda peak: (float(peak["cfarMarginDb"]), float(peak["powerDb"])), reverse=True)
    grouped_peaks = []
    for peak in raw_candidates:
        if any(
            abs(int(peak["fullDopplerBin"]) - int(existing["fullDopplerBin"])) <= 1
            and abs(int(peak["fullRangeBin"]) - int(existing["fullRangeBin"])) <= 3
            for existing in grouped_peaks
        ):
            continue
        grouped_peaks.append(peak)
        if len(grouped_peaks) >= 40:
            break

    radar_points = []
    for peak in grouped_peaks:
        if float(peak["snrDb"]) < 4.0 or float(peak["cfarMarginDb"]) < 0.0:
            continue
        d_idx = int(peak["fullDopplerBin"])
        r_idx = int(peak["fullRangeBin"])
        angle = estimate_angle_bartlett_nonuniform(display_cube[:, d_idx, r_idx], y_positions_m, wavelength_m)
        angle_rad = math.radians(float(angle["angleDeg"]))
        range_m = float(peak["rangeM"])
        associated = associate_peak_to_target(peak, request)
        point = {
            "id": f"pt-{len(radar_points) + 1}",
            "sourcePeakId": peak["id"],
            "rangeM": peak["rangeM"],
            "radialVelocityMps": peak["radialVelocityMps"],
            "angleDeg": angle["angleDeg"],
            "angleConfidence": angle["confidence"],
            "angleAmbiguity": angle["ambiguity"],
            "xM": round(range_m, 2),
            "yM": round(float(range_m * math.tan(angle_rad)), 2),
            "snrDb": peak["snrDb"],
            "cfarMarginDb": peak["cfarMarginDb"],
            "powerDb": peak["powerDb"],
            "classification": associated["semanticClass"] if associated else "unknown",
            "association": associated,
        }
        radar_points.append(point)

    clusters: list[list[dict[str, Any]]] = []
    for point in radar_points:
        assigned = False
        for cluster in clusters:
            center_x = sum(float(item["xM"]) for item in cluster) / len(cluster)
            center_y = sum(float(item["yM"]) for item in cluster) / len(cluster)
            center_v = sum(float(item["radialVelocityMps"]) for item in cluster) / len(cluster)
            spatial_distance = math.hypot(float(point["xM"]) - center_x, float(point["yM"]) - center_y)
            velocity_distance = abs(float(point["radialVelocityMps"]) - center_v)
            if spatial_distance <= 7.0 and velocity_distance <= 2.5:
                cluster.append(point)
                assigned = True
                break
        if not assigned:
            clusters.append([point])

    radar_objects = []
    for idx, cluster in enumerate(clusters, start=1):
        associated_truth = [item for item in cluster if (item.get("association") or {}).get("targetKind") == "truth"]
        associated_ghost = [item for item in cluster if (item.get("association") or {}).get("targetKind") == "ghost"]
        classification = (
            associated_truth[0]["association"]["semanticClass"]
            if associated_truth
            else associated_ghost[0]["association"]["semanticClass"]
            if associated_ghost
            else "unknown"
        )
        # Single unassociated CFAR peaks remain radar points, not object-level outputs.
        # Object formation needs target association, multi-point support, or a stronger
        # tracker-level confirmation pass than this single-frame adapter has.
        if not associated_truth and not associated_ghost and len(cluster) < 2:
            continue
        confidence = min(
            0.99,
            0.35
            + 0.08 * len(cluster)
            + max(float(item["snrDb"]) for item in cluster) / 40.0
            + (0.25 if associated_truth else 0.0)
            - (0.2 if associated_ghost else 0.0),
        )
        radar_objects.append(
            {
                "id": f"obj-{idx}",
                "pointIds": [item["id"] for item in cluster],
                "pointCount": len(cluster),
                "classHint": classification,
                "centerXM": round(sum(float(item["xM"]) for item in cluster) / len(cluster), 2),
                "centerYM": round(sum(float(item["yM"]) for item in cluster) / len(cluster), 2),
                "rangeM": round(sum(float(item["rangeM"]) for item in cluster) / len(cluster), 2),
                "angleDeg": round(sum(float(item["angleDeg"]) for item in cluster) / len(cluster), 2),
                "radialVelocityMps": round(sum(float(item["radialVelocityMps"]) for item in cluster) / len(cluster), 2),
                "confidence": round(float(max(0.0, min(0.99, confidence))), 2),
                "targetKind": "truth" if associated_truth else "ghost" if associated_ghost else "unassociated",
            }
        )

    confirmed_tracks = [
        {
            "id": f"trk-{idx + 1}",
            "objectId": radar_object["id"],
            "classHint": radar_object["classHint"],
            "trackAgeFrames": 3 if radar_object["targetKind"] == "truth" else 2,
            "existenceProbability": round(
                min(0.98, float(radar_object["confidence"]) + (0.12 if radar_object["targetKind"] == "truth" else -0.08)),
                2,
            ),
            "targetKind": radar_object["targetKind"],
        }
        for idx, radar_object in enumerate(radar_objects)
        if radar_object["targetKind"] in {"truth", "ghost"} or float(radar_object["confidence"]) >= 0.65
    ]

    return {
        "rawCfarCells": int(np.sum(display_detection)),
        "localMaxPeaks": raw_candidates[:80],
        "groupedPeaks": grouped_peaks,
        "radarPoints": radar_points,
        "radarObjects": radar_objects,
        "confirmedTracks": confirmed_tracks,
        "angleWarning": (
            "Array spacing exceeds lambda/2; angle estimates can contain grating-lobe ambiguity."
            if y_positions_m.size > 1 and float(np.max(np.diff(np.sort(y_positions_m)))) > wavelength_m / 2.0
            else "Angle estimates use non-uniform Bartlett steering from RadarSim channel phase."
        ),
    }


def post_cfar_filtering(range_doppler: dict[str, Any], products: dict[str, Any] | None = None) -> dict[str, Any]:
    summary = range_doppler.get("detectionSummary", {})
    raw_cfar = int(products.get("rawCfarCells", summary.get("cfarPeaks", 0))) if products else int(summary.get("cfarPeaks", 0))
    hits = int(summary.get("hits", 0))
    false_alarms = int(summary.get("falseAlarms", 0))
    ghost_false_alarms = int(summary.get("ghostFalseAlarms", 0))
    ghost_candidates = int(summary.get("ghostCandidates", 0))
    ghost_suppressed = max(0, ghost_candidates - ghost_false_alarms)

    grouped_peaks = len(products.get("groupedPeaks", [])) if products else max(hits + ghost_false_alarms, raw_cfar - math.ceil(false_alarms * 0.45))
    gated_points = len(products.get("radarPoints", [])) if products else min(grouped_peaks, hits + ghost_false_alarms + min(false_alarms, 1))
    radar_objects = len(products.get("radarObjects", [])) if products else min(gated_points, hits + ghost_false_alarms)
    confirmed_tracks = len(products.get("confirmedTracks", [])) if products else min(radar_objects, hits + ghost_false_alarms)
    fusion_accepted = (
        sum(1 for track in products.get("confirmedTracks", []) if track.get("targetKind") == "truth")
        if products
        else min(confirmed_tracks, hits)
    )

    stage_values = [
        ("Raw CFAR cells", raw_cfar, "processing.cfar_ca_2d full-resolution threshold cells", "computed"),
        ("Peak grouped / NMS", grouped_peaks, "computed local maximum grouping on the full Range-Doppler grid", "computed"),
        ("Radar points", gated_points, "range + Doppler + peak DOA angle from RadarSim channel phase", "computed"),
        ("Radar objects", radar_objects, "computed spatial/velocity clustering over radar points", "computed"),
        ("Confirmed tracks", confirmed_tracks, "multi-frame track confirmation policy proxy", "proxy"),
        ("Fusion accepted", fusion_accepted, "truth/ghost association proxy until fusion adapter is connected", "proxy"),
    ]
    stages = []
    previous = raw_cfar
    for idx, (stage, count, method, evidence) in enumerate(stage_values):
        rejected = 0 if idx == 0 else max(previous - count, 0)
        stages.append(
            {
                "stage": stage,
                "count": count,
                "rejected": rejected,
                "method": method,
                "evidence": evidence,
            }
        )
        previous = count

    return {
        "evidenceSource": "computed" if products else "derived",
        "stages": stages,
        "filters": [
            {
                "name": "Peak grouping / NMS",
                "setting": "3x3 Range-Doppler neighborhood",
                "effect": "Collapses multiple adjacent CFAR cells caused by one target return.",
                "tradeoff": "Can merge close objects when range or Doppler separation is small.",
            },
            {
                "name": "SNR margin gate",
                "setting": "keep peaks with positive margin over CFAR threshold",
                "effect": "Removes weak CFAR-only peaks near the adaptive threshold.",
                "tradeoff": "Low-RCS pedestrians and long-range objects can be removed first.",
            },
            {
                "name": "Static / ghost guard",
                "setting": "near-zero Doppler + guardrail/rain context",
                "effect": f"Suppresses {ghost_suppressed} ghost candidate(s) in this run.",
                "tradeoff": "Static or slow valid objects need a different policy in parking/urban scenes.",
            },
            {
                "name": "Track confirmation",
                "setting": "2-of-3 frame confirmation proxy",
                "effect": "Prevents one-frame CFAR spikes from becoming radar tracks.",
                "tradeoff": "Track birth can be delayed for fast cut-in or low-RCS targets.",
            },
        ],
        "summary": {
            "rawCfar": raw_cfar,
            "groupedPeaks": grouped_peaks,
            "radarPoints": gated_points,
            "radarObjects": radar_objects,
            "confirmedTracks": confirmed_tracks,
            "fusionAccepted": fusion_accepted,
            "ghostSuppressed": ghost_suppressed,
        },
        **(
            {
                "groupedPeaks": products.get("groupedPeaks", [])[:24],
                "radarPoints": products.get("radarPoints", [])[:24],
                "radarObjects": products.get("radarObjects", [])[:16],
                "confirmedTracks": products.get("confirmedTracks", [])[:16],
                "angleWarning": products.get("angleWarning"),
            }
            if products
            else {}
        ),
    }


def normalize_spectrum(values: np.ndarray) -> np.ndarray:
    finite = np.nan_to_num(np.asarray(values, dtype=float), nan=np.nanmin(values), posinf=np.nanmax(values), neginf=np.nanmin(values))
    span = float(np.max(finite) - np.min(finite))
    if span <= 1e-12:
        return np.zeros_like(finite)
    return (finite - np.min(finite)) / span * 100.0


def doa_spectrum(rsp, request: dict[str, Any], baseband: np.ndarray) -> list[dict[str, float]]:
    if baseband.shape[0] < 2:
        return []
    rd_cube = rsp.processing.range_doppler_fft(baseband)
    snapshots = rd_cube.reshape(rd_cube.shape[0], -1)
    snapshots = np.where(np.isfinite(snapshots), snapshots, 0.0)
    finite_abs = np.abs(snapshots)
    finite_abs = finite_abs[np.isfinite(finite_abs)]
    peak = float(np.max(finite_abs)) if finite_abs.size else 0.0
    if peak > 0:
        snapshots = snapshots / peak
    covmat = np.einsum("ik,jk->ij", snapshots, snapshots.conj()) / max(snapshots.shape[1], 1)
    covmat = covmat + np.eye(covmat.shape[0]) * 1e-12
    scanangles = np.arange(-60, 61, 5)
    nsig = max(1, min(sum(1 for target in request["targets"] if not target.get("ghost")), covmat.shape[0] - 1))
    try:
        bartlett = normalize_spectrum(rsp.processing.doa_bartlett(covmat, spacing=0.5, scanangles=scanangles))
    except Exception:
        bartlett = np.zeros(scanangles.shape)
    try:
        capon = normalize_spectrum(rsp.processing.doa_capon(covmat, spacing=0.5, scanangles=scanangles))
    except Exception:
        capon = np.zeros(scanangles.shape)
    try:
        _, _, music_ps = rsp.processing.doa_music(covmat, nsig=nsig, spacing=0.5, scanangles=scanangles)
        music = normalize_spectrum(music_ps)
    except Exception:
        music = np.zeros(scanangles.shape)
    return [
        {
            "angle": int(angle),
            "bartlett": round(float(bartlett[idx]), 2),
            "capon": round(float(capon[idx]), 2),
            "music": round(float(music[idx]), 2),
        }
        for idx, angle in enumerate(scanangles)
    ]


def detection_probability_by_range(rsp, request: dict[str, Any], class_rcs: dict[str, float]) -> list[dict[str, float | str]]:
    ranges = [20, 40, 60, 80, 100, 120]
    # Approximate link-budget SNR for characterization; Pd itself is computed with RadarSim tools.roc_pd.
    chart_class_rcs = {key: class_rcs[key] for key in ("vehicle", "pedestrian", "cyclist", "motorcycle")}
    tx_power_dbm = request["waveform"]["txPowerDbm"]
    bandwidth_mhz = max((request["waveform"]["stopFrequencyGhz"] - request["waveform"]["startFrequencyGhz"]) * 1000.0, 1.0)
    bandwidth_gain = 10.0 * math.log10(bandwidth_mhz / 200.0)
    rows = []
    for range_m in ranges:
        row: dict[str, float | str] = {"range": f"{range_m}m"}
        for class_name, rcs_dbsm in chart_class_rcs.items():
            # Constant is calibrated for readable workbench characterization, while preserving radar-equation range/RCS monotonicity.
            snr_db = tx_power_dbm + rcs_dbsm + bandwidth_gain + 50.0 - 40.0 * math.log10(range_m)
            pd_value = float(np.ravel(rsp.tools.roc_pd(np.array([request["cfar"]["pfa"]]), np.array([snr_db]), npulses=request["waveform"]["pulses"], stype="Coherent"))[0])
            row[class_name] = round(pd_value * 100.0, 1)
        rows.append(row)
    return rows


def signal_processing_chain() -> list[dict[str, str]]:
    return [
        {
            "stage": "Baseband simulation",
            "functionName": "radarsimpy_whitebox.sim_radar",
            "fidelity": "Synthetic signal",
            "status": "wired",
            "output": "baseband + noise + timestamp",
        },
        {
            "stage": "Range-Doppler",
            "functionName": "processing.range_doppler_fft",
            "fidelity": "Range-Doppler",
            "status": "wired",
            "output": "channel x Doppler x range cube",
        },
        {
            "stage": "CFAR detection",
            "functionName": "processing.cfar_ca_2d",
            "fidelity": "Range-Doppler",
            "status": "wired",
            "output": "threshold map + detected cells",
        },
        {
            "stage": "DOA spectrum",
            "functionName": "processing.doa_bartlett / doa_capon / doa_music",
            "fidelity": "Radar cube",
            "status": "wired",
            "output": "angle spectrum from simulated channel covariance",
        },
        {
            "stage": "Detection probability",
            "functionName": "tools.roc_pd",
            "fidelity": "Synthetic signal",
            "status": "wired",
            "output": "Pd vs SNR reference curve",
        },
    ]


def failure_buckets_from_associations(range_doppler: dict[str, Any]) -> list[dict[str, Any]]:
    associations = range_doppler.get("targetAssociations", [])
    summary = range_doppler.get("detectionSummary", {})
    buckets = []
    misses = [item for item in associations if item.get("outcome") == "miss"]
    ghost_false = [item for item in associations if item.get("outcome") == "ghost-false-alarm"]
    ghost_suppressed = [item for item in associations if item.get("outcome") == "ghost-suppressed"]
    false_alarm_count = int(summary.get("falseAlarms", 0))
    if misses:
        buckets.append(
            {
                "name": "CFAR missed truth targets",
                "impact": f"{len(misses)} truth target(s) were not associated with CFAR peaks in this run.",
                "relatedChanges": ["CFAR Pfa", "target RCS", "range-Doppler SNR", "guard/trailing cells"],
                "followUp": "Sweep CFAR Pfa and inspect the missed target bins in Range-Doppler.",
                "severity": "high" if len(misses) > 1 else "medium",
            }
        )
    if ghost_false:
        buckets.append(
            {
                "name": "Ghost candidate accepted by CFAR",
                "impact": f"{len(ghost_false)} ghost candidate(s) produced CFAR-associated evidence.",
                "relatedChanges": ["CFAR Pfa", "ghost suppression", "radar_weight", "guardrail/rain slice"],
                "followUp": "Run the ghost slice with stricter Pfa or add a ghost suppression gate before fusion.",
                "severity": "high",
            }
        )
    if false_alarm_count:
        buckets.append(
            {
                "name": "Unassociated CFAR false alarms",
                "impact": f"{false_alarm_count} CFAR peak(s) were not associated with requested targets.",
                "relatedChanges": ["noise floor", "CFAR Pfa", "training cells", "static clutter"],
                "followUp": "Inspect peak list and compare CA-CFAR against OS-CFAR for this scene.",
                "severity": "medium",
            }
        )
    if ghost_suppressed and not ghost_false:
        buckets.append(
            {
                "name": "Ghost candidates suppressed",
                "impact": f"{len(ghost_suppressed)} ghost candidate(s) did not produce associated CFAR peaks.",
                "relatedChanges": ["CFAR threshold", "RCS", "Doppler gate"],
                "followUp": "Keep this slice as a guardrail when loosening CFAR thresholds.",
                "severity": "low",
            }
        )
    return buckets[:3]


def fusion_contribution(request: dict[str, Any]) -> list[dict[str, float | str]]:
    ghost_targets = sum(1 for target in request["targets"] if target.get("ghost"))
    low_rcs = sum(1 for target in request["targets"] if safe_float(target.get("rcsDbsm"), 0.0) < 0)
    return [
        {"scenario": "Live preset", "accepted": 76 - ghost_targets * 4, "rejected": 24 + ghost_targets * 4, "radarOnlyTp": 18 + low_rcs * 3, "ghostAccepted": 4 + ghost_targets * 8, "velocityImprovedTrack": 30, "conflict": 8 + ghost_targets * 4},
        {"scenario": "Guardrail slice", "accepted": 68 - ghost_targets * 2, "rejected": 32 + ghost_targets * 2, "radarOnlyTp": 12, "ghostAccepted": 10 + ghost_targets * 9, "velocityImprovedTrack": 16, "conflict": 14 + ghost_targets * 4},
        {"scenario": "Highway cut-in", "accepted": 84, "rejected": 16, "radarOnlyTp": 22, "ghostAccepted": 3 + ghost_targets * 2, "velocityImprovedTrack": 38, "conflict": 6},
        {"scenario": "Low-RCS", "accepted": 58 + low_rcs * 3, "rejected": 42 - low_rcs * 2, "radarOnlyTp": 8 + low_rcs * 4, "ghostAccepted": 5 + ghost_targets * 3, "velocityImprovedTrack": 13, "conflict": 17},
    ]


def simulate_baseband(rsp, request: dict[str, Any], mode: str) -> tuple[dict[str, Any], np.ndarray, float]:
    started = time.perf_counter()
    waveform = request["waveform"]
    receiver = request["receiver"]
    array = request["array"]
    tx = rsp.Transmitter(
        f=[waveform["startFrequencyGhz"] * 1e9, waveform["stopFrequencyGhz"] * 1e9],
        t=[0.0, waveform["chirpDurationUs"] * 1e-6],
        tx_power=waveform["txPowerDbm"],
        pulses=waveform["pulses"],
        prp=waveform["prpUs"] * 1e-6,
        channels=make_tx_channels(rsp, request, mode),
    )
    rx = rsp.Receiver(
        fs=receiver["samplingRateMsps"] * 1e6,
        noise_figure=receiver["noiseFigureDb"],
        rf_gain=0,
        load_resistor=500,
        baseband_gain=0,
        bb_type="complex",
        channels=make_channels(array["rxChannels"], array["rxSpacingM"]),
    )
    radar = rsp.Radar(tx, rx, seed=2026)
    whitebox_targets = [target_to_whitebox(target) for target in request["targets"]]
    sim_result = rsp.sim_radar(radar, whitebox_targets)
    baseband = sim_result["baseband"] + sim_result["noise"]
    elapsed_ms = (time.perf_counter() - started) * 1000
    return sim_result, baseband, elapsed_ms


def mimo_modulation_comparison(rsp, request: dict[str, Any], selected_mode: str) -> dict[str, Any]:
    rows = []
    warnings = [
        "TPM is mapped to RadarSim whitebox BPM helpers because the local RadarSim package exposes bpm_code/bpm_channels, not a separate tpm_code API.",
        "This comparison uses RadarSim whitebox per-virtual-channel baseband; it is not a full receiver-side BPM/TPM decoder validation.",
    ]
    for mode in ("tdm", "tpmBpm"):
        _, mode_baseband, _ = simulate_baseband(rsp, request, mode)
        mode_rd = build_range_doppler(rsp, request, mode_baseband)
        mode_products = build_post_cfar_products(rsp, request, mode_baseband)
        mode_summary = modulation_summary(rsp, request, mode)
        detection_summary = mode_rd.get("detectionSummary", {})
        points = mode_products.get("radarPoints", [])
        mean_angle_confidence = (
            sum(float(point.get("angleConfidence", 0.0)) for point in points) / len(points)
            if points
            else 0.0
        )
        peak_snr_db = max((float(point.get("snrDb", -120.0)) for point in points), default=-120.0)
        rows.append(
            {
                **mode_summary,
                "rawCfar": int(mode_products.get("rawCfarCells", detection_summary.get("cfarPeaks", 0))),
                "groupedPeaks": len(mode_products.get("groupedPeaks", [])),
                "radarPoints": len(points),
                "radarObjects": len(mode_products.get("radarObjects", [])),
                "hits": int(detection_summary.get("hits", 0)),
                "misses": int(detection_summary.get("misses", 0)),
                "falseAlarms": int(detection_summary.get("falseAlarms", 0)),
                "ghostFalseAlarms": int(detection_summary.get("ghostFalseAlarms", 0)),
                "meanAngleConfidence": round(mean_angle_confidence, 2),
                "peakSnrDb": round(peak_snr_db, 2),
            }
        )

    tdm_row = next(row for row in rows if row["mode"] == "tdm")
    bpm_row = next(row for row in rows if row["mode"] == "tpmBpm")
    if int(bpm_row["hits"]) > int(tdm_row["hits"]) and int(bpm_row["falseAlarms"]) <= int(tdm_row["falseAlarms"]) + 1:
        recommendation = "TPM/BPM is better for this preset because it keeps all TX active per pulse and improves target evidence without a large false-alarm penalty."
    elif int(tdm_row["falseAlarms"]) < int(bpm_row["falseAlarms"]):
        recommendation = "TDM is cleaner for this preset; TPM/BPM adds simultaneous-TX energy but currently produces more CFAR clutter in the simple whitebox pipeline."
    else:
        recommendation = "Both modes are comparable in this preset. Choose TDM for simpler separation/debugging, or TPM/BPM when TX duty and phase-coded MIMO experiments are the priority."

    return {
        "evidenceSource": "computed",
        "selectedMode": normalize_mimo_mode(selected_mode),
        "boundary": "Computed by running RadarSim whitebox twice with identical scene/waveform/receiver/CFAR settings and changing only TX pulse modulation.",
        "rows": rows,
        "pulsePreview": modulation_pulse_preview(rsp, request),
        "recommendation": recommendation,
        "warnings": warnings,
    }


def kpis(request: dict[str, Any], elapsed_ms: float, baseband: np.ndarray) -> list[dict[str, str]]:
    bandwidth_mhz = (request["waveform"]["stopFrequencyGhz"] - request["waveform"]["startFrequencyGhz"]) * 1000
    range_resolution_m = 300.0 / max(2.0 * bandwidth_mhz, 1.0)
    peak_db = 20 * math.log10(float(np.max(np.abs(baseband))) + 1e-12)
    ghosts = sum(1 for target in request["targets"] if target.get("ghost"))
    return [
        {"label": "Live runtime", "value": f"{elapsed_ms:.0f}ms", "delta": "RadarSim whitebox", "tone": "good"},
        {"label": "Range resolution", "value": f"{range_resolution_m:.2f}m", "delta": f"{bandwidth_mhz:.0f}MHz BW", "tone": "good"},
        {"label": "Peak baseband", "value": f"{peak_db:.1f}dB", "delta": "max amplitude", "tone": "neutral"},
        {"label": "Targets", "value": str(len(request["targets"])), "delta": f"{ghosts} ghost candidates", "tone": "warn" if ghosts else "good"},
    ]


def run(request: dict[str, Any], radarsim_root: Path) -> dict[str, Any]:
    started = time.perf_counter()
    rsp = load_radarsim(radarsim_root)
    class_rcs, rcs_source_summary = resolve_rcs_source(rsp, request)
    request = apply_effective_target_rcs(request, class_rcs)
    selected_mimo_mode = normalize_mimo_mode(request.get("mimo", {}).get("mode"))
    sim_result, baseband, selected_elapsed_ms = simulate_baseband(rsp, request, selected_mimo_mode)
    elapsed_ms = (time.perf_counter() - started) * 1000
    range_doppler = build_range_doppler(rsp, request, baseband)
    post_cfar_products = build_post_cfar_products(rsp, request, baseband)
    mimo_comparison = mimo_modulation_comparison(rsp, request, selected_mimo_mode)
    adapter = {
        "sourcePath": str(radarsim_root),
        "sourcePackage": "radarsimpy_whitebox",
        "adapterStatus": "radarsim-whitebox",
        "scipyAvailable": True,
        "compiledSimulatorAvailable": False,
        "whiteboxSimulatorAvailable": True,
        "oracleCaptureAvailable": (radarsim_root / "oracle_capture_output" / "macos_arm_py311" / "manifest.json").exists(),
        "functionsUsed": [
            "radarsimpy_whitebox.sim_radar",
            "radarsimpy_whitebox.tdm_code",
            "radarsimpy_whitebox.bpm_code",
            "radarsimpy_whitebox.tdm_channels",
            "radarsimpy_whitebox.bpm_channels",
            "processing.range_doppler_fft",
            "processing.cfar_ca_2d",
            "tools.roc_pd",
        ],
        "limitation": "Live run uses RadarSim whitebox point-target simulator. Vendor compiled ray-tracing, interference radar, and rich material multipath are not claimed by this run.",
    }
    return {
        "schemaVersion": 1,
        "runId": request["runId"],
        "status": "completed",
        "createdAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "elapsedMs": round(elapsed_ms, 2),
        "request": request,
        "adapter": adapter,
        "kpis": kpis(request, elapsed_ms, baseband),
        "rangeDopplerCfar": range_doppler,
        "rocPd": roc_pd(rsp, request["cfar"]["pfa"], request["waveform"]["pulses"]),
        "detectionProbabilityByRange": detection_probability_by_range(rsp, request, class_rcs),
        "rcsSourceSummary": rcs_source_summary,
        "doaSpectrum": doa_spectrum(rsp, request, baseband),
        "velocityTimeline": velocity_timeline(request),
        "cfarSensitivity": cfar_sensitivity(rsp, request, baseband),
        "postCfarFiltering": post_cfar_filtering(range_doppler, post_cfar_products),
        "mimoComparison": mimo_comparison,
        "fusionContribution": fusion_contribution(request),
        "failureBuckets": failure_buckets_from_associations(range_doppler),
        "signalProcessingChain": signal_processing_chain(),
        "summaries": {
            "basebandShape": list(baseband.shape),
            "timestampShape": list(sim_result["timestamp"].shape),
            "interferencePresent": sim_result.get("interference") is not None,
            "preset": request["preset"],
            "selectedMimoMode": selected_mimo_mode,
            "selectedModeElapsedMs": round(selected_elapsed_ms, 2),
        },
        "computedSections": [
            "radarsimpy_whitebox.sim_radar baseband",
            "radarsimpy_whitebox.tdm_code / bpm_code TX pulse modulation",
            "TDM vs TPM/BPM RadarSim comparison runs",
            "processing.range_doppler_fft range-Doppler cube",
            "processing.cfar_ca_2d CFAR threshold grid",
            "processing.doa_bartlett / doa_capon / doa_music angle spectrum",
            "tools.roc_pd Pd/SNR curve",
            "tools.roc_pd detection probability by range with link-budget SNR estimate",
            "RCS source resolution for Pd and point-target amplitude",
            "CFAR sensitivity sweep from repeated cfar_ca_2d thresholds",
            "target association from CFAR peaks and request targets",
            "post-CFAR filtering funnel derived from computed CFAR and target association",
        ],
        "proxySections": [
            "confirmed tracks and fusion accepted counts are policy proxies until radar tracker/fusion adapters are connected",
            "velocity timeline until tracker-level estimation is connected",
            "fusion contribution until the fusion adapter is connected",
        ],
        "warnings": [
            "Whitebox point-target simulation only; not vendor compiled ray tracing.",
            "TPM UI mode is implemented through RadarSim BPM phase-code helpers in this adapter.",
            "DOA spectrum is computed from simulated channel covariance, not from measured radar cube replay.",
            rcs_source_summary["boundary"],
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--request", default="-")
    parser.add_argument("--radarsim-root", type=Path, default=DEFAULT_RADARSIM_ROOT)
    parser.add_argument("--artifact-dir", type=Path)
    args = parser.parse_args()
    try:
        request = normalize_request(read_request(args.request))
        payload = run(request, args.radarsim_root)
        if args.artifact_dir and payload.get("status") == "completed":
            args.artifact_dir.mkdir(parents=True, exist_ok=True)
            artifact_path = args.artifact_dir / f"{payload['runId']}.json"
            artifact_url = f"/assets/radar-sim/runs/{payload['runId']}.json"
            payload.setdefault("artifacts", {})["resultJson"] = {
                "url": artifact_url,
                "path": str(artifact_path),
                "kind": "json",
                "description": "Full RadarSim live run request, computed grids, target associations, and adapter metadata.",
            }
            if payload.get("rangeDopplerCfar"):
                payload["rangeDopplerCfar"]["artifact"] = payload["artifacts"]["resultJson"]
            artifact_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    except Exception as exc:
        payload = {
            "schemaVersion": 1,
            "runId": f"radar-live-failed-{int(time.time() * 1000)}",
            "status": "failed",
            "reason": f"{type(exc).__name__}: {exc}",
            "createdAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        }
    print(json.dumps(payload))


if __name__ == "__main__":
    main()
