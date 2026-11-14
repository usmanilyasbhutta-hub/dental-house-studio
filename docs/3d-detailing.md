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
