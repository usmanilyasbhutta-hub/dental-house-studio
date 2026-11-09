---
description: Interview me, write a brief, preview stills, then render + QC a new video
argument-hint: [offer|education|case] [topic]
---
Create a new Dental House video. Type/topic hint: $ARGUMENTS

1. **Interview** (one short message, all questions at once). Ask only what's missing:
   - offer: what's offered, price (or "free"), valid until, terms, 3 selling points, CTA
   - education: topic, the ONE thing viewers should remember, audience
   - case: case_id, treatment, visits/duration, photos placed in `public/cases/<case_id>/`, consent form in `assets/cases/<case_id>/` with scope incl. social media, whether the patient is identifiable
2. **Education only:** find 1–3 supporting sources with the PubMed connector. Write steps that say no more than the sources support.
3. **Write the brief** at `briefs/<yyyy-mm>-<slug>.yaml`. Copy the structure of the matching file in `briefs/examples/`, set `demo: false`, and respect the schema's length limits. The edit hook validates it, so fix any errors it reports.
4. **Preview:** render 3 stills (hook, middle, end card) with `--safe-zones`, Read them, and show the user what you see. **Wait for approval.**
5. **Render:** `npm run make -- <brief>`. Then Read `qc/<id>/contact.jpg` and report every visual issue you find honestly.
6. Finish with: video path, QC result, open issues, and "next: /review, then dentist approval". Do not publish.
