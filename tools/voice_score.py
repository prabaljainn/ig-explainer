#!/usr/bin/env python3
"""Score cloned narration against its reference clip: naturalness, speaker similarity, prosody, intelligibility.

Run from .venv-clone (the chatterbox venv):
  .venv-clone/bin/python tools/voice_score.py videos/<slug> --ref brand/voice/<name>.wav --lang en [--round 1] [--no-asr]
  .venv-clone/bin/python tools/voice_score.py --windows brand/voice/<name>.wav --lang hi     # which 10 s of the clip to condition on

Per line: UTMOS (a MOS predictor, 1..5) relative to the reference's own UTMOS, cosine similarity of Chatterbox
voice-encoder embeddings to the reference, pitch variability (F0 std, semitones) as a ratio to the reference, speaking
rate as a ratio to the reference (same language only), and the ASR character error rate of the spoken text (mlx-whisper).
Line score 0..10 = 0.30 naturalness + 0.25 similarity + 0.35 pitch + 0.10 rate (pitch variability is what separates a
lively read from a robotic one; UTMOS saturates against a phone-recorded reference). Video score = mean, capped 1.5 above the
worst line, 7.0 if an English line's CER is over 0.35 (advisory for other languages), 6.0 if the narration runs over 55 s. Writes videos/<slug>/critic/voice_<N>.json.
"""
import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np

SR = 24000
LANG = {"a": "en", "b": "en", "h": "hi", "j": "ja", "e": "es", "f": "fr", "i": "it", "p": "pt", "z": "zh"}
ASR_MODEL = "mlx-community/whisper-large-v3-turbo"  # mlx-whisper
ASR_MODEL_FW = "large-v3-turbo"                      # faster-whisper alias of the same model


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def load_wav(path, sr: int = SR) -> np.ndarray:
    import librosa
    import soundfile as sf
    y, s = sf.read(str(path), dtype="float32", always_2d=False)
    if y.ndim > 1:
        y = y.mean(axis=1)
    return librosa.resample(y, orig_sr=s, target_sr=sr) if s != sr else y


def transcribe(path, lang: str) -> str:
    try:
        import mlx_whisper  # Apple silicon
        return mlx_whisper.transcribe(str(path), path_or_hf_repo=ASR_MODEL, language=lang)["text"]
    except ImportError:
        pass
    try:
        from faster_whisper import WhisperModel  # everywhere else (CPU or CUDA)
    except ImportError as e:
        raise RuntimeError("ASR needs mlx-whisper (Apple silicon) or faster-whisper (pip install faster-whisper); "
                           "or pass --no-asr") from e
    segments, _ = _fw_model(WhisperModel).transcribe(str(path), language=lang)
    return " ".join(s.text for s in segments).strip()


_FW = {}


def _fw_model(WhisperModel):
    # ponytail: one cached model per process; faster-whisper loads in seconds and is called once per take
    if "m" not in _FW:
        _FW["m"] = WhisperModel(ASR_MODEL_FW, device="auto", compute_type="int8")
    return _FW["m"]


def norm(s: str) -> str:
    return re.sub(r"\[[a-z]{2}\]|[\s\.,;:!?।、。？！\-\"'()]+", "", s).lower()


def highpass(y: np.ndarray, fc: float = 70.0) -> np.ndarray:
    """Remove sub-70 Hz rumble before pitch and naturalness analysis: a vocoder rumble tracks as a 65 Hz voiced note."""
    from scipy.signal import butter, sosfiltfilt
    return sosfiltfilt(butter(2, fc / (SR / 2), btype="high", output="sos"), y).astype(np.float32)


def transcript_fault(spoken: str, hyp: str) -> str | None:
    """A reason to reject a take from its transcript: a word repeated that the script does not repeat, or a transcript
    far longer or shorter than the script (dropped or added phrases). Loanword respellings pass."""
    a, b = norm(spoken), norm(hyp)
    if a and not 0.7 <= len(b) / len(a) <= 1.3:
        return f"length {len(b) / len(a):.2f}x"
    words = lambda x: [w for w in re.sub(r"\[[a-z]{2}\]|[\.,;:!?।、。？！\-\"'()]+", " ", x).lower().split() if w]
    sw, hw = words(spoken), words(hyp)
    for i in range(1, len(hw)):
        if hw[i] == hw[i - 1] and not any(sw[j] == sw[j - 1] == hw[i] for j in range(1, len(sw))):
            return f"repeat: {hw[i]}"
    return None


def units(text: str, lang: str) -> int:
    """Speech units for pace: words for languages written with spaces, characters for ja and zh. Script-agnostic, so an
    English loanword inside a Hindi line counts as one word like any other."""
    if LANG.get(lang, lang) in ("ja", "zh"):
        return len(norm(text))
    return len([w for w in re.sub(r"\[[a-z]{2}\]|[\.,;:!?।、。？！\-\"'()]+", " ", text).split() if w])


def cer(ref: str, hyp: str) -> float:
    a, b = norm(ref), norm(hyp)
    if not a:
        return 0.0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1] / len(a)


class Scorer:
    """Reference-relative voice scoring. Loads UTMOS and Chatterbox's voice encoder once; reuse across lines and takes."""

    def __init__(self, ref_path, ref_lang: str = "en", asr: bool = True):
        import torch
        from chatterbox.models.voice_encoder import VoiceEncoder
        from huggingface_hub import hf_hub_download
        self.torch = torch
        self.utmos_model = torch.hub.load("tarepan/SpeechMOS:v1.2.0", "utmos22_strong", trust_repo=True).eval()
        ve = VoiceEncoder()
        ve.load_state_dict(torch.load(hf_hub_download("ResembleAI/chatterbox", "ve.pt"), map_location="cpu", weights_only=True))
        self.ve = ve.eval()
        self.ref_lang = LANG.get(ref_lang, ref_lang)
        self.ref = load_wav(ref_path)
        self.ref_emb = self.embed(self.ref)
        self.ref_utmos = self.utmos(highpass(self.ref))  # same filtering as the lines, or the ratios are meaningless
        # pitch variability of the reference over line-sized windows: a 3 s line cannot be expected to swing as much as 10 s of varied sentences
        hp = highpass(self.ref)
        win, hop = int(3.5 * SR), int(1.0 * SR)
        stds = [self.f0std(hp[i:i + win]) for i in range(0, max(1, len(hp) - win + 1), hop)] if len(hp) > win else [self.f0std(hp)]
        self.ref_f0std = float(np.mean([x for x in stds if x > 0]) if any(x > 0 for x in stds) else self.f0std(hp))
        self.ref_rate = None
        if asr:  # speaking rate of the clip: words/s where the language has spaces, characters/s otherwise (ja, zh)
            self.ref_rate = units(transcribe(ref_path, self.ref_lang), self.ref_lang) / (len(self.ref) / SR)

    def utmos(self, y: np.ndarray) -> float:
        import librosa
        x = librosa.resample(y, orig_sr=SR, target_sr=16000)
        with self.torch.no_grad():
            return float(self.utmos_model(self.torch.from_numpy(np.ascontiguousarray(x)).unsqueeze(0), 16000))

    def embed(self, y: np.ndarray) -> np.ndarray:
        with self.torch.no_grad():
            e = self.ve.embeds_from_wavs([y], sample_rate=SR, as_spk=True)
        e = e.detach().cpu().numpy() if hasattr(e, "detach") else np.asarray(e)
        return e.reshape(-1)

    def sim(self, y: np.ndarray) -> float:
        a, b = self.embed(y), self.ref_emb
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))

    def rumble(self, y: np.ndarray) -> float:
        """Largest share of energy under 100 Hz in any 50 ms frame louder than -30 dB RMS (speech: under 0.1)."""
        win = int(0.05 * SR)
        if len(y) < 2 * win:
            return 0.0
        frames = np.lib.stride_tricks.sliding_window_view(y, win)[:: win // 2]
        rms_db = 20 * np.log10(np.sqrt(np.mean(frames ** 2, axis=1)) + 1e-9)
        spec = np.abs(np.fft.rfft(frames * np.hanning(win), axis=1)) ** 2
        low = spec[:, np.fft.rfftfreq(win, 1 / SR) < 100].sum(axis=1) / (spec.sum(axis=1) + 1e-12)
        return float(low[rms_db > -30].max()) if (rms_db > -30).any() else 0.0

    def gap(self, y: np.ndarray) -> float:
        """Longest stretch of non-speech inside the line, seconds: a hole the trim cannot remove, or a burst after one."""
        win, hop = int(0.02 * SR), int(0.01 * SR)
        if len(y) < 2 * win:
            return 0.0
        frames = np.lib.stride_tricks.sliding_window_view(y, win)[::hop]
        rms_db = 20 * np.log10(np.sqrt(np.mean(frames ** 2, axis=1)) + 1e-9)
        loud = np.flatnonzero(rms_db > max(-40.0, float(np.percentile(rms_db, 95)) - 24))
        return float(np.diff(loud).max() * hop / SR) if loud.size > 1 else 0.0

    def f0std(self, y: np.ndarray) -> float:
        import librosa
        f0, _, _ = librosa.pyin(y, fmin=65, fmax=400, sr=SR, frame_length=2048)
        f0 = f0[np.isfinite(f0)]
        return float(np.std(12 * np.log2(f0 / np.median(f0)))) if len(f0) >= 10 else 0.0

    def line(self, y: np.ndarray, spoken: str | None = None, lang: str | None = None) -> dict:
        """Score one line 0..10 with its components. `spoken` is the text that was voiced, for the pace check.
        A hole is over 0.8 s of non-speech inside the line (sentence pauses in this voice run to about 0.7 s)."""
        yh = highpass(y)
        u, s, p = self.utmos(yh), self.sim(y), self.f0std(yh)
        nat = 10 * clamp01(1 - max(0.0, self.ref_utmos - u))
        simi = 10 * clamp01((s - 0.55) / 0.30)
        pitch = 10 * clamp01(p / self.ref_f0std) if self.ref_f0std > 0 else 10.0
        rate, rate10 = None, 10.0
        if spoken and self.ref_rate and (lang is None or LANG.get(lang, lang) == self.ref_lang):
            rate = (units(spoken, lang or self.ref_lang) / (len(y) / SR)) / self.ref_rate
            rate10 = 10 * clamp01(1 - max(0.0, 0.8 - rate, rate - 1.3) / 0.4)
        g, rb = self.gap(y), self.rumble(y)
        faults = [f for f, bad in (("hole", g > 0.8), ("rumble", rb > 0.5), ("drag", rate is not None and rate < 0.75), ("rush", rate is not None and rate > 1.5)) if bad]  # sentence pauses run to 0.7 s; the clip is a slow read, so 1.5x it is brisk, not rushed
        score = 0.30 * nat + 0.25 * simi + 0.35 * pitch + 0.10 * rate10 - sum({"hole": 2.0, "rumble": 2.0, "drag": 1.5, "rush": 1.5}[f] for f in faults)
        return {"utmos": round(u, 3), "sim": round(s, 3), "f0std": round(p, 2), "rate": None if rate is None else round(rate, 2), "gap": round(g, 2),
                "rumble": round(rb, 2), "faults": faults, "nat10": round(nat, 1), "sim10": round(simi, 1), "pitch10": round(pitch, 1), "rate10": round(rate10, 1), "score": round(score, 2)}


def windows(ref_path, lang: str, length: float = 10.0, hop: float = 1.0) -> None:
    """Rank 10 s windows of a reference clip: Chatterbox conditions on the first 6 to 10 s of whatever it is given."""
    sc = Scorer(ref_path, lang, asr=False)
    y = sc.ref
    n = int(length * SR)
    rows = []
    for start in np.arange(0, max(1, len(y) - n + 1), int(hop * SR)):
        seg = y[int(start):int(start) + n]
        rows.append((start / SR, sc.utmos(seg), sc.f0std(seg)))
    u = np.array([r[1] for r in rows]); p = np.array([r[2] for r in rows])
    zu = (u - u.min()) / (np.ptp(u) or 1); zp = (p - p.min()) / (np.ptp(p) or 1)
    best = int(np.argmax(zu + 0.5 * zp))
    print(f"reference {ref_path}: {len(y)/SR:.1f}s, utmos {sc.ref_utmos:.2f}, f0 std {sc.ref_f0std:.2f} st")
    for k, (t, uu, pp) in enumerate(rows):
        print(f"  {t:5.1f}s  utmos {uu:.2f}  f0std {pp:.2f}{'  <- best' if k == best else ''}")
    print(f"best window starts at {rows[best][0]:.1f}s: ffmpeg -y -ss {rows[best][0]:.1f} -t {length:.0f} -i {ref_path} <out.wav>")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video_dir", nargs="?")
    ap.add_argument("--ref", required=True)
    ap.add_argument("--lang", default="en", help="language of the narration (en, hi, ja or the kokoro letter)")
    ap.add_argument("--ref-lang", default=None, help="language of the reference clip, if different")
    ap.add_argument("--round", type=int, default=1)
    ap.add_argument("--no-asr", action="store_true")
    ap.add_argument("--windows", action="store_true", help="rank 10 s windows of --ref instead of scoring a video")
    a = ap.parse_args()
    lang = LANG.get(a.lang, a.lang)
    if a.windows:
        return windows(a.ref, lang)
    vdir = Path(a.video_dir)
    tl = json.loads((vdir / "audio" / "timeline.json").read_text())
    sc = Scorer(a.ref, a.ref_lang or lang, asr=not a.no_asr)
    lines, caps = [], []
    narration = load_wav(vdir / "audio" / "narration.wav")  # score exactly what ships: the trimmed, level-matched slice
    for l in tl["lines"]:
        y = narration[int(l["start"] * SR):int(l["end"] * SR)]
        spoken = l.get("spoken", l["text"])
        r = sc.line(y, spoken=spoken, lang=lang)
        r.update({"i": l["i"], "dur": l["dur"], "spoken": spoken})
        if not a.no_asr:
            import soundfile as sf
            tmp = vdir / "critic" / f"_slice_{l['i']:02d}.wav"; tmp.parent.mkdir(exist_ok=True); sf.write(str(tmp), y, SR)
            hyp = transcribe(tmp, lang); tmp.unlink()
            r["cer"] = round(cer(spoken, hyp), 2)
            r["asr"] = hyp.strip()
            if (tf := transcript_fault(spoken, hyp)):
                r["faults"] = r["faults"] + [tf]; r["score"] = round(r["score"] - 3.0, 2)
        lines.append(r)
        print(f"{l['i']:02d} {r['score']:4.1f}  utmos {r['utmos']:.2f} sim {r['sim']:.2f} f0 {r['f0std']:.1f}st rate {r['rate'] or '-':>4} "
              f"gap {r['gap']:.2f} cer {r.get('cer', '-'):>4} {' '.join(r['faults']) or '':10s} {l['dur']:.2f}s  {spoken[:40]}")
    scores = [r["score"] for r in lines]
    score = float(np.mean(scores))
    if score > min(scores) + 1.5:
        caps.append(f"worst line {min(scores):.1f}: capped at worst + 1.5"); score = min(scores) + 1.5
    bad = [r["i"] for r in lines if r.get("cer", 0) > 0.35]
    if bad and lang == "en":  # Whisper is only reliable enough to cap on for English; elsewhere the transcript is advisory
        caps.append(f"lines {bad} have CER over 0.35: capped at 7.0"); score = min(score, 7.0)
    elif bad:
        caps.append(f"advisory: lines {bad} have CER over 0.35, read their transcripts")
    if tl["total_duration"] > 55:
        caps.append(f"narration is {tl['total_duration']:.1f}s, over 55 s: capped at 6.0"); score = min(score, 6.0)
    out = {"round": a.round, "score": round(score, 2), "reference": {"path": a.ref, "utmos": round(sc.ref_utmos, 3), "f0std": round(sc.ref_f0std, 2),
           "rate": None if sc.ref_rate is None else round(sc.ref_rate, 2)}, "total_duration": tl["total_duration"], "caps": caps, "lines": lines}
    (vdir / "critic").mkdir(exist_ok=True)
    (vdir / "critic" / f"voice_{a.round}.json").write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"voice score {score:.2f}/10  (ref utmos {sc.ref_utmos:.2f}, f0 std {sc.ref_f0std:.2f} st)  caps: {caps or 'none'}")


if __name__ == "__main__":
    main()
