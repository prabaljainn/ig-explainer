#!/usr/bin/env bash
# One-time setup: Python venv with Kokoro, Remotion deps, and the explainer skill + critic agents linked into ~/.claude.
# Usage: ./install.sh [--manim] [--voice-clone] [--cpu] [--no-link]
#   --cpu       machine without a GPU (most Linux laptops): CPU-only torch, skips the multi-GB CUDA download
#   PYTHON=...  pick the interpreter; default is the first of python3.11 python3.12 python3.10 python3 that is 3.10 to 3.12
# Safe to re-run: existing venvs and node_modules are reused.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
MANIM=0; CLONE=0; CPU=0; LINK=1
for a in "$@"; do
  case "$a" in
    --manim) MANIM=1 ;;
    --voice-clone) CLONE=1 ;;
    --cpu) CPU=1 ;;
    --no-link) LINK=0 ;;
    *) echo "usage: ./install.sh [--manim] [--voice-clone] [--cpu] [--no-link]"; exit 1 ;;
  esac
done

echo "== prerequisites"
missing=0
command -v ffmpeg >/dev/null || { echo "  ffmpeg missing:  brew install ffmpeg  |  sudo apt install ffmpeg"; missing=1; }
[ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 20 ] \
  || { echo "  node 20+ missing:  https://nodejs.org  |  brew install node"; missing=1; }
[ "$missing" = 0 ] || { echo "install the above, then re-run ./install.sh"; exit 1; }

supported() { "$1" -c 'import sys; sys.exit(0 if (3, 10) <= sys.version_info[:2] < (3, 13) else 1)' 2>/dev/null; }
pick_python() {
  if [ -n "${PYTHON:-}" ]; then
    supported "$PYTHON" || echo "  warning: $PYTHON is outside 3.10 to 3.12; kokoro may not install" >&2
    echo "$PYTHON"; return
  fi
  for p in python3.11 python3.12 python3.10 python3; do
    command -v "$p" >/dev/null && supported "$p" && { echo "$p"; return; }
  done
  echo "install.sh: need Python 3.10 to 3.12 (kokoro does not support newer) and found none on PATH." >&2
  echo "            brew install python@3.12  |  sudo apt install python3.12-venv  |  PYTHON=/path/to/python3.12 ./install.sh" >&2
  exit 1
}
PY=$(pick_python)

echo "== python venv ($PY, $("$PY" -c 'import platform; print(platform.python_version())'))"
[ -x "$ROOT/.venv/bin/python" ] || "$PY" -m venv "$ROOT/.venv"
"$ROOT/.venv/bin/pip" install -q --upgrade pip
[ "$CPU" = 1 ] && "$ROOT/.venv/bin/pip" install torch --index-url https://download.pytorch.org/whl/cpu
# not quiet on purpose: the first run downloads torch and the Kokoro weights, which takes a while
"$ROOT/.venv/bin/pip" install -r "$ROOT/requirements.txt"
if [ "$MANIM" = 1 ]; then
  echo "== manim"
  "$ROOT/.venv/bin/pip" install -r "$ROOT/requirements-manim.txt"
fi

echo "== remotion (npm install)"
( cd "$ROOT/engine/remotion" && npm install --no-audit --no-fund )

if [ "$CLONE" = 1 ]; then
  echo "== voice clone venv (chatterbox pins torch 2.6, so it gets its own venv)"
  [ -x "$ROOT/.venv-clone/bin/python" ] || "$PY" -m venv "$ROOT/.venv-clone"
  "$ROOT/.venv-clone/bin/pip" install -q --upgrade pip
  [ "$CPU" = 1 ] && "$ROOT/.venv-clone/bin/pip" install "torch==2.6.*" "torchaudio==2.6.*" --index-url https://download.pytorch.org/whl/cpu
  "$ROOT/.venv-clone/bin/pip" install chatterbox-tts kokoro soundfile librosa "setuptools<81"
  if [ "$(uname -sm)" = "Darwin arm64" ]; then "$ROOT/.venv-clone/bin/pip" install mlx-whisper
  else "$ROOT/.venv-clone/bin/pip" install faster-whisper; fi
fi

if [ "$LINK" = 1 ]; then
  echo "== linking the skill and critic agents into ~/.claude"
  mkdir -p "$HOME/.claude/skills" "$HOME/.claude/agents"
  link() { # link <target> <linkpath>; never clobbers a real file or directory
    if [ -e "$2" ] && [ ! -L "$2" ]; then echo "  skip: $2 exists and is not a symlink; move it away and re-run"; return; fi
    ln -sfn "$1" "$2"; echo "  $2 -> $1"
  }
  link "$ROOT/skills/explainer" "$HOME/.claude/skills/explainer"
  for a in "$ROOT"/.claude/agents/*.md; do link "$a" "$HOME/.claude/agents/$(basename "$a")"; done
fi

echo
"$ROOT/tools/doctor.sh"
echo
echo "Restart Claude Code (skills and agents load at session start). Then, from any directory:  /explainer <topic>"
