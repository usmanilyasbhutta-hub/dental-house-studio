# Decision sheet: wedding whitening package explainer

Brief: `briefs/2026-11-wedding-whitening-explainer.yaml` · type `package-explainer` · owner request (14 Nov 2026):
"Now with new glbs make this video as a technical explainer for our wedding whitening package which includes scaling,
bleaching and whitening."

| Choice | Decision | Reason / source |
|---|---|---|
| Look | `theme: brand` (slate/bronze) | Package promo → brand look (T01, firm) |
| Format | 1080×1920, 30 fps, ≈50 s, music + subtle sfx | CLAUDE.md video specs; under 90 s |
| Structure | Hook → 01 Scaling → 02 Bleaching → 03 Polish → result → what's included → end card | Numbered structure (T08, lean); owner named the three parts |
| "Technical" | Each step opens on its instruments as 3D models (the new GLBs, three.js) with thin textbook callouts, then cuts to the clinical illustration | Owner asked for the GLBs and a technical explainer; T09 (textbook annotation, lean); T11 (three.js first, lean) |
| Instrument labels | No brand or product names on any model or in any text | T06 (firm): "Generic is better." The v8/v9 study renders keep brand labels; this video uses the `--generic` build |
| Clinical clip | Unbranded re-render of the approved v9 sequence; shown in a 4:3 window of the 16:9 clip, labelled "Illustration on a real photo" | Golden rule 3 (honest clinical content); same approved sequence and timings |
| Result | Before and after photos shown whole (`objectFit: contain`) in identical boxes, "Same patient · photos not retouched · results vary" | Golden rule 3; claims rule (results vary) |
| Included list | Dentist assessment first · Scaling + polishing · Gum protection · In-office whitening · About 45–60 min | Owner's package facts (WhatsApp skill); no price shown until the owner says so |
| Price | Not shown | Clinic facts rule: the offer (PKR 21,000 until 15 Dec) is time-limited; owner to decide |
| Step 03 name | "Polish" (not "Whitening") | Polishing smooths and brightens but does not whiten; naming it whitening would overclaim. **Open question to the owner** |
| Pace | Spec beats 2.8–3 s, clips sped 1.1–1.7× (5–7 s) | Ledger open question; calm procedural pace (education-like) |
| Music | `audio/pad-calm.mp3` | Existing original track; music preference still an open question |
| Language | English on screen | As in previous procedure briefs; Roman Urdu possible on request |

Not yet possible: posting. The before/after needs the signed consent form at `assets/cases/whitening-v9/consent.pdf`
(validation blocks the render until it exists), and a dentist's approval in `review:`.
