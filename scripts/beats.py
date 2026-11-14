"""Beat and onset finder (librosa idea, our own numpy code): where the beats are in a music track, so cuts land on them.

Usage: python3 scripts/beats.py <audio> [--json out.json] [--fps 30]
Prints BPM, beat times and the beat frames at the video fps. Pure numpy + ffmpeg; nothing uploaded.
Method: onset strength = spectral flux of a log-magnitude STFT; tempo = strongest autocorrelation lag of the onset
envelope (60–180 BPM, gently weighted towards 120); beats = dynamic programming that rewards strong onsets one beat apart.
"""
import json
import subprocess
import sys

import numpy as np

SR, HOP, N = 22050, 512, 2048


def load(path):
    raw = subprocess.check_output(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"])
    return np.frombuffer(raw, np.float32)


def onset_envelope(y):
    win = np.hanning(N).astype(np.float32)
    frames = 1 + max(0, (len(y) - N) // HOP)
    S = np.empty((frames, N // 2 + 1), np.float32)
    for i in range(frames):
        S[i] = np.abs(np.fft.rfft(y[i * HOP : i * HOP + N] * win))
    L = np.log1p(100 * S)
    flux = np.maximum(0, np.diff(L, axis=0)).sum(axis=1)
    flux = np.concatenate([[0], flux])
    flux -= np.convolve(flux, np.ones(16) / 16, mode="same")  # remove slow loudness changes
    flux = np.maximum(flux, 0)
    return flux / (flux.max() + 1e-9)


def tempo(env):
    fr = SR / HOP
    ac = np.correlate(env, env, mode="full")[len(env) - 1 :]
    lags = np.arange(len(ac))
    bpm = 60 * fr / np.maximum(lags, 1)
    ok = (bpm >= 60) & (bpm <= 180)
    weight = np.exp(-0.5 * (np.log2(bpm / 120) / 0.9) ** 2)  # prefer musically common tempos
    score = np.where(ok, ac * weight, -np.inf)
    lag = int(np.argmax(score))
    return 60 * fr / lag, lag


def track(env, lag, tight=100.0):
    n = len(env)
    score = env.copy()
    back = np.full(n, -1)
    for t in range(n):
        lo, hi = t - 2 * lag, t - lag // 2
        if hi <= 0:
            continue
        prev = np.arange(max(0, lo), hi)
        pen = -tight * (np.log((t - prev) / lag)) ** 2
        k = int(np.argmax(score[prev] + pen))
        score[t] = env[t] + score[prev[k]] + pen[k]
        back[t] = prev[k]
    t = int(np.argmax(score[-2 * lag :])) + n - 2 * lag if n > 2 * lag else int(np.argmax(score))
    beats = []
    while t >= 0:
        beats.append(t)
        t = back[t]
    return np.array(beats[::-1])


def main():
    a = sys.argv[1:]
    if not a:
        sys.exit(__doc__)
    fps = int(a[a.index("--fps") + 1]) if "--fps" in a else 30
    y = load(a[0])
    env = onset_envelope(y)
    bpm, lag = tempo(env)
    beats = track(env, lag) * HOP / SR
    peaks = [i for i in range(1, len(env) - 1) if env[i] > 0.3 and env[i] >= env[i - 1] and env[i] > env[i + 1]]
    out = {"bpm": round(bpm, 1), "beats": [round(float(b), 3) for b in beats], "beat_frames": [int(round(b * fps)) for b in beats],
           "onsets": [round(i * HOP / SR, 3) for i in peaks], "fps": fps, "duration": round(len(y) / SR, 2)}
    print(f"{out['bpm']} BPM · {len(out['beats'])} beats · {len(out['onsets'])} onsets · {out['duration']} s")
    print("first beats (s):", out["beats"][:8])
    if "--json" in a:
        json.dump(out, open(a[a.index("--json") + 1], "w"), indent=1)


if __name__ == "__main__":
    main()
