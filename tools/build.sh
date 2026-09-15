#!/usr/bin/env bash
# Render, mux, gate and contact-sheet a video in one command.
# Usage: tools/build.sh <slug> [frames=10]
#
# The four steps are always run together and each is seconds, so running them as four commands only costs
# round trips. Exits non-zero if the gate fails, so "build and tell me what is wrong" is one call.
set -euo pipefail
SLUG="${1:?slug}"; N="${2:-10}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
V="$ROOT/videos/$SLUG"
[ -d "$V" ] || { echo "no such video: videos/$SLUG"; exit 1; }
[ -f "$V/audio/timeline.json" ] || { echo "no narration yet: .venv/bin/python tools/tts.py videos/$SLUG"; exit 1; }

if [ -f "$V/manim/scene.py" ]; then
  "$ROOT/tools/render_manim.sh" "$SLUG"
else
  ( cd "$ROOT/engine/remotion" && npx remotion render src/index.ts "$SLUG" \
      "../../videos/$SLUG/out/video.mp4" --props="../../videos/$SLUG/audio/props.json" | tail -1 )
fi

"$ROOT/tools/mux.sh" "$V/out/video.mp4" "$V/audio/narration.wav" "$V/out/final.mp4"
"$ROOT/tools/frames.sh" "$V/out/final.mp4" "$V/critic/self" "$N"
echo
"$ROOT/.venv/bin/python" "$ROOT/tools/check.py" "videos/$SLUG"
