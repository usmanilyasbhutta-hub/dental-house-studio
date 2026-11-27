# Earth → Dental House: one continuous zoom (standalone, 9:16)

Owner, 2026-11-26: "Lets first build zoom in from earth to ahsan medical centre separately, involve all agents do plan and execution is
optimised. I want a continuous zoom from earth to my clinic. If i have to use ai generation then i would make it seamless rather an
apparent poor mixture of sattelite images-generated and mobile video, use only one based on other data. I would make ai gen from all
these sources to make a single zoom in." (taste T28, firm)

Planned with five agents: creative-director, Plan (technical + Higgsfield read-only check), editor-reviewer (v8 vs the owner's Gemini
reference), brand-reviewer, clinical-reviewer (ethics/compliance).

## What was wrong with v8 (editor)
In 6.4 s: 1 cut, 1 white-out hiding a scale jump (300 km → 5 km), 4 visual families (Blue Marble, Sentinel, clay, phone video),
4 label pops, 1 camera re-heading, a dead stop. Speed: fast → blind → slow → stopped. The reference instead has one camera, one heading,
one light, a route line visible from frame 0, and a long ease-out that never fully stops.

## Route (Plan + creative-director)
**A. Master in code: one Three.js world, one camera, no cuts** (free, accurate, iterate freely)
- One frame: local metres around the pin; Earth = sphere R 6 371 km under it. Camera altitude falls on a log scale ~25 000 km → ~2 m.
- Ground = one shader on a globe + a 600 km curved cap, sampling an imagery pyramid by lat/lon and crossfading by texel density:
  Blue Marble → pakistan.jpg → **new Sentinel-2 320 m (400 km)** → s2-wide 40 m → s2-city 10 m → street-level ground.
  All levels Lab-colour-matched to s2-city + one shared grade = one family.
- Haze/atmosphere change continuously with altitude (no cloud cut, never full white).
- Buildings grow out of the satellite: roof colours sampled from Sentinel at each footprint, heights rise between ~3 km and ~600 m.
- The real building: a sharp frame of the owner's drive-by clip projected onto the clinic model; the final camera pose = that photo's
  pose, so the last frame *is* the real facade (real signage) inside the same scene. No cut to phone video.
- Overlays in code only (AI never writes text). Per-frame near/far instead of a log depth buffer (software WebGL speed).

**B′. Optional photoreal pass (AI)**: run A's finished render through one AI video-to-video restyle (Higgsfield kling 4.0 video edit,
~45 credits for 12 s at 1080p; 1–2 tries). Motion and geography stay A's. Not plain keyframe-to-keyframe AI (seams, invented city).
Balance today 17.5 credits → needs the owner's top-up and go-ahead. Higgsfield commercial-use/no-watermark terms to be checked.

## Timeline (~12 s standalone; can be retimed to ~7 s inside the Reel)
| Time | Band | Camera / content |
|---|---|---|
| 0–1.5 | Orbit | Earth already turning and descending on frame 0, Pakistan coming to centre |
| 1.5–4.5 | Continent → Punjab | even log-speed; thin border line of constant width, fades before the haze. Label "01 Pakistan" |
| 4.5–6.5 | Punjab → Sialkot | thin haze wisps (≤ 60 %), imagery levels crossfade while moving. Label "02 Sialkot" |
| 6.5–9.5 | City | pitch from straight-down to oblique, heading locks north up Commissioner Road; blocks rise; route line from 6.5 s |
| 9.5–11 | Road | low glide, left-hand traffic, Trauma Centre on the right (small "Opposite · Trauma Centre") |
| 11–12+ | Arrival | slight yaw to square the facade, ease-out with a micro push, pin drops at the steps, card **Dental House** / "in Ahsan Medical Centre · Commissioner Road" |

Labels: one at a time, appear only after their subject is centred, ≥ 1.2 s hold, Roboto 900 ≥ 56 px, inside the safe area.

## Brand (brand-reviewer)
- Pin: slate teardrop, bronze-light rim, paper centre (optionally the logo mark). Never a Google-style pin.
- Route: ivory core + bronze glow (cyan is off-palette and reads as Google navigation). Owner may overrule.
- Natural warm daylight; space as deep blue (standalone) or cream-to-sky when it sits between carousel pages. No logo bug inside the Reel.
- Fix found: pin and arrival-card border use wedding maroon → switch to slate/bronze (maroon only for strike/save/keyword).

## Compliance (clinical-reviewer)
- Building, floors, signs must match the real one; **no invented "DENTAL HOUSE" sign** unless one really exists (owner to confirm).
- Left-hand traffic; Dental House shown as *inside* Ahsan Medical Centre.
- On-screen: "Illustrative · AI-assisted" (if B′) + "© OpenStreetMap contributors"; credits "Contains modified Copernicus Sentinel data
  2026" and NASA. Turn on Meta's "AI info" label if AI is used.
- No Google-derived input; the Gemini clip is a style reference only, never AI input.
- Blur faces/plates in any frame sent to an AI service. No people in scrubs, no ambulances.
- Trauma Centre only as a small landmark; no crest, no implied link. Owner to confirm its exact name and position.
- Human checks: PMDC / Punjab Healthcare Commission advertising rules; "C. Implant" wording on the end card.

## Execution (optimised)
- **Phase 0, parallel, free:** imagery pyramid (S2 320 m) + Lab matching in `scripts/make_realmap.py`; facade frame + 4 corners from
  arrival.mp4 (`src/data/facade.json`); `scripts/zoom_check.py` (per-frame zoom speed, colour continuity).
- **Phase 1:** `src/three/earth.ts`, `src/three/zoomcam.ts`, `src/templates/promo/EarthZoom.tsx`, `briefs/earth-zoom.yaml`
  (standalone composition). v8's DroneMap stays untouched.
- **Checkpoint 1 (owner):** 6 stills: orbit, Pakistan, 60 km, 5 km, 300 m road, final facade.
- **Phase 2:** half-resolution preview + zoom_check. **Checkpoint 2 (owner):** keep A or try B′.
- **Phase 3:** final A render, QC, /review; B′ only after the owner approves the credits.

## Open questions for the owner
1. Is there a real "Dental House" sign outside the building (where)? If not, the name appears only on our card/pin.
2. Ending: (A) the zoom ends on the real facade (projected drive-by frame) and replaces the drive-by shot in the Reel, or (B) the zoom
   ends at the drive-by clip's angle and the Reel cuts to the real footage as a matched cut.
3. Route colour: ivory/bronze (brand) or cyan (your reference)?
4. Sound for the standalone clip: wind + light street sound (music added in the Reel), or the wedding dhol track underneath?

## Owner's answers (2026-11-27)
"Yeah remove c.implant. No need to labeling pak,sialkot its understood. Yeah a pin of dhs logo at ahsan medical centre. Yeah there is
also a real sign, i will show you. Matched cut as ending. As google navigation.light sound. Allama iqbal memorial teaching hospital
emeg ency and trauma centre."
- No place labels on the way down; only the arrival pin + card. Pin = Dental House logo mark at Ahsan Medical Centre.
- Real Dental House sign: waiting for the owner's photo; until then no sign is drawn on the model.
- Ending: matched cut. The zoom ends at the drive-by clip's first-frame angle; the Reel cuts to the real footage.
- Route: blue navigation-style glow (owner's call over the brand reviewer's bronze; no Google logos or pin shapes).
- Sound: light (soft air + distant street ambience, generated).
- Landmark: "Allama Iqbal Memorial Teaching Hospital Emergency and Trauma Centre". "C. Implant" removed from brand.ts.
