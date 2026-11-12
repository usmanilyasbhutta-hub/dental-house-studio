"""Original, happy wedding music bed, synthesised from scratch (brand rule: original or licensed music only).

Owner, Nov 2026: "Music needs a happy/celebrating feel. No operation theater sound." So: no sine beeps or clicky ticks.
Bright D major (I-V-vi-IV), bhangra-style dhol groove, hand claps on 2 and 4, tambourine, pumping accordion chords, a
bass line and a shehnai-style lead with vibrato and slides. 116 BPM, 21 s, 48 kHz stereo -> public/audio/wedding-celebration.mp3.
Every sound is generated below with numpy; nothing is sampled.
"""
from pathlib import Path
import subprocess
import wave
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR, DUR, BPM = 48000, 21.0, 116
rng = np.random.default_rng(23)
N = int(SR * DUR)
L = np.zeros(N)
R = np.zeros(N)
beat = 60 / BPM
bar = 4 * beat
hz = lambda m: 440 * 2 ** ((m - 69) / 12)


def add(sig, at, pan=0.0, gain=1.0):
    i = int(at * SR)
    if i >= N or i < 0:
        return
    sig = sig[: N - i] * gain
    L[i : i + len(sig)] += sig * (1 - max(0, pan))
    R[i : i + len(sig)] += sig * (1 + min(0, pan))


def lowpass(x, k):
    return np.convolve(x, np.ones(k) / k, "same")


def dhol_bass(length=0.42):  # "dagga": big low skin with a pitch drop
    t = np.arange(int(SR * length)) / SR
    f = 70 + 90 * np.exp(-t * 22)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5)
    slap = lowpass(rng.standard_normal(len(t)), 8) * np.exp(-t * 80) * 0.5
    return (body + slap) * 0.95


def dhol_high(length=0.16):  # "tilli": thin stick on the high side
    t = np.arange(int(SR * length)) / SR
    n = rng.standard_normal(len(t))
    n = lowpass(n, 3) - lowpass(n, 30)
    return (n * 1.1 + 0.5 * np.sin(2 * np.pi * 330 * t)) * np.exp(-t * 32) * 0.5


def clap():
    t = np.arange(int(SR * 0.22)) / SR
    n = rng.standard_normal(len(t))
    n = lowpass(n, 2) - lowpass(n, 14)
    env = sum(np.exp(-np.clip(t - d, 0, None) * 60) * (t >= d) for d in (0, 0.008, 0.017, 0.026))
    return n * env * 0.32


def tambourine(length=0.12):
    t = np.arange(int(SR * length)) / SR
    n = rng.standard_normal(len(t))
    n = n - lowpass(n, 3)
    jingle = sum(np.sin(2 * np.pi * f * t) for f in (6200, 7900, 9300)) * 0.15
    return (n + jingle) * np.exp(-t * 40) * 0.09


def accordion(notes, length):
    t = np.arange(int(SR * length)) / SR
    env = np.minimum(t / 0.015, 1) * np.exp(-t * 2.5) * np.clip((length - t) / 0.03, 0, 1)
    out = np.zeros_like(t)
    for m in notes:
        for det in (-0.07, 0.07):  # two reeds, musette tuning
            f = hz(m + det)
            for k, a in enumerate([1, 0.7, 0.5, 0.35, 0.22, 0.12], start=1):
                out += a * np.sin(2 * np.pi * f * k * t + k)
    return out * env / (len(notes) * 7)


def bass(m, length):
    t = np.arange(int(SR * length)) / SR
    f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 3 * f * t)
    return s * np.minimum(t / 0.01, 1) * np.exp(-t * 3) * 0.42


def shehnai(m, length, prev=None):
    """Double-reed lead: nasal harmonics, vibrato that grows, a short slide (meend) from the previous note."""
    t = np.arange(int(SR * length)) / SR
    start = hz(prev) if prev else hz(m)
    f = hz(m) + (start - hz(m)) * np.exp(-t * 28)
    vib = 1 + 0.012 * np.sin(2 * np.pi * 5.8 * t) * np.clip(t / 0.25, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    amps = [0.55, 1.0, 0.85, 0.7, 0.5, 0.32, 0.2, 0.12]
    s = sum(a * np.sin(k * ph) for k, a in enumerate(amps, start=1))
    env = np.minimum(t / 0.03, 1) * np.clip((length - t) / 0.05, 0, 1) * (0.9 + 0.1 * np.sin(2 * np.pi * 3 * t))
    return s * env * 0.07


# ---- arrangement -----------------------------------------------------------------------------------------------------
prog = [(62, [62, 66, 69]), (57, [61, 64, 69]), (59, [62, 66, 71]), (55, [62, 67, 71])]  # D  A  Bm  G
n_bars = int(DUR / bar) + 1
for b in range(n_bars):
    t0 = b * bar
    root, chord = prog[b % 4]
    # bass: root on 1, octave pop on the "and" of 2, fifth on 3
    for at, m, ln in ((0, root - 24, 0.45), (1.5, root - 12, 0.25), (2, root - 17, 0.45), (3.5, root - 12, 0.25)):
        add(bass(m, ln), t0 + at * beat, gain=0.95)
    # accordion pumps on the off-beats (the happy "oom-PAH")
    for k in range(4):
        add(accordion(chord, beat * 0.42), t0 + (k + 0.5) * beat, pan=0.25, gain=0.85)
    # dhol chaal (8ths): DHA . tin DHA | tin DHA tin tin
    for k, hit in enumerate(["B", "h", "h", "B", "h", "B", "h", "h"]):
        at = t0 + k * beat / 2 + (0.018 if k % 2 else 0)
        add(dhol_bass() if hit == "B" else dhol_high(), at, pan=-0.12 if hit == "B" else 0.15, gain=0.9 if hit == "B" else 0.8)
    for k in (1, 3):  # claps on 2 and 4
        add(clap(), t0 + k * beat, pan=-0.3)
        add(clap(), t0 + k * beat + 0.004, pan=0.3, gain=0.8)
    for k in range(16):  # tambourine 16ths, accent on the off-beats
        add(tambourine(), t0 + k * beat / 4, pan=0.45, gain=1.0 if k % 2 else 0.55)

# shehnai melody, D major (Bilawal), 4-bar phrase, answered an octave-ish higher; enters right away (the hook plays on frame 0)
phrase = [  # (midi, start in beats, length in beats)
    (74, 0, 1), (76, 1, 0.5), (78, 1.5, 0.5), (81, 2, 1.5), (78, 3.5, 0.5),
    (76, 4, 1), (78, 5, 0.5), (76, 5.5, 0.5), (73, 6, 2),
    (71, 8, 1), (73, 9, 0.5), (74, 9.5, 0.5), (76, 10, 1.5), (74, 11.5, 0.5),
    (79, 12, 1), (78, 13, 0.5), (76, 13.5, 0.5), (74, 14, 2),
]
answer = [(m + (5 if i % 3 == 0 else 0), s, d) for i, (m, s, d) in enumerate(phrase)]
prev = None
for start_bar, notes in ((0, phrase), (4, answer), (8, phrase), (12, answer)):
    for m, s, d in notes:
        when = start_bar * bar + s * beat
        if when > DUR - 1.6:
            break
        add(shehnai(m, d * beat * 0.98, prev), when, pan=-0.1)
        prev = m

# ending: big dhol + crash-like noise swell on the last downbeat, then ring out
end_at = int((DUR - 1.6) / bar) * bar + bar if int((DUR - 1.6) / bar) * bar + bar < DUR - 1.0 else DUR - 1.5
for d in (0, 0.05):
    add(dhol_bass(0.8), end_at + d, gain=1.1)
t = np.arange(int(SR * 1.4)) / SR
add((rng.standard_normal(len(t)) - lowpass(rng.standard_normal(len(t)), 4)) * np.exp(-t * 3) * 0.12, end_at)

t = np.arange(N) / SR
fade = np.minimum(1, np.minimum(t / 0.05, (DUR - t) / 1.2))
mix = np.stack([L, R], 1) * fade[:, None]
for d, g in ((0.09, 0.16), (0.137, 0.1)):  # small room
    k = int(SR * d)
    mix[k:] += mix[:-k][:, ::-1] * g
mix = np.tanh(mix / np.max(np.abs(mix)) * 1.3) * 0.62
pcm = (mix * 32767).astype("<i2")
wav = ROOT / "public" / "audio" / "wedding-celebration.wav"
with wave.open(str(wav), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-b:a", "192k", str(wav.with_suffix(".mp3"))], check=True)
wav.unlink()
print("wrote public/audio/wedding-celebration.mp3")
