"""Original wedding-season music bed, synthesised from scratch (brand rule: original or licensed music only).

A light dholki-style groove (low "dha", slap "ta", chimta jingles), harmonium-like chords (D minor: Dm-C-Bb-C) and a
santoor-like pentatonic pluck motif. 104 BPM, 22 s, 48 kHz stereo -> public/audio/wedding-dholki.mp3.
Nothing is sampled: every sound is generated below with numpy.
"""
from pathlib import Path
import subprocess
import wave
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR, DUR, BPM = 48000, 22.0, 104
rng = np.random.default_rng(7)
N = int(SR * DUR)
L = np.zeros(N)
R = np.zeros(N)
beat = 60 / BPM
hz = lambda m: 440 * 2 ** ((m - 69) / 12)


def add(sig, at, pan=0.0, gain=1.0):
    i = int(at * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    L[i : i + len(sig)] += sig * (1 - max(0, pan))
    R[i : i + len(sig)] += sig * (1 + min(0, pan))


def dha(length=0.38):
    t = np.arange(int(SR * length)) / SR
    f = 62 + 70 * np.exp(-t * 28)  # pitch drop
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * 9) + 0.15 * rng.standard_normal(len(t)) * np.exp(-t * 60)) * 0.9


def ta(length=0.12):
    t = np.arange(int(SR * length)) / SR
    noise = rng.standard_normal(len(t))
    noise = np.convolve(noise, np.ones(6) / 6, "same") - np.convolve(noise, np.ones(40) / 40, "same")  # crude band-pass
    return (0.8 * noise + 0.6 * np.sin(2 * np.pi * 410 * t)) * np.exp(-t * 38) * 0.55


def jingle(length=0.09):
    t = np.arange(int(SR * length)) / SR
    n = rng.standard_normal(len(t))
    n = n - np.convolve(n, np.ones(4) / 4, "same")  # high-pass
    return n * np.exp(-t * 55) * 0.22


def harmonium(notes, length):
    t = np.arange(int(SR * length)) / SR
    env = np.minimum(t / 0.08, 1) * np.minimum(1, (length - t) / 0.25).clip(0)
    out = np.zeros_like(t)
    for m in notes:
        for det in (-0.06, 0.06):  # two reeds, slightly detuned
            f = hz(m + det)
            for k, a in enumerate([1, 0.55, 0.38, 0.22, 0.14, 0.08], start=1):
                out += a * np.sin(2 * np.pi * f * k * t + k)
    return out * env * (1 + 0.04 * np.sin(2 * np.pi * 5.2 * t)) / (len(notes) * 9)


def pluck(m, length=0.9):
    t = np.arange(int(SR * length)) / SR
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2.01 * f * t) + 0.18 * np.sin(2 * np.pi * 3.02 * f * t)
    return s * np.exp(-t * 4.5) * np.minimum(t / 0.004, 1) * 0.28


bars = int(DUR / (4 * beat)) + 1
chords = [[50, 53, 57], [48, 52, 55], [46, 50, 53], [48, 52, 55]]  # Dm C Bb C (low register)
motif = [74, 72, 69, 67, 69, 72, 74, 77]  # D minor pentatonic phrase
for b in range(bars):
    t0 = b * 4 * beat
    ch = chords[(b // 2) % 4] if b % 2 == 0 else None
    if ch:
        add(harmonium(ch + [ch[0] + 12], 8 * beat + 0.2), t0, gain=0.9)
    # dholki chaal (8ths, light swing): dha . ta dha | . dha ta .
    sw = 0.035
    pattern = ["dha", None, "ta", "dha", None, "dha", "ta", "ta"]
    for k, hit in enumerate(pattern):
        at = t0 + k * beat / 2 + (sw if k % 2 else 0)
        if b == 0 and k < 2:
            continue
        if hit == "dha":
            add(dha(), at, pan=-0.1)
        elif hit == "ta":
            add(ta(), at, pan=0.2)
        if k % 2:
            add(jingle(), at, pan=0.45)
    if b >= 1:  # melody from bar 2, call-and-rest
        if b % 2 == 1:
            for k, m in enumerate(motif):
                add(pluck(m), t0 + k * beat / 2, pan=-0.3, gain=0.8)

t = np.arange(N) / SR
fade = np.minimum(1, np.minimum(t / 0.3, (DUR - t) / 2.0))
mix = np.stack([L, R], 1) * fade[:, None]
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.2) * 0.6  # gentle glue
pcm = (mix * 32767).astype("<i2")
wav = ROOT / "public" / "audio" / "wedding-dholki.wav"
with wave.open(str(wav), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-b:a", "192k", str(wav.with_suffix(".mp3"))], check=True)
wav.unlink()
print("wrote public/audio/wedding-dholki.mp3")
