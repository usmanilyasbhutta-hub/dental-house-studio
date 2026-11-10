---
description: Full 3-level review (understanding, code, visual) of a video before dentist approval
argument-hint: briefs/<file>.yaml
---
Review the video for `$ARGUMENTS`. Run these four subagents **in parallel**, then merge their findings into one table (severity, level, finding, fix):

1. `clinical-reviewer`: content, claims, sources, consent, privacy (understanding level)
2. `brand-reviewer`: brief copy against the brand and tone rules in CLAUDE.md
3. `visual-qc`: looks at `qc/<id>/contact.jpg` + frames and the QC report (visual level)
4. `editor-reviewer`: viewer/editor scorecard /40 (hook, pacing, readability, ending)

Also run `npm run check` (code level) and include its result.
Write the merged review to `qc/<id>/review.md`. End with a clear verdict: **Ready for dentist approval** or **Needs changes**. Never mark it approved yourself.
