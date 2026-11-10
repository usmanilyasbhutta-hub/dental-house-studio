# Effects library

**Licence:** Remotion and its packages (including `@remotion/transitions`) are under the Remotion License: free for
individuals and companies of up to 3 employees; larger companies need a company licence. The owner reports the clinic has
two doctors (Nov 2026). Count **all** employees (assistants, reception), and buy a company licence if the total goes above 3.

The effects themselves are free: plain Remotion code (`src/fx/`), Remotion's official free packages
(`@remotion/transitions`, `@remotion/noise`, `@remotion/paths`, `@remotion/shapes`, `@remotion/motion-blur`),
and sound effects generated in code (`scripts/make_sfx.py`, procedural-foley principles). No stock footage,
no licensed sounds, no paid plugins.

**See them all:** `npm run gallery` → `out/effects-gallery.mp4` (each effect labelled, then every transition).

## Using effects in a brief
```yaml
fx:
  transition: blur-fade     # none | fade | blur-fade | slide | wipe | iris | clock-wipe | flip | push
  transition_frames: 12     # overlap between scenes (4–24 frames)
  sfx: subtle               # none | subtle  (UI sounds on reveals, steps, tags, CTA)
callouts:                    # talking-head only: per-keyword emphasis
  - { on: gentle, big: Gentle, small: "Be gentle to your gums", fx: shine }   # none | sparkle | shine | glow | punch
```
Defaults are calm: `fade`, 10 frames, no sound effects.

## What to use when

| Effect (`src/fx/effects.tsx`) | Use for | Tone |
|---|---|---|
| `ShineText` | price, "FREE", a key number | offer |
| `Highlighter` | one key word in education | calm |
| `Typewriter` | question hooks, myth vs fact | calm |
| `CountUp` | statistics ("1 in 10"), prices, counts | any |
| `Glow` | gentle emphasis on one word | calm |
| `Sparkles` | "fresh / clean / done" moments | calm |
| `LightSweep` | logo, CTA pill, product shot | any |
| `LightLeak` | warm mood over footage or backdrop | calm |
| `DrawCircle`, `DrawArrow`, `DrawUnderline` | point at a tooth, annotate a diagram, underline a headline | any |
| `PunchZoom` | landing one key point | any (sparingly) |
| `Shake`, `Glitch` | high-energy offers | **contemporary only** |
| `Confetti` | celebrations, milestones (Iqbal Day, Eid, clinic anniversary) | festive |

| Transition | Feel | Suggested for |
|---|---|---|
| `fade` | neutral | default, clinical cases |
| `blur-fade` | soft, premium (custom) | education, doctor-led |
| `slide` / `push` | energetic | offers, promos |
| `wipe`, `clock-wipe` | graphic | step lists, countdowns |
| `iris` | spotlight | reveals |
| `flip` | playful | kids' / fun content |

Only plain-CSS transitions are offered. Remotion's WebGL ones (dissolve, ripple, film-burn, zoom-blur and others) are
left out because they're unreliable in headless rendering.

| Sound (`public/sfx/`) | Plays on |
|---|---|
| `whoosh` | offer reveal, talking-head keyword |
| `shimmer` | price / result moment |
| `pop` | step numerals, tags |
| `thud` | `punch` keyword |
| `click` | CTA pill on the end card |
| `tick`, `swoosh-out` | counters, exits (available for new templates) |

Regenerate the sounds with `npm run sfx`. They peak around −10 dBFS and play at 0.3–0.5 volume, so they sit under
the voice and music.

## Footage effects (`src/fx/footage.tsx`): creator-style looks for doctor videos
Preview all: `npx remotion render src/index.ts FootageFxGallery out/footage-fx-gallery.mp4` (needs local footage).
Most take `subject` (the cut-out doctor from `npm run prep`) and/or `children` (any full-frame layer).

| # | Effect | Use for |
|---|---|---|
| 01 | `Orbit` | clip as a 3D card turning in space (intros, "behind the scenes") |
| 02 | `VideoWall` | clip repeated on a wall of screens, camera pushes in ("couch wall": interpretation, refine with reference) |
| 03 | `UIWorld` | doctor among floating app cards (appointment, reminder, WhatsApp) |
| 04 | `FrameBreak` | doctor's head breaks out of a framed photo/clip |
| 05 | `DigitalZoom` | punch-in with scanlines, pixel grid and focus brackets |
| 06 | `PhoneMockup` | any layer inside a tilting phone |
| 07 | `Checklist` | card that ticks off steps (treatment plan, aftercare) |
| 08 | `HeadlineWall` | scrolling wall of headlines/myths behind the doctor |
| 09 | `ZoomThrough` | dive through a circle into the next scene |
| 10 | `ChartGrow` | bars grow with counting values (statistics, need sources) |
| 11 | `PullBackReveal` | full-screen clip pulls back into a phone |
| 12 | `GreenScreen` | cut-out doctor over any background (clinic, 3D, photo) |
| 13 | `PaperCut` | torn-paper collage with stop-motion jitter |
| 14 | `DoodleBoil` | hand-drawn circles/arrows/stars that "boil" |
| 15 | `Vertigo` | dolly zoom: background grows, doctor stays |
| 16 | `CoverStory` | magazine cover: masthead behind the head, cover lines |
| 17 | `GlassType` | frosted-glass letters refracting the footage |

Clinical-photo rule still applies: these go on doctor/clinic footage and graphics, never to alter a clinical photo.

## Rules
1. **Never put sparkles, glow, shine or light leaks on clinical photos** (before/after, intraoral). It can read as
   an enhanced result. Effects go on text and graphics only.
2. **Never use `Glitch` or `Shake` in education or clinical videos.**
3. Use at most one "wow" effect per scene. Effects should support the message, not compete with it.
4. Turn sound effects on for promos (`sfx: subtle`). Keep them off, or very subtle, under a doctor's voice.
5. New effects go in `src/fx/effects.tsx`, plus one line in the gallery (`src/fx/Gallery.tsx`), plus a row in this file.
   Then run `npm run gallery` and look at the result.

## More free sources (when we need them)
- **HyperFrames registry** (skill `hyperframes:hyperframes-registry`): about 450 ready-made blocks (transitions, kinetic type,
  overlays, charts). It's a different engine (HTML → video), so port an idea to Remotion rather than mixing engines.
- **photo-to-video-2p5d** skill: code-only 2.5D motion from a still photo (clinic photos, product shots).
- Lottie animations: only with a licence that allows commercial use. Check each file's licence first.
