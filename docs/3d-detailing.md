# 3D detailing: Tripo + Blender pipeline

Three.js gives us fast, clean procedure animations. For close-up, photoreal detail we use Blender (Cycles), and Tripo
(AI text/image → 3D mesh) for objects that are slow to model by hand. Everything stays an illustration
("Illustration · not to scale").

## Creative directions (look bible) — `scripts/blender/directions.py A|B|C out.png`
| | Direction | Look | Best for |
|---|---|---|---|
| A | Clinical macro | dark field, warm key + cool rim light, wet enamel, papillae, shallow focus | composite / veneers / whitening close-ups |
| B | Studio product | cream seamless set, brushed titanium, glazed ceramic, exploded parts | implants, crowns, aligners |
| C | Cutaway lesson | tooth cut in half: enamel / dentin / glowing pulp, deep blue studio | education: decay, root canal |

The procedural models set lighting, materials and camera. **Detail** comes next.

**Chosen look: A (owner, 2026-11-14).** Detailed in code, no Tripo for now: layered tooth (translucent enamel shell, IOR 1.63,
over a warm dentin core with three mamelon lobes that stops short of the edge, so the incisal third glows with a halo),
perikymata bump, matte stippled gum graded from coral at the margin to deeper red, and a backlight for translucency.
Full quality: 540×960 at 128 samples ≈ 2 min/frame on this CPU; previews at 32 samples ≈ 15 s.

## Where Tripo fits
- **Instruments and products** (generic, unbranded): handpiece, curing light, composite syringe, matrix band, mirror,
  probe, aligner, toothbrush. Text → mesh, then decimate, clean, and re-material in Blender with our recipes.
- **Detailed teeth** (molar occlusal anatomy, root forms) from text prompts, or from **our own** renders/drawings.
- **Never** feed patient photos or intraoral images to Tripo (golden rule 2: patient data never goes to third-party AI
  services), and never present a generated model as a patient's mouth or result (golden rule 3).
- Each generation costs credits. Generate once, keep the `.glb` in `assets/3d/` (and don't regenerate).

## How to run it
1. **On the owner's PC (recommended):** Blender + the "MCP for Blender" add-on running, with a Tripo key (or Premium).
   Claude then calls `generate_3d(provider="tripo")`, details the model and renders it in your Blender.
2. **In a cloud session:** allow `api.tripo3d.ai` in the environment and save a Tripo API key as an environment secret;
   Claude calls the Tripo API, imports the `.glb` with headless Blender (`bpy`) and renders here.

## Detailing checklist (Blender)
Enamel: subsurface + incisal translucency gradient + perikymata bump + light coat (wet). Gum: SSS, matte, stippling noise.
Metal: brushed anisotropic noise, bevels on every edge. Ceramic: glaze coat, slight translucency. Lighting per direction.
Render 1080×1920 PNG sequence (or EXR), then composite labels and captions in Remotion.

## modelgen: our own text → 3D generator (owner asked for "our own Tripo", 2026-11-14)
`python3 scripts/blender/modelgen.py "<description>" --out public/models/x.glb --preview out/x.png` (`--list` shows the vocabulary).
Pure code in headless Blender: no AI service, no credits, no uploads, same result every time.

- **Teeth:** incisor / canine / premolar / molar, upper or lower, roots, cusps and fissures; a cavity at
  occlusal / mesial / distal / cervical / incisal (small, large), as decay, prepared, or restored with composite.
- **Implant:** `implant 4 x 10 with abutment and crown` (diameter × length in mm).
- **Instruments (generic, no brands):** handpiece, curing light, composite syringe, mouth mirror, explorer.
- Output: `.glb` (Blender and three.js) + a preview in the clinical-macro lighting.
- Library: `scripts/blender/library.txt` lists name | description; `python3 scripts/blender/build_library.py` rebuilds
  all 15 models (~2 min). `.glb` files are not committed because they are reproducible from the text.
- Parser check: `python3 scripts/blender/modelgen.py --selftest`.
- New object type: add a builder function + keywords in `KINDS`, then a line in `library.txt`.

Limits: it only knows the objects it was taught (it cannot turn a photo into 3D), and shapes are idealised textbook
anatomy, not any patient's tooth.

**v2 (2026-11-14):** every tooth is layered like direction A: a translucent enamel shell (IOR 1.63, fine horizontal
growth lines) over a warm dentin core that stops short of the edge, so incisal edges and cusp tips stay translucent;
cavities cut through both layers. Upper molar rebuilt: rhomboid outline, four cusps (mesiopalatal largest), oblique
ridge, central and distal fossae, sharper fissures. Front teeth: narrow neck, cingulum, lingual fossa, labial lobes,
square mesial and rounded distal corner. Preview views: `--view auto|occlusal|front|lingual`.
Still rough: the upper molar's cusps look exaggerated from low side angles; roots are simple cones.
