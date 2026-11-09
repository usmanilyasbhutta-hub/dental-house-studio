# Dental House: editing style profile (v1)

Built from 14 reference videos (Nov 2026): the clinic's own reels made with Claude/ChatGPT, personal projects,
and Instagram videos the owner likes. Measured with `scripts/analyze_reference.py`; frames reviewed by eye.
Videos and frames stay in `references/` (gitignored). This file holds descriptions and numbers only.

> **Status: draft.** Items marked ❓ need the owner's decision. Rules marked ✅ are already applied in the pipeline.

## 1. What was analysed

| # | Video | Kind | Look | Pace (avg shot) | Notes |
|---|---|---|---|---|---|
| A | DentalHouse_Reel_30s_Instagram | Own · consultation promo | **Slate/bronze**, real clinic footage | 2.5 s | Kinetic headline over footage, numbered steps 01-03, split screen doctor/patient, logo-wall, light end card |
| B | DentalHouse_Reel_v2_phone | Own · same, phone cut | same | 2.3 s | 25 s version of A |
| C | DentalHouse_BleedingGums_Clinical | Own · education, talking head | **Black + mint/teal neon** | 2.7 s | Dr Ayesha cut-out, Roman-Urdu word captions, big numerals, icon graphics (H₂O₂, vitamin C, calendar) |
| D | DHS_Dr_Ayesha_Hybrid_Review_v7 + 3 earlier versions | Own · education, talking head | **Cream + deep green editorial** | 4.5 s | Same topic iterated 4×: split layout, PiP circle, tooth macro, flat illustrations, "Check-up book karein" end |
| E | Burhan_IqbalDay_Reel | Personal | Cream + gold, **Urdu Nastaliq** | 6.7 s | Word-by-word Urdu karaoke captions, name lower-third, glow on subject, verse end card |
| F | superhero_scooter_v3 | Personal | VFX | 11.5 s | Glow outline on subject, energy trails, shadow FX |
| G | Coffee "Home made" | Personal | Warm still | (one shot) | 2.5D photo animation + text reveal |
| H | Veneers macro (liked) | Liked · procedure | Black background, macro | 9.5 s* | Step-by-step on a black field, product shots slide in, colour-coded layers, clean logo end |
| I | Class II anatomy map (liked) | Liked · education | Blue dam, line art | 11.5 s* | Thin-line callouts + labels drawn on an intraoral photo, colour-coded cusps, "The Final Result" |
| J | Endo build-up (liked) | Liked · procedure | Blue dam | 1.4 s | Fast clinical steps, ends on dark overlay + handle |
| K | Canva workshop (liked) | Liked · promo | Bold type | 1.8 s | Image masked inside huge letters, script signature, screen-recording "how it's made" |

*Few hard cuts, but continuous motion (dissolves, morphs, drawing animations): motion energy 14.4 and 1.8.

## 2. What you consistently like

1. **Real footage first.** Your own reels are built on the doctors, the chair, the clinic and the logo wall, not pure graphics. ✅ v0.1 templates are graphics-only, so this is the biggest gap (see §5).
2. **Doctor as a cut-out** with an outline or sticker edge, layered over or behind big typography (A, C, D, E, F).
3. **Kinetic editorial typography:** heavy condensed caps + one italic serif accent word ("*important*", "*Treat it simply.*", "*book karein.*"). ✅ in templates.
4. **Numbered structure** (01/02/03, "4 causes", "Fix 01–05"), so viewers know where they are. ✅
5. **Roman-Urdu speech + English on-screen keywords**, captions word-by-word with the active word highlighted (C, D, E). Not built yet.
6. **Clinical close-ups annotated like a textbook:** thin callout lines, labels, colour-coded zones (H, I). Not built yet.
7. **Procedure step-by-step** with products and instruments sliding in (H, J). Not built yet.
8. **Calm premium end card:** light background, logo, serif tagline, pill CTA, phone, doctors. ✅
9. **Subtle VFX for wow moments:** glow outline, light sweep, sparkle on a word ("shabash!") (E, F).

## 3. Measured house numbers (your own reels A–D)

| Property | Your reels | Liked reels | Rule for us |
|---|---|---|---|
| Length | 13.6–30 s | 12.7–38 s | 15–30 s (education ≤ 35 s) |
| Average shot | 2.3–2.7 s (promo), 4.5 s (talking head) | 1.4–11.5 s | Promo 2–2.7 s · talking head 3–4.5 s · procedure: continuous |
| First change | 2.0–3.5 s | about 1 s | **Something must change by 1.5 s.** Measured hook change at 2–3.5 s is a bit slow |
| Loudness | −11.7 to −16.1 LUFS | −12.7 to −13.7 | −14 LUFS (✅ mastering normalises). Reels A/B were too loud, D too quiet |
| Resolution | D exported at 720×1280 | mostly 720p | Always 1080×1920 (✅) |

## 4. Issues found in your existing videos (to avoid from now on)

| Issue | Where | Fix in pipeline |
|---|---|---|
| **Captions and CTA in the bottom 20 %**, under Instagram's caption/username area | C (main captions), D ("brush twice a day", WhatsApp number) | ✅ QC safe-area outline; caption template must sit at 58–72 % height |
| **Handle watermark cut off** at the left edge ("ALHOUSESKTT") | D (all 4 versions) | Graphics only from templates; QC frame review |
| **Strong red/orange colour cast on skin** in the talking-head footage | C, D | Add a footage grade step (white balance + skin tone) before compositing |
| **Three different looks for one clinic**: slate/bronze (A), black/mint neon (C), cream/green editorial (D) | | ❓ pick a family, see §6 |
| Exported at 720p and −16 LUFS | D | ✅ mastering forces 1080p specs and −14 LUFS |
| 4 near-identical versions of D | D | Versioning: one brief, iterate the brief and re-render. Diffs stay in git |

## 5. Templates to add (priority order, proposed)

1. **TalkingHead** (from C/D): doctor footage (cut-out or framed), Roman-Urdu word-by-word captions with highlighted keywords, chapter numerals, icon/graphic inserts, auto skin grade. *Most of your content is this.* Needs: the raw recording + transcript (Descript can transcribe; local Whisper is blocked here).
2. **ClinicTour / Promo** (from A/B): the v0.1 Offer template plus footage slots (`broll:`), split screen, logo-wall pan.
3. **AnatomyMap** (from I): intraoral photo + animated line callouts and colour zones. Great for education *and* for cases, because it explains without editing the photo.
4. **ProcedureSteps** (from H/J): ordered clinical photos/clips with product callouts and a step counter.
5. **Celebration / Culture** (from E): Urdu Nastaliq captions, cream/gold, for Iqbal Day, Eid, Independence Day and patient milestones. Needs an Urdu font (Noto Nastaliq Urdu).
6. FX library: glow outline, light sweep, sparkle word, 2.5D photo move (from E/F/G).

## 6. Decisions needed ❓

1. **One visual family or two?** Recommendation: keep **slate/bronze** as the master brand (logo colours, used in A/B), and allow a **"clinical-education" variant** (cream + deep green, as in D) for talking-head education. Retire black/mint neon (C), because it doesn't match the logo.
2. **Instagram handle:** your videos show `@dentalhouseskt`. Confirm it, and I'll add it to `src/brand.ts` (currently not allowed on screen because it's unconfirmed).
3. **WhatsApp:** is 0323-7560160 also the WhatsApp booking number?
4. **Captions language default:** Roman Urdu speech with English keywords (as in C/D)?
5. **Liked videos from other clinics** (H, I, J, K) are style references only. We never reuse their footage, logos or music.

## 7. How this profile keeps improving
Drop new videos into `references/inbox/`, then run `python3 scripts/analyze_reference.py references/inbox/*` and ask Claude to update this file.
Add one note per video: ⭐ my style / ✗ don't like / 📈 performed well (Instagram numbers via Windsor.ai).
