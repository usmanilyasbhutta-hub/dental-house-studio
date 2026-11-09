#!/usr/bin/env bash
# After Claude edits a file: typecheck code, validate briefs. Exit 2 feeds errors back to Claude.
f=$(jq -r '.tool_input.file_path // empty')
cd "$CLAUDE_PROJECT_DIR" || exit 0
case "$f" in
  */src/*.ts|*/src/*.tsx|*/scripts/*.ts|*/tests/*.ts)
    out=$(npx tsc --noEmit 2>&1) || { echo "Typecheck failed after editing $f:" >&2; echo "$out" | head -40 >&2; exit 2; } ;;
  */briefs/*.yaml|*/briefs/*.yml)
    out=$(npx tsx scripts/validate.ts "$f" 2>&1) || { echo "Brief $f failed validation/compliance:" >&2; echo "$out" >&2; exit 2; } ;;
esac
exit 0
