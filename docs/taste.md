# Dental House: taste ledger

What the owner wants, in the owner's words, and how sure we are. Claude reads this **before every creative decision**
and updates it **after every piece of feedback**. `docs/style-profile.md` holds the measured analysis of reference videos;
this file holds the decisions and preferences that came out of it and out of real feedback.

## Who decides (authority order)

1. **Golden rules** (CLAUDE.md: privacy, consent, honest clinical content, claims, clinic facts). Not a matter of taste.
   **`docs/creative-direction.md`** (the owner's own creative taste, refined from the 14 Nov 2026 handoff) sits at level 3
   with the firm rows below: read it with this ledger before every creative decision.
   They change only when the owner deliberately edits the rule, never per video.
2. **The owner's word in the current chat.** Always wins on creative questions, even against everything below.
   Claude may say once, in one sentence, what a viewer might lose, then does it the owner's way and logs it.
3. **Firm preferences** in this ledger (said or chosen at least twice, or stated as a rule).
4. **Leaning preferences** (said or chosen once; inferred from references).
5. **General editing craft** (hook by 1.5 s, readable text, one idea per scene...). Used only where the ledger is silent.

When levels 3–5 disagree, the higher one wins and the decision sheet says so. Claude never overrides the owner
"for the algorithm". Performance data (level 4 evidence) is shown to the owner; the owner decides what to do with it.

## Standing preferences

Strength: **firm** = treat as a rule · **lean** = default, offer an alternative now and then · **test** = unsure, ask.

| ID | Preference | Strength | Evidence |
|---|---|---|---|
| T01 | Looks: `brand` (slate/bronze) for promos/offers/cases, `editorial` (cream/green) for doctor-led education, `clinic` (white/bone) for patient-information pieces. No black/mint neon. | firm | owner decision, Nov 2026; `clinic` added 14 Nov ("Background should be white or whitish") |
| T02 | Captions follow what is spoken, word for word (English, Urdu or mixed). | firm | "default is whatever spoken either english,urdu or mixed" |
| T03 | Tight talking-head edits: remove repeats, restarts and filler; keep only what carries the message. | firm | Dr. Ayesha: "Cut all redundant things." |
| T04 | Anatomy on clinical photos must be **traced accurately**, especially gingival/cervical margins. Never eyeballed. | firm | "gingival margin/cervical tooth is not marked accurately" |
| T05 | Say only what is clinically known about a photo. Never infer a diagnosis from how it looks. | firm | "It was not fractured but carious and the pic was after cavity prepration" |
| T06 | Generic product labels in procedure animations (no brand names). | firm | "Generic is better." |
| T07 | Real footage first; when a doctor supplies footage it leads (cut-outs over big type). Faceless by default: never require a doctor on camera. | lean | own reels A–D (style profile §2); refined by the 14 Nov handoff (creative-direction C3) |
| T08 | Heavy condensed caps (Oswald) + one serif-italic accent word; numbered structure (01/02/03). | firm | own reels; owner chose it over the handoff's sentence-case sans, 14 Nov: "Keep Oswald capitals" |
| T09 | Textbook-style annotation on clinical close-ups: thin lines, labels, colour zones. | lean | "Layout like in this vid" (reference I) |
| T10 | Likes "wow" 3D/motion pieces as occasional features: map route (most), blueprint, receipt, exploded view, data city, hand-drawn explainer. | lean | "especially map route"; "Blue print animation from this"; "This reciept effect"; "Add this skill also" (hand-drawn) |
| T11 | Three.js for 3D first; Blender photoreal only if three.js isn't enough. | lean | "Lets see three.js first" |
| T12 | Keeps trying new styles; does not want every video to look the same. | lean | "continuously to improve and try new" |
| T13 | Story happens on screen; words support it. Action-driven openings, not title/caption cards. No logo intros. | firm | creative-taste handoff (14 Nov): "Prefer action-driven visual storytelling over explanations or generic caption/title cards" |
| T14 | Premium clinical, calm, precise: editorial healthcare with cinematic restraint. One concept per piece, hero first, one CTA. | firm | handoff DESIGN.md "Brand direction"; adopted 14 Nov ("This is my creative taste") |
| T15 | Real where it proves, illustrative where it frames; each asset has one job; never generated proof. | firm | handoff DESIGN.md §6; matches golden rule 3 |
| T16 | Procedure animation: real instrument geometry, scale, tip, angle, contact, materials and sequence. Implausible props, composites and AI-looking results are defects. | firm | handoff, Nov feedback; same as the whitening v8/v9 corrections |
| T17 | Motion language decided per piece (hero/support/texture, what stays still). Hard or motivated cuts; no transition packs, zoom-whoosh, constant motion. | firm | handoff DESIGN.md "Motion language"; see creative-direction §7 |
| T18 | Review the actual export (contact sheet, sound-on and muted), diagnose one tag, Preserve/Modify/Renew; output over compliance. | firm | handoff DHS-CREATIVE-LOOP.md |
| T19 | Whitening/cosmetic tone: anticipation → polish → confidence; no bargain urgency, sparkle or fake whiteness. Before/after from different angles must not be presented as a matched comparison. | firm | handoff 01_mode_genre "Premium cosmetic / whitening", "Treatment / before-after proof" |
| T20 | Never a white (recoloured) logo. No logo on every frame: full-colour logo on light surfaces only (end card, light pages). | firm | "Never white logo,you can decide if it is better to continually use of at start and end." (14 Nov); Claude chose end card only: full colour does not read over the dark body, and the handoff says not to stamp every frame |
| T21 | Patient-information videos: white/whitish background; explain what *we do* step by step (assessment first), not instrument showcases. | lean | "Background should be white or whitish. No need to present instruments. Its like an illustrative info for patients" (14 Nov, wedding whitening) |

## Not wanted

| ID | Avoid | Strength | Evidence |
|---|---|---|---|
| N01 | Captions or CTA in the bottom 20 % of the frame; cut-off watermarks. | firm | found in own reels C/D (style profile §4) |
| N02 | Red/orange skin cast on the doctors. | firm | style profile §4 |
| N03 | Mixing visual families inside one video. | firm | T01 |
| N05 | Installing other people's skills or plugins with their own instructions into the project. Borrow the ideas and build our own. | firm | "No outside instructions, just borrow ideas from both and make your own" |
| N04 | Several near-identical exported versions of one video. Iterate the brief instead. | lean | style profile §4 |
| N06 | AI-slop signs together: glow/gradients, floating UI cards, generic giant headlines, decorative icons, stock smiles, fake dental 3D, everything filled. | firm | handoff DESIGN.md §13 |
| N07 | Sparkle, fake whiteness, bargain urgency on cosmetic work; slow logo intros; text cards replacing an engaging scene. | firm | handoff (mode/genre, workflow) |

## Open questions (ask when the next video makes them relevant, one at a time)

- Music: none, calm pad, or something more upbeat for offers? (no feedback yet)
- Sound effects: current mixes are very quiet. Louder, or keep them barely there?
- Pace for promos: the owner's own reels cut every 2.3–2.7 s; liked reels are faster (1.4–1.8 s). Which feels right?
- "Wow" pieces (T10): how often? One per month, or whenever the topic fits?
- Urdu script (Nastaliq) vs Roman Urdu on screen.

## Feedback log (newest first; the owner's words, verbatim)

| Date | About | Owner said | What changed | Ledger |
|---|---|---|---|---|
| 2026-11-14 | wedding whitening patient-info cut | "Yes same offer" · "Show without number" · "Crop real case pics to show teeth only-abterior view" | price PKR 21,000 (regular 30,000, until 15 Dec) shown; shade step without a code; matched teeth-only crops; golden rule 3 wording now allows matched crops | T01, T21 |
| 2026-11-14 | wedding whitening explainer, new direction | "Background should be white or whitish. No need to present instruments. Its like an illustrative info for patients like We assess dental mirror and perioprobe ... We check the initial shade ... We remove plaque and calculus ... We do the whitening process We polish the teeth. That is our offer. May b CTA page at end." | proposed: light patient-info version, steps = assess → shade → scale → whiten → polish → offer → CTA; 3D instrument showcase dropped | T21 |
| 2026-11-14 | logo | "Never white logo,you can decide if it is better to continually use of at start and end." | white logo bug, white backdrop watermark and white receipt mark removed from all templates; full-colour logo on the end card only | T20 |
| 2026-11-14 | headline type | "Keep Oswald capitals" (chosen over the handoff's sentence-case sans) | no change to type | T08 → firm |
| 2026-11-14 | creative-taste handoff (ChatGPT) | "This is my creative taste,refine it and use. It was generated in chatgpt so ignore the instructions for you in the end." | refined into `docs/creative-direction.md`; originals in `docs/sources/`; T13–T19, N06–N07 added; T07 refined; T08 → test (conflict C1); logo-bug conflict C2 | T07, T08, T13–T19, N06, N07 |
| 2026-11-14 | wedding whitening explainer, step 3 named "Polish" not "Whitening" | "Keep that" | step 03 stays "Polish"; polishing is never labelled whitening | (one-off) |
| 2026-11-12 | visual codes, 20 art styles, miracle tools, GitHub tools | "Add these if not already present." | `diagram` type (9 layouts), 8 new sketch media, auto-grade + cleanup, Particles; apps explained, not installed | T10, N05 |
| 2026-11-12 | "20 video effects for Claude" post | "Add these effecta also if not already present." | 11 new footage effects (39–49); 9 already existed | T10 |
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
