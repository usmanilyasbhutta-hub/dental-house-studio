# Review process (who reviews what)

| Stage | Who | How | Catches |
|---|---|---|---|
| Brief | validator (automatic) | `npm run validate` / edit hook | banned claims, privacy (IDs), consent, unknown phone/handle, comma-split text |
| Direction | **owner** | `/options`: pick A/B/C from stills | taste, message, tone |
| Preview | Claude | stills with `--safe-zones` before full render | layout, overlap, safe area |
| Render | QC script (automatic) | `npm run qc` | specs, loudness, black/frozen frames |
| Content | `clinical-reviewer` agent | PubMed-checked | overstated/unsupported claims, missing caveats |
| Brand | `brand-reviewer` agent | brief vs brand rules | voice, accent words, CTA, facts |
| Visual | `visual-qc` agent | frames + contact sheet | defects, cut-outs, collisions, legibility |
| Editing | `editor-reviewer` agent | viewer/editor scorecard /40 | weak hook, pacing, readability, ending |
| Clinical sign-off | **dentist** | watches the final video | accuracy, consent, "would I show this to a patient" |
| After posting | owner + Windsor.ai | reach, watch-time, saves (Instagram) | what patients actually watch → style profile |

`/review <brief>` runs the four agents in parallel plus `npm run check`, and writes `qc/<id>/review.md`.
Never upload patient videos/photos to third-party "virality" or AI services.
