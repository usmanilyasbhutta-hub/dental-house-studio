---
name: smile-studio
description: Work on Smile Studio, the Dental House phone app for smile-design mockups (apps/smile-studio, React + canvas PWA). Use for any request to change, extend, run, test, build or explain the smile design app: tooth shapes, proportions, shades, lip mask, face guides, export, offline/PWA, or using it on a phone.
---

# Smile Studio (apps/smile-studio)

On-device smile design mockups for consultations. Read `apps/smile-studio/README.md` first (feature map + code map).

## Rules
- **No network for patient data.** Never add uploads, analytics, cloud sync or third-party AI/3D services that see photos.
  Any ML (e.g. face landmarks) must run on-device with the model shipped inside the app.
- Every export keeps the permanent `WATERMARK` label (`src/render.ts`) and never prints the case label.
- No claims in UI copy (banned list: `src/brief/compliance.ts` in the studio). A simulation is "for discussion".
- Brand tokens mirror `src/brand.ts` (slate/bronze, Oswald / Instrument Serif accent / JetBrains Mono). Change both together.
- Geometry stays pure in `src/geometry.ts` with unit tests in `tests/geometry.test.ts`.

## Workflow
1. `cd apps/smile-studio && npm install` (once).
2. Edit; then `npm run check` (typecheck + tests).
3. Look at it on a phone viewport: start `npx vite --port 5179`, drive it with Playwright
   (`devices['iPhone 13']`, `setInputFiles` on the non-capture file input) using a **synthetic** test face
   drawn with PIL. Never use real patient photos from `public/cases/` for testing. Read the screenshots yourself.
4. `npm run build` → static `dist/`. Hosting it publicly needs the owner's go-ahead.
