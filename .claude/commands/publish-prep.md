---
description: Prepare captions, hashtags and a cover still for an approved video (does not post)
argument-hint: briefs/<file>.yaml
---
For `$ARGUMENTS`:
1. Refuse unless the brief has `demo: false` and `review.approved_by` filled in.
2. Write `out/<id>.caption.md` using the insta-caption-seo skill: an English caption, an optional Roman-Urdu version, 8–15 local hashtags (Sialkot, treatment), the CTA, and the clinic phone from `src/brand.ts` only. The same claim rules apply as on screen.
3. Render a cover still (`npm run still -- <brief> --frame <hook frame>`) and copy it to `out/<id>.cover.png`.
4. Optional, if asked: a CapCut finishing package via the capcut-finishing-handoff skill.
5. Summarise what's ready. **Do not post, schedule or boost.** Ask the user to do it, or to explicitly tell you which connector to use.
