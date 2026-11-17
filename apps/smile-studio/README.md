# Smile Studio · Dental House

A phone-first **smile design mockup** app for consultations at Dental House, Sialkot.
Take a smiling photo, set the face lines, outline the lips, and try tooth shapes, proportions
and shades on the patient's own face. Then compare and share a labelled simulation.

It is a web app (PWA): open it in the phone browser, then **Add to Home Screen** and it works
like an installed app, offline too. **Photos never leave the phone.** There is no server, no
upload and no analytics. Cases live in the browser's on-device storage (IndexedDB).

## How it works (5 steps)

| Step | What you do | Why |
|---|---|---|
| 01 Face | Drag dots onto both pupils and the facial midline | Sets the horizontal reference (inter-pupillary line) and the midline |
| 01 Level (close-up) | For a mouth-only photo (e.g. from the gallery), pick **Smile close-up**: dots go on the mouth corners and the dental midline | Fallback level when the eyes are not in the photo (pupils are better when available) |
| 02 Lips | Drag 12 dots onto the inner edge of the lips | The new teeth are drawn only inside this line, so the lips stay in front |
| 03 Teeth | Pick shape, proportion and count; drag to move / widen / lengthen | Builds the 6–10 tooth design along a smile arc, levelled to the pupils |
| 04 Shade | Pick a shade tab, set blend | Screen preview only; the real shade is taken in the chair |
| 05 Compare | Slide between now / simulation; optional mm calibration; share | Exports carry a permanent "Smile simulation · for discussion only" label |

"Hold: before" (top right) shows the untouched photo while pressed.

## Feature map (what smile-design apps do, rebuilt from scratch)

The typical digital smile design workflow, reimplemented in our own code (no third-party code,
templates or artwork):

- **Facial reference lines**: inter-pupillary line, facial midline, incisal plane parallel to the pupils,
  cant read-out (tilt vs pupil line) and midline deviation.
- **Tooth library**: 4 parametric shapes (square, oval, triangular, soft square) drawn from a
  width profile with a scalloped gum line, distal gingival zenith on centrals/canines, canine cusp,
  narrower premolars; 6, 8 or 10 teeth.
- **Proportions**: Golden (1.618 : 1 : 0.618), RED 70 % and Natural averages (lateral ≈ 66 %
  of central, canine ≈ 84 % of lateral). Live width table per tooth.
- **Central width/length ratio** (65–95 %, default 80 %), **smile arc**, **lateral step**, fine tilt.
- **Lip mask** so the mockup sits behind the lips.
- **Rendering**: cervical-to-incisal shading, incisal translucency, convexity, line-angle highlight,
  buccal-corridor darkening for back teeth; or a plain **outline** view (like a wax-up template).
- **Before/after slider**, **mm calibration** from a known central width, **PNG export**
  (single or side by side, same box, no crop or warp) via the phone's share sheet.
- Pinch-zoom / pan, 44 px+ touch targets, safe-area aware, tablet layout ≥ 900 px.

## Rules this app keeps (from the studio's golden rules)

- Patient photos stay on the device. Nothing is uploaded, and photos are re-encoded on import,
  which strips EXIF/GPS metadata.
- Exports never include the case label, and always carry the simulation label.
- The case label is for the clinic's own use: use initials or a code, not a patient's name or file ID.
- No claims in the UI ("guaranteed", "perfect", "painless"…). A simulation is a discussion aid, not a promise.
- Brand: slate/bronze, Oswald + Instrument Serif accent + JetBrains Mono, white logo on dark.

## Run it

```bash
cd apps/smile-studio
npm install
npm run dev        # opens on your LAN too: visit the "Network" URL from your phone (same Wi-Fi)
npm run check      # typecheck + unit tests (geometry, proportions, measurements)
npm run build      # static site in dist/ (works from any folder or static host)
```

Camera access (the **Take photo** button) needs HTTPS or `localhost`. Over plain LAN http, use
**Choose photo** and pick a photo from the camera roll, or host the `dist/` folder on HTTPS.

## Code map

| File | Purpose |
|---|---|
| `src/model.ts` | Types (guides, lips, design, case) and default layout |
| `src/geometry.ts` | Pure maths: proportions, tooth boxes, outlines, transforms, measurements (unit-tested) |
| `src/render.ts` | Canvas drawing of teeth, guides, handles; export image |
| `src/shades.ts` | Shade tabs (approximate screen colours) |
| `src/Stage.tsx` | Interactive canvas: drag handles, pan, pinch-zoom, compare divider |
| `src/Editor.tsx` | The 5-step editor and controls |
| `src/Home.tsx` | Start screen: take/choose photo, saved cases |
| `src/storage.ts` | IndexedDB cases, photo import (EXIF orientation, resize, metadata strip) |
| `public/sw.js` | Offline cache for the app shell |

## Ideas for later

- Optional on-device face landmarks (MediaPipe, model bundled with the app) to place pupils, midline and lips automatically.
- Per-tooth edits (length, width, rotation of a single tooth) and a gum-line (gingivectomy) preview.
- Lower arch, and a library of tooth outlines traced by our own dentists.
- Export the design as a PDF consult sheet with measurements.
