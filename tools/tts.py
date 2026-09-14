#!/usr/bin/env python3
"""Synthesize narration one line at a time and build the timing file both engines read.

Usage:
  python tools/tts.py videos/<slug>
  python tools/tts.py videos/<slug> --engine gemini --voice Charon --fallback kokoro
  python tools/tts.py videos/<slug> --voice bm_george --speed 0.95 --force
  .venv-clone/bin/python tools/tts.py videos/<slug> --engine chatterbox --voice brand/voice/<name>.wav --lang a

Reads   videos/<slug>/script.md         (lines under "## Narration"; "caption || spoken" gives the voice a different
                                         text from the caption, e.g. Roman Hinglish caption, Devanagari speech)
Writes  videos/<slug>/audio/line_NN_<hash>.wav   one file per line, cached by content hash
        videos/<slug>/audio/narration.wav        all lines with gaps, 24 kHz mono 16-bit
        videos/<slug>/audio/timeline.json        start/end per line, total duration
        videos/<slug>/audio/props.json           {"timeline": ...} for `remotion render --props`

Engines
  kokoro  local, Apache 2.0, CPU is fine. pip install kokoro soundfile ; apt/brew install espeak-ng
          voices: af_heart (default), af_bella, am_adam, am_michael, bf_emma, bm_george ...
          --lang a (American), b (British), j (Japanese, needs: pip install "misaki[ja]")
  gemini  Gemini TTS via google-genai. Needs GEMINI_API_KEY. Preview models have low RPM; --rpm throttles.
          voices: Charon (default), Kore, Puck, Zephyr, Fenrir, Aoede ...  --style is a natural-language direction.
  chatterbox  local zero-shot voice clone (Resemble AI, MIT). --voice is a reference clip of the speaker: 10 to 20 s,
          one person, no music. Multilingual: --lang uses the kokoro letters (a en, h hi, j ja, e es, f fr, i it, p pt, z zh).
          Pins torch 2.6, so it lives in its own venv: python3.11 -m venv .venv-clone && .venv-clone/bin/pip install chatterbox-tts kokoro soundfile
          GPU or Apple silicon (mps). --exaggeration, --cfg and --temperature tune delivery; --takes N generates N takes
          per line and keeps the one tools/voice_score.py rates most natural. Lines are cached by the clip's content hash.
          A spoken text may switch language per phrase with tags: "[hi]रात के 3 बजे server crash हुआ, [en]but your app
          never went down." Each segment is voiced through its own language path and the pieces are joined with 80 ms gaps.
"""
import argparse
import hashlib
import json
import re
import sys
import time
import wave
from pathlib import Path

import numpy as np

SR = 24000  # both engines emit 24 kHz mono


# ----------------------------------------------------------------------------- script

def read_script(path: Path) -> list[tuple[str, str]]:
    """(caption, spoken) per narration line; spoken defaults to the caption."""
    lines, on = [], False
    for raw in path.read_text(encoding="utf-8").splitlines():
        s = raw.strip()
        if s.lower().startswith("## narration"):
            on = True
            continue
        if s.startswith("## "):
            on = False
            continue
        if not on or not s or s.startswith("#") or s.startswith("<!--"):
            continue
        s = re.sub(r"^\s*(\d+[.)]|[-*])\s+", "", s)  # strip list markers if present
        caption, _, spoken = s.partition(" || ")
        lines.append((caption.strip(), (spoken or caption).strip()))
    if not lines:
        sys.exit(f"[tts] no narration lines found under '## Narration' in {path}")
    return lines


# ----------------------------------------------------------------------------- audio io

def write_wav(path: Path, pcm: np.ndarray) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.astype(np.int16).tobytes())


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as w:
        if w.getframerate() != SR or w.getnchannels() != 1 or w.getsampwidth() != 2:
            raise ValueError(f"{path} is not 24 kHz mono 16-bit")
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)


def to_pcm16(x: np.ndarray) -> np.ndarray:
    if x.dtype == np.int16:
        return x
    x = x.astype(np.float32)
    x = x / max(1.0, float(np.abs(x).max()))  # Chatterbox can peak above 1.0; scale rather than hard-clip
    return (x * 32767).astype(np.int16)


def level_match(lines: list[np.ndarray], max_db: float = 4.0) -> list[np.ndarray]:
    """Bring every line's RMS to the median line's, within +-max_db, so no sentence dips or jumps between takes."""
    rms = np.array([np.sqrt(np.mean((p.astype(np.float32) / 32768) ** 2)) + 1e-9 for p in lines])
    lim = 10 ** (max_db / 20)
    out = []
    for p, r in zip(lines, rms):
        g = float(np.clip(np.median(rms) / r, 1 / lim, lim))
        g = min(g, 32767 / max(1, int(np.abs(p.astype(np.int32)).max())))  # never clip
        out.append(np.clip(p.astype(np.float32) * g, -32768, 32767).astype(np.int16))
    return out


def trim_silence(pcm: np.ndarray, floor_db: float = -40.0, rel_db: float = -24.0, pad_s: float = 0.06) -> np.ndarray:
    """Drop leading/trailing non-speech so line timings are tight. A 20 ms window counts as speech when its RMS is above
    both an absolute floor and the line's own speech level (95th percentile) minus rel_db; Chatterbox leaves breath and
    vocoder residue at -30 to -40 dBFS after the last word, which a sample-peak threshold lets through. Keeps a small pad."""
    x = pcm.astype(np.float32) / 32768.0
    win, hop = int(0.02 * SR), int(0.01 * SR)
    if len(x) < win:
        return pcm
    frames = np.lib.stride_tricks.sliding_window_view(x, win)[::hop]
    rms_db = 20 * np.log10(np.sqrt(np.mean(frames ** 2, axis=1)) + 1e-9)
    speech = float(np.percentile(rms_db, 95))
    loud = np.flatnonzero(rms_db > max(floor_db, speech + rel_db))
    if loud.size == 0:
        return pcm
    # group loud windows into segments separated by 0.25 s or more of quiet, then drop leading/trailing segments that
    # never come within 12 dB of the speech level: those are breath, noise swells and vocoder residue, not words
    cuts = np.flatnonzero(np.diff(loud) * hop > 0.25 * SR)
    segments = np.split(loud, cuts + 1)
    real = [s for s in segments if rms_db[s].max() > speech - 12]
    first, last = (real[0], real[-1]) if real else (segments[0], segments[-1])
    pad = int(pad_s * SR)
    return pcm[max(0, first[0] * hop - pad):min(len(pcm), last[-1] * hop + win + pad)]


def silence(seconds: float) -> np.ndarray:
    return np.zeros(int(seconds * SR), dtype=np.int16)


# ----------------------------------------------------------------------------- engines

class Kokoro:
    name = "kokoro"

    def __init__(self, voice: str | None, speed: float, lang: str):
        from kokoro import KPipeline  # noqa: WPS433 (lazy import keeps gemini-only runs light)
        self.pipe = KPipeline(lang_code=lang)
        self.voice = voice or "af_heart"
        self.speed = speed

    def synth(self, text: str) -> np.ndarray:
        chunks = [np.asarray(audio) for _, _, audio in self.pipe(text, voice=self.voice, speed=self.speed)]
        if not chunks:
            raise RuntimeError(f"kokoro produced no audio for: {text!r}")
        return to_pcm16(np.concatenate(chunks))


class Gemini:
    name = "gemini"

    def __init__(self, voice: str | None, model: str, style: str, rpm: float):
        from google import genai
        from google.genai import types
        self.types = types
        self.client = genai.Client()  # reads GEMINI_API_KEY
        self.voice = voice or "Charon"
        self.model = model
        self.style = style
        self.min_interval = 60.0 / max(rpm, 0.1)
        self.last = 0.0

    def synth(self, text: str) -> np.ndarray:
        t = self.types
        wait = self.min_interval - (time.time() - self.last)
        if wait > 0:
            time.sleep(wait)
        prompt = f"{self.style}\n\n{text}" if self.style else text
        resp = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=t.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=t.SpeechConfig(
                    voice_config=t.VoiceConfig(
                        prebuilt_voice_config=t.PrebuiltVoiceConfig(voice_name=self.voice)
                    )
                ),
            ),
        )
        self.last = time.time()
        part = resp.candidates[0].content.parts[0].inline_data
        data = part.data if isinstance(part.data, (bytes, bytearray)) else __import__("base64").b64decode(part.data)
        return np.frombuffer(data, dtype=np.int16)  # audio/L16 pcm, 24 kHz mono


class Chatterbox:
    name = "chatterbox"
    LANG = {"a": "en", "b": "en", "e": "es", "f": "fr", "h": "hi", "i": "it", "j": "ja", "p": "pt", "z": "zh"}

    def __init__(self, voice: str | None, lang: str, exaggeration: float, cfg: float, temperature: float = 0.8, takes: int = 1, ref_lang: str | None = None, seed: int = 1000):
        if not voice or not Path(voice).is_file():
            sys.exit("[tts] chatterbox needs --voice <reference.wav>: 10 to 20 s of the speaker, one voice, no music")
        import torch
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        self.device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        self.model = ChatterboxMultilingualTTS.from_pretrained(device=self.device)
        if self.model.sr != SR:
            sys.exit(f"[tts] chatterbox sample rate {self.model.sr} != {SR}")
        self.ref = voice
        self.lang = self.LANG.get(lang, lang)
        self.exaggeration, self.cfg, self.temperature, self.takes, self.seed = exaggeration, cfg, temperature, max(1, takes), seed
        # the cache key carries the clip's content and the delivery settings, so any change re-synthesizes every line
        self.voice = f"{Path(voice).name}:{hashlib.sha1(Path(voice).read_bytes()).hexdigest()[:8]}:x{exaggeration}c{cfg}t{temperature}n{self.takes}"
        self.scorer = None
        if self.takes > 1:
            sys.path.insert(0, str(Path(__file__).resolve().parent))
            from voice_score import Scorer, transcribe, transcript_fault  # UTMOS + voice encoder + pitch + pace + transcript checks
            self.transcribe, self.transcript_fault = transcribe, transcript_fault
            try:
                self.scorer = Scorer(voice, ref_lang or self.lang, asr=True)  # ASR gives the clip's speaking rate
            except Exception as e:  # noqa: BLE001
                print(f"[tts] no ASR for the reference ({type(e).__name__}); takes judged without pace or transcripts", file=sys.stderr)
                self.scorer = Scorer(voice, ref_lang or self.lang, asr=False)
                self.transcribe = None
        print(f"[tts] chatterbox on {self.device}, reference {self.voice}, language {self.lang}", file=sys.stderr)

    def _generate(self, text: str) -> np.ndarray:
        """One take. "[hi]...[en]..." tags switch the language path per phrase; untagged text uses --lang."""
        segments = re.findall(r"\[([a-z]{2})\]([^\[]+)", text) or [(self.lang, text)]
        gap = np.zeros(int(0.08 * SR), dtype=np.float32)
        pieces = []
        for lang, seg in segments:
            wav = self.model.generate(seg.strip(), language_id=lang, audio_prompt_path=self.ref,
                                      exaggeration=self.exaggeration, cfg_weight=self.cfg, temperature=self.temperature)
            seg_pcm = trim_silence(to_pcm16(wav.squeeze().float().cpu().numpy()))  # each segment loses its own residue before the join
            pieces += [seg_pcm.astype(np.float32) / 32768.0, gap]
        return np.concatenate(pieces[:-1])

    def synth(self, text: str, takes: int | None = None) -> np.ndarray:
        import torch
        best, best_score = None, -1.0
        for k in range(takes or self.takes):
            torch.manual_seed(self.seed + k)
            y = trim_silence(to_pcm16(self._generate(text))).astype(np.float32) / 32768.0  # judge the take without its residue tail
            if self.scorer is None:
                return to_pcm16(y)
            r = self.scorer.line(y, spoken=text, lang=self.lang)
            if self.transcribe is not None:  # a repeated or dropped phrase is a fault no acoustic score can see
                import soundfile as sf, tempfile
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                    sf.write(tmp.name, y, SR)
                    fault = self.transcript_fault(re.sub(r"\[[a-z]{2}\]", "", text), self.transcribe(tmp.name, self.lang))
                Path(tmp.name).unlink()
                if fault:
                    r["faults"], r["score"] = r["faults"] + [fault], r["score"] - 3.0
            print(f"[tts]   take {k}: {r['score']:.1f} (utmos {r['utmos']:.2f} sim {r['sim']:.2f} f0 {r['f0std']:.1f}st rate {r['rate'] or '-'} gap {r['gap']:.2f} {' '.join(r['faults'])}) {len(y)/SR:.1f}s", file=sys.stderr)
            if r["score"] > best_score:
                best, best_score = y, r["score"]
        return to_pcm16(best)


def make_engine(name: str, a: argparse.Namespace, primary: bool):
    voice = a.voice if primary else None
    if name == "kokoro":
        return Kokoro(voice, a.speed, a.lang)
    if name == "gemini":
        return Gemini(voice, a.model, a.style, a.rpm)
    if name == "chatterbox":
        return Chatterbox(voice, a.lang, a.exaggeration, a.cfg, a.temperature, a.takes, a.ref_lang, a.seed)
    sys.exit(f"[tts] unknown engine {name}")


# ----------------------------------------------------------------------------- main

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video_dir")
    ap.add_argument("--engine", default="kokoro", choices=["kokoro", "gemini", "chatterbox"])
    ap.add_argument("--fallback", default=None, choices=["kokoro", "gemini", "chatterbox"],
                    help="engine to switch to if the primary raises (quota, network)")
    ap.add_argument("--voice", default=None, help="kokoro/gemini: voice preset; chatterbox: path to the reference clip")
    ap.add_argument("--speed", type=float, default=1.0, help="kokoro only")
    ap.add_argument("--lang", default="a", help="kokoro and chatterbox: a, b, j, h ...")
    ap.add_argument("--exaggeration", type=float, default=0.5, help="chatterbox only: 0.3 flat .. 0.7 expressive")
    ap.add_argument("--cfg", type=float, default=0.5, help="chatterbox only: lower is freer, higher sticks to the reference")
    ap.add_argument("--temperature", type=float, default=0.8, help="chatterbox only: sampling temperature")
    ap.add_argument("--takes", type=int, default=1, help="chatterbox only: takes per line, best one kept (needs tools/voice_score.py deps)")
    ap.add_argument("--ref-lang", default=None, help="chatterbox --takes: language of the reference clip when it differs from --lang")
    ap.add_argument("--redo", default="", help="chatterbox: comma-separated line indices to re-roll with fresh seeds, other lines stay cached")
    ap.add_argument("--redo-takes", type=int, default=None, help="chatterbox: takes for the --redo lines (default --takes)")
    ap.add_argument("--seed", type=int, default=1000, help="chatterbox: base seed for takes; use a new one with --redo")
    ap.add_argument("--model", default="gemini-3.1-flash-tts-preview", help="gemini only")
    ap.add_argument("--rpm", type=float, default=8.0, help="gemini only: throttle requests per minute")
    ap.add_argument("--style", default="Read this line as calm, clear narration for a short educational explainer. "
                                       "Unhurried, confident, no drama.", help="gemini only")
    ap.add_argument("--gap", type=float, default=0.35, help="silence between lines, seconds")
    ap.add_argument("--lead", type=float, default=0.40, help="silence before the first line")
    ap.add_argument("--tail", type=float, default=0.90, help="silence after the last line")
    ap.add_argument("--force", action="store_true", help="ignore cached line files")
    a = ap.parse_args()

    vdir = Path(a.video_dir)
    adir = vdir / "audio"
    adir.mkdir(parents=True, exist_ok=True)
    lines = read_script(vdir / "script.md")

    engine = make_engine(a.engine, a, primary=True)
    line_pcms: list[np.ndarray] = []
    out_lines = []

    for i, (text, spoken) in enumerate(lines):
        key = hashlib.sha1(f"{engine.name}|{engine.voice}|{a.speed}|{spoken}".encode()).hexdigest()[:10]
        f = adir / f"line_{i:02d}_{key}.wav"
        for stale in adir.glob(f"line_{i:02d}_*.wav"):
            if stale != f:
                stale.unlink()
        redo = i in {int(x) for x in a.redo.split(",") if x.strip()}
        if f.exists() and not a.force and not redo:
            raw = read_wav(f)
            pcm, src = trim_silence(raw), "cache"  # re-trim: the rule may have tightened since the take was cached
            if len(pcm) != len(raw):
                write_wav(f, pcm)  # keep the file equal to what the video uses, so tools/voice_score.py judges the same audio
        else:
            try:
                pcm = engine.synth(spoken, a.redo_takes) if redo and engine.name == "chatterbox" else engine.synth(spoken)
            except Exception as e:  # noqa: BLE001
                if a.fallback and a.fallback != engine.name:
                    print(f"[tts] {engine.name} failed on line {i}: {type(e).__name__}: {e}\n"
                          f"[tts] switching to {a.fallback} for the remaining lines", file=sys.stderr)
                    engine = make_engine(a.fallback, a, primary=False)
                    pcm = engine.synth(spoken)
                else:
                    raise
            pcm = trim_silence(pcm)
            write_wav(f, pcm)
            src = engine.name
        line_pcms.append(pcm)
        out_lines.append({"i": i, "text": text, "spoken": spoken, "audio": f.name, "engine": src})
        print(f"[tts] {i:02d} {len(pcm) / SR:5.2f}s  {src:6s} {spoken}")

    parts: list[np.ndarray] = [silence(a.lead)]
    cursor = a.lead
    for i, pcm in enumerate(level_match(line_pcms)):
        dur = len(pcm) / SR
        out_lines[i].update({"start": round(cursor, 3), "end": round(cursor + dur, 3), "dur": round(dur, 3)})
        parts.append(pcm)
        cursor += dur
        if i < len(lines) - 1:
            parts.append(silence(a.gap))
            cursor += a.gap
    parts.append(silence(a.tail))
    total = round(cursor + a.tail, 3)
    write_wav(adir / "narration.wav", np.concatenate(parts))

    timeline = {
        "fps": 30, "sample_rate": SR,
        "engine": a.engine, "voice": engine.voice, "speed": a.speed,
        "gap": a.gap, "lead": a.lead, "tail": a.tail,
        "total_duration": total, "lines": out_lines,
    }
    (adir / "timeline.json").write_text(json.dumps(timeline, indent=2, ensure_ascii=False))
    (adir / "props.json").write_text(json.dumps({"timeline": timeline}, indent=2, ensure_ascii=False))

    print(f"[tts] {len(lines)} lines, total {total:.2f}s -> {adir/'narration.wav'}")
    if total > 55:
        print("[tts] WARNING: over 55 s. Cut lines rather than speeding the voice.", file=sys.stderr)


if __name__ == "__main__":
    main()
