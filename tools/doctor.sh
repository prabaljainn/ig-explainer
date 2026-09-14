#!/usr/bin/env bash
# Preflight: is this machine ready to build a video? One line per check; exit 1 if anything required is missing.
# Usage: tools/doctor.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
ok()   { printf '  ok        %s\n' "$1"; }
miss() { printf '  MISSING   %s\n            fix: %s\n' "$1" "$2"; fail=1; }
opt()  { printf '  optional  %s\n            %s\n' "$1" "$2"; }

echo "ig-explainer doctor: $ROOT"
if command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null; then ok "ffmpeg + ffprobe"
else miss "ffmpeg" "brew install ffmpeg   |   sudo apt install ffmpeg"; fi

NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -ge 20 ]; then ok "node $(node -v)"; else miss "node 20+" "https://nodejs.org   |   brew install node"; fi

command -v python3 >/dev/null && ok "python3 (used by tools/frames.sh)" || miss "python3" "brew install python   |   sudo apt install python3"

PY="$ROOT/.venv/bin/python"
if [ -x "$PY" ] && "$PY" -c "import kokoro, soundfile, numpy" 2>/dev/null; then ok ".venv with kokoro ($("$PY" -V 2>&1))"
else miss ".venv with kokoro" "./install.sh"; fi

command -v espeak-ng >/dev/null && ok "espeak-ng" \
  || opt "espeak-ng not found" "Kokoro's fallback phonemizer for words outside its dictionary: brew install espeak-ng | sudo apt install espeak-ng"

if [ -x "$ROOT/engine/remotion/node_modules/.bin/remotion" ]; then ok "remotion (npm install done)"
else miss "engine/remotion/node_modules" "./install.sh   |   cd engine/remotion && npm install"; fi

FONT=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["font"]["family"])' "$ROOT/brand/style.json" 2>/dev/null || echo "Instrument Sans")
if fc-list 2>/dev/null | grep -qi "$FONT" || find "$HOME/Library/Fonts" /Library/Fonts /usr/share/fonts /usr/local/share/fonts -iname "*${FONT// /}*" 2>/dev/null | grep -q .; then
  ok "font: $FONT installed"
else
  opt "font: $FONT not installed locally" "Remotion loads it from Google Fonts; Manim needs it installed: https://fonts.google.com/specimen/${FONT// /+}"
fi

[ -x "$ROOT/.venv/bin/manim" ] && ok "manim" || opt "manim not installed" "only for the Manim engine: ./install.sh --manim (needs cairo, pango, pkg-config)"
[ -x "$ROOT/.venv-clone/bin/python" ] && ok ".venv-clone (voice clone)" || opt "voice clone not installed" "only for --engine chatterbox: ./install.sh --voice-clone"

if [ "$(readlink -f "$HOME/.claude/skills/explainer" 2>/dev/null)" = "$(readlink -f "$ROOT/skills/explainer")" ] \
   && [ -L "$HOME/.claude/agents/video-critic.md" ]; then ok "explainer skill + critic agents linked into ~/.claude"
else opt "skill not linked into ~/.claude" "./install.sh links them; restart Claude Code afterwards (skills and agents load at session start)"; fi

if [ "$fail" = 0 ]; then echo "ready"; else echo "not ready"; exit 1; fi
