# Toolchain notes

Facts that each cost a failed run to discover and are not obvious from the code.

## Python and voices
- Two venvs. `.venv`: numpy, kokoro, soundfile (plus `misaki[ja]` and `python -m unidic download` for Japanese).
  `.venv-clone`: chatterbox-tts (pins torch 2.6), kokoro, soundfile, `setuptools<81` (its watermarker imports
  pkg_resources). Always call the venv interpreter explicitly; a system python3 without a torch wheel fails on import.
- Kokoro af_heart averages about 2.8 s per 10-word line; jf_alpha about 3.4 s per 24-character Japanese line.
  Budget the script with that.
- Kokoro reads "3am" as "three A-M". Chatterbox reads digits unreliably in English ("3am" as "TM"): spell numbers
  out in the spoken form (`caption || spoken`); captions keep digits.
- Japanese counters: write 3個, not 3つ (つ is misread).
- Chatterbox listens to only the first 6 to 10 s of the reference clip; `tools/voice_score.py --windows <clip>`
  says which window to cut. Takes are seeded deterministically (base seed + take index): re-roll weak lines with
  `--redo <indices> --redo-takes 10 --seed <new>`. The cache key excludes the seed and includes
  exaggeration, cfg, temperature and takes.
- Chatterbox leaves 1 to 2 s of breath residue at -30 to -40 dBFS after the last word; tts.py trims by RMS windows.
  If lines still end in dead air, that trim is where to look.
- Recording a reference clip: ffmpeg `silenceremove` with `stop_periods=1` cuts at the first pause; trim trailing
  silence with `areverse` instead.
- Run one `voice-critic` at a time: two or three at once each load Whisper and UTMOS and stall the 600 s watchdog.
  Measure with `tools/voice_score.py` directly and reserve the agent for judgment.

## Remotion
- `lineP()` adds line 0's start (the lead silence) to local time, but a `<Beat from={0}>` starts at t=0; inside
  such a Beat use `prog(t, line.start + delay, ...)` directly.
- Zero-length SVG strokes with round caps render as dots: return null while progress is 0.
- Renders fail at "setting up the headless browser" when a font module loads all its unicode-range slices. Call
  `loadFont` only for the slices `subsetsCovering()` returns, and only inside the video that needs the face.
- Compositions are discovered automatically: any `src/videos/<slug>/index.tsx` that exports `video`.
- Cost of one iteration on an 18-core Mac: full 1080x1920 render of a 40 s video about 13 s, mux 1.5 s, frames.sh
  under 1 s; `--concurrency` above the default changes nothing. Re-render freely and verify every fix on the named
  frames (`tools/frames.sh ... --at t1,t2`); the expensive step is a critic round, so never spend one on an unverified fix.
- `src/components/Diagram.tsx` has Box, Line, Arrow and Txt (progress-driven, one stroke); `src/components/Icon.tsx`
  wraps lucide-react with `absoluteStrokeWidth`, so an icon inside a Box has the box's line weight at any size.
- Studio previews use the placeholder `src/videos/<slug>/timeline.json`; copy `videos/<slug>/audio/timeline.json`
  over it to preview real timings.

## Shell
- `sd` treats the pattern as a regex: a pattern containing `||` (the script's caption/spoken separator) matches the
  empty string and inserts the replacement between every character. Use `sd -s` for any pattern with `|`, `.`, `?` or `(`.
- Patch scripts should assert on the presence of key substrings, not exact occurrence counts; silent skips are how
  three patches once went missing.
