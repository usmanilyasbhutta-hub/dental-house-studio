# How to use Dental House Studio (owner's guide)

## Start a new chat for each piece of work
1. Open Claude Code (web/app) → **new session**.
2. Repository: `usmanilyasbhutta-hub/dental-house-studio` (add `dental-align` only if needed).
3. Environment: **Dental House** (installs everything automatically; ~1 minute).
4. Describe the job in plain words and attach the files (see below).

Claude reads `CLAUDE.md`, `docs/style-profile.md`, `docs/effects.md` and the `dental-animation` skill at the start
of every chat, so every chat already knows the brand, the rules, your style and every tool. Nothing from old chats is
needed. When something new is decided, ask Claude to "make it a permanent rule" so it is written into the repo.

Patient photos, consent forms and raw footage are never stored in git: **attach them again in each chat** that needs them.

## What to ask for (examples)
| You want | Say / attach |
|---|---|
| Offer reel | "Offer reel: free implant consultation until 31 Dec, terms …" |
| Doctor talking-head | attach the original phone recording: "Make a reel from this, Roman-Urdu captions" |
| Clinical case before/after | attach photos + say the diagnosis/treatment + "consent is signed" |
| Anatomy map of a photo | attach the photo: "Anatomy map like the Class II video: label …" |
| Procedure in 3D | "3D explainer: root canal / implant / crown / composite, generic products" |
| Education graphics | "Education reel on gum bleeding with sources" or "carousel of 6 slides" |
| Effects | "Use frame break + checklist + punch caption" (see docs/effects.md, galleries in out/) |
| Fix a clip | "Make this landscape clip vertical / stabilise / clean the audio" |
| Still images | "Give me stills for a carousel" (PNG per key frame) |

## Every video goes through
brief → checks (claims, privacy, consent) → preview stills → render → QC → reviewer agents → **dentist approval** →
caption/cover (`/publish-prep`). Nothing is ever posted by Claude.
