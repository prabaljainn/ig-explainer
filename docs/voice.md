# Voice, languages and manual operation

Everything the one-line commands hide. The README is the overview; this is the reference the pipeline and the
`explainer` skill point at.

## Voices

Narration is synthesized **one line at a time** and cached by content hash, so editing a single line
re-synthesizes only that line. The per-line timings become `audio/timeline.json`, which every scene reads.

```bash
.venv/bin/python tools/tts.py videos/<slug>                                # kokoro, af_heart (default)
.venv/bin/python tools/tts.py videos/<slug> --voice bm_george --speed 0.97 # another preset
.venv/bin/python tools/tts.py videos/<slug> --engine gemini --voice Charon --fallback kokoro
```

Kokoro presets include `af_heart`, `af_bella`, `am_adam`, `am_michael`, `bf_emma`, `bm_george`. Gemini needs
`GEMINI_API_KEY`; its preview models have low rate limits, so `--rpm` throttles and `--fallback kokoro` covers a
failure mid-video.

Always call the venv interpreter explicitly. A system `python3` has no Kokoro wheel and fails on import.

## Other languages

Kokoro speaks Hindi and Japanese as well as English:

```bash
.venv/bin/python tools/tts.py videos/<slug> --lang h --voice hf_alpha   # Hindi, Devanagari script only
.venv/bin/python tools/tts.py videos/<slug> --lang j --voice jf_alpha   # Japanese
```

Japanese needs its extras once:

```bash
.venv/bin/pip install "misaki[ja]" && .venv/bin/python -m unidic download
```

Two things that bite:

- Write Japanese counters as `3個`, not `3つ`. Kokoro misreads `つ`.
- Instrument Sans has no CJK or Devanagari glyphs. A Japanese video loads Noto Sans JP
  (`brand/style.json` → `font.family_ja`) and only the font slices its script needs, via `subsetsCovering()` in
  `engine/remotion/src/lib/fonts.tsx`. Loading every slice makes the render fail while starting the headless
  browser. Keep each Japanese clause to 19 full-width characters or fewer, or the caption breaker falls through to
  word segmentation and splits compounds.

`videos/kubernetes-basics-ja` is the worked example. It reuses the English composition through
`makeVideo(id, timeline, config)`, so a translation is a new script, a new narration and a re-render.

### Hinglish and other code-mixing

A line can be spoken differently from how it is captioned. Under `## Narration`, write `caption || spoken`:

```
Your app never went down. || रात के 3 बजे server crash हुआ, but your app never went down.
```

The caption is what appears on screen; the spoken form is what the voice reads. For Hinglish, keep the Hindi
words in Devanagari and leave the English technical words in English, then read it with `--lang h`.

A spoken form can also switch language per phrase with tags, so each phrase gets its own pronunciation:

```
[hi]रात के 3 बजे server crash हुआ, [en]but your app never went down.
```

Segments are voiced through their own language path and stitched with 80 ms gaps. `videos/kubernetes-basics-hinglish`
is the worked example.

Spell numbers out in the spoken form when a voice reads them unreliably; captions keep the digits.

## Your own voice

`--engine chatterbox` clones a speaker from a reference clip using [Chatterbox](https://github.com/resemble-ai/chatterbox)
(Resemble AI, MIT), multilingual across English, Hindi, Japanese and 20 more. It pins torch 2.6, so it installs
into its own environment:

```bash
./install.sh --voice-clone
```

Record 15 to 20 seconds in a quiet room, one voice, no music:

```bash
mkdir -p brand/voice                                                          # gitignored; recordings stay private
ffmpeg -f avfoundation -i ":0" -t 20 -ar 24000 -ac 1 brand/voice/<name>.wav   # macOS
ffmpeg -f pulse -i default -t 20 -ar 24000 -ac 1 brand/voice/<name>.wav       # Linux (or -f alsa)
```

Then narrate with it:

```bash
.venv-clone/bin/python tools/tts.py videos/<slug> \
  --engine chatterbox --voice brand/voice/<name>.wav --lang a
```

**Delivery controls.** `--exaggeration` (0.3 flat, 0.7 lively), `--cfg` (0.3 freer, 0.5 closer to the clip) and
`--temperature` shape the read. `--takes N` generates N takes per line and keeps the one the scorer rates most
natural. `--redo 2,9 --redo-takes 10 --seed 2000` re-rolls only those lines with fresh seeds while every other
line stays cached.

**Pick the right few seconds.** Chatterbox listens to only the first 6 to 10 seconds of the reference clip.

```bash
.venv-clone/bin/python tools/voice_score.py --windows brand/voice/<name>.wav --lang en
```

That prints which window to cut the clip down to.

**The gate.** `voice-critic` is to cloned audio what `video-critic` is to the picture. It runs
`tools/voice_score.py`, which scores every line against the reference: UTMOS naturalness, speaker similarity,
pitch variability, speaking rate relative to the clip, and Whisper's character error rate for the spoken text.

```bash
.venv-clone/bin/python tools/voice_score.py videos/<slug> --ref brand/voice/<name>.wav --lang en --round 1
```

Transcription uses mlx-whisper on Apple silicon and faster-whisper elsewhere; `install.sh --voice-clone` picks the
right one. Run one voice critic at a time. Two or three at once each load Whisper and a naturalness model and
stall the watchdog.

A reference clip of someone's voice is personal data. `brand/voice/` is gitignored for that reason.

## Running the pipeline by hand

The skill does all of this for you. When you want to drive it yourself:

```bash
tools/new_video.sh bicycle-balance remotion       # or manim
#   fill videos/bicycle-balance/BRIEF.md and script.md
.venv/bin/python tools/tts.py videos/bicycle-balance

#   Remotion: edit engine/remotion/src/videos/bicycle-balance/index.tsx, then
cd engine/remotion && npx remotion render src/index.ts bicycle-balance \
   ../../videos/bicycle-balance/out/video.mp4 \
   --props=../../videos/bicycle-balance/audio/props.json && cd ../..

#   Manim: edit videos/bicycle-balance/manim/scene.py, then
tools/render_manim.sh bicycle-balance

tools/mux.sh videos/bicycle-balance/out/video.mp4 \
   videos/bicycle-balance/audio/narration.wav \
   videos/bicycle-balance/out/final.mp4
tools/frames.sh videos/bicycle-balance/out/final.mp4 videos/bicycle-balance/critic/self 10
```

`tools/frames.sh` also takes `--at 12.4,33.1` to sample exactly the timestamps a critic round named, which is how
you verify a fix without spending another round.

**Preview while editing:**

```bash
cd engine/remotion && npm run studio
```

Set `debug` on `<Stage>` to draw the safe-zone guides. The Studio uses the placeholder timeline in
`src/videos/<slug>/timeline.json`; copy `videos/<slug>/audio/timeline.json` over it to preview real timings.

**Never re-run narration to fix timing.** Timing problems are scene problems. Re-run it only when the script text
changed.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `ModuleNotFoundError: No module named 'kokoro'` | System Python. Use `.venv/bin/python`, or `.venv-clone/bin/python` for Chatterbox. |
| `Error processing file '/Users/runner/.../phontab'` | The checkout path is too deep: espeak-ng keeps its data path in a fixed buffer of about 160 characters. Move the checkout somewhere shorter, such as `~/ig-explainer`. `tools/doctor.sh` warns about this. |
| Render fails at "setting up the headless browser" | A font module is loading every unicode-range slice. Load only the slices `subsetsCovering()` returns, inside the video that needs the face. |
| Captions early or late | A scene hardcoded a second. Every start time comes from `audio/timeline.json`. |
| Narration lines end in dead air | Chatterbox leaves breath residue; `tools/tts.py` trims by RMS windows. Check that trim before blaming the take. |
