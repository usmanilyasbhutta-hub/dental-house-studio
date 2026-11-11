---
description: Tell Claude what you like or don't (or see what it currently believes about your taste and correct it)
argument-hint: [feedback in your own words, any language] (empty = show me what you think I want)
---
The owner's creative judgement overrides everything except the golden rules. This command keeps `docs/taste.md` true.

Input: $ARGUMENTS

**If there is feedback:**
1. Work out what it is about (which video / option / effect; ask only if it is truly unclear).
2. Add a row to the Feedback log in `docs/taste.md` with today's date and the owner's **exact words** (keep Urdu/Roman Urdu as written).
3. Decide: one-off for this video, or standing? Apply the rules under "How this file changes" (once → lean, twice or
   "always/never" → firm, contradiction → latest wins). Update the Standing preferences / Not wanted tables.
4. If it is a correction of a clinical or factual point, also ask whether it should become a rule in CLAUDE.md or `compliance.ts`.
5. If a video is in progress, apply the change to its brief now.
6. Reply in 2–3 lines: what was recorded, what changed in the ledger, what changes in the current video. Commit the ledger.

**If empty:** show a plain-language summary (no IDs, no jargon):
- "What I believe you want" (firm), "What I think you prefer" (lean), "What I'm unsure about" (max 3 open questions,
  each answerable with one tap/word, with a still or example where it helps).
- Ask: "Anything wrong or out of date?" Then update the ledger from the answer.
