---
name: dental-animation
description: Make dental procedure animations (3D implant/crown explainers), general dental education graphics, and annotated layouts on photos for Dental House, or process clinic footage with ffmpeg. Use for any request about procedure animation, tooth/implant 3D, explaining a treatment visually, annotating or arranging photos, carousel stills, or editing/repairing clinic video files.
---

# Dental animation toolkit (Dental House Studio)

Pick the tool by the request, then follow CLAUDE.md (brief → validate → stills → make → QC → /review).

| Request | Use | Where |
|---|---|---|
| "Show how an implant / crown works" | brief `type: procedure` (`procedure: implant\|crown`) | `src/templates/Procedure.tsx`, models in `src/three/dental.tsx` |
| New procedure (root canal, filling, bridge, aligners, extraction, veneer) | add a stage list to `PROCEDURE_STAGES` + a `<XStages>` component composing `Tooth`, `Crown`, `Implant`… | load skills `threejs-skills:threejs-geometry`, `threejs-skills:threejs-materials`, `threejs-skills:threejs-animation` first |
| Explain a photo (point at gum line, gap, shade) | brief `type: photo-layout`, `layout: annotate` (+ `loupe`) | `src/templates/PhotoLayout.tsx` |
| "Layout like the Class II video": traced outlines, hatch/colour zones, edge labels with hairline leaders, chapters | brief `type: anatomy-map` (scenes → regions; `units: px` lets you trace in photo pixels) | `src/templates/AnatomyMap.tsx`, example `briefs/examples/anatomy-map.yaml` |
| Before/after, comparison, 2–4 photos | `layout: split` / `grid` | same |
| Carousel / static post | any brief → `npm run still -- <brief> --frame N` (one PNG per key frame) | `scripts/render.ts` |
| Doctor explains on camera | `type: talking-head` | docs/talking-head.md |
| Short education with steps/numbers | `type: education` + effects (`Highlighter`, `CountUp`, `DrawCircle`) | docs/effects.md |
| Fix/convert footage (vertical, shaky, noisy, audio, grade, GIF, join) | `npm run ff -- <recipe>` | `scripts/ff.ts`, `npm run ff -- help` |
| Creator-style effects on doctor footage (orbit, frame break, phone mockup, pull-back, green screen, vertigo, cover story, glass type, doodles…) | `src/fx/footage.tsx` (17 effects), gallery `FootageFxGallery` | docs/effects.md |
| Quick stills of any composition | `npx tsx scripts/stills.ts <CompositionId> <dir> <frame…>` (one bundle) | |
| Photoreal 3D (Blender/Cycles) | `pip install bpy==5.2.3` works here (no GPU: ~8.5 s/frame at 540×960) | render frames, assemble in Remotion |
| Animated icon/diagram someone supplies as Lottie | `<LottieClip file="x.json" />` | `src/fx/LottieClip.tsx` (licence must allow commercial use) |

## Rules for clinical honesty (non-negotiable)
- **Never infer a diagnosis or treatment stage from a photo.** Ask the dentist what it shows (e.g. "carious, after cavity
  preparation" was once mislabelled as "fractured"). Labels describe only what the dentist confirmed.
- 3D procedure videos are **illustrations**: keep the "Illustration · not to scale" label; no claims of outcome, pain or duration beyond what a dentist approved.
- Photos: contain-fit only; never retouch, warp, sparkle, glow or light-leak a clinical photo. Annotations (lines, labels, loupe) are fine.
- Patient photos need `clinical: true` and consent (the validator enforces it).
- Quote YAML text containing commas inside `{ }` (the validator rejects comma splits).

## Tracing regions for an anatomy map
**Never eyeball tooth outlines** (the owner caught inaccurate cervical margins). Measure them from the photo:
`python3 scripts/trace_regions.py <photo> '[{"name":"11","box":[x0,y0,x1,y1]}, …]' --preview out.png`
- `tooth` mode separates enamel from gingiva by colour (Lab a*/b*), so cervical margins follow the real gumline;
  `dark` traces gaps/missing structure; `gum` traces gingiva.
- Put box edges on the interproximal contacts (touching neighbours merge otherwise); crown margin at the top of the box.
- Zoom the preview at the gumline and incisal edge before using the points; refine boxes, not points.
Hand-placed points are only for things colour can't find (e.g. a planned outline), and must be checked the same way.
The template smooths points with a Catmull-Rom curve. Then render stills at each region's beat with `--safe-zones` and check the
outlines sit on the anatomy; adjust points and re-render. Styles: `outline`, `hatch` (cavity/prep), `fill` + `color` 1–6
(cusps/zones), `ridge` (open line with ticks: marginal ridge, margin). At most 4 labels per scene; anchors are the four corners.

## 3D notes (Remotion + three.js)
- Drive every motion from `useCurrentFrame()` → props. Never `useFrame`/clock: renders must be deterministic.
- Don't use helpers that download at render time (drei `Text`, `Environment` presets, remote GLTF/HDRI). Lights are in `DentalLights`.
- Metals render dark without an env map: keep metalness ≈ 0.5–0.6 (see `MAT.titanium`).
- Renders use software WebGL (`chromiumOptions.gl = "swangle"` in scripts/render.ts): slower but works everywhere.
- Detailed anatomical models (GLB) are allowed only with a licence that permits commercial use; record the source. Load with
  `useLoader(GLTFLoader, staticFile("models/x.glb"))` after reading `threejs-skills:threejs-loaders` / `threejs-asset-pipeline`.

## Other installed skills worth calling
- `procedural-foley`: code-made sound effects synced to animation (we already have `public/sfx`, `scripts/make_sfx.py`).
- `photo-to-video-2p5d`: 2.5D motion from a still clinic/product photo (not for clinical before/after).
- `story-animator`: narrated 2D animated stories for **kids' dental education** (Remotion, drawn in code).
- `motion-design`: timing/easing review of any new animation.
- `dataviz`: charts for statistics (e.g. prevalence), in brand colours.
- `hyperframes:hyperframes-registry`: ~450 ideas for transitions/kinetic type; port ideas to Remotion, don't mix engines.
- `design-dna`: extract a style profile from new reference videos/images.
- Blender MCP (`mcp-for-blender`): only if the owner runs Blender locally; can model/render teeth and import CC0 assets.
