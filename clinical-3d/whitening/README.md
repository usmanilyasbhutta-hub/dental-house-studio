# Whitening clinical animation — v9 (continues the v8 reference rebuild)

Code-only Blender/Python reconstruction of the instruments from inspected product photographs, composited over the
supplied case photographs. **The initial and final photographs and their tooth colours are untouched**; every
instrument and material in between is a synthetic illustration. The approved sequence is unchanged:
initial → scale → gingival barrier → cure → whitening gel → hold → aspirate → polish → final.

Private review export. Nothing here is published; a dentist approves before any use.

## What changed from v8

A review of v8 against the reference photographs (see `REVIEW.json` → `v8_findings`) led to these changes:

| Area | v8 | v9 |
| --- | --- | --- |
| Gingival margin / crowns | Coarse outline, up to ~1.5 mm off the gum line on some teeth | Retraced on a 19× enlargement of the initial photograph (`case_geometry.py`); barrier, gel and tool paths share it |
| Handle direction | Positive tilt sent handles *into* the patient (polisher handle ~28 mm behind the teeth) | Handles tilt towards the operator; the contact point of each model is projected through the same rotation and pinned to the path |
| SDI barrier syringe | Thin push rod, small label text | Rod ~60 % of barrel width, ribbed black luer hub, bold mint label, black SDI block, flat flange |
| Pola Office+ | Ghosted semi-transparent nozzle, cylinder hub, delivery end ~18 mm | Clear plastic with opaque edges, ribbed conical blue hub, ~11 mm end bent ~55°, stacked POLA lettering, cobalt chamber |
| NSK FX57 | Flat cylinder head, straight neck on the wrong side of the body, stepped junction | Domed head, contra-angle neck, body flaring 12→16 mm; shown side-on so the brush and its contact are visible |
| Radii-Cal CX | Body about half real diameter, far end rendered dark grey | Slim angled head widening to a ~17 mm body (owner asked for slightly slimmer than the ~22 mm product), bezel, button, collar; even lighting |
| Surgitip | Double dog-leg, thin over-long green insert, shown as a flat pipe | Single tight ~45° elbow, 20 mm tapered insert with 2.8 mm lumen, held steeply so insert, sleeve and elbow stay in frame |
| Barrier material | Constant-width flat ribbon mirroring every scallop | Lumpy glossy resin band 2–6 mm tall that fills the papillae and seals ~0.2 mm onto enamel |
| Gel material | Grey-blue tint that dulled the teeth, hard straight lower edge | Clear wet coating: faint cool film plus surface reflections, enamel colour left visible |
| Curing | Fast there-and-back sweep, glow hidden under the head | One slow pass, blue wash visible on the barrier around the head |
| Surface detail | Flat single-colour materials | In-house detailing library (`scripts/blender_detail.py`): moulded plastic, brushed and polished metal, studio reflections |
| Image quality | 850 px renders enlarged 3×, 24 samples, no denoising | 2048 px renders (1.25× enlargement), denoised |

## Rebuild

Dependencies: Blender 4.3 with Cycles CPU (in this repo: `npm run blender:setup`, then use `../../scripts/blender` wherever `blender` appears below), Python 3 with Pillow
and NumPy, FFmpeg/libx264. The comparison sheet optionally uses PyMuPDF.

```bash
blender -b -noaudio --factory-startup --python build_reference_models.py                    # instrument renders (~35 min on 4 cores)
blender -b -noaudio --factory-startup --python build_reference_models.py -- --save-models   # models/*.blend
blender -b -noaudio --factory-startup --python build_materials.py                           # barrier + gel surfaces
python3 render.py --stills     # checks/check_*.jpg
python3 render.py --proof      # ../../out/Whitening_v9_Proof.mp4 (contact moments only)
python3 render.py              # ../../out/DHS_Whitening_Clinical_v9.mp4
python3 fetch_references.py && python3 make_comparison.py   # optional review sheet
```

Useful build flags (after `--`): `--only=<model>`, `--pose=<0-4>`, `--res=<px>`, `--compare-only`.

Output: 41 seconds, 1920×1080, 24 fps, intentionally silent. Complete handles naturally leave the close crop.

`models/` holds six editable Blender scenes, one per instrument, with native meshes, curves, materials, lighting and a
camera framed on the whole instrument. `case_geometry.py` is the single source for the traced margin, crown outlines,
working poses and contact points; the Blender scripts and `render.py` both read it.

## Privacy

`assets/before.jpg`, `assets/after.jpg`, `checks/`, the comparison sheets and the rendered videos contain the patient's
photographs. They are gitignored and must not be committed or uploaded. `package_source.py` writes a private archive
to `out/`.

## What remains estimated

Visible profiles were reconstructed from photographs; unseen surfaces and some dimensions remain estimated. No patient
calibration ruler is available: a 32 px/mm on-screen scale is used, consistent with an assumed 8.5 mm central incisor.
The barrier syringe reference is capped, so the bent working cannula is a clinical approximation. The brush/handpiece
pairing is illustrative, not a compatibility claim. The handpiece is shown side-on with the bristles flexed against
the enamel so the contact can be seen; that viewing choice is illustrative.

Only six upper anterior teeth are illustrated as treated. The clean cut after aspiration omits rinsing and barrier
removal; it does not depict dissolution. The sequence is time-compressed: the curing pass and the gel hold are not
exposure or dwell-time instructions. The final outcome is the actual supplied photograph, with a clean cut between
different capture angles.
