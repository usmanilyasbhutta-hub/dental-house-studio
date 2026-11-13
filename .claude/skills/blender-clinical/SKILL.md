---
name: blender-clinical
description: Build, inspect and render Blender scenes for Dental House clinical animations (instrument models, materials on case photographs, photoreal procedure shots) from code, without a desktop Blender. Use for any request to model or fix a dental instrument, open or edit a .blend file, render with Cycles, check a model against a reference photograph, or continue a project under clinical-3d/.
---

# Blender for clinical animation (Dental House)

Our own skill, written from what worked on the whitening project (`clinical-3d/whitening/`). No third-party
Blender skills or add-ons with their own instructions are installed (owner rule); borrow ideas, build here.
Three.js stays the first choice for 3D explainers (taste T11). Use Blender when the shot needs photoreal
instruments or materials over a real case photograph.

## Setup and running

| What | Command |
|---|---|
| Install once (about 1 min, into `.cache/blender`, gitignored) | `npm run blender:setup` |
| Run a script the way `blender -b --python` would | `scripts/blender -b --python <script.py> -- <args>` |
| Dump objects, sizes and materials of `.blend` files | `scripts/blender --python scripts/blender_inspect.py -- <folder-or-file>` |

This is Blender **4.3** as a Python module (`bpy==4.3.0`, Python 3.11, `numpy<2`), Cycles on the CPU with
OpenImageDenoise. Files it saves open in the owner's desktop Blender 4.x. Do not save with a 5.x module:
4.x cannot open those files. There is no viewport and no GPU: look at results by rendering a PNG and
reading it. The live-Blender connector only works when the owner has Blender open on their PC.

Never name a script after a standard-library module (`inspect.py`, `random.py`, ...): Blender imports it
by accident and crashes on start.

## Detailing library (`scripts/blender_detail.py`)

Our own helpers for the surface detail real instruments have. Import in a build script with
`sys.path.insert(0, <repo>/scripts); import blender_detail as D`.

| Helper | Use for |
|---|---|
| `D.studio_world(scene)` | Graded studio environment so metal and gloss reflect something believable |
| `D.moulded_plastic(mat)` | Injection-moulded polymer: slight scatter, fine texture, thin gloss |
| `D.brushed_metal(mat, direction)` | Satin aluminium / steel with stretched highlights and brush streaks |
| `D.polished_metal(mat)` | Mirror stainless with faint handling marks |
| `D.soft_bevel(obj)` | Rounded manufactured edges with clean shading |

Add a helper here when a new kind of detail is needed (knurling, printed scales, rubber). Keep them
subtle: after adding detail, re-check exposure, because a brighter environment easily blows out white
plastic. Detail must never be added to clinical photographs, only to synthetic models.

## Working method (in this order)

1. **Read before changing.** Open every existing scene and script, render the current stills, and put
   them beside the reference photographs. Write down what is wrong (shape, proportion, angle, contact,
   material) before touching geometry.
2. **Trace anatomy, never eyeball it (T04).** Enlarge the case photograph 15-20x with a coordinate grid,
   read the gingival margin and crown outlines off it, then draw them back over the photograph to check.
   Keep them in one shared file (`case_geometry.py`) that Blender and the compositor both read.
3. **Model in millimetres**, working end at the origin, handle along -Y, tooth surface = plane z 0,
   orthographic camera looking down -Z. Anchor each model on one real dimension and derive the rest from
   the photograph's pixel ratios; record the anchor in `REFERENCES.md`.
4. **Compare, then pose.** Render a neutral whole-instrument view first (`--compare-only`) and fix shape
   there. Only then render working poses.
5. **Cheap first.** Iterate at `--res=800 --pose=2 --only=<model>` (seconds), full 2048 px build last
   (about 35 min for six instruments on 4 cores; run it in the background).
6. **Look at every render yourself**, then at stills composited on the photograph, then at a contact
   sheet cut from the encoded video. Say what was not checked (normal-speed playback, for instance).

## Rules that prevent the mistakes we already made

- **Handles go towards the operator.** With the camera on +Z, a *negative* X tilt lifts a -Y handle
  towards the camera. A positive tilt pushes it into the patient.
- **Pin the contact point, not the image centre.** Project the model-space contact point (outlet, lens
  centre, bristle edge) through the same Euler XYZ rotation Blender used and place that on the path.
- **True scale, one scale.** Every instrument shares the same px/mm. If a real instrument is large in
  frame (a 22 mm curing-light body), say so; do not quietly shrink it.
- **Light the whole handle.** Panels near the tip plus one sun fill; otherwise long handles fall to grey.
- **Render near final size.** Enlarging a render more than about 1.3x looks soft. Denoise.
- **Clear plastic** = transparent face-on, opaque at grazing edges (Layer Weight -> Mix Shader). A flat
  transparency mix looks like a ghosted overlay.
- **Materials on teeth.** Opaque materials (barrier) render as RGBA. Clear ones (gel) render as two
  passes, thickness and reflections, and are added over the photograph so they never darken or recolour
  enamel. Deposits appear only behind the outlet; removals follow the suction opening.
- **Subdivision pinches capped ends.** Leave loft ends open and hide them inside the neighbouring part.
- **Blender 4.x names:** `Transmission Weight`, `Coat Weight`, `Emission Color`. Look nodes up by type
  when a script may run in the owner's localized Blender.

## Golden rules still apply

Before/after photographs are never retouched, recoloured or warped; only synthetic layers go on top, and
nothing synthetic may imply a result. Case photographs, check frames, comparison sheets and rendered
videos stay out of git (`clinical-3d/*/assets/before.jpg`, `after.jpg`, `checks/`, `out/`). Reference
product photographs are for private comparison only. Real brands shown are references, not a claim the
clinic used that exact device, unless the owner says so. Nothing is published without the owner's go-ahead
and a dentist's approval.
