"""Prepare talking-head footage: trim, crop, paint out burned-in overlay text, colour-correct,
cut the speaker out (u2net human segmentation), upscale, and write a VP9 WebM with alpha + speech audio.

Called by scripts/prep_footage.ts with one JSON argument (validated brief settings).
Model: .cache/models/u2net_human_seg.onnx (download command in docs/talking-head.md).
"""
import json, subprocess, sys
import numpy as np
import cv2
import onnxruntime as ort

cfg = json.loads(sys.argv[1])
src, out = cfg["source"], cfg["out"]
t0, t1 = cfg["trim"]["start"], cfg["trim"]["end"]
c = cfg["crop"]
W, H = c["w"], c["h"]
SCALE = cfg.get("scale", 2)
OW, OH = W * SCALE // 2 * 2, H * SCALE // 2 * 2
FPS = 30

# --- decoder: trimmed + cropped raw RGB frames
dec = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-ss", str(t0), "-to", str(t1), "-i", src,
     "-vf", f"fps={FPS},crop={W}:{H}:{c['x']}:{c['y']}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    stdout=subprocess.PIPE)

# --- encoder: VP9 with alpha + audio from the same trimmed range
alpha = cfg["cutout"]
enc = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-y",
     "-f", "rawvideo", "-pix_fmt", "rgba" if alpha else "rgb24", "-s", f"{OW}x{OH}", "-r", str(FPS), "-i", "-",
     "-ss", str(t0), "-to", str(t1), "-i", src, "-map", "0:v", "-map", "1:a",
     "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p" if alpha else "yuv420p", "-b:v", "6M", "-deadline", "good", "-cpu-used", "4",
     "-auto-alt-ref", "0", "-c:a", "libopus", "-b:a", "128k", "-shortest", out],
    stdin=subprocess.PIPE)

sess = ort.InferenceSession(".cache/models/u2net_human_seg.onnx", providers=["CPUExecutionProvider"]) if alpha else None
inp = sess.get_inputs()[0].name if sess else None
MEAN, STD = np.array([0.485, 0.456, 0.406], np.float32), np.array([0.229, 0.224, 0.225], np.float32)
# remove-boxes in crop coordinates
boxes = [(b["x"] - c["x"], b["y"] - c["y"], b["w"], b["h"]) for b in cfg.get("remove", [])]
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))


def paint_out_text(img):
    """Thin bright strokes (overlay text/icons) inside the boxes → inpainted. Smooth white coat is left alone."""
    if not boxes:
        return img, 0
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    tophat = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, kernel)
    mask = np.zeros_like(gray)
    for x, y, w, h in boxes:
        x0, y0 = max(0, x), max(0, y)
        roi = tophat[y0 : y + h, x0 : x + w]
        mask[y0 : y + h, x0 : x + w] = ((roi > 28) & (gray[y0 : y + h, x0 : x + w] > 170)).astype(np.uint8) * 255
    n = int(mask.sum() // 255)
    if n < 120:  # coat folds give a few stray pixels; real overlay text gives hundreds
        return img, 0
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=2)
    return cv2.inpaint(img, mask, 4, cv2.INPAINT_TELEA), n


def grade(img):
    """neutral-skin: pull back the red/orange cast and a little saturation, lift mids slightly."""
    if cfg["grade"] != "neutral-skin":
        return img
    f = img.astype(np.float32)
    f[..., 0] *= 0.92
    f[..., 2] *= 1.05
    hsv = cv2.cvtColor(np.clip(f, 0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    hsv[..., 1] *= 0.86
    red = (hsv[..., 0] < 12) | (hsv[..., 0] > 168)  # OpenCV hue 0-180: reds/corals
    hsv[..., 1] = np.where(red, hsv[..., 1] * 0.82, hsv[..., 1])
    hsv[..., 2] = 255 * (hsv[..., 2] / 255) ** 0.94
    return cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2RGB)


def matte(img):
    x = (cv2.resize(img, (320, 320), interpolation=cv2.INTER_AREA).astype(np.float32) / 255 - MEAN) / STD
    m = sess.run(None, {inp: x.transpose(2, 0, 1)[None]})[0][0, 0]
    m = (m - m.min()) / (m.max() - m.min() + 1e-6)
    return cv2.resize(m, (W, H), interpolation=cv2.INTER_LINEAR)


prev, frames, painted = None, 0, 0
size = W * H * 3
while True:
    buf = dec.stdout.read(size)
    if len(buf) < size:
        break
    img = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
    img, n = paint_out_text(img)
    painted += n > 0
    seg_in = img
    img = grade(img)
    big = cv2.resize(img, (OW, OH), interpolation=cv2.INTER_LANCZOS4)
    big = cv2.addWeighted(big, 1.35, cv2.GaussianBlur(big, (0, 0), 1.6), -0.35, 0)  # mild unsharp
    if alpha:
        m = matte(seg_in)
        m = m if prev is None else 0.5 * m + 0.5 * prev  # temporal smoothing (less edge flicker)
        prev = m
        # keep only the speaker: largest connected region of the matte (drops floating specks / bg patches)
        n, lab, stats, _ = cv2.connectedComponentsWithStats((m > 0.35).astype(np.uint8), 8)
        if n > 2:
            keep = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
            body = cv2.dilate((lab == keep).astype(np.uint8), np.ones((7, 7), np.uint8))
            m = m * cv2.GaussianBlur(body.astype(np.float32), (0, 0), 2)
        a = cv2.resize(m, (OW, OH), interpolation=cv2.INTER_LINEAR)
        a = np.clip((a - 0.15) / 0.7, 0, 1)  # tighten soft halo
        a = cv2.GaussianBlur(a, (0, 0), 0.8)
        frame = np.dstack([big, (a * 255).astype(np.uint8)])
    else:
        frame = big
    enc.stdin.write(frame.tobytes())
    frames += 1
    if frames % 150 == 0:
        print(f"  {frames} frames", flush=True)

enc.stdin.close()
enc.wait()
print(json.dumps({"frames": frames, "overlay_frames_painted": painted, "size": [OW, OH], "out": out}))
