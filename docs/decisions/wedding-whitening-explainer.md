# Decision sheet: wedding whitening package explainer

Brief: `briefs/2026-11-wedding-whitening-explainer.yaml` · type `package-explainer` · owner request (14 Nov 2026):
"Now with new glbs make this video as a technical explainer for our wedding whitening package which includes scaling,
bleaching and whitening."

| Choice | Decision | Reason / source |
|---|---|---|
| Look | `theme: brand` (slate/bronze) | Package promo → brand look (T01, firm) |
| Format | 1080×1920, 30 fps, ≈50 s, music + subtle sfx | CLAUDE.md video specs; under 90 s |
| Mode | EXPLAIN (secondary DESIRE) · procedural process film inside premium cosmetic · start: "what actually happens?" → end: "careful, real, I can book" · risk: bargain urgency, fake whiteness | creative-direction §2, §10; T19 |
| Concept | The real treatment, step by step: each tool shown as it is, then at work on the patient's real teeth | creative-direction §2 |
| DHS anchor | The patient's real photos and the clinic's own approved treatment sequence | creative-direction §3 (real where it proves) |
| Opening | Action already in progress: scaler working on the real photo, small headline over it (no logo intro, no title card) | T13; creative-direction §6. Alternatives considered: tool-to-mouth match cut; outcome-first after photo (rejected: spends the payoff) |
| Structure | Opening → 01 Scaling (tool → at work) → 02 Bleaching (barrier + light → at work; gel + suction → at work) → 03 Polish (tool → at work) → result (held still) → what's included → end card | Numbered structure (T08); owner named the three parts |
| Motion language | Calm, precise. Hero: the instrument at work. Support: 3D turntable + callouts. Hard cuts between beats; nothing else moves on the result | T17; creative-direction §7 |
| "Technical" | Each step opens on its instruments as 3D models (the new GLBs, three.js) with thin textbook callouts, then cuts to the clinical illustration | Owner asked for the GLBs and a technical explainer; T09 (textbook annotation, lean); T11 (three.js first, lean) |
| Instrument labels | No brand or product names on any model or in any text | T06 (firm): "Generic is better." The v8/v9 study renders keep brand labels; this video uses the `--generic` build |
| Clinical clip | Unbranded re-render of the approved v9 sequence; shown in a 4:3 window of the 16:9 clip, labelled "Illustration on a real photo" | Golden rule 3 (honest clinical content); same approved sequence and timings |
| Result | Before and after shown whole (`objectFit: contain`) in identical boxes, "Same patient · different photo angles · not retouched · results vary" | Golden rule 3; T19 (different angles are not a matched comparison) |
| Included list | Dentist assessment first · Scaling + polishing · Gum protection · In-office whitening · About 45–60 min | Owner's package facts (WhatsApp skill); no price shown until the owner says so |
| Price | Not shown | Clinic facts rule: the offer (PKR 21,000 until 15 Dec) is time-limited; owner to decide |
| Step 03 name | "Polish" (not "Whitening") | Polishing smooths and brightens but does not whiten; naming it whitening would overclaim. Owner, 14 Nov: "Keep that" |
| Pace | Opening 2.4 s; tool beats 2.4–2.8 s; clips sped 1.1–1.7× (3.5–7 s); result held 5 s; ≈47 s total | creative-direction §6 (runtime follows the action) |
| Music / sfx | `audio/pad-calm.mp3`, no whoosh or pops | T17 (no zoom-whoosh); music preference still an open question |
| Language | English on screen | As in previous procedure briefs; Roman Urdu possible on request |

Not yet possible: posting. The before/after needs the signed consent form at `assets/cases/whitening-v9/consent.pdf`
(validation blocks the render until it exists), and a dentist's approval in `review:`.

## Revision 14 Nov (after the creative-direction handoff)
Diagnosis of the first previews: opening was a text headline over floating models (Concept, major: T13); soft fades and
whoosh sounds (Motion, minor: T17); spec sublines repeated the clip captions (Restraint, minor); before/after note did
not say the photos differ in angle (Proof, major: T19). Modified those layers only; instruments, clips, steps and the
approved treatment sequence preserved. Pending owner: headline type (creative-direction C1) and the logo bug on every
frame (C2).
