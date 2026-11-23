---
name: smile-studio
description: Work on Smile Studio, the Dental House phone app for smile-design mockups (apps/smile-studio, React + canvas PWA). Use for any request to change, extend, run, test, build or explain the smile design app: tooth shapes, proportions, shades, lip mask, face guides, export, offline/PWA, or using it on a phone.
---

# Smile Studio (apps/smile-studio)

On-device smile design mockups for consultations. **Find code with `apps/smile-studio/docs/code-index.md` first** (~2k tokens:
every file's purpose, imports and main symbols as `name:line`), then read only around that line (`sed -n 'L-20,L+60p'`).
All symbols of one file: `python3 scripts/app_index.py --file src/<file>`. Features: `apps/smile-studio/README.md`.

## Rules
- **No network for patient data.** Never add uploads, analytics, cloud sync or third-party AI/3D services that see photos.
  Any ML (e.g. face landmarks) must run on-device with the model shipped inside the app.
- **Labs / ML (round 7):** on-device only, behind the Settings flag `smile-studio.labs.autodetect.v1` (OFF by default).
  With the flag off no new code path runs and no model is fetched. MediaPipe is reached only via the dynamic import in
  `src/labs.ts`; only `src/ai/mediapipe.ts` imports it. Models + wasm are bundled from the app's own origin
  (`npm run models`, pinned SHA-256, licences in `apps/smile-studio/docs/models.md`); never load them from a CDN, never
  precache them. Results are proposals the user confirms (one undo step); failures/timeouts (8 s) fall back calmly.
  Keep `src/ai/guard.ts` and the CSP (`connect-src 'self'`); only `'wasm-unsafe-eval'` was added.
- Every export keeps the permanent `WATERMARK` label (`src/render.ts`) and never prints the case label.
- No claims in UI copy (banned list: `src/brief/compliance.ts` in the studio). A simulation is "for discussion".
- Brand tokens mirror `src/brand.ts` (slate/bronze, Oswald / Instrument Serif accent / JetBrains Mono). Change both together.
- Geometry stays pure in `src/geometry.ts` with unit tests in `tests/geometry.test.ts`.
- Case planner (step 06): the app **records** the dentist's plan, **measures** only what a photo can (colour estimate, labelled
  "Photo estimate: confirm with a shade guide") and **checks** for conflicts. Never auto-assign a material, prep level or
  depth; prep mm are typed in by the dentist from the mock-up. Planner logic stays pure in `src/planner.ts` with every
  warning rule unit-tested in `tests/planner.test.ts` (with its source in the copy). Clinic facts on sheets come from
  `src/clinic.ts` (mirror of the studio's `src/brand.ts`).
- **3D wax-up (round 9, Plan step → "3D wax-up"):** the lab's wax-up STL vs the original scan STL, per case and jaw,
  stored in IndexedDB store `waxups` (never uploaded, never in git: `*.stl` is gitignored). Engine is pure in
  `src/waxup.ts` (STL parse/weld, PCA + trimmed ICP on unchanged areas, signed distance with rim/base/facing exclusions,
  per-tooth mm along the arch); it runs in `src/waxupWorker.ts`. `src/WaxupView.tsx` (three.js, lazy chunk) shows
  Before / Wax-up / Changes, Front / Occlusal / Side, tap-to-read mm and "Save image". Tooth numbers are **estimates**
  (mean widths from the midline; dentist can shift / swap sides) and are always shown with "≈". The values never fill
  the plan's prep mm automatically. Tests use synthetic meshes only (`tests/waxup.test.ts`, `e2e/make_arch_stl.cjs`).

## Workflow
1. `cd apps/smile-studio && npm install` (once).
2. Edit; then `npm run check` (typecheck + tests).
3. Look at it on a phone viewport: start `npx vite --port 5179`, drive it with Playwright
   (`devices['iPhone 13']`, `setInputFiles` on the non-capture file input) using a **synthetic** test face
   drawn with PIL. Never use real patient photos from `public/cases/` for testing. Read the screenshots yourself.
4. `npm run build` → static `dist/`. Hosting it publicly needs the owner's go-ahead.
