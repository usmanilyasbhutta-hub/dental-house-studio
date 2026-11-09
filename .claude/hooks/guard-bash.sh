#!/usr/bin/env bash
# Block commands that could leak patient material into git or the public bundle.
cmd=$(jq -r '.tool_input.command // empty')
if echo "$cmd" | grep -Eq 'git add .*(-f|--force).*(assets/cases|public/cases)|git add -f'; then
  echo "Blocked: patient photos/consent forms must never be committed (force-add of gitignored files)." >&2; exit 2
fi
if echo "$cmd" | grep -Eq '(cp|mv|ln)[^|;&]*consent[^|;&]*public/'; then
  echo "Blocked: consent forms must never be placed inside public/ (it is bundled into renders)." >&2; exit 2
fi
exit 0
