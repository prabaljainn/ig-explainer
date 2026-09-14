#!/usr/bin/env bash
# Print the absolute path of the ig-explainer checkout this skill belongs to.
# $EXPLAINER_ROOT wins if set; otherwise two levels above this file's real path (<root>/skills/explainer/root.sh),
# which is why install.sh symlinks the skill instead of copying it.
set -euo pipefail
if [ -n "${EXPLAINER_ROOT:-}" ]; then
  ROOT="$EXPLAINER_ROOT"
else
  ROOT="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../.." && pwd)"
fi
if [ ! -f "$ROOT/tools/tts.py" ] || [ ! -f "$ROOT/CLAUDE.md" ]; then
  echo "root.sh: $ROOT is not an ig-explainer checkout. Re-run install.sh from the checkout, or set EXPLAINER_ROOT." >&2
  exit 1
fi
printf '%s\n' "$ROOT"
