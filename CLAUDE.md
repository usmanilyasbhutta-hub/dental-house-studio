# Dental House Studio: instructions for Claude

Brief-driven marketing videos (offers, education, clinical cases) for **Dental House, Sialkot**.
Every video starts as a YAML brief → validated → rendered with Remotion → mastered → QC'd → reviewed → approved by a dentist.

## Golden rules (never break these)
1. **Never publish, post, boost or schedule anything** without the user's explicit go-ahead in this conversation. Final approval is always a dentist's.
2. **Patient privacy:** real case photos live in `public/cases/<case_id>/` and consent forms in `assets/cases/<case_id>/`. Both are gitignored. Never commit them, never upload them anywhere the user didn't ask for, and never show patient names or Dental Align IDs (`DH-0147`) on screen.
3. **Honest clinical content:** before/after photos are shown unwarped and uncropped (`objectFit: contain`, same box). No retouching, no AI-generated "results", no stock smiles presented as patients.
4. **Claims:** no "guaranteed / painless / permanent / best / cheapest / 100% / miracle / cure". The banned list is in `src/brief/compliance.ts`. Education claims need a source (PubMed connector) in `sources`.
5. **Clinic facts** come only from `src/brand.ts` (`clinic`: phone/WhatsApp, Instagram, doctors, address). Don't invent websites, hours or prices. Ask.
6. Music: original or properly licensed only. Never copyrighted tracks.

## Commands
| What | Command |
|---|---|
| Validate briefs (schema + compliance) | `npm run validate -- briefs/` |
| Full pipeline: validate → render → master → QC | `npm run make -- briefs/<file>.yaml` |
| One frame (fast preview) | `npm run still -- briefs/<file>.yaml --frame 90 [--safe-zones]` |
| QC an existing render | `npm run qc -- briefs/<file>.yaml` |
| Visual editor | `npm run studio` |
| Code checks | `npm run check` (typecheck + tests + validate examples) |

**Cloud sessions:** Remotion can't download its browser here, so set
`export REMOTION_BROWSER=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`
(check the exact folder with `ls /opt/pw-browsers`). On a normal PC, leave it unset.

## Layout
- `briefs/`: one YAML file per video. `briefs/examples/` holds demo briefs (watermarked, never publish).
- `src/brief/`: `schema.ts` (the contract), `compliance.ts` (rules), `timing.ts` (scene lengths = duration).
- `src/templates/`: `Offer`, `Education`, `ClinicalCase`, and `shared/` (Backdrop, Hud, Headline, Step, EndCard, SafeZones).
- `src/brand.ts`: palette, fonts, clinic facts, safe zones. **Change brand values only here.**
- `scripts/`: render, qc, make, validate, brand_assets.py, demo_assets.py.
- `out/`: final mp4s. `qc/<id>/`: report.md, contact.jpg and frames. Both gitignored.

## Brand decisions (owner, Nov 2026)
- Two themes per brief: `theme: brand` (slate/bronze, default) for promos/offers/cases, `theme: editorial` (cream + deep green) for doctor-led education. Black/mint neon is retired. Tokens live in `src/theme.ts`; templates use `useTheme()`, never raw colours.
- Instagram **@dentalhousesktt** (two Ts). 0323-7560160 is phone **and** WhatsApp. Both live in `src/brand.ts`.
- Captions follow whatever is spoken (English, Urdu or mixed): `language: as-spoken`.

## Brand (from the dental-house-brand-reel skill)
Slate `#333C39`, slateDeep `#1C2220`, bronze `#816951`, bronzeDark `#3D3622`, bronzeLight `#C9AB86`, mist `#C4CACA`, white `#F7F8F6`.
Oswald 600/700 uppercase headlines, Instrument Serif Italic for one accent word, JetBrains Mono labels.
Calm tone for education (no glitch cuts), contemporary allowed for offers.
White logo bug top-left over dark; full-colour logo only on light backgrounds.

## Video specs (QC enforces these)
1080×1920, 30 fps, H.264 yuv420p (TV range, BT.709), AAC 48 kHz, −14 LUFS ±2, true peak ≤ −1 dBTP, ≤ 90 s.
Safe area: keep text out of the top 220 px, bottom 380 px, right 140 px and left 60 px (Instagram/TikTok UI).
The logo bug and HUD label sit in the top band on purpose. They're decorative, not information.

## How to work
- **New video:** use `/new-video`. Interview the user, then write the brief, preview 3 stills, and wait for approval before the full render.
- **After any render:** run QC, then **look at `qc/<id>/contact.jpg` yourself** (Read the image) and report what you see. The `visual-qc` agent does this in a fresh context.
- **Before calling a video ready:** run `/review` (clinical-reviewer + brand-reviewer + visual-qc agents). Fill in the `review:` block only when the user says a dentist approved it.
- **Changing templates:** keep all three templates working. Run `npm run check` and render one still of each example to confirm visually.
- When the user corrects something, ask whether it should become a permanent rule. If yes, add it to this file (brand/tone) or to `compliance.ts` (claims).

## Effects
Effects library in `src/fx/` (transitions, text/overlay/annotation effects, generated sound effects). Read `docs/effects.md`
before using one. Briefs choose `fx.transition` and `fx.sfx`, and talking-head callouts can set `fx`.
Never put sparkle, glow, shine or light leaks on clinical photos. No `Glitch` or `Shake` in education or clinical videos.
`npm run gallery` renders every effect for review.

## Animation, photos and footage
Use the project skill `dental-animation` (`.claude/skills/dental-animation/SKILL.md`): 3D procedure explainers
(`type: procedure`), photo layouts (`type: photo-layout`: annotate / split / grid, loupe), and the ffmpeg toolkit
(`npm run ff -- help`). Overview: `docs/animation-toolkit.md`. 3D videos keep the "Illustration · not to scale" label.

## Style profile
Read `docs/style-profile.md` before writing a brief or changing a template. It records what the owner likes (real footage, doctor cut-outs,
kinetic type + serif accent word, numbered structure, Roman-Urdu word captions, annotated clinical close-ups) and the mistakes to avoid
(captions in the bottom 20 %, cut-off watermarks, skin colour cast, mixed visual families). New reference videos go into `references/inbox/`
(gitignored) and are measured with `python3 scripts/analyze_reference.py`.

## Roadmap (see docs/roadmap.md)
Urdu (Nastaliq) captions and voiceover captions · clinic b-roll from the Projects folder · CapCut draft export · Google Sheets content calendar · scheduled weekly drafts.
