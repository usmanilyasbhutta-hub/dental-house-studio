---
description: Propose 2–3 creative directions for a video (with preview stills) so the owner can choose without editing expertise
argument-hint: what the video is about (or a brief path)
---
The owner is a dentist, not an editor. Make choosing easy: show, don't ask technical questions.

For: $ARGUMENTS

1. Run the `creative-director` agent on the topic (it reads `docs/taste.md`, the style profile and the effects list). Save its
   decision sheet to `docs/decisions/<id>.md`. Option A follows the sheet exactly; B and C each change the rows it marked
   medium/low, so the owner's pick teaches us something.
2. Write **2–3 genuinely different directions** as draft briefs `briefs/options/<id>-a.yaml`, `-b`, `-c`. Vary the things a viewer
   feels: hook style, pace (avg shot length), theme (brand/editorial), effects (≤ 2 per video), music/sfx, length. Keep the
   message and the clinical content identical across options.
3. For each, render 3 stills (hook ~1 s, middle, ending) with `npm run still`, and combine them into one comparison image
   (`qc/options/<id>.jpg`, three rows A/B/C). Read it yourself and fix anything broken before showing it.
4. Present a short table: option · feel · why it could work (one line, viewer-centred, e.g. "hook in 1 s, fast for Reels")
   · watch-out. Recommend one, with the reason.
5. When the owner picks (or mixes: "A's hook with B's colours"), delete the unused drafts, record the pick and the owner's own words
   in `docs/taste.md` (Feedback log; update preferences by its rules) and in the decision sheet, then continue with `/make`.
