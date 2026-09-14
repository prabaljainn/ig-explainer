"""Template Manim scene. tools/new_video.sh copies this to videos/<slug>/manim/scene.py.

Render:  tools/render_manim.sh <slug>
Same worked example as the Remotion template (Eratosthenes), so you can compare the two engines on one script.
Keep the structure: narrate(i) per line, animations sized with remaining(i), finish() at the end.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "engine" / "manim"))
from igstyle import *  # noqa: E402,F401,F403

import numpy as np  # noqa: E402


class Explainer(IGScene):
    timeline_path = Path(__file__).resolve().parent.parent / "audio" / "timeline.json"

    def construct(self):
        # ---- geometry (units; 1 unit = 120 px). Angle exaggerated on purpose, the label says so.
        R = px(330)
        theta = np.deg2rad(24)
        centre = np.array([px(60), CONTENT_MID, 0])           # shifted right so sun-side labels stay in the safe area
        syene = centre + R * np.array([-1, 0, 0])
        alex = centre + R * np.array([-np.cos(theta), np.sin(theta), 0])
        outward = np.array([-np.cos(theta), np.sin(theta), 0])
        tangent = np.array([np.sin(theta), np.cos(theta), 0])   # ground at Alexandria, away from the sun
        stick_len = px(80)
        ray_x = xpx(60)

        earth = Circle(radius=R, color=FG, stroke_width=STROKE).move_to(centre)

        # ---- 0: hook
        self.narrate(0, hide_caption=True)
        hook = self.headline(self.line(0)["text"])
        earth_faint = earth.copy().set_stroke(FAINT, STROKE)
        self.play(Create(earth_faint), FadeIn(hook), run_time=1.2)

        # ---- 1: Syene, ray straight down the stick, no shadow
        self.narrate(1)
        self.play(FadeOut(hook), earth_faint.animate.set_stroke(FG, STROKE), run_time=0.4)
        ray1 = Line([ray_x, syene[1], 0], syene, color=DIM, stroke_width=3)
        stick1 = Line(syene, syene + np.array([-stick_len, 0, 0]), color=FG, stroke_width=STROKE + 2)
        l_syene = self.label("Syene").next_to(syene, DOWN, buff=0.18)
        self.play(Create(ray1), run_time=0.6)
        self.play(Create(stick1), FadeIn(l_syene), run_time=0.5)

        # ---- 2: Alexandria, tilted stick, a shadow
        self.narrate(2)
        ray2 = Line([ray_x, alex[1], 0], alex, color=DIM, stroke_width=3)
        stick2 = Line(alex, alex + outward * stick_len, color=FG, stroke_width=STROKE + 2)
        shadow = Line(alex, alex + tangent * stick_len * np.tan(theta), color=DIM, stroke_width=STROKE + 6)
        l_alex = self.label("Alexandria").next_to(alex + outward * stick_len, UP, buff=0.15).shift(RIGHT * 0.6)
        self.play(Create(ray2), run_time=0.6)
        self.play(Create(stick2), Create(shadow), FadeIn(l_alex), run_time=0.5)

        # ---- 3: the angle between stick and ray at Alexandria
        self.narrate(3)
        a_alex = Angle(Line(alex, alex - np.array([1, 0, 0])), Line(alex, alex + outward), radius=px(90),
                       other_angle=False, color=FG, stroke_width=4)
        l_a1 = self.label("7.2°").next_to(a_alex, LEFT, buff=0.12)
        note = self.label("angle exaggerated for clarity", dim=True).move_to([centre[0], centre[1] + R + px(70), 0])
        self.play(Create(a_alex), FadeIn(l_a1), FadeIn(note), run_time=0.8)

        # ---- 4: transfer the angle to the centre
        self.narrate(4)
        r1 = Line(centre, syene, color=DIM, stroke_width=3)
        r2 = Line(centre, alex, color=DIM, stroke_width=3)
        a_centre = Angle(r1, r2, radius=px(110), other_angle=False, color=FG, stroke_width=4)
        l_a2 = self.label("7.2°").next_to(a_centre, LEFT, buff=0.12)
        self.play(Create(r1), Create(r2), run_time=0.5)
        self.play(TransformFromCopy(a_alex, a_centre), FadeIn(l_a2), run_time=0.9)

        # ---- 5: one fiftieth
        self.narrate(5)
        l_50 = self.label("1 / 50").move_to(l_a2)
        self.play(ReplacementTransform(l_a2, l_50),
                  *[m.animate.set_opacity(0.25) for m in (ray1, ray2)], run_time=0.6)

        # ---- 6: the arc between the cities
        self.narrate(6)
        city_arc = Arc(radius=R, start_angle=np.pi, angle=-theta, arc_center=centre, color=FG, stroke_width=STROKE + 6)
        l_km = self.label("800 km").next_to(city_arc, LEFT, buff=0.2)
        self.play(Create(city_arc), FadeIn(l_km), run_time=0.8)

        # ---- 7: fifty arcs, lit one by one, counted
        self.narrate(7)
        seg = 2 * np.pi / 50
        arcs = VGroup(*[
            Arc(radius=R + px(26), start_angle=np.pi - k * seg - 0.012, angle=-(seg - 0.024), arc_center=centre,
                color=FG, stroke_width=10)
            for k in range(50)
        ])
        count = ValueTracker(0)
        l_count = self.counter(count, suffix=" / 50", size=SIZE["label"], pos=l_50.get_center())
        self.remove(l_50)
        self.add(l_count)
        self.play(FadeOut(l_km), LaggedStart(*[FadeIn(a) for a in arcs], lag_ratio=1 / 50),
                  count.animate.set_value(50), run_time=self.remaining(7, reserve=0.2), rate_func=linear)

        # ---- 8: the number
        self.narrate(8)
        km = ValueTracker(0)
        big = self.counter(km, suffix=" km", pos=[0, centre[1] - R - px(130), 0])
        self.add(big)
        self.play(km.animate.set_value(40000), run_time=1.6, rate_func=rush_from)

        # ---- 9: takeaway
        self.narrate(9, hide_caption=True)
        keep = VGroup(earth_faint, arcs)
        drop = VGroup(ray1, ray2, stick1, stick2, shadow, l_syene, l_alex, a_alex, l_a1, note, r1, r2, a_centre,
                      l_count, city_arc, big)
        self.play(FadeOut(drop), keep.animate.set_opacity(0.3), run_time=0.4)
        self.play(FadeIn(self.headline(self.line(9)["text"])), run_time=0.5)
        self.finish()
