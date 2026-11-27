#!/usr/bin/env python3
"""Light, original sound bed for the Earth → clinic zoom (owner: "light sound"): soft air that swells as the camera falls,
settling into a quiet street ambience (low traffic rumble, distant soft horns) for the last seconds and the drive-by.
Usage: python3 scripts/make_zoom_ambience.py [seconds] → public/audio/earth-zoom-ambience.mp3"""
import subprocess, sys, wave
from pathlib import Path
import numpy as np

SR = 48000
T = float(sys.argv[1]) if len(sys.argv) > 1 else 14.6
n = int(SR * T)
t = np.arange(n) / SR
rng = np.random.default_rng(7)

def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc; y[i] = acc
    return y

def band(x, lo, hi):
    return lowpass(x, hi) - lowpass(x, lo)

# air: band noise whose brightness and level follow the descent (peaks mid-zoom), stereo-decorrelated
env = np.interp(t, [0, 1.0, 5.5, 8.5, 10.5, 12.0, T], [0.25, 0.5, 1.0, 0.75, 0.35, 0.18, 0.12])
air = [band(rng.standard_normal(n), 180, 2600) * env for _ in range(2)]
# slow swirl
air = [a * (0.8 + 0.2 * np.sin(2 * np.pi * (0.13 + 0.05 * k) * t)) for k, a in enumerate(air)]
# street: low rumble + passing-car swells, then two very soft distant horns, only near the ground
street_env = np.interp(t, [0, 8.0, 10.5, T], [0, 0, 1, 1])
rumble = band(rng.standard_normal(n), 40, 260)
swell = np.zeros(n)
for c in [9.2, 10.4, 11.6, 12.7, 13.8]:
    swell += np.exp(-((t - c) / 0.55) ** 2)
street = rumble * (0.5 + 0.8 * swell) * street_env
horn = np.zeros(n)
for c, f in [(11.1, 410), (13.2, 370)]:
    w = np.exp(-((t - c) / 0.12) ** 2)
    horn += w * (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2 * f * t))
horn = lowpass(horn, 1500) * 0.05
L = air[0] * 0.6 + street * 0.9 + horn * 0.8
Rc = air[1] * 0.6 + street * 0.85 + horn * 0.6
fade = np.minimum(1, np.minimum(t / 0.4, (T - t) / 0.6))
st = np.stack([L * fade, Rc * fade], 1)
st /= np.abs(st).max() / 0.7
out = Path(__file__).resolve().parent.parent / "public/audio/earth-zoom-ambience"
with wave.open(str(out) + ".wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st * 32767).astype("<i2").tobytes())
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(out) + ".wav", "-b:a", "192k", str(out) + ".mp3"], check=True)
Path(str(out) + ".wav").unlink()
print("wrote", str(out) + ".mp3")
