#!/usr/bin/env bash
# After Claude edits a file: typecheck code, validate briefs. Exit 2 feeds errors back to Claude.
f=$(jq -r '.tool_input.file_path // empty')
cd "$CLAUDE_PROJECT_DIR" || exit 0
# Keep the token-saving maps exact (docs/token-saving.md): both scripts take < 0.1 s and rewrite only on change.
case "$f" in
  */apps/*.ts|*/apps/*.tsx|*/apps/*.js|*/apps/*.mjs|*/apps/*.cjs|*/apps/*.py)
    app=$(printf '%s' "${f#"$CLAUDE_PROJECT_DIR"/}" | cut -d/ -f1-2)
    python3 scripts/app_index.py --quiet "$app" >/dev/null 2>&1 ;;
  *.ts|*.tsx|*.py|*.mjs|*.md|*.yaml|*.yml)
    case "$f" in */docs/project-map.md|*/docs/chat-pack.md|*/code-index.md) ;; *) python3 scripts/project_map.py >/dev/null 2>&1 ;; esac ;;
esac
case "$f" in
  */src/*.ts|*/src/*.tsx|*/scripts/*.ts|*/tests/*.ts)
    out=$(npx tsc --noEmit 2>&1) || { echo "Typecheck failed after editing $f:" >&2; echo "$out" | head -40 >&2; exit 2; } ;;
  */briefs/*.yaml|*/briefs/*.yml)
    out=$(npx tsx scripts/validate.ts "$f" 2>&1) || { echo "Brief $f failed validation/compliance:" >&2; echo "$out" >&2; exit 2; } ;;
esac
exit 0
