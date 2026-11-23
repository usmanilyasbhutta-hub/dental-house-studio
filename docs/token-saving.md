# Token saving: the standing strategy (every chat, every app, for good)

Tokens are credits. A chat that opens a 70k-token file to change three lines wastes most of what it spends.
These rules apply to all work in this repo: videos, scripts, Smile Studio and any app added later.

## 1. Maps first, files second
| Area | Read first | Size |
|---|---|---|
| Whole repo (videos, scripts, docs) | `docs/project-map.md` | ~6k tokens |
| Any app in `apps/<name>/` | `apps/<name>/docs/code-index.md` | ~2k tokens each |
| Planning chats (no code) | `docs/chat-pack.md` | ~3k tokens |

The app index lists, for every file: purpose, local imports, outside packages and main symbols as `name:line`,
ranked by how many app files use them. Go from the index straight to the line:

```bash
sed -n '354,420p' apps/smile-studio/src/planner.ts                      # read around planShadeGap:374
python3 scripts/app_index.py --file apps/smile-studio/src/planner.ts    # every symbol of one file, with lines
grep -n "planShadeGap" -r apps/smile-studio/src                          # who calls it
```

## 2. Reading rules
- Files marked ⚠ (>4k tokens) are **never read whole**: grep, then read a 60–120-line range.
- Don't re-read a file you just edited or already read in this chat (the harness tracks it).
- Logs and test output: `| tail -20`, `| grep -E 'error|fail'`. Never print a full build or render log.
- Visuals: a few stills or a contact sheet, not full renders. Full renders only after the owner approves.
- Subagents only when the owner asks: each starts from zero and re-reads what this chat already knows.
- One chat per job, kept short. A long chat re-sends its whole history on every turn.

## 3. The maps never go stale (automatic)
- `.claude/hooks/after-edit.sh` refreshes the right map after **every** edit Claude makes (both scripts take < 0.1 s
  and write only when something changed), so line numbers are exact mid-chat.
- `npm run map` / `npm run check` (root) and `npm run check` (inside an app) regenerate everything.
- `python3 scripts/app_index.py --check` and `python3 scripts/project_map.py --check` exit 1 if a map is out of date.

## 4. New code stays indexable
- **New app**: create it under `apps/<name>/`. It gets `docs/code-index.md` on the next run with no setup.
  Add `"check": "python3 ../../scripts/app_index.py apps/<name> && …"` to its package.json.
- **Every new file starts with a one-line header comment** saying what it is for (that line is the file's purpose in
  the maps). A comment directly above a function documents the function, not the file.
- Keep files focused; split a file when it passes ~10k tokens (it then costs less to open the part you need).
- Write the big picture in the app README, not in code comments the maps have to carry.

## 5. Budgets
| Map | Budget | Lever if it grows |
|---|---|---|
| project-map.md | ~6k tokens | collapse a folder to one pointer line (as done for `apps/`) |
| code-index.md | 2k tokens per app (`BUDGET` in `scripts/app_index.py`) | symbols per file shrink automatically; split big apps |

## 6. Using this in other projects
`scripts/app_index.py` has no project-specific code: copy it into any repo with an `apps/` folder (or pass a folder:
`python3 app_index.py path/to/app`). For all your Claude Code projects on your PC, put the block in
`docs/token-saving-global.md` into `~/.claude/CLAUDE.md` (user-level instructions, read by every project).
