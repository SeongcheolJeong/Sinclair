# Sinclair Platform

Sinclair is a React + TypeScript mock platform for camera, LiDAR, radar simulation validation, and fusion analysis.

This repository currently implements the platform UI/UX, typed mock data, report views, workbench views, and CameraE2E live simulation integration points. It does not include production sensor simulation engines, real detector execution, or a database/API backend.

## Quick Start

For a no-install full-platform design mock, open this file directly in a browser:

```text
Sinclair_Design_Mock.html
```

It is a standalone HTML entry point for the complete Sinclair platform design. Launchpad, Experiments, Sensor Workbench, Fusion Analysis, Scenario Library, Reports, Docs, and System/Assets tabs work without `npm install` or a dev server.

There is also a narrower CameraE2E execution mock:

```text
Sinclair_CameraE2E_Live_Mock.html
```

For the full React platform:

```bash
npm install
npm run camera:e2e:assets
npm run camera:e2e:sync
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

For full setup details, CameraE2E requirements, validation commands, and troubleshooting, see [INSTALL.md](./INSTALL.md).

## Main Features

- Sinclair Launchpad and Mission Control
- Experiments, run monitor, compare, and parameter sweep mock views
- Camera, radar, and LiDAR workbench UX
- Fusion analysis, scenario library, reports, and docs
- Typed mock contracts and service-style adapters
- CameraE2E live simulation bridge for scene, lens, sensor, ISP, and perception-adapter configuration
- Camera Workbench config resolution rules for requested vs resolved scene/lens/sensor/physics settings

## CameraE2E Integration

The Vite dev server exposes:

```text
POST /api/camera-e2e/run
```

That endpoint runs:

```text
scripts/camera_e2e_live_runner.py
```

The runner auto-discovers a Python environment that can import `/Users/seongcheoljeong/Documents/CameraE2E/src/pyisetcam`. If CameraE2E is unavailable, the app still renders the platform and precomputed/synced assets, but live simulation cannot execute.

## Repository Notes

The original design handoff folder is not committed by default. Runtime assets copied into `public/assets/sinclair` and synced CameraE2E reference assets under `public/assets/camera-e2e` are the intended app assets.

Generated live-run outputs under `public/assets/camera-e2e/live-runs` are ignored.
