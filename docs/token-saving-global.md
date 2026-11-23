# Token saving for every Claude Code project (paste into `~/.claude/CLAUDE.md`)

Copy everything below the line into `~/.claude/CLAUDE.md` on your computer (`C:\Users\<you>\.claude\CLAUDE.md` on
Windows). Claude Code reads that file in every project, so the rules apply everywhere, not only in this repo.

---

## Token saving (all projects, always)
- **Map before files.** If the project has a code map or index (`docs/project-map.md`, `*/docs/code-index.md`,
  or similar), read it first and open only what the task needs. If a project has more than ~30 source files and no
  map, offer once to add one (an index of each file's purpose, imports and main symbols with line numbers, refreshed
  by the project's check command and an after-edit hook).
- **Never read a big file whole** (over ~4k tokens / ~300 lines): `grep -n` for the symbol, then read a 60–120-line range.
- **Don't re-read** a file already read or just edited in this chat.
- **Trim output:** pipe logs and test runs through `tail` / `grep`; never print full build, install or render logs.
- **Previews over full runs:** check visual work with a few stills or screenshots before any long render or build.
- **No subagents unless I ask:** they start from zero and re-read what this chat already knows.
- **Short chats, one job each.** Each turn re-sends the whole history; start a new chat for a new job.
- **New files start with a one-line header comment** saying what the file is for, so maps stay useful.
