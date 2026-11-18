# Smile Studio · Dental House

A phone-first **smile design mockup** app for consultations at Dental House, Sialkot.
Take a smiling photo, set the face lines, outline the lips, and try tooth shapes, proportions
and shades on the patient's own face. Then compare and share a labelled simulation.

It is a web app (PWA): open it in the phone browser, then **Add to Home Screen** and it works
like an installed app, offline too. **Photos never leave the phone.** There is no server, no
upload and no analytics. Cases live in the browser's on-device storage (IndexedDB).

## How it works (6 steps)

| Step | What you do | Why |
|---|---|---|
| 01 Face | Drag dots onto both pupils and the facial midline | Sets the horizontal reference (inter-pupillary line) and the midline |
| 01 Level (close-up) | For a mouth-only photo (e.g. from the gallery), pick **Smile close-up**: dots go on the mouth corners and the dental midline | Fallback level when the eyes are not in the photo (pupils are better when available) |
| 02 Lips | Drag 12 dots onto the inner edge of the lips | The new teeth are drawn only inside this line, so the lips stay in front |
| 03 Teeth | **Fit to teeth** (tap both canine tips), or pick shape, proportion and count and drag to move / widen / lengthen | Builds the 6–10 tooth design along a smile arc, levelled to the pupils |
| 04 Shade | Pick a shade tab, set blend | Screen preview only; the real shade is taken in the chair |
| 05 Compare | Slide between now / simulation; optional mm calibration; share | Exports carry a permanent "Smile simulation · for discussion only" label |
| 06 Plan | Record the treatment plan: shade gap, teeth chart, flags + checklist, warnings, lab prescription | The app records the dentist's decisions and checks them; it never chooses a material, prep or depth |

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

## Case planner (step 06 Plan)

For cases such as lower veneers matched to existing upper ceramic: the dentist records the plan, the app measures what
a photo can measure (a colour estimate) and checks the recorded plan for conflicts. Four tabs:

- **Shade**: *Pick reference* (e.g. an upper crown) and *Pick tooth to match*, then tap the photo. Pins are draggable (with
  the loupe). Each pin is the median CIELAB of a small disk with highlights (L* > 93) and dark pixels rejected. Shows both Lab
  values, ΔE00 (CIEDE2000) against the Paravina 2015 thresholds (perceptibility 0.8, acceptability 1.8; PMID 25740131),
  the dominant component (value / chroma / hue) with neutral wording, the nearest tab (approximate), target tab and
  whitening toggles. Every result says "Photo estimate: confirm with a shade guide".
- **Teeth**: arch-shaped FDI chart (upper and lower; front six and premolars, molars on request). Tap = in / out of the plan;
  long-press (or the list under the chart) opens the tooth sheet: visible (smile / speech), material (library), prep level,
  coverage options for the tooth type, margin, prep mm **entered from the mock-up** (never computed), notes, with the
  planning disclaimer. *Apply to selected* edits all planned teeth at once. The design arch's front six are suggested.
- **Checks**: deep bite, bruxism, recession; checklist (perio stable, hygiene, whitening + 2 weeks, shade guide, wax-up,
  mock-up approved, phonetics/occlusion, consent, night guard).
- **Review**: summary ("33–43, 6 teeth · …"), warnings (stop / caution / info with tooth tags; rules in `src/planner.ts`,
  sources in the copy), and the hand-off sheets: **Lab prescription** (A4: teeth, material, prep + mm entered, coverage,
  margins, shade target + photo-estimate note, lower-shade note, mock-up reference, blank return lines, clinic name/phone)
  and the **Prep sheet**, which now carries a Plan section. No patient name or ID; the case code only with the opt-in toggle.
- **Clinic materials** (Plan step and Home): add a name + category, delete; kept on this phone (localStorage) and merged with
  the built-in library.

## Round 6: fit to teeth, shade sample quality, hidden areas

- **Fit to teeth** (Teeth step; also offered as a chip right after switching to Lower): tap the tip of the patient's
  right canine (image left), then the left canine, with the loupe. The template's width comes from the tap span (exact
  factor from `toothBoxes`, so the canine boxes sit under the taps), the tilt from the tap line vs the pupil / mouth-corner
  line, the centre from the midpoint on the incisal line. The existing-teeth mask then sets the central W/L from the
  clinical crown height (within the arch's range; columns cut by the lip line are skipped) and moves the centrals onto a
  visible central gap (at most 0.3 × central width). An unclear mask keeps the tap result. Pins stay draggable;
  *Include premolars* sets 6 / 10 teeth; one undo step. Logic: `src/fit.ts`, tests: `tests/fit.test.ts`.
- **Shade pins**: the ring is the real sampled disk (Small / Medium, scaled to the planned central width). Only mask
  tooth pixels are sampled; gum-like (a* high), dark/shadow (L* < 45 or 15 below the sample) and specular pixels are
  rejected. Over 30 % rejected or a wide L*/b* spread: amber pin and "This spot includes gum or shadow; move the pin onto
  the middle third of the tooth.", an info warning, and the pin is left out of the whitening check (`sampleLabQ`).
- **Prep map**: planned lower outline behind the upper teeth (normal overbite) is hatched grey, "Hidden behind the upper
  teeth — not measurable", excluded from added / reduced. Teeth with > 20 % hidden report no length change
  (`ToothPrep.hiddenPct`, "Partly hidden behind the upper teeth: length not measurable from this photo."). For the upper
  arch only the analysis' own occlusal-curve rule applies (lower teeth sit behind the upper ones).
- Toasts are a short capsule under the top bar (over the photo, never over the controls or the tab bar), 2.2 s.
- Test images are synthetic: `e2e/make_face.py` and `e2e/make_bite.py` (retracted bite with overbite and recession).

## Labs: Auto-detect (beta, round 7)

Off by default. Turn it on in **Home › Settings (gear) › Labs › Auto-detect (beta)** (stored on this phone in
localStorage). With it off the app is exactly as before: no Labs controls, no Labs code or model files downloaded.

- **Face (step 01):** *Auto-detect points* runs MediaPipe Face Landmarker on the photo. Full face: dots on the iris
  centres and the facial midline (median of the midline landmarks, placed at the philtrum). Close-up with a face found:
  mouth corners + a dental-midline estimate. No face (most close-ups / retractor photos): "No face found…", place the
  dots by hand.
- **Lips (step 02):** *Auto-detect lip line* turns the inner-lip landmark loop into the usual 12 dots (same order as
  `defaultLips`: image-left corner, over the top, clockwise).
- **Existing teeth:** Brush gains *Tap a tooth* / *Erase tooth* (MediaPipe Interactive Segmenter "MagicTouch", keypoint
  prompt, on a crop around the tap, clipped to the lip line) and *Outline all front teeth* (taps the template's six front
  teeth). The orange tint is the proposal.
- Every result is a **proposal** (hollow ghost dots or an orange tint) with *Use these points* / *Use this outline*,
  *Try again*, *Cancel*. Nothing changes until you confirm; each confirm is one undo step.
- Any load or inference failure, or no answer within 8 s: "Auto-detect isn't available on this phone; you can place the
  dots by hand." The manual flow carries on and the case is untouched.
- Everything runs on the phone. Models and the wasm runtime are served from the app's own site (`npm run models`, see
  `docs/models.md` for versions, licences and SHA-256). They are cached on first use and are not in the precache. The
  CSP adds only `'wasm-unsafe-eval'`. Accuracy on real patient photos has **not** been checked yet: it was tested only on
  the synthetic images.
- Code: `src/labs.ts` (flag + lazy loader, in the main bundle), `src/ai/assist.ts` (lazy entry), `src/ai/mediapipe.ts`
  (the only file that imports MediaPipe), `src/ai/map.ts` (pure mapping + mask merge, `tests/ai.test.ts`),
  `src/ai/guard.ts` (blocks requests to other hosts).

## Rules this app keeps (from the studio's golden rules)

- Patient photos stay on the device. Nothing is uploaded, and photos are re-encoded on import,
  which strips EXIF/GPS metadata.
- Exports never include the case label, and always carry the simulation label.
- The case label is for the clinic's own use: use initials or a code, not a patient's name or file ID.
- No claims in the UI ("guaranteed", "perfect", "painless"…). A simulation is a discussion aid, not a promise.
- Brand: slate/bronze palette as semantic tokens, white logo on dark. UI follows Apple HIG (round 5, taste T14): system font, sentence case, segmented controls, switches, grouped inset lists, bottom sheets with grabber, tab bar on phones / step sidebar on iPad and landscape. Oswald + Instrument Serif accent only for brand moments (Home hero, onboarding title, exported sheets).

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
| `src/fit.ts` | Fit to teeth: template from two canine taps + mask refinement (unit-tested) |
| `src/render.ts` | Canvas drawing of teeth, guides, handles; export image |
| `src/shades.ts` | Shade tabs (approximate screen colours) |
| `src/Stage.tsx` | Interactive canvas: drag handles, pan, pinch-zoom, compare divider |
| `src/Editor.tsx` | The 6-step editor and controls |
| `src/planner.ts` | Case planner logic: CIELAB sampling, ΔE76/ΔE00, shade gap, tabs, materials library, FDI helpers, plan warnings, summary (unit-tested) |
| `src/PlanPanel.tsx` | Step 06 UI: shade card, FDI chart + tooth sheet + bulk edit, flags/checklist, warnings, clinic materials editor |
| `src/sheets.ts` | A4 sheets: clinician prep guide (+ plan section), patient sheet, lab prescription |
| `src/clinic.ts` | Clinic facts printed on sheets (mirrors `clinic` in the studio's `src/brand.ts`) |
| `src/Home.tsx` | Start screen: take/choose photo, saved cases |
| `src/storage.ts` | IndexedDB cases, photo import (EXIF orientation, resize, metadata strip) |
| `public/sw.js` | Offline cache for the app shell |

## Ideas for later

- Validate Labs auto-detect on consented clinic photos before taking it out of beta.
- Per-tooth edits (length, width, rotation of a single tooth) and a gum-line (gingivectomy) preview.
- Lower arch, and a library of tooth outlines traced by our own dentists.
- Export the design as a PDF consult sheet with measurements.
