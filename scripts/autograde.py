"""Automatic colour correction ("one-click grade" idea, our own code, local).

Looks at ~30 frames, then:
  1. white balance from near-neutral pixels (white coat, walls, chair), so skin is not used to set the balance;
  2. levels: black and white points from the 0.5 % / 99.5 % percentiles (no clipping of whites);
  3. optional look on top (same presets as `npm run ff -- grade`).
Prints the ffmpeg filter it used, so the correction is reproducible.

Usage: python3 scripts/autograde.py <in.mp4> <out.mp4> [--look brand|warm|clinical|film|editorial|teal-orange|none] [--strength 1]
Never on clinical before/after material (golden rule 3): use it on doctor, clinic and b-roll footage.
"""
import argparse
import subprocess
import sys

import numpy as np

LOOKS = {
    "none": "",
    "brand": "colorbalance=rs=0.03:bs=-0.02:rh=0.02,curves=preset=medium_contrast,eq=saturation=0.92",
    "warm": "colorbalance=rs=0.04:bs=-0.04:rm=0.03:bm=-0.03,eq=saturation=1.05",
    "clinical": "colorbalance=rs=-0.03:bs=0.03,eq=contrast=1.06:saturation=0.95:brightness=0.01",
    "film": "curves=all='0/0.05 0.5/0.5 1/0.96',colorbalance=rh=0.03:bh=-0.03:bs=0.02,eq=saturation=0.9",
    "editorial": "curves=all='0/0.06 0.6/0.62 1/0.97',colorbalance=rm=0.02:bm=-0.03,eq=saturation=0.85",
    "teal-orange": "colorbalance=rs=-0.06:bs=0.08:rh=0.06:bh=-0.06,eq=saturation=1.08:contrast=1.05",
}


def sample(path, n=30, w=160):
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]))
    out = subprocess.check_output(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", path, "-vf", f"fps={n / max(dur, 0.1):.4f},scale={w}:-2", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    )
    h = len(out) // (w * 3)
    return np.frombuffer(out, np.uint8).reshape(-1, 3).astype(np.float32) / 255.0, h


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inp")
    ap.add_argument("out")
    ap.add_argument("--look", choices=list(LOOKS), default="none")
    ap.add_argument("--strength", type=float, default=1.0, help="0–1: how much of the correction to apply")
    a = ap.parse_args()
    if a.inp == a.out:
        sys.exit("output must differ from input")
    px, _ = sample(a.inp)
    mx, mn = px.max(1), px.min(1)
    sat = (mx - mn) / np.maximum(mx, 1e-3)
    neutral = px[(sat < 0.12) & (mx > 0.35) & (mx < 0.97)]
    if len(neutral) < 200:
        neutral = px  # fall back to grey-world on everything
    mean = neutral.mean(0)
    gains = mean.mean() / np.maximum(mean, 1e-3)
    gains = 1 + (np.clip(gains, 0.8, 1.25) - 1) * a.strength
    lo = np.percentile(px, 0.5, axis=0) * a.strength
    hi = 1 - (1 - np.percentile(px, 99.5, axis=0)) * a.strength
    r, g, b = gains
    vf = (
        f"colorchannelmixer=rr={r:.3f}:gg={g:.3f}:bb={b:.3f},"
        f"colorlevels=rimin={lo[0]:.3f}:gimin={lo[1]:.3f}:bimin={lo[2]:.3f}:rimax={min(1, hi[0]):.3f}:gimax={min(1, hi[1]):.3f}:bimax={min(1, hi[2]):.3f}"
    )
    if LOOKS[a.look]:
        vf += "," + LOOKS[a.look]
    print("filter:", vf)
    subprocess.check_call(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", a.inp, "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", a.out]
    )
    print("graded →", a.out)


if __name__ == "__main__":
    main()
