# Decision sheet: 2026-11-wedding-whitening (Reel ad, 19.5 s)

Storyboard v3 approved by the owner on 2026-11-11 ("Ok for story board"): `docs/storyboards/2026-11-wedding-whitening.html`.
The first draft (dark slate, maroon band, condensed caps) was rejected: "Dont like aesthetics, design like whitening carousel previously made".

| Choice | Decision | Source |
|---|---|---|
| Look | Canva whitening carousels: paper pages, bold sentence-case slate headlines (Roboto 900), bronze serif italics, hairlines, line icons | owner (T13) |
| Language | English on screen; hook only in Roman Urdu | owner (T14) |
| Photos | before/after, dupatta/sherwani and clinic room exported from the owner's Canva carousels | owner: "Would you use canva pics?" |
| Motion | carousel pages push like a swipe; mask rises, line draws, icon strokes, odometer price, stamp, typed keyword, chat bubble | owner: "Animation use/motion graphics?" |
| Address | "Dental House" bold; Ahsan Medical Centre address as small grey type | owner (T15) |
| Proof | owner's own pre/post-op retractor photos (pre-op turned upright), aligned with scripts/align_pair.py and cut from the identical box; identical boxes, objectFit contain, no zoom/filter; note "Lighting differs. Results vary. Subject to assessment." | golden rule 3 |
| Consent | verbal, patient not identifiable (retractor close-up), scope social media + ads | owner: "Pts identity is already hidden, verbal consent was taken." |
| Music | original celebration track: D major, dhol, claps, accordion, shehnai, 116 bpm (scripts/make_celebration_music.py) | owner: "Music needs a happy/celebrating feel." |
| Sound effects | none | owner: "No operation theater sound." |
| Photo colour | unedited. A test showed camera colour accounts for about half the raw yellowness gap (teeth b* 24 → 17 after whole-photo matching vs 12 after); owner chose unedited | owner: "Keep the photos uneditted." |
| Hero photo | dupatta/sherwani image is AI-generated (Canva / ChatGPT): decorative fabric and props only, never a person or a result | owner, 2026-11-11 |
| Open | dentist approval | ask |

## Round 2: hook recipe review (2026-11-24)

Owner pasted a hook recipe for a 30%-off whitening package ("Find whats usable and edit reel so that next round is prepared").

| Recipe idea | Verdict | What was done / why |
|---|---|---|
| Discount is the closer, not the hook | used | already so: hook → proof → price late; captions open with proof, not the offer |
| Open on the AFTER smile, before second | used | `hook_visual: after`: the real after photo is on frame 0 (static, no flash or sparkle on it); before/after page follows |
| Agitate line in seconds 2–5 | used | `hook_sub: "Your wedding photos stay with you for life."` |
| Local signal (city on screen, location tag, city hashtag) | used | kicker "Sialkot · Brides · Grooms"; location tag + hashtags in docs/captions |
| DM keyword CTA, pinned comment with phone | used | WhatsApp "WHITE" kept; pinned comment drafted |
| Distant audience variant | used, adapted | overseas families flying home for December weddings: draft brief `2026-11-wedding-whitening-travel.yaml` (watermarked) |
| "I'm a dentist… three things to check" (trust) | used, adapted | travel variant's "Check 3 things." page; as a spoken hook it needs the owner on camera (talking-head shoot) |
| "4 slots left" scarcity | ready, needs a real number | `price.slots` + `slots_confirmed_on`; blocked until the owner gives the true count |
| Date overlay "6 days ago" | ready, needs the real date | `proof.interval` (e.g. "6 days later"), shown next to After |
| Patient reaction / "she sent us this photo" | not without real material | no invented stories or quotes; needs a real message/video with consent |
| Hand-over-mouth frame | shoot option | needs a staged clip with a model, labelled as not a patient |
| Gel / process macro | possible | the Canva "Actual whitening preparation" photo exists (gel + gum barrier); needs consent confirmation |
| Shade guide "A3 → B1" | not usable | a shade-change claim (owner rule: no "X shades") |
| "Ten years of coffee staining reversed in one session" | not usable | result + speed promise (owner rule, compliance.ts) |
| Reach/save-rate numbers (5–15×, 4–9%) | not on screen | unverified benchmarks; use as targets only, measure our own via Instagram insights |
| Measure: 3-second skip rate, saves, sends | used | compare the two variants by 3 s hold, saves, sends and WhatsApp "WHITE" messages |
