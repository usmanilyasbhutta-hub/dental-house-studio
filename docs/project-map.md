# Project map (generated: `python3 scripts/project_map.py`; do not edit by hand)

143 source files, about 175,379 tokens if read in full. **Read this map first and open only the files a task needs;**
for big files, search (`grep -n`) and read the relevant lines instead of the whole file.

## Where to look

- **Brief types (12)**: offer, education, case, talking-head, procedure, photo-layout, anatomy-map, map-route, blueprint, receipt, sketch, diagram. Contract: `src/brief/schema.ts`; rules: `src/brief/compliance.ts`;
  duration: `src/brief/timing.ts`; template switch: `src/Video.tsx` → `src/templates/<Type>.tsx`; examples: `briefs/examples/`.
- **Effects**: catalogue and rules `docs/effects.md`; code `src/fx/` (effects.tsx 1–18, footage*.tsx 19–50, looks.tsx, reel3.tsx).
- **3D**: three.js `src/three/`; Blender `scripts/blender/` (modelgen = text → 3D, directions = looks, composite_clip).
- **Taste and decisions**: `docs/taste.md` (read before creative choices), `docs/style-profile.md`, `docs/style-recipes.md`.
- **Brand and clinic facts**: `src/brand.ts` only. Themes: `src/theme.ts`.
- **npm scripts**: `studio`, `validate`, `render`, `still`, `qc`, `make`, `typecheck`, `test`, `check`, `brand:assets`, `prep`, `gallery`, `sfx`, `ff`, `map`.

## Files

`~tok` = rough tokens to read the whole file. ⚠ = over 4k tokens: grep it, don't read it whole.

### (root)
- `.gitignore` ~102tok: —
- `CLAUDE.md` ~2369tok: Dental House Studio: instructions for Claude
- `README.md` ~900tok: Dental House Studio
- `package.json` ~506tok: —
- `remotion.config.ts` ~45tok: —
- `tsconfig.json` ~100tok: —

### .claude
- `.claude/settings.json` ~208tok: —

### .claude/agents
- `.claude/agents/brand-reviewer.md` ~200tok: Reviews a Dental House brief's copy and settings against the brand voice and rules. Use before approval or when draft…
- `.claude/agents/clinical-reviewer.md` ~389tok: Reviews a Dental House video brief for clinical accuracy, evidence, advertising ethics, consent and patient privacy. …
- `.claude/agents/creative-director.md` ~515tok: Makes the creative decisions for a Dental House video the way the owner would (look, hook, pace, effects, sound, leng…
- `.claude/agents/editor-reviewer.md` ~490tok: Reviews a rendered Dental House video the way a viewer and an experienced social-video editor would (hook, pacing, re…
- `.claude/agents/visual-qc.md` ~329tok: Inspects rendered frames of a Dental House video (contact sheet + frames + QC report) for visual defects. Use after e…

### .claude/commands
- `.claude/commands/make.md` ~134tok: Validate, render, master and QC a brief, then visually inspect the result
- `.claude/commands/new-video.md` ~414tok: Interview me, write a brief, preview stills, then render + QC a new video
- `.claude/commands/options.md` ~397tok: Propose 2–3 creative directions for a video (with preview stills) so the owner can choose without editing expertise
- `.claude/commands/publish-prep.md` ~207tok: Prepare captions, hashtags and a cover still for an approved video (does not post)
- `.claude/commands/review.md` ~214tok: Full 3-level review (understanding, code, visual) of a video before dentist approval
- `.claude/commands/taste.md` ~376tok: Tell Claude what you like or don't (or see what it currently believes about your taste and correct it)

### .claude/hooks
- `.claude/hooks/after-edit.sh` ~142tok: After Claude edits a file: typecheck code, validate briefs. Exit 2 feeds errors back to Claude.
- `.claude/hooks/guard-bash.sh` ~138tok: Block commands that could leak patient material into git or the public bundle.

### .claude/skills
- `.claude/skills/dental-animation/SKILL.md` ~1536tok: Make dental procedure animations (3D implant/crown explainers), general dental education graphics, and annotated layo…

### .github/workflows
- `.github/workflows/ci.yml` ~215tok: —

### briefs
- `briefs/2026-11-bleeding-gums-talking-head.yaml` ~915tok: TEST RUN: talking-head from a compressed Instagram copy (the only copy available).
- `briefs/2026-11-caries-11-21-map.yaml` ~708tok: Anatomy map of a real case: carious upper central incisors (11, 21), photographed after cavity preparation.
- `briefs/2026-11-composite-11-21-procedure.yaml` ~312tok: 3D illustration (three.js): composite restoration of carious 11/21, mesial. Generic products only (owner, Nov 2026).

### briefs/examples
- `briefs/examples/anatomy-map.yaml` ~591tok: EXAMPLE anatomy map (layout of reference "I"): synthetic molar illustrations, not a patient.
- `briefs/examples/blueprint-implant.yaml` ~124tok: Blueprint (reference: blueprint-style reel). Drawn in code, illustration only, not to scale.
- `briefs/examples/blueprint-tooth.yaml` ~98tok: Blueprint of a molar in section: labels only, no claims. Illustration, not to scale.
- `briefs/examples/case-demo-spacing.yaml` ~208tok: EXAMPLE case brief using SYNTHETIC illustrations (not a patient). Real cases need:
- `briefs/examples/diagram-cycle.yaml` ~117tok: The cavity cycle (demo)
- `briefs/examples/diagram-flowchart.yaml` ~103tok: Toothache: what to do (demo)
- `briefs/examples/diagram-iceberg.yaml` ~115tok: A cavity is an iceberg (demo)
- `briefs/examples/diagram-infographic.yaml` ~135tok: Brushing by the numbers (demo)
- `briefs/examples/diagram-layers.yaml` ~124tok: Layers of a tooth (demo)
- `briefs/examples/diagram-matrix.yaml` ~112tok: Which treatment when (demo)
- `briefs/examples/diagram-roadmap.yaml` ~125tok: Braces roadmap (demo)
- `briefs/examples/diagram-timeline.yaml` ~226tok: Diagram explainer, layout: timeline. Demo: steps are general; a dentist confirms the wording for a real video.
- `briefs/examples/diagram-tree.yaml` ~113tok: Replacing a missing tooth (demo)
- `briefs/examples/education-bleeding-gums.yaml` ~292tok: EXAMPLE education brief. Every claim must be backed by `sources` (checked by the clinical-reviewer agent).
- `briefs/examples/map-route.yaml` ~224tok: Map route (reference: "map-route" reel). The city is DRAWN, not a real map: grid, buildings and river are procedural.
- `briefs/examples/offer-implant-consult.yaml` ~194tok: EXAMPLE offer brief. demo: true -> watermarked; replace with a real offer and set demo: false.
- `briefs/examples/photo-annotate.yaml` ~184tok: EXAMPLE photo layout: annotate one photo (synthetic illustration, not a patient).
- `briefs/examples/photo-split.yaml` ~138tok: EXAMPLE photo layout: split comparison (synthetic illustrations, not a patient).
- `briefs/examples/procedure-crown.yaml` ~184tok: EXAMPLE 3D procedure explainer (illustration, not to scale). demo: true -> watermarked.
- `briefs/examples/procedure-implant.yaml` ~208tok: EXAMPLE 3D procedure explainer (illustration, not to scale). demo: true -> watermarked.
- `briefs/examples/receipt.yaml` ~193tok: Receipt (reference: "/receipt" reel). Values are PLACEHOLDERS: prices are clinic facts, so a real video uses the
- `briefs/examples/sketch-bleeding-gums.yaml` ~317tok: Hand-drawn explainer (reference: "Hand-Drawn Explainer" reel). Doodles: see src/fx/doodles.ts / docs/effects.md.

### docs
- `docs/3d-detailing.md` ~1586tok: 3D detailing: Tripo + Blender pipeline
- `docs/animation-toolkit.md` ~668tok: Animation & footage toolkit
- `docs/content-calendar.csv` ~99tok: —
- `docs/effects.md` ~4145tok ⚠: Effects library
- `docs/how-to-use.md` ~491tok: How to use Dental House Studio (owner's guide)
- `docs/review-process.md` ~448tok: Review process (who reviews what)
- `docs/roadmap.md` ~381tok: Roadmap: from assisted to automated
- `docs/style-profile.md` ~2013tok: Dental House: editing style profile (v1)
- `docs/style-recipes.md` ~1171tok: Style recipes (our own)
- `docs/talking-head.md` ~401tok: Talking-head videos
- `docs/taste.md` ~2101tok: Dental House: taste ledger

### scripts
- `scripts/analyze_reference.py` ~1586tok: Measure reference videos to learn an editing style. · exports: run, probe, cuts, frames, colour_stats, audio_stats, sheet, main
- `scripts/autograde.py` ~866tok: Automatic colour correction ("one-click grade" idea, our own code, local). · exports: sample, main
- `scripts/beats.py` ~827tok: Beat and onset finder (librosa idea, our own numpy code): where the beats are in a music track, so cuts land on them. · exports: load, onset_envelope, tempo, track, main
- `scripts/brand_assets.py` ~407tok: Build transparent brand PNGs from the source JPEGs (logo on white). · exports: to_rgba, save
- `scripts/cleanup.py` ~1045tok: Footage clean-up (idea from "miracle clean up" tools, our own code, runs locally; nothing is uploaded). · exports: feather_mask, main
- `scripts/copy_fonts.mjs` ~257tok: Copies the brand fonts (woff2) from @fontsource into public/fonts.
- `scripts/demo_assets.py` ~734tok: Synthetic before/after ILLUSTRATIONS for the demo case (not a patient), and an · exports: smile
- `scripts/demo_molar.py` ~685tok: Synthetic occlusal molar illustrations (NOT a patient) for the anatomy-map demo: · exports: base, finish
- `scripts/ff.ts` ~2882tok: ffmpeg toolkit for clinic footage. Usage: npm run ff -- <recipe> [args]   (npm run ff -- help) · exports: GRADES
- `scripts/footage_cutout.py` ~1490tok: Prepare talking-head footage: trim, crop, paint out burned-in overlay text, colour-correct, · exports: decode_all, paint_out_text, grade, matte
- `scripts/lib.ts` ~357tok: Expand args (files or folders) into a list of .yaml/.yml brief paths. · exports: today, briefPaths, validate, printFindings, arg, flag · used by 4
- `scripts/make.ts` ~156tok: One command: validate → render (+ loudness master) → QC.
- `scripts/make_sfx.py` ~1244tok: Generate the UI sound-effect set (public/sfx/*.wav) in code: free, no samples, no licences. · exports: t_, band, env, modes, reverb, finish, stereo, save
- `scripts/prep_footage.ts` ~753tok: SRT (source seconds) → words relative to the trim; time spread inside each cue by character length. · exports: srtToWords · used by 1
- `scripts/qc.ts` ~1535tok: .jpg. Exit 1 on any FAIL. · exports: qc · used by 1
- `scripts/render.ts` ~1061tok: Mastering: H.264 yuv420p, TV range, BT.709 tags (what Instagram/TikTok expect), +faststart. · exports: render · used by 1
- `scripts/stills-many.ts` ~364tok: Render one or more frames for several briefs from ONE bundle (fast visual checks of many examples).
- `scripts/stills.ts` ~276tok: Render several stills of any composition from ONE bundle (fast checks).
- `scripts/trace_regions.py` ~1074tok: Trace anatomy-map regions from the photo itself (no hand-drawn guessing). · exports: mask_for, contour_points, main
- `scripts/validate.ts` ~150tok: Usage: npm run validate -- briefs/my-video.yaml [more files or folders]

### scripts/blender
- `scripts/blender/build_library.py` ~292tok: Regenerate the 3D model library from scripts/blender/library.txt (models are reproducible, so .glb files are not comm…
- `scripts/blender/composite_clip.py` ~1593tok: Clinical-macro clip (direction A): composite restoration of the mesial cavities on 11 and 21. Illustration only. · exports: area, pose
- `scripts/blender/directions.py` ~4196tok ⚠: Creative directions for 3D detailing, rendered in Blender Cycles (headless bpy, our own procedural models). · exports: tooth_mesh, gum_band, material, incisal_translucency, assign, world, area, camera…
- `scripts/blender/library.txt` ~187tok: —
- `scripts/blender/modelgen.py` ~11409tok ⚠: modelgen: our own text → 3D generator for dental objects (headless Blender, pure code, no AI service, no uploads). · exports: parse, reset, mat, M, new_obj, lathe, tube, place… · used by 1

### src
- `src/Root.tsx` ~839tok: Video" is what scripts/render.ts uses; the other three are previews in Studio. · exports: Root · used by 1
- `src/Video.tsx` ~548tok: One entry composition; the brief's `type` picks the template. · exports: VideoProps, Video · used by 1
- `src/brand.ts` ~340tok: Facts printed on end cards. Source: business card. Never invent others. · exports: colors, fonts, clinic, video · used by 32
- `src/demo-briefs.ts` ~743tok: .yaml; tests keep them in sync). · exports: demoOffer, demoEducation, demoCase · used by 2
- `src/index.ts` ~23tok: —
- `src/theme.ts` ~511tok: Visual families (decided Nov 2026, see docs/style-profile.md §6): · exports: ThemeName, Theme, themes, ThemeContext, useTheme · used by 30

### src/brief
- `src/brief/compliance.ts` ~3336tok: Words a medical practice should not use in advertising. Extend in CLAUDE.md first. · exports: Finding, BANNED, ALLOWED_PHRASES, ComplianceEnv, checkCompliance · used by 3
- `src/brief/load.ts` ~327tok: In YAML flow maps `{ small: Soft brush, light pressure }` the comma silently splits the text: · exports: findCommaSplits, loadBrief · used by 3
- `src/brief/schema.ts` ~4832tok ⚠: A file inside public/ (Remotion can only load assets from there). · exports: offerBrief, educationBrief, caseBrief, word, Word, talkingHeadBrief, PROCEDURE_STAGES, procedureBrief… · used by 24
- `src/brief/timing.ts` ~1079tok: Scene lengths in seconds per template. Single source of truth for duration. · exports: scenes, sceneCount, durationSeconds, sec, MAP_XFADE, mapSceneSeconds, MAP_ROUTE, RECEIPT… · used by 14

### src/fx
- `src/fx/DoodleIcon.tsx` ~512tok: A doodle as an icon on a light round badge (reads on dark and light themes). `p` 0→1 draws the lines, then colour lan… · exports: doodleFill, DoodleIcon · used by 1
- `src/fx/EffectsGallery3.tsx` ~536tok: Effects set 3 (reference reel: git-city / teardown / headline). Map route: brief type `map-route`. · exports: effectsGallery3Frames, EffectsGallery3 · used by 1
- `src/fx/FootageGallery.tsx` ~1505tok: Full-frame "footage": the cut-out doctor over the brand backdrop. · exports: FX_SEG, footageGalleryFrames, FootageGallery · used by 1
- `src/fx/FootageGallery2.tsx` ~855tok: — · exports: FX2_SEG, footageGallery2Frames, FootageGallery2 · used by 1
- `src/fx/FootageGallery3.tsx` ~851tok: Set 4: the effects from the "20 video effects for Claude" reel we didn't have yet (needs the local clinic footage). · exports: FX3F_SEG, footageGallery3Frames, FootageGallery3 · used by 1
- `src/fx/Gallery.tsx` ~1818tok: Every effect, labelled. Render: npx remotion render src/index.ts EffectsGallery out/effects-gallery.mp4 · exports: EffectsGallery, galleryFrames · used by 1
- `src/fx/Halftone.tsx` ~595tok: Halftone reveal (reference: "map-route" / "headline" reels): a dark screen opens through a grid of dots that · exports: HalftoneReveal · used by 3
- `src/fx/LooksGallery.tsx` ~448tok: Whole-video looks on one clinic shot (needs the local footage). First segment: no look, for comparison. · exports: LOOK_SEG, looksGalleryFrames, LooksGallery · used by 1
- `src/fx/LottieClip.tsx` ~298tok: Plays a Lottie animation from public/lottie/<file>.json (synced to the video frame). · exports: LottieClip
- `src/fx/Scenes.tsx` ~392tok: Plays scenes back to back. With a transition, neighbouring scenes overlap by · exports: SceneItem, Scenes, useEdgeFade · used by 5
- `src/fx/blueprint-subjects.ts` ~1621tok: Blueprint drawings (frame coordinates, 1080×1920). Each stroke has a start/end as a FRACTION of the drawing time, · exports: Stroke, Dim, Label, Subject, implant, tooth, SUBJECTS · used by 1
- `src/fx/context.ts` ~184tok: Transitions that render reliably headless (plain CSS; no WebGL). · exports: TRANSITIONS, TransitionName, FxSettings, defaultFx, FxContext, useFx · used by 6
- `src/fx/doodles.ts` ~2004tok: Hand-drawn dental doodles for the `sketch` explainer (reference: "Hand-Drawn Explainer" reel). · exports: FillKey, Doodle, DOODLE_SET, DOODLES, DoodleName · used by 4
- `src/fx/effects.tsx` ~3902tok: Dental House effects library. Every effect is plain Remotion code (free, no licensed assets). · exports: ShineText, Highlighter, Typewriter, CountUp, Glow, LightSweep, Sparkles, LightLeak… · used by 13
- `src/fx/footage.tsx` ~8873tok ⚠: Footage effects (creator-style looks, built in Remotion code; free). · exports: Subject, Orbit, CouchWall, VideoWall, UIWorld, FrameBreak, DigitalZoom, PhoneMockup… · used by 4
- `src/fx/footage2.tsx` ~4200tok ⚠: Footage effects, set 2 (19–30): built for clinic use, in Remotion code (free), frame-driven. · exports: TextRing, Spotlight, WhipPan, ShapeReveal, FreezeIntro, NotificationStack, LocationPin, Countdown… · used by 2
- `src/fx/footage3.tsx` ~5866tok ⚠: Footage effects, set 4 (39–49): the effects from the "20 video effects for Claude" reel that we didn't have yet. · exports: GridDive, MagnifyLens, Portal, InfiniteZoom, CubeSpin, LiquidGlass, TileTunnel, PhoneFan… · used by 1
- `src/fx/looks.tsx` ~1796tok: Whole-video looks (our own code; style names from a "10 viral video styles" post): wrap any scene in <Look kind=…>. · exports: LOOKS, LookName, Look · used by 3
- `src/fx/media.ts` ~2467tok: Drawing media for the `sketch` explainer: one drawing, six materials. Our own "style recipes · exports: MEDIA, MediumName, Medium, MEDIUM · used by 2
- `src/fx/reel3.tsx` ~3383tok: Effects set 3 (reference reel: /git-city, /teardown, /map-route, /headline). Rebuilt in our own code for clinic use. · exports: demoGrid, DataCity, IMPLANT_PARTS, Teardown, Newspaper, FX3_SEG · used by 1
- `src/fx/transitions.tsx` ~693tok: Custom calm transition: incoming scene sharpens from a soft blur while fading in. · exports: transitionFor · used by 1

### src/templates
- `src/templates/AnatomyMap.tsx` ~2751tok: Photo placement: contain-fit to the full frame (never cropped), or a uniform zoom centred on `focus` · exports: smoothPath, AnatomyMap · used by 1
- `src/templates/Blueprint.tsx` ~2948tok: Blueprint drawing (reference: blueprint-style reel), driven by the frame number. · exports: Blueprint · used by 1
- `src/templates/ClinicalCase.tsx` ~1644tok: Before/after case. Photos are shown UNWARPED and uncropped (object-fit: contain, · exports: ClinicalCase · used by 1
- `src/templates/Diagram.tsx` ~5664tok ⚠: Content area below the title (inside the safe zone). · exports: Diagram · used by 1
- `src/templates/Education.tsx` ~920tok: — · exports: Education · used by 1
- `src/templates/MapRoute.tsx` ~4552tok ⚠: Timeline in frames, derived from the brief (single source of truth for camera, route and overlays). · exports: MapRoute · used by 1
- `src/templates/Offer.tsx` ~1220tok: — · exports: Offer · used by 1
- `src/templates/PhotoLayout.tsx` ~3126tok: Content box (inside the safe area): photos never leave it. · exports: PhotoSize, PhotoLayout, photoSizes · used by 3
- `src/templates/Procedure.tsx` ~1847tok: 3D procedure explainer. Stage progress comes from the frame number, so every render is identical. · exports: HOOK_SECONDS, Procedure · used by 1
- `src/templates/Receipt.tsx` ~2347tok: Receipt (reference: "/receipt" reel). Prices only from the owner: compliance enforces prices_confirmed_on. · exports: Receipt · used by 1
- `src/templates/Sketch.tsx` ~6313tok ⚠: Doodle fill colours by hue name, taken from each theme's harmonised map palette (slot order differs per theme). · exports: Sketch · used by 1
- `src/templates/TalkingHead.tsx` ~2857tok: Stage: where the cut-out doctor sits (footage is 1152 px wide after prep). · exports: chapterTimes, cutTimes, calloutTimes, captionChunks, TalkingHead · used by 2
- `src/templates/shared/Backdrop.tsx` ~570tok: Dark brand backdrop: gradient, oversized house-mark watermark, grain, vignette. · exports: Backdrop, KenBurns · used by 6
- `src/templates/shared/EndCard.tsx` ~785tok: Light end card: logo mask-wipe, tagline, CTA pill with pulsing ring, phone/WhatsApp, handle, doctors, address. · exports: EndCard · used by 1
- `src/templates/shared/Headline.tsx` ~445tok: Kinetic multi-line headline: masked slide-up per line, one serif accent word, bronze strike rule. · exports: KineticHeadline · used by 10
- `src/templates/shared/Hud.tsx` ~752tok: Persistent HUD until the end card: progress bar, logo bug, label, crop marks, business-card bars. · exports: Hud, DemoWatermark, MinimalBug · used by 1
- `src/templates/shared/SafeZones.tsx` ~197tok: Preview overlay: light red bands = platform UI, red outline = safe area. Never rendered in final videos. · exports: SafeZones · used by 1
- `src/templates/shared/Shell.tsx` ~550tok: Common frame for every template: backdrop, HUD, end card, music, demo/safe-zone overlays. · exports: QcProps, Shell · used by 13
- `src/templates/shared/Step.tsx` ~413tok: Numbered beat: outlined numeral, bronze rule, headline + serif subline. · exports: Step · used by 2
- `src/templates/shared/fonts.ts` ~310tok: Blocks rendering until brand fonts are loaded (no fallback-font frames). · exports: loadBrandFonts · used by 1
- `src/templates/shared/motion.ts` ~224tok: 0→1 over `dur` frames starting at `start`, eased. · exports: ease, easeInOut, prog, pop, sceneFade · used by 11
- `src/templates/shared/text.ts` ~280tok: Font size so the longest line fits `width` px. Oswald 700 uppercase averages · exports: headline, serif, mono, fitSize · used by 24

### src/three
- `src/three/CompositeScene.tsx` ~1821tok: Composite restoration of carious 11/21 (mesial), stage by stage. Generic products only. · exports: CompositeScene · used by 1
- `src/three/anterior.tsx` ~3694tok: Anterior arch + restorative instruments, built in code with three.js (no downloaded models, no licences). · exports: archZ, archRotY, TEETH, faceZ, Tooth2, Gum, Patch, Syringe… · used by 1
- `src/three/city.ts` ~2096tok: Procedural "clay" city for map-route videos: road grid, blocks, buildings, parks, river and bridges. · exports: PITCH, ROAD, Grid, GridPoint, gx, gz, rng, RIVER_W… · used by 2
- `src/three/dental.tsx` ~1670tok: Procedural 3D dental models (three.js, built in code: no downloaded models, no licences). · exports: MAT, Tooth, PreparedTooth, Crown, Implant, Abutment, JawSection, DentalLights · used by 3

### tests
- `tests/brief.test.ts` ~2986tok: —
- `tests/talking-head.test.ts` ~1029tok: —
- `tests/toolkit.test.ts` ~1075tok: —

