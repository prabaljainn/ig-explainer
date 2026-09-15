"""Shared Manim setup for vertical Instagram explainers.

Import this first in every scene file. It configures the 1080x1920 frame from brand/style.json and gives you
IGScene, a Scene whose clock is driven by the narration timeline written by tools/tts.py.

    from igstyle import *

    class Explainer(IGScene):
        timeline_path = Path(__file__).resolve().parent.parent / "audio" / "timeline.json"

        def construct(self):
            self.narrate(0, hide_caption=True)          # jump to line 0, no caption (it's the hook headline)
            self.play(Write(headline), run_time=0.8)
            self.narrate(1)                              # wait until line 1 starts, show its caption
            self.play(Create(circle), run_time=1.0)
            ...
            self.finish()                                # hold until total_duration

Geometry: 1 Manim unit = 120 px in both axes (frame 9 x 16 units for 1080 x 1920 px). px() converts.
"""
import json
import textwrap
from pathlib import Path

from manim import *  # noqa: F401,F403  (re-exported on purpose)
import random

from manim import Scene, Text, Dot, FadeIn, FadeOut, VGroup, ValueTracker, DOWN, UP, ORIGIN, config

_STYLE_PATH = Path(__file__).resolve().parents[2] / "brand" / "style.json"
STYLE = json.loads(_STYLE_PATH.read_text())

# ---- frame: portrait, same pixel density as the default landscape frame (120 px per unit)
config.pixel_width = STYLE["width"]
config.pixel_height = STYLE["height"]
config.frame_width = STYLE["width"] / 120.0    # 9.0
config.frame_height = STYLE["height"] / 120.0  # 16.0
config.frame_rate = STYLE["fps"]
config.background_color = STYLE["colors"]["bg"]

PX = 1.0 / 120.0
def px(n: float) -> float:
    """Pixels -> Manim units."""
    return n * PX

def ypx(n: float) -> float:
    """Pixel row (0 = top of frame) -> Manim y coordinate."""
    return (STYLE["height"] / 2.0 - n) * PX

def xpx(n: float) -> float:
    """Pixel column (0 = left) -> Manim x coordinate."""
    return (n - STYLE["width"] / 2.0) * PX

FG = STYLE["colors"]["fg"]
DIM = STYLE["colors"]["dim"]
FAINT = STYLE["colors"]["faint"]
ACCENT = STYLE["colors"]["accent"] or FG
HERO = STYLE["colors"]["hero"]      # the object the video is about; the only thing that glows
MARK = STYLE["colors"]["mark"]      # annotation ink: pointing arrows, callouts
BADGE = STYLE["colors"]["badge"]    # numbered chips and ticks in a sequence
FONT = STYLE["font"]["family"]
STROKE = STYLE["stroke"]
STARS = STYLE["stars"]
GLOW = STYLE["glow"]


def starfield(count: int | None = None, seed: int | None = None) -> VGroup:
    """The house background: a fixed field of small white stars. Seeded, so the layout is reproducible and a
    re-render never shifts a star under a label. Static on purpose (see brand/style.json notes.stars)."""
    rnd = random.Random(STARS["seed"] if seed is None else seed)
    dots = []
    for _ in range(STARS["count"] if count is None else count):
        b = rnd.random() ** 2  # mostly faint dust, a few bright ones
        r = STARS["minR"] + b * (STARS["maxR"] - STARS["minR"])
        dots.append(Dot(
            point=[xpx(rnd.random() * STYLE["width"]), ypx(rnd.random() * STYLE["height"]), 0],
            radius=px(r), color=FG, fill_opacity=STARS["minO"] + b * (STARS["maxO"] - STARS["minO"]),
        ))
    return VGroup(*dots).set_z_index(-10)


def glow(mobj, color: str = HERO, layers: int = 5):
    """Bloom behind the hero object: scaled copies fading outwards. Manim has no blur, so this is the stand-in.
    Returns a VGroup of the halo only; add it before the object and move both together.

    ponytail: fills the copies, so it only blooms a closed filled shape. A line or arc hero gets nothing visible;
    upgrade to stacked set_stroke copies with growing width if a geometry video needs a glowing stroke."""
    halo = VGroup(*[
        mobj.copy().set_stroke(width=0).set_fill(color, opacity=GLOW["opacity"] / layers)
        .scale(1 + (i + 1) * px(GLOW["blur"]) / max(px(1), mobj.width / 2) * 0.35)
        for i in range(layers)
    ])
    return halo.set_z_index(mobj.z_index - 1)

# Manim's font_size is not pixels; at this frame scale font_size ~= 0.42 * pixel size gives a similar cap height.
# Treat it as a starting point and let the critic catch anything off.
def fs(pixels: float) -> float:
    return pixels * 0.42

SIZE = {k: fs(v) for k, v in STYLE["font"].items() if isinstance(v, (int, float))}
CAPTION_Y = ypx(STYLE["caption"]["y"] + STYLE["font"]["caption"] * 0.6)
CONTENT_TOP = ypx(STYLE["safe"]["top"])
CONTENT_MID = ypx((STYLE["safe"]["top"] + STYLE["caption"]["y"]) / 2.0)
SAFE_X = xpx(STYLE["safe"]["side"])          # left edge of the safe area (negative)


def wrap(text: str, width: int = 30) -> str:
    return "\n".join(textwrap.wrap(text, width=width))


class IGScene(Scene):
    """A Scene that follows the narration timeline instead of hardcoded waits."""

    timeline_path: Path | None = None
    stars: bool = True

    def setup(self):
        if self.timeline_path is None:
            raise RuntimeError("set timeline_path on the scene class")
        if self.stars:
            self.add(starfield())
        self.timeline = json.loads(Path(self.timeline_path).read_text())
        self.lines = self.timeline["lines"]
        self._caption = None

    # -- clock -------------------------------------------------------------------------
    @property
    def now(self) -> float:
        return self.renderer.time

    def until(self, t: float) -> None:
        """Wait until absolute time t (seconds). No-op if already past it."""
        dt = t - self.now
        if dt >= 1.0 / config.frame_rate:
            self.wait(dt)

    def line(self, i: int) -> dict:
        return self.lines[max(0, min(i, len(self.lines) - 1))]

    def remaining(self, i: int, reserve: float = 0.3) -> float:
        """Seconds left in line i from now, minus a reserve. Use as run_time for a line's main animation."""
        nxt = self.lines[i + 1]["start"] if i + 1 < len(self.lines) else self.timeline["total_duration"]
        return max(0.4, nxt - self.now - reserve)

    # -- captions ----------------------------------------------------------------------
    def caption(self, i: int) -> None:
        txt = Text(wrap(self.line(i)["text"]), font=FONT, font_size=SIZE["caption"], weight="MEDIUM",
                   color=FG, line_spacing=0.9).move_to([0, CAPTION_Y, 0])
        anims = [FadeIn(txt, shift=UP * 0.07, run_time=0.2)]
        if self._caption is not None:
            anims.append(FadeOut(self._caption, run_time=0.15))
        self.play(*anims)
        self._caption = txt

    def clear_caption(self) -> None:
        if self._caption is not None:
            self.play(FadeOut(self._caption, run_time=0.15))
            self._caption = None

    def narrate(self, i: int, hide_caption: bool = False) -> None:
        """Advance to the start of line i and put its caption up. Then animate the line's visuals.
        Line 0 starts at t=0 (the hook owns the lead-in silence), every other line at its audio start."""
        if i > 0:
            self.until(self.line(i)["start"])
        if hide_caption:
            self.clear_caption()
        else:
            self.caption(i)

    def finish(self) -> None:
        self.until(self.timeline["total_duration"])

    # -- helpers -----------------------------------------------------------------------
    def headline(self, text: str, size: float | None = None, y: float | None = None) -> Text:
        return Text(wrap(text, 22), font=FONT, font_size=size or SIZE["headline"], weight="SEMIBOLD",
                    color=FG, line_spacing=0.85).move_to([0, CONTENT_MID if y is None else y, 0])

    def label(self, text: str, dim: bool = False) -> Text:
        return Text(text, font=FONT, font_size=SIZE["label"], weight="MEDIUM", color=DIM if dim else FG)

    def counter(self, tracker: ValueTracker, suffix: str = "", size: float | None = None, pos=ORIGIN) -> Text:
        """A Text-based counting number (no LaTeX needed). Animate with tracker.animate.set_value(x)."""
        def make():
            return Text(f"{int(round(tracker.get_value())):,}{suffix}", font=FONT, weight="SEMIBOLD",
                        font_size=size or SIZE["display"], color=FG).move_to(pos)
        t = make()
        t.add_updater(lambda m: m.become(make()))
        return t
