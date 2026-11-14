# Skill: DHS Video Editor Orchestrator — v2.0

## Purpose
Integrate DHS directing, cutting, typography, motion, sound, and platform finishing into one executable edit plan.

## Use when
A complete video must be built, revised, diagnosed, or handed to an editor/AI editing agent.

## Sub-skills
1. Mode / Genre Director
2. Precision Cut Editor
3. Kinetic Typography Director
4. Motion Graphics Director
5. Score / Sound Director
6. Platform / Delivery Adapter
7. Final QC

## Master rule
**Story and credibility lead. Effects follow.**

Do not style footage until the communication job, emotional trajectory, and primary viewer focus are known.

## Workflow

### Stage 0 — Technical inventory
Record:
- source FPS / resolution / orientation;
- source audio quality;
- total footage duration;
- transcript availability;
- platform(s);
- target duration;
- mandatory shots / wording / CTA;
- privacy/clinical constraints.

### Stage 1 — Mode
Run `01_mode_genre`.
Output: communication job, genre, emotional trajectory, energy curve, hook, payoff, visual grammar.

### Stage 2 — Structural cut
Run `02_cut_precision`.
Output: segment fitness, frame-accurate cut map, pause decisions, continuity strategy, emphasis frames.

**Do not add decorative graphics before the structural edit works.**

### Stage 3 — Typography
Run `03_kinetic_typography`.
Output: necessary text only, hierarchy, placement, readability, motion semantics.

### Stage 4 — Motion
Run `04_motion_graphics`.
Output: viewer-guidance motion, transitions, compositing, easing, direction, feasibility.

### Stage 5 — Audio
Run `05_score_sound`.
Output: dialogue treatment, score brief, diegetic sound, SFX, silence, ducking, sync.

### Stage 6 — Platform adaptation
Run `07_platform_delivery` for each destination.

### Stage 7 — Integration
Resolve collisions and build a single time-based edit map.

### Stage 8 — QC
Run `06_dhs_video_qc` on the finished/rough export.

## Conflict-resolution hierarchy
When recommendations disagree, use:
1. **clinical truth / factual truth**;
2. **viewer comprehension**;
3. **primary viewer focus**;
4. **story / emotion**;
5. **continuity**;
6. **rhythm**;
7. **brand expression**;
8. **novelty / trend**.

Examples:
- Typography hides a treatment result → move/remove typography.
- Music makes treatment footage feel sensational → replace music.
- Transition weakens a reveal → hard cut.
- Strong reaction needs time → hold longer even if average shot length increases.
- Trend conflicts with brand/clinical credibility → reject trend.

## Attention collision test
At every important moment ask:
- What should the eye look at?
- What should the ear listen to?
- What should the viewer understand?
- What should the viewer feel?

If more than one answer is dominant in the same modality, simplify.

## Peak-budget rule
Do not let all systems peak together by default.

Possible climax design:
- picture peaks;
- typography reduces;
- motion supports;
- sound peaks briefly;
- then release.

Or:
- picture becomes still;
- hero word peaks;
- music drops;
- one impact lands.

Choose deliberately.

## Full edit-map output

```md
# MASTER EDIT
Creative direction:
Communication job:
Primary genre:
Source FPS:
Master target duration:
Platform versions:

## CUT C01 — 00:00:00:00 → 00:00:01:08 @ 25fps
Severity:
Narrative function:
Primary viewer focus:
Mood:
Energy: /10

### Picture
Source:
IN / OUT:
Crop/reframe:
Speed:
Transition:

### Dialogue / verbal beat
...

### Typography
Text / function:
Placement:
Motion:

### Motion / VFX
Purpose verb:
Movement:
Easing / duration:
Feasibility:

### Sound
Dialogue:
Music:
SFX / ambience:
Silence / ducking:

### Why this exact beat works
...

### Fallback
...
```

## Deliverables
Always return:
1. one-sentence creative direction;
2. communication job + genre + emotional arc;
3. source FPS and technical assumptions;
4. target duration;
5. frame-accurate cut map;
6. typography map;
7. motion map;
8. audio map;
9. platform adaptations;
10. footage problems and repairability;
11. new real footage / AI asset requirements;
12. unresolved risks;
13. final QC verdict.

## Required restraint outputs
The orchestrator must be allowed to say:
- `NO TYPOGRAPHY`
- `NO ADDED MOTION`
- `NO TRANSITION — HARD CUT`
- `NO MUSIC HERE`
- `KEEP NATURAL PAUSE`
- `FOOTAGE NOT REPAIRABLE — RESHOOT`

These are valid expert decisions, not missing work.

## Anti-patterns
Do not:
- use an effect to compensate for weak story;
- animate every word;
- cut at arbitrary milliseconds;
- make every shot equally short;
- use transition packs indiscriminately;
- over-clean human timing;
- over-process dialogue;
- fabricate clinical outcomes;
- prioritize trendiness over trust;
- bury CTA or result under UI overlays;
- use a logo intro as the hook unless the logo itself is the story.
