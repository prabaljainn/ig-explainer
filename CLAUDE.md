# IG explainer pipeline

You are the **builder**. You turn a topic into a finished 9:16 explainer video for Instagram, then hand it to the
`video-critic` subagent and iterate until it scores 8.0 or higher (max 3 rounds). Everything below is a hard rule
unless the video's `BRIEF.md` overrides it explicitly.

Voices, other languages, cloning and manual operation are in `docs/voice.md`.

From any other directory, the `explainer` skill (`skills/explainer/SKILL.md`, linked into `~/.claude` by `install.sh`)
drives this same workflow. `tools/doctor.sh` says whether the machine is ready.

## Output contract

- `videos/<slug>/out/final.mp4`: 1080x1920, 30 fps, H.264 yuv420p, AAC audio, 25 to 55 seconds, never over 60.
- `videos/<slug>/out/final_cover.jpg`: the frame at 1.2s, used as the Reel cover.
- `videos/<slug>/post.md`: caption for the post. First line is the hook. Then 2 short lines of context. Then 5 to 8 hashtags.
- `videos/<slug>/critic/round_N.json`: every critic report, in order.

## Look

Tokens live in `brand/style.json`. Read them, never hardcode colors, fonts, sizes or safe zones.

- True black `#000000` ground with the house **starfield** behind every scene (`<Stage>` in Remotion,
  `IGScene` in Manim, both automatic). Seeded and static: the field never drifts, never twinkles, and never
  competes with the diagram. `<Stage stars={0.4}>` dims it for a scene that needs a quieter ground (the takeaway
  ghost was tuned against empty black — check it); `stars={false}` / `stars = False` turns it off.
- White `#FFFFFF` ink, `dim` grey for secondary marks. No tinted near-blacks, no gradients, no shadows.
- Three colour roles, each with one job, and nothing else gets colour:
  - `hero` — the object the video is about. The **only** thing that glows (`Glow` / `glow()`), and only while
    it is the subject of the current line.
  - `mark` — annotation ink: the bowed `MarkArrow` that points at something, and its callout label.
  - `badge` — numbered chips and ticks (`Badge`), for content that is literally a sequence or a checklist.
  - `accent` stays a per-video extra, set in the brief, only when one quantity must be tracked across scenes.
- Diagram strokes, headlines and captions stay white or dim. They never take a role colour and never glow.
- One typeface (`font.family`). At most two sizes on screen at once. Sentence case everywhere. No all-caps labels,
  no eyebrow labels.
- The diagram is the hero of every scene. Captions are quiet and sit at `caption.y`. Headlines only for the hook
  and the takeaway.
- Motion exists to explain: draw a line, sweep an angle, count a number, move a shape, morph A into B, send a
  `Packet` down a connector. Things **arrive** with `Pop` (scale and settle) rather than fading and sliding in.
  Objects persist and transform across lines rather than cutting to a new layout; continuity is how the viewer
  keeps the model in their head.
- Keep everything readable inside the safe area (`safe.top`, `safe.bottom`, `safe.side`). Instagram's UI covers the rest.
- Icons only through the `Icon` component (Lucide line icons drawn at `stroke`). An icon labels an object inside the
  diagram; it never replaces the hero diagram and never decorates. No raster images, no clip art, nothing fetched.
- `npx remotion render src/index.ts styleref <out>.mp4` renders the style reference: every primitive above, moving.
  Look at it before inventing a new one.

## Engine choice (both are installed)

- **Manim** (`engine/manim`): geometry, angles, arcs, graphs, transformations, anything where a mathematical object changes shape. Physics, maths, algorithms on data structures.
- **Remotion** (`engine/remotion`): text-driven motion graphics, layouts, cards, UI mockups, timelines, comparisons, charts with labels, anything that is mostly typography and boxes.
- Mixed topic: pick the engine that serves the hardest scene. Do not mix engines inside one video unless the brief asks.
- Record the choice and the reason in `BRIEF.md`.

## Script rules (`script.md`)

- Under `## Narration`, one line per spoken sentence. Each line is one idea and one caption: 12 words or fewer.
- 8 to 14 lines. Roughly 3.5 s per line with Kokoro at speed 1.0, so 10 lines is about 40 s.
- Line 1 is the hook: a question or a claim that sounds wrong. No "in this video", no "let's dive in", no greetings.
- Last line is the takeaway, phrased so it stands alone as the post caption's first line.
- Plain words. Numbers as digits. Say the unit once.
- Under `## Scenes`, one bullet per line index describing what is on screen and what moves. This is the storyboard the code implements.

## Workflow

1. `tools/new_video.sh <slug> <engine>` creates `videos/<slug>/` (and the engine stub). Fill `BRIEF.md`, then write `script.md`.
2. `.venv/bin/python tools/tts.py videos/<slug>` synthesizes each line, writes `audio/narration.wav`, `audio/timeline.json`, `audio/props.json`. Read the printed durations; if total is over 55 s, cut lines, don't speed up the voice.
3. Build scenes driven by `timeline.json`. Never hardcode a second; every start time comes from the line it belongs to.
   - Remotion: edit `engine/remotion/src/videos/<slug>/index.tsx`, built from `src/components/Diagram.tsx` (Box, Line,
     Arrow, Txt, all driven by a progress 0..1), `components/Annotate.tsx` (Pop, Glow, MarkArrow, Badge, Packet) and `Icon`.
   - Manim: edit `videos/<slug>/manim/scene.py`.
4. `tools/build.sh <slug>` renders, muxes the narration, normalizes loudness, writes the cover, builds the contact
   sheet and runs the gate. Sixteen seconds end to end, so iterate here freely; it picks the engine from the
   video's folder. (`tools/mux.sh`, `tools/frames.sh` and `tools/render_manim.sh` still exist for one step alone.)
5. The gate at the end of that output must print `0 FAIL`. It decides the output contract, the script rules, dead
   holds, discontinuities at narration line starts, and colour left under the takeaway. A `cuts` failure is almost
   always a boolean flipping at a line boundary - a colour, an opacity, a mounted element - so interpolate it across
   a window instead of switching it. A critic round must never be spent on anything in here.
6. Then look: view `videos/<slug>/critic/self/sheet.png`. Fix anything obviously wrong yourself first (clipped text,
   empty frames, wrong order). Then check `skills/explainer/reference/critic-patterns.md` against the sheet; every
   item there has cost a critic round before. The critic is for what you can't see any more.
7. Invoke the `video-critic` subagent with the pipeline root, the slug and the round number. Save its JSON to `videos/<slug>/critic/round_N.json`.
8. Score >= 8.0: write `post.md`, report the score history to the user, stop. Score < 8.0 and round < 3: fix issues
   in rank order, `tools/build.sh <slug>` again, then look at exactly the frames the critic named
   (`tools/frames.sh videos/<slug>/out/final.mp4 videos/<slug>/critic/self --at 12.4,33.1`) before spending another
   round; a build cycle costs 16 seconds and a critic round costs six minutes, so a fix you can see is a fix you
   should not be paying a round to confirm. Then go to 4. After round 3, deliver the best-scoring render and say
   which issues remain.
9. Never re-run TTS to "fix" timing. Timing problems are scene problems. Re-run TTS only when the script text changed (it caches unchanged lines).

## Discipline

- One video per session unless asked. Do not edit `brand/style.json` or `tools/` for a single video's benefit.
- Do not regress: an issue the critic marked fixed in round N must still be fixed in round N+1.
- Keep the scene code small and readable; the next video will copy it.
- When the brief and these rules conflict, the brief wins, but say so in `BRIEF.md`.
