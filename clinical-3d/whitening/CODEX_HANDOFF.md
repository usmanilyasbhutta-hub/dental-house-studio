# Dental House: Blender instruments and treatment surfaces (handoff for Codex)

Made with Blender 4.3 (Cycles). All files open in Blender 4.x. No patient photographs are included.

## What is here

| Folder | Contents |
|---|---|
| `models_generic/` | **Use these for patient-facing work.** Nine instruments without brand names: scaler (ultrasonic, No.1-style tip), barrier_syringe, curing_light, syringe (two-part whitening gel with mixing tip), suction (surgical aspirator tip), polisher (contra-angle with soft brush), mirror (size-4 front-surface), probe (15 mm, black bands at 4-5, 9-10, 14-15 mm), shade_tab (one shade-guide tab, no code) |
| `models/` | Same instruments as reference-study versions, with product labels (barrier syringe, gel syringe, handpiece, curing light, scaler). Private study use only. Also `gingival_barrier_band.blend` and `whitening_gel_coat.blend` (see below) |
| `glb/` | The nine generic instruments as GLB for three.js/web |
| `*.py` | The code that builds and poses everything (`build_reference_models.py` + `reference_models.py` = instruments; `build_materials.py` + `material_surfaces.py` = barrier and gel; `case_geometry.py` = poses and traced outlines; `blender_detail.py` = shared surface-detail helpers) |

## Conventions (instruments)

- Units: millimetres (scene unit scale 0.001). GLB files have no unit scale: **1 GLB unit = 1 mm**.
- Origin = the working point: scaler tip, cannula/delivery outlet, suction opening, curing-light lens centre, brush face,
  mirror head centre, probe tip, middle of the shade tab's incisal edge.
- Handle runs along **-Y**; the tooth surface is the plane z = 0; the camera looks down -Z. GLB is exported Y-up
  (Blender Z → glTF Y): rotate +90° about X to get back to this convention.
- Working poses (Euler XYZ, degrees) and contact points are in `case_geometry.py` (`POSES`, `CONTACT`). Negative X tilt
  lifts the handle towards the operator. Plungers are separate child objects so they can be animated.
- Each `.blend` has its own lights and an orthographic camera framed on the whole instrument.
- Clear plastics use a Layer Weight → Mix Shader trick in Blender; GLB cannot carry it, so rebuild clear materials in the
  target engine (see `src/three/instruments.tsx` in the repo for a three.js version).

## Teeth: important

There is **no 3D tooth or jaw model** in this project. Every treatment shot is composited over the patient's real
intraoral photograph. The only tooth-related geometry is:

- `gingival_barrier_band.blend`: the light-cured gum barrier, a lumpy resin band following the gingival margin traced
  from the photo (six upper anterior teeth).
- `whitening_gel_coat.blend`: the thin whitening-gel film on the six crowns, traced from the same photo.

Both sit in a 7 × 3.94 unit orthographic frame that matches the photo crop (source px 285-665 × 160-374 of a 960-wide
image). They are 2.5D surfaces made to overlay that photograph, not anatomical teeth, and are meaningful only together
with the (private, not included) case photo.

## Rules that came with these files (owner, Dental House)

- Instrument geometry, scale, working tip, operating angle, contact and materials must stay clinically accurate.
- No brand names in patient-facing videos (use `models_generic/`).
- Patient photographs are never shared or committed; ask the clinic for consent before using any case material.
