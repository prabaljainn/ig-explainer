#!/usr/bin/env python
"""Deterministic gate for a finished video. Run it before the critic, every time.

    .venv/bin/python tools/check.py videos/<slug>

Everything here is mechanical: a machine can decide it in two seconds and be right. That is the whole selection
rule. Judgement - does the motion explain the claim, does the hook stop a thumb, is the diagram the hero - stays
with the video-critic, which is slow and expensive and should not be spending a round on pixel arithmetic.

Every check below cost a real critic round on a real video before it was written here.
Exit status is 1 if anything FAILed, so this works as a gate in a script.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
STYLE = json.loads((ROOT / "brand" / "style.json").read_text())
W, H, FPS = STYLE["width"], STYLE["height"], STYLE["fps"]

# -- motion thresholds. Calibrated against the videos in this repo; see the header of report_motion.
HELD_S = 0.60        # a stretch of bit-identical frames longer than this is a dead hold
HELD_WARN_S = 0.30   # ...and shorter than this it is fine; between the two it is worth a look
SPIKE_K = 8.0        # a frame-to-frame change this many times the local median is a cut, not motion
SPIKE_FLOOR = 0.25   # ...but only if the change is at least this large in absolute terms (8-bit levels)
SPIKE_WIN = 31       # frames either side that define "local"
NEAR_LINE = 2        # frames: a spike this close to a narration line start is a boundary discontinuity
SAT_LEVEL = 40       # max(r,g,b) - min(r,g,b) above this is a colour, not black/white/dim/faint
SAT_BUDGET = 0.0005  # fraction of the frame allowed to be coloured under the takeaway (4:2:0 chroma noise)

fails: list[str] = []
warns: list[str] = []


def say(level: str, area: str, msg: str) -> None:
    print(f"{level:<4}  {area:<9}  {msg}")
    (fails if level == "FAIL" else warns if level == "WARN" else []).append(f"{area}: {msg}")


def ff(args: list[str]) -> bytes:
    return subprocess.run(args, capture_output=True, check=True).stdout


def probe(path: Path, entries: str, stream: str | None = "v:0") -> list[str]:
    cmd = ["ffprobe", "-v", "error"]
    if stream:
        cmd += ["-select_streams", stream]
    cmd += ["-show_entries", entries, "-of", "default=nw=1:nk=1", str(path)]
    return subprocess.run(cmd, capture_output=True, text=True).stdout.split()


def runs_of_identical(seq: list) -> list[tuple[int, int]]:
    """(start, length) of every run of equal neighbours longer than one."""
    out, run = [], 1
    for i in range(1, len(seq)):
        if seq[i] == seq[i - 1]:
            run += 1
        else:
            if run > 1:
                out.append((i - run, run))
            run = 1
    if run > 1:
        out.append((len(seq) - run, run))
    return out


def spike_events(d: np.ndarray) -> list[tuple[int, float]]:
    """(first frame of the jump, how many times the local median it is) per discontinuity.

    One ramp that is too fast trips several consecutive frames, so neighbours within 6 frames are one event.
    """
    pad = np.pad(d, SPIKE_WIN // 2, mode="edge")
    med = np.median(np.lib.stride_tricks.sliding_window_view(pad, SPIKE_WIN), axis=-1)
    hits = np.flatnonzero(d > SPIKE_K * np.maximum(med, SPIKE_FLOOR))
    events: list[list[int]] = []
    for i in hits:
        if events and i - events[-1][1] <= 6:
            events[-1] = [events[-1][0], int(i), max(events[-1][2], int(i), key=lambda j: d[j])]
        else:
            events.append([int(i), int(i), int(i)])
    return [(first, float(d[peak] / max(med[peak], SPIKE_FLOOR))) for first, _, peak in events]


def gray(path: Path, w: int = 135, h: int = 240) -> np.ndarray:
    """Every frame as a small grayscale row. One decode; both motion checks read it."""
    raw = ff(["ffmpeg", "-v", "error", "-i", str(path), "-an",
              "-vf", f"scale={w}:{h}", "-pix_fmt", "gray", "-f", "rawvideo", "-"])
    return np.frombuffer(raw, np.uint8).reshape(-1, h * w)


# ---------------------------------------------------------------- the output contract
def report_contract(final: Path, cover: Path) -> float:
    w, h = probe(final, "stream=width,height")[:2]
    rate = probe(final, "stream=r_frame_rate")[0]
    codec, pix = probe(final, "stream=codec_name,pix_fmt")[:2]
    rng = (probe(final, "stream=color_range") or ["unknown"])[0]
    space = (probe(final, "stream=color_space") or ["unknown"])[0]
    aud = (probe(final, "stream=codec_name", "a:0") or [""])[0]
    dur = float(probe(final, "format=duration", None)[0])

    bad = []
    if (int(w), int(h)) != (W, H):
        bad.append(f"{w}x{h}, want {W}x{H}")
    if rate != f"{FPS}/1":
        bad.append(f"{rate} fps, want {FPS}")
    if not aud:
        bad.append("no audio stream")
    if dur > 60:
        bad.append(f"{dur:.1f}s is over the 60s hard limit")
    say("FAIL" if bad else "PASS", "contract",
        "; ".join(bad) if bad else f"{w}x{h} {FPS}fps {dur:.2f}s {codec}/{pix} {space}/{rng} audio={aud}")
    if not bad and not (25 <= dur <= 55):
        say("WARN", "contract", f"{dur:.1f}s is outside the 25 to 55s band")
    if rng == "unknown" or space == "unknown":
        say("WARN", "contract",
            "colour is untagged, so the platform's transcoder will guess. A render made before "
            "engine/remotion/remotion.config.ts set bt709; rebuild it with tools/build.sh")

    if not cover.exists():
        say("FAIL", "cover", "no final_cover.jpg")
    else:
        # the cover is the Reel thumbnail: a blank one is the cheapest way to lose a video
        a = np.frombuffer(ff(["ffmpeg", "-v", "error", "-i", str(cover), "-vf", f"scale=135:240",
                              "-pix_fmt", "gray", "-f", "rawvideo", "-"]), np.uint8)
        ink = float((a > 60).mean())
        say("PASS" if ink > 0.002 else "FAIL", "cover",
            f"{ink * 100:.1f}% of the cover frame is ink" + ("" if ink > 0.002 else " - the thumbnail is blank"))
    return dur


# ---------------------------------------------------------------- the script contract
def report_script(script: Path, tl: dict) -> None:
    text = script.read_text()
    m = re.search(r"^##\s*Narration\s*$(.*?)(?=^##\s|\Z)", text, re.M | re.S)
    if not m:
        say("FAIL", "script", "no '## Narration' section")
        return
    # "caption || spoken" gives the voice a different text from the caption (see tools/tts.py); the 12-word
    # rule is about what a viewer reads, so it applies to the caption half only
    lines = [l.strip().partition(" || ")[0].strip() for l in m.group(1).splitlines()
             if l.strip() and not l.strip().startswith(("<!--", "-"))]

    bad = []
    if not 8 <= len(lines) <= 14:
        bad.append(f"{len(lines)} narration lines, want 8 to 14")
    for i, l in enumerate(lines):
        n = len(l.split())
        if n > 12:
            bad.append(f"line {i} is {n} words (max 12): {l[:44]!r}")
    if lines and re.match(r"^(in this video|let's|lets|hey|hi\b|welcome|today we)", lines[0], re.I):
        bad.append(f"line 0 is not a hook: {lines[0][:44]!r}")
    if len(lines) != len(tl["lines"]):
        bad.append(f"{len(lines)} script lines but {len(tl['lines'])} in timeline.json - re-run tts.py")
    say("FAIL" if bad else "PASS", "script",
        "; ".join(bad) if bad else f"{len(lines)} lines, longest {max(len(l.split()) for l in lines)} words")

    if not re.search(r"^##\s*Scenes\s*$", text, re.M):
        say("WARN", "script", "no '## Scenes' storyboard")


# ---------------------------------------------------------------- motion
def report_motion(final: Path, tl: dict) -> None:
    """Two failures, opposite signs, one decode.

    Dead holds: runs of bit-identical frames. The takeaway is allowed to hold; nothing else is.
    Boundary discontinuities: a frame-to-frame jump far above the local median, landing on a narration line
    start. That is the signature of a boolean flipping at a line cut - a colour, an opacity, a guard - and it
    reads as a flash frame. It is the one defect this architecture produces over and over, and identical-frame
    detection cannot see it because it measures the opposite thing.
    """
    md5 = [l.rsplit(",", 1)[-1].strip()
           for l in ff(["ffmpeg", "-v", "error", "-i", str(final), "-an", "-f", "framemd5", "-"]).decode().splitlines()
           if l and not l.startswith("#")]
    take_off = tl["lines"][-1]["start"] * FPS  # frames from here on may hold: the takeaway is a held card
    held = runs_of_identical(md5)
    live = [(s, c) for s, c in held if s < take_off]  # the takeaway is a held card; everything before it moves
    stuck = [(s, c) for s, c in live if c / FPS > HELD_S]
    soft = [(s, c) for s, c in live if HELD_WARN_S < c / FPS <= HELD_S]
    say("FAIL" if stuck else "PASS", "holds",
        "; ".join(f"{c / FPS:.2f}s frozen at {s / FPS:.2f}s" for s, c in stuck) if stuck
        else f"{sum(c for _, c in held) / len(md5) * 100:.0f}% duplicate frames, none held over {HELD_S}s before the takeaway")
    for st, c in soft[:3]:
        say("WARN", "holds", f"{c / FPS:.2f}s frozen at {st / FPS:.2f}s")

    a = gray(final).astype(np.int16)
    d = np.abs(np.diff(a, axis=0)).mean(axis=1)  # d[i] is the change from frame i into frame i+1
    starts = {round(l["start"] * FPS): l["i"] for l in tl["lines"]}
    at_cut, elsewhere = [], []
    for first, k in spike_events(d):
        frame = first + 1  # the frame the jump lands on
        near = [ln for f, ln in starts.items() if abs(frame - f) <= NEAR_LINE]
        (at_cut if near else elsewhere).append((frame, near[0] if near else None, k))
    say("FAIL" if at_cut else "PASS", "cuts",
        "; ".join(f"line {ln} starts with a {k:.0f}x jump at {f / FPS:.2f}s" for f, ln, k in at_cut) if at_cut
        else f"no discontinuity at any of the {len(starts)} line starts")
    for f, _, k in elsewhere[:4]:
        say("WARN", "cuts", f"{k:.0f}x jump at {f / FPS:.2f}s, mid-line - a flash frame unless it is a real cut")


# ---------------------------------------------------------------- the takeaway ghosts neutral
def report_takeaway(final: Path, tl: dict) -> None:
    """The last line ghosts the diagram under the headline. Ghosting a coloured object by lowering its opacity
    leaves a tinted near-black, which the Look section forbids and which a critic round has already caught.
    Saturation is the exact test: fg, dim and faint have none, every role colour has a lot.
    """
    start = tl["lines"][-1]["start"]
    raw = ff(["ffmpeg", "-v", "error", "-ss", f"{start + 0.5:.2f}", "-i", str(final),
              "-vf", "scale=270:480", "-pix_fmt", "rgb24", "-f", "rawvideo", "-"])
    a = np.frombuffer(raw, np.uint8).reshape(-1, 480 * 270, 3).astype(np.int16)
    frac = ((a.max(2) - a.min(2)) > SAT_LEVEL).mean(axis=1)
    worst = float(frac.max()) if len(frac) else 0.0
    say("PASS" if worst <= SAT_BUDGET else "FAIL", "takeaway",
        f"{worst * 100:.3f}% coloured pixels under the takeaway headline"
        + ("" if worst <= SAT_BUDGET else " - ghost towards faint, do not just fade the hero out"))


def selftest() -> int:
    """The two detectors, on input whose answer is known. Smallest thing that fails if either stops working."""
    assert runs_of_identical(list("abbbcdde")) == [(1, 3), (5, 2)]
    assert runs_of_identical(list("abc")) == []

    steady = np.full(200, 2.0)  # ordinary motion
    assert spike_events(steady) == [], "steady motion must not look like a cut"
    flash = steady.copy()
    flash[120] = 40.0  # one frame where everything changes at once
    ev = spike_events(flash)
    assert [f for f, _ in ev] == [120] and ev[0][1] > 15, ev
    ramp = steady.copy()
    ramp[60:64] = 30.0  # a too-fast ramp is one event, not four
    assert [f for f, _ in spike_events(ramp)] == [60], spike_events(ramp)
    still = np.zeros(200)
    still[100] = 0.2  # below SPIKE_FLOOR: a sub-pixel wobble in a static scene is not a cut
    assert spike_events(still) == [], "absolute floor must suppress noise in a still scene"
    print("selftest ok")
    return 0


def main() -> int:
    if len(sys.argv) == 2 and sys.argv[1] == "--selftest":
        return selftest()
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    v = Path(sys.argv[1])
    if not v.is_absolute():
        v = ROOT / v
    final, cover, tlp = v / "out" / "final.mp4", v / "out" / "final_cover.jpg", v / "audio" / "timeline.json"
    for p in (final, tlp, v / "script.md"):
        if not p.exists():
            print(f"FAIL  files      missing {p.relative_to(ROOT)}")
            return 1
    tl = json.loads(tlp.read_text())

    print(f"check {v.name}")
    report_contract(final, cover)
    report_script(v / "script.md", tl)
    report_motion(final, tl)
    report_takeaway(final, tl)
    print(f"\n{len(fails)} FAIL, {len(warns)} WARN"
          + ("" if fails else "  - mechanical checks clear, the critic can spend its round on judgement"))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
