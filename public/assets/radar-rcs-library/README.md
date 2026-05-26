# Sinclair Radar RCS Asset Library

This folder contains project-generated canonical mesh assets for early RadarSim
RCS experiments.

These files are not measured RCS data and not production CAD. They are simple
OBJ meshes with JSON metadata so Sinclair can move from hard-coded RCS numbers
to a visible asset-backed RCS source.

Important:

- Do not treat raw `sim_rcs` absolute dBsm from these meshes as measured truth.
- Use `sim_rcs` for aspect-angle response shape first.
- Normalize or calibrate that shape to each asset's `nominalRcsDbsm` until a
  measured RCS table or validated CAD/material model is available.

Recommended source modes:

1. Scenario Assumption
   - fast preset RCS values
   - no mesh calculation

2. RadarSim Mesh RCS
   - use these OBJ files with `radarsimpy_whitebox.sim_rcs`
   - good for early angle sweep and Pd estimate workflows

3. Measured RCS Library
   - future validated table/distribution source

4. High-Fidelity Ray Trace / EM Solver
   - future openEMS/Meep/WiTwin-style backend

Coordinate convention:

- x: object forward/length axis
- y: object lateral/width axis
- z: height axis
- units: meters

Asset boundary:

- Project-generated, synthetic, canonical geometry.
- No external mesh license dependency.
- Not measured or ray-traced truth.
