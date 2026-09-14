#!/usr/bin/env bash
# Mux the silent render with the narration into an Instagram-ready MP4, write the cover frame, verify.
# Usage: tools/mux.sh <video.mp4> <narration.wav> <final.mp4>
set -euo pipefail
V="$1"; A="$2"; OUT="$3"
mkdir -p "$(dirname "$OUT")"
ffmpeg -v error -y -i "$V" -i "$A" \
  -map 0:v:0 -map 1:a:0 \
  -vf "scale=1080:1920:flags=lanczos,format=yuv420p" -r 30 \
  -c:v libx264 -preset slow -crf 18 -profile:v high -level 4.1 \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 192k -ar 48000 \
  -movflags +faststart -shortest "$OUT"
ffmpeg -v error -y -ss 1.2 -i "$OUT" -frames:v 1 -q:v 2 "${OUT%.mp4}_cover.jpg"

W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width  -of default=nw=1:nk=1 "$OUT")
H=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of default=nw=1:nk=1 "$OUT")
D=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT")
AUD=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$OUT" || true)
printf 'final: %sx%s, %.2fs, audio=%s -> %s\n' "$W" "$H" "$D" "${AUD:-NONE}" "$OUT"
ok=1
[ "$W" = 1080 ] && [ "$H" = 1920 ] || { echo "FAIL: not 1080x1920"; ok=0; }
[ -n "$AUD" ] || { echo "FAIL: no audio stream"; ok=0; }
awk -v d="$D" 'BEGIN{ exit !(d > 60.0) }' && { echo "FAIL: longer than 60 s"; ok=0; }
awk -v d="$D" 'BEGIN{ exit !(d < 20.0) }' && { echo "WARN: shorter than 20 s"; }
[ "$ok" = 1 ] || exit 1
