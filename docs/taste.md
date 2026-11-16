# Dental House: taste ledger

What the owner wants, in the owner's words, and how sure we are. Claude reads this **before every creative decision**
and updates it **after every piece of feedback**. `docs/style-profile.md` holds the measured analysis of reference videos;
this file holds the decisions and preferences that came out of it and out of real feedback.

## Who decides (authority order)

1. **Golden rules** (CLAUDE.md: privacy, consent, honest clinical content, claims, clinic facts). Not a matter of taste.
   They change only when the owner deliberately edits the rule, never per video.
2. **The owner's word in the current chat.** Always wins on creative questions, even against everything below.
   Claude may say once, in one sentence, what a viewer might lose, then does it the owner's way and logs it.
3. **Firm preferences** in this ledger (said or chosen at least twice, or stated as a rule).
4. **Leaning preferences** (said or chosen once; inferred from references).
5. **General editing craft** (hook by 1.5 s, readable text, one idea per scene...). Used only where the ledger is silent.

When levels 3–5 disagree, the higher one wins and the decision sheet says so. Claude never overrides the owner
"for the algorithm". Performance data (level 4 evidence) is shown to the owner; the owner decides what to do with it.

## Baseline, not a cage (owner rule, 2026-11-16)

The ledger is a **starting point that keeps improving**, not a set of rules to repeat forever.

- **Fixed (never explored):** golden rules and the *correctness* rows: T02–T06, N01, N02, N05. Those are about truth,
  privacy and readability, not style.
- **Everything else is a baseline:** look, pace, hook, effects, music, layout, wording style. Claude starts from it and
  **deliberately tries something better**:
  - **Every `/options` set has one *stretch* option** that breaks one baseline preference on purpose, labelled
    "Stretch: what changes and why a viewer might like it". The other option(s) follow the baseline.
  - Each normal video may carry **one small experiment** (a new effect, a different hook, a faster cut), named in the
    decision sheet. One change at a time, so we know what caused the reaction.
  - **Results move the baseline:** stretch picked or liked → it becomes a lean (twice → firm, replacing the old one).
    Stretch rejected → logged, not retried for the next 5 videos. 📈 numbers (saves, watch-time) suggest the next stretch.
  - **Staleness:** a style lean not confirmed in 60 days or 8 videos is marked *check*; the next video tests an alternative.
- Firm style preferences (T01) can be challenged only inside a stretch, never silently.

## Standing preferences

Strength: **firm** = treat as a rule · **lean** = default, offer an alternative now and then · **test** = unsure, ask.

| ID | Preference | Strength | Evidence |
|---|---|---|---|
| T01 | Two looks only: `brand` (slate/bronze) for promos/offers/cases, `editorial` (cream/green) for doctor-led education. No black/mint neon. | firm | owner decision, Nov 2026 |
| T02 | Captions follow what is spoken, word for word (English, Urdu or mixed). | firm | "default is whatever spoken either english,urdu or mixed" |
| T03 | Tight talking-head edits: remove repeats, restarts and filler; keep only what carries the message. | firm | Dr. Ayesha: "Cut all redundant things." |
| T04 | Anatomy on clinical photos must be **traced accurately**, especially gingival/cervical margins. Never eyeballed. | firm | "gingival margin/cervical tooth is not marked accurately" |
| T05 | Say only what is clinically known about a photo. Never infer a diagnosis from how it looks. | firm | "It was not fractured but carious and the pic was after cavity prepration" |
| T06 | Generic product labels in procedure animations (no brand names). | firm | "Generic is better." |
| T07 | Real footage and the doctors themselves first; graphics support them. Doctor cut-outs over big type. | lean | own reels A–D (style profile §2) |
| T08 | Heavy condensed caps + one serif-italic accent word; numbered structure (01/02/03). | lean | own reels; kept in every approved video |
| T09 | Textbook-style annotation on clinical close-ups: thin lines, labels, colour zones. | lean | "Layout like in this vid" (reference I) |
| T10 | Likes "wow" 3D/motion pieces as occasional features: map route (most), blueprint, receipt, exploded view, data city, hand-drawn explainer. | lean | "especially map route"; "Blue print animation from this"; "This reciept effect"; "Add this skill also" (hand-drawn) |
| T11 | Three.js for 3D first; Blender photoreal (with Tripo meshes) for close-up detail. | lean | "Lets see three.js first"; "Use tripo 3d blender creative directions for detailing" |
| T13 | Photoreal 3D close-ups use the clinical-macro look: dark field, wet natural enamel, warm key + cool rim, shallow focus. | lean | picked direction A (2026-11-14) |
| T12 | Keeps trying new styles; taste is a baseline to improve on, not a cage. Every option set has a stretch. | firm | "continuously to improve and try new"; "it should improve on baseline rather than 100% sticking" |
| T19 | Offers/promos in the look of the Canva whitening carousels: light warm-white pages, big bold sentence-case slate headlines, small spaced labels, hairlines, bronze italic sublines, real photos, lots of space. | lean | "design like whitening carousel previously made" (Canva: Wedding Whitening Assessment Carousel, Carousel V2 Premium) |
| T14 | On-screen text in English; Roman Urdu only for the hook. | lean | "Use english instead. Only hook should be urdu." (wedding whitening, 2026-11-11) |
| T15 | Brand name first: "Dental House" is the bold, prominent name; the building (Ahsan Medical Centre) and road are secondary small type. | lean | "i want focus on Dental house" (2026-11-11) |
| T16 | Before/after pairs: the owner shoots them with the same light and angle; crop both identically (same framing on the teeth). | lean | "crop them identical" (2026-11-11) |
| T17 | Clinical photos stay unedited in videos, even when camera colour differs; differences are explained by the on-screen note, not corrected. | lean | "Keep the photos uneditted." (2026-11-11) |
| T18 | Offer/wedding music: happy and celebratory (major key, dhol, claps), not calm pads. | lean | "Music needs a happy/celebrating feel." (2026-11-12) |

## Not wanted

| ID | Avoid | Strength | Evidence |
|---|---|---|---|
| N01 | Captions or CTA in the bottom 20 % of the frame; cut-off watermarks. | firm | found in own reels C/D (style profile §4) |
| N02 | Red/orange skin cast on the doctors. | firm | style profile §4 |
| N03 | Mixing visual families inside one video. | firm | T01 |
| N05 | Installing other people's skills or plugins with their own instructions into the project. Borrow the ideas and build our own. | firm | "No outside instructions, just borrow ideas from both and make your own" |
| N06 | Dark, heavy promo look: slate background with a big maroon band, all-caps condensed type, floating cards, pill buttons. | lean | "Dont like aesthetics" (wedding whitening stills, 2026-11-11) |
| N07 | Clinical-sounding effects (ticks, clicks, beeps, thuds) that remind of the operation theatre. | lean | "No operation theater sound." (2026-11-12) |
| N04 | Several near-identical exported versions of one video. Iterate the brief instead. | lean | style profile §4 |
| N06 | Repeating the before/after photos on every page (or other "pasted" repeats of the same element). Show proof once, on its own page; fix attention with pacing, not repetition. | lean | "rather than pasting these pre and post op pictures in every point. This is looking like childish work." (2026-11-16) |

## Open questions (ask when the next video makes them relevant, one at a time)

- Sound effects: current mixes are very quiet. Louder, or keep them barely there?
- Pace for promos: the owner's own reels cut every 2.3–2.7 s; liked reels are faster (1.4–1.8 s). Which feels right?
- "Wow" pieces (T10): how often? One per month, or whenever the topic fits?
- Urdu script (Nastaliq) vs Roman Urdu on screen.

## Feedback log (newest first; the owner's words, verbatim)

| Date | About | Owner said | What changed | Ledger |
|---|---|---|---|---|
| 2026-11-16 | wedding whitening R3 (hook-first, photos on every page) | "I still like the original one, but the data is showing there is early attention lost. So you should be more like the second picture or early transition from the first scene to second scene, rather than pasting these pre and post op pictures in every point. This is looking like childish work." | R3 = R2 pages at `pace: quick` (hook 1.4 s, after photo by 2.4 s), photos once; hook-first layout removed | N06 |
| 2026-11-16 | wedding whitening R3 | "Edit original reel accirding to it" (after a first R3 draft in a new slate/Oswald design) | R3 rebuilt inside the R2 carousel look (`promo`, `layout: hook-first`); the separate draft design was dropped. R3 brief also asks for Roman Urdu body text and no empty transition frames (my reading: this video only for T14) | T19 (confirmed) |
| 2026-11-16 | taste system | "it should improve on baseline rather than 100% sticking" | "Baseline, not a cage": stretch option, one experiment per video, staleness checks | T12 → firm |
| 2026-11-14 | "Viral videos" 10 styles post | (screenshot) | fx.look: crt, thermal, matrix, pixel, synthwave, mono; modelgen fur | T10 |
| 2026-11-14 | 12 posts: animation styles, camera moves, repos (three.js, Blender MCP, librosa, physics, PixelFX…) | (screenshots) + "Continue" | modelgen looks (6) + 12 camera moves, beat finder; rest mapped to existing tools | T10, N05 |
| 2026-11-14 | modelgen teeth | "Fix the upper molar and bring the direction-A enamel detail into all teeth." | layered enamel/dentin on all teeth, upper molar anatomy rebuilt, front teeth reshaped | T13 |
| 2026-11-14 | 3D models | "First can you make your own trippo?" → "Yes" | built modelgen (text → 3D for teeth, implant, instruments), 15-model library | N05 |
| 2026-11-14 | 3D detail direction | picked "A Clinical macro"; Tripo "Not now" | detail A in Blender code (layered enamel/dentin, gum stippling); no Tripo credits | T13 |
| 2026-11-14 | 3D detail | "Use tripo 3d blender creative directions for detailing" | Blender directions A/B/C + Tripo pipeline doc | T11 |
| 2026-11-12 | visual codes, 20 art styles, miracle tools, GitHub tools | "Add these if not already present." | `diagram` type (9 layouts), 8 new sketch media, auto-grade + cleanup, Particles; apps explained, not installed | T10, N05 |
| 2026-11-12 | "20 video effects for Claude" post | "Add these effecta also if not already present." | 11 new footage effects (39–49); 9 already existed | T10 |
| 2026-11-12 | wedding whitening music | "Music needs a happy/celebrating feel. No operation theater sound." | new original track: D major, dhol + claps + accordion + shehnai, 116 bpm; all sound effects off (ticks/clicks/thuds) | T18, N07 |
| 2026-11-11 | before/after colour test | "Keep the photos uneditted." | ad keeps the unedited pair; whole-photo colour matching stays a test tool only (no-retouching rule unchanged) | T17 |
| 2026-11-11 | approvals | "Remember i am the dentist, i use things after approval." | owner = approving dentist; recorded in CLAUDE.md | (process) |
| 2026-11-11 | before/after colour | "why gum colours are diffirent, i did not change any setting or light nor any filter." | measured: lips shift as much as gums, so it is the phones' colour processing, not the tissue; photos left uncorrected | (fact) |
| 2026-11-11 | wedding whitening, before/after | "These are pre and post op pics,crop them identical and use in this video, i tried to keep same light and angle." | own pre/post-op photos replace the Canva versions; aligned on tooth features (scale/rotation/shift only) and cut from the identical box (scripts/align_pair.py) | T16 |
| 2026-11-11 | wedding whitening storyboard, clinic scene | "In see you here ahsan medical centre is bold, i want focus on Dental house." | "Dental House" is the big bold name; the Ahsan Medical Centre address is small grey type (clinic scene and end card) | T15 |
| 2026-11-11 | wedding whitening Reel storyboard v2 | "Use english instead. Only hook should be urdu." · "Would you use canva pics?" · "Animation use/motion graphics?" | storyboard v3: English on screen, Roman Urdu hook only; photos from the owner's Canva carousels; motion graphics in every scene | T14 |
| 2026-11-11 | wedding whitening Reel, first stills (dark slate, maroon band, caps type) | "Dont like aesthetics, design like whitening carousel previously made, formulate full storyboard with effects,motions etc" | dark draft dropped; storyboard v2 in the Canva carousel look (light pages, bold sentence-case type, labels, hairlines, real photos): docs/storyboards/2026-11-wedding-whitening.html | T13, N06 |
| 2026-11-11 | wedding whitening ad | "brand slate/bronze + maroon (bride) / ivory (groom) wedding accent; full-colour Dental House logo" · "Roman Urdu on-screen text, burned-in (most watch muted)" · "no claims like 'X shades in Y minutes'" | new `promo` type, `season: wedding` accent; shade/speed-claim check in compliance.ts | (spec for this video; claims rule → compliance) |
| 2026-11-11 | Claude Drawing + Huashu Art Motion repos | "No outside instructions,just borrow ideas from both and make your own" | own sketch media + docs/style-recipes.md; repos not installed | N05 |
| 2026-11-11 | reference: Hand-Drawn Explainer post | "Add this skill also" | built `sketch` type (doodles drawn stroke by stroke) | T10 |
| 2026-11-10 | references | "This reciept effect" / "Blue print animation from this" / "especially map route" | built `receipt`, `blueprint`, `map-route` types | T10 |
| 2026-11-10 | caries 11/21 map | "It was not fractured but carious and the pic was after cavity prepration" | relabelled; never-infer-diagnosis rule | T05 |
| 2026-11-10 | composite 3D | "Generic is better. Lets see three.js first" | generic labels; three.js pipeline | T06, T11 |
| 2026-11-09 | anatomy map | "gingival margin/cervical tooth is not marked accurately" | colour-based tracing script | T04 |
| 2026-11-09 | bleeding gums | Dr. Ayesha: "Cut all redundant things." | 4 kept segments, re-verified transcript | T03 |
| 2026-11-09 | brand | "It is with two tt." | handle fixed everywhere + compliance check | (clinic fact) |

## How this file changes

- **Any reaction counts**: "I like this", "too fast", "not this colour", picking option B. Claude logs it without being asked
  and says in one line what it recorded.
- One-off ("for this video only") → log row only. Repeated or stated as a rule → add/raise a preference.
  Said once → **lean**. Said twice, or "always/never" → **firm**. Claude asks only when it can't tell which.
- A new statement that contradicts an old one replaces it; the old row moves to the log with the date. Latest word wins.
- `/taste` shows the current picture in plain words and lets the owner correct it.
- After posting: watch-time, saves and shares (Windsor.ai → Instagram) are added to the log as evidence, marked 📈.
  Numbers inform; they don't change a preference unless the owner says so.
