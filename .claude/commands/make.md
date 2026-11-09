---
description: Validate, render, master and QC a brief, then visually inspect the result
argument-hint: briefs/<file>.yaml
---
Run `npm run make -- $ARGUMENTS`. If it fails, explain why in plain words and propose the fix (don't weaken checks to make it pass).
If it passes, Read `qc/<id>/contact.jpg` (red outline = safe area) and check: text inside the safe area and legible, no overflow, brand colours and fonts, logo not distorted, before/after unwarped, end card facts match `src/brand.ts`. Report PASS/ISSUES with frame numbers.
