---
description: Propose 2–3 creative directions for a video (with preview stills) so the owner can choose without editing expertise
argument-hint: what the video is about (or a brief path)
---
The owner is a dentist, not an editor. Make choosing easy: show, don't ask technical questions.

For: $ARGUMENTS

1. Read `docs/style-profile.md` (taste, past choices), `docs/effects.md` and the matching brief type.
2. Write **2–3 genuinely different directions** as draft briefs `briefs/options/<id>-a.yaml`, `-b`, `-c`. Vary the things a viewer
   feels: hook style, pace (avg shot length), theme (brand/editorial), effects (≤ 2 per video), music/sfx, length. Keep the
   message and the clinical content identical across options.
3. For each, render 3 stills (hook ~1 s, middle, ending) with `npm run still`, and combine them into one comparison image
   (`qc/options/<id>.jpg`, three rows A/B/C). Read it yourself and fix anything broken before showing it.
4. Present a short table: option · feel · why it could work (one line, viewer-centred, e.g. "hook in 1 s, fast for Reels")
   · watch-out. Recommend one, with the reason.
5. When the owner picks (or mixes: "A's hook with B's colours"), delete the unused drafts, record the choice and the reason in
   `docs/style-profile.md` → "Choices log", then continue with `/make`.
