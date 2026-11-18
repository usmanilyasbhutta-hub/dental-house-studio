# On-device models (Labs · Auto-detect beta)

Used only when **Settings › Labs › Auto-detect (beta)** is on (off by default). Everything runs on the phone; the files
are served from the app's own origin (`public/models/` → `dist/models/`). They are **not** in the service-worker
precache (about 25 MB, and with the flag off nothing of the beta may be downloaded). The service worker caches them in
`smile-studio-labs-<hash>` the first time the beta is used. `npm run models` (also run before `npm run build` and
`npm run e2e`) copies the wasm runtime from `node_modules` and downloads the models from storage.googleapis.com at
**build time only**, verifying the SHA-256 below. Never point the app at a remote model URL.

| File | What | Version / source URL | Licence (official model card) | Size | SHA-256 |
|---|---|---|---|---|---|
| `face_landmarker.task` | MediaPipe Face Landmarker bundle: BlazeFace short-range detector + Face Mesh V2 (478 landmarks incl. irises) + Blendshape V2 (not used) | float16 / v1: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task (same bytes as `latest` on 2026-11-18) | Apache License 2.0: [Face Mesh V2](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf), [BlazeFace short range](https://storage.googleapis.com/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20(Short%20Range).pdf), [Blendshape V2](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Blendshape%20V2.pdf) | 3,758,596 B | `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff` |
| `magic_touch.tflite` | MediaPipe Interactive Segmenter "MagicTouch" (keypoint prompt) | float32 / v1: https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite (same bytes as `latest`) | Apache License 2.0: [MagicTouch model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MagicTouch.pdf) (dated Mar 13, 2023) | 6,227,884 B | `e24338a717c1b7ad8d159666677ef400babb7f33b8ad60c4d96db4ecf694cd25` |
| `wasm/vision_wasm_internal.{js,wasm}` | MediaPipe Tasks Vision runtime | npm `@mediapipe/tasks-vision@1.2.3` (pinned exactly) | Apache-2.0 (package.json `license`) | 336,624 B + 14,665,716 B (≈ 4.2 MB gzip) | js `2aa5fd3f…6a6309`, wasm `225bc06c…6daabf` |

Notes from the model cards (read 2026-11-18):
- All three cards state **"Licensed under Apache License, Version 2.0"**, which permits commercial use; keep the licence
  notice with redistributions.
- All say the models are **not intended for life-critical decisions** and were built mainly for AR / entertainment / photo
  editing. Smile Studio uses them only to **suggest** dot positions and tooth outlines that the clinician checks and
  confirms; the app never makes a clinical decision from them. Face Mesh does not do face recognition and the app keeps
  no face representation (landmarks live in memory only, per photo).
- MagicTouch: "human segmentation that is not consented to … is out of scope". The app already records photo consent
  before any photo is taken.

Privacy: `@mediapipe/tasks-vision` contains a usage logger that POSTs anonymous task statistics to
`odml.pa.googleapis.com`. Smile Studio blocks it twice: `src/ai/guard.ts` refuses every request to another host once the
beta loads, and the built app's CSP (`connect-src 'self'`) blocks it too. The e2e suite checks that no request leaves the
app origin with the flag on.
