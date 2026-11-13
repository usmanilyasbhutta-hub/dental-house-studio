#!/usr/bin/env bash
# Installs Blender 4.3 as a Python module into .cache/blender (gitignored).
# No desktop Blender or GPU is needed; Cycles renders on the CPU.
# Safe to re-run: it does nothing when the install is already complete.
set -euo pipefail
cd "$(dirname "$0")/.."
VENV=.cache/blender
if [ -x "$VENV/bin/python" ] && "$VENV/bin/python" -c "import bpy,PIL,numpy" >/dev/null 2>&1; then
  echo "Blender module already installed"; exit 0
fi
PY=$(command -v python3.11 || true)
[ -n "$PY" ] || { echo "python3.11 is required for bpy 4.3" >&2; exit 1; }
mkdir -p .cache && "$PY" -m venv "$VENV"
"$VENV/bin/pip" install -q --disable-pip-version-check "bpy==4.3.0" "numpy<2" pillow
"$VENV/bin/python" -c "import bpy; print('Blender', bpy.app.version_string, 'ready')" 2>/dev/null | tail -1
