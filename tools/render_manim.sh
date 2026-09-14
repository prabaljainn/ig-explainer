#!/usr/bin/env bash
# Render a video's Manim scene at 1080x1920 30fps and copy it to out/video.mp4
# Usage: tools/render_manim.sh <slug> [SceneClass=Explainer]
set -euo pipefail
SLUG="$1"; SCENE="${2:-Explainer}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
V="$ROOT/videos/$SLUG"
cd "$V/manim"
rm -rf "$V/out/media"
"$ROOT/.venv/bin/manim" -q h -r 1080,1920 --fps 30 --format mp4 --media_dir "$V/out/media" scene.py "$SCENE"
SRC=$(find "$V/out/media/videos" -name "${SCENE}.mp4" | head -1)
[ -n "$SRC" ] || { echo "FAIL: manim produced no ${SCENE}.mp4"; exit 1; }
cp "$SRC" "$V/out/video.mp4"
echo "rendered -> $V/out/video.mp4"
