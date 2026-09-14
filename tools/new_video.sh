#!/usr/bin/env bash
# Scaffold a new video. Usage: tools/new_video.sh <slug> <remotion|manim>
set -euo pipefail
SLUG="${1:?slug}"; ENGINE="${2:?remotion|manim}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "slug: lowercase letters, digits, dashes"; exit 1; }
V="$ROOT/videos/$SLUG"
mkdir -p "$V/audio" "$V/out" "$V/critic"

[ -f "$V/BRIEF.md" ] || cat > "$V/BRIEF.md" <<MD
# $SLUG

Topic:
Audience:
The one surprising idea:
Hero diagram (the single visual the whole video is built around):
Engine: $ENGINE
Why this engine:
Accent color: none
Notes / overrides to CLAUDE.md: none
MD

[ -f "$V/script.md" ] || cat > "$V/script.md" <<MD
# $SLUG script

## Narration
<!-- one spoken sentence per line, 12 words max, 8 to 14 lines. Line 1 is the hook, last line is the takeaway. -->

## Scenes
<!-- one bullet per line index: what is on screen, what moves, what persists into the next line -->
- 0:
MD

case "$ENGINE" in
  remotion)
    R="$ROOT/engine/remotion"
    if [ ! -d "$R/src/videos/$SLUG" ]; then
      cp -r "$R/src/videos/_template" "$R/src/videos/$SLUG"
      perl -pi -e "s#id: \"template\"#id: \"$SLUG\"#" "$R/src/videos/$SLUG/index.tsx"
    fi
    echo "remotion scene: engine/remotion/src/videos/$SLUG/index.tsx (composition id '$SLUG', discovered automatically)"
    ;;
  manim)
    mkdir -p "$V/manim"
    [ -f "$V/manim/scene.py" ] || cp "$ROOT/engine/manim/template_scene.py" "$V/manim/scene.py"
    echo "manim scene: videos/$SLUG/manim/scene.py"
    ;;
  *) echo "engine must be remotion or manim"; exit 1 ;;
esac
echo "created videos/$SLUG. Next: fill BRIEF.md and script.md, then: .venv/bin/python tools/tts.py videos/$SLUG"
