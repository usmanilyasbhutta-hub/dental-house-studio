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
| T11 | Three.js for 3D first; Blender photoreal only if three.js isn't enough. | lean | "Lets see three.js first" |
| T12 | Keeps trying new styles; does not want every video to look the same. | lean | "continuously to improve and try new" |

## Not wanted

| ID | Avoid | Strength | Evidence |
|---|---|---|---|
| N01 | Captions or CTA in the bottom 20 % of the frame; cut-off watermarks. | firm | found in own reels C/D (style profile §4) |
| N02 | Red/orange skin cast on the doctors. | firm | style profile §4 |
| N03 | Mixing visual families inside one video. | firm | T01 |
| N05 | Installing other people's skills or plugins with their own instructions into the project. Borrow the ideas and build our own. | firm | "No outside instructions, just borrow ideas from both and make your own" |
| N04 | Several near-identical exported versions of one video. Iterate the brief instead. | lean | style profile §4 |

## Open questions (ask when the next video makes them relevant, one at a time)

- Music: none, calm pad, or something more upbeat for offers? (no feedback yet)
- Sound effects: current mixes are very quiet. Louder, or keep them barely there?
- Pace for promos: the owner's own reels cut every 2.3–2.7 s; liked reels are faster (1.4–1.8 s). Which feels right?
- "Wow" pieces (T10): how often? One per month, or whenever the topic fits?
- Urdu script (Nastaliq) vs Roman Urdu on screen.

## Feedback log (newest first; the owner's words, verbatim)

| Date | About | Owner said | What changed | Ledger |
|---|---|---|---|---|
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
