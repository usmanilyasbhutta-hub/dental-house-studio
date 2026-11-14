# Skill: DHS Mode / Genre Director — v2.0

## Purpose
Determine what the video **is**, what the viewer should **feel**, what they should **understand**, and what should change emotionally from beat to beat before any editing style is chosen.

## Use before
Cuts, typography, motion graphics, sound design, music selection, or AI asset generation.

## Role
Act as a director, commercial editor, documentary editor, and brand strategist. Diagnose the piece before styling it.

## Inputs
- Raw video / transcript / storyboard / rough cut
- Platform and placement
- Objective: awareness / reassurance / proof / education / conversion / celebration / announcement
- Audience
- Offer / CTA if applicable
- Real footage available
- AI/VFX assets available or permissible
- Constraints: duration, privacy, clinical visibility, brand rules

If an input is missing, infer the most conservative assumption and flag it. Do not block the workflow unless the missing information changes the core meaning.

## Step 1 — Identify the communication job
Return one primary job:
- `STOP` — interrupt scrolling / create curiosity
- `ORIENT` — make context instantly understandable
- `PROVE` — show evidence, process, result, expertise
- `EXPLAIN` — teach one useful idea
- `REASSURE` — reduce anxiety / uncertainty
- `DESIRE` — make an outcome emotionally attractive
- `CONVERT` — drive booking / enquiry / next action
- `CELEBRATE` — mark memory / milestone / human moment

Secondary jobs are allowed but must not compete with the primary job.

## Step 2 — Classify genre precisely
Choose a primary genre and optional secondary genre:
- clinical proof
- treatment reveal
- premium cosmetic commercial
- consultation / trust story
- educational micro-story
- mini-documentary
- founder / clinic identity
- offer ad
- myth correction
- procedural macro / process film
- patient-experience vignette
- celebration / milestone
- cinematic montage
- direct-response ad

Avoid meaningless labels such as only “professional,” “cinematic,” or “premium.”

## Step 3 — Define the emotional contract
Specify:
- **Primary emotion**: one dominant feeling
- **Secondary emotion**: optional supporting feeling
- **Emotional risk**: what must the piece avoid feeling like?
- **Viewer state at start**
- **Viewer state at end**
- **Payoff**

Example:
`uncertainty → curiosity → evidence → confidence → action`

## Step 4 — Build the energy curve
Map each beat with:
- energy 1–10;
- tension 1–10;
- information density 1–10;
- emotional direction: `RISE / HOLD / CONTRAST / RELEASE / RESET`;
- primary viewer focus.

Do not keep energy uniformly high. Contrast creates emphasis.

## Step 5 — Define visual grammar
Specify only what follows from the mode:
- camera behavior: locked / handheld intimacy / slow push / lateral drift / macro / reveal / snap reframe / observational;
- shot scale progression: wide → medium → macro, etc.;
- lighting character: clinical clean / soft premium / warm human / high-contrast dramatic;
- texture: polished / tactile / raw / glossy / documentary;
- pace: deliberate / moderate / accelerating / staccato / musical;
- edit density: sparse / medium / dense;
- acceptable stylization ceiling: 0–10.

## Step 6 — Hook architecture
The opening must communicate **value, curiosity, tension, result, or motion** quickly, but do not force a gimmick.

Choose one hook type:
- outcome-first visual;
- unresolved problem;
- unexpected contrast;
- action already in progress;
- emotionally legible human moment;
- bold but defensible statement;
- visual transformation;
- curiosity gap;
- offer/benefit when direct-response is appropriate.

Avoid slow logo intros. Branding may appear through visual language before the logo.

## Genre logic examples

### Premium cosmetic / whitening
Emotion: anticipation → polish → confidence.
Avoid: bargain-store urgency, excessive sparkle, fake whiteness, over-retouching.

### Clinical authority / consultation
Emotion: uncertainty → being heard → clarity → trust.
Avoid: over-fast editing, melodrama, intimidating clinical sound design.

### Treatment / before-after proof
Emotion: problem recognition → process credibility → reveal → confidence.
Avoid: misleading wipes, exposure changes that exaggerate results, non-matched framing presented as direct comparison.

### Education
Emotion: confusion → recognition → simple insight → usable takeaway.
Avoid: lecture pacing and screen-filling text.

### Celebration
Emotion: anticipation → warmth → peak → memory.
Allow: stronger music, expressive type, spectacle at real emotional peaks.

## Required output

```md
# MODE MAP
Communication job:
Primary genre:
Secondary genre:
Primary emotion:
Secondary emotion:
Emotional risk:
Viewer start state:
Viewer end state:
Viewer promise:
Payoff:
Energy curve:
Stylization ceiling: /10

## BEAT B01 — [time]
Content:
Narrative function:
Mood:
Energy: /10
Tension: /10
Information density: /10
Direction: RISE / HOLD / CONTRAST / RELEASE / RESET
Primary viewer focus:
Camera feeling:
Reason:

## GLOBAL VISUAL GRAMMAR
...
```

## Failure conditions
Reject or redo the mode map if:
- it starts with fonts, transitions, or music before defining meaning;
- every beat has the same energy;
- the genre conflicts with the footage or clinical subject;
- it uses multiple competing moods inside one short beat without deliberate contrast;
- the payoff is unclear;
- it cannot state what the viewer should feel differently by the end.
