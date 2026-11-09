# Talking-head videos

1. Put the raw recording anywhere (e.g. `references/inbox/`), ideally the original phone file.
2. Transcript (SRT, source timings): Descript connector (upload **audio only**, private project) → export SRT.
   Descript writes Urdu in Devanagari; convert to Roman Urdu as spoken (keep English words) → `references/work/<name>.roman.srt`.
3. Write the brief (`type: talking-head`): trim, crop (drop burned-in text), `remove` boxes for old overlays, chapters, callouts (`on:` = spoken trigger word).
4. Models (once per machine, gitignored):
   `mkdir -p .cache/models && curl -L -o .cache/models/u2net_human_seg.onnx https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx`
   and `pip install onnxruntime opencv-python-headless numpy`.
5. `npm run prep -- <brief>` → `public/footage/<id>.webm` (cut-out + grade + speech) and `<id>.words.json`.
6. `npm run still -- <brief> --frame N --safe-zones`, then `npm run make -- <brief>`, then `/review`.

## Lessons from the first test run (Bleeding Gums, Nov 2026)
- **Quote YAML values that contain commas** inside `{ }` (e.g. `small: "Soft brush, light pressure"`), or the text gets cut short.
- Descript transcribes Urdu speech in Devanagari: always convert to Roman Urdu before captions.
- Callouts must stay with their chapter (now automatic).
- The reviewers caught overstated spoken claims. On-screen text should **qualify** a claim, never amplify it (no big "H₂O₂").
- Wish list: `trim` with several segments (to cut a passage the dentist wants removed), and raw phone footage instead of Instagram copies.
