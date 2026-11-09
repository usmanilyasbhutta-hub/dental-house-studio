# Roadmap: from assisted to automated

| Phase | What | Status |
|---|---|---|
| 0 | Repo, CLAUDE.md, brand tokens, brief schema, compliance rules | ✅ v0.1 |
| 1 | Three templates (Offer, Education, ClinicalCase) + demo briefs | ✅ v0.1 |
| 2 | Render → master (−14 LUFS, BT.709) → automated QC + contact sheet | ✅ v0.1 |
| 3 | Slash commands `/new-video` `/make` `/review` `/publish-prep` + reviewer agents | ✅ v0.1 |
| 4 | Hooks: typecheck/validate on edit, block committing patient material; CI | ✅ v0.1 |
| 4b | Reference analysis script + style profile from 14 reference videos | ✅ v0.2 |
| 4c | TalkingHead template + footage pipeline (cut-out, grade, word captions), first test run reviewed | ✅ v0.3 |
| 4d | Multi-segment trim · footage Promo · AnatomyMap · ProcedureSteps · Celebration (Urdu Nastaliq) | ⏭ next |
| 5 | Make 3 **real** videos; turn every correction into a rule (CLAUDE.md / compliance.ts) | ⏭ next |
| 6 | Clinic b-roll (logo wall, treatment rooms) via `broll:`, real music bed | ⏭ |
| 7 | Voiceover + burned-in captions (remotion-captions skill), Roman-Urdu, then Urdu Nastaliq font | ⏭ |
| 8 | Package the stable workflow as a skill (skill-creator) | ⏭ |
| 9 | Google Sheets calendar (`docs/content-calendar.csv` layout) + weekly scheduled task that drafts and renders "brief approved" rows, writes back links | ⏭ |
| 10 | Performance loop: Windsor.ai pulls reach/retention back into the sheet; briefs learn from it | ⏭ |

Human approval stays before every publish and every ad spend, at every phase.
