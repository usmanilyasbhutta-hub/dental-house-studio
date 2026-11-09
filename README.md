# Dental House Studio

Brief-driven marketing video pipeline for **Dental House, Sialkot**: offers, patient education and clinical cases, built with [Remotion](https://remotion.dev) and run from Claude Code.

```
brief (YAML) ──► validate (schema + compliance) ──► render (Remotion) ──► master (−14 LUFS, BT.709)
          ──► QC (specs, loudness, black/frozen frames, contact sheet with safe zones)
          ──► /review (clinical + brand + visual agents) ──► dentist approval ──► /publish-prep
```

## Quick start
```bash
npm install
npm run check                                            # typecheck + tests + validate examples
npm run make -- briefs/examples/offer-implant-consult.yaml   # → out/offer-implant-consult.mp4 + qc/…
npm run studio                                           # visual editor in the browser
```
Needs Node 22+, ffmpeg, Python 3 with numpy and pillow (only for `scripts/*.py`).

## Making a video with Claude Code
- `/new-video offer implant consultation`: Claude interviews you, writes the brief, shows stills, renders and QCs.
- `/make briefs/<file>.yaml`: render + QC + Claude inspects the frames.
- `/review briefs/<file>.yaml`: three reviewer agents (clinical, brand, visual) plus code checks, written to `qc/<id>/review.md`.
- `/publish-prep briefs/<file>.yaml`: caption, hashtags and cover for an **approved** video. It never posts.

## Templates
| Type | Scenes | Length |
|---|---|---|
| `offer` | hook → offer reveal → 1–3 points → validity & terms → end card | 16–20 s |
| `education` | hook → 3 numbered steps → takeaway → sources & disclaimer → end card | 22 s |
| `case` | hook → before → wipe → after → what we did → "results vary" → end card | 20 s |

All examples in `briefs/examples/` are `demo: true` (watermarked). The case example uses a synthetic illustration, not a patient.

## Quality control on three levels
- **Understanding:** the Zod schema (length limits keep text readable), compliance rules (banned claims, patient IDs, unknown phone numbers, expired offers, consent for cases, sources for education) and the `clinical-reviewer` / `brand-reviewer` agents.
- **Code:** TypeScript strict, unit tests, a hook that typechecks after every edit, and CI that renders all three templates on every push.
- **Visual:** `qc/<id>/contact.jpg` (2 frames/s with the platform safe area outlined), which Claude and the `visual-qc` agent read, plus measured specs (resolution, fps, codec, colour range, duration, loudness, true peak, black and frozen frames).

## Brand assets
`brand/source/` holds the original logo JPEGs. `npm run brand:assets` rebuilds the transparent and white PNGs and copies the fonts. Music in `public/audio/` is originally synthesised (`scripts/demo_assets.py`).

## Licensing note
Remotion is free for individuals and small companies; larger companies need a company license. Check [remotion.pro](https://remotion.pro) against your team size.
