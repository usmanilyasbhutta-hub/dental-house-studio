"""Synthetic before/after ILLUSTRATIONS for the demo case (not a patient), and an
original ambient music bed (brand rule: synthesised music only, no copyrighted tracks)."""
from pathlib import Path
import subprocess
import wave
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
case_dir = ROOT / "public" / "cases" / "demo-case"
case_dir.mkdir(parents=True, exist_ok=True)


def smile(gap: bool) -> Image.Image:
    W, H = 1200, 1000
    img = Image.new("RGB", (W, H), (92, 34, 40))
    d = ImageDraw.Draw(img)
    d.ellipse([60, 180, W - 60, H - 160], fill=(150, 62, 70))  # lips
    d.ellipse([150, 300, W - 150, H - 280], fill=(55, 18, 22))  # mouth
    d.rectangle([150, 300, W - 150, 470], fill=(196, 102, 108))  # gingiva
    widths = [96, 112, 132, 150, 150, 132, 112, 96]
    total = sum(widths) + (44 if gap else 0)
    x = (W - total) / 2
    for i, w in enumerate(widths):
        if gap and i == 4:
            x += 44
        h = 270 if i in (3, 4) else 240 - abs(i - 3.5) * 14
        shade = (236, 230, 212) if not gap else (226, 214, 186)
        d.rounded_rectangle([x + 3, 400, x + w - 3, 400 + h], radius=30, fill=shade, outline=(170, 150, 130), width=3)
        x += w
    img = img.filter(ImageFilter.GaussianBlur(1.4))
    d = ImageDraw.Draw(img)
    d.text((30, 30), "SYNTHETIC ILLUSTRATION - NOT A PATIENT", fill=(255, 255, 255))
    return img


smile(True).save(case_dir / "before.png")
smile(False).save(case_dir / "after.png")

# --- music: slow Am - F - C - G pad with soft pulse, 40 s, 48 kHz stereo -----
sr, dur = 48000, 40
t = np.arange(sr * dur) / sr
chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # MIDI
out = np.zeros_like(t)
bar = 4.0
for k, ch in enumerate(chords * (dur // int(bar * 4) + 1)):
    start = k * bar
    if start >= dur:
        break
    seg = (t >= start) & (t < start + bar + 1.5)
    tt = t[seg] - start
    env = np.minimum(tt / 1.2, 1) * np.exp(-np.maximum(tt - bar, 0) * 2.5)
    for n in ch + [ch[0] - 12]:
        f = 440 * 2 ** ((n - 69) / 12)
        out[seg] += env * (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt + 0.4)) / 6
pulse = 0.5 + 0.5 * np.sin(2 * np.pi * t * (90 / 60))
out += 0.04 * pulse * np.sin(2 * np.pi * 220 * t) * np.exp(-((t * 1.5) % 1) * 6)
fade = np.minimum(1, np.minimum(t / 1.5, (dur - t) / 2.5))
out *= fade
out = out / np.max(np.abs(out)) * 0.5
left = out
right = np.roll(out, int(sr * 0.012))
pcm = (np.stack([left, right], 1) * 32767).astype("<i2")
wav = ROOT / "public" / "audio" / "pad-calm.wav"
wav.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(wav), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes())
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-b:a", "160k", str(wav.with_suffix(".mp3"))], check=True)
wav.unlink()
print("demo assets written")
