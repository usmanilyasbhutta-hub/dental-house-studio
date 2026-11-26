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

## Round 2b: results → why → offer (2026-11-24)

Owner: "Goal is to edit such that results appear first then why and then offer to boost engagement. Post op pic at start is a
good idea but for implementation it also requires expert direction decision, at the moment just a pasted pic on first frame is present."

| Act | Time | Pages | Direction |
|---|---|---|---|
| Results | 0–7 s | slider opening (4 s), side-by-side hold (3 s) | frame 0: the real AFTER smile as a full-width band (1080 wide, whole photo, contain) under the hook, "After" chip. 0.9 s: a white slider line with a round handle sweeps left→right revealing the BEFORE (the aligned pair means only colour changes under the line), holds 0.4 s, sweeps back and lands on AFTER. Then both photos side by side with the honesty note: the screenshot frame. |
| Why | 7–12 s | what's included (3.5 s), clinic (1.5 s) | dentist-led, gum protection, scaling + polish; the real room with Dental House bold |
| Offer | 12–19 s | price (4 s), WhatsApp end card (3 s) | 30,000 rolls to 21,000, save stamp; WHITE typed; number and address hold |

Rules kept: photos never zoomed, filtered or sparkled (the slider only clips them); "Real patient · same smile · lighting differs" under the band.
The "agitate" line was dropped from the hook so frame 0 is just question + result.

## Round 3: owner's page order (2026-11-24)

Owner: "At the very first scene with the same heading it should show result change as a line traveling you just showed, second
frame should show our original first scene with added caption about off, then meet here then cta."

| # | Page | Time | What's on it |
|---|---|---|---|
| 1 | Slider (hook) | 0–4.5 s | hook heading + after smile full width, slider sweeps to before and back; "Real patient · same smile" + "Lighting differs. Results vary. Subject to assessment." |
| 2 | Offer | 4.5–9 s | the original wedding scene (dupatta, jasmine, sherwani) with "30% *off* teeth whitening.", PKR 21,000, Regular ~~PKR 30,000~~, "Scaling + polish included · Valid until 15 Dec 2026" |
| 3 | Meet us here | 9–11.5 s | clinic room, Dental House bold, address small |
| 4 | CTA | 11.5–15.5 s | Book your assessment slot · WhatsApp "WHITE" · 0323 7560160 |

Dropped at the owner's direction: the side-by-side page, "What's included" and the price-roll page (the honesty note moved onto page 1).

## Round 4 (v4 storyboard, built 2026-11-24)

| Item | Decision | Source |
|---|---|---|
| Slider frame | Apple-hardware-inspired device: superellipse corners, titanium rim (edge line, brushed face, top highlight), black bezel, two-layer shadow; one glint on the rim only | owner |
| Photo trim | black retractor only, identical on both: 12 px left, 60 px right (public/cases/.../alignment.json) | owner: "Trim some of Black retractor only." |
| Offer page | lockup: *Wedding season* (serif italic 132) / OFFER (250, heaviest) / maroon 30% OFF tag + "teeth whitening" / PKR 21,000 with struck regular / scaling + validity; dupatta-sherwani photo larger | owner (typography); "Offer" chosen by Claude when asked |
| Location | Google Earth Studio "Zoom To" on 32.5054616, 74.546536 (owner's Maps pin), 1080×1920 @ 30 fps, 4 s → played in 2.5 s; pin + tag + credit overlaid (docs/google-earth-studio.md) | owner: "Google earth studio." |
| Order | slider → offer → map → meet us here → CTA (17.5 s) | owner |

## Round 5: remake after the 5-agent review (2026-11-26)

Owner: "It was same day before and after treatment pic, pt had implant surgery from somone else, i removed suture after taking
preop pic. Use own map that can be used. It is allowed to advertise. Use agents recommendations and remake the video keeping
basic idea in latest version." Review: qc/2026-11-wedding-whitening/review.md.

| Review item | Change |
|---|---|
| Google Earth not allowed for promotion (verified on Google's geo guidelines) | Own map: Natural Earth outline (public domain) → our clay-city miniature → Commissioner Road highlighted → pin + Trauma Centre opposite; "Illustrative map · not to scale" chip. Compliance now blocks Google Earth footage in non-demo promos. |
| Before/after overstated; suture; interval | "Real patient · same day, before & after" + "Camera & light differ · Results vary · Subject to assessment" at 30 px; both photos cropped identically to exclude the suture (another clinic's implant surgery). |
| "perfect" reads as a promise | Hook: "Shaadi ki photos mein — *brighter* smile?" |
| Static first second; device under the Reels buttons | Slider starts at 0.3 s; device inside the safe band (x 90–940). |
| Small text | Notes, offer small print, end disclaimer, card sublines ≥ 30 px, darker. |
| Map labels/landmark | Labels held ≥ 1 s; steep final camera so the road runs visibly between the clinic pin and the hospital marker; card anchored on the hospital side. |
| Arrival shot | Slight zoom drops the competitor's sign; "Look for this building." · card "Dental House · in Ahsan Medical Centre · opposite Trauma Centre"; stronger scrim. |
| "Doctor kaun hai?" | Clinic page shows the doctors' names + BDS, RDS (src/brand.ts). |
| CTA hold | Faster typing; number on screen ~2.8 s; cursor hidden after typing. |
| Patient questions | FAQ + pinned comment + paid-boost notes in docs/captions. |
| Not done (needs the owner) | Written/recorded consent before paid boosting; a doctor clip on camera (no footage yet). |
