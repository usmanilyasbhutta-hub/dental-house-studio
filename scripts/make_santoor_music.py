"""Original soft wedding music bed, synthesised from scratch (brand rule: original or licensed music only).

Santoor-like hammered plucks (D major pentatonic), a warm pad (D - Bm - G - A), and a light tabla-style pattern
("na" ring, "dha" bass, soft "ti" taps). 92 BPM, 21 s, 48 kHz stereo -> public/audio/wedding-santoor.mp3.
Every sound is generated below with numpy; nothing is sampled.
"""
from pathlib import Path
import subprocess
import wave
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR, DUR, BPM = 48000, 21.0, 92
rng = np.random.default_rng(11)
N = int(SR * DUR)
L = np.zeros(N)
R = np.zeros(N)
beat = 60 / BPM
hz = lambda m: 440 * 2 ** ((m - 69) / 12)


def add(sig, at, pan=0.0, gain=1.0):
    i = int(at * SR)
    if i >= N or i < 0:
        return
    sig = sig[: N - i] * gain
    L[i : i + len(sig)] += sig * (1 - max(0, pan))
    R[i : i + len(sig)] += sig * (1 + min(0, pan))


def santoor(m, length=1.6):
    """Hammered string: two slightly detuned strings, bright attack, long ring."""
    t = np.arange(int(SR * length)) / SR
    out = np.zeros_like(t)
    for det in (-0.04, 0.05):
        f = hz(m + det)
        for k, a in enumerate([1, 0.5, 0.33, 0.2, 0.12], start=1):
            out += a * np.sin(2 * np.pi * f * k * 1.002 ** k * t) * np.exp(-t * (2.2 + k * 1.1))
    click = rng.standard_normal(len(t)) * np.exp(-t * 400) * 0.15
    return (out / 4 + click) * np.minimum(t / 0.002, 1) * 0.32


def pad(notes, length):
    t = np.arange(int(SR * length)) / SR
    env = np.minimum(t / 1.0, 1) * np.clip((length - t) / 1.2, 0, 1)
    out = np.zeros_like(t)
    for m in notes:
        for det in (-0.08, 0.0, 0.08):
            f = hz(m + det)
            out += np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t + 0.3)
    lfo = 1 + 0.06 * np.sin(2 * np.pi * 0.25 * t)
    return out * env * lfo / (len(notes) * 9)


def tabla_na(length=0.5):
    t = np.arange(int(SR * length)) / SR
    f = 520 * (1 + 0.02 * np.exp(-t * 30))
    return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2.7 * f * t)) * np.exp(-t * 9) * 0.22


def tabla_dha(length=0.6):
    t = np.arange(int(SR * length)) / SR
    f = 95 + 60 * np.exp(-t * 6)  # bayan pitch bend
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * 5) * 0.5) + tabla_na(length)[: len(t)] * 0.6


def tabla_ti(length=0.08):
    t = np.arange(int(SR * length)) / SR
    n = rng.standard_normal(len(t))
    n = n - np.convolve(n, np.ones(5) / 5, "same")
    return n * np.exp(-t * 70) * 0.08


bar = 4 * beat
chords = [[50, 54, 57], [47, 50, 54], [43, 47, 50], [45, 49, 52]]  # D Bm G A
for b in range(int(DUR / bar) + 1):
    t0 = b * bar
    add(pad(chords[b % 4], bar + 1.2), t0, gain=0.9)
    if b >= 1:  # tabla enters on bar 2, keeps it light: dha . ti na | ti dha na ti
        for k, hit in enumerate(["dha", None, "ti", "na", "ti", "dha", "na", "ti"]):
            at = t0 + k * beat / 2
            if hit == "dha":
                add(tabla_dha(), at, pan=-0.15, gain=0.8)
            elif hit == "na":
                add(tabla_na(), at, pan=0.15)
            elif hit == "ti":
                add(tabla_ti(), at, pan=0.3)

# santoor melody (D major pentatonic), phrases with rests; a tremolo roll on long notes, as a santoor player would
D = {"D4": 62, "E4": 64, "F#4": 66, "A4": 69, "B4": 71, "D5": 74, "E5": 76, "F#5": 78, "A5": 81}
phrase = [("A4", 0), ("B4", 0.5), ("D5", 1), ("E5", 1.5), ("F#5", 2), ("E5", 3), ("D5", 3.5),
          ("B4", 4), ("A4", 4.5), ("B4", 5), ("D5", 6), ("A4", 7)]
for rep, start in enumerate([0.2, 4 * bar / 2 + 0.2, 8 * bar / 2 + 0.2, 12 * bar / 2 + 0.2]):
    for note, at in phrase:
        when = start + at * beat
        if when > DUR - 2.0:
            break
        add(santoor(D[note]), when, pan=-0.25 if rep % 2 else 0.25)
        if note in ("F#5", "D5") and at in (2, 6):  # tremolo
            for r in range(1, 5):
                add(santoor(D[note], 0.6), when + r * 0.07, pan=0.0, gain=0.35 / r)
    # high answer an octave up
    add(santoor(D["A5"]), start + 7.5 * beat, pan=0.3, gain=0.5)

t = np.arange(N) / SR
fade = np.minimum(1, np.minimum(t / 0.2, (DUR - t) / 2.5))
mix = np.stack([L, R], 1) * fade[:, None]
# small room: two short echoes
for d, g in ((0.071, 0.22), (0.113, 0.15)):
    k = int(SR * d)
    mix[k:] += mix[:-k][:, ::-1] * g
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.1) * 0.6
pcm = (mix * 32767).astype("<i2")
wav = ROOT / "public" / "audio" / "wedding-santoor.wav"
with wave.open(str(wav), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-b:a", "192k", str(wav.with_suffix(".mp3"))], check=True)
wav.unlink()
print("wrote public/audio/wedding-santoor.mp3")
