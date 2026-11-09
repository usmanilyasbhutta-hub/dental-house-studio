"""Generate the UI sound-effect set (public/sfx/*.wav) in code: free, no samples, no licences.

Follows the procedural-foley principles: light levels (peak ≈ −10 dBFS), slow 4–6 ms attacks,
lowpassed whooshes, short tails, a touch of small-room reverb. numpy only (FFT filters).
Run: python3 scripts/make_sfx.py
"""
from pathlib import Path
import wave
import numpy as np

SR = 48000
rng = np.random.default_rng(7)
OUT = Path(__file__).resolve().parent.parent / "public" / "sfx"
OUT.mkdir(parents=True, exist_ok=True)


def t_(dur):
    return np.arange(int(dur * SR)) / SR


def band(x, lo=0.0, hi=None, soft=0.15):
    """FFT band filter with soft (raised-cosine) edges."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= np.clip((f - lo * (1 - soft)) / (lo * soft * 2), 0, 1)
    if hi:
        g *= np.clip((hi * (1 + soft) - f) / (hi * soft * 2), 0, 1)
    return np.fft.irfft(X * g, len(x))


def env(dur, attack=0.005, decay=0.08):
    t = t_(dur)
    return (1 - np.exp(-t / attack)) * np.exp(-t / decay)


def modes(dur, partials, attack=0.005):
    t = t_(dur)
    return (1 - np.exp(-t / attack)) * sum(a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-t / d) for f, a, d in partials)


def reverb(x, wet=0.18, tau=0.10):
    ir_t = t_(0.5)
    ir = band(rng.standard_normal(len(ir_t)) * np.exp(-ir_t / tau), 0, 3000)
    ir /= np.sqrt((ir ** 2).sum())
    y = np.fft.irfft(np.fft.rfft(x, len(x) + len(ir)) * np.fft.rfft(ir, len(x) + len(ir)))[: len(x) + len(ir) - 1]
    out = np.zeros(len(y))
    out[: len(x)] += x
    return out + wet * y


def finish(x, peak=0.32, tail=0.04):
    x = x - x.mean()
    n = int(tail * SR)
    x[-n:] *= np.linspace(1, 0, n)
    return x * peak / (np.abs(x).max() + 1e-9)


def stereo(x, width=0.006):
    d = int(width * SR)
    return np.stack([x, np.concatenate([np.zeros(d), x[:-d]])], 1)


def save(name, x, **kw):
    y = stereo(finish(reverb(x, **kw) if kw.get("wet", 1) else x))
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype("<i2").tobytes())
    hi = np.fft.rfft(y[:, 0]); f = np.fft.rfftfreq(len(y), 1 / SR)
    share = (np.abs(hi[f > 1500]) ** 2).sum() / (np.abs(hi) ** 2).sum()
    print(f"{name:11s} {len(y)/SR:4.2f}s  peak {20*np.log10(np.abs(y).max()):5.1f} dBFS  >1.5kHz {share*100:4.1f}%")


# whoosh: rising band-limited air, peaks at the end (place it to land on the reveal frame)
d = 0.42; t = t_(d)
x = band(rng.standard_normal(len(t)), 300, 1800) * (t / d) ** 2.2
x[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
save("whoosh", x)

# swoosh-out: falling version (exits)
save("swoosh-out", band(rng.standard_normal(len(t)), 250, 1500) * (1 - t / d) ** 2.4 * (1 - np.exp(-t / 0.01)))

# pop: soft bubble (tags, chips appearing)
d = 0.14; t = t_(d)
f = 520 * np.exp(-t / 0.05) + 260
save("pop", np.sin(2 * np.pi * np.cumsum(f) / SR) * env(d, 0.004, 0.035) + 0.15 * band(rng.standard_normal(len(t)), 400, 2000) * env(d, 0.002, 0.01))

# tick: tiny wooden tick (numbers, counters)
save("tick", band(modes(0.08, [(1100, 0.6, 0.012), (1900, 0.25, 0.008)]) + 0.3 * band(rng.standard_normal(int(0.08 * SR)), 800, 3000) * env(0.08, 0.002, 0.006), 0, 2600))

# click: UI click (buttons, CTA pill)
save("click", band(modes(0.06, [(1700, 0.5, 0.008), (3100, 0.2, 0.005)]) + 0.4 * band(rng.standard_normal(int(0.06 * SR)), 1000, 4000) * env(0.06, 0.001, 0.004), 0, 4200))

# thud: soft low impact (big word landing); muffled, wood-like body
save("thud", band(modes(0.35, [(70, 1.0, 0.08), (110, 0.6, 0.05), (230, 0.3, 0.025)]) + 0.5 * band(rng.standard_normal(int(0.35 * SR)), 40, 500) * env(0.35, 0.004, 0.03), 0, 1200), wet=0.12)

# shimmer: soft high chime cluster (sparkles, "result" moments); quiet and short
d = 0.9; t = t_(d)
x = sum(np.sin(2 * np.pi * fr * t) * np.exp(-t / dc) * (1 - np.exp(-t / 0.006)) * a
        for fr, dc, a in [(1568, 0.35, 0.5), (2093, 0.28, 0.35), (2637, 0.22, 0.25), (3136, 0.18, 0.15)])
save("shimmer", band(x, 0, 5000) * 0.8, wet=0.3, tau=0.18)
