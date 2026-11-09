# Animation & footage toolkit

Everything here is free: open-source packages, code-built models, code-generated sound. Claude uses it through the
project skill `.claude/skills/dental-animation/SKILL.md`.

## Installed packages (npm, free)
| Package | What we use it for |
|---|---|
| `remotion`, `@remotion/*` | video engine; transitions, noise, paths, shapes, motion-blur, three, lottie |
| `three`, `@react-three/fiber` (MIT) | 3D procedure explainers (`src/three/dental.tsx`, `src/templates/Procedure.tsx`) |
| `lottie-web` via `@remotion/lottie` | licensed Lottie animations (`src/fx/LottieClip.tsx`, files in `public/lottie/`) |
| ffmpeg 6.1 (system) | footage recipes (`npm run ff`); has vidstab, lut3d, zoompan, xfade, subtitles, afftdn, loudnorm |
| numpy, opencv, onnxruntime (Python) | footage cut-out (u2net) and sound-effect generation |

## Templates for education
| `type` | Shows |
|---|---|
| `procedure` | 3D illustration of a treatment, step by step (implant, crown; more can be added) |
| `photo-layout` | annotate (pins, circles, arrows, loupe), split (2), grid (2–4) |
| `anatomy-map` | reference-"I" layout: full-frame photo, traced outlines that draw on, hatch / colour zones / ridge ticks, two-weight edge labels with curved hairline leaders, chapters that cross-fade (e.g. preparation → final anatomy) |
| `education`, `talking-head`, `case`, `offer` | see README |

Examples: `briefs/examples/procedure-*.yaml`, `briefs/examples/photo-*.yaml`.

## ffmpeg recipes (`npm run ff -- help`)
`reframe` (any → 9:16, blurred fill or crop) · `stabilize` (vidstab, two passes) · `denoise` · `clean-audio` (speech, −14 LUFS) ·
`grade` (presets neutral / warm / clinical / skin-fix / brand, or `--lut file.cube`) · `kenburns` (still → video) · `speed` ·
`gif` · `frames` · `thumb` · `concat` (with `--xfade`) · `burn-subs` (SRT, Oswald) · `compress` (WhatsApp size).
All 13 were tested on real clinic footage (Nov 2026).

## Free sources, if we need more (always check the licence first)
- **3D anatomy models:** Poly Haven (CC0); BodyParts3D (CC BY-SA, needs attribution). Sketchfab: per-model licence, so
  only use ones that allow commercial use. Our own procedural models need none of this.
- **LUTs:** make our own `.cube` in any grading app, or use free ones with commercial-use licences.
- **Lottie:** in-house, purchased, or explicitly free for commercial use. Keep a `.source.txt` next to each file.

## Roadmap ideas
Root canal, filling, bridge, aligner and extraction stages; gum-disease progression (healthy → gingivitis → periodontitis)
as a 3D cut-away; brushing-technique animation; GLB import for detailed anatomy once we have a licensed model.
