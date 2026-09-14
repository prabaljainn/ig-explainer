#!/usr/bin/env bash
# Extract N frames for review: the hook (0.4s), the last second, and evenly spaced frames between,
# plus a contact sheet. Used by the builder's self-check and by the video-critic subagent.
# Usage: tools/frames.sh <video.mp4> <outdir> [N=10]          N frames: hook, last second, evenly spaced between
#        tools/frames.sh <video.mp4> <outdir> --at 12.4,33.1  only these timestamps, e.g. the frames a critic round named
set -euo pipefail
VIDEO="$1"; OUT="$2"; N="${3:-10}"
mkdir -p "$OUT"; rm -f "$OUT"/frame_*.png "$OUT"/sheet.png
DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$VIDEO")
if [ "$N" = "--at" ]; then
  TIMES=$(printf '%s' "${4:?timestamps, comma-separated}" | tr ',' ' ')
else
  TIMES=$(python3 - "$DUR" "$N" <<'PY'
import sys
d, n = float(sys.argv[1]), max(3, int(sys.argv[2]))
ts = [0.4, d - 0.8] + [0.4 + (d - 1.6) * k / (n - 1) for k in range(1, n - 1)]
ts = sorted({round(t, 2) for t in ts if 0 <= t < d})
print(" ".join(f"{t:.2f}" for t in ts))
PY
  )
fi
i=0
for t in $TIMES; do
  ffmpeg -v error -y -ss "$t" -i "$VIDEO" -frames:v 1 "$OUT/frame_$(printf %02d "$i")_t${t}s.png"
  i=$((i + 1))
done
ROWS=$(( (i + 4) / 5 ))
ffmpeg -v error -y -pattern_type glob -i "$OUT/frame_*.png" \
  -vf "scale=270:-1,tile=5x${ROWS}:padding=8:margin=8:color=0x444444" "$OUT/sheet.png"
echo "$OUT: $i frames + sheet.png  (video ${DUR}s)"
