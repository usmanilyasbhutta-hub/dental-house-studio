"""Measure reference videos to learn an editing style.

Usage: python3 scripts/analyze_reference.py references/inbox/*.mp4 [*.mov]
Writes references/analysis/<name>/metrics.json + sheet.jpg and references/analysis/summary.md.
(references/ is gitignored: reference videos may show patients.)

Measures: format, duration, cuts (scene changes) and shot length, motion energy,
brightness/saturation/warmth, dominant colours, loudness, silence share.
"""
import json, re, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

OUT = Path("references/analysis")


def run(args, **kw):
    return subprocess.run(args, capture_output=True, text=True, **kw)


def probe(f):
    j = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", f]).stdout)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    a = next((s for s in j["streams"] if s["codec_type"] == "audio"), None)
    n, d = map(int, v["r_frame_rate"].split("/"))
    rot = 0
    for sd in v.get("side_data_list", []):
        rot = int(sd.get("rotation", 0)) or rot
    w, h = v["width"], v["height"]
    if abs(rot) == 90:
        w, h = h, w
    return dict(width=w, height=h, fps=round(n / d, 2), duration=round(float(j["format"]["duration"]), 2), audio=bool(a))


def cuts(f, thr=0.30):
    err = run(["ffmpeg", "-hide_banner", "-i", f, "-vf", f"select='gt(scene,{thr})',showinfo", "-an", "-f", "null", "-"]).stderr
    return [round(float(t), 2) for t in re.findall(r"pts_time:([\d.]+)", err)]


def frames(f, fps=4, w=96):
    """Low-res RGB frames as numpy array (n, h, w, 3)."""
    p = run(["ffmpeg", "-v", "error", "-i", f, "-vf", f"fps={fps},scale={w}:-2", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], text=False) if False else \
        subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-vf", f"fps={fps},scale={w}:-2", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True)
    info = probe(f)
    h = int(round(w * info["height"] / info["width"] / 2) * 2)
    arr = np.frombuffer(p.stdout, np.uint8)
    n = arr.size // (w * h * 3)
    return arr[: n * w * h * 3].reshape(n, h, w, 3).astype(np.float32)


def colour_stats(fr):
    rgb = fr / 255.0
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    warmth = (rgb[..., 0] - rgb[..., 2]).mean()
    # dominant colours: k-means (k=6) on sampled pixels
    px = fr.reshape(-1, 3)[:: max(1, fr.size // 3 // 20000)]
    rng = np.random.default_rng(0)
    c = px[rng.choice(len(px), 6, replace=False)]
    for _ in range(12):
        lab = ((px[:, None] - c[None]) ** 2).sum(-1).argmin(1)
        c = np.array([px[lab == k].mean(0) if (lab == k).any() else c[k] for k in range(6)])
    share = np.bincount(lab, minlength=6) / len(lab)
    order = share.argsort()[::-1]
    palette = [{"hex": "#%02X%02X%02X" % tuple(int(v) for v in c[k]), "share": round(float(share[k]), 3)} for k in order]
    motion = float(np.abs(np.diff(fr, axis=0)).mean()) if len(fr) > 1 else 0.0
    return dict(brightness=round(float(lum.mean()), 3), contrast=round(float(lum.std()), 3), saturation=round(float(sat.mean()), 3),
                warmth=round(float(warmth), 3), motion=round(motion, 2), palette=palette)


def audio_stats(f, dur):
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", f, "-af", "ebur128=peak=true,silencedetect=n=-40dB:d=0.4", "-f", "null", "-"]).stderr
    s = err[err.rfind("Summary:"):]
    I = re.search(r"I:\s+(-?[\d.]+) LUFS", s)
    lra = re.search(r"LRA:\s+([\d.]+) LU", s)
    sil = sum(float(x) for x in re.findall(r"silence_duration: ([\d.]+)", err))
    return dict(lufs=float(I.group(1)) if I else None, lra=float(lra.group(1)) if lra else None, silence_share=round(sil / dur, 2) if dur else None)


def sheet(f, info, out, n=16, cols=8):
    times = [info["duration"] * (i + 0.5) / n for i in range(n)]
    tiles = []
    for t in times:
        p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", f, "-frames:v", "1", "-vf", "scale=270:-2", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True)
        try:
            from io import BytesIO
            im = Image.open(BytesIO(p.stdout)).convert("RGB")
        except Exception:
            im = Image.new("RGB", (270, 480), "black")
        d = ImageDraw.Draw(im)
        d.rectangle([0, 0, 64, 18], fill="black")
        d.text((4, 3), f"{t:5.1f}s", fill="white")
        tiles.append(im)
    w, h = tiles[0].size
    rows = (n + cols - 1) // cols
    grid = Image.new("RGB", (cols * (w + 6), rows * (h + 6)), "white")
    for i, im in enumerate(tiles):
        grid.paste(im.resize((w, h)), ((i % cols) * (w + 6), (i // cols) * (h + 6)))
    grid.save(out, quality=85)


def main(files):
    rows = []
    for f in files:
        name = Path(f).stem.split("-", 1)[-1][:40]
        d = OUT / name
        d.mkdir(parents=True, exist_ok=True)
        info = probe(f)
        c = cuts(f)
        shots = np.diff([0, *c, info["duration"]])
        m = dict(file=f, **info, cuts=len(c), cut_times=c,
                 avg_shot=round(float(shots.mean()), 2), median_shot=round(float(np.median(shots)), 2),
                 cuts_per_10s=round(10 * len(c) / info["duration"], 1),
                 **colour_stats(frames(f)), **(audio_stats(f, info["duration"]) if info["audio"] else {}))
        (d / "metrics.json").write_text(json.dumps(m, indent=2))
        sheet(f, info, d / "sheet.jpg")
        rows.append((name, m))
        print(f"{name}: {info['duration']}s {info['width']}x{info['height']} cuts={len(c)} avg_shot={m['avg_shot']}s motion={m['motion']} lufs={m.get('lufs')}")
    hdr = "| Video | Size | Dur s | Cuts | Avg shot s | Motion | Bright | Sat | Warm | LUFS | Silence | Top colours |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n"
    body = "".join(
        f"| {n} | {m['width']}x{m['height']} | {m['duration']} | {m['cuts']} | {m['avg_shot']} | {m['motion']} | {m['brightness']} | {m['saturation']} | {m['warmth']} | {m.get('lufs')} | {m.get('silence_share')} | {' '.join(p['hex'] for p in m['palette'][:4])} |\n"
        for n, m in rows)
    (OUT / "summary.md").write_text("# Reference analysis\n\n" + hdr + body)


if __name__ == "__main__":
    main(sys.argv[1:])
