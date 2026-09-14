# ig-explainer

Turn a topic into a finished vertical explainer video from inside Claude Code, with an independent critic that
refuses to pass anything it would not publish.

```
/explainer how a bicycle stays upright
```

A few minutes later: a 1080x1920 MP4 with narration, captions timed to every spoken line, a cover frame and a post
caption. The builder agent writes the script, synthesizes each line locally, animates the scenes in Remotion or
Manim from the narration timing, muxes, and hands the result to a `video-critic` subagent that scores it 0 to 10
against a rubric. Under 8.0 the builder gets a ranked fix list and tries again, up to 3 rounds.

<p align="center"><img src="videos/_example/out/demo.gif" width="360" alt="The worked example: Eratosthenes measures the Earth, silent preview"></p>

Silent preview of the worked example (`/explainer how the Earth was first measured`). The finished MP4 with
narration timed to every caption is on the [releases page](https://github.com/prabaljainn/ig-explainer/releases/latest);
the contact sheet the critic works from is further down.

## What makes it different

- **Narration first.** Every line is synthesized on its own, so captions and scene beats start exactly when the
  words do. Change a line, re-run TTS, and the timing follows. No hand-tuned seconds anywhere.
- **A critic that is not the author.** A separate subagent with its own context samples frames, reads the script,
  and scores readability, composition, correctness, consistency and pacing, with hard caps for clipped text,
  Instagram's unsafe zones, and frames that contradict the narration.
- **One look.** Black background, white ink, one typeface, one stroke weight, one optional accent. Every token
  lives in `brand/style.json`; nothing is hardcoded. Icons, when a diagram needs them, are Lucide line icons drawn
  at the same stroke, never raster images.
- **Works from anywhere.** Install once; `/explainer <topic>` runs in any directory, including a project you want
  explained.
- **Local by default.** Kokoro TTS on CPU, about 3 s per line, nothing leaves the machine. Gemini TTS and
  voice cloning are opt-in.

## Requirements

- macOS or Linux with [Claude Code](https://claude.com/claude-code)
- `ffmpeg`, Node 20+, Python 3.10 to 3.12 (Kokoro does not support newer)
- `espeak-ng`, Kokoro's fallback phonemizer: `brew install espeak-ng` or `sudo apt install espeak-ng`
- Manim engine only: `cairo`, `pango`, `pkg-config`, and the
  [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans) font installed locally (Remotion loads it
  from Google Fonts by itself)

## Install

```bash
git clone https://github.com/prabaljainn/ig-explainer && cd ig-explainer
./install.sh            # add --manim and/or --voice-clone if you want them; --cpu on a machine without a GPU
```

`install.sh` checks ffmpeg and Node first, creates the Python venv, installs Remotion's dependencies, links the `explainer` skill and the two
critic agents into `~/.claude`, and ends with `tools/doctor.sh`: one line per requirement, with the fix for
anything missing. Restart Claude Code afterwards; skills and agents load at session start. If you move the
checkout, re-run `./install.sh` (or export `EXPLAINER_ROOT`).

## Use

From any directory:

```
/explainer how a bicycle stays upright
/explainer why Kubernetes restarts your pod manim
```

Inside this repository `/video <topic>` does the same. The agent reports the slug, engine, line count, total
duration, the score of each critic round, and the path to `videos/<slug>/out/final.mp4`. Ask for the files next
to you and it copies `final.mp4`, `final_cover.jpg` and `post.md` into `./explainer/<slug>/`.

## How it works

```
CLAUDE.md                        the rulebook the builder follows: output contract, look, script rules, workflow
skills/explainer/SKILL.md        the global skill: finds this checkout and runs the rulebook from any directory
skills/explainer/reference/      what the critic docks points for; toolchain notes that each cost a failed run
.claude/agents/video-critic.md   the critic subagent: own context, Bash + Read only, returns JSON
.claude/agents/voice-critic.md   the same gate for cloned narration
brand/style.json                 the only place colors, type sizes, safe zones and fps live
tools/tts.py                     per-line narration -> narration.wav + timeline.json + props.json
tools/mux.sh                     add narration, social loudness, cover frame; verify 1080x1920, audio, under 60 s
tools/frames.sh                  frame sampler + contact sheet (builder self-check and critic)
tools/new_video.sh               scaffold videos/<slug>/ and the engine stub
tools/render_manim.sh            render a Manim scene at 1080x1920 30 fps
tools/doctor.sh                  preflight for the machine
engine/remotion/                 one Remotion project; each video is src/videos/<slug>/, discovered automatically
engine/remotion/src/components/  Stage, Captions, Text, Diagram primitives (Box, Line, Arrow), Lucide line icons
engine/manim/                    igstyle.py (IGScene base) + template_scene.py
videos/_example/                 worked example (Eratosthenes), reference render above; its composition is
                                 engine/remotion/src/videos/_template (id `template`)
videos/kubernetes-basics*/       one real video in English, Japanese and Hinglish, sharing a composition
```

The loop, per video:

1. Brief: the one surprising idea and the single hero diagram. Engine: Manim for geometry and transformations,
   Remotion for typography, layouts and charts.
2. Script: 8 to 14 lines, one idea per line, 12 words or fewer, hook first, takeaway last.
3. `tools/tts.py` synthesizes each line and writes the timeline every scene reads.
4. Scenes: objects persist and transform across lines; motion exists to explain, never to decorate.
5. Render, mux, self-check on a contact sheet against `skills/explainer/reference/critic-patterns.md`.
6. `video-critic` scores it. Under 8.0: fix in rank order, re-render, repeat, at most 3 rounds.

![Contact sheet of the worked example, ten frames from hook to takeaway](videos/_example/out/template_render_sheet.png)

## Voice

Default is **Kokoro** running locally (Apache 2.0, 82M params, CPU is fine, about 3 s per line). It was chosen
because narration is synthesized one line at a time so captions and scenes can be timed to it exactly, and a
dozen calls per video runs straight into the rate limits hosted preview TTS still has. Local also means the same
voice on every video, no quota surprises, and nothing leaves the machine. Gemini stays available for expressive
delivery:

```bash
.venv/bin/python tools/tts.py videos/<slug>                                  # kokoro, af_heart
.venv/bin/python tools/tts.py videos/<slug> --voice bm_george --speed 0.97   # different preset
.venv/bin/python tools/tts.py videos/<slug> --engine gemini --voice Charon --fallback kokoro   # needs GEMINI_API_KEY
```

Lines are cached by content hash, so editing one line re-synthesizes only that line.

### Your own voice (Chatterbox)

`--engine chatterbox` clones a speaker from a reference clip with Resemble AI's Chatterbox (MIT), multilingual
(English, Hindi, Japanese and 20 more). It pins torch 2.6, so it lives in its own venv (`./install.sh --voice-clone`);
Apple silicon (Metal) or a CUDA GPU is fine, CPU is slow.

```bash
mkdir -p brand/voice                                                               # gitignored: recordings stay private
ffmpeg -f avfoundation -i ":0" -t 20 -ar 24000 -ac 1 brand/voice/<name>.wav        # macOS: record 15 to 20 s, quiet room, one voice
ffmpeg -f pulse -i default -t 20 -ar 24000 -ac 1 brand/voice/<name>.wav            # Linux (or -f alsa)
.venv-clone/bin/python tools/tts.py videos/<slug> --engine chatterbox --voice brand/voice/<name>.wav --lang a
```

`--exaggeration` (0.3 flat, 0.7 lively), `--cfg` (0.3 freer, 0.5 closer to the clip) and `--temperature` tune
delivery; `--takes 4` generates four takes per line and keeps the most natural one; `--redo 2,9 --redo-takes 10
--seed 2000` re-rolls only those lines with fresh seeds while the rest stay cached. Chatterbox listens to the first
6 to 10 s of the reference, so cut the clip to its best window (`tools/voice_score.py --windows <clip>` says which).

The `voice-critic` subagent is the gate for cloned audio, the way `video-critic` is for the picture. It runs
`tools/voice_score.py`, which scores every line against the reference clip: UTMOS naturalness, speaker
similarity, pitch variability and speaking rate relative to the clip, and Whisper's character error rate
(mlx-whisper on Apple silicon, faster-whisper elsewhere; `install.sh --voice-clone` picks the right one).

### Other languages

Kokoro speaks Hindi (`--lang h --voice hf_alpha`, Devanagari script only) and Japanese (`--lang j --voice jf_alpha`,
needs `.venv/bin/pip install "misaki[ja]" && .venv/bin/python -m unidic download`; write counters as 3個, not 3つ).
Instrument Sans has no CJK or Devanagari glyphs: a Japanese video loads Noto Sans JP (`brand/style.json`
`font.family_ja`) in its `index.tsx`, only the font slices its script needs (`src/lib/fonts.tsx`), and captions
break after punctuation or at word boundaries. `videos/kubernetes-basics-ja` is the worked example: it reuses the
English composition through `makeVideo(id, timeline, config)`, so a translation is a new script, TTS and a render.

Hinglish (Roman-script captions, Hindi pronunciation) uses a spoken form per line: `caption || spoken`, with the
Hindi words in Devanagari and the English tech words left in English, read with `--lang h`. The caption is what
appears on screen; `videos/kubernetes-basics-hinglish` is the worked example. A spoken form can switch language
per phrase with tags, `[hi]रात के 3 बजे server crash हुआ, [en]but your app never went down.`, so each phrase gets
its own pronunciation.

## Running it by hand

```bash
tools/new_video.sh bicycle-balance remotion       # or manim
#   fill videos/bicycle-balance/BRIEF.md and script.md
.venv/bin/python tools/tts.py videos/bicycle-balance
#   Remotion: edit engine/remotion/src/videos/bicycle-balance/index.tsx, then
cd engine/remotion && npx remotion render src/index.ts bicycle-balance \
   ../../videos/bicycle-balance/out/video.mp4 --props=../../videos/bicycle-balance/audio/props.json && cd ../..
#   Manim: edit videos/bicycle-balance/manim/scene.py, then
tools/render_manim.sh bicycle-balance
tools/mux.sh videos/bicycle-balance/out/video.mp4 videos/bicycle-balance/audio/narration.wav videos/bicycle-balance/out/final.mp4
tools/frames.sh videos/bicycle-balance/out/final.mp4 videos/bicycle-balance/critic/self 10
```

Preview while editing: `cd engine/remotion && npm run studio` (set `debug` on `<Stage>` to see the safe-zone
guides). The Studio uses the placeholder timeline in `src/videos/<slug>/timeline.json`; copy
`videos/<slug>/audio/timeline.json` over it to preview with real timings.

## Privacy and licensing

- `brand/voice/` is gitignored: reference recordings are personal data, never a brand asset. Generated audio,
  renders and critic frames are gitignored too; a video's `BRIEF.md`, `script.md` and composition are checked in
  only when you want it as an example.
- This repository: MIT. Manim: MIT. Kokoro: Apache 2.0. Chatterbox: MIT. Instrument Sans: OFL.
- Remotion is source-available, not open source: free for individuals and small companies, otherwise a company
  license is required. Check https://remotion.dev/license before publishing under a company account.
- Gemini TTS preview models: free-tier prompts may be used to improve Google's products; use a paid key for
  anything you would not want reused.
