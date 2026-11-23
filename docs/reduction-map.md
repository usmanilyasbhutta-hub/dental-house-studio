# Reduction map (generated: `python3 scripts/reduction_map.py`; do not edit by hand)

Where a chat's tokens go and the cheapest way to do each job. Companion to `docs/project-map.md`.
Whole repo ≈ 181,645 tokens; a normal job should read **under 10k**.

## 1. Fixed cost every chat pays

- `CLAUDE.md` ~2,478 tok: auto-loaded every chat
- `docs/project-map.md` ~5,584 tok: CLAUDE.md says: start here
- **Total ≈ 8,062 tok before any work.** Skip the project map when this reduction map's recipe already
  names the files (most jobs below). Open the project map only for unfamiliar code.

## 2. Task recipes (read only these)

| Job | Files | ≈ tok |
|---|---|---|
| Tweak copy / timing in an existing brief | `briefs/<file>.yaml`, `src/brief/schema.ts` (grep) | 750 |
| New brief of a known type (after /options) | `docs/taste.md`, `docs/style-profile.md`, `src/brief/schema.ts` (grep), `src/brief/compliance.ts`, `briefs/examples/<same type>.yaml` | 8,603 |
| Add / change an effect in a brief | `docs/effects.md` (grep), `briefs/<file>.yaml` | 750 |
| Fix a bug in one template | `src/templates/<Type>.tsx`, `src/brief/schema.ts` (grep), `src/theme.ts` | 3,411 |
| Compliance / claims question | `src/brief/compliance.ts` | 3,336 |
| Clinic facts / brand colours | `src/brand.ts` | 340 |
| 3D tooth / implant clip (modelgen) | `docs/3d-detailing.md`, `scripts/blender/modelgen.py` (grep) | 1,986 |
| Taste reaction to log | `docs/taste.md` | 2,504 |
| QC a render | `qc/<id>/report.md`, `qc/<id>/contact.jpg (image)` | 2,100 |

Images cost ~1.6k tok each: one contact sheet beats five stills. Logs: always `| tail -20` or `| grep`.

## 3. Big files (> 4k tok): read by line range

Use `sed -n A,Bp <file>` (or Read with offset/limit) on the range you need. Ranges are regenerated on `npm run map`.

### `scripts/blender/modelgen.py` ~11,409 tok
- 25–79: parser, parse, helpers, reset
- 80–139: mat, M
- 140–220: new_obj, lathe, tube, place, group
- 221–261: boolean, bake, teeth, sellipse
- 262–342: anterior_crown, occlusal
- 343–399: posterior_crown, root
- 400–484: tooth
- 485–531: implant
- 532–602: instruments, knurl, handpiece, curing_light, syringe
- 603–650: handle, mirror, probe, output, bounds
- 651–748: apply_look
- 749–788: camera_move
- 789–893: preview
- 894–935: selftest, main

### `src/fx/footage.tsx` ~8,873 tok
- 13–49: clamp, ease, io, p, Subject, Orbit
- 50–90: CouchWall, VideoWall
- 91–124: UIWorld
- 125–164: FrameBreak, DigitalZoom
- 165–193: PhoneMockup, PhoneBeside
- 194–247: Checklist, HeadlineWall
- 248–286: ZoomThrough, ChartGrow
- 287–312: TrendLine
- 313–358: PullBackReveal
- 359–398: GreenScreen, PaperCut
- 399–443: DoodleBoil
- 444–480: Vertigo, CoverStory
- 481–511: GlassType
- 512–534: PunchCaption, PhotoLayer

### `src/templates/Sketch.tsx` ~6,313 tok
- 13–19: HAND, NOTE, AREA, clamp01, ease
- 20–26: HUES, fillColour
- 27–50: Sketch
- 51–78: Paper
- 79–197: MediumDefs
- 198–226: Title
- 227–240: renderAccent
- 241–333: Scene
- 334–340: toFrame
- 341–379: ColourLayer
- 380–394: Tag
- 395–428: Tool
- 429–466: Caption
- 467–482: Footer

### `src/fx/footage3.tsx` ~5,866 tok
- 13–19: W, clamp, ease, io, p
- 20–29: Mini
- 30–54: GridDive
- 55–76: MagnifyLens
- 77–99: Portal
- 100–121: InfiniteZoom
- 122–138: CubeSpin
- 139–178: LiquidGlass
- 179–219: TileTunnel
- 220–245: PhoneFan
- 246–293: Shatter
- 294–326: RibbonWrap
- 327–348: HeadPopOut
- 349–401: Particles

### `src/templates/Diagram.tsx` ~5,664 tok
- 15–20: A, clamp01, ease
- 21–23: body
- 24–50: Diagram
- 51–53: Icon
- 54–56: pop
- 57–82: Timeline
- 83–127: Roadmap
- 128–190: Flowchart
- 191–235: Cycle
- 236–258: Layers
- 259–298: Iceberg
- 299–339: Tree
- 340–373: Matrix
- 374–393: Infographic

### `src/brief/schema.ts` ~4,832 tok
- 7–67: shared
- 68–91: per type, offerBrief, educationBrief
- 92–120: caseBrief, word, Word
- 121–167: talkingHeadBrief
- 168–187: PROCEDURE_STAGES, procedureBrief, ProcedureBrief
- 188–214: photoLayoutBrief
- 215–229: PhotoLayoutBrief, mapRegion
- 230–254: anatomyMapBrief
- 255–283: AnatomyMapBrief, mapRouteBrief
- 284–302: MapRouteBrief, blueprintBrief
- 303–325: BlueprintBrief, receiptBrief, ReceiptBrief
- 326–360: sketchBrief
- 361–397: SketchBrief, DIAGRAM_LAYOUTS, diagramBrief
- 398–420: DiagramBrief, brief, TalkingHeadBrief, segmentsOf … CaseBrief

### `src/templates/MapRoute.tsx` ~4,552 tok
- 18–42: FOV, ease, clamp01, useTimeline
- 43–58: overview
- 59–75: chase, camAt
- 76–100: project, crowd, Rig
- 101–159: MapRoute
- 160–191: City
- 192–205: glowTexture
- 206–260: Route
- 261–291: overlays, Chip
- 292–302: Marker
- 303–330: Bubble
- 331–343: StreetLabel
- 344–364: Pin
- 365–400: EndCardOverlay

### `src/fx/footage2.tsx` ~4,200 tok
- 11–13: clamp, ease, io
- 14–16: p
- 17–45: TextRing
- 46–59: Spotlight
- 60–72: WhipPan
- 73–92: ShapeReveal
- 93–116: FreezeIntro
- 117–142: NotificationStack
- 143–168: LocationPin
- 169–192: Countdown
- 193–217: PostMockup
- 218–242: MulticamGrid
- 243–261: WordStack
- 262–272: BrandDuotone

### `scripts/blender/directions.py` ~4,196 tok
- 41–105: tooth_mesh
- 106–133: gum_band
- 134–179: material
- 180–201: incisal_translucency
- 202–206: assign
- 207–215: world
- 216–227: area
- 228–242: camera
- 243–384: backdrop

### `docs/effects.md` ~4,145 tok
- 1–13: Effects library
- 14–24: Using effects in a brief
- 25–65: What to use when
- 66–93: Footage effects (`src/fx/footage.tsx`): creator-style looks for doctor videos
- 94–110: Set 2 (`src/fx/footage2.tsx`), built for clinic use. Preview: composition `FootageFxGallery2`
- 111–151: Set 3: 3D reel effects (reference: the /git-city · /teardown · /map-route · /headline reel)
- 152–162: "Visual codes" mapping (study-anything formats)
- 163–185: Set 4 (`src/fx/footage3.tsx`): from the "20 video effects for Claude" reel. Preview: composition `FootageFxGallery3`
- 186–195: Footage tools (local, nothing uploaded)
- 196–202: Whole-video looks (`fx.look` in any brief; preview: composition `LooksGallery`)
- 203–207: Beat sync
- 208–216: Rules
- 217–221: More free sources (when we need them)

## 4. Where the remaining weight is

- `src/fx/` ~42,799 tok (23%)
- `src/templates/` ~40,715 tok (22%)
- `scripts/` ~20,623 tok (11%)
- `scripts/blender/` ~17,677 tok (9%)
- `docs/` ~16,630 tok (9%)
- `src/brief/` ~9,574 tok (5%)
- `src/three/` ~9,281 tok (5%)
- `tests/` ~5,090 tok (2%)
- `(root)/` ~4,143 tok (2%)
- `briefs/examples/` ~4,125 tok (2%)

## 5. Rules of thumb

- Never read a ⚠ file whole; never re-read a file already read or just edited in this chat.
- Briefs: copy the nearest example in `briefs/examples/` instead of reading the whole schema.
- Check visuals with `npm run still` or a contact sheet; a full render only after the owner approves.
- One chat per job; start a new chat instead of carrying a long one (old turns are re-sent every message).
- Biggest single file: `scripts/blender/modelgen.py` (~11,409 tok). Grep it.
