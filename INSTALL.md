# Sinclair Installation Guide

This guide installs and runs the Sinclair mock platform locally.

## 1. Requirements

Install these first:

```text
Node.js 18 or newer
npm
Python 3
```

Optional, but required for live CameraE2E simulation:

```text
/Users/seongcheoljeong/Documents/CameraE2E
a Python environment that can import pyisetcam
```

Optional, but required for publishing to GitHub from this machine:

```text
GitHub CLI: gh
an authenticated gh session
```

## 2. Install Frontend Dependencies

From the Sinclair project folder:

```bash
cd /Users/seongcheoljeong/Documents/Sinclair
npm install
```

## 3. Sync CameraE2E Assets

Build the asset index used by the Camera Workbench asset pickers:

```bash
npm run camera:e2e:assets
```

Sync the static CameraE2E integration evidence used by the platform:

```bash
npm run camera:e2e:sync
```

These commands look for CameraE2E at:

```text
/Users/seongcheoljeong/Documents/CameraE2E
```

The scripts also try to auto-discover a Python that can import `pyisetcam`. To force one:

```bash
export CAMERA_E2E_PYTHON=/path/to/python
npm run camera:e2e:assets
npm run camera:e2e:sync
```

Known default candidates include:

```text
/Users/seongcheoljeong/miniforge3/envs/isetcam-py/bin/python
/Users/seongcheoljeong/.micromamba/envs/isetcam-py/bin/python
```

## 4. Run The App

Start the Vite dev server:

```bash
npm run dev
```

Open the printed local URL, usually:

```text
http://localhost:5173
```

If that port is busy, Vite will print another port.

## 5. Live CameraE2E Simulation

The Camera Workbench can run a local simulation from the browser. The browser calls:

```text
POST /api/camera-e2e/run
```

The Vite plugin then runs:

```bash
python3 scripts/camera_e2e_live_runner.py --request -
```

Live simulation supports:

```text
scene
lens / optics asset
lens physics mode
sensor asset and numeric sensor config
ISP config
perception adapter metadata
```

Important behavior:

```text
Raytrace optics .mat
  owns lens geometry and uses Zemax/raytrace PSF behavior.

Catalog lens
  applies focal length, F-number, and FOV approximation only.

Selected optics default
  means no extra synthetic physics mode; if raytrace optics is selected, raytrace PSF remains active.

Sensor resolution fit: Preserve requested resolution
  keeps requested rows/cols.

Sensor resolution fit: Auto-resize to scene FOV
  lets CameraE2E resize rows/cols to match scene FOV.
```

Generated live outputs are written to:

```text
public/assets/camera-e2e/live-runs
```

That folder is intentionally ignored by git.

## 6. Validate The Build

Run:

```bash
npm run lint
npm run build
```

The current build may warn that a Vite chunk is larger than 500 kB. That is a bundle-size warning, not a build failure.

## 7. Troubleshooting

If the app opens but live simulation fails:

```bash
npm run camera:e2e:assets
```

Then check whether a usable CameraE2E Python exists:

```bash
export CAMERA_E2E_PYTHON=/path/to/python
python3 scripts/camera_e2e_bridge.py --python "$CAMERA_E2E_PYTHON"
```

If images appear broken after a run:

```bash
curl -I http://localhost:5173/assets/camera-e2e/live-runs/<run-id>/ip_srgb.png
```

Expected:

```text
HTTP 200
Content-Type: image/png
```

If the PNG exists but the browser still shows a broken image, reload the page and rerun. The app also retries image loading with cache-busting query strings.

If sensor output resolution does not match the requested rows/cols, check the Camera Workbench `Resolution fit` setting:

```text
Preserve requested resolution
  output should match requested rows/cols.

Auto-resize to scene FOV
  CameraE2E may change rows/cols.
```

## 8. Publish To GitHub

Install GitHub CLI:

```bash
brew install gh
```

Log in:

```bash
gh auth login
gh auth status
```

Create a private repo and push:

```bash
cd /Users/seongcheoljeong/Documents/Sinclair
git init
git add .
git commit -m "Implement Sinclair platform mock"
gh repo create Sinclair --private --source=. --remote=origin --push
```

If the repository already exists, add its remote instead:

```bash
git remote add origin git@github.com:<owner>/<repo>.git
git push -u origin main
```

Use `private` unless the design assets and CameraE2E integration references are approved for public release.
