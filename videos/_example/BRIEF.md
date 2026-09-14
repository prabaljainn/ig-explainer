# _example (Eratosthenes measures the Earth)

Topic: how the Earth's circumference was first measured, ~240 BC
Audience: curious general viewers, no maths background
The one surprising idea: one shadow angle, transferred to the centre of the Earth, turns a distance between two cities into the size of the planet.
Hero diagram: a circle (Earth) with parallel sun rays; a stick at Syene with no shadow, a stick at Alexandria with a shadow; the shadow angle is drawn at Alexandria, then the same angle is drawn at the centre; the arc between the cities is then repeated 50 times around the circle.
Engine: remotion
Why this engine: it is the template composition (engine/remotion/src/videos/_template). The same topic in Manim is engine/manim/template_scene.py.
Accent color: none
Notes / overrides to CLAUDE.md: the drawn angle is exaggerated (24 deg instead of 7.2) while the shadow is explained so it
reads on a phone; a dim label says so. On line 5 Alexandria slides to the true 7.2 deg, so the fifty arcs on line 7 are
exactly the arc on screen. The diagram centre sits 40 px below CONTENT_MID so the hook headline fits above the Earth.
